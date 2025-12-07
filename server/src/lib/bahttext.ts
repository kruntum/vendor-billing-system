/**
 * แปลงตัวเลขเป็นคำอ่านภาษาไทย (BahtText)
 * Convert a number to Thai Baht text representation.
 *
 * @param amount - ยอดเงิน (รองรับทศนิยม 2 ตำแหน่ง)
 * @returns ข้อความภาษาไทย เช่น "(หนึ่งร้อยบาทห้าสิบสตางค์)"
 */

// คำอ่านตัวเลข
const THAI_DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];

// คำอ่านหลัก (หน่วย, สิบ, ร้อย, พัน, หมื่น, แสน, ล้าน)
const POSITIONS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

/**
 * แปลงตัวเลขจำนวนเต็มเป็นคำอ่านภาษาไทย
 */
function readInteger(num: number): string {
    if (num === 0) return THAI_DIGITS[0];

    let result = "";
    let position = 0;
    let remaining = Math.floor(num);

    while (remaining > 0) {
        const digit = remaining % 10;

        if (position % 6 === 0 && position > 0) {
            // ล้าน
            result = POSITIONS[6] + result;
        }

        const posInGroup = position % 6;

        if (digit !== 0) {
            let digitWord = THAI_DIGITS[digit];

            // กฎพิเศษ: "เอ็ด" แทน "หนึ่ง" ในหลักหน่วย (ยกเว้นกรณีเลขหลักเดียว)
            if (digit === 1 && posInGroup === 0 && num > 10) {
                digitWord = "เอ็ด";
            }

            // กฎพิเศษ: "ยี่" แทน "สอง" ในหลักสิบ
            if (digit === 2 && posInGroup === 1) {
                digitWord = "ยี่";
            }

            // กฎพิเศษ: ไม่ต้องอ่าน "หนึ่ง" ในหลักสิบ (เช่น 10 อ่านว่า "สิบ" ไม่ใช่ "หนึ่งสิบ")
            if (digit === 1 && posInGroup === 1) {
                digitWord = "";
            }

            result = digitWord + POSITIONS[posInGroup] + result;
        }

        remaining = Math.floor(remaining / 10);
        position++;
    }

    return result;
}

/**
 * แปลงยอดเงินเป็นคำอ่านภาษาไทย
 * @param amount - ยอดเงิน (รองรับทศนิยม 2 ตำแหน่ง)
 * @returns ข้อความภาษาไทย เช่น "(หนึ่งร้อยบาทห้าสิบสตางค์)" หรือ "(หนึ่งร้อยบาทถ้วน)"
 */
export function BahtText(amount: number): string {
    if (amount === 0) {
        return "(ศูนย์บาทถ้วน)";
    }

    // แยกส่วนจำนวนเต็มและทศนิยม
    const absAmount = Math.abs(amount);
    const integerPart = Math.floor(absAmount);
    const decimalPart = Math.round((absAmount - integerPart) * 100); // สตางค์

    let result = "";

    // อ่านส่วนจำนวนเต็ม (บาท)
    if (integerPart > 0) {
        result += readInteger(integerPart) + "บาท";
    }

    // อ่านส่วนทศนิยม (สตางค์)
    if (decimalPart > 0) {
        result += readInteger(decimalPart) + "สตางค์";
    } else {
        result += "ถ้วน";
    }

    // ใส่วงเล็บ
    return "(" + result + ")";
}

export default BahtText;
