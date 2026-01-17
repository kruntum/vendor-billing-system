import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { staticPlugin } from "@elysiajs/static";
import path from "path";
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
import { paymentVoucherRoutes } from "./routes/payment-voucher.route";
import { cashAdvanceRoutes } from "./routes/cash-advance.route";
import { cashAdvanceBillingRoutes } from "./routes/cash-advance-billing.route";

// Validate required environment variables
if (process.env.NODE_ENV === "production") {
  if (!process.env.CLIENT_URL) {
    throw new Error(
      "CLIENT_URL environment variable is required in production. Please set it in your .env file."
    );
  }
}

const app = new Elysia()
  // Global Error Handler
  .onError(({ code, error, set }) => {
    // Log error for debugging (in production, use proper logging)
    if (process.env.NODE_ENV !== "production") {
      console.error(`[${code}]`, error);
    }

    // Handle validation errors
    if (code === "VALIDATION") {
      set.status = 400;
      return {
        success: false,
        error: error.message || "Validation error",
      };
    }

    // Handle not found errors
    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        success: false,
        error: "Resource not found",
      };
    }

    // Handle internal server errors
    set.status = 500;
    return {
      success: false,
      error: process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message || "Internal server error",
    };
  })
  // CORS Configuration
  .use(
    cors({
      origin: process.env.NODE_ENV === "production"
        ? process.env.CLIENT_URL!
        : true,
      credentials: true,
    })
  )
  .use(
    staticPlugin({
      // serve the whole public folder (default)  
      assets: path.join(process.cwd(), 'public'),   // "./public"
      prefix: '/public',                            // keep the /public prefix
    })
  )
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
          { name: "Payment Voucher", description: "Payment voucher management" },
          { name: "Cash Advance", description: "Cash advance management" },
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
  .use(paymentVoucherRoutes)
  .use(cashAdvanceRoutes)
  .use(cashAdvanceBillingRoutes)
  // Start Server
  .listen(process.env.PORT || 8801);

console.log(
  `🚀 Server running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;
