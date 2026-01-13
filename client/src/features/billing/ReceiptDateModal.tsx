import { createPortal } from "react-dom";
import { useState } from "react";

interface ReceiptDateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: any) => Promise<void>;
    billingRef: string;
}

export function ReceiptDateModal({
    isOpen,
    onClose,
    onConfirm,
    billingRef,
}: ReceiptDateModalProps) {
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
    const [paymentMethod, setPaymentMethod] = useState<"TRANSFER" | "CASH" | "CHEQUE" | "CASHIER_CHEQUE">("TRANSFER");
    const [paymentRef, setPaymentRef] = useState("-");
    const [bankInfo, setBankInfo] = useState("-");
    const [remark, setRemark] = useState("-");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            await onConfirm({
                paymentDate,
                paymentMethod,
                paymentRef,
                bankInfo,
                remark,
            });
            onClose();
        } catch (error) {
            console.error("Receipt creation error:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">ยืนยันการรับเงิน / ออกใบเสร็จ</h2>
                    <p className="text-sm text-gray-500">สำหรับใบวางบิลเลขที่: {billingRef}</p>
                </div>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            วันที่รับเงิน
                        </label>
                        <input
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            วิธีการชำระเงิน
                        </label>
                        <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value as any)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="TRANSFER">โอนเงิน (Transfer)</option>
                            <option value="CASH">เงินสด (Cash)</option>
                            <option value="CHEQUE">เช็ค (Cheque)</option>
                            <option value="CASHIER_CHEQUE">แคชเชียร์เช็ค (Cashier Cheque)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            เลขอ้างอิง / เลขที่เช็ค
                        </label>
                        <input
                            type="text"
                            value={paymentRef}
                            onChange={(e) => setPaymentRef(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="เช่น เลขที่สลิป หรือ เลขที่เช็ค"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            ธนาคาร / สาขา (ถ้ามี)
                        </label>
                        <input
                            type="text"
                            value={bankInfo}
                            onChange={(e) => setBankInfo(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="ระบุธนาคาร (กรณีเช็ค)"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            หมายเหตุ
                        </label>
                        <input
                            type="text"
                            value={remark}
                            onChange={(e) => setRemark(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                        {isSubmitting ? "กำลังบันทึก..." : "ยืนยันการรับเงิน"}
                    </button>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                    >
                        ยกเลิก
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
