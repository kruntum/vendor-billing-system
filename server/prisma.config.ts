import 'dotenv/config'
import { defineConfig, env } from "prisma/config";

type Env = {
  DATABASE_URL: string
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env('DATABASE_URL'), // เปลี่ยนเป็น env('DATABASE_URL')
    // url: env<Env>('DATABASE_URL'),
  },
});