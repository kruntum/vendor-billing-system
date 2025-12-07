import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../plugins/auth.plugin";

async function hashPassword(password: string): Promise<string> {
    return await Bun.password.hash(password, {
        algorithm: "bcrypt",
        cost: 10,
    });
}

export const userRoutes = new Elysia({ prefix: "/users", tags: ["Users"] })
    .use(requireAuth)

    // Get all roles (for dropdown)
    .get(
        "/roles",
        async () => {
            const roles = await prisma.role.findMany({
                orderBy: { name: "asc" },
            });
            return { success: true, data: roles };
        },
        {
            detail: {
                summary: "List roles",
                description: "Get all roles for dropdown",
            },
        }
    )

    // Get all vendors (for dropdown)
    .get(
        "/vendors",
        async () => {
            const vendors = await prisma.vendor.findMany({
                orderBy: { companyName: "asc" },
            });
            return { success: true, data: vendors };
        },
        {
            detail: {
                summary: "List vendors",
                description: "Get all vendors for dropdown",
            },
        }
    )

    // Get all users
    .get(
        "/",
        async ({ user }) => {
            // Only admin can list all users, or maybe filter by vendor if needed
            // For now, let's allow listing all users but maybe we should restrict it later

            const users = await prisma.user.findMany({
                include: {
                    role: true,
                    vendor: true,
                },
                orderBy: { createdAt: "desc" },
            });

            return { success: true, data: users };
        },
        {
            detail: {
                summary: "List users",
                description: "Get all users",
            },
        }
    )

    // Create user
    .post(
        "/",
        async ({ body, set }) => {
            const { email, password, name, roleId, vendorId } = body;

            // Check if email exists
            const existingUser = await prisma.user.findUnique({
                where: { email },
            });

            if (existingUser) {
                set.status = 400;
                return { success: false, error: "Email already exists" };
            }

            const passwordHash = await hashPassword(password);

            const newUser = await prisma.user.create({
                data: {
                    email,
                    passwordHash,
                    name,
                    roleId,
                    vendorId,
                },
                include: {
                    role: true,
                    vendor: true,
                },
            });

            return { success: true, data: newUser };
        },
        {
            body: t.Object({
                email: t.String({ format: "email" }),
                password: t.String({ minLength: 6 }),
                name: t.Optional(t.String()),
                roleId: t.String(),
                vendorId: t.Optional(t.String()),
            }),
            detail: {
                summary: "Create user",
            },
        }
    )

    // Update user
    .put(
        "/:id",
        async ({ params, body, set }) => {
            const { id } = params;
            const { email, name, roleId, vendorId, password } = body;

            const existingUser = await prisma.user.findUnique({
                where: { id },
            });

            if (!existingUser) {
                set.status = 404;
                return { success: false, error: "User not found" };
            }

            const updateData: any = {
                email,
                name,
                roleId,
                vendorId,
            };

            if (password) {
                updateData.passwordHash = await hashPassword(password);
            }

            const updatedUser = await prisma.user.update({
                where: { id },
                data: updateData,
                include: {
                    role: true,
                    vendor: true,
                },
            });

            return { success: true, data: updatedUser };
        },
        {
            params: t.Object({ id: t.String() }),
            body: t.Object({
                email: t.Optional(t.String({ format: "email" })),
                password: t.Optional(t.String({ minLength: 6 })),
                name: t.Optional(t.String()),
                roleId: t.Optional(t.String()),
                vendorId: t.Optional(t.String()),
            }),
            detail: {
                summary: "Update user",
            },
        }
    )

    // Delete user
    .delete(
        "/:id",
        async ({ params, set }) => {
            const { id } = params;

            const existingUser = await prisma.user.findUnique({
                where: { id },
            });

            if (!existingUser) {
                set.status = 404;
                return { success: false, error: "User not found" };
            }

            await prisma.user.delete({
                where: { id },
            });

            return { success: true, message: "User deleted" };
        },
        {
            params: t.Object({ id: t.String() }),
            detail: {
                summary: "Delete user",
            },
        }
    );
