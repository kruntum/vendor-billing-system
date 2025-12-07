import { createPortal } from "react-dom";
import { useState } from "react";

interface ReceiptDateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (date: string) => Promise<void>;
    billingRef: string;
}

export function ReceiptDateModal({
    isOpen,
    onClose,
    onConfirm,
    billingRef,
}: ReceiptDateModalProps) {
    const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            await onConfirm(receiptDate);
            onClose();
        } catch (error) {
            console.error("Receipt creation error:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">ออกใบเสร็จ</h2>
                    <p className="text-sm text-gray-500">ใบวางบิลเลขที่: {billingRef}</p>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        วันที่ออกใบเสร็จ
                    </label>
                    <input
                        type="date"
                        value={receiptDate}
                        onChange={(e) => setReceiptDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                        {isSubmitting ? "กำลังออกใบเสร็จ..." : "ยืนยัน"}
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
