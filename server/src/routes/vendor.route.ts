import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../plugins/auth.plugin";
import { StatusBillingNote, StatusReceipt } from "../generated/prisma/client";

export const vendorRoutes = new Elysia({
    prefix: "/vendors",
    tags: ["Vendors"]
})
    .use(requireAuth)
    // List all vendors (for Admin/User only)
    .get(
        "/",
        async ({ user, set }) => {
            // Only ADMIN and USER can list all vendors
            if (user?.role !== "ADMIN" && user?.role !== "USER") {
                set.status = 403;
                return { success: false, error: "Access denied. Admin or User role required." };
            }

            // Count only "Actionable" items
            // Billing: SUBMITTED (Vendor sent, waiting for Admin)
            // Receipt: PENDING (Vendor sent, waiting for Admin)
            const billingWhere: { statusBillingNote: StatusBillingNote } = { statusBillingNote: "SUBMITTED" };
            const receiptWhere: { statusReceipt: StatusReceipt } = { statusReceipt: "PENDING" };

            const vendors = await prisma.vendor.findMany({
                select: {
                    id: true,
                    companyName: true,
                    taxId: true,
                    _count: {
                        select: {
                            billingNotes: {
                                where: billingWhere,
                            },
                            receipts: {
                                where: receiptWhere,
                            },
                        },
                    },
                },
                orderBy: { companyName: "asc" },
            });

            // Transform to better structure
            const data = vendors.map((v: any) => ({
                id: v.id,
                companyName: v.companyName,
                taxId: v.taxId,
                pendingBillingCount: v._count.billingNotes,
                pendingReceiptCount: v._count.receipts,
            }));

            return { success: true, data };
        },
        {
            detail: {
                summary: "List all vendors",
                description: "Returns all vendors with pending billing/receipt counts. Admin/User only.",
            },
        }
    )
    // Get vendor by ID
    .get(
        "/:id",
        async ({ params, user, set }) => {
            // Only ADMIN and USER can access any vendor
            if (user?.role !== "ADMIN" && user?.role !== "USER") {
                set.status = 403;
                return { success: false, error: "Access denied. Admin or User role required." };
            }

            const vendor = await prisma.vendor.findUnique({
                where: { id: params.id },
                include: {
                    vatConfig: true,
                    _count: {
                        select: {
                            billingNotes: true,
                            receipts: true,
                            jobs: true,
                        },
                    },
                },
            });

            if (!vendor) {
                set.status = 404;
                return { success: false, error: "Vendor not found" };
            }

            return { success: true, data: vendor };
        },
        {
            params: t.Object({ id: t.String() }),
            detail: {
                summary: "Get vendor by ID",
                description: "Returns vendor details. Admin/User only.",
            },
        }
    );
