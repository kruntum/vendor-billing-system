import { Elysia, t } from "elysia";
import PDFDocument from "pdfkit";
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from "fs";
import path from "path";
import { requireAuth } from "../plugins/auth.plugin";
import { prisma } from "../lib/prisma";
import { format } from "date-fns";
import { BahtText } from "../lib/bahttext";

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

                const pageWidth = 595.28;
                const pageHeight = 841.89;
                const contentWidth = pageWidth - (margin * 2);

                // ปรับความกว้างคอลัมน์สำหรับเนื้อหาที่กว้างขึ้น (รวม ~545)
                // ใหม่: [30, 45, 180, 145, 80, 50] = 545
                // กำหนดความกว้างและตำแหน่งของคอลัมน์ (รวม ~545)
                const colW = [30, 45, 185, 145, 80, 60];
                const colX = [
                    margin,
                    margin + colW[0],
                    margin + colW[0] + colW[1],
                    margin + colW[0] + colW[1] + colW[2],
                    margin + colW[0] + colW[1] + colW[2] + colW[3],
                    margin + colW[0] + colW[1] + colW[2] + colW[3] + colW[4]
                ];

                // หัวข้อตาราง 2 ภาษา (ไทย/อังกฤษ)
                const headers = [
                    { th: "#", en: "" },
                    { th: "วันที่", en: "Date" },
                    { th: "รายละเอียด", en: "Description" },
                    { th: "เบอร์ตู้/ทะเบียนรถ", en: "Container / License Plate" },
                    { th: "เลขที่อ้างอิง", en: "Ref No." },
                    { th: "จำนวนเงิน", en: "Amount" }
                ];
                const cellPadding = 5;

                // กำหนดตำแหน่งขอบล่างของตาราง (Fixed Table Bottom)
                // Adjusted to fit ~20 items (pageHeight - 270)
                // ปรับให้พอดีกับประมาณ 20 รายการ (pageHeight - 270)
                const fixedTableBottomY = pageHeight - 280;

                // ฟังก์ชันวาดส่วนหัวกระดาษ (Header) และคืนค่าตำแหน่งแกน Y ที่พร้อมเขียนเนื้อหาต่อ
                const drawHeader = () => {
                    // ========== แถวที่ 1: ข้อมูลบริษัท (ซ้าย) & หัวข้อ (ขวา) ==========
                    const row1Y = marginTop;

                    // ซ้าย: ข้อมูลบริษัท
                    doc.font("Sarabun").fontSize(14).fillColor(COMPANY_NAME_COLOR);
                    doc.text(billing.vendor.companyName || "Company Name", margin, row1Y);

                    doc.fontSize(9).fillColor(TEXT_GRAY);
                    let leftY = row1Y + 20;
                    if (billing.vendor.companyAddress) {
                        doc.text(billing.vendor.companyAddress, margin, leftY, { width: 300 });
                        leftY = doc.y;
                    }
                    doc.text(`เลขประจำตัวผู้เสียภาษี: ${billing.vendor.taxId || "-"}`, margin, leftY);
                    leftY = doc.y;

                    // ขวา: หัวข้อ (ใบวางบิล)
                    const titleW = 200;
                    const titleX = pageWidth - margin - titleW;

                    doc.fontSize(18).fillColor(PRIMARY_COLOR);
                    doc.text("ใบวางบิล", titleX, row1Y, { width: titleW, align: "center" });
                    doc.fontSize(10);
                    doc.text("Billing Note", titleX, row1Y + 25, { width: titleW, align: "center" });

                    // ========== แถวที่ 2: กล่องลูกค้า (ซ้าย) & กล่องข้อมูลเอกสาร (ขวา) ==========
                    const row2Y = Math.max(leftY + 15, row1Y + 50);
                    const gap = 10;
                    const rightBoxW = 200;
                    const leftBoxW = contentWidth - rightBoxW - gap;
                    const leftBoxX = margin;
                    const rightBoxX = margin + leftBoxW + gap;

                    // --- 1. คำนวณความสูงของกล่อง (Calculate Box Heights) ---
                    const padding = 10;

                    // คำนวณความสูงกล่องซ้าย (ลูกค้า)
                    let calcLeftH = padding; // เริ่มต้น padding บน
                    calcLeftH += 18; // หัวข้อ "ลูกค้า / Customer"

                    doc.fontSize(10); // ตั้งค่าฟอนต์สำหรับการคำนวณ
                    if (companySettings) {
                        calcLeftH += 14; // ชื่อบริษัท
                        if (companySettings.companyAddress) {
                            const addrH = doc.heightOfString(companySettings.companyAddress, { width: leftBoxW - (padding * 2) });
                            calcLeftH += addrH + 4; // ที่อยู่ + เว้นบรรทัด
                        }
                        calcLeftH += 14; // เลขผู้เสียภาษี
                    } else {
                        calcLeftH += 14; // กรณีไม่มีข้อมูล
                    }
                    const leftBoxH = calcLeftH + 5; // บวก padding ล่างนิดหน่อย (+5 ตาม Code เดิม)

                    // คำนวณความสูงกล่องขวา (เอกสาร)
                    // Original: padding + 16(No) + 16(Date) + 5(Extra)
                    const rightBoxH = padding + 16 + 16 + 5;

                    const finalBoxH = Math.max(leftBoxH, rightBoxH);

                    // --- 2. วาดกล่องพื้นหลังก่อน (Draw Background Boxes First) ---
                    doc.roundedRect(leftBoxX, row2Y, leftBoxW, finalBoxH, 5).stroke(BOX_BORDER_COLOR);
                    doc.roundedRect(rightBoxX, row2Y, rightBoxW, finalBoxH, 5).stroke(BOX_BORDER_COLOR);

                    // --- 3. วาดข้อความทับลงไป (Draw Text Content) ---

                    // --- Left Box Content ---
                    let custContentY = row2Y + padding;
                    const custTextW = leftBoxW - (padding * 2); // Width constraint for text
                    doc.fontSize(10).fillColor(PRIMARY_COLOR);
                    doc.text("ลูกค้า / Customer", leftBoxX + padding, custContentY);
                    custContentY += 16;

                    doc.fontSize(9).fillColor(TEXT_GRAY);
                    if (companySettings) {
                        doc.text(companySettings.companyName || "-", leftBoxX + padding, custContentY, { width: custTextW });
                        custContentY += 13;
                        if (companySettings.companyAddress) {
                            doc.text(companySettings.companyAddress, leftBoxX + padding, custContentY, { width: custTextW });
                            custContentY = doc.y + 3;
                        }
                        doc.fontSize(8).fillColor(TEXT_GRAY);
                        doc.text(`เลขประจำตัวผู้เสียภาษี: ${companySettings.taxId || "-"}`, leftBoxX + padding, custContentY, { width: custTextW });
                        // custContentY += 14; // ไม่ต้องบวกต่อแล้วสำหรับการวาดจริง แต่ Code เดิมบวกไว้เพื่อนับความสูง
                    } else {
                        doc.text("(ยังไม่ได้ตั้งค่าข้อมูลบริษัท)", leftBoxX + padding, custContentY);
                    }

                    // --- Right Box Content ---
                    let docContentY = row2Y + padding;

                    const labelX = rightBoxX + padding;
                    const valueX = rightBoxX + 60;
                    const valueW = rightBoxW - 60 - padding;

                    doc.fontSize(9).fillColor(PRIMARY_COLOR);
                    doc.text("เลขที่ / No:", labelX, docContentY);
                    doc.fontSize(9).fillColor(TEXT_GRAY);
                    doc.text(billing.billingRef || "-", valueX, docContentY, { width: valueW, align: "right" });
                    docContentY += 16;

                    doc.fontSize(9).fillColor(PRIMARY_COLOR);
                    doc.text("วันที่ / Date:", labelX, docContentY);
                    doc.fontSize(9).fillColor(TEXT_GRAY);
                    doc.text(format(new Date(billing.billingDate), "dd/MM/yyyy"), valueX, docContentY, { width: valueW, align: "right" });
                    // docContentY += 16;

                    // ========== ส่วนหัวตาราง ==========
                    const tableY = row2Y + finalBoxH + 15;
                    const headerHeight = 35; // เพิ่มความสูงสำหรับ 2 บรรทัด

                    // พื้นหลังและเส้นขอบหัวตาราง
                    doc.rect(margin, tableY, contentWidth, headerHeight).fillAndStroke(BOX_BACKGROUND_COLOR, BORDER_COLOR);

                    // วาดเส้นแนวตั้งยาวลงไปจนถึง fixedTableBottomY เลย
                    const startVertY = tableY + headerHeight;
                    colX.forEach((x, i) => {
                        if (i > 0) {
                            doc.moveTo(x, tableY).lineTo(x, fixedTableBottomY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                        }
                    });
                    // ขอบซ้ายขวา
                    doc.moveTo(margin, tableY).lineTo(margin, fixedTableBottomY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                    doc.moveTo(margin + contentWidth, tableY).lineTo(margin + contentWidth, fixedTableBottomY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);

                    // ลบแล้ว: การวาดเส้นขอบล่างแบบคงที่ (จะวาดแบบไดนามิกแทน)


                    doc.font("Sarabun");
                    headers.forEach((h, i) => {
                        // Center align for ALL headers
                        const align = "center";
                        const cellY = tableY + 5;

                        // Thai Line
                        doc.fontSize(9).fillColor(TEXT_DARK).text(h.th, colX[i] + 2, cellY, { width: colW[i] - 4, align });

                        // English Line
                        if (h.en) {
                            doc.fontSize(8).fillColor(TEXT_GRAY).text(h.en, colX[i] + 2, cellY + 12, { width: colW[i] - 4, align });
                        }
                    });

                    // เริ่มวาดตาราง
                    return tableY + headerHeight;
                };

                // เรียกใช้วาดส่วนหัวครั้งแรก
                let rowY = drawHeader();
                doc.fontSize(8);

                // (fixedTableBottomY moved to top)

                const fullPageBottom = pageHeight - margin - 30;
                let isExtended = false;

                // วนลูปวาดรายการงาน (Jobs)
                billing.jobs.forEach((job, index) => {
                    const amt = job.items.reduce((s, it) => s + Number(it.amount), 0);

                    // รวมข้อมูลตู้คอนเทนเนอร์และทะเบียนรถ
                    const parts = [];
                    if (job.containerNo) parts.push(job.containerNo);
                    if (job.truckPlate) parts.push(job.truckPlate);
                    const itemsInfo = parts.join(" / ");

                    const rowHeight = 18;

                    // 1. ตรวจสอบการขยาย: หากเกินพื้นที่ส่วนท้ายที่กำหนด
                    if (rowY + rowHeight > fixedTableBottomY && !isExtended) {
                        // ลากเส้นแนวตั้งยาวลงไปจนสุดขอบล่างของหน้ากระดาษสำหรับหน้าระหว่างทางนี้
                        colX.forEach((x, i) => {
                            if (i > 0) doc.moveTo(x, fixedTableBottomY).lineTo(x, fullPageBottom).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                        });
                        doc.moveTo(margin, fixedTableBottomY).lineTo(margin, fullPageBottom).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                        doc.moveTo(margin + contentWidth, fixedTableBottomY).lineTo(margin + contentWidth, fullPageBottom).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                        isExtended = true;
                    }

                    // 2. ตรวจสอบการขึ้นหน้าใหม่: หากถึงขอบล่างของหน้ากระดาษ
                    if (rowY + rowHeight > fullPageBottom) {
                        // ปิดหน้าปัจจุบัน
                        doc.moveTo(margin, fullPageBottom).lineTo(margin + contentWidth, fullPageBottom).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                        doc.addPage();
                        doc.font("Sarabun");
                        rowY = drawHeader();
                        doc.fontSize(8);
                        isExtended = false; // รีเซ็ตสถานะสำหรับหน้าใหม่
                    }

                    // เส้นขอบล่าง (เส้นประ) สำหรับแต่ละแถว
                    doc.moveTo(margin, rowY + rowHeight).lineTo(margin + contentWidth, rowY + rowHeight)
                        .lineWidth(TABLE_BORDER_WIDTH).dash(2, { space: 2 }).stroke(ROW_BORDER_COLOR).undash();

                    // NOTE: เราจะไม่วาดเส้นแนวตั้ง (Vertical Lines) ในลูปแล้ว จะวาดทีเดียวตอนจบ เพื่อให้เส้นยาวลงไปสุดตาราง

                    doc.fillColor(TEXT_GRAY);
                    doc.text(String(index + 1), colX[0] + cellPadding, rowY + 6, { width: colW[0] - (cellPadding * 2), align: "center" });
                    doc.text(format(new Date(job.clearanceDate), "dd/MM/yy"), colX[1] + cellPadding, rowY + 6, { width: colW[1] - (cellPadding * 2) });
                    doc.text(job.description || "-", colX[2] + cellPadding, rowY + 6, { width: colW[2] - (cellPadding * 2) });
                    doc.text(itemsInfo || "-", colX[3] + cellPadding, rowY + 6, { width: colW[3] - (cellPadding * 2) });
                    doc.text(job.refInvoiceNo || "-", colX[4] + cellPadding, rowY + 6, { width: colW[4] - (cellPadding * 2) });
                    doc.text(amt.toLocaleString("th-TH", { minimumFractionDigits: 2 }), colX[5] + cellPadding, rowY + 6, { width: colW[5] - (cellPadding * 2), align: "right" });

                    rowY += rowHeight;
                });

                // --- จบลูป ---
                // จัดการกรณีเนื้อหาเกินส่วนท้ายและปิดตาราง
                if (rowY > fixedTableBottomY) {
                    // เนื้อหาเกินพื้นที่ส่วนท้าย
                    // ตรวจสอบว่าได้ลากเส้นขยายลงมาหรือยัง (เช่น กรณีเกินพื้นที่มาเล็กน้อย)
                    if (!isExtended) {
                        colX.forEach((x, i) => { if (i > 0) doc.moveTo(x, fixedTableBottomY).lineTo(x, fullPageBottom).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR); });
                        doc.moveTo(margin, fixedTableBottomY).lineTo(margin, fullPageBottom).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                        doc.moveTo(margin + contentWidth, fixedTableBottomY).lineTo(margin + contentWidth, fullPageBottom).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                    }
                    // ปิดหน้านี้ให้สมบูรณ์
                    doc.moveTo(margin, fullPageBottom).lineTo(margin + contentWidth, fullPageBottom).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);

                    // เพิ่มหน้าใหม่สำหรับส่วนท้าย
                    doc.addPage();
                    rowY = drawHeader();
                }

                // ปิดกรอบตารางที่ fixedTableBottomY (การจบแบบปกติ)
                doc.moveTo(margin, fixedTableBottomY).lineTo(margin + contentWidth, fixedTableBottomY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);

                // พื้นที่เริ่มจากใต้ตาราง (Fixed Bottom)
                const footerY = fixedTableBottomY + 10;
                // const splitX = (colX[3] + colX[4]) / 2; // ใช้แนวเดียวกับเลขที่อ้างอิงเป็นจุดแบ่ง (ประมาณ 50/50)
                const splitX = 300;

                // --- LEFT: Payment Info ---
                const paymentW = splitX - margin - 10; // เว้นระยะ 10
                const paymentH = 110;

                // Background Box
                doc.roundedRect(margin, footerY, paymentW, paymentH, 5).stroke(BORDER_COLOR);

                doc.fillColor(PRIMARY_COLOR).fontSize(9);
                doc.text("ข้อมูลการชำระเงิน", margin + 10, footerY + 10);

                const paymentTextW = paymentW - 20; // Add width constraint
                doc.fillColor(TEXT_GRAY).fontSize(8);
                doc.text(`ธนาคาร: ${billing.vendor.bankName || "-"}`, margin + 10, footerY + 28, { width: paymentTextW });
                doc.text(`สาขา: ${billing.vendor.bankBranch || "-"}`, margin + 10, footerY + 42, { width: paymentTextW });
                doc.text(`เลขที่บัญชี: ${billing.vendor.bankAccount || "-"}`, margin + 10, footerY + 56, { width: paymentTextW });
                doc.text(`ชื่อบัญชี: ${billing.vendor.companyName || "-"}`, margin + 10, footerY + 70, { width: paymentTextW });

                // Show Remark here if exists
                if (billing.remark) {
                    doc.fillColor(PRIMARY_COLOR).fontSize(8);
                    doc.text("หมายเหตุ: " + billing.remark, margin + 10, footerY + 88, { width: paymentTextW });
                }

                // --- RIGHT: Summary ---
                // ใช้พื้นที่จาก splitX ไปจนสุดขอบขวา
                const rightColX = splitX + 10; // ขยับเข้ามานิดนึง
                const rightColW = (margin + contentWidth) - rightColX;
                let sY = footerY;

                doc.fontSize(9).fillColor(TEXT_GRAY);

                const drawSummaryRow = (label: string, value: string, isBold: boolean = false) => {
                    const y = sY;
                    doc.fillColor(TEXT_GRAY);
                    if (isBold) doc.font("Sarabun-Bold").fontSize(11).fillColor("#166534");
                    else doc.font("Sarabun").fontSize(9);

                    doc.text(label, rightColX, y);
                    doc.text(value, rightColX, y, { width: rightColW, align: "right" });

                    if (isBold) doc.font("Sarabun").fontSize(9); // Reset
                    sY += 20;
                };

                // รวมเป็นเงิน
                drawSummaryRow("รวมเป็นเงิน:", `${Number(billing.subtotal).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`);

                // มูลค่าก่อนภาษีมูลค่าเพิ่ม
                if (billing.priceBeforeVat) {
                    drawSummaryRow("มูลค่าก่อนภาษีมูลค่าเพิ่ม:", `${Number(billing.priceBeforeVat).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`);
                }

                // ภาษีมูลค่าเพิ่ม
                const vatRate = billing.vatRateText || "7";
                drawSummaryRow(`ภาษีมูลค่าเพิ่ม ${vatRate}%:`, `${Number(billing.vatAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`);

                // หัก ณ ที่จ่าย
                const whtRate = billing.whtRateText || "3";
                drawSummaryRow(`หัก ณ ที่จ่าย ${whtRate}%:`, `-${Number(billing.whtAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`);

                // เส้นขีดคั่น
                sY -= 5;
                doc.moveTo(rightColX, sY).lineTo(margin + contentWidth, sY).lineWidth(0.5).stroke(BORDER_COLOR);
                sY += 8;

                // ยอดสุทธิพร้อมพื้นหลัง
                // วาดพื้นหลังก่อน
                doc.roundedRect(rightColX - 5, sY - 5, rightColW + 5, 17, 5).fill("#f0fdf4");
                doc.fillColor("#166534"); // Green text works better on light green bg

                // วางตำแหน่งข้อความเองเพื่อทำตัวหนาโดยไม่ต้องใช้ helper
                doc.fontSize(11).text("ยอดสุทธิ:", rightColX, sY - 5);
                doc.text(`${Number(billing.netTotal).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`, rightColX, sY - 5, { width: rightColW, align: "right" });

                // เพิ่มคำอ่านภาษาไทย (เช่น หนึ่งร้อยบาทถ้วน)
                const thaiText = BahtText(Number(billing.netTotal));
                doc.fontSize(9).fillColor(TEXT_GRAY);
                doc.text(thaiText, rightColX, sY + 17, { width: rightColW, align: "right" });

                // ========== ส่วนลงลายมือชื่อ (SIGNATURE SECTION) ==========
                const sigY = pageHeight - 140;
                const sigWidth = 180;

                // ลายเซ็นฝั่งซ้าย (ผู้วางบิล)
                doc.fontSize(7).fillColor(TEXT_GRAY);
                doc.text("ในนาม " + (billing.vendor.companyName || ""), margin, sigY, { width: sigWidth, align: "center" });
                // doc.text("", margin, sigY + 45, { width: sigWidth, align: "center" });
                doc.moveTo(margin, sigY + 55).lineTo(margin + sigWidth, sigY + 55).stroke(BORDER_COLOR);
                doc.fontSize(8);
                doc.text("ผู้วางบิล", margin, sigY + 60, { width: sigWidth, align: "center" });
                doc.fontSize(7);
                doc.text("วันที่ ______/______/______", margin, sigY + 73, { width: sigWidth, align: "center" });

                // ลายเซ็นฝั่งขวา (ผู้รับวางบิล - ลูกค้า)
                const rightSigX = pageWidth - margin - sigWidth;
                doc.fontSize(7);
                doc.text("ในนาม " + (companySettings?.companyName || "บริษัท"), rightSigX, sigY, { width: sigWidth, align: "center" });
                // doc.text("", rightSigX, sigY + 45, { width: sigWidth, align: "center" });
                doc.moveTo(rightSigX, sigY + 55).lineTo(rightSigX + sigWidth, sigY + 55).stroke(BORDER_COLOR);
                doc.fontSize(8);
                doc.text("ผู้รับวางบิล", rightSigX, sigY + 60, { width: sigWidth, align: "center" });
                doc.fontSize(7);
                doc.text("วันที่ ______/______/______", rightSigX, sigY + 73, { width: sigWidth, align: "center" });

                // ========== ส่วนท้ายกระดาษรวม (เลขหน้า & วันที่) ==========
                const range = doc.bufferedPageRange();
                for (let i = range.start; i < range.start + range.count; i++) {
                    doc.switchToPage(i);

                    // Temporarily disable bottom margin to prevent auto-page-add
                    const oldBottomMargin = doc.page.margins.bottom;
                    doc.page.margins.bottom = 0;

                    doc.fontSize(6).fillColor(TEXT_GRAY);

                    // ล่างซ้าย: วันที่พิมพ์
                    doc.text(
                        `พิมพ์เมื่อ: ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
                        margin,
                        pageHeight - 20,
                        { align: "left" }
                    );

                    // ล่างขวา: เลขหน้า
                    doc.text(
                        `หน้า ${i + 1} / ${range.count}`,
                        pageWidth - margin - 100,
                        pageHeight - 20,
                        { width: 100, align: "right" }
                    );

                    // คืนค่าระยะขอบล่าง
                    doc.page.margins.bottom = oldBottomMargin;
                }

                doc.end();

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
                        vendor: true
                    },
                });

                if (!receipt) {
                    set.status = 404;
                    return { success: false, error: "Receipt not found" };
                }

                const billing = receipt.billingNote;

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

                const pageWidth = 595.28;
                const pageHeight = 841.89;
                const contentWidth = pageWidth - (margin * 2);

                // Adjusted column widths for wider content (Total ~545)
                // New: [30, 45, 180, 125, 80, 85] = 545
                const colW = [30, 45, 185, 145, 80, 60];
                const colX = [
                    margin,
                    margin + colW[0],
                    margin + colW[0] + colW[1],
                    margin + colW[0] + colW[1] + colW[2],
                    margin + colW[0] + colW[1] + colW[2] + colW[3],
                    margin + colW[0] + colW[1] + colW[2] + colW[3] + colW[4]
                ];

                // หัวตารางสองภาษา
                const headers = [
                    { th: "#", en: "" },
                    { th: "วันที่", en: "Date" },
                    { th: "รายละเอียด", en: "Description" },
                    { th: "เบอร์ตู้/ทะเบียนรถ", en: "Container / License Plate" },
                    { th: "เลขที่อ้างอิง", en: "Ref No." },
                    { th: "จำนวนเงิน", en: "Amount" }
                ];
                const cellPadding = 5;

                // กำหนดตำแหน่งขอบล่างของตาราง (Fixed Table Bottom)
                const fixedTableBottomY = pageHeight - 280;

                // ฟังก์ชันวาดส่วนหัวกระดาษและคืนค่าตำแหน่ง Y เริ่มต้นสำหรับเนื้อหา
                const drawHeader = () => {
                    // ========== แถวที่ 1: ข้อมูลบริษัท (ซ้าย) & หัวข้อ (ขวา) ==========
                    const row1Y = marginTop;

                    // ซ้าย: ข้อมูลบริษัท
                    doc.font("Sarabun").fontSize(14).fillColor(PRIMARY_COLOR);
                    doc.text(billing.vendor.companyName || "Company Name", margin, row1Y);

                    doc.fontSize(9).fillColor(TEXT_GRAY);
                    let leftY = row1Y + 20;
                    if (billing.vendor.companyAddress) {
                        doc.text(billing.vendor.companyAddress, margin, leftY, { width: 300 });
                        leftY = doc.y;
                    }
                    doc.text(`เลขประจำตัวผู้เสียภาษี: ${billing.vendor.taxId || "-"}`, margin, leftY);
                    leftY = doc.y;

                    // ขวา: หัวข้อ (ใบเสร็จรับเงิน)
                    const titleW = 200;
                    const titleX = pageWidth - margin - titleW;

                    doc.fontSize(18).fillColor(PRIMARY_COLOR);
                    doc.text("ใบเสร็จรับเงิน", titleX, row1Y, { width: titleW, align: "center" });
                    doc.fontSize(10);
                    doc.text("Receipt", titleX, row1Y + 25, { width: titleW, align: "center" });

                    // ========== ROW 2: Customer Box (Left) & Doc Info Box (Right) ==========
                    const row2Y = Math.max(leftY + 15, row1Y + 50);
                    const gap = 10;
                    const rightBoxW = 200;
                    const leftBoxW = contentWidth - rightBoxW - gap;
                    const leftBoxX = margin;
                    const rightBoxX = margin + leftBoxW + gap;

                    // --- Left Box: Customer Info ---
                    const padding = 10;
                    let custContentY = row2Y + padding;
                    const custTextW = leftBoxW - (padding * 2); // Width constraint

                    doc.fontSize(9).fillColor(PRIMARY_COLOR);
                    doc.text("ลูกค้า / Customer", leftBoxX + padding, custContentY, { width: custTextW });
                    custContentY += 16;

                    doc.fontSize(9).fillColor(TEXT_GRAY);
                    if (companySettings) {
                        doc.text(companySettings.companyName || "-", leftBoxX + padding, custContentY, { width: custTextW });
                        custContentY += 13;
                        if (companySettings.companyAddress) {
                            doc.text(companySettings.companyAddress, leftBoxX + padding, custContentY, { width: custTextW });
                            custContentY = doc.y + 3;
                        }
                        doc.fontSize(8).fillColor(TEXT_GRAY);
                        doc.text(`เลขประจำตัวผู้เสียภาษี: ${companySettings.taxId || "-"}`, leftBoxX + padding, custContentY, { width: custTextW });
                        custContentY += 12;
                    } else {
                        doc.text("(ยังไม่ได้ตั้งค่าข้อมูลบริษัท)", leftBoxX + padding, custContentY, { width: custTextW });
                        custContentY += 12;
                    }

                    const leftBoxH = (custContentY - row2Y) + 5;

                    // --- Right Box: Document Info ---
                    let docContentY = row2Y + padding;


                    const labelX = rightBoxX + padding;
                    const valueX = rightBoxX + 60;
                    const valueW = rightBoxW - 60 - padding;

                    doc.fontSize(10).fillColor(PRIMARY_COLOR);
                    doc.text("เลขที่ / No:", labelX, docContentY);
                    doc.fontSize(10).fillColor(TEXT_GRAY);
                    doc.text(receipt.receiptRef || "-", valueX, docContentY, { width: valueW, align: "right" });
                    docContentY += 16;

                    doc.fontSize(10).fillColor(PRIMARY_COLOR);
                    doc.text("วันที่ / Date:", labelX, docContentY);
                    doc.fontSize(10).fillColor(TEXT_GRAY);
                    doc.text(format(new Date(receipt.receiptDate), "dd/MM/yyyy"), valueX, docContentY, { width: valueW, align: "right" });
                    docContentY += 16;

                    doc.fontSize(10).fillColor(PRIMARY_COLOR);
                    doc.text("วันที่รับเงิน / Receipt Date:", labelX, docContentY);
                    doc.fontSize(10).fillColor(TEXT_GRAY);
                    doc.text(format(new Date(receipt.receiptDate), "dd/MM/yyyy"), valueX, docContentY, { width: valueW, align: "right" });
                    docContentY += 16;

                    // Add Billing Ref reference
                    doc.fontSize(10).fillColor(PRIMARY_COLOR);
                    doc.text("อ้างอิง / Ref:", labelX, docContentY);
                    doc.fontSize(10).fillColor(TEXT_GRAY);
                    doc.text(billing.billingRef || "-", valueX, docContentY, { width: valueW, align: "right" });
                    docContentY += 16;


                    const rightBoxH = (docContentY - row2Y) + 5;
                    const finalBoxH = Math.max(leftBoxH, rightBoxH);

                    // Draw Rounded Boxes
                    doc.roundedRect(leftBoxX, row2Y, leftBoxW, finalBoxH, 5).lineWidth(0.5).stroke(BOX_BORDER_COLOR);
                    doc.roundedRect(rightBoxX, row2Y, rightBoxW, finalBoxH, 5).lineWidth(0.5).stroke(BOX_BORDER_COLOR);

                    // ========== TABLE HEADER ==========
                    const tableY = row2Y + finalBoxH + 15;
                    const headerHeight = 35; // Increased height for two lines

                    // Table header background & border
                    doc.rect(margin, tableY, contentWidth, headerHeight).fillAndStroke(BOX_BACKGROUND_COLOR, BORDER_COLOR);

                    // Vertical lines for header (Solid) -> AND BODY (Fixed Height)
                    // วาดเส้นแนวตั้งยาวลงไปจนถึง fixedTableBottomY เลย
                    const startVertY = tableY + headerHeight;
                    colX.forEach((x, i) => {
                        if (i > 0) {
                            doc.moveTo(x, tableY).lineTo(x, fixedTableBottomY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                        }
                    });
                    // ขอบซ้ายขวา
                    doc.moveTo(margin, tableY).lineTo(margin, fixedTableBottomY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                    doc.moveTo(margin + contentWidth, tableY).lineTo(margin + contentWidth, fixedTableBottomY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);

                    // REMOVED: Fixed Bottom Border drawing (Will be drawn dynamically)

                    doc.font("Sarabun");

                    headers.forEach((h, i) => {
                        // Center align for ALL headers
                        const align = "center";
                        const cellY = tableY + 5;

                        // Thai Line
                        doc.fontSize(9).fillColor(TEXT_DARK).text(h.th, colX[i] + 2, cellY, { width: colW[i] - 4, align });

                        // English Line
                        if (h.en) {
                            doc.fontSize(8).fillColor(TEXT_GRAY).text(h.en, colX[i] + 2, cellY + 12, { width: colW[i] - 4, align });
                        }
                    });

                    return tableY + headerHeight;
                };

                // Initial Header Draw
                let rowY = drawHeader();
                doc.fontSize(8);

                const fullPageBottom = pageHeight - margin;
                let isExtended = false;

                billing.jobs.forEach((job, index) => {
                    const amt = job.items.reduce((s, it) => s + Number(it.amount), 0);

                    // Get container and license plate info from JOB
                    const parts = [];
                    if (job.containerNo) parts.push(job.containerNo);
                    if (job.truckPlate) parts.push(job.truckPlate);
                    const itemsInfo = parts.join(" / ");

                    const rowHeight = 18;

                    // 1. ตรวจสอบการขยาย: หากเกินพื้นที่ส่วนท้ายที่กำหนด
                    if (rowY + rowHeight > fixedTableBottomY && !isExtended) {
                        // ลากเส้นแนวตั้งยาวลงไปจนสุดขอบล่างของหน้ากระดาษสำหรับหน้าระหว่างทางนี้
                        colX.forEach((x, i) => {
                            if (i > 0) doc.moveTo(x, fixedTableBottomY).lineTo(x, fullPageBottom).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                        });
                        doc.moveTo(margin, fixedTableBottomY).lineTo(margin, fullPageBottom).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                        doc.moveTo(margin + contentWidth, fixedTableBottomY).lineTo(margin + contentWidth, fullPageBottom).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                        isExtended = true;
                    }

                    // 2. PAGE BREAK CHECK: If we hit physical page limit
                    if (rowY + rowHeight > fullPageBottom) {
                        // ปิดหน้าปัจจุบัน
                        doc.moveTo(margin, fullPageBottom).lineTo(margin + contentWidth, fullPageBottom).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                        doc.addPage();
                        doc.font("Sarabun");
                        rowY = drawHeader();
                        doc.fontSize(8);
                        isExtended = false; // รีเซ็ตสถานะสำหรับหน้าใหม่
                    }

                    // Bottom border (Dashed)
                    doc.moveTo(margin, rowY + rowHeight).lineTo(margin + contentWidth, rowY + rowHeight)
                        .lineWidth(TABLE_BORDER_WIDTH).dash(2, { space: 2 }).stroke(ROW_BORDER_COLOR).undash();

                    doc.fillColor(TEXT_GRAY);
                    doc.text(String(index + 1), colX[0] + cellPadding, rowY + 6, { width: colW[0] - (cellPadding * 2), align: "center" });
                    doc.text(format(new Date(job.clearanceDate), "dd/MM/yy"), colX[1] + cellPadding, rowY + 6, { width: colW[1] - (cellPadding * 2) });
                    doc.text(job.description || "-", colX[2] + cellPadding, rowY + 6, { width: colW[2] - (cellPadding * 2) });
                    doc.text(itemsInfo || "-", colX[3] + cellPadding, rowY + 6, { width: colW[3] - (cellPadding * 2) });
                    doc.text(job.refInvoiceNo || "-", colX[4] + cellPadding, rowY + 6, { width: colW[4] - (cellPadding * 2) });
                    doc.text(amt.toLocaleString("th-TH", { minimumFractionDigits: 2 }), colX[5] + cellPadding, rowY + 6, { width: colW[5] - (cellPadding * 2), align: "right" });

                    rowY += rowHeight;
                });

                // --- End of Loop ---
                // Handle Footer Overflow & Table Closure
                if (rowY > fixedTableBottomY) {
                    // เนื้อหาเกินพื้นที่ส่วนท้าย
                    // Ensure lines extended if not already
                    if (!isExtended) {
                        colX.forEach((x, i) => { if (i > 0) doc.moveTo(x, fixedTableBottomY).lineTo(x, fullPageBottom).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR); });
                        doc.moveTo(margin, fixedTableBottomY).lineTo(margin, fullPageBottom).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                        doc.moveTo(margin + contentWidth, fixedTableBottomY).lineTo(margin + contentWidth, fullPageBottom).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
                    }
                    // ปิดหน้านี้ให้สมบูรณ์
                    doc.moveTo(margin, fullPageBottom).lineTo(margin + contentWidth, fullPageBottom).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);

                    // เพิ่มหน้าใหม่สำหรับส่วนท้าย
                    doc.addPage();
                    rowY = drawHeader();
                }

                // Close table frame at fixedTableBottomY (Standard termination)
                doc.moveTo(margin, fixedTableBottomY).lineTo(margin + contentWidth, fixedTableBottomY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);

                // พื้นที่เริ่มจากใต้ตาราง (Fixed Bottom)
                const footerY = fixedTableBottomY + 10;
                const splitX = 300; // ใช้แนวเดียวกับเลขที่อ้างอิงเป็นจุดแบ่ง (ประมาณ 50/50)

                // ========== คอลัมน์ซ้าย (ข้อมูลการชำระเงิน & หมายเหตุ) ==========
                // หมายเหตุ
                const paymentW = splitX - margin - 10; // เว้นระยะ 10
                const paymentH = 110;

                // กล่องข้อมูลการชำระเงิน (Background Box)
                doc.roundedRect(margin, footerY, paymentW, paymentH, 5).stroke(BORDER_COLOR);

                const paymentTextW = paymentW - 20; // Width constraint
                doc.fillColor(PRIMARY_COLOR).fontSize(9);
                doc.text("หมายเหตุ / Note", margin + 10, footerY + 10, { width: paymentTextW });

                doc.fillColor(TEXT_GRAY).fontSize(8);
                doc.text(`ธนาคาร: ${billing.vendor.bankName || "-"}`, margin + 10, footerY + 28, { width: paymentTextW });
                doc.text(`สาขา: ${billing.vendor.bankBranch || "-"}`, margin + 10, footerY + 42, { width: paymentTextW });
                doc.text(`เลขที่บัญชี: ${billing.vendor.bankAccount || "-"}`, margin + 10, footerY + 56, { width: paymentTextW });
                doc.text(`ชื่อบัญชี: ${billing.vendor.companyName || "-"}`, margin + 10, footerY + 70, { width: paymentTextW });

                // แสดงหมายเหตุที่นี่ถ้ามี (ภายในกล่อง)
                if (billing.remark) {
                    doc.fillColor(PRIMARY_COLOR).fontSize(8);
                    doc.text("หมายเหตุ: " + billing.remark, margin + 10, footerY + 88, { width: paymentTextW });
                }


                // ========== คอลัมน์ขวา (สรุปยอดเงิน) ==========
                // ใช้พื้นที่จาก splitX ไปจนสุดขอบขวา
                const rightColX = splitX + 10; // ขยับเข้ามานิดนึง
                const rightColW = (margin + contentWidth) - rightColX;
                let sY = footerY;

                doc.fontSize(9).fillColor(TEXT_GRAY);

                const drawSummaryRow = (label: string, value: string, isBold: boolean = false) => {
                    const y = sY;
                    doc.fillColor(TEXT_GRAY);
                    if (isBold) doc.font("Sarabun-Bold").fontSize(11).fillColor("#166534");
                    else doc.font("Sarabun").fontSize(9);

                    doc.text(label, rightColX, y);
                    doc.text(value, rightColX, y, { width: rightColW, align: "right" });

                    if (isBold) doc.font("Sarabun").fontSize(9); // Reset
                    sY += 20;
                };

                // รวมเป็นเงิน
                drawSummaryRow("รวมเป็นเงิน:", `${Number(billing.subtotal).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`);

                // มูลค่าก่อนภาษีมูลค่าเพิ่ม
                if (billing.priceBeforeVat) {
                    drawSummaryRow("มูลค่าก่อนภาษีมูลค่าเพิ่ม:", `${Number(billing.priceBeforeVat).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`);
                }

                // ภาษีมูลค่าเพิ่ม
                const vatRate = billing.vatRateText || "7";
                drawSummaryRow(`ภาษีมูลค่าเพิ่ม ${vatRate}%:`, `${Number(billing.vatAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`);

                // หัก ณ ที่จ่าย
                const whtRate = billing.whtRateText || "3";
                drawSummaryRow(`หัก ณ ที่จ่าย ${whtRate}%:`, `-${Number(billing.whtAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`);

                // เส้นขีดคั่น
                sY -= 5;
                doc.moveTo(rightColX, sY).lineTo(margin + contentWidth, sY).lineWidth(0.5).stroke(BORDER_COLOR);
                sY += 8;

                // ยอดสุทธิพร้อมพื้นหลัง
                // วาดพื้นหลังก่อน
                doc.roundedRect(rightColX - 5, sY - 5, rightColW + 5, 17, 5).fill("#f0fdf4");
                doc.fillColor("#166534"); // Green text works better on light green bg

                // วางตำแหน่งข้อความเองเพื่อทำตัวหนาโดยไม่ต้องใช้ helper
                doc.fontSize(11).text("ยอดสุทธิ:", rightColX, sY - 5);
                doc.text(`${Number(billing.netTotal).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`, rightColX, sY - 5, { width: rightColW, align: "right" });
                // เพิ่มคำอ่านภาษาไทย (เช่น หนึ่งร้อยบาทถ้วน)
                const thaiText = BahtText(Number(billing.netTotal));
                doc.fontSize(9).fillColor(TEXT_GRAY);
                doc.text(thaiText, rightColX, sY + 17, { width: rightColW, align: "right" });



                // ========== SIGNATURE SECTION ==========
                // จัดตำแหน่งลายเซ็นไว้ที่ด้านล่างของหน้า
                const sigY = pageHeight - 140;
                const sigWidth = 180;

                // ลายเซ็นฝั่งซ้าย (ผู้รับเงิน)
                doc.fontSize(7).fillColor(TEXT_GRAY);
                doc.text("ในนาม " + (billing.vendor.companyName || ""), margin, sigY, { width: sigWidth, align: "center" });
                doc.moveTo(margin, sigY + 55).lineTo(margin + sigWidth, sigY + 55).stroke(BORDER_COLOR);
                doc.fontSize(8);
                doc.text("ผู้รับเงิน", margin, sigY + 60, { width: sigWidth, align: "center" });
                doc.fontSize(7);
                doc.text("วันที่ ______/______/______", margin, sigY + 73, { width: sigWidth, align: "center" });

                // ลายเซ็นฝั่งขวา (ผู้จ่ายเงิน)
                const rightSigX = pageWidth - margin - sigWidth;
                doc.fontSize(7);
                doc.text("ในนาม " + (companySettings?.companyName || "บริษัท"), rightSigX, sigY, { width: sigWidth, align: "center" });
                doc.moveTo(rightSigX, sigY + 55).lineTo(rightSigX + sigWidth, sigY + 55).stroke(BORDER_COLOR);
                doc.fontSize(8);
                doc.text("ผู้จ่ายเงิน", rightSigX, sigY + 60, { width: sigWidth, align: "center" });
                doc.fontSize(7);
                doc.text("วันที่ ______/______/______", rightSigX, sigY + 73, { width: sigWidth, align: "center" });


                // ========== ส่วนท้ายกระดาษรวม (เลขหน้า & วันที่) ==========
                const range = doc.bufferedPageRange();
                for (let i = range.start; i < range.start + range.count; i++) {
                    doc.switchToPage(i);

                    // ปิดระยะขอบล่างชั่วคราวเพื่อป้องกันการขึ้นหน้าใหม่โดยอัตโนมัติ
                    const oldBottomMargin = doc.page.margins.bottom;
                    doc.page.margins.bottom = 0;

                    doc.fontSize(6).fillColor(TEXT_GRAY);

                    // ล่างซ้าย: วันที่พิมพ์
                    doc.text(
                        `พิมพ์เมื่อ: ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
                        margin,
                        pageHeight - 20,
                        { align: "left" }
                    );

                    // ล่างขวา: เลขหน้า
                    doc.text(
                        `หน้า ${i + 1} / ${range.count}`,
                        pageWidth - margin - 100,
                        pageHeight - 20,
                        { width: 100, align: "right" }
                    );

                    // คืนค่าระยะขอบล่าง
                    doc.page.margins.bottom = oldBottomMargin;
                }

                doc.end();


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
    );
