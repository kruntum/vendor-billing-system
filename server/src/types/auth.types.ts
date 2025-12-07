import type { User } from "../plugins/auth.plugin";

// Extend Elysia context with user property
export interface AuthContext {
    user: User | null;
}

// Helper type for route contexts that require authentication
export interface AuthenticatedContext extends AuthContext {
    user: User; // Non-null user for authenticated routes
}
