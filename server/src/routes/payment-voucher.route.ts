import { Elysia, t } from "elysia";
import { requireAuth } from "../plugins/auth.plugin";
import { prisma } from "../lib/prisma";
import { PaymentMethod } from "../generated/prisma/client";
import { format } from "date-fns";
import { generateDocumentNumber } from "./docnumber.route";

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
            if (!user) {
                set.status = 401;
                return { success: false, error: "Unauthorized" };
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

            if (user.role !== "ADMIN" && user.role !== "USER") {
                if (!voucher || voucher.vendorId !== user.vendorId) {
                    set.status = 403;
                    return { success: false, error: "Access denied" };
                }
            }

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

            const { vendorId, billingNoteIds, voucherDate, remark, paymentMethod, paymentInfo } = body;

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
                        paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.TRANSFER,
                        paymentInfo,
                        createdById: user!.id
                    },
                    include: {
                        vendor: true,
                        createdBy: {
                            select: { id: true, email: true, name: true }
                        }
                    }
                });

                // Update billing notes: link to voucher only (status stays SUBMITTED)
                await tx.billingNote.updateMany({
                    where: { id: { in: billingNoteIds } },
                    data: {
                        paymentVoucherId: voucher.id
                        // Note: status stays as SUBMITTED until voucher is approved
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
                remark: t.Optional(t.String()),
                paymentMethod: t.Optional(t.String()),
                paymentInfo: t.Optional(t.String())
            }),
            detail: { summary: "Create payment voucher from billing notes" }
        }
    )
    // Update payment voucher status (Admin/User can update)
    .patch(
        "/:id/status",
        async ({ params, body, user, set }) => {
            if (user?.role !== "ADMIN" && user?.role !== "USER") {
                set.status = 403;
                return { success: false, error: "Access denied" };
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
                    PAID: "PAID"
                })
            }),
            detail: { summary: "Update payment voucher status" }
        }
    )
    // Approve payment voucher (PENDING -> APPROVED)
    .post(
        "/:id/approve",
        async ({ params, user, set }) => {
            if (user?.role !== "ADMIN" && user?.role !== "USER") {
                set.status = 403;
                return { success: false, error: "Access denied" };
            }

            const voucher = await prisma.paymentVoucher.findUnique({
                where: { id: params.id }
            });

            if (!voucher) {
                set.status = 404;
                return { success: false, error: "Payment voucher not found" };
            }

            if (voucher.status !== "PENDING") {
                set.status = 400;
                return { success: false, error: "สามารถอนุมัติได้เฉพาะใบสำคัญจ่ายที่รอดำเนินการเท่านั้น" };
            }

            // Use transaction to update voucher and billing notes
            const updated = await prisma.$transaction(async (tx) => {
                // Update voucher status
                const updatedVoucher = await tx.paymentVoucher.update({
                    where: { id: params.id },
                    data: { status: "APPROVED" }
                });

                // Update billing notes to APPROVED
                await tx.billingNote.updateMany({
                    where: { paymentVoucherId: params.id },
                    data: { statusBillingNote: "APPROVED" }
                });

                return updatedVoucher;
            });

            return { success: true, data: updated };
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "Approve payment voucher (PENDING -> APPROVED)" }
        }
    )
    // Confirm payment (APPROVED -> PAID) + Create Receipt
    .post(
        "/:id/confirm-payment",
        async ({ params, user, set, body }) => {
            if (!user) {
                set.status = 401;
                return { success: false, error: "Unauthorized" };
            }

            const { paymentDate, paymentMethod, paymentRef, bankInfo, remark, proofFile } = body;

            const voucher = await prisma.paymentVoucher.findUnique({
                where: { id: params.id },
                include: { billingNotes: true, vendor: true }
            });

            if (user.role !== "ADMIN" && user.role !== "USER") {
                if (!voucher || voucher.vendorId !== user.vendorId) {
                    set.status = 403;
                    return { success: false, error: "Access denied" };
                }
            }

            if (!voucher) {
                set.status = 404;
                return { success: false, error: "Payment voucher not found" };
            }

            if (voucher.status !== "APPROVED") {
                set.status = 400;
                return { success: false, error: "สามารถยืนยันการจ่ายเงินได้เฉพาะใบสำคัญจ่ายที่อนุมัติแล้วเท่านั้น" };
            }

            // Use transaction
            const result = await prisma.$transaction(async (tx) => {
                // 1. Update voucher to PAID
                const updatedVoucher = await tx.paymentVoucher.update({
                    where: { id: params.id },
                    data: { status: "PAID" }
                });

                // 2. Update billing notes to PAID
                await tx.billingNote.updateMany({
                    where: { paymentVoucherId: params.id },
                    data: { statusBillingNote: "PAID" }
                });

                // 3. Create Receipts (One per Billing Note)
                const receipts = [];
                const receiptDateVal = new Date(paymentDate);

                for (const bn of voucher.billingNotes) {
                    // Generate unique receipt ref for each one
                    const generatedRef = await generateDocumentNumber(voucher.vendorId, "RECEIPT", receiptDateVal);

                    // Fallback manual generation (in case config is disabled or fails)
                    // Note: Ideally config should be enabled. If not, we generate random or use old logic?
                    // We'll trust generateDocumentNumber returns something or handle null.
                    // If null, we might need a fallback.
                    let receiptRef = generatedRef;

                    if (!receiptRef) {
                        // Fallback logic similar to old one, but local to loop?
                        // It's risky to query repeatedly.
                        // Assume config is ON for now as per system design.
                        receiptRef = `RCT-${format(receiptDateVal, "yyyyMMdd")}-${Math.floor(Math.random() * 100000)}`;
                    }

                    const receipt = await tx.receipt.create({
                        data: {
                            receiptRef,
                            vendorId: voucher.vendorId,
                            receiptDate: receiptDateVal,
                            paymentMethod,
                            paymentRef,
                            bankInfo,
                            remark,
                            receiptFile: proofFile,
                            statusReceipt: "PAID",
                            billingNoteId: bn.id,
                            // Explicitly NOT linking paymentVoucherId 
                            // to allow 1-to-many receipts (via BillingNote relation)
                        }
                    });
                    receipts.push(receipt);
                }

                return { voucher: updatedVoucher, receipts };
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
                paymentRef: t.Optional(t.String()),
                bankInfo: t.Optional(t.String()),
                remark: t.Optional(t.String()),
                proofFile: t.Optional(t.String())
            }),
            detail: { summary: "Confirm payment and create receipt" }
        }
    )
    // Cancel/Delete payment voucher (Admin/User can cancel)
    .post(
        "/:id/cancel",
        async ({ params, user, set }) => {
            if (user?.role !== "ADMIN" && user?.role !== "USER") {
                set.status = 403;
                return { success: false, error: "Access denied" };
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
