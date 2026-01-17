import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../plugins/auth.plugin";
import { generateDocumentNumber } from "./docnumber.route";
import { format } from "date-fns";

// Generate billing reference number (fallback)
async function generateBillingRef(vendorId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = "CAB"; // Cash Advance Billing

    const lastBilling = await prisma.cashAdvanceBilling.findFirst({
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

export const cashAdvanceBillingRoutes = new Elysia({ prefix: "/cash-advance-billing", tags: ["Cash Advance Billing"] })
    .use(requireAuth)

    // List billings
    .get(
        "/",
        async ({ user, query }) => {
            let vendorId: string | undefined;

            if (user?.role === "ADMIN" || user?.role === "USER") {
                vendorId = query.vendorId;
            } else {
                vendorId = user?.vendorId ?? undefined;
            }

            // Vendor needs ID
            if (user?.role === "VENDOR" && !vendorId) {
                return { success: false, error: "Vendor ID missing" };
            }
            // Admin needs ID if filtering by vendor, but strictly listing all if not provided?
            // Existing logic enforced vendorId for admin too in billing.route.ts, let's keep it optional or enforced based on UI.
            // UI usually filters by vendor. If not, list all.

            const { status, page = "1", limit = "20" } = query;
            const where: any = {};
            if (vendorId) where.vendorId = vendorId;
            if (status) where.status = status;

            const [billings, total] = await Promise.all([
                prisma.cashAdvanceBilling.findMany({
                    where,
                    include: {
                        items: {
                            include: {
                                items: true // CashAdvanceItem (รายละเอียดย่อย)
                            }
                        },
                        payment: true,
                        vendor: { select: { companyName: true } }
                    },
                    orderBy: { createdAt: "desc" },
                    skip: (parseInt(page) - 1) * parseInt(limit),
                    take: parseInt(limit),
                }),
                prisma.cashAdvanceBilling.count({ where }),
            ]);

            return {
                success: true,
                data: billings,
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
                status: t.Optional(t.Enum({
                    PENDING: "PENDING",
                    SUBMITTED: "SUBMITTED",
                    APPROVED: "APPROVED",
                    PAID: "PAID",
                    CANCELLED: "CANCELLED"
                })),
                page: t.Optional(t.String()),
                limit: t.Optional(t.String()),
            }),
            detail: { summary: "List cash advance billings" },
        }
    )

    // Get billing by ID
    .get(
        "/:id",
        async ({ params, user, set }) => {
            const billing = await prisma.cashAdvanceBilling.findFirst({
                where: { id: params.id },
                include: {
                    items: { include: { items: true } }, // Items of CashAdvance items
                    payment: { include: { approvedBy: { select: { name: true } } } },
                    vendor: true
                },
            });

            if (!billing) {
                set.status = 404;
                return { success: false, error: "Billing not found" };
            }

            // Check permissions
            if (user?.role === "VENDOR" && billing.vendorId !== user.vendorId) {
                set.status = 403;
                return { success: false, error: "Unauthorized" };
            }

            return { success: true, data: billing };
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "Get cash advance billing by ID" },
        }
    )

    // Preview calculation
    .post(
        "/preview",
        async ({ body, user, set }) => {
            if (!user || !user.vendorId) {
                set.status = 401;
                return { success: false, error: "Unauthorized: Vendor information missing" };
            }

            try {
                const { cashAdvanceIds } = body;
                const advances = await prisma.cashAdvance.findMany({
                    where: {
                        id: { in: cashAdvanceIds },
                        vendorId: user.vendorId,
                    },
                });

            if (advances.length !== cashAdvanceIds.length) {
                set.status = 400;
                return { success: false, error: "Invalid cash advances selected" };
            }

            const totalAmount = advances.reduce((sum, item) => sum + Number(item.totalAmount), 0);

                return {
                    success: true,
                    data: {
                        totalAmount,
                        advances
                    }
                };
            } catch (error) {
                set.status = 500;
                return { success: false, error: "Failed to preview billing" };
            }
        },
        {
            body: t.Object({
                cashAdvanceIds: t.Array(t.String(), { minItems: 1 }),
            }),
            detail: { summary: "Preview billing calculation" },
        }
    )

    // Create billing
    .post(
        "/",
        async ({ body, user, set }) => {
            if (!user || !user.vendorId) {
                set.status = 401;
                return { success: false, error: "Unauthorized: Vendor information missing" };
            }

            try {
                const { cashAdvanceIds, billingRef: customRef, remark } = body;

                // Verify
                const advances = await prisma.cashAdvance.findMany({
                    where: {
                        id: { in: cashAdvanceIds },
                        vendorId: user.vendorId,
                    status: "PENDING", // Must be ready
                    cashAdvanceBillingId: null // Must not be billed
                },
            });

            if (advances.length !== cashAdvanceIds.length) {
                set.status = 400;
                return { success: false, error: "Some items are not ready (PENDING) or already billed" };
            }

                // Generate Ref
                let billingRef = customRef;
                if (!billingRef) {
                    const autoNumber = await generateDocumentNumber(user.vendorId, "CASH_ADVANCE_BILLING", new Date());
                    // Note: Need to update generateDocumentNumber types if strictly typed, or cast as any.
                    // Assuming I'll update docnumber route or pass string if loose.
                    // Using fallback for now:
                    if (autoNumber) billingRef = autoNumber;
                    else billingRef = await generateBillingRef(user.vendorId);
                }

                // Check existing Ref
                const existingRef = await prisma.cashAdvanceBilling.findUnique({
                    where: { billingRef },
                });
                if (existingRef) {
                    set.status = 400;
                    return { success: false, error: "Billing reference already exists" };
                }

                const totalAmount = advances.reduce((sum, item) => sum + Number(item.totalAmount), 0);

                // Transaction
                const result = await prisma.$transaction(async (tx) => {
                    const billing = await tx.cashAdvanceBilling.create({
                        data: {
                            billingRef,
                            vendorId: user.vendorId,
                        billingDate: new Date(),
                        totalAmount,
                        status: "PENDING",
                        remark,
                    },
                });

                await tx.cashAdvance.updateMany({
                    where: { id: { in: cashAdvanceIds } },
                    data: {
                        cashAdvanceBillingId: billing.id,
                        status: "BILLED",
                    },
                });

                    return billing;
                });

                return { success: true, data: result };
            } catch (error) {
                set.status = 500;
                return { success: false, error: "Failed to create cash advance billing" };
            }
        },
        {
            body: t.Object({
                cashAdvanceIds: t.Array(t.String(), { minItems: 1 }),
                billingRef: t.Optional(t.String()),
                remark: t.Optional(t.String()),
            }),
            detail: { summary: "Create cash advance billing" },
        }
    )

    // Update Status
    .patch(
        "/:id/status",
        async ({ params, body, user, set }) => {
            const billing = await prisma.cashAdvanceBilling.findFirst({
                where: { id: params.id },
            });

            if (!billing) {
                set.status = 404;
                return { success: false, error: "Billing not found" };
            }

            // Vendor can only submit
            if (user?.role === "VENDOR") {
                if (billing.vendorId !== user.vendorId) {
                    set.status = 403; return { success: false, error: "Unauthorized" };
                }
                if (body.status !== "SUBMITTED" && body.status !== "CANCELLED") {
                    set.status = 403;
                    return { success: false, error: "Vendors can only changed status to SUBMITTED or CANCELLED (if PENDING)" };
                }
                if (body.status === "CANCELLED" && billing.status !== "PENDING") {
                    set.status = 400; return { success: false, error: "Can only cancel PENDING billings" };
                }
            }

            // Admin/User can do anything

            const updated = await prisma.cashAdvanceBilling.update({
                where: { id: params.id },
                data: { status: body.status },
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
                    CANCELLED: "CANCELLED"
                })
            }),
            detail: { summary: "Update billing status" },
        }
    )

    // Pay Billing (Admin/User)
    .post(
        "/:id/pay",
        async ({ params, body, user, set }) => {
            if (user?.role === "VENDOR") {
                set.status = 403;
                return { success: false, error: "Vendors cannot record payments" };
            }

            const billing = await prisma.cashAdvanceBilling.findUnique({
                where: { id: params.id },
            });

            if (!billing) {
                set.status = 404; return { success: false, error: "Billing not found" };
            }

            if (billing.status === "PAID") {
                set.status = 400; return { success: false, error: "Already paid" };
            }

            // Generate payment ref
            const today = new Date();
            const dateStr = format(today, "yyyyMMdd");
            const count = await prisma.cashAdvancePayment.count({
                where: { paymentRef: { startsWith: `CPV${dateStr}` } },
            });
            const paymentRef = `CPV${dateStr}${String(count + 1).padStart(3, "0")}`;

            const result = await prisma.$transaction(async (tx) => {
                const payment = await tx.cashAdvancePayment.create({
                    data: {
                        paymentRef,
                        cashAdvanceBillingId: billing.id,
                        paymentDate: new Date(body.paymentDate),
                        paymentMethod: body.paymentMethod,
                        amount: Number(billing.totalAmount),
                        proofFile: body.proofFile,
                        chequeNo: body.chequeNo,
                        bankInfo: body.bankInfo,
                        remark: body.remark,
                        approvedById: user!.id,
                    },
                });

                await tx.cashAdvanceBilling.update({
                    where: { id: params.id },
                    data: { status: "PAID" },
                });

                return payment;
            });

            return { success: true, data: result };
        },
        {
            params: t.Object({ id: t.String() }),
            body: t.Object({
                paymentDate: t.String(),
                paymentMethod: t.Enum({
                    TRANSFER: "TRANSFER",
                    CASH: "CASH",
                    CHEQUE: "CHEQUE",
                    CASHIER_CHEQUE: "CASHIER_CHEQUE"
                }),
                proofFile: t.Optional(t.String()),
                chequeNo: t.Optional(t.String()),
                bankInfo: t.Optional(t.String()),
                remark: t.Optional(t.String()),
            }),
            detail: { summary: "Pay Cash Advance Billing" },
        }
    )

    // Cancel Billing (Revert Items)
    .post(
        "/:id/cancel",
        async ({ params, user, set }) => {
            const billing = await prisma.cashAdvanceBilling.findUnique({
                where: { id: params.id },
                include: { payment: true },
            });

            if (!billing) {
                set.status = 404; return { success: false, error: "Billing not found" };
            }

            if (user?.role === "VENDOR" && billing.vendorId !== user.vendorId) {
                set.status = 403; return { success: false, error: "Unauthorized" };
            }

            if (billing.status === "PAID" || billing.payment) {
                set.status = 400; return { success: false, error: "Cannot cancel PAID billing" };
            }

            await prisma.$transaction(async (tx) => {
                // 1. Revert items logic
                await tx.cashAdvance.updateMany({
                    where: { cashAdvanceBillingId: billing.id },
                    data: {
                        cashAdvanceBillingId: null,
                        status: "PENDING", // Back to Ready
                    },
                });

                // 2. Delete the billing record
                await tx.cashAdvanceBilling.delete({
                    where: { id: billing.id },
                });
            });

            return { success: true, message: "Billing cancelled and items reverted" };
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "Cancel billing and revert items" },
        }
    );
