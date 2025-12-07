import Elysia, { t } from "elysia";
import { jwt } from "@elysiajs/jwt";

// JWT Payload Type
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  vendorId: string | null;
}

// User type from JWT
export interface User {
  id: string;
  email: string;
  role: string;
  vendorId: string | null;
}

// Auth Plugin with JWT
export const authPlugin = new Elysia({ name: "auth" })
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "fallback-secret-change-in-production",
      exp: "7d",
    })
  )
  .derive({ as: 'global' }, async ({ jwt, request }): Promise<{ user: User | null }> => {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { user: null };
    }

    const token = authHeader.substring(7);

    try {
      const payload = (await jwt.verify(token)) as JWTPayload | false;
      if (!payload) {
        return { user: null };
      }
      return {
        user: {
          id: payload.userId,
          email: payload.email,
          role: payload.role,
          vendorId: payload.vendorId,
        },
      };
    } catch {
      return { user: null };
    }
  });

// Guard middleware for protected routes
export const requireAuth = new Elysia({ name: "requireAuth" })
  .use(authPlugin)
  .onBeforeHandle(({ user, set }): any => {
    if (!user) {
      set.status = 401;
      return {
        success: false,
        error: "Unauthorized: Please login to access this resource",
      };
    }
  });

// Guard middleware for vendor-only routes
export const requireVendor = new Elysia({ name: "requireVendor" })
  .use(requireAuth)
  .onBeforeHandle(({ user, set }): any => {
    if (user?.role !== "VENDOR") {
      set.status = 403;
      return {
        success: false,
        error: "Forbidden: Vendor access required",
      };
    }
    if (!user?.vendorId) {
      set.status = 403;
      return {
        success: false,
        error: "Forbidden: No vendor associated with this account",
      };
    }
  });

// Guard middleware for admin-only routes
export const requireAdmin = new Elysia({ name: "requireAdmin" })
  .use(requireAuth)
  .onBeforeHandle(({ user, set }): any => {
    if (user?.role !== "ADMIN") {
      set.status = 403;
      return {
        success: false,
        error: "Forbidden: Admin access required",
      };
    }
  });
