import { Elysia, t } from "elysia";
import { Decimal } from "@prisma/client/runtime/client"
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../plugins/auth.plugin";
import { generateDocumentNumber } from "./docnumber.route";

// Helper to add totalAmount to job
const enrichJobWithTotal = (job: any) => ({
  ...job,
  totalAmount: job.items.reduce((sum: number, item: any) => sum + Number(item.amount), 0),
});

// Helper to add totalAmount to jobs in billing note
const enrichBillingWithJobTotals = (billing: any) => ({
  ...billing,
  jobs: billing.jobs.map(enrichJobWithTotal),
});

// Generate billing reference number
async function generateBillingRef(vendorId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = "VBS";

  // Get the last billing note for this year
  const lastBilling = await prisma.billingNote.findFirst({
    where: {
      vendorId,
      billingRef: { startsWith: `${prefix}${year}` },
    },
    orderBy: { billingRef: "desc" },
  });

  let nextNumber = 1;
  if (lastBilling) {
    const lastNumber = parseInt(lastBilling.billingRef.slice(-4));
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${year}-${String(nextNumber).padStart(4, "0")}`;
}

// Calculate billing amounts
interface CalculationResult {
  subtotal: Decimal;
  priceBeforeVat: Decimal;
  vatAmount: Decimal;
  whtAmount: Decimal;
  netTotal: Decimal;
  vatRate: number;
  whtRate: number;
}

async function calculateBillingAmounts(
  jobIds: string[],
  vendorId: string,
  calculateBeforeVatOverride?: boolean
): Promise<CalculationResult> {
  // Get VAT config
  const vatConfig = await prisma.vatConfigByVendor.findUnique({
    where: { vendorId },
  });

  // Get all job items
  const jobs = await prisma.job.findMany({
    where: { id: { in: jobIds } },
    include: { items: true },
  });

  // Calculate subtotal
  const subtotal = jobs.reduce(
    (sum, job) =>
      sum +
      job.items.reduce((itemSum, item) => itemSum + Number(item.amount), 0),
    0
  );

  // Default rates
  const vatRate = vatConfig ? Number(vatConfig.vatRate) : 7;
  const whtRate = vatConfig ? Number(vatConfig.whtRate) : 3;

  // Use override if provided, otherwise use config, otherwise default to false
  const calculateBeforeVat = calculateBeforeVatOverride ?? (vatConfig?.calculateBeforeVat ?? false);

  // VAT divisor for extracting price before VAT (e.g., 1.07 for 7% VAT)
  const VAT_DIVISOR = 1 + (vatRate / 100);

  let priceBeforeVat: number;
  let vatAmount: number;
  let whtAmount: number;

  if (calculateBeforeVat) {
    // Case 1: subtotal is price BEFORE VAT
    priceBeforeVat = subtotal;

    vatAmount = Math.round((priceBeforeVat * vatRate) / 100 * 100) / 100;
    whtAmount = Math.round((priceBeforeVat * whtRate) / 100 * 100) / 100;
  } else {
    // Case 2: subtotal INCLUDES VAT already
    // Extract price before VAT by dividing by VAT divisor
    priceBeforeVat = Math.round(subtotal / VAT_DIVISOR * 100) / 100;

    // Calculate VAT and WHT from the extracted price before VAT
    vatAmount = Math.round((priceBeforeVat * vatRate) / 100 * 100) / 100;
    whtAmount = Math.round((priceBeforeVat * whtRate) / 100 * 100) / 100;
  }

  // Net total: priceBeforeVat + VAT - WHT
  const netTotal = Math.round((priceBeforeVat + vatAmount - whtAmount) * 100) / 100;

  return {
    subtotal: new Decimal(subtotal.toFixed(2)),
    priceBeforeVat: new Decimal(priceBeforeVat.toFixed(2)),
    vatAmount: new Decimal(vatAmount.toFixed(2)),
    whtAmount: new Decimal(whtAmount.toFixed(2)),
    netTotal: new Decimal(netTotal.toFixed(2)),
    vatRate,
    whtRate,
  };
}


export const billingRoutes = new Elysia({
  prefix: "/billing",
  tags: ["Billing"]
})
  .use(requireAuth)
  // List billing notes
  .get(
    "/",
    async ({ user, query }) => {
      // Determine vendorId based on role
      let vendorId: string | undefined;

      if (user?.role === "ADMIN" || user?.role === "USER") {
        // Admin/User: use vendorId from query param
        vendorId = query.vendorId;
        if (!vendorId) {
          return {
            success: false,
            error: "Vendor ID is required for admin/user access",
          };
        }
      } else {
        // Vendor: use vendorId from JWT
        vendorId = user?.vendorId ?? undefined;
        if (!vendorId) {
          return {
            success: false,
            error: "Vendor information missing for this account",
          };
        }
      }

      const { status, page = "1", limit = "20" } = query;

      const where: any = { vendorId };
      if (status) {
        where.statusBillingNote = status;
      }

      const [billings, total] = await Promise.all([
        prisma.billingNote.findMany({
          where,
          include: {
            jobs: {
              include: { items: true },
            },
            receipt: true,
          },
          orderBy: { createdAt: "desc" },
          skip: (parseInt(page) - 1) * parseInt(limit),
          take: parseInt(limit),
        }),
        prisma.billingNote.count({ where }),
      ]);

      return {
        success: true,
        data: billings.map(enrichBillingWithJobTotals),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      };
    },
    {
      query: t.Object({
        vendorId: t.Optional(t.String()),
        status: t.Optional(
          t.Enum({
            PENDING: "PENDING",
            SUBMITTED: "SUBMITTED",
            APPROVED: "APPROVED",
            PAID: "PAID",
            CANCELLED: "CANCELLED",
          })
        ),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
      detail: {
        summary: "List billing notes",
        description: "List billing notes. Admin/User must provide vendorId query param.",
      },
    }
  )

  // Get billing note by ID
  .get(
    "/:id",
    async ({ params, user, set }) => {
      const billing = await prisma.billingNote.findFirst({
        where: { id: params.id, vendorId: user!.vendorId! },
        include: {
          jobs: {
            include: { items: true },
          },
          receipt: true,
          vendor: true,
        },
      });

      if (!billing) {
        set.status = 404;
        return { success: false, error: "Billing note not found" };
      }

      return { success: true, data: enrichBillingWithJobTotals(billing) };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Get billing note by ID",
      },
    }
  )

  // Preview calculation (before creating)
  .post(
    "/preview",
    async ({ body, user, set }) => {
      const { jobIds, calculateBeforeVat } = body;
      // Verify all jobs belong to vendor (allow both PENDING and BILLED for preview/edit)
      const jobs = await prisma.job.findMany({
        where: {
          id: { in: jobIds },
          vendorId: user!.vendorId!,
        },
        include: { items: true },
      });

      if (jobs.length !== jobIds.length) {
        set.status = 400;
        return {
          success: false,
          error: "Some jobs are not found or not yours",
        };
      }

      const calculation = await calculateBillingAmounts(jobIds, user!.vendorId!, calculateBeforeVat);

      return {
        success: true,
        data: {
          jobs: jobs.map(enrichJobWithTotal),
          calculation: {
            subtotal: Number(calculation.subtotal),
            priceBeforeVat: Number(calculation.priceBeforeVat),
            vatAmount: Number(calculation.vatAmount),
            whtAmount: Number(calculation.whtAmount),
            netTotal: Number(calculation.netTotal),
            vatRate: calculation.vatRate,
            whtRate: calculation.whtRate,
          },
        },
      };
    },
    {
      body: t.Object({
        jobIds: t.Array(t.String(), { minItems: 1 }),
        calculateBeforeVat: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: "Preview billing calculation",
        description: "Calculate amounts before creating billing note",
      },
    }
  )

  // Create billing note
  .post(
    "/",
    async ({ body, user, set }) => {
      const { jobIds, billingRef: customRef, calculateBeforeVat, remark } = body;

      // Verify all jobs belong to vendor and are pending
      const jobs = await prisma.job.findMany({
        where: {
          id: { in: jobIds },
          vendorId: user!.vendorId!,
          statusJob: "PENDING",
        },
      });

      if (jobs.length !== jobIds.length) {
        set.status = 400;
        return {
          success: false,
          error: "Some jobs are not found, already billed, or not yours",
        };
      }

      // Generate billing ref: try auto-numbering first, then fallback to default
      let billingRef = customRef;
      if (!billingRef) {
        // Try to use auto-numbering system
        const autoNumber = await generateDocumentNumber(user!.vendorId!, "BILLING", new Date());
        billingRef = autoNumber || (await generateBillingRef(user!.vendorId!));
      }

      // Check if billing ref already exists
      const existingRef = await prisma.billingNote.findUnique({
        where: { billingRef },
      });

      if (existingRef) {
        set.status = 400;
        return { success: false, error: "Billing reference already exists" };
      }

      // Get VAT config for snapshot
      const vatConfig = await prisma.vatConfigByVendor.findUnique({
        where: { vendorId: user!.vendorId! },
      });
      const vatRate = vatConfig ? Number(vatConfig.vatRate) : 7;
      const whtRate = vatConfig ? Number(vatConfig.whtRate) : 3;

      // Calculate amounts
      const calculation = await calculateBillingAmounts(jobIds, user!.vendorId!, calculateBeforeVat);

      // Create billing note and update jobs in transaction
      const billing = await prisma.$transaction(async (tx) => {
        // Create billing note
        const newBilling = await tx.billingNote.create({
          data: {
            billingRef,
            vendorId: user!.vendorId!,
            billingDate: new Date(),
            subtotal: calculation.subtotal,
            priceBeforeVat: calculation.priceBeforeVat,
            vatAmount: calculation.vatAmount,
            whtAmount: calculation.whtAmount,
            netTotal: calculation.netTotal,
            statusBillingNote: "PENDING",
            remark,
            vatRateText: String(vatRate),
            whtRateText: String(whtRate),
          },
        });

        // Update jobs to link to billing note
        await tx.job.updateMany({
          where: { id: { in: jobIds } },
          data: {
            billingNoteId: newBilling.id,
            statusJob: "BILLED",
          },
        });

        // Return with jobs
        return tx.billingNote.findUnique({
          where: { id: newBilling.id },
          include: {
            jobs: { include: { items: true } },
          },
        });
      });

      return { success: true, data: enrichBillingWithJobTotals(billing) };
    },
    {
      body: t.Object({
        jobIds: t.Array(t.String(), { minItems: 1 }),
        billingRef: t.Optional(t.String()),
        calculateBeforeVat: t.Optional(t.Boolean()),
        remark: t.Optional(t.String()),
      }),
      detail: {
        summary: "Create billing note",
        description: "Create billing note from selected jobs",
      },
    }
  )

  // Update billing status
  .patch(
    "/:id/status",
    async ({ params, body, user, set }) => {
      // Build query based on role
      const where: any = { id: params.id };

      // Admin/User can update any billing, vendor can only update their own
      if (user?.role !== "ADMIN" && user?.role !== "USER") {
        if (!user?.vendorId) {
          set.status = 403;
          return { success: false, error: "Vendor ID required" };
        }
        where.vendorId = user.vendorId;
      }

      const billing = await prisma.billingNote.findFirst({ where });

      if (!billing) {
        set.status = 404;
        return { success: false, error: "Billing note not found" };
      }

      const updated = await prisma.billingNote.update({
        where: { id: params.id },
        data: { statusBillingNote: body.status },
      });

      return { success: true, data: updated };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        status: t.Enum({
          PENDING: "PENDING",
          SUBMITTED: "SUBMITTED",
          APPROVED: "APPROVED",
          PAID: "PAID",
          CANCELLED: "CANCELLED",
        }),
      }),
      detail: {
        summary: "Update billing status",
      },
    }
  )

  // Cancel billing note
  .post(
    "/:id/cancel",
    async ({ params, user, set }) => {
      // Build query based on role
      const where: any = { id: params.id };

      // Admin/User can cancel any billing, vendor can only cancel their own
      if (user?.role !== "ADMIN" && user?.role !== "USER") {
        if (!user?.vendorId) {
          set.status = 403;
          return { success: false, error: "Vendor ID required" };
        }
        where.vendorId = user.vendorId;
      }

      const billing = await prisma.billingNote.findFirst({
        where,
        include: { receipt: true },
      });

      if (!billing) {
        set.status = 404;
        return { success: false, error: "Billing note not found" };
      }

      if (billing.receipt) {
        set.status = 400;
        return { success: false, error: "Cannot cancel billing note with receipt" };
      }

      // Transaction: Update status to CANCELLED and release jobs
      await prisma.$transaction(async (tx) => {
        await tx.billingNote.update({
          where: { id: billing.id },
          data: { statusBillingNote: "CANCELLED" },
        });

        await tx.job.updateMany({
          where: { billingNoteId: billing.id },
          data: {
            billingNoteId: null,
            statusJob: "PENDING",
          },
        });
      });

      return { success: true, message: "Billing note cancelled" };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { summary: "Cancel billing note" },
    }
  )

  // Edit billing note (Update jobs)
  .put(
    "/:id",
    async ({ params, body, user, set }) => {
      const { jobIds, remark, calculateBeforeVat } = body;
      const billing = await prisma.billingNote.findFirst({
        where: { id: params.id, vendorId: user!.vendorId! },
        include: { receipt: true, jobs: true },
      });

      if (!billing) {
        set.status = 404;
        return { success: false, error: "Billing note not found" };
      }

      if (billing.receipt) {
        set.status = 400;
        return { success: false, error: "Cannot edit billing note with receipt" };
      }

      if (billing.statusBillingNote === "CANCELLED") {
        set.status = 400;
        return { success: false, error: "Cannot edit cancelled billing note" };
      }

      // Verify new jobs belong to vendor and are PENDING (or already in this billing note)
      const newJobs = await prisma.job.findMany({
        where: {
          id: { in: jobIds },
          vendorId: user!.vendorId!,
          OR: [
            { statusJob: "PENDING" },
            { billingNoteId: billing.id },
          ],
        },
        include: { items: true },
      });

      if (newJobs.length !== jobIds.length) {
        set.status = 400;
        return { success: false, error: "Some jobs are invalid or already billed" };
      }

      // Calculate amounts
      const calculation = await calculateBillingAmounts(jobIds, user!.vendorId!, calculateBeforeVat);

      // Transaction
      const updatedBilling = await prisma.$transaction(async (tx) => {
        // 1. Release all old jobs
        await tx.job.updateMany({
          where: { billingNoteId: billing.id },
          data: { billingNoteId: null, statusJob: "PENDING" },
        });

        // 2. Link new jobs
        await tx.job.updateMany({
          where: { id: { in: jobIds } },
          data: { billingNoteId: billing.id, statusJob: "BILLED" },
        });

        // 3. Update Billing Note
        // Check for existing PDF and delete if present (since we are updating data)
        if (billing.pdfUrl) {
          const oldPdfPath = path.join(process.cwd(), billing.pdfUrl);
          if (existsSync(oldPdfPath)) {
            try {
              unlinkSync(oldPdfPath);
            } catch (e) {
              console.error("Failed to delete old PDF during update:", e);
            }
          }
        }

        return tx.billingNote.update({
          where: { id: billing.id },
          data: {
            subtotal: calculation.subtotal,
            priceBeforeVat: calculation.priceBeforeVat,
            vatAmount: calculation.vatAmount,
            whtAmount: calculation.whtAmount,
            netTotal: calculation.netTotal,
            remark: remark ?? billing.remark,
            vatRateText: String(calculation.vatRate),
            whtRateText: String(calculation.whtRate),
            pdfUrl: null, // Reset PDF URL to force regeneration
          },
          include: { jobs: { include: { items: true } } },
        });
      });

      return { success: true, data: enrichBillingWithJobTotals(updatedBilling) };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        jobIds: t.Array(t.String(), { minItems: 1 }),
        remark: t.Optional(t.String()),
        calculateBeforeVat: t.Optional(t.Boolean()),
      }),
      detail: { summary: "Edit billing note" },
    }
  );
