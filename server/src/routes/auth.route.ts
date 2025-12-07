import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "../lib/prisma";

// Password hashing using Bun's built-in functions
async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 10,
  });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash);
}

export const authRoutes = new Elysia({ prefix: "/auth", tags: ["Auth"] })
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "fallback-secret-change-in-production",
      exp: "7d",
    })
  )
  // Login
  .post(
    "/login",
    async ({ body, jwt, set }) => {
      const { email, password } = body;

      // Find user with role and vendor info
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          role: true,
          vendor: true,
        },
      });

      if (!user) {
        set.status = 401;
        return {
          success: false,
          error: "Invalid email or password",
        };
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, user.passwordHash);

      if (!isValidPassword) {
        set.status = 401;
        return {
          success: false,
          error: "Invalid email or password",
        };
      }

      // Generate JWT token
      const token = await jwt.sign({
        userId: user.id,
        email: user.email,
        role: user.role.name,
        vendorId: user.vendorId,
      });

      return {
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role.name,
            vendor: user.vendor
              ? {
                id: user.vendor.id,
                companyName: user.vendor.companyName,
              }
              : null,
          },
        },
      };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 6 }),
      }),
      detail: {
        summary: "Login",
        description: "Authenticate user and return JWT token",
      },
    }
  )
  // Get current user
  .get(
    "/me",
    async ({ request, jwt, set }) => {
      const authHeader = request.headers.get("authorization");

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        set.status = 401;
        return { success: false, error: "No token provided" };
      }

      const token = authHeader.substring(7);

      try {
        const payload = await jwt.verify(token);

        if (!payload || typeof payload !== "object") {
          set.status = 401;
          return { success: false, error: "Invalid token" };
        }

        const user = await prisma.user.findUnique({
          where: { id: payload.userId as string },
          include: {
            role: true,
            vendor: {
              include: {
                vatConfig: true,
              },
            },
          },
        });

        if (!user) {
          set.status = 401;
          return { success: false, error: "User not found" };
        }

        return {
          success: true,
          data: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role.name,
            vendor: user.vendor
              ? {
                id: user.vendor.id,
                companyName: user.vendor.companyName,
                taxId: user.vendor.taxId,
                vatConfig: user.vendor.vatConfig,
              }
              : null,
          },
        };
      } catch {
        set.status = 401;
        return { success: false, error: "Invalid token" };
      }
    },
    {
      detail: {
        summary: "Get current user",
        description: "Get authenticated user information",
      },
    }
  );
