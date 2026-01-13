import { Elysia, t } from "elysia";
import PDFDocument from "pdfkit";
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from "fs";
import path from "path";
import { requireAuth } from "../plugins/auth.plugin";
import { prisma } from "../lib/prisma";
import { format } from "date-fns";
import { BahtText } from "../lib/bahttext";
import {
    generateBillingNotePDF,
    generateDetailedPaymentVoucherPDF,
    generateReceiptPDF,
    generateCashAdvanceBillingPDF,
    generateCashAdvancePaymentVoucherPDF
} from "../lib/pdf-generator";

const pdfDir = path.join(process.cwd(), "public", "pdfs");
if (!existsSync(pdfDir)) {
    mkdirSync(pdfDir, { recursive: true });
}

const thaiFontPath = path.join(process.cwd(), "fonts", "Sarabun-Regular.ttf");
const chineseFontPath = path.join(process.cwd(), "fonts", "NotoSansSC-Regular.ttf");

// ------------------------------------------------------------------
// การตั้งค่าสี (Colors Configuration)
// สามารถแก้ไขรหัสสี Hex ใช้งานได้ตามต้องการ
// ------------------------------------------------------------------
// const PRIMARY_COLOR = "#228B22"; // สีหลัก (หัวข้อ, เส้นขอบสำคัญ)
const PRIMARY_COLOR = "#000000"; // สีหลัก (หัวข้อ, เส้นขอบสำคัญ)
const COMPANY_NAME_COLOR = "#000000"; // สีชื่อบริษัท
const TEXT_DARK = "#000000"; // สีตัวอักษรเข้ม (เนื้อหาหลัก)
const TEXT_GRAY = "#4b5563"; // สีตัวอักษรเทา (ป้ายกำกับ, ข้อมูลรอง)
const BORDER_COLOR = "#C0C0C0"; // สีเส้นขอบทั่วไป
const BOX_BORDER_COLOR = "#C0C0C0"; // สีเส้นขอบกล่องข้อความ
const BOX_BACKGROUND_COLOR = "#f9fafb"; // สีพื้นหลังกล่องข้อความ
const TABLE_BORDER_WIDTH = 0.5; // ความหนาเส้นตาราง
const ROW_BORDER_COLOR = "#DCDCDC"; // สีเส้นแบ่งบรรทัดในตาราง

// ------------------------------------------------------------------
// ฟังก์ชันช่วย: ทำความสะอาดชื่อไฟล์ (Sanitize Filename)
// เปลี่ยนอักขระพิเศษเป็น _ เพื่อป้องกันปัญหาในการบันทึกไฟล์
// ------------------------------------------------------------------
function sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9]/gi, "_").replace(/_+/g, "_");
}

export const pdfRoutes = new Elysia({ prefix: "/pdf", tags: ["PDF"] })
    .use(requireAuth)
    .get(
        "/billing/:id",
        async ({ params, user, set }) => {
            try {
                const { id } = params;

                // Build query based on role
                const where: any = { id };

                // Admin/User can access any billing, vendor can only access their own
                if (user?.role !== "ADMIN" && user?.role !== "USER") {
                    if (!user?.vendorId) {
                        set.status = 403;
                        return { success: false, error: "Vendor ID required" };
                    }
                    where.vendorId = user.vendorId;
                }

                const billing = await prisma.billingNote.findFirst({
                    where,
                    include: { jobs: { include: { items: true } }, vendor: true },
                });

                if (!billing) {
                    set.status = 404;
                    return { success: false, error: "Billing note not found" };
                }

                if (billing.pdfUrl) {
                    const existingPath = path.join(process.cwd(), billing.pdfUrl);
                    if (existsSync(existingPath)) {
                        // หากมีไฟล์อยู่แล้ว ให้ส่ง URL กลับไปทันที (ไม่ต้องสร้างใหม่)
                        return { success: true, data: { filename: path.basename(billing.pdfUrl), url: billing.pdfUrl } };
                    }
                    // หากมี URL แต่ไม่มีไฟล์จริง -> ให้สร้างใหม่
                }

                // ลบไฟล์เก่าทิ้งหากมีการสร้างใหม่ (เพื่อไม่ให้เปลืองพื้นที่ Server)
                if (billing.pdfUrl) {
                    const oldPath = path.join(process.cwd(), billing.pdfUrl);
                    if (existsSync(oldPath)) {
                        try {
                            unlinkSync(oldPath);
                        } catch (e) {
                            console.error("Failed to delete old PDF:", e);
                        }
                    }
                }

                // สร้างไฟล์ PDF ใหม่
                const companySettings = await prisma.companySettings.findFirst();
                const sanitizedRef = sanitizeFilename(billing.billingRef || billing.id);
                // ตั้งชื่อไฟล์โดยใส่ Timestamp (Date.now()) เพื่อไม่ให้ซ้ำ
                const filename = `billing-${sanitizedRef}-${Date.now()}.pdf`;
                const relativeUrl = `/public/pdfs/${filename}`;
                const filepath = path.join(pdfDir, filename);

                // ตั้งค่าขอบกระดาษ (Margin) และเปิด bufferPages เพื่อนับหน้า
                const margin = 25;
                const marginTop = 15;
                const doc = new PDFDocument({
                    size: "A4",
                    margins: { top: marginTop, bottom: margin, left: margin, right: margin },
                    bufferPages: true
                });
                doc.registerFont("Sarabun", thaiFontPath); // ลงทะเบียนฟอนต์ไทย
                const writeStream = createWriteStream(filepath);
                doc.pipe(writeStream);
                await generateBillingNotePDF(doc, billing, companySettings, thaiFontPath);
                await new Promise<void>((resolve, reject) => {
                    writeStream.on("finish", resolve);
                    writeStream.on("error", reject);
                });

                // อัปเดต BillingNote ด้วย pdfUrl
                await prisma.billingNote.update({
                    where: { id: billing.id },
                    data: { pdfUrl: relativeUrl }
                });

                return { success: true, data: { filename, url: relativeUrl } };
            } catch (error: any) {
                console.error("PDF generation error:", error);
                set.status = 500;
                return { success: false, error: error.message || "Failed to generate PDF" };
            }
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "สร้างไฟล์ PDF ใบวางบิล", description: "สร้างไฟล์ PDF แบบมืออาชีพรองรับฟอนต์ไทย" },
        }
    )
    .get(
        "/billing/:id/preview",
        async ({ params, user, set }) => {
            try {
                const { id } = params;
                const where: any = { id };
                if (user?.role !== "ADMIN" && user?.role !== "USER") {
                    if (!user?.vendorId) {
                        set.status = 403;
                        return { success: false, error: "Vendor ID required" };
                    }
                    where.vendorId = user.vendorId;
                }

                const billing = await prisma.billingNote.findFirst({
                    where,
                    include: { jobs: { include: { items: true } }, vendor: true },
                });

                if (!billing) {
                    set.status = 404;
                    return { success: false, error: "Billing note not found" };
                }

                const companySettings = await prisma.companySettings.findFirst();

                // Create PDF Document (streamable)
                const margin = 25;
                const marginTop = 15;
                const doc = new PDFDocument({
                    size: "A4",
                    margins: { top: marginTop, bottom: margin, left: margin, right: margin },
                    bufferPages: true
                });

                // Headers for inline preview
                set.headers["Content-Type"] = "application/pdf";
                set.headers["Content-Disposition"] = `inline; filename="preview-billing.pdf"`;

                await generateBillingNotePDF(doc, billing, companySettings, thaiFontPath);

                return doc;

            } catch (error: any) {
                console.error("Preview PDF generation error:", error);
                set.status = 500;
                return { success: false, error: error.message || "Failed to generate PDF preview" };
            }
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "Preview Billing Note PDF", description: "Stream Billing Note PDF for preview" },
        }
    )
    .get(
        "/receipt/:id/preview",
        async ({ params, user, set }) => {
            try {
                const { id } = params;

                // Build query based on role
                const where: any = { id };

                // Admin/User can access any receipt, vendor can only access their own
                if (user?.role !== "ADMIN" && user?.role !== "USER") {
                    if (!user?.vendorId) {
                        set.status = 403;
                        return { success: false, error: "Vendor ID required" };
                    }
                    where.vendorId = user.vendorId;
                }

                const receipt = await prisma.receipt.findFirst({
                    where,
                    include: {
                        billingNote: {
                            include: {
                                jobs: { include: { items: true } },
                                vendor: true
                            }
                        },
                        paymentVoucher: {
                            include: {
                                vendor: true,
                                billingNotes: {
                                    include: {
                                        jobs: { include: { items: true } }
                                    }
                                }
                            }
                        },
                        vendor: true
                    },
                });

                if (!receipt) {
                    set.status = 404;
                    return { success: false, error: "Receipt not found" };
                }

                let billing: any = receipt.billingNote;
                if (!billing && receipt.paymentVoucher) {
                    const pv = receipt.paymentVoucher;
                    billing = {
                        ...pv,
                        vendor: pv.vendor,
                        billingRef: pv.voucherRef,
                        billingDate: pv.voucherDate,
                        subtotal: pv.subtotal,
                        vatAmount: pv.totalVat,
                        whtAmount: pv.totalWht,
                        netTotal: pv.netTotal,
                        jobs: pv.billingNotes.flatMap((bn: any) => bn.jobs || [])
                    } as any;
                }
                const companySettings = await prisma.companySettings.findFirst();

                // Create PDF Document (streamable)
                const margin = 25;
                const marginTop = 15;
                const doc = new PDFDocument({
                    size: "A4",
                    margins: { top: marginTop, bottom: margin, left: margin, right: margin },
                    bufferPages: true
                });

                // Headers for inline preview
                set.headers["Content-Type"] = "application/pdf";
                set.headers["Content-Disposition"] = `inline; filename="preview-receipt.pdf"`;

                await generateReceiptPDF(doc, receipt, billing, companySettings, thaiFontPath);

                return doc;

            } catch (error: any) {
                console.error("Preview Receipt PDF error:", error);
                set.status = 500;
                return { success: false, error: error.message || "Failed to generate Receipt PDF preview" };
            }
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "Preview Receipt PDF", description: "Stream Receipt PDF for preview" },
        }
    )
    .get(
        "/receipt/:id",
        async ({ params, user, set }) => {
            try {
                const { id } = params;

                // Build query based on role
                const where: any = { id };

                // Admin/User can access any receipt, vendor can only access their own
                if (user?.role !== "ADMIN" && user?.role !== "USER") {
                    if (!user?.vendorId) {
                        set.status = 403;
                        return { success: false, error: "Vendor ID required" };
                    }
                    where.vendorId = user.vendorId;
                }

                const receipt = await prisma.receipt.findFirst({
                    where,
                    include: {
                        billingNote: {
                            include: {
                                jobs: { include: { items: true } },
                                vendor: true
                            }
                        },
                        paymentVoucher: {
                            include: {
                                vendor: true,
                                billingNotes: {
                                    include: {
                                        jobs: { include: { items: true } }
                                    }
                                }
                            }
                        },
                        vendor: true
                    },
                });

                if (!receipt) {
                    set.status = 404;
                    return { success: false, error: "Receipt not found" };
                }

                let billing: any = receipt.billingNote;
                if (!billing && receipt.paymentVoucher) {
                    const pv = receipt.paymentVoucher;
                    billing = {
                        ...pv,
                        vendor: pv.vendor,
                        billingRef: pv.voucherRef,
                        billingDate: pv.voucherDate,
                        subtotal: pv.subtotal,
                        vatAmount: pv.totalVat,
                        whtAmount: pv.totalWht,
                        netTotal: pv.netTotal,
                        jobs: pv.billingNotes.flatMap((bn: any) => bn.jobs || [])
                    } as any;
                }

                if (receipt.receiptFile) {
                    const existingPath = path.join(process.cwd(), receipt.receiptFile);
                    if (existsSync(existingPath)) {
                        return { success: true, data: { filename: path.basename(receipt.receiptFile), url: receipt.receiptFile } };
                    }
                }

                // ลบไฟล์เก่าหากมี (การล้างข้อมูล)
                if (receipt.receiptFile) {
                    const oldPath = path.join(process.cwd(), receipt.receiptFile);
                    if (existsSync(oldPath)) {
                        try {
                            unlinkSync(oldPath);
                        } catch (e) {
                            console.error("Failed to delete old PDF:", e);
                        }
                    }
                }

                const companySettings = await prisma.companySettings.findFirst();
                const sanitizedRef = sanitizeFilename(receipt.receiptRef || receipt.id);
                const filename = `receipt-${sanitizedRef}-${Date.now()}.pdf`;
                const relativeUrl = `/public/pdfs/${filename}`;
                const filepath = path.join(pdfDir, filename);

                // ลดขอบกระดาษด้านบนเหลือ 15, ด้านข้าง 25
                const margin = 25;
                const marginTop = 15;
                const doc = new PDFDocument({
                    size: "A4",
                    margins: { top: marginTop, bottom: margin, left: margin, right: margin },
                    bufferPages: true
                });
                doc.registerFont("Sarabun", thaiFontPath);
                const writeStream = createWriteStream(filepath);
                doc.pipe(writeStream);
                await generateReceiptPDF(doc, receipt, billing, companySettings, thaiFontPath);
                await new Promise<void>((resolve, reject) => {
                    writeStream.on("finish", resolve);
                    writeStream.on("error", reject);
                });

                // อัปเดต Receipt ด้วย receiptFile
                await prisma.receipt.update({
                    where: { id: receipt.id },
                    data: { receiptFile: relativeUrl }
                });

                return { success: true, data: { filename, url: relativeUrl } };
            } catch (error: any) {
                console.error("PDF generation error:", error);
                set.status = 500;
                return { success: false, error: error.message || "Failed to generate PDF" };
            }
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "สร้างไฟล์ PDF ใบเสร็จรับเงิน", description: "สร้างไฟล์ PDF ใบเสร็จรับเงินแบบมืออาชีพ" },
        }
    )
    // ============================================
    // PAYMENT VOUCHER PDF
    // ============================================
    .get(
        "/payment-voucher/:id",
        async ({ params, user, set }) => {
            try {
                const { id } = params;

                // Only ADMIN and USER can access
                if (user?.role !== "ADMIN" && user?.role !== "USER") {
                    set.status = 403;
                    return { success: false, error: "Access denied" };
                }

                const voucher = await prisma.paymentVoucher.findUnique({
                    where: { id },
                    include: {
                        vendor: true,
                        billingNotes: {
                            include: { jobs: true }
                        },
                        createdBy: true
                    }
                });

                if (!voucher) {
                    set.status = 404;
                    return { success: false, error: "Payment voucher not found" };
                }

                // Check if PDF already exists
                if (voucher.pdfUrl) {
                    const existingPath = path.join(process.cwd(), voucher.pdfUrl);
                    if (existsSync(existingPath)) {
                        return { success: true, data: { filename: path.basename(voucher.pdfUrl), url: voucher.pdfUrl } };
                    }
                }

                const companySettings = await prisma.companySettings.findFirst();
                const sanitizedRef = sanitizeFilename(voucher.voucherRef || voucher.id);
                const filename = `payment-voucher-${sanitizedRef}-${Date.now()}.pdf`;
                const relativeUrl = `/public/pdfs/${filename}`;
                const filepath = path.join(pdfDir, filename);

                const margin = 25;
                const marginTop = 15;
                const doc = new PDFDocument({
                    size: "A4",
                    margins: { top: marginTop, bottom: margin, left: margin, right: margin },
                    bufferPages: true
                });
                doc.registerFont("Sarabun", thaiFontPath);
                doc.registerFont("NotoSansSC", chineseFontPath);
                const writeStream = createWriteStream(filepath);
                doc.pipe(writeStream);

                const pageWidth = 595.28;
                const pageHeight = 841.89;
                const contentWidth = pageWidth - (margin * 2);

                // --- Font Switching Helper ---
                const drawMixedText = (text: string, x: number, y: number, options: any = {}) => {
                    const parts = text.split(/([\u4e00-\u9fa5]+)/g).filter(Boolean);
                    const fontSizes = options.size || 8;
                    const baseFont = "Sarabun";
                    const cnFont = "NotoSansSC";

                    // Start X calculation for align center/right
                    let startX = x;
                    if (options.align === "center" || options.align === "right") {
                        let totalWidth = 0;
                        parts.forEach(part => {
                            const isChinese = /[\u4e00-\u9fa5]/.test(part);
                            doc.font(isChinese ? cnFont : baseFont).fontSize(fontSizes);
                            totalWidth += doc.widthOfString(part);
                        });
                        if (options.align === "center") startX = x + (options.width - totalWidth) / 2;
                        if (options.align === "right") startX = x + options.width - totalWidth;
                    }

                    let currentX = startX;
                    parts.forEach(part => {
                        const isChinese = /[\u4e00-\u9fa5]/.test(part);
                        doc.font(isChinese ? cnFont : baseFont).fontSize(fontSizes).fillColor(options.color || TEXT_DARK);
                        doc.text(part, currentX, y, { lineBreak: false });
                        currentX += doc.widthOfString(part);
                    });
                    // Reset to base
                    doc.font(baseFont).fontSize(fontSizes);
                };

                // ========== HEADER ==========
                let currentY = marginTop;

                // 1. Company Header
                doc.font("Sarabun").fontSize(12).fillColor(TEXT_DARK);
                doc.text(companySettings?.companyName || "ASIA THAI SHIPPING SERVICE CO., LTD", margin, currentY, { width: contentWidth, align: "center" });
                currentY += 14;

                doc.fontSize(8).fillColor(TEXT_GRAY);
                doc.text(companySettings?.companyAddress || "62 SOI SUPAPONG 3, YAK 8, NONG BON SUBDISTRICT, PRAWET DISTRICT, BANGKOK 10250", margin, currentY, { width: contentWidth, align: "center" });
                currentY += 20;

                // Title
                drawMixedText("ใบสำคัญจ่าย (PAYMENT VOUCHER) 付款申请单", margin, currentY, { width: contentWidth, align: "center", size: 12, color: TEXT_DARK });
                currentY += 30;

                // 2. Info Grid
                const labelX = margin;
                const valueX = margin + 120;
                const rightLabelX = pageWidth - margin - 180;
                const rightValueX = pageWidth - margin - 80;

                // Row 1: Customer | Date
                doc.fontSize(8).fillColor(TEXT_DARK);
                drawMixedText("ลูกค้า (The customer) 付款人 :", labelX, currentY);
                doc.fillColor(TEXT_GRAY).text(companySettings?.companyName || "-", valueX, currentY);
                doc.moveTo(valueX, currentY + 10).lineTo(rightLabelX - 10, currentY + 10).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();

                drawMixedText("วันที่เอกสาร (DATE) 日期 :", rightLabelX, currentY);
                doc.fillColor(TEXT_GRAY).text(format(new Date(voucher.voucherDate), "dd/MM/yyyy"), rightValueX, currentY, { align: "right", width: 80 });
                doc.moveTo(rightValueX, currentY + 10).lineTo(pageWidth - margin, currentY + 10).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();
                currentY += 18;

                // Row 2: Paid To | Voucher No
                drawMixedText("จ่ายให้ (Paid To) 收款人 :", labelX, currentY);
                doc.fillColor(TEXT_GRAY).text(voucher.vendor.companyName, valueX, currentY);
                doc.moveTo(valueX, currentY + 10).lineTo(rightLabelX - 10, currentY + 10).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();

                drawMixedText("VOUCHER NO. 单据号 :", rightLabelX, currentY);
                doc.fillColor(TEXT_GRAY).text(voucher.voucherRef, rightValueX, currentY, { align: "right", width: 80 });
                doc.moveTo(rightValueX, currentY + 10).lineTo(pageWidth - margin, currentY + 10).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();
                currentY += 18;

                // Row 3: Paid For
                drawMixedText("เพื่อชำระ (Paid For) 款项用途 :", labelX, currentY);
                const paidForText = "ค่าเดินพิธีการตรวจปล่อยและสำรองใบอนุญาต";
                doc.fillColor(TEXT_GRAY).text(paidForText, valueX, currentY);
                doc.moveTo(valueX, currentY + 10).lineTo(pageWidth - margin, currentY + 10).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();
                currentY += 18; // Increased spacing for Account No

                // Row 4: Account Bank / No
                const accLabel = "ชื่อบัญชี/เลขบัญชี (Account Name/Account No.) 银行名称/银行账号 :";
                doc.fillColor(TEXT_DARK); // Set color for labels
                drawMixedText(accLabel, labelX, currentY);
                const accValueX = margin + 250;
                const bankInfo = `${voucher.vendor.bankName || ""} ${voucher.vendor.bankAccount || ""}`.trim() || "-";

                doc.fillColor(TEXT_GRAY).text(bankInfo, accValueX, currentY); // Data value
                doc.moveTo(accValueX, currentY + 10).lineTo(pageWidth - margin, currentY + 10).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();
                currentY += 18;

                // Row 5: Payment Method
                doc.fontSize(7).fillColor(TEXT_DARK);
                drawMixedText("ช่องทางชำระเงิน PAYMENT METHOD 付款方式", labelX, currentY);


                const checkboxY = currentY + 3;
                const drawCheckbox = (x: number, label: string, checked: boolean = false) => {
                    doc.rect(x, checkboxY, 10, 10).stroke(TEXT_DARK);
                    if (checked) {
                        doc.moveTo(x + 2, checkboxY + 2).lineTo(x + 8, checkboxY + 8).lineWidth(1).stroke(TEXT_DARK);
                        doc.moveTo(x + 8, checkboxY + 2).lineTo(x + 2, checkboxY + 8).lineWidth(1).stroke(TEXT_DARK);
                    }
                    drawMixedText(label, x + 15, checkboxY + 1, { size: 7 });
                    return x + 95;
                };

                let nextX = valueX + 60;
                nextX = drawCheckbox(nextX - 10, "Bank Transfer 转账", true);
                nextX = drawCheckbox(nextX - 10, "CHQUE 支票", false);
                nextX = drawCheckbox(nextX - 10, "CASH เงินสด 现金", false);
                drawCheckbox(nextX - 10, "CASHIER CHQUE 现金支票", false);

                currentY += 20;
                // ========== TABLE ==========
                const tableY = currentY;
                // Columns: ITEM | DESCRIPTION | CONTAINER NO | INVOICE | Amount | Net Amount
                // Adjusted Description width to 215 to fill contentWidth (545)
                // Columns: ITEM | BILLING NOTE NO | INVOICE NO | Amount | Net Amount
                // Replaced Description with Billing Note No.
                // Split Ref No into Invoice No.
                // New Widths: [30, 100, 255, 80, 80] = 545
                const colWidths = [30, 100, 255, 80, 80];
                const colX = [margin];
                for (let i = 1; i < colWidths.length; i++) {
                    colX.push(colX[i - 1] + colWidths[i - 1]);
                }
                const tableWidth = colWidths.reduce((a, b) => a + b, 0);

                // Header
                const drawTableHeader = (y: number) => {
                    doc.rect(margin, y, tableWidth, 25).fillAndStroke("#e5e7eb", BORDER_COLOR);
                    doc.fillColor(TEXT_DARK).fontSize(7);

                    const headers = [
                        { th: "ITEM", en: "项目", align: "center" },
                        { th: "BILLING NOTE NO.", en: "账单号", align: "center" },
                        { th: "INVOICE NO.", en: "发票号", align: "center" },
                        { th: "Amount", en: "金额(THB)", align: "center" },
                        { th: "Net Amount", en: "金额(THB)", align: "center" }
                    ];

                    headers.forEach((h, i) => {
                        const x = colX[i] + 2;
                        doc.text(h.th, x, y + 4, { width: colWidths[i] - 4, align: h.align as any });
                        if (h.en) {
                            const isChinese = /[\u4e00-\u9fa5]/.test(h.en);
                            if (isChinese) doc.font("NotoSansSC");
                            doc.text(h.en, x, y + 14, { width: colWidths[i] - 4, align: h.align as any });
                            if (isChinese) doc.font("Sarabun");
                        }
                    });
                };

                drawTableHeader(currentY);
                currentY += 25;

                // Rows
                let rowIndex = 1;
                // Default base height, but will be dynamic
                const baseRowHeight = 16;

                const drawVerticalLines = (endY: number) => {
                    colX.forEach((x, i) => {
                        if (i > 0) doc.moveTo(x, tableY).lineTo(x, endY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                    });
                    doc.moveTo(margin, tableY).lineTo(margin, endY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                    doc.moveTo(margin + tableWidth, tableY).lineTo(margin + tableWidth, endY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                };

                for (const bn of voucher.billingNotes) {
                    const jobs = bn.jobs || [];
                    const invoices = Array.from(new Set(jobs.map(j => j.refInvoiceNo).filter(Boolean))).join(", ");

                    const billNo = bn.billingRef || "-";
                    const invoiceText = invoices || "-";

                    // CALCULATE DYNAMIC HEIGHT
                    doc.fontSize(8);
                    // Measure Invoice Text height
                    const invHeight = doc.heightOfString(invoiceText, { width: colWidths[2] - 4 });

                    // Add some padding (top 4 + bottom 4)
                    const rowHeight = Math.max(baseRowHeight, invHeight + 8);

                    // Trigger page break if not enough space for Row + Summary + Footer
                    if (currentY + rowHeight > pageHeight - 300) {
                        drawVerticalLines(currentY);
                        doc.moveTo(margin, currentY).lineTo(margin + tableWidth, currentY).stroke(BORDER_COLOR);
                        doc.addPage();
                        currentY = marginTop;
                        drawTableHeader(currentY);
                        currentY += 25;
                    }

                    doc.fillColor(TEXT_GRAY).fontSize(8);
                    const py = currentY + 4;

                    doc.text(String(rowIndex), colX[0], py, { width: colWidths[0], align: "center" });
                    doc.text(billNo, colX[1] + 2, py, { width: colWidths[1] - 4, align: "left" });
                    doc.text(invoiceText, colX[2] + 2, py, { width: colWidths[2] - 4, align: "left" });

                    doc.text(Number(bn.subtotal).toLocaleString("th-TH", { minimumFractionDigits: 2 }), colX[3], py, { width: colWidths[3] - 2, align: "right" });

                    doc.text(Number(bn.netTotal).toLocaleString("th-TH", { minimumFractionDigits: 2 }), colX[4], py, { width: colWidths[4] - 2, align: "right" });

                    doc.moveTo(margin, currentY + rowHeight).lineTo(margin + tableWidth, currentY + rowHeight).lineWidth(0.2).dash(1, { space: 2 }).stroke(ROW_BORDER_COLOR).undash();
                    currentY += rowHeight;
                    rowIndex++;
                }

                // Fill rows
                // Fill rows to bottom
                // Reserve space for Summary (approx 120) + 2 Rows of Signatures (140) + Padding
                const tableBottomLimit = pageHeight - 300;
                while (currentY < tableBottomLimit) {
                    doc.moveTo(margin, currentY + baseRowHeight).lineTo(margin + tableWidth, currentY + baseRowHeight).lineWidth(0.2).dash(1, { space: 2 }).stroke(ROW_BORDER_COLOR).undash();
                    currentY += baseRowHeight;
                    rowIndex++;
                }

                drawVerticalLines(currentY);
                doc.moveTo(margin, currentY).lineTo(margin + tableWidth, currentY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);

                // ========== TOTALS & SUMMARY ==========
                const totalY = currentY;
                doc.fontSize(8).fillColor(TEXT_DARK);
                doc.text("TOTAL", margin + 150, totalY + 5, { align: "center", width: 100 });

                doc.fillColor(TEXT_GRAY).text(Number(voucher.subtotal).toLocaleString("th-TH", { minimumFractionDigits: 2 }), colX[3], totalY + 5, { align: "right", width: colWidths[3] - 2 });
                doc.fillColor(TEXT_GRAY).text(Number(voucher.netTotal).toLocaleString("th-TH", { minimumFractionDigits: 2 }), colX[4], totalY + 5, { align: "right", width: colWidths[4] - 2 });

                doc.rect(margin, totalY, tableWidth, 20).stroke(BORDER_COLOR);
                // Vertical lines for TOTAL row
                const totalColX1 = colX[3]; // Start of Amount column
                const totalColX2 = colX[4]; // Start of Net Amount column
                doc.moveTo(totalColX1, totalY).lineTo(totalColX1, totalY + 20).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                doc.moveTo(totalColX2, totalY).lineTo(totalColX2, totalY + 20).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                currentY = totalY + 25;

                // Summary Calculation (Right)
                const summaryW = 200;
                const summaryX = pageWidth - margin - summaryW;
                const remarkY = currentY;

                const drawSummaryLine = (label: string, value: string, isBold = false, isGreen = false) => {
                    const size = isBold ? 9 : 8;
                    doc.fontSize(size).fillColor(TEXT_DARK);
                    if (isGreen) doc.fillColor("#166534");
                    if (isGreen) doc.fillColor("#166534");
                    drawMixedText(label, summaryX, currentY, { size, color: isGreen ? "#166534" : TEXT_DARK });
                    doc.fillColor(isGreen ? "#166534" : TEXT_GRAY).text(value, summaryX, currentY, { width: summaryW, align: "right" });
                    currentY += 14;
                };

                drawSummaryLine("TOTAL VALUE BEFORE VAT :", Number(voucher.subtotal).toLocaleString("th-TH", { minimumFractionDigits: 2 }));
                drawSummaryLine("VAT ภาษีมูลค่าเพิ่ม (7%) :", Number(voucher.totalVat).toLocaleString("th-TH", { minimumFractionDigits: 2 }));
                const totalWithVat = Number(voucher.subtotal) + Number(voucher.totalVat);
                drawSummaryLine("TOTAL 总计 :", totalWithVat.toLocaleString("th-TH", { minimumFractionDigits: 2 }));
                drawSummaryLine("WHT 代扣税 (3%) :", Number(voucher.totalWht) > 0 ? `-${Number(voucher.totalWht).toLocaleString("th-TH", { minimumFractionDigits: 2 })}` : "0.00");

                doc.rect(summaryX - 5, currentY - 2, summaryW + 5, 20).fill("#f0fdf4");
                doc.fillColor("#166534");
                drawSummaryLine("NET TOTAL 总计 :", Number(voucher.netTotal).toLocaleString("th-TH", { minimumFractionDigits: 2 }), true, true);

                // Thai Text
                const thaiText = BahtText(Number(voucher.netTotal));
                doc.fontSize(8);
                drawMixedText(thaiText, summaryX, currentY + 8, { width: summaryW, align: "right", color: TEXT_GRAY });

                currentY += 20;

                // Remark Box (Left)
                const remarkHeight = currentY - remarkY; // Exclude padding/Thai text line from box height
                doc.rect(margin, remarkY, pageWidth - margin - summaryW - 15 - margin, remarkHeight).stroke(BORDER_COLOR);
                doc.fillColor(TEXT_DARK).fontSize(8);
                drawMixedText("REMARK 备注", margin + 5, remarkY + 5, { size: 8 });
                doc.text(voucher.remark || "-", margin + 5, remarkY + 20, { width: 300 });

                currentY += 0;

                // ========== SIGNATURES ==========
                // Disable bottom margin to prevent auto-page break
                const oldBottomMargin = doc.page.margins.bottom;
                doc.page.margins.bottom = 0;

                // 2 Rows of 4 boxes. Height 70 each. Total 140.
                const sigBoxH = 70;
                const sigStartY = pageHeight - 170; // Moved up closer to content
                const boxW = (contentWidth) / 4;
                const sigLabels = [
                    // Row 1
                    { en: "PERSON IN CHARGE", cn: "经办人" },
                    { en: "DEPARTMENT IN CHARGE", cn: "部门负责人" },
                    { en: "AUTHORIZED BY (ACCOUNT)", cn: "财务复核人" },
                    { en: "ACCOUNTING IN CHARGE", cn: "财务负责人" },
                    // Row 2
                    { en: "COMPANY IN CHARGE", cn: "公司负责人" },
                    { en: "FINANCIAL IN CHARGE", cn: "资金部负责人" },
                    { en: "CASHIER", cn: "出纳" },
                    { en: "", cn: "" }
                ];

                sigLabels.forEach((l, i) => {
                    const row = Math.floor(i / 4);
                    const col = i % 4;
                    const bx = margin + (col * boxW);
                    const by = sigStartY + (row * sigBoxH);

                    // 1. Draw Header Background (REMOVED as requested)
                    // doc.rect(bx, by, boxW, 15).fill("#e5e7eb");

                    // 2. Draw Main Box Border
                    doc.rect(bx, by, boxW, sigBoxH).lineWidth(TABLE_BORDER_WIDTH).stroke(BOX_BORDER_COLOR);

                    // 3. Draw content
                    doc.moveTo(bx + 10, by + 45).lineTo(bx + boxW - 10, by + 45).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();

                    doc.fontSize(6).fillColor(TEXT_GRAY);
                    let signatureText = "";
                    if (l.en === "PERSON IN CHARGE" && voucher.createdBy) {
                        signatureText = voucher.createdBy.name || "";
                    }
                    if (l.en === "DEPARTMENT IN CHARGE") {
                        signatureText = "Mr. Chalermrit Thongkham";
                    }
                    doc.text("Signature : " + signatureText, bx + 10, by + 50);
                    doc.text("DATE : ", bx + 10, by + 60);

                    doc.fillColor(TEXT_DARK).fontSize(6);
                    if (l.en) doc.text(l.en, bx, by + 3, { width: boxW, align: "center" });
                    if (l.cn) {
                        doc.font("NotoSansSC");
                        doc.text(l.cn, bx, by + 9, { width: boxW, align: "center" });
                        doc.font("Sarabun");
                    }
                });

                // Restore margin
                doc.page.margins.bottom = oldBottomMargin;

                // ========== FOOTER ==========
                const range = doc.bufferedPageRange();
                for (let i = range.start; i < range.start + range.count; i++) {
                    doc.switchToPage(i);
                    const oldBottomMargin = doc.page.margins.bottom;
                    doc.page.margins.bottom = 0;

                    doc.fontSize(6).fillColor(TEXT_GRAY);
                    doc.text(`พิมพ์เมื่อ: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, margin, pageHeight - 15, { align: "left" });
                    doc.text(`หน้า ${i + 1} / ${range.count}`, pageWidth - margin - 100, pageHeight - 15, { width: 100, align: "right" });

                    doc.page.margins.bottom = oldBottomMargin;
                }

                doc.end();

                await new Promise<void>((resolve, reject) => {
                    writeStream.on("finish", resolve);
                    writeStream.on("error", reject);
                });

                // Update voucher with PDF URL
                await prisma.paymentVoucher.update({
                    where: { id: voucher.id },
                    data: { pdfUrl: relativeUrl }
                });

                return { success: true, data: { filename, url: relativeUrl } };
            } catch (error: any) {
                console.error("PDF generation error:", error);
                set.status = 500;
                return { success: false, error: error.message || "Failed to generate PDF" };
            }
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "สร้างไฟล์ PDF ใบสำคัญจ่าย", description: "สร้างไฟล์ PDF ใบสำคัญจ่ายแบบมืออาชีพ" },
        }
    )
    // ============================================
    // PAYMENT VOUCHER PREVIEW (STREAMING)
    // ============================================
    .get(
        "/payment-voucher/:id/preview",
        async ({ params, user, set }) => {
            try {
                const { id } = params;

                // Only ADMIN and USER can access
                if (user?.role !== "ADMIN" && user?.role !== "USER") {
                    set.status = 403;
                    return { success: false, error: "Access denied" };
                }

                const voucher = await prisma.paymentVoucher.findUnique({
                    where: { id },
                    include: {
                        vendor: true,
                        billingNotes: {
                            include: { jobs: true }
                        },
                        createdBy: true
                    }
                });

                if (!voucher) {
                    set.status = 404;
                    return { success: false, error: "Payment voucher not found" };
                }

                const companySettings = await prisma.companySettings.findFirst();

                const margin = 25;
                const marginTop = 15;
                const doc = new PDFDocument({
                    size: "A4",
                    margins: { top: marginTop, bottom: margin, left: margin, right: margin },
                    bufferPages: true
                });
                doc.registerFont("Sarabun", thaiFontPath);
                doc.registerFont("NotoSansSC", chineseFontPath);

                // Set headers for inline preview
                set.headers["Content-Type"] = "application/pdf";
                set.headers["Content-Disposition"] = `inline; filename="preview-payment-voucher.pdf"`;

                const pageWidth = 595.28;
                const pageHeight = 841.89;
                const contentWidth = pageWidth - (margin * 2);

                // --- Font Switching Helper ---
                const drawMixedText = (text: string, x: number, y: number, options: any = {}) => {
                    const parts = text.split(/([\u4e00-\u9fa5]+)/g).filter(Boolean);
                    const fontSizes = options.size || 8;
                    const baseFont = "Sarabun";
                    const cnFont = "NotoSansSC";

                    let startX = x;
                    if (options.align === "center" || options.align === "right") {
                        let totalWidth = 0;
                        parts.forEach(part => {
                            const isChinese = /[\u4e00-\u9fa5]/.test(part);
                            doc.font(isChinese ? cnFont : baseFont).fontSize(fontSizes);
                            totalWidth += doc.widthOfString(part);
                        });
                        if (options.align === "center") startX = x + (options.width - totalWidth) / 2;
                        if (options.align === "right") startX = x + options.width - totalWidth;
                    }

                    let currentX = startX;
                    parts.forEach(part => {
                        const isChinese = /[\u4e00-\u9fa5]/.test(part);
                        doc.font(isChinese ? cnFont : baseFont).fontSize(fontSizes).fillColor(options.color || TEXT_DARK);
                        doc.text(part, currentX, y, { lineBreak: false });
                        currentX += doc.widthOfString(part);
                    });
                    doc.font(baseFont).fontSize(fontSizes);
                };

                // ========== HEADER ==========
                let currentY = marginTop;

                doc.font("Sarabun").fontSize(12).fillColor(TEXT_DARK);
                doc.text(companySettings?.companyName || "ASIA THAI SHIPPING SERVICE CO., LTD", margin, currentY, { width: contentWidth, align: "center" });
                currentY += 14;

                doc.fontSize(8).fillColor(TEXT_GRAY);
                doc.text(companySettings?.companyAddress || "62 SOI SUPAPONG 3, YAK 8, NONG BON SUBDISTRICT, PRAWET DISTRICT, BANGKOK 10250", margin, currentY, { width: contentWidth, align: "center" });
                currentY += 20;

                drawMixedText("ใบสำคัญจ่าย (PAYMENT VOUCHER) 付款申请单", margin, currentY, { width: contentWidth, align: "center", size: 12, color: TEXT_DARK });
                currentY += 30;

                const labelX = margin;
                const valueX = margin + 120;
                const rightLabelX = pageWidth - margin - 180;
                const rightValueX = pageWidth - margin - 80;

                doc.fontSize(8).fillColor(TEXT_DARK);
                drawMixedText("ลูกค้า (The customer) 付款人 :", labelX, currentY);
                doc.fillColor(TEXT_GRAY).text(companySettings?.companyName || "-", valueX, currentY);
                doc.moveTo(valueX, currentY + 10).lineTo(rightLabelX - 10, currentY + 10).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();

                drawMixedText("วันที่เอกสาร (DATE) 日期 :", rightLabelX, currentY);
                doc.fillColor(TEXT_GRAY).text(format(new Date(voucher.voucherDate), "dd/MM/yyyy"), rightValueX, currentY, { align: "right", width: 80 });
                doc.moveTo(rightValueX, currentY + 10).lineTo(pageWidth - margin, currentY + 10).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();
                currentY += 18;

                drawMixedText("จ่ายให้ (Paid To) 收款人 :", labelX, currentY);
                doc.fillColor(TEXT_GRAY).text(voucher.vendor.companyName, valueX, currentY);
                doc.moveTo(valueX, currentY + 10).lineTo(rightLabelX - 10, currentY + 10).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();

                drawMixedText("VOUCHER NO. 单据号 :", rightLabelX, currentY);
                doc.fillColor(TEXT_GRAY).text(voucher.voucherRef, rightValueX, currentY, { align: "right", width: 80 });
                doc.moveTo(rightValueX, currentY + 10).lineTo(pageWidth - margin, currentY + 10).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();
                currentY += 18;

                drawMixedText("เพื่อชำระ (Paid For) 款项用途 :", labelX, currentY);
                const paidForText = "ค่าเดินพิธีการตรวจปล่อยและสำรองใบอนุญาต";
                doc.fillColor(TEXT_GRAY).text(paidForText, valueX, currentY);
                doc.moveTo(valueX, currentY + 10).lineTo(pageWidth - margin, currentY + 10).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();
                currentY += 18;

                const accLabel = "ชื่อบัญชี/เลขบัญชี (Account Name/Account No.) 银行名称/银行账号 :";
                doc.fillColor(TEXT_DARK);
                drawMixedText(accLabel, labelX, currentY);
                const accValueX = margin + 250;
                const bankInfo = `${voucher.vendor.bankName || ""} ${voucher.vendor.bankAccount || ""}`.trim() || "-";

                doc.fillColor(TEXT_GRAY).text(bankInfo, accValueX, currentY);
                doc.moveTo(accValueX, currentY + 10).lineTo(pageWidth - margin, currentY + 10).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();
                currentY += 18;

                doc.fontSize(7).fillColor(TEXT_DARK);
                drawMixedText("ช่องทางชำระเงิน PAYMENT METHOD 付款方式", labelX, currentY);

                const checkboxY = currentY + 3;
                const drawCheckbox = (x: number, label: string, checked: boolean = false) => {
                    doc.rect(x, checkboxY, 10, 10).stroke(TEXT_DARK);
                    if (checked) {
                        doc.moveTo(x + 2, checkboxY + 2).lineTo(x + 8, checkboxY + 8).lineWidth(1).stroke(TEXT_DARK);
                        doc.moveTo(x + 8, checkboxY + 2).lineTo(x + 2, checkboxY + 8).lineWidth(1).stroke(TEXT_DARK);
                    }
                    drawMixedText(label, x + 15, checkboxY + 1, { size: 7 });
                    return x + 95;
                };

                let nextX = valueX + 60;
                nextX = drawCheckbox(nextX - 10, "Bank Transfer 转账", true);
                nextX = drawCheckbox(nextX - 10, "CHQUE 支票", false);
                nextX = drawCheckbox(nextX - 10, "CASH เงินสด 现金", false);
                drawCheckbox(nextX - 10, "CASHIER CHQUE 现金支票", false);

                currentY += 20;

                // ========== TABLE ==========
                const tableY = currentY;
                const colWidths = [30, 100, 255, 80, 80];
                const colX: number[] = [margin];
                for (let i = 1; i < colWidths.length; i++) {
                    colX.push(colX[i - 1] + colWidths[i - 1]);
                }
                const tableWidth = colWidths.reduce((a, b) => a + b, 0);

                const drawTableHeader = (y: number) => {
                    doc.rect(margin, y, tableWidth, 25).fillAndStroke("#e5e7eb", BORDER_COLOR);
                    doc.fillColor(TEXT_DARK).fontSize(7);

                    const headers = [
                        { th: "ITEM", en: "项目", align: "center" },
                        { th: "BILLING NOTE NO.", en: "账单号", align: "center" },
                        { th: "INVOICE NO.", en: "发票号", align: "center" },
                        { th: "Amount", en: "金额(THB)", align: "center" },
                        { th: "Net Amount", en: "金额(THB)", align: "center" }
                    ];

                    headers.forEach((h, i) => {
                        const x = colX[i] + 2;
                        doc.text(h.th, x, y + 4, { width: colWidths[i] - 4, align: h.align as any });
                        if (h.en) {
                            const isChinese = /[\u4e00-\u9fa5]/.test(h.en);
                            if (isChinese) doc.font("NotoSansSC");
                            doc.text(h.en, x, y + 14, { width: colWidths[i] - 4, align: h.align as any });
                            if (isChinese) doc.font("Sarabun");
                        }
                    });
                };

                drawTableHeader(currentY);
                currentY += 25;

                let rowIndex = 1;
                const baseRowHeight = 16;

                const drawVerticalLines = (endY: number) => {
                    colX.forEach((x, i) => {
                        if (i > 0) doc.moveTo(x, tableY).lineTo(x, endY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                    });
                    doc.moveTo(margin, tableY).lineTo(margin, endY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                    doc.moveTo(margin + tableWidth, tableY).lineTo(margin + tableWidth, endY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                };

                for (const bn of voucher.billingNotes) {
                    const jobs = bn.jobs || [];
                    const invoices = Array.from(new Set(jobs.map(j => j.refInvoiceNo).filter(Boolean))).join(", ");

                    const billNo = bn.billingRef || "-";
                    const invoiceText = invoices || "-";

                    doc.fontSize(8);
                    const invHeight = doc.heightOfString(invoiceText, { width: colWidths[2] - 4 });
                    const rowHeight = Math.max(baseRowHeight, invHeight + 8);

                    if (currentY + rowHeight > pageHeight - 300) {
                        drawVerticalLines(currentY);
                        doc.moveTo(margin, currentY).lineTo(margin + tableWidth, currentY).stroke(BORDER_COLOR);
                        doc.addPage();
                        currentY = marginTop;
                        drawTableHeader(currentY);
                        currentY += 25;
                    }

                    doc.fillColor(TEXT_GRAY).fontSize(8);
                    const py = currentY + 4;

                    doc.text(String(rowIndex), colX[0], py, { width: colWidths[0], align: "center" });
                    doc.text(billNo, colX[1] + 2, py, { width: colWidths[1] - 4, align: "left" });
                    doc.text(invoiceText, colX[2] + 2, py, { width: colWidths[2] - 4, align: "left" });
                    doc.text(Number(bn.subtotal).toLocaleString("th-TH", { minimumFractionDigits: 2 }), colX[3], py, { width: colWidths[3] - 2, align: "right" });
                    doc.text(Number(bn.netTotal).toLocaleString("th-TH", { minimumFractionDigits: 2 }), colX[4], py, { width: colWidths[4] - 2, align: "right" });

                    doc.moveTo(margin, currentY + rowHeight).lineTo(margin + tableWidth, currentY + rowHeight).lineWidth(0.2).dash(1, { space: 2 }).stroke(ROW_BORDER_COLOR).undash();
                    currentY += rowHeight;
                    rowIndex++;
                }

                const tableBottomLimit = pageHeight - 300;
                while (currentY < tableBottomLimit) {
                    doc.moveTo(margin, currentY + baseRowHeight).lineTo(margin + tableWidth, currentY + baseRowHeight).lineWidth(0.2).dash(1, { space: 2 }).stroke(ROW_BORDER_COLOR).undash();
                    currentY += baseRowHeight;
                    rowIndex++;
                }

                drawVerticalLines(currentY);
                doc.moveTo(margin, currentY).lineTo(margin + tableWidth, currentY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);

                // ========== TOTALS & SUMMARY ==========
                const totalY = currentY;
                doc.fontSize(8).fillColor(TEXT_DARK);
                doc.text("TOTAL", margin + 150, totalY + 5, { align: "center", width: 100 });

                doc.fillColor(TEXT_GRAY).text(Number(voucher.subtotal).toLocaleString("th-TH", { minimumFractionDigits: 2 }), colX[3], totalY + 5, { align: "right", width: colWidths[3] - 2 });
                doc.fillColor(TEXT_GRAY).text(Number(voucher.netTotal).toLocaleString("th-TH", { minimumFractionDigits: 2 }), colX[4], totalY + 5, { align: "right", width: colWidths[4] - 2 });

                doc.rect(margin, totalY, tableWidth, 20).stroke(BORDER_COLOR);
                const totalColX1 = colX[3];
                const totalColX2 = colX[4];
                doc.moveTo(totalColX1, totalY).lineTo(totalColX1, totalY + 20).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                doc.moveTo(totalColX2, totalY).lineTo(totalColX2, totalY + 20).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                currentY = totalY + 25;

                const summaryW = 200;
                const summaryX = pageWidth - margin - summaryW;
                const remarkY = currentY;

                const drawSummaryLine = (label: string, value: string, isBold = false, isGreen = false) => {
                    const size = isBold ? 9 : 8;
                    doc.fontSize(size).fillColor(TEXT_DARK);
                    if (isGreen) doc.fillColor("#166534");
                    drawMixedText(label, summaryX, currentY, { size, color: isGreen ? "#166534" : TEXT_DARK });
                    doc.fillColor(isGreen ? "#166534" : TEXT_GRAY).text(value, summaryX, currentY, { width: summaryW, align: "right" });
                    currentY += 14;
                };

                drawSummaryLine("TOTAL VALUE BEFORE VAT :", Number(voucher.subtotal).toLocaleString("th-TH", { minimumFractionDigits: 2 }));
                drawSummaryLine("VAT ภาษีมูลค่าเพิ่ม (7%) :", Number(voucher.totalVat).toLocaleString("th-TH", { minimumFractionDigits: 2 }));
                const totalWithVat = Number(voucher.subtotal) + Number(voucher.totalVat);
                drawSummaryLine("TOTAL 总计 :", totalWithVat.toLocaleString("th-TH", { minimumFractionDigits: 2 }));
                drawSummaryLine("WHT 代扣税 (3%) :", Number(voucher.totalWht) > 0 ? `-${Number(voucher.totalWht).toLocaleString("th-TH", { minimumFractionDigits: 2 })}` : "0.00");

                doc.rect(summaryX - 5, currentY - 2, summaryW + 5, 20).fill("#f0fdf4");
                doc.fillColor("#166534");
                drawSummaryLine("NET TOTAL 总计 :", Number(voucher.netTotal).toLocaleString("th-TH", { minimumFractionDigits: 2 }), true, true);

                const thaiText = BahtText(Number(voucher.netTotal));
                doc.fontSize(8);
                drawMixedText(thaiText, summaryX, currentY + 8, { width: summaryW, align: "right", color: TEXT_GRAY });

                currentY += 20;

                const remarkHeight = currentY - remarkY;
                doc.rect(margin, remarkY, pageWidth - margin - summaryW - 15 - margin, remarkHeight).stroke(BORDER_COLOR);
                doc.fillColor(TEXT_DARK).fontSize(8);
                drawMixedText("REMARK 备注", margin + 5, remarkY + 5, { size: 8 });
                doc.text(voucher.remark || "-", margin + 5, remarkY + 20, { width: 300 });

                // ========== SIGNATURES ==========
                const oldBottomMargin = doc.page.margins.bottom;
                doc.page.margins.bottom = 0;

                const sigBoxH = 70;
                const sigStartY = pageHeight - 170;
                const boxW = (contentWidth) / 4;
                const sigLabels = [
                    { en: "PERSON IN CHARGE", cn: "经办人" },
                    { en: "DEPARTMENT IN CHARGE", cn: "部门负责人" },
                    { en: "AUTHORIZED BY (ACCOUNT)", cn: "财务复核人" },
                    { en: "ACCOUNTING IN CHARGE", cn: "财务负责人" },
                    { en: "COMPANY IN CHARGE", cn: "公司负责人" },
                    { en: "FINANCIAL IN CHARGE", cn: "资金部负责人" },
                    { en: "CASHIER", cn: "出纳" },
                    { en: "", cn: "" }
                ];

                sigLabels.forEach((l, i) => {
                    const row = Math.floor(i / 4);
                    const col = i % 4;
                    const bx = margin + (col * boxW);
                    const by = sigStartY + (row * sigBoxH);

                    doc.rect(bx, by, boxW, sigBoxH).lineWidth(TABLE_BORDER_WIDTH).stroke(BOX_BORDER_COLOR);
                    doc.moveTo(bx + 10, by + 45).lineTo(bx + boxW - 10, by + 45).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();

                    doc.fontSize(6).fillColor(TEXT_GRAY);
                    let signatureText = "";
                    if (l.en === "PERSON IN CHARGE" && voucher.createdBy) {
                        signatureText = voucher.createdBy.name || "";
                    }
                    if (l.en === "DEPARTMENT IN CHARGE") {
                        signatureText = "Mr. Chalermrit Thongkham";
                    }
                    doc.text("Signature : " + signatureText, bx + 10, by + 50);
                    doc.text("DATE : ", bx + 10, by + 60);

                    doc.fillColor(TEXT_DARK).fontSize(6);
                    if (l.en) doc.text(l.en, bx, by + 3, { width: boxW, align: "center" });
                    if (l.cn) {
                        doc.font("NotoSansSC");
                        doc.text(l.cn, bx, by + 9, { width: boxW, align: "center" });
                        doc.font("Sarabun");
                    }
                });

                doc.page.margins.bottom = oldBottomMargin;

                // ========== FOOTER ==========
                const range = doc.bufferedPageRange();
                for (let i = range.start; i < range.start + range.count; i++) {
                    doc.switchToPage(i);
                    const oldMargin = doc.page.margins.bottom;
                    doc.page.margins.bottom = 0;

                    doc.fontSize(6).fillColor(TEXT_GRAY);
                    doc.text(`พิมพ์เมื่อ: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, margin, pageHeight - 15, { align: "left" });
                    doc.text(`หน้า ${i + 1} / ${range.count}`, pageWidth - margin - 100, pageHeight - 15, { width: 100, align: "right" });

                    doc.page.margins.bottom = oldMargin;
                }

                doc.end();

                return doc;
            } catch (error: any) {
                console.error("Preview PDF generation error:", error);
                set.status = 500;
                return { success: false, error: error.message || "Failed to generate PDF preview" };
            }
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "Preview Payment Voucher PDF", description: "Stream Payment Voucher PDF for preview" },
        }
    )
    .get(
        "/payment-voucher-detailed/:id",
        async ({ params, user, set }) => {
            try {
                const { id } = params;

                if (user?.role !== "ADMIN" && user?.role !== "USER") {
                    set.status = 403;
                    return { success: false, error: "Access denied" };
                }

                const voucher = await prisma.paymentVoucher.findUnique({
                    where: { id },
                    include: {
                        vendor: true,
                        billingNotes: {
                            include: { jobs: { include: { items: true } } }
                        },
                        createdBy: true
                    }
                });

                if (!voucher) {
                    set.status = 404;
                    return { success: false, error: "Payment voucher not found" };
                }

                const companySettings = await prisma.companySettings.findFirst();
                const sanitizedRef = sanitizeFilename(voucher.voucherRef || voucher.id);
                const filename = `payment-voucher-detailed-${sanitizedRef}-${Date.now()}.pdf`;
                const relativeUrl = `/public/pdfs/${filename}`;
                const filepath = path.join(pdfDir, filename);

                const margin = 25;
                const marginTop = 15;
                const doc = new PDFDocument({
                    size: "A4",
                    margins: { top: marginTop, bottom: margin, left: margin, right: margin },
                    bufferPages: true
                });
                const writeStream = createWriteStream(filepath);
                doc.pipe(writeStream);

                await generateDetailedPaymentVoucherPDF(doc, voucher, companySettings, thaiFontPath, chineseFontPath);

                await new Promise<void>((resolve, reject) => {
                    writeStream.on("finish", resolve);
                    writeStream.on("error", reject);
                });

                return { success: true, data: { filename, url: relativeUrl } };
            } catch (error: any) {
                console.error("Detailed PDF generation error:", error);
                set.status = 500;
                return { success: false, error: error.message || "Failed to generate detailed PDF" };
            }
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "สร้างไฟล์ PDF ใบสำคัญจ่ายแบบละเอียด", description: "สร้างไฟล์ PDF แบบละเอียดพร้อมตารางซ้อนทับ" },
        }
    )
    .get(
        "/payment-voucher-detailed/:id/preview",
        async ({ params, user, set }) => {
            try {
                const { id } = params;

                // 1. Auth & Perms
                if (user?.role !== "ADMIN" && user?.role !== "USER") {
                    set.status = 403;
                    return { success: false, error: "Access denied" };
                }

                // 2. Fetch Data
                const voucher = await prisma.paymentVoucher.findUnique({
                    where: { id },
                    include: {
                        vendor: true,
                        billingNotes: {
                            include: { jobs: { include: { items: true } } }
                        },
                        createdBy: true
                    }
                });

                if (!voucher) {
                    set.status = 404;
                    return { success: false, error: "Payment voucher not found" };
                }

                const companySettings = await prisma.companySettings.findFirst();

                // 3. Generate PDF to Stream
                const margin = 25;
                const marginTop = 15;
                const doc = new PDFDocument({
                    size: "A4",
                    margins: { top: marginTop, bottom: margin, left: margin, right: margin },
                    bufferPages: true
                });

                set.headers["Content-Type"] = "application/pdf";
                set.headers["Content-Disposition"] = "inline; filename=\"preview.pdf\"";

                generateDetailedPaymentVoucherPDF(doc, voucher, companySettings, thaiFontPath, chineseFontPath);

                return doc;

            } catch (error: any) {
                console.error("Preview PDF generation error:", error);
                set.status = 500;
                return { success: false, error: error.message || "Failed to generate PDF preview" };
            }
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "Preview PDF Payment Voucher", description: "Stream PDF for preview" },
        }
    )
    // ============================================
    // CASH ADVANCE PDF PREVIEW
    // Cash Advance Billing Preview
    .get(
        "/cash-advance-billing/:id/preview",
        async ({ params, user, set }) => {
            try {
                const { id } = params;

                // Vendors can only access their own billings
                const where: any = { id };
                const roleName = typeof user?.role === "string" ? user.role : (user?.role as any)?.name;
                if (roleName === "VENDOR") {
                    if (!user?.vendorId) {
                        set.status = 403;
                        return { success: false, error: "Vendor ID required" };
                    }
                    where.vendorId = user.vendorId;
                }

                const billing = await prisma.cashAdvanceBilling.findFirst({
                    where,
                    include: {
                        items: true,
                        vendor: true,
                        payment: true
                    }
                });

                if (!billing) {
                    set.status = 404;
                    return { success: false, error: "Billing not found" };
                }

                const companySettings = await prisma.companySettings.findFirst();

                const doc = new PDFDocument({
                    size: "A4",
                    margins: { top: 15, bottom: 25, left: 25, right: 25 },
                    bufferPages: true
                });

                set.headers["Content-Type"] = "application/pdf";
                set.headers["Content-Disposition"] = "inline; filename=\"cash-advance-preview.pdf\"";

                await generateCashAdvanceBillingPDF(doc, billing, companySettings, thaiFontPath);

                return doc;

                return doc;

            } catch (error: any) {
                console.error("Cash Advance PDF generation error:", error);
                set.status = 500;
                return { success: false, error: error.message || "Failed to generate PDF preview" };
            }
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "Preview Cash Advance PDF", description: "Stream Cash Advance PDF for preview" },
        }
    )
    // Cash Advance Payment Voucher Preview
    .get(
        "/cash-advance-payment/:id/preview",
        async ({ params, user, set }) => {
            try {
                const { id } = params;

                // Only ADMIN/USER can see payment voucher (usually)
                // But VENDOR might need to see it too if they want to print?
                // For now, let's allow VENDOR to see their own if needed, but initially Admin focus.
                const where: any = { id };
                const roleName = typeof user?.role === "string" ? user.role : (user?.role as any)?.name;

                if (roleName === "VENDOR") {
                    // Check ownership via billing
                    const billing = await prisma.cashAdvanceBilling.findUnique({
                        where: { id },
                        include: { payment: true }
                    });
                    if (!billing || billing.vendorId !== user?.vendorId) {
                        set.status = 403;
                        return { success: false, error: "Access denied" };
                    }
                }

                const billing = await prisma.cashAdvanceBilling.findUnique({
                    where,
                    include: {
                        items: true,
                        vendor: true,
                        payment: true
                    }
                });

                if (!billing) {
                    set.status = 404;
                    return { success: false, error: "Billing not found" };
                }

                if (!billing.payment) {
                    set.status = 404;
                    return { success: false, error: "Payment not found" };
                }

                const companySettings = await prisma.companySettings.findFirst();

                const doc = new PDFDocument({
                    size: "A4",
                    margins: { top: 15, bottom: 25, left: 25, right: 25 },
                    bufferPages: true
                });

                set.headers["Content-Type"] = "application/pdf";
                set.headers["Content-Disposition"] = "inline; filename=\"cash-advance-payment-voucher.pdf\"";

                await generateCashAdvancePaymentVoucherPDF(doc, billing, companySettings, thaiFontPath, chineseFontPath);

                return doc;

            } catch (error: any) {
                console.error("Cash Advance PV PDF generation error:", error);
                set.status = 500;
                return { success: false, error: error.message || "Failed to generate PDF preview" };
            }
        },
        {
            params: t.Object({ id: t.String() }),
            detail: { summary: "Preview Cash Advance Payment Voucher", description: "Stream Payment Voucher PDF" },
        }
    );
