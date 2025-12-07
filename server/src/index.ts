import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { staticPlugin } from "@elysiajs/static";
import { authRoutes } from "./routes/auth.route";
import { catalogRoutes } from "./routes/catalog.route";
import { jobRoutes } from "./routes/job.route";
import { billingRoutes } from "./routes/billing.route";
import { receiptRoutes } from "./routes/receipt.route";
import { userRoutes } from "./routes/user.route";
import { settingsRoutes } from "./routes/settings.route";
import { pdfRoutes } from "./routes/pdf.route";
import { documentNumberRoutes } from "./routes/docnumber.route";
import { vendorRoutes } from "./routes/vendor.route";

const app = new Elysia()
  // CORS Configuration
  .use(
    cors({
      origin: process.env.NODE_ENV === "production"
        ? ["http://localhost:8802"]
        : true,
      credentials: true,
    })
  )
  // Static file serving for PDFs
  .use(staticPlugin({
    assets: "public",
    prefix: "/public",
  }))
  // Swagger Documentation
  .use(
    swagger({
      documentation: {
        info: {
          title: "Vendor Billing System API",
          version: "1.0.0",
          description: "Enterprise Logistics Vendor Billing System API",
        },
        tags: [
          { name: "Auth", description: "Authentication endpoints" },
          { name: "Catalogs", description: "Service & Job Description Catalogs" },
          { name: "Jobs", description: "Job management" },
          { name: "Billing", description: "Billing note management" },
          { name: "Receipts", description: "Receipt management" },
          { name: "Users", description: "User management" },
          { name: "Settings", description: "Settings management" },
          { name: "PDF", description: "PDF generation" },
          { name: "Document Number", description: "Document numbering configuration" },
        ],
      },
    })
  )
  // Health Check
  .get("/", () => ({
    name: "Vendor Billing System API",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
  }))
  .get("/health", () => ({ status: "ok" }))
  // Global request logger
  .onRequest(({ request }) => {
    console.log(`[REQ] ${request.method} ${new URL(request.url).pathname}`);
  })
  // Routes
  .use(authRoutes)
  .use(catalogRoutes)
  .use(jobRoutes)
  .use(billingRoutes)
  .use(receiptRoutes)
  .use(userRoutes)
  .use(settingsRoutes)
  .use(pdfRoutes)
  .use(documentNumberRoutes)
  .use(vendorRoutes)
  // Start Server
  .listen(process.env.PORT || 8801);

console.log(
  `🚀 Server running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;
