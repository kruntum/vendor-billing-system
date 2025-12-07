import { prisma } from "../lib/prisma";
import { Decimal } from "@prisma/client/runtime/client";

/**
 * Backfill script to calculate and set priceBeforeVat for existing billing notes.
 * 
 * Run with: bun run src/scripts/backfill-price-before-vat.ts
 */
async function backfillPriceBeforeVat() {
    console.log("Starting backfill of priceBeforeVat...");

    // Get all billing notes that don't have priceBeforeVat set
    const billingNotes = await prisma.billingNote.findMany({
        where: {
            priceBeforeVat: null,
        },
        include: {
            vendor: {
                include: {
                    vatConfig: true,
                },
            },
        },
    });

    console.log(`Found ${billingNotes.length} billing notes to update.`);

    for (const billing of billingNotes) {
        // Get VAT rate from stored text or default
        const vatRate = billing.vatRateText ? Number(billing.vatRateText) : 7;
        const subtotal = Number(billing.subtotal);
        const vatDivisor = 1 + (vatRate / 100);

        // Calculate priceBeforeVat
        // We assume subtotal INCLUDES VAT (the common case)
        // priceBeforeVat = subtotal / vatDivisor
        const priceBeforeVat = Math.round((subtotal / vatDivisor) * 100) / 100;

        await prisma.billingNote.update({
            where: { id: billing.id },
            data: {
                priceBeforeVat: new Decimal(priceBeforeVat.toFixed(2)),
            },
        });

        console.log(`Updated billing ${billing.billingRef}: priceBeforeVat = ${priceBeforeVat}`);
    }

    console.log("Backfill complete!");
}

backfillPriceBeforeVat()
    .catch((e) => {
        console.error("Backfill failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
