import Elysia, { t } from "elysia";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../plugins/auth.plugin";
import { DateFormat, ResetPeriod } from "../generated/prisma/client";

// Helper function to format date based on DateFormat enum
function formatDatePart(date: Date, format: DateFormat): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    switch (format) {
        case "YYYYMMDD":
            return `${year}${month}${day}`;
        case "YYYYMM":
            return `${year}${month}`;
        case "YYMM":
            return `${String(year).slice(-2)}${month}`;
        default:
            return `${year}${month}${day}`;
    }
}

// Helper function to get period key based on reset period
function getPeriodKey(date: Date, resetPeriod: ResetPeriod, dateFormat: DateFormat): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    switch (resetPeriod) {
        case "DAILY":
            return `${year}${month}${day}`;
        case "MONTHLY":
            return `${year}${month}`;
        case "YEARLY":
            return `${year}`;
        case "NEVER":
            return "ALL"; // Never reset, use constant key
        default:
            return `${year}${month}${day}`;
    }
}

// Generate next document number
export async function generateDocumentNumber(
    vendorId: string,
    documentType: "BILLING" | "RECEIPT",
    date: Date = new Date()
): Promise<string | null> {
    // Get vendor's document number config
    const config = await prisma.documentNumberConfig.findUnique({
        where: { vendorId },
    });

    if (!config) return null;

    // Check if auto-numbering is enabled for this document type
    const isEnabled = documentType === "BILLING" ? config.billingEnabled : config.receiptEnabled;
    if (!isEnabled) return null;

    const prefix = documentType === "BILLING" ? config.billingPrefix : config.receiptPrefix;
    const datePart = formatDatePart(date, config.dateFormat);
    const periodKey = getPeriodKey(date, config.resetPeriod, config.dateFormat);

    // Get or create sequence for this period
    const sequence = await prisma.documentNumberSequence.upsert({
        where: {
            vendorId_documentType_periodKey: {
                vendorId,
                documentType,
                periodKey,
            },
        },
        create: {
            vendorId,
            documentType,
            periodKey,
            lastNumber: 1,
        },
        update: {
            lastNumber: { increment: 1 },
        },
    });

    // Format running number with leading zeros
    const runningNumber = String(sequence.lastNumber).padStart(config.runningDigits, "0");

    return `${prefix}${datePart}${runningNumber}`;
}

// Generate preview document number (without incrementing)
export async function previewDocumentNumber(
    vendorId: string,
    documentType: "BILLING" | "RECEIPT",
    date: Date = new Date()
): Promise<string | null> {
    const config = await prisma.documentNumberConfig.findUnique({
        where: { vendorId },
    });

    if (!config) {
        // Return default preview
        const defaultPrefix = documentType === "BILLING" ? "B" : "R";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${defaultPrefix}${year}${month}${day}001`;
    }

    const isEnabled = documentType === "BILLING" ? config.billingEnabled : config.receiptEnabled;
    const prefix = documentType === "BILLING" ? config.billingPrefix : config.receiptPrefix;
    const datePart = formatDatePart(date, config.dateFormat);
    const periodKey = getPeriodKey(date, config.resetPeriod, config.dateFormat);

    // Get current sequence (without incrementing)
    const sequence = await prisma.documentNumberSequence.findUnique({
        where: {
            vendorId_documentType_periodKey: {
                vendorId,
                documentType,
                periodKey,
            },
        },
    });

    const nextNumber = (sequence?.lastNumber ?? 0) + 1;
    const runningNumber = String(nextNumber).padStart(config.runningDigits, "0");

    return `${prefix}${datePart}${runningNumber}`;
}

export const documentNumberRoutes = new Elysia({ prefix: "/document-number" })
    .use(requireAuth)
    // Get document number config
    .get("/config", async ({ user }) => {
        if (!user?.vendorId) {
            return { success: false, error: "Vendor not found" };
        }

        let config = await prisma.documentNumberConfig.findUnique({
            where: { vendorId: user.vendorId },
        });

        // Return default config if not exists
        if (!config) {
            config = {
                id: "",
                vendorId: user.vendorId,
                billingEnabled: false,
                billingPrefix: "B",
                receiptEnabled: false,
                receiptPrefix: "R",
                dateFormat: "YYYYMMDD" as DateFormat,
                runningDigits: 3,
                resetPeriod: "DAILY" as ResetPeriod,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
        }

        return {
            success: true,
            data: {
                billingEnabled: config.billingEnabled,
                billingPrefix: config.billingPrefix,
                receiptEnabled: config.receiptEnabled,
                receiptPrefix: config.receiptPrefix,
                dateFormat: config.dateFormat,
                runningDigits: config.runningDigits,
                resetPeriod: config.resetPeriod,
            },
        };
    })
    // Update document number config
    .put(
        "/config",
        async ({ user, body }) => {
            if (!user?.vendorId) {
                return { success: false, error: "Vendor not found" };
            }

            const config = await prisma.documentNumberConfig.upsert({
                where: { vendorId: user.vendorId },
                create: {
                    vendorId: user.vendorId,
                    billingEnabled: body.billingEnabled,
                    billingPrefix: body.billingPrefix,
                    receiptEnabled: body.receiptEnabled,
                    receiptPrefix: body.receiptPrefix,
                    dateFormat: body.dateFormat as DateFormat,
                    runningDigits: body.runningDigits,
                    resetPeriod: body.resetPeriod as ResetPeriod,
                },
                update: {
                    billingEnabled: body.billingEnabled,
                    billingPrefix: body.billingPrefix,
                    receiptEnabled: body.receiptEnabled,
                    receiptPrefix: body.receiptPrefix,
                    dateFormat: body.dateFormat as DateFormat,
                    runningDigits: body.runningDigits,
                    resetPeriod: body.resetPeriod as ResetPeriod,
                },
            });

            return {
                success: true,
                data: {
                    billingEnabled: config.billingEnabled,
                    billingPrefix: config.billingPrefix,
                    receiptEnabled: config.receiptEnabled,
                    receiptPrefix: config.receiptPrefix,
                    dateFormat: config.dateFormat,
                    runningDigits: config.runningDigits,
                    resetPeriod: config.resetPeriod,
                },
            };
        },
        {
            body: t.Object({
                billingEnabled: t.Boolean(),
                billingPrefix: t.String({ minLength: 1, maxLength: 10 }),
                receiptEnabled: t.Boolean(),
                receiptPrefix: t.String({ minLength: 1, maxLength: 10 }),
                dateFormat: t.Union([
                    t.Literal("YYYYMMDD"),
                    t.Literal("YYYYMM"),
                    t.Literal("YYMM"),
                ]),
                runningDigits: t.Number({ minimum: 2, maximum: 6 }),
                resetPeriod: t.Union([
                    t.Literal("DAILY"),
                    t.Literal("MONTHLY"),
                    t.Literal("YEARLY"),
                    t.Literal("NEVER"),
                ]),
            }),
        }
    )
    // Get preview of next document number
    .get("/preview", async ({ user, query }) => {
        if (!user?.vendorId) {
            return { success: false, error: "Vendor not found" };
        }

        const documentType = (query.type as "BILLING" | "RECEIPT") || "BILLING";
        const preview = await previewDocumentNumber(user.vendorId, documentType);

        return {
            success: true,
            data: {
                preview,
                documentType,
            },
        };
    });
