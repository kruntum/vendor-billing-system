import type { User } from "./plugins/auth.plugin";

declare module "elysia" {
    interface Context {
        user: User | null;
    }
}
