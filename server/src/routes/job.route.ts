import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../plugins/auth.plugin";

export const jobRoutes = new Elysia({ prefix: "/jobs", tags: ["Jobs"] })
  .use(requireAuth)

  // List jobs
  .get(
    "/",
    async ({ user, query }) => {
      const { status, page = "1", limit = "20" } = query;

      const where: any = { vendorId: user!.vendorId! };
      if (status) {
        where.statusJob = status;
      }

      const [jobs, total] = await Promise.all([
        prisma.job.findMany({
          where,
          include: {
            items: true,
            billingNote: {
              select: { id: true, billingRef: true, statusBillingNote: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (parseInt(page) - 1) * parseInt(limit),
          take: parseInt(limit),
        }),
        prisma.job.count({ where }),
      ]);

      // Calculate totals for each job
      const jobsWithTotal = jobs.map((job) => ({
        ...job,
        totalAmount: job.items.reduce(
          (sum, item) => sum + Number(item.amount),
          0
        ),
      }));

      return {
        success: true,
        data: jobsWithTotal,
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
        status: t.Optional(t.Enum({ PENDING: "PENDING", BILLED: "BILLED" })),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
      detail: {
        summary: "List jobs",
        description: "Get paginated list of jobs for the authenticated vendor",
      },
    }
  )

  // Get job by ID
  .get(
    "/:id",
    async ({ params, user, set }) => {
      const job = await prisma.job.findFirst({
        where: { id: params.id, vendorId: user!.vendorId! },
        include: {
          items: true,
          billingNote: true,
        },
      });

      if (!job) {
        set.status = 404;
        return { success: false, error: "Job not found" };
      }

      return {
        success: true,
        data: {
          ...job,
          totalAmount: job.items.reduce(
            (sum, item) => sum + Number(item.amount),
            0
          ),
        },
      };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Get job by ID",
      },
    }
  )

  // Create job with items
  .post(
    "/",
    async ({ body, user }) => {
      const job = await prisma.job.create({
        data: {
          vendorId: user!.vendorId!,
          description: body.description,
          refInvoiceNo: body.refInvoiceNo,
          containerNo: body.containerNo,
          truckPlate: body.truckPlate,
          clearanceDate: new Date(body.clearanceDate),
          declarationNo: body.declarationNo,
          items: {
            create: body.items.map((item) => ({
              description: item.description,
              amount: item.amount,
            })),
          },
        },
        include: { items: true },
      });

      return { success: true, data: job };
    },
    {
      body: t.Object({
        description: t.String({ minLength: 1 }),
        refInvoiceNo: t.String(),
        containerNo: t.String(),
        truckPlate: t.String(),
        clearanceDate: t.String(),
        declarationNo: t.String(),
        items: t.Array(
          t.Object({
            description: t.String({ minLength: 1 }),
            amount: t.Number({ minimum: 0 }),
          }),
          { minItems: 1 }
        ),
      }),
      detail: {
        summary: "Create job with items",
        description: "Create a new job with expense items",
      },
    }
  )

  // Update job
  .put(
    "/:id",
    async ({ params, body, user, set }) => {
      const existing = await prisma.job.findFirst({
        where: { id: params.id, vendorId: user!.vendorId! },
      });

      if (!existing) {
        set.status = 404;
        return { success: false, error: "Job not found" };
      }

      if (existing.statusJob === "BILLED") {
        set.status = 400;
        return { success: false, error: "Cannot edit a billed job" };
      }

      // Update job and replace items
      const job = await prisma.$transaction(async (tx) => {
        // Delete existing items
        await tx.jobItem.deleteMany({ where: { jobId: params.id } });

        // Update job with new items
        return tx.job.update({
          where: { id: params.id },
          data: {
            description: body.description,
            refInvoiceNo: body.refInvoiceNo,
            containerNo: body.containerNo,
            truckPlate: body.truckPlate,
            clearanceDate: new Date(body.clearanceDate),
            declarationNo: body.declarationNo,
            items: {
              create: body.items.map((item) => ({
                description: item.description,
                amount: item.amount,
              })),
            },
          },
          include: { items: true },
        });
      });

      return { success: true, data: job };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        description: t.String({ minLength: 1 }),
        refInvoiceNo: t.String(),
        containerNo: t.String(),
        truckPlate: t.String(),
        clearanceDate: t.String(),
        declarationNo: t.String(),
        items: t.Array(
          t.Object({
            description: t.String({ minLength: 1 }),
            amount: t.Number({ minimum: 0 }),
          }),
          { minItems: 1 }
        ),
      }),
      detail: {
        summary: "Update job",
      },
    }
  )

  // Delete job
  .delete(
    "/:id",
    async ({ params, user, set }) => {
      const existing = await prisma.job.findFirst({
        where: { id: params.id, vendorId: user!.vendorId! },
      });

      if (!existing) {
        set.status = 404;
        return { success: false, error: "Job not found" };
      }

      if (existing.statusJob === "BILLED") {
        set.status = 400;
        return { success: false, error: "Cannot delete a billed job" };
      }

      await prisma.job.delete({ where: { id: params.id } });

      return { success: true, message: "Job deleted" };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Delete job",
      },
    }
  );
