import { Elysia, t } from "elysia";
import { requireAuth } from "../plugins/auth.plugin";
import { prisma } from "../lib/prisma";
import { format } from "date-fns";

export const paymentVoucherRoutes = new Elysia({ prefix: "/payment-voucher", tags: ["Payment Voucher"] })
    .use(requireAuth)
    // List payment vouchers
    .get(
        "/",
        async ({ user, query }) => {
            // Only ADMIN and USER can access
            if (user?.role !== "ADMIN" && user?.role !== "USER") {
                return { success: false, error: "Access denied" };
            }

            const where: any = {};

            // Filter by vendor if specified
            if (query.vendorId) {
                where.vendorId = query.vendorId;
            }

            // Filter by status if specified
            if (query.status) {
                where.status = query.status;
            }

            const vouchers = await prisma.paymentVoucher.findMany({
                where,
                include: {
                    vendor: true,
                    billingNotes: {
                        include: {
                            jobs: {
                                include: {
                                    items: true
                                }
                            }
                        }
                    },
                    createdBy: {
                        select: { id: true, email: true, name: true }
                    }
                },
                orderBy: { createdAt: "desc" }
            });

            return { success: true, data: vouchers };
        },
        {
            query: t.Object({
                vendorId: t.Optional(t.String()),
                status: t.Optional(t.String())
            }),
            detail: { summary: "List payment vouchers" }
        }
    )
    // Get payment voucher by ID
    .get(
        "/:id",
        async ({ params, user, set }) => {
            if (user?.role !== "ADMIN" && user?.role !== "USER") {
                set.status = 403;
                return { success: false, error: "Access denied" };
            }

            const voucher = await prisma.paymentVoucher.findUnique({
                where: { id: params.id },
                include: {
                    vendor: true,
                    billingNotes: {
                        include: { jobs: true }
                    },
                    createdBy: {
                        select: { id: true, email: true, name: true }
                    }
                }
            });

            if (!voucher) {
                set.status = 404;
                return { success: false, error: "Payment voucher not found" };
            }

            return { success: true, data: voucher };
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "Get payment voucher by ID" }
        }
    )
    // Create payment voucher
    .post(
        "/",
        async ({ body, user, set }) => {
            if (user?.role !== "ADMIN" && user?.role !== "USER") {
                set.status = 403;
                return { success: false, error: "Access denied" };
            }

            const { vendorId, billingNoteIds, voucherDate, remark } = body;

            // Validate billing notes
            const billingNotes = await prisma.billingNote.findMany({
                where: {
                    id: { in: billingNoteIds },
                    vendorId: vendorId,
                    statusBillingNote: "SUBMITTED",
                    paymentVoucherId: null // Not already in another voucher
                }
            });

            if (billingNotes.length !== billingNoteIds.length) {
                set.status = 400;
                return {
                    success: false,
                    error: "Some billing notes are invalid, not SUBMITTED, or already in another voucher"
                };
            }

            // Calculate totals using database aggregate for precision
            const totals = await prisma.billingNote.aggregate({
                where: { id: { in: billingNoteIds } },
                _sum: {
                    subtotal: true,
                    vatAmount: true,
                    whtAmount: true,
                    netTotal: true
                }
            });

            // Generate voucher reference
            const today = new Date();
            const prefix = "PV";
            const dateStr = format(today, "yyyyMMdd");

            // Get next sequence number
            const lastVoucher = await prisma.paymentVoucher.findFirst({
                where: {
                    voucherRef: { startsWith: `${prefix}${dateStr}` }
                },
                orderBy: { voucherRef: "desc" }
            });

            let nextNum = 1;
            if (lastVoucher) {
                const lastNumStr = lastVoucher.voucherRef.slice(-3);
                nextNum = parseInt(lastNumStr, 10) + 1;
            }

            const voucherRef = `${prefix}${dateStr}${String(nextNum).padStart(3, "0")}`;

            // Create payment voucher in transaction
            const result = await prisma.$transaction(async (tx) => {
                // Create the voucher
                const voucher = await tx.paymentVoucher.create({
                    data: {
                        voucherRef,
                        vendorId,
                        voucherDate: new Date(voucherDate),
                        subtotal: totals._sum.subtotal || 0,
                        totalVat: totals._sum.vatAmount || 0,
                        totalWht: totals._sum.whtAmount || 0,
                        netTotal: totals._sum.netTotal || 0,
                        remark,
                        createdById: user!.id
                    },
                    include: {
                        vendor: true,
                        createdBy: {
                            select: { id: true, email: true, name: true }
                        }
                    }
                });

                // Update billing notes: link to voucher and change status to APPROVED
                await tx.billingNote.updateMany({
                    where: { id: { in: billingNoteIds } },
                    data: {
                        paymentVoucherId: voucher.id,
                        statusBillingNote: "APPROVED"
                    }
                });

                return voucher;
            });

            return { success: true, data: result };
        },
        {
            body: t.Object({
                vendorId: t.String(),
                billingNoteIds: t.Array(t.String(), { minItems: 1 }),
                voucherDate: t.String(),
                remark: t.Optional(t.String())
            }),
            detail: { summary: "Create payment voucher from billing notes" }
        }
    )
    // Update payment voucher status
    .patch(
        "/:id/status",
        async ({ params, body, user, set }) => {
            if (user?.role !== "ADMIN") {
                set.status = 403;
                return { success: false, error: "Only admin can update status" };
            }

            const voucher = await prisma.paymentVoucher.findUnique({
                where: { id: params.id }
            });

            if (!voucher) {
                set.status = 404;
                return { success: false, error: "Payment voucher not found" };
            }

            const updated = await prisma.paymentVoucher.update({
                where: { id: params.id },
                data: { status: body.status }
            });

            return { success: true, data: updated };
        },
        {
            params: t.Object({ id: t.String() }),
            body: t.Object({
                status: t.Enum({
                    PENDING: "PENDING",
                    APPROVED: "APPROVED",
                    CANCELLED: "CANCELLED"
                })
            }),
            detail: { summary: "Update payment voucher status" }
        }
    )
    // Cancel/Delete payment voucher
    .post(
        "/:id/cancel",
        async ({ params, user, set }) => {
            if (user?.role !== "ADMIN") {
                set.status = 403;
                return { success: false, error: "Only admin can cancel" };
            }

            const voucher = await prisma.paymentVoucher.findUnique({
                where: { id: params.id },
                include: { billingNotes: true }
            });

            if (!voucher) {
                set.status = 404;
                return { success: false, error: "Payment voucher not found" };
            }

            // Delete voucher and revert billing notes to SUBMITTED
            await prisma.$transaction(async (tx) => {
                // 1. Revert billing notes: unlink and change status back to SUBMITTED
                await tx.billingNote.updateMany({
                    where: { paymentVoucherId: params.id },
                    data: {
                        paymentVoucherId: null,
                        statusBillingNote: "SUBMITTED"
                    }
                });

                // 2. Delete the voucher
                await tx.paymentVoucher.delete({
                    where: { id: params.id }
                });
            });

            return { success: true, message: "Payment voucher deleted" };
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "Delete payment voucher and revert billing notes" }
        }
    )
    // Get submitted billing notes for a vendor (for creating voucher)
    .get(
        "/billing-notes/:vendorId",
        async ({ params, user, set }) => {
            if (user?.role !== "ADMIN" && user?.role !== "USER") {
                set.status = 403;
                return { success: false, error: "Access denied" };
            }

            const billingNotes = await prisma.billingNote.findMany({
                where: {
                    vendorId: params.vendorId,
                    statusBillingNote: "SUBMITTED",
                    paymentVoucherId: null
                },
                include: {
                    jobs: true,
                    vendor: true
                },
                orderBy: { billingDate: "desc" }
            });

            return { success: true, data: billingNotes };
        },
        {
            params: t.Object({ vendorId: t.String() }),
            detail: { summary: "Get submitted billing notes for a vendor" }
        }
    );
