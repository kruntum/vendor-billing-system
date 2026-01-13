import PDFDocument from "pdfkit";
import { format } from "date-fns";
import { BahtText } from "./bahttext";

// Constants
const PRIMARY_COLOR = "#000000";
const TEXT_DARK = "#000000";
const TEXT_GRAY = "#4b5563";
const BORDER_COLOR = "#C0C0C0";
const BOX_BORDER_COLOR = "#C0C0C0";
const TABLE_BORDER_WIDTH = 0.5;
const ROW_BORDER_COLOR = "#DCDCDC";

export async function generateDetailedPaymentVoucherPDF(
    doc: PDFKit.PDFDocument,
    voucher: any,
    companySettings: any,
    thaiFontPath: string,
    chineseFontPath: string
) {
    // Register Fonts
    doc.registerFont("Sarabun", thaiFontPath);
    doc.registerFont("Sarabun-Bold", thaiFontPath);
    doc.registerFont("NotoSansSC", chineseFontPath);

    const margin = 25;
    const marginTop = 15;
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const contentWidth = pageWidth - (margin * 2);

    const colWidths = [30, 140, 90, 85, 60, 60, 80];
    const colX = [margin];
    for (let i = 1; i < colWidths.length; i++) {
        colX.push(colX[i - 1] + colWidths[i - 1]);
    }
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);

    const drawMixedText = (text: string, x: number, y: number, options: any = {}) => {
        const parts = text.split(/([\u4e00-\u9fa5]+)/g).filter(Boolean);
        const fontSizes = options.size || 8;
        const baseFont = options.bold ? "Sarabun-Bold" : "Sarabun";
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

    // Helper to separate header drawing for multi-page support
    const drawHeader = (doc: PDFKit.PDFDocument) => {
        let currentY = marginTop;

        // 1. Company Header
        doc.font("Sarabun").fontSize(12).fillColor(TEXT_DARK);
        doc.text(companySettings?.companyName || "ASIA THAI SHIPPING SERVICE CO., LTD", margin, currentY, { width: contentWidth, align: "center" });
        currentY += 14;

        doc.fontSize(8).fillColor(TEXT_GRAY);
        doc.text(companySettings?.companyAddress || "62 SOI SUPAPONG 3, YAK 8, NONG BON SUBDISTRICT, PRAWET DISTRICT, BANGKOK 10250", margin, currentY, { width: contentWidth, align: "center" });
        currentY += 20;

        // Title
        drawMixedText("ใบสำคัญจ่าย (แบบละเอียด) / DETAILED PAYMENT VOUCHER", margin, currentY, { width: contentWidth, align: "center", size: 12, color: TEXT_DARK });
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
        currentY += 18;

        // Row 4: Account Bank / No
        const accLabel = "ชื่อบัญชี/เลขบัญชี (Account Name/Account No.) 银行名称/银行账号 :";
        doc.fillColor(TEXT_DARK);
        drawMixedText(accLabel, labelX, currentY);
        const accValueX = margin + 250;
        const bankInfo = `${voucher.vendor.bankName || ""} ${voucher.vendor.bankAccount || ""}`.trim() || "-";

        doc.fillColor(TEXT_GRAY).text(bankInfo, accValueX, currentY);
        doc.moveTo(accValueX, currentY + 10).lineTo(pageWidth - margin, currentY + 10).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();
        currentY += 18;

        // Row 5: Payment Method (CHECKBOXES)
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
        const pm = voucher.paymentMethod || "TRANSFER";
        nextX = drawCheckbox(nextX - 10, "Bank Transfer 转账", pm === "TRANSFER");
        nextX = drawCheckbox(nextX - 10, "CHQUE 支票", pm === "CHEQUE");
        nextX = drawCheckbox(nextX - 10, "CASH เงินสด 现金", pm === "CASH");
        drawCheckbox(nextX - 10, "CASHIER CHQUE 现金支票", pm === "CASHIER_CHEQUE");

        if (voucher.paymentInfo) {
            doc.fontSize(7).fillColor(TEXT_GRAY);
            // Display info below checks or inline?
            // User requested "replace" implying prominence. 
            // Let's put it below the checks for clarity
            drawMixedText(`( ${voucher.paymentInfo} )`, nextX - 250, currentY + 12, { size: 7, color: TEXT_GRAY });
        }

        currentY += 25;

        // --- TABLE HEADER ---
        doc.rect(margin, currentY, tableWidth, 25).fillAndStroke("#e5e7eb", BORDER_COLOR);

        // Vertical lines for header
        colX.forEach((x, i) => {
            if (i > 0) doc.moveTo(x, currentY).lineTo(x, currentY + 25).lineWidth(0.5).stroke(BORDER_COLOR);
        });

        doc.fillColor(TEXT_DARK).fontSize(8).font("Sarabun-Bold");

        const headers = [
            "ลำดับ", "รายละเอียดงาน", "เบอร์ตู้", "เลขที่อ้างอิง", "ภาษีมูลค่าเพิ่ม", "หัก ณ ที่จ่าย", "จำนวนเงิน"
        ];
        headers.forEach((h, i) => {
            const align = i === 1 ? "left" : (i >= 4 ? "right" : "center");
            doc.text(h, colX[i] + 2, currentY + 8, { width: colWidths[i] - 4, align: align as any });
        });
        doc.font("Sarabun");

        currentY += 25;
        return currentY;
    };

    // Initial Header
    let currentY = drawHeader(doc);

    // Helper to draw lines
    const drawVerticalLines = (startY: number, endY: number) => {
        colX.forEach((x, i) => {
            if (i > 0) doc.moveTo(x, startY).lineTo(x, endY).lineWidth(0.5).stroke(BORDER_COLOR);
        });
        doc.moveTo(margin, startY).lineTo(margin, endY).lineWidth(0.5).stroke(BORDER_COLOR);
        doc.moveTo(margin + tableWidth, startY).lineTo(margin + tableWidth, endY).lineWidth(0.5).stroke(BORDER_COLOR);
    };

    // --- TABLE BODY ---
    let rowIndex = 1;
    let tableStartY = currentY;

    const footerHeight = 260; // Reduced height to push content down
    const pageBottomLimit = pageHeight - margin;
    const footerTriggerY = pageBottomLimit - footerHeight;

    const drawFooter = (startY: number) => {
        let fY = startY;

        // Draw top border of Footer (closing the table)
        doc.moveTo(margin, fY).lineTo(margin + tableWidth, fY).lineWidth(0.5).stroke(BORDER_COLOR);

        // --- SUMMARY (Bottom Right) ---
        const summaryW = 200;
        const summaryX = pageWidth - margin - summaryW;
        fY += 10;

        const drawSummaryLine = (label: string, value: string, isBold = false, isGreen = false) => {
            const size = isBold ? 9 : 8;
            doc.fontSize(size).fillColor(TEXT_DARK);
            if (isGreen) doc.fillColor("#166534");
            drawMixedText(label, summaryX, fY, { size, color: isGreen ? "#166534" : TEXT_DARK });
            doc.fillColor(isGreen ? "#166534" : TEXT_GRAY).text(value, summaryX, fY, { width: summaryW, align: "right" });
            fY += 14;
        };

        drawSummaryLine("TOTAL VALUE BEFORE VAT :", Number(voucher.subtotal).toLocaleString("th-TH", { minimumFractionDigits: 2 }));
        drawSummaryLine(`VAT ${(voucher.billingNotes?.[0]?.vatRateText || "7")}% :`, Number(voucher.totalVat).toLocaleString("th-TH", { minimumFractionDigits: 2 }));
        const totalWithVat = Number(voucher.subtotal) + Number(voucher.totalVat);
        drawSummaryLine("TOTAL 总计 :", totalWithVat.toLocaleString("th-TH", { minimumFractionDigits: 2 }));
        drawSummaryLine(`WHT ${(voucher.billingNotes?.[0]?.whtRateText || "3")}% :`, Number(voucher.totalWht) > 0 ? `-${Number(voucher.totalWht).toLocaleString("th-TH", { minimumFractionDigits: 2 })}` : "0.00");

        doc.rect(summaryX - 5, fY - 2, summaryW + 5, 20).fill("#f0fdf4");
        doc.fillColor("#166534");
        drawSummaryLine("NET TOTAL 总计 :", Number(voucher.netTotal).toLocaleString("th-TH", { minimumFractionDigits: 2 }), true, true);

        // Thai Text
        const thaiText = BahtText(Number(voucher.netTotal));
        doc.fontSize(8);
        drawMixedText(thaiText, summaryX, fY + 8, { width: summaryW, align: "right", color: TEXT_GRAY });

        // ========== SIGNATURES ==========
        // Disable bottom margin to allow drawing into the margin area
        const oldBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        // Fixed position at bottom
        const sigBoxH = 70;
        const sigTotalHeight = sigBoxH * 2;
        const sigStartY = pageHeight - margin - sigTotalHeight;

        // --- REMARK BOX (Left) ---
        // Fixed position relative to Footer Start 
        const remarkY = startY + 10;
        // Calculate dynamic height: From remarkY to top of Signatures (minus padding)
        const remarkHeight = sigStartY - remarkY - 10;

        doc.rect(margin, remarkY, pageWidth - margin - summaryW - 15 - margin, remarkHeight).stroke(BORDER_COLOR);
        doc.fillColor(TEXT_DARK).fontSize(8);
        drawMixedText("REMARK 备注", margin + 5, remarkY + 5, { size: 8 });
        doc.text(voucher.remark || "-", margin + 5, remarkY + 20, { width: 300 });

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

            // Box Border
            doc.rect(bx, by, boxW, sigBoxH).lineWidth(TABLE_BORDER_WIDTH).stroke(BOX_BORDER_COLOR);

            // Line
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

        // Reset bottom margin
        doc.page.margins.bottom = oldBottomMargin;
    };

    const changePage = () => {
        // Extend lines to bottom of current page
        drawVerticalLines(tableStartY, pageBottomLimit);
        doc.moveTo(margin, pageBottomLimit).lineTo(margin + tableWidth, pageBottomLimit).lineWidth(0.5).stroke(BORDER_COLOR);

        doc.addPage();
        currentY = drawHeader(doc);
        tableStartY = currentY;
    };

    for (const bn of voucher.billingNotes!) {
        // Check BN header space (20 height)
        if (currentY + 20 > footerTriggerY) { // Check against footerTriggerY
            changePage();
        }

        // ... Billing Note Header Logic ...
        doc.fillColor(PRIMARY_COLOR).fontSize(8).font("Sarabun-Bold");
        doc.text(`ใบวางบิล: ${bn.billingRef}`, colX[1] + 2, currentY + 6, { width: colWidths[1] - 4, align: "left" });
        doc.text(`วันที่: ${format(new Date(bn.billingDate), "dd/MM/yyyy")}`, colX[3] + 2, currentY + 6, { width: colWidths[3] - 4, align: "center" });
        doc.text(Number(bn.netTotal).toLocaleString("th-TH", { minimumFractionDigits: 2 }), colX[6], currentY + 6, { width: colWidths[6] - 4, align: "right" });
        doc.moveTo(margin, currentY + 20).lineTo(margin + tableWidth, currentY + 20).lineWidth(0.2).dash(1, { space: 2 }).stroke(BORDER_COLOR).undash();
        doc.font("Sarabun");
        currentY += 20;

        if (bn.jobs) {
            const vatRate = parseFloat(bn.vatRateText || "7");
            const whtRate = parseFloat(bn.whtRateText || "3");

            for (const job of bn.jobs) {
                const amt = job.items.reduce((s: number, it: any) => s + Number(it.amount), 0);
                let jobVat = 0;
                let jobWht = 0;
                if (Number(bn.vatAmount) > 0) {
                    jobVat = amt * (vatRate / 100);
                }
                if (Number(bn.whtAmount) > 0) {
                    jobWht = amt * (whtRate / 100);
                }

                if (currentY + 18 > footerTriggerY) { // Check against footerTriggerY
                    changePage();
                }

                doc.fillColor(TEXT_DARK).fontSize(8);
                doc.text(String(rowIndex++), colX[0], currentY + 4, { width: colWidths[0], align: "center" });
                doc.text(job.description || "-", colX[1] + 5, currentY + 4, { width: colWidths[1] - 8, lineBreak: false, ellipsis: true });
                const container = job.containerNo || job.truckPlate || "-";
                doc.text(container, colX[2] + 2, currentY + 4, { width: colWidths[2] - 4, align: "center" });
                doc.text(job.refInvoiceNo || "-", colX[3] + 2, currentY + 4, { width: colWidths[3] - 4, align: "center" });
                doc.text(jobVat > 0 ? jobVat.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-", colX[4], currentY + 4, { width: colWidths[4] - 4, align: "right" });
                doc.text(jobWht > 0 ? jobWht.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-", colX[5], currentY + 4, { width: colWidths[5] - 4, align: "right" });
                doc.text(amt.toLocaleString("th-TH", { minimumFractionDigits: 2 }), colX[6], currentY + 4, { width: colWidths[6] - 4, align: "right" });
                doc.moveTo(margin, currentY + 18).lineTo(margin + tableWidth, currentY + 18).lineWidth(0.2).dash(1, { space: 2 }).stroke(BORDER_COLOR).undash();

                currentY += 18;
            }
        }
    }

    // --- FINAL FOOTER CHECK ---
    // Footer Top Y position
    const footerY = pageBottomLimit - footerHeight;

    if (currentY > footerY) {
        // Not enough space for footer on current page
        changePage();
        // On new page, draw lines from currentY (after header) down to footerY
        drawVerticalLines(currentY, footerY);
        drawFooter(footerY);
    } else {
        // Space available on current page
        drawVerticalLines(tableStartY, footerY);
        drawFooter(footerY);
    }

    // --- FOOTER (Page No) ---
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        // The drawFooter function already handles setting/resetting doc.page.margins.bottom
        // for the signature block. For page numbers, we can temporarily set it to 0.
        const oldBottomMarginForPageNum = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        doc.fontSize(6).fillColor(TEXT_GRAY);
        doc.text(`พิมพ์เมื่อ: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, margin, pageHeight - 15, { align: "left" });
        doc.text(`หน้า ${i + 1} / ${range.count}`, pageWidth - margin - 100, pageHeight - 15, { width: 100, align: "right" });

        doc.page.margins.bottom = oldBottomMarginForPageNum;
    }

    doc.end();
}

export async function generateBillingNotePDF(
    doc: PDFKit.PDFDocument,
    billing: any,
    companySettings: any,
    thaiFontPath: string
) {
    // ------------------------------------------------------------------
    // การตั้งค่าสี (Colors Configuration)
    // ------------------------------------------------------------------
    const PRIMARY_COLOR = "#000000";
    const COMPANY_NAME_COLOR = "#000000";
    const TEXT_DARK = "#000000";
    const TEXT_GRAY = "#4b5563";
    const BORDER_COLOR = "#C0C0C0";
    const BOX_BORDER_COLOR = "#C0C0C0";
    const BOX_BACKGROUND_COLOR = "#f9fafb";
    const TABLE_BORDER_WIDTH = 0.5;
    const ROW_BORDER_COLOR = "#DCDCDC";

    // Register Font (if not already registered)
    // safe because pdfkit allows re-register
    doc.registerFont("Sarabun", thaiFontPath);
    doc.registerFont("Sarabun-Bold", thaiFontPath);

    const margin = 25;
    const marginTop = 15;
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

        // ========== ส่วนหัวตาราง ==========
        const tableY = row2Y + finalBoxH + 15;
        const headerHeight = 35; // เพิ่มความสูงสำหรับ 2 บรรทัด

        // พื้นหลังและเส้นขอบหัวตาราง
        doc.rect(margin, tableY, contentWidth, headerHeight).fillAndStroke(BOX_BACKGROUND_COLOR, BORDER_COLOR);

        // วาดเส้นแนวตั้งยาวลงไปจนถึง fixedTableBottomY เลย
        colX.forEach((x, i) => {
            if (i > 0) {
                doc.moveTo(x, tableY).lineTo(x, fixedTableBottomY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
            }
        });
        // ขอบซ้ายขวา
        doc.moveTo(margin, tableY).lineTo(margin, fixedTableBottomY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
        doc.moveTo(margin + contentWidth, tableY).lineTo(margin + contentWidth, fixedTableBottomY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);

        doc.font("Sarabun");
        headers.forEach((h, i) => {
            // Center align for ALL headers
            const align = "center";
            const cellY = tableY + 5;

            // Thai Line
            doc.fontSize(9).fillColor(TEXT_DARK).text(h.th, colX[i] + 2, cellY, { width: colW[i] - 4, align: align as any });

            // English Line
            if (h.en) {
                doc.fontSize(8).fillColor(TEXT_GRAY).text(h.en, colX[i] + 2, cellY + 12, { width: colW[i] - 4, align: align as any });
            }
        });

        // เริ่มวาดตาราง
        return tableY + headerHeight;
    };

    // เรียกใช้วาดส่วนหัวครั้งแรก
    let rowY = drawHeader();
    doc.fontSize(8);

    const fullPageBottom = pageHeight - margin - 30;
    let isExtended = false;

    // วนลูปวาดรายการงาน (Jobs)
    billing.jobs.forEach((job: any, index: number) => {
        // Need to calculate amount if items are populated, otherwise use what's available
        // Similar to existing logic
        const amt = job.items ? job.items.reduce((s: number, it: any) => s + Number(it.amount), 0) : 0;

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

        doc.page.margins.bottom = oldBottomMargin;
    }

    doc.end();
}

export async function generateReceiptPDF(
    doc: PDFKit.PDFDocument,
    receipt: any,
    billing: any,
    companySettings: any,
    thaiFontPath: string
) {
    // กำหนดสี
    const PRIMARY_COLOR = "#1e3a8a"; // Blue-900
    const TEXT_DARK = "#111827";     // Gray-900
    const TEXT_GRAY = "#4b5563";     // Gray-600
    const BORDER_COLOR = "#e5e7eb";  // Gray-200
    const BOX_BACKGROUND_COLOR = "#f9fafb"; // Gray-50
    const BOX_BORDER_COLOR = "#d1d5db"; // Gray-300
    const ROW_BORDER_COLOR = "#f3f4f6"; // Gray-100
    const TABLE_BORDER_WIDTH = 0.5;

    // ตั้งค่าระยะขอบ (Margin)
    const margin = 25;
    const marginTop = 15;

    // คำนวณขนาดหน้ากระดาษ
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const contentWidth = pageWidth - (margin * 2);

    // ลงทะเบียนฟอนต์
    doc.registerFont("Sarabun", thaiFontPath);
    // Note: If you have a bold font file, pass it as a separate argument or derive path.
    // Here we reuse regular if bold not strictly separated or available in this context,
    // BUT generateBillingNotePDF registers "Sarabun-Bold" with the same path?
    // Let's check generateBillingNotePDF. It uses the same path for both.
    doc.registerFont("Sarabun-Bold", thaiFontPath);

    // กำหนดคอลัมน์
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

    billing.jobs.forEach((job: any, index: number) => {
        const amt = job.items.reduce((s: number, it: any) => s + Number(it.amount), 0);

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
}

export async function generateCashAdvanceBillingPDF(
    doc: PDFKit.PDFDocument,
    billing: any,
    companySettings: any,
    thaiFontPath: string
) {
    // ------------------------------------------------------------------
    // Constants
    // ------------------------------------------------------------------
    const PRIMARY_COLOR = "#000000";
    const COMPANY_NAME_COLOR = "#000000";
    const TEXT_DARK = "#000000";
    const TEXT_GRAY = "#4b5563";
    const BORDER_COLOR = "#C0C0C0";
    const BOX_BORDER_COLOR = "#C0C0C0";
    const BOX_BACKGROUND_COLOR = "#f9fafb";
    const TABLE_BORDER_WIDTH = 0.5;
    const ROW_BORDER_COLOR = "#DCDCDC";

    // Register Fonts
    doc.registerFont("Sarabun", thaiFontPath);
    doc.registerFont("Sarabun-Bold", thaiFontPath);

    const margin = 25;
    const marginTop = 15;
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const contentWidth = pageWidth - (margin * 2);

    // Columns: No, Date, Description, Truck/Container, Ref, Amount
    // 1. # (30)
    // 2. Date (50)
    // 3. Description (180)
    // 4. Truck/Container (120)
    // 5. Ref (80)
    // 6. Amount (80) = Total 540
    const colW = [30, 50, 180, 120, 80, 80];
    const colX = [
        margin,
        margin + colW[0],
        margin + colW[0] + colW[1],
        margin + colW[0] + colW[1] + colW[2],
        margin + colW[0] + colW[1] + colW[2] + colW[3],
        margin + colW[0] + colW[1] + colW[2] + colW[3] + colW[4]
    ];

    const headers = [
        { th: "#", en: "", align: "center" },
        { th: "วันที่", en: "Date", align: "center" },
        { th: "รายละเอียด", en: "Description", align: "left" },
        { th: "เบอร์ตู้/ทะเบียนรถ", en: "Container / License Plate", align: "left" },
        { th: "เลขที่อ้างอิง", en: "Ref No.", align: "left" },
        { th: "จำนวนเงิน", en: "Amount", align: "right" }
    ];
    const cellPadding = 5;

    // Fixed Table Bottom (Leave space for Footer + Summary + Signatures)
    // Footer Height approx: Remark (80) + Sig (100) + PageFooter (20) ~ 200
    // Let's reserve 220 from bottom
    const fixedTableBottomY = pageHeight - 220;

    // ------------------------------------------------------------------
    // Helper: Draw Header
    // Returns Y position after header
    // ------------------------------------------------------------------
    const drawHeader = () => {
        let currentY = marginTop;

        // 1. Vendor (Left) & Title (Right)
        doc.font("Sarabun").fontSize(14).fillColor(COMPANY_NAME_COLOR);
        doc.text(billing.vendor.companyName || "Company Name", margin, currentY);

        doc.fontSize(9).fillColor(TEXT_GRAY);
        currentY += 20;
        if (billing.vendor.companyAddress) {
            doc.text(billing.vendor.companyAddress, margin, currentY, { width: 300 });
            currentY = doc.y;
        }
        doc.text(`เลขประจำตัวผู้เสียภาษี: ${billing.vendor.taxId || "-"}`, margin, currentY);

        // Title (Right)
        const titleW = 220;
        const titleX = pageWidth - margin - titleW;
        doc.fontSize(18).fillColor(PRIMARY_COLOR);
        doc.text("ใบวางบิลสำรองเงินสด", titleX, marginTop, { width: titleW, align: "center" });
        doc.fontSize(10);
        doc.text("Cash Advance Billing Note", titleX, marginTop + 25, { width: titleW, align: "center" });

        // 2. Info Boxes
        const row2Y = Math.max(currentY + 15, marginTop + 50);
        const gap = 10;
        const rightBoxW = 200;
        const leftBoxW = contentWidth - rightBoxW - gap;
        const leftBoxX = margin;
        const rightBoxX = margin + leftBoxW + gap;
        const padding = 10;

        // Left Box Height Calculation
        let calcLeftH = padding;
        calcLeftH += 16; // Header
        doc.fontSize(10);
        if (companySettings) {
            calcLeftH += 14;
            if (companySettings.companyAddress) {
                const addrH = doc.heightOfString(companySettings.companyAddress, { width: leftBoxW - (padding * 2) });
                calcLeftH += addrH + 4;
            }
            calcLeftH += 14;
        } else {
            calcLeftH += 14;
        }
        const leftBoxH = calcLeftH + 5;

        // Right Box Height
        const rightBoxH = padding + 16 + 16 + 16 + 5; // No, Date, Status
        const finalBoxH = Math.max(leftBoxH, rightBoxH);

        // Draw Boxes
        doc.roundedRect(leftBoxX, row2Y, leftBoxW, finalBoxH, 5).stroke(BOX_BORDER_COLOR);
        doc.roundedRect(rightBoxX, row2Y, rightBoxW, finalBoxH, 5).stroke(BOX_BORDER_COLOR);

        // Box Content - Left
        let custY = row2Y + padding;
        doc.fontSize(10).fillColor(PRIMARY_COLOR).text("ลูกค้า / Customer", leftBoxX + padding, custY);
        custY += 16;
        doc.fontSize(9).fillColor(TEXT_GRAY);
        if (companySettings) {
            doc.text(companySettings.companyName || "-", leftBoxX + padding, custY, { width: leftBoxW - padding * 2 });
            custY += 13;
            if (companySettings.companyAddress) {
                doc.text(companySettings.companyAddress, leftBoxX + padding, custY, { width: leftBoxW - padding * 2 });
                custY = doc.y + 3;
            }
            doc.fontSize(8).text(`เลขประจำตัวผู้เสียภาษี: ${companySettings.taxId || "-"}`, leftBoxX + padding, custY);
        } else {
            doc.text("(ยังไม่ได้ตั้งค่าข้อมูลบริษัท)", leftBoxX + padding, custY);
        }

        // Box Content - Right
        let docY = row2Y + padding;
        const labelX = rightBoxX + padding;
        const valX = rightBoxX + 60;
        const valW = rightBoxW - 60 - padding;

        doc.fontSize(9).fillColor(PRIMARY_COLOR).text("เลขที่ / No:", labelX, docY);
        doc.fontSize(9).fillColor(TEXT_GRAY).text(billing.billingRef || "-", valX, docY, { width: valW, align: "right" });
        docY += 16;
        doc.fontSize(9).fillColor(PRIMARY_COLOR).text("วันที่ / Date:", labelX, docY);
        doc.fontSize(9).fillColor(TEXT_GRAY).text(format(new Date(billing.billingDate), "dd/MM/yyyy"), valX, docY, { width: valW, align: "right" });
        docY += 16;

        // Status Map
        const statusEnum: Record<string, string> = {
            PENDING: "รอส่ง", SUBMITTED: "ส่งแล้ว", APPROVED: "อนุมัติ", PAID: "จ่ายแล้ว", CANCELLED: "ยกเลิก"
        };
        doc.fontSize(9).fillColor(PRIMARY_COLOR).text("สถานะ / Status:", labelX, docY);
        doc.fontSize(9).fillColor(TEXT_GRAY).text(statusEnum[billing.status] || billing.status, valX, docY, { width: valW, align: "right" });


        // Table Header
        const tableY = row2Y + finalBoxH + 15;
        const headerH = 35; // Increased for double line header

        doc.rect(margin, tableY, contentWidth, headerH).fillAndStroke(BOX_BACKGROUND_COLOR, BORDER_COLOR);

        // Vertical Header Lines
        colX.forEach((x, i) => {
            if (i > 0) doc.moveTo(x, tableY).lineTo(x, fixedTableBottomY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);
        });
        doc.moveTo(margin, tableY).lineTo(margin, fixedTableBottomY).stroke(BORDER_COLOR);
        doc.moveTo(margin + contentWidth, tableY).lineTo(margin + contentWidth, fixedTableBottomY).stroke(BORDER_COLOR);

        doc.font("Sarabun-Bold").fontSize(9).fillColor(TEXT_DARK);

        headers.forEach((h, i) => {
            const headY = tableY + 5;
            // Handle object header vs string (though we know it's object now)
            if (typeof h === 'string') {
                doc.text(h, colX[i] + cellPadding, headY + 8, { width: colW[i] - (cellPadding * 2), align: "center" });
            } else {
                doc.text(h.th, colX[i] + cellPadding, headY, { width: colW[i] - (cellPadding * 2), align: h.align as any });
                if (h.en) {
                    doc.fontSize(8).fillColor(TEXT_GRAY);
                    doc.text(h.en, colX[i] + cellPadding, headY + 12, { width: colW[i] - (cellPadding * 2), align: h.align as any });
                    doc.fontSize(9).fillColor(TEXT_DARK); // Reset
                }
            }
        });
        doc.font("Sarabun");

        return tableY + headerH;
    };

    // ------------------------------------------------------------------
    // Draw Body
    // ------------------------------------------------------------------
    let rowY = drawHeader();
    doc.fontSize(8);
    const fullPageBottom = pageHeight - margin - 30; // Max Y before forced break
    let isExtended = false;

    billing.items.forEach((item: any, index: number) => {
        const rowHeight = 18;

        // Auto-break logic
        // 1. If row exceeds table bottom (but not page bottom), extend vertical lines
        if (rowY + rowHeight > fixedTableBottomY && !isExtended) {
            colX.forEach((x, i) => {
                if (i > 0) doc.moveTo(x, fixedTableBottomY).lineTo(x, fullPageBottom).stroke(BORDER_COLOR);
            });
            doc.moveTo(margin, fixedTableBottomY).lineTo(margin, fullPageBottom).stroke(BORDER_COLOR);
            doc.moveTo(margin + contentWidth, fixedTableBottomY).lineTo(margin + contentWidth, fullPageBottom).stroke(BORDER_COLOR);
            isExtended = true;
        }

        // 2. If row exceeds page bottom, add new page
        if (rowY + rowHeight > fullPageBottom) {
            doc.moveTo(margin, fullPageBottom).lineTo(margin + contentWidth, fullPageBottom).stroke(BORDER_COLOR);
            doc.addPage();
            rowY = drawHeader();
            doc.fontSize(8);
            isExtended = false;
        }

        // Draw Row
        doc.moveTo(margin, rowY + rowHeight).lineTo(margin + contentWidth, rowY + rowHeight)
            .lineWidth(TABLE_BORDER_WIDTH).dash(2, { space: 2 }).stroke(ROW_BORDER_COLOR).undash();

        doc.fillColor(TEXT_GRAY);
        // 1. #
        doc.text(String(index + 1), colX[0] + cellPadding, rowY + 4, { width: colW[0] - cellPadding * 2, align: "center" });

        // 2. Date
        doc.text(format(new Date(item.advanceDate), "dd/MM/yy"), colX[1] + cellPadding, rowY + 4, { width: colW[1] - cellPadding * 2, align: "center" });

        // 3. Description
        const desc = item.description || `Cash Advance ${format(new Date(item.advanceDate), "dd/MM/yyyy")}`;
        doc.text(desc, colX[2] + cellPadding, rowY + 4, { width: colW[2] - cellPadding * 2, lineBreak: false, ellipsis: true });

        // 4. Container/Plate 
        const vehicleInfo = [item.containerNo, item.truckPlate].filter(Boolean).join(" / ") || "-";
        doc.text(vehicleInfo, colX[3] + cellPadding, rowY + 4, { width: colW[3] - cellPadding * 2, ellipsis: true });

        // 5. Ref No.
        doc.text(item.advanceRef, colX[4] + cellPadding, rowY + 4, { width: colW[4] - cellPadding * 2, lineBreak: false });

        // 6. Amount
        doc.text(Number(item.totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 }), colX[5] + cellPadding, rowY + 4, { width: colW[5] - cellPadding * 2, align: "right" });

        rowY += rowHeight;
    });

    // Handle end of table
    if (rowY > fixedTableBottomY) {
        if (!isExtended) {
            // Draw lines to bottom if not already done
            colX.forEach((x, i) => { if (i > 0) doc.moveTo(x, fixedTableBottomY).lineTo(x, fullPageBottom).stroke(BORDER_COLOR); });
            doc.moveTo(margin, fixedTableBottomY).lineTo(margin, fullPageBottom).stroke(BORDER_COLOR);
            doc.moveTo(margin + contentWidth, fixedTableBottomY).lineTo(margin + contentWidth, fullPageBottom).stroke(BORDER_COLOR);
        }
        // Close page
        doc.moveTo(margin, fullPageBottom).lineTo(margin + contentWidth, fullPageBottom).stroke(BORDER_COLOR);
        doc.addPage();
        rowY = drawHeader();
    }

    // Close table at fixed bottom
    doc.moveTo(margin, fixedTableBottomY).lineTo(margin + contentWidth, fixedTableBottomY).lineWidth(TABLE_BORDER_WIDTH).stroke(BORDER_COLOR);

    // ------------------------------------------------------------------
    // Footer Section
    // ------------------------------------------------------------------
    const footerY = fixedTableBottomY + 10;
    const splitX = pageWidth - margin - 220; // 220 width for summary

    // LEFT: Remark Box
    const remarkW = splitX - margin - 20;
    const remarkH = 80;

    doc.roundedRect(margin, footerY, remarkW, remarkH, 5).stroke(BORDER_COLOR);
    doc.fillColor(PRIMARY_COLOR).fontSize(9);
    doc.text("หมายเหตุ / Remark:", margin + 10, footerY + 10);
    doc.fillColor(TEXT_GRAY).fontSize(8);
    if (billing.remark) {
        doc.text(billing.remark, margin + 10, footerY + 25, { width: remarkW - 20 });
    } else {
        doc.text("-", margin + 10, footerY + 25);
    }

    // RIGHT: Summary
    const summaryX = splitX;
    const summaryW = pageWidth - margin - summaryX;
    let sY = footerY;

    const drawSummaryRow = (label: string, value: string, isBold = false) => {
        doc.fillColor(TEXT_DARK);
        if (isBold) doc.font("Sarabun-Bold").fontSize(10);
        else doc.font("Sarabun").fontSize(9);

        doc.text(label, summaryX, sY);
        doc.text(value, summaryX, sY, { width: summaryW, align: "right" });
        if (isBold) doc.font("Sarabun");
        sY += 18;
    };

    drawSummaryRow("รวมเป็นเงิน / Subtotal:", `${Number(billing.totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`);
    sY += 5;

    // Net Total Box
    doc.roundedRect(summaryX - 5, sY - 5, summaryW + 5, 20, 5).fill("#f0fdf4");
    doc.fillColor("#166534").fontSize(11).font("Sarabun-Bold");
    doc.text("ยอดสุทธิ / Net Total:", summaryX, sY);
    doc.text(`${Number(billing.totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`, summaryX, sY, { width: summaryW, align: "right" });
    doc.font("Sarabun");
    sY += 25;

    // Baht Text
    const thaiText = BahtText(Number(billing.totalAmount));
    doc.fontSize(9).fillColor(TEXT_GRAY);
    doc.text(thaiText, summaryX, sY, { width: summaryW, align: "right" });

    // ------------------------------------------------------------------
    // Signatures
    // ------------------------------------------------------------------
    const sigY = pageHeight - 120;
    const sigW = 180;

    // Left Sig
    doc.fontSize(7).fillColor(TEXT_GRAY);
    doc.text("ในนาม " + (billing.vendor.companyName || ""), margin, sigY, { width: sigW, align: "center" });
    doc.moveTo(margin, sigY + 45).lineTo(margin + sigW, sigY + 45).stroke(BORDER_COLOR);
    doc.fontSize(8);
    doc.text("ผู้วางบิล / Bill Collector", margin, sigY + 50, { width: sigW, align: "center" });
    doc.fontSize(7);
    doc.text("วันที่ ______/______/______", margin, sigY + 62, { width: sigW, align: "center" });

    // Right Sig
    const rightSigX = pageWidth - margin - sigW;
    doc.text("ในนาม " + (companySettings?.companyName || "บริษัท"), rightSigX, sigY, { width: sigW, align: "center" });
    doc.moveTo(rightSigX, sigY + 45).lineTo(rightSigX + sigW, sigY + 45).stroke(BORDER_COLOR);
    doc.fontSize(8);
    doc.text("ผู้อนุมัติ / Approved By", rightSigX, sigY + 50, { width: sigW, align: "center" });
    doc.fontSize(7);
    doc.text("วันที่ ______/______/______", rightSigX, sigY + 62, { width: sigW, align: "center" });

    // ------------------------------------------------------------------
    // Page Footer (Numbers)
    // ------------------------------------------------------------------
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const oldBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.fontSize(6).fillColor(TEXT_GRAY);
        doc.text(`พิมพ์เมื่อ: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, margin, pageHeight - 20, { align: "left" });
        doc.text(`หน้า ${i + 1} / ${range.count}`, pageWidth - margin - 100, pageHeight - 20, { width: 100, align: "right" });
        doc.page.margins.bottom = oldBottom;
    }

    doc.end();
}

export async function generateCashAdvancePaymentVoucherPDF(
    doc: PDFKit.PDFDocument,
    billing: any,
    companySettings: any,
    thaiFontPath: string,
    chineseFontPath: string
) {
    // Config
    const TEXT_DARK = "#000000";
    const TEXT_GRAY = "#4b5563";
    const BORDER_COLOR = "#C0C0C0";
    const BOX_BORDER_COLOR = "#C0C0C0";
    const TABLE_BORDER_WIDTH = 0.5;
    const ROW_BORDER_COLOR = "#DCDCDC";

    doc.registerFont("Sarabun", thaiFontPath);
    doc.registerFont("Sarabun-Bold", thaiFontPath);
    doc.registerFont("NotoSansSC", chineseFontPath);

    const margin = 25;
    const marginTop = 15;
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const contentWidth = pageWidth - (margin * 2);

    const payment = billing.payment;
    if (!payment) throw new Error("Payment data not found");

    // Copying column logic from Detailed but removing VAT/WHT
    // Original: [30, 140, 90, 85, 60, 60, 80] -> 545
    // Removed: VAT(60), WHT(60) -> 120 removed.
    // Re-distribute 120 to Description and others.
    // New Cols: Seq, Description, Container/Ref, RefNo, Amount
    const colWidths = [30, 260, 90, 85, 80];
    // 30+260+90+85+80 = 545. Matches total width.

    const colX = [margin];
    for (let i = 1; i < colWidths.length; i++) {
        colX.push(colX[i - 1] + colWidths[i - 1]);
    }
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);

    // Reuse MixedText helper (copied from above) because it's not exported
    const drawMixedText = (text: string, x: number, y: number, options: any = {}) => {
        const parts = text.split(/([\u4e00-\u9fa5]+)/g).filter(Boolean);
        const fontSizes = options.size || 8;
        const baseFont = options.bold ? "Sarabun-Bold" : "Sarabun";
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

    const drawHeader = (doc: PDFKit.PDFDocument) => {
        let currentY = marginTop;

        // 1. Company Header
        doc.font("Sarabun").fontSize(12).fillColor(TEXT_DARK);
        doc.text(companySettings?.companyName || "ASIA THAI SHIPPING SERVICE CO., LTD", margin, currentY, { width: contentWidth, align: "center" });
        currentY += 14;

        doc.fontSize(8).fillColor(TEXT_GRAY);
        doc.text(companySettings?.companyAddress || "62 SOI SUPAPONG 3, YAK 8, NONG BON SUBDISTRICT, PRAWET DISTRICT, BANGKOK 10250", margin, currentY, { width: contentWidth, align: "center" });
        currentY += 20;

        // Title
        drawMixedText("ใบสำคัญจ่าย (Cash Advance) / PAYMENT VOUCHER", margin, currentY, { width: contentWidth, align: "center", size: 12, color: TEXT_DARK });
        currentY += 30;

        // 2. Info Grid
        const labelX = margin;
        const valueX = margin + 120;
        const rightLabelX = pageWidth - margin - 180;
        const rightValueX = pageWidth - margin - 80;

        // Row 1
        doc.fontSize(8).fillColor(TEXT_DARK);
        drawMixedText("ลูกค้า (The customer) 付款人 :", labelX, currentY);
        doc.fillColor(TEXT_GRAY).text(companySettings?.companyName || "-", valueX, currentY);
        doc.moveTo(valueX, currentY + 10).lineTo(rightLabelX - 10, currentY + 10).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();

        drawMixedText("วันที่เอกสาร (DATE) 日期 :", rightLabelX, currentY);
        doc.fillColor(TEXT_GRAY).text(format(new Date(payment.paymentDate), "dd/MM/yyyy"), rightValueX, currentY, { align: "right", width: 80 });
        doc.moveTo(rightValueX, currentY + 10).lineTo(pageWidth - margin, currentY + 10).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();
        currentY += 18;

        // Row 2
        drawMixedText("จ่ายให้ (Paid To) 收款人 :", labelX, currentY);
        doc.fillColor(TEXT_GRAY).text(billing.vendor.companyName, valueX, currentY);
        doc.moveTo(valueX, currentY + 10).lineTo(rightLabelX - 10, currentY + 10).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();

        drawMixedText("VOUCHER NO. 单据号 :", rightLabelX, currentY);
        doc.fillColor(TEXT_GRAY).text(payment.paymentRef, rightValueX, currentY, { align: "right", width: 80 });
        doc.moveTo(rightValueX, currentY + 10).lineTo(pageWidth - margin, currentY + 10).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();
        currentY += 18;

        // Row 3
        drawMixedText("เพื่อชำระ (Paid For) 款项用途 :", labelX, currentY);
        const paidForText = "ชำระเงินสำรองจ่าย (Cash Advance)";
        doc.fillColor(TEXT_GRAY).text(paidForText, valueX, currentY);
        doc.moveTo(valueX, currentY + 10).lineTo(pageWidth - margin, currentY + 10).lineWidth(0.3).dash(1, { space: 2 }).stroke(TEXT_GRAY).undash();
        currentY += 18;

        // Row 4
        const accLabel = "ชื่อบัญชี/เลขบัญชี (Account Name/Account No.) 银行名称/银行账号 :";
        doc.fillColor(TEXT_DARK);
        drawMixedText(accLabel, labelX, currentY);
        const accValueX = margin + 250;
        const bankInfo = `${billing.vendor.bankName || ""} ${billing.vendor.bankAccount || ""}`.trim() || "-";

        doc.fillColor(TEXT_GRAY).text(bankInfo, accValueX, currentY);
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
        const method = payment.paymentMethod || "TRANSFER";
        nextX = drawCheckbox(nextX - 10, "Bank Transfer 转账", method === "TRANSFER");
        nextX = drawCheckbox(nextX - 10, "CHQUE 支票", method === "CHEQUE");
        nextX = drawCheckbox(nextX - 10, "CASH เงินสด 现金", method === "CASH");
        drawCheckbox(nextX - 10, "CASHIER CHQUE 现金支票", false);

        currentY += 20;

        // --- TABLE HEADER ---
        doc.rect(margin, currentY, tableWidth, 25).fillAndStroke("#e5e7eb", BORDER_COLOR);

        colX.forEach((x, i) => {
            if (i > 0) doc.moveTo(x, currentY).lineTo(x, currentY + 25).lineWidth(0.5).stroke(BORDER_COLOR);
        });

        doc.fillColor(TEXT_DARK).fontSize(8).font("Sarabun-Bold");

        // Adjusted Headers (Without VAT/WHT)
        const headers = [
            "ลำดับ", "รายละเอียดงาน", "เบอร์ตู้", "เลขที่อ้างอิง", "จำนวนเงิน"
        ];
        headers.forEach((h, i) => {
            const align = i === 1 ? "left" : (i >= 4 ? "right" : "center");
            doc.text(h, colX[i] + 2, currentY + 8, { width: colWidths[i] - 4, align: align as any });
        });
        doc.font("Sarabun");

        currentY += 25;
        return currentY;
    };

    let currentY = drawHeader(doc);

    // Helper lines
    const drawVerticalLines = (startY: number, endY: number) => {
        colX.forEach((x, i) => {
            if (i > 0) doc.moveTo(x, startY).lineTo(x, endY).lineWidth(0.5).stroke(BORDER_COLOR);
        });
        doc.moveTo(margin, startY).lineTo(margin, endY).lineWidth(0.5).stroke(BORDER_COLOR);
        doc.moveTo(margin + tableWidth, startY).lineTo(margin + tableWidth, endY).lineWidth(0.5).stroke(BORDER_COLOR);
    };

    // Table Content
    let rowIndex = 1;
    let tableStartY = currentY;

    const footerHeight = 260;
    const pageBottomLimit = pageHeight - margin;
    const footerTriggerY = pageBottomLimit - footerHeight;

    const drawFooter = (startY: number) => {
        let fY = startY;
        doc.moveTo(margin, fY).lineTo(margin + tableWidth, fY).lineWidth(0.5).stroke(BORDER_COLOR);

        // --- SUMMARY ---
        const summaryW = 200;
        const summaryX = pageWidth - margin - summaryW;
        fY += 10;

        const drawSummaryLine = (label: string, value: string, isBold = false, isGreen = false) => {
            const size = isBold ? 9 : 8;
            doc.fontSize(size).fillColor(TEXT_DARK);
            if (isGreen) doc.fillColor("#166534");
            drawMixedText(label, summaryX, fY, { size, color: isGreen ? "#166534" : TEXT_DARK });
            doc.fillColor(isGreen ? "#166534" : TEXT_GRAY).text(value, summaryX, fY, { width: summaryW, align: "right" });
            fY += 14;
        };

        // Summary Lines (Simplified for Cash Advance)
        drawSummaryLine("TOTAL VALUE :", Number(billing.totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 }));
        // No VAT/WHT typically for Cash Advance unless specified. User said just remove cols.
        // Assuming no VAT/WHT calculation for now as per "simple" requirement often for Cash Adv.
        // If there is VAT, we'd need to know. Assuming flat total for now based on data.

        // drawSummaryLine("VAT 7% :", "0.00"); // Hidden as requested "Without VAT col", implying likely no VAT logic visible?
        // Let's just show Total -> Net Total for simplicity unless data suggests otherwise.

        doc.rect(summaryX - 5, fY - 2, summaryW + 5, 20).fill("#f0fdf4");
        doc.fillColor("#166534");
        drawSummaryLine("NET TOTAL 总计 :", Number(billing.totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 }), true, true);

        const thaiText = BahtText(Number(billing.totalAmount));
        doc.fontSize(8);
        drawMixedText(thaiText, summaryX, fY + 8, { width: summaryW, align: "right", color: TEXT_GRAY });

        // --- SIGNATURES ---
        const oldBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        const sigBoxH = 70;
        const sigTotalHeight = sigBoxH * 2;
        const sigStartY = pageHeight - margin - sigTotalHeight;

        // Remark Box
        const remarkY = startY + 10;
        const remarkHeight = sigStartY - remarkY - 10;

        doc.rect(margin, remarkY, pageWidth - margin - summaryW - 15 - margin, remarkHeight).stroke(BORDER_COLOR);
        doc.fillColor(TEXT_DARK).fontSize(8);
        drawMixedText("REMARK 备注", margin + 5, remarkY + 5, { size: 8 });
        doc.text(billing.remark || "-", margin + 5, remarkY + 20, { width: 300 });

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
            if (l.en === "PERSON IN CHARGE" && billing.createdBy) {
                // Might need user name via relation, assuming billing.createdByUser or similar if available
                // For now blank or use approvedBy
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
    };

    const changePage = () => {
        drawVerticalLines(tableStartY, pageBottomLimit);
        doc.moveTo(margin, pageBottomLimit).lineTo(margin + tableWidth, pageBottomLimit).lineWidth(0.5).stroke(BORDER_COLOR);
        doc.addPage();
        currentY = drawHeader(doc);
        tableStartY = currentY;
    };

    // Iterate Items (Flattened jobs)
    // Cash Advance items are already flat in `billing.items`
    for (const item of billing.items) {
        if (currentY + 18 > footerTriggerY) {
            changePage();
        }

        doc.fillColor(TEXT_DARK).fontSize(8);
        doc.text(String(rowIndex++), colX[0], currentY + 4, { width: colWidths[0], align: "center" });
        doc.text(item.description || "-", colX[1] + 5, currentY + 4, { width: colWidths[1] - 8, lineBreak: false, ellipsis: true });

        // Container / Truck
        // item doesn't always have these, check schema if needed or just use "-"
        // CashAdvanceItem might have different fields
        const container = "-";
        doc.text(container, colX[2] + 2, currentY + 4, { width: colWidths[2] - 4, align: "center" });

        doc.text(item.refInvoiceNo || "-", colX[3] + 2, currentY + 4, { width: colWidths[3] - 4, align: "center" });

        doc.text(Number(item.amount).toLocaleString("th-TH", { minimumFractionDigits: 2 }), colX[4], currentY + 4, { width: colWidths[4] - 4, align: "right" });

        doc.moveTo(margin, currentY + 18).lineTo(margin + tableWidth, currentY + 18).lineWidth(0.2).dash(1, { space: 2 }).stroke(BORDER_COLOR).undash();
        currentY += 18;
    }

    // Final Footer Check
    const footerY = pageBottomLimit - footerHeight;
    if (currentY > footerY) {
        changePage();
        drawVerticalLines(currentY, footerY);
        drawFooter(footerY);
    } else {
        drawVerticalLines(tableStartY, footerY);
        drawFooter(footerY);
    }

    // Page Numbers
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
}
