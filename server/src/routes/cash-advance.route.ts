import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../plugins/auth.plugin";
import { format } from "date-fns";

// Helper to get role name
const getRoleName = (role: { name: string } | string) =>
    typeof role === "string" ? role : role.name;

// Helper to generate advance ref
const generateAdvanceRef = async (vendorId: string): Promise<string> => {
    const today = new Date();
    const dateStr = format(today, "yyyyMMdd");
    const prefix = "CA";

    // Count existing advances for today
    const count = await prisma.cashAdvance.count({
        where: {
            vendorId,
            advanceRef: { startsWith: `${prefix}${dateStr}` },
        },
    });

    const runNumber = String(count + 1).padStart(3, "0");
    return `${prefix}${dateStr}${runNumber}`;
};

export const cashAdvanceRoutes = new Elysia({ prefix: "/cash-advance", tags: ["Cash Advance"] })
    .use(requireAuth)

    // List cash advances
    .get(
        "/",
        async ({ user, query }) => {
            const { status, page = "1", limit = "20" } = query;
            const roleName = getRoleName(user!.role);
            const isVendor = roleName === "VENDOR";

            const where: any = {};

            // Vendor only sees their own
            if (isVendor) {
                where.vendorId = user!.vendorId!;
            }

            if (status) {
                where.status = status;
            }

            const [advances, total] = await Promise.all([
                prisma.cashAdvance.findMany({
                    where,
                    include: {
                        items: true,
                        vendor: { select: { id: true, companyName: true } },
                        cashAdvanceBilling: { select: { id: true, billingRef: true, status: true } },
                    },
                    orderBy: { createdAt: "desc" },
                    skip: (parseInt(page) - 1) * parseInt(limit),
                    take: parseInt(limit),
                }),
                prisma.cashAdvance.count({ where }),
            ]);

            return {
                success: true,
                data: advances,
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
                status: t.Optional(t.Enum({
                    DRAFT: "DRAFT",
                    PENDING: "PENDING",
                    BILLED: "BILLED"
                })),
                page: t.Optional(t.String()),
                limit: t.Optional(t.String()),
            }),
            detail: { summary: "List cash advances" },
        }
    )

    // Get cash advance by ID
    .get(
        "/:id",
        async ({ params, user, set }) => {
            const roleName = getRoleName(user!.role);
            const isVendor = roleName === "VENDOR";

            const where: any = { id: params.id };
            if (isVendor) {
                where.vendorId = user!.vendorId!;
            }

            const advance = await prisma.cashAdvance.findFirst({
                where,
                include: {
                    items: true,
                    vendor: true,
                    cashAdvanceBilling: true,
                },
            });

            if (!advance) {
                set.status = 404;
                return { success: false, error: "Cash advance not found" };
            }

            return { success: true, data: advance };
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "Get cash advance by ID" },
        }
    )

    // Create cash advance (Vendor only)
    .post(
        "/",
        async ({ body, user, set }) => {
            const roleName = getRoleName(user!.role);
            if (roleName !== "VENDOR") {
                set.status = 403;
                return { success: false, error: "Only vendors can create cash advances" };
            }

            if (!user!.vendorId) {
                set.status = 400;
                return { success: false, error: "Vendor not configured" };
            }

            const advanceRef = await generateAdvanceRef(user!.vendorId);
            const totalAmount = body.items.reduce((sum, item) => sum + item.amount, 0);

            const advance = await prisma.cashAdvance.create({
                data: {
                    advanceRef,
                    vendorId: user!.vendorId,
                    advanceDate: new Date(body.advanceDate),
                    description: body.description,
                    refInvoiceNo: body.refInvoiceNo,
                    containerNo: body.containerNo,
                    truckPlate: body.truckPlate,
                    declarationNo: body.declarationNo,
                    totalAmount,
                    status: "DRAFT",
                    items: {
                        create: body.items.map((item) => ({
                            description: item.description,
                            amount: item.amount,
                            receiptFile: item.receiptFile,
                        })),
                    },
                },
                include: { items: true },
            });

            return { success: true, data: advance };
        },
        {
            body: t.Object({
                advanceDate: t.String(),
                description: t.Optional(t.String()),
                refInvoiceNo: t.Optional(t.String()),
                containerNo: t.Optional(t.String()),
                truckPlate: t.Optional(t.String()),
                declarationNo: t.Optional(t.String()),
                items: t.Array(
                    t.Object({
                        description: t.String({ minLength: 1 }),
                        amount: t.Number({ minimum: 0 }),
                        receiptFile: t.Optional(t.String()),
                    }),
                    { minItems: 1 }
                ),
            }),
            detail: { summary: "Create cash advance (Vendor only)" },
        }
    )

    // Update cash advance (Vendor only, DRAFT only)
    .put(
        "/:id",
        async ({ params, body, user, set }) => {
            const roleName = getRoleName(user!.role);
            if (roleName !== "VENDOR") {
                set.status = 403;
                return { success: false, error: "Only vendors can edit cash advances" };
            }

            const existing = await prisma.cashAdvance.findFirst({
                where: { id: params.id, vendorId: user!.vendorId! },
            });

            if (!existing) {
                set.status = 404;
                return { success: false, error: "Cash advance not found" };
            }

            if (existing.status === "BILLED") {
                set.status = 400;
                return { success: false, error: "Cannot edit BILLED cash advances" };
            }
            // Allow editing DRAFT and PENDING? Usually only DRAFT.
            // But if user submitted (PENDING), they might want to fix before billing?
            // Job allows edit unless BILLED.
            // Let's restricting to DRAFT for now to force "Revert" flow if needed, OR allow if PENDING too.
            // Existing logic was DRAFT only.

            if (existing.status !== "DRAFT" && existing.status !== "PENDING") {
                set.status = 400;
                return { success: false, error: "Can only edit DRAFT or PENDING cash advances." };
            }

            const totalAmount = body.items.reduce((sum, item) => sum + item.amount, 0);

            const advance = await prisma.$transaction(async (tx) => {
                await tx.cashAdvanceItem.deleteMany({ where: { cashAdvanceId: params.id } });

                return tx.cashAdvance.update({
                    where: { id: params.id },
                    data: {
                        advanceDate: new Date(body.advanceDate),
                        description: body.description,
                        refInvoiceNo: body.refInvoiceNo,
                        containerNo: body.containerNo,
                        truckPlate: body.truckPlate,
                        declarationNo: body.declarationNo,
                        totalAmount,
                        items: {
                            create: body.items.map((item) => ({
                                description: item.description,
                                amount: item.amount,
                                receiptFile: item.receiptFile,
                            })),
                        },
                    },
                    include: { items: true },
                });
            });

            return { success: true, data: advance };
        },
        {
            params: t.Object({ id: t.String() }),
            body: t.Object({
                advanceDate: t.String(),
                description: t.Optional(t.String()),
                refInvoiceNo: t.Optional(t.String()),
                containerNo: t.Optional(t.String()),
                truckPlate: t.Optional(t.String()),
                declarationNo: t.Optional(t.String()),
                items: t.Array(
                    t.Object({
                        description: t.String({ minLength: 1 }),
                        amount: t.Number({ minimum: 0 }),
                        receiptFile: t.Optional(t.String()),
                    }),
                    { minItems: 1 }
                ),
            }),
            detail: { summary: "Update cash advance (Vendor, DRAFT only)" },
        }
    )

    // Submit cash advance (Vendor only, DRAFT -> PENDING)
    .post(
        "/:id/submit",
        async ({ params, user, set }) => {
            const roleName = getRoleName(user!.role);
            if (roleName !== "VENDOR") {
                set.status = 403;
                return { success: false, error: "Only vendors can submit cash advances" };
            }

            const existing = await prisma.cashAdvance.findFirst({
                where: { id: params.id, vendorId: user!.vendorId! },
            });

            if (!existing) {
                set.status = 404;
                return { success: false, error: "Cash advance not found" };
            }

            if (existing.status !== "DRAFT") {
                set.status = 400;
                return { success: false, error: "Can only submit DRAFT cash advances" };
            }

            const advance = await prisma.cashAdvance.update({
                where: { id: params.id },
                data: { status: "PENDING" },
                include: { items: true },
            });

            return { success: true, data: advance };
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "Submit cash advance (DRAFT -> PENDING)" },
        }
    )

    // Revert cash advance (Vendor/Admin, PENDING -> DRAFT)
    .post(
        "/:id/revert",
        async ({ params, user, set }) => {
            // Check auth (Vendor can revert own, Admin can revert any pending)
            const roleName = getRoleName(user!.role);
            const where: any = { id: params.id };
            if (roleName === "VENDOR") {
                where.vendorId = user!.vendorId!;
            }

            const existing = await prisma.cashAdvance.findFirst({ where });

            if (!existing) {
                set.status = 404;
                return { success: false, error: "Cash advance not found" };
            }

            if (existing.status === "BILLED") {
                set.status = 400;
                return { success: false, error: "Cannot revert BILLED cash advances" };
            }

            if (existing.status === "PENDING") {
                await prisma.cashAdvance.update({
                    where: { id: params.id },
                    data: { status: "DRAFT" },
                });
                return { success: true, message: "Reverted to DRAFT" };
            }

            set.status = 400;
            return { success: false, error: "Not in PENDING status" };
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "Revert cash advance status (PENDING -> DRAFT)" },
        }
    )

    // Delete cash advance (Vendor only, DRAFT only)
    .delete(
        "/:id",
        async ({ params, user, set }) => {
            const roleName = getRoleName(user!.role);
            if (roleName !== "VENDOR") {
                set.status = 403;
                return { success: false, error: "Only vendors can delete cash advances" };
            }

            const existing = await prisma.cashAdvance.findFirst({
                where: { id: params.id, vendorId: user!.vendorId! },
            });

            if (!existing) {
                set.status = 404;
                return { success: false, error: "Cash advance not found" };
            }

            if (existing.status === "BILLED") {
                set.status = 400;
                return { success: false, error: "Cannot delete BILLED cash advances" };
            }

            // Allow deleting PENDING? Usually only DRAFT.
            if (existing.status !== "DRAFT") {
                set.status = 400;
                return { success: false, error: "Can only delete DRAFT cash advances. Revert first if PENDING." };
            }

            await prisma.cashAdvance.delete({ where: { id: params.id } });

            return { success: true, message: "Cash advance deleted" };
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "Delete cash advance (Vendor, DRAFT only)" },
        }
    );
