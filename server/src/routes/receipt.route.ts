import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../plugins/auth.plugin";
import { generateDocumentNumber } from "./docnumber.route";
import { unlinkSync, existsSync } from "fs";
import path from "path";

// Generate receipt reference number (fallback)
async function generateReceiptRef(vendorId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = "RE";

    // Get the last receipt for this year
    const lastReceipt = await prisma.receipt.findFirst({
        where: {
            vendorId,
            receiptRef: { startsWith: `${prefix}${year}` },
        },
        orderBy: { receiptRef: "desc" },
    });

    let nextNumber = 1;
    if (lastReceipt) {
        const lastNumber = parseInt(lastReceipt.receiptRef.slice(-4));
        nextNumber = lastNumber + 1;
    }

    return `${prefix}${year}-${String(nextNumber).padStart(4, "0")}`;
}

export const receiptRoutes = new Elysia({
    prefix: "/receipts",
    tags: ["Receipts"]
})
    .use(requireAuth)
    // List receipts
    .get(
        "/",
        async ({ user, query }) => {
            // Determine vendorId based on role
            let vendorId: string | undefined;

            if (user?.role === "ADMIN" || user?.role === "USER") {
                // Admin/User: use vendorId from query param
                vendorId = query.vendorId;
                if (!vendorId) {
                    return { success: false, error: "Vendor ID is required for admin/user access" };
                }
            } else {
                // Vendor: use vendorId from JWT
                vendorId = user?.vendorId ?? undefined;
                if (!vendorId) {
                    return { success: false, error: "Vendor not found" };
                }
            }

            const { status, page = "1", limit = "20" } = query;
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);

            const where: any = { vendorId };
            if (status) {
                where.statusReceipt = status;
            }

            const [receipts, total] = await Promise.all([
                prisma.receipt.findMany({
                    where,
                    include: {
                        billingNote: {
                            select: {
                                billingRef: true,
                                netTotal: true,
                                billingDate: true,
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    skip: (pageNum - 1) * limitNum,
                    take: limitNum,
                }),
                prisma.receipt.count({ where }),
            ]);

            return {
                success: true,
                data: receipts,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                },
            };
        },
        {
            query: t.Object({
                vendorId: t.Optional(t.String()),
                status: t.Optional(t.String()),
                page: t.Optional(t.String()),
                limit: t.Optional(t.String()),
            }),
            detail: {
                summary: "List receipts",
                description: "Get all receipts. Admin/User must provide vendorId query param.",
            },
        }
    )
    // Get single receipt
    .get(
        "/:id",
        async ({ user, params, set }) => {
            const receipt = await prisma.receipt.findFirst({
                where: {
                    id: params.id,
                    vendorId: user!.vendorId!,
                },
                include: {
                    billingNote: {
                        include: {
                            jobs: {
                                include: {
                                    items: true,
                                },
                            },
                            vendor: true,
                        },
                    },
                },
            });

            if (!receipt) {
                set.status = 404;
                return { success: false, error: "Receipt not found" };
            }

            return { success: true, data: receipt };
        },
        {
            detail: {
                summary: "Get receipt details",
                description: "Get a single receipt with billing note details",
            },
        }
    )
    // Create receipt
    .post(
        "/",
        async ({ body, user, set }) => {
            const { billingNoteId, receiptDate } = body;

            const billing = await prisma.billingNote.findFirst({
                where: { id: billingNoteId, vendorId: user!.vendorId! },
                include: { receipt: true },
            });

            if (!billing) {
                set.status = 404;
                return { success: false, error: "Billing note not found" };
            }

            if (billing.receipt) {
                set.status = 400;
                return { success: false, error: "Receipt already exists for this billing note" };
            }

            if (billing.statusBillingNote === "CANCELLED") {
                set.status = 400;
                return { success: false, error: "Cannot issue receipt for cancelled billing note" };
            }

            // Enforce logic: Must be APPROVED (or PAID for re-issuing)
            if (billing.statusBillingNote !== "APPROVED" && billing.statusBillingNote !== "PAID") {
                set.status = 400;
                return { success: false, error: "Billing note must be APPROVED by Admin before issuing receipt" };
            }

            // Generate receipt ref: try auto-numbering first, then fallback
            const autoNumber = await generateDocumentNumber(user!.vendorId!, "RECEIPT", new Date(receiptDate));
            const receiptRef = autoNumber || await generateReceiptRef(user!.vendorId!);

            // Transaction: Create receipt and update billing status
            const receipt = await prisma.$transaction(async (tx) => {
                // Create receipt
                const newReceipt = await tx.receipt.create({
                    data: {
                        receiptRef,
                        billingNoteId,
                        vendorId: user!.vendorId!,
                        receiptDate: new Date(receiptDate),
                        statusReceipt: "PAID", // Default to PAID as it's an issued receipt
                    },
                });

                // Update Billing Note status to PAID
                await tx.billingNote.update({
                    where: { id: billingNoteId },
                    data: { statusBillingNote: "PAID" },
                });

                return newReceipt;
            });

            return { success: true, data: receipt };
        },
        {
            body: t.Object({
                billingNoteId: t.String(),
                receiptDate: t.String(), // ISO Date string
            }),
            detail: {
                summary: "Create receipt",
                description: "Issue a receipt for a billing note",
            },
        }
    )
    // Update receipt status (Admin only)
    .patch(
        "/:id/status",
        async ({ params, body, user, set }) => {
            // Admin/User can update receipt status
            if (user?.role !== "ADMIN" && user?.role !== "USER") {
                set.status = 403;
                return { success: false, error: "Only admin/user can update receipt status" };
            }

            const receipt = await prisma.receipt.findFirst({
                where: { id: params.id },
                include: { billingNote: true },
            });

            if (!receipt) {
                set.status = 404;
                return { success: false, error: "Receipt not found" };
            }

            // Update receipt and optionally billing note status
            const updated = await prisma.$transaction(async (tx) => {
                const updatedReceipt = await tx.receipt.update({
                    where: { id: params.id },
                    data: { statusReceipt: body.status },
                });

                // If reverting receipt to PENDING, also revert billing to PENDING
                if (body.status === "PENDING" && body.revertBilling) {
                    await tx.billingNote.update({
                        where: { id: receipt.billingNoteId },
                        data: { statusBillingNote: "PENDING" },
                    });
                }

                return updatedReceipt;
            });

            return { success: true, data: updated };
        },
        {
            params: t.Object({ id: t.String() }),
            body: t.Object({
                status: t.Enum({
                    PENDING: "PENDING",
                    PAID: "PAID",
                }),
                revertBilling: t.Optional(t.Boolean()),
            }),
            detail: {
                summary: "Update receipt status",
                description: "Admin/User only: Update receipt status and optionally revert billing status",
            },
        }
    )
    // Delete receipt (Admin/User only)
    .delete(
        "/:id",
        async ({ params, user, set }) => {
            // Admin/User can delete receipt
            if (user?.role !== "ADMIN" && user?.role !== "USER") {
                set.status = 403;
                return { success: false, error: "Only admin/user can delete receipts" };
            }

            const receipt = await prisma.receipt.findFirst({
                where: { id: params.id },
                include: { billingNote: true },
            });

            if (!receipt) {
                set.status = 404;
                return { success: false, error: "Receipt not found" };
            }

            // Remove related PDF files
            const filesToDelete = [receipt.receiptFile, receipt.pdfUrl].filter(Boolean) as string[];
            for (const fileUrl of filesToDelete) {
                const filePath = path.join(process.cwd(), fileUrl);
                if (existsSync(filePath)) {
                    try {
                        unlinkSync(filePath);
                        console.log(`Deleted receipt file: ${filePath}`);
                    } catch (err) {
                        console.error(`Failed to delete receipt file (${filePath}):`, err);
                    }
                }
            }

            // Transaction: Delete receipt and revert Billing Note status to PENDING
            await prisma.$transaction(async (tx) => {
                await tx.billingNote.update({
                    where: { id: receipt.billingNoteId },
                    data: { statusBillingNote: "PENDING" },
                });

                await tx.receipt.delete({
                    where: { id: params.id },
                });
            });

            return { success: true, message: "Receipt deleted and billing note reverted to PENDING" };
        },
        {
            params: t.Object({ id: t.String() }),
            detail: {
                summary: "Delete receipt",
                description: "Delete receipt and revert billing note status to PENDING",
            },
        }
    );
