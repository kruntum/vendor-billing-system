import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi, receiptApi, BillingNote } from "@/lib/api";
import { format, isValid } from "date-fns";
import { formatCurrency } from "@/lib/utils";

interface ReceiptFormProps {
    onClose: () => void;
    onSuccess: () => void;
}

// Helper for safe date formatting
const safeFormatDate = (dateString: string | undefined | null, formatStr: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (!isValid(date)) return "-";
    return format(date, formatStr);
};

export function ReceiptForm({ onClose, onSuccess }: ReceiptFormProps) {
    const [step, setStep] = useState<"select" | "confirm">("select");
    const [selectedBilling, setSelectedBilling] = useState<BillingNote | null>(null);
    const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const queryClient = useQueryClient();

    // Fetch all billing notes (we'll filter on the client side)
    const { data: billingResponse, isLoading } = useQuery({
        queryKey: ["billing", "for-receipt"],
        queryFn: () => billingApi.list().then((res) => res.data),
    });

    // Filter: billing notes that have no receipt AND are not CANCELLED or PAID
    // Changed from APPROVED to include PENDING
    const availableBillingNotes = Array.isArray(billingResponse?.data)
        ? billingResponse.data.filter(
            (b) => !b.receipt && b.statusBillingNote !== "CANCELLED" && b.statusBillingNote !== "PAID"
        )
        : [];

    const handleSelectBilling = (billing: BillingNote) => {
        setSelectedBilling(billing);
        setReceiptDate(new Date().toISOString().split("T")[0]);
        setStep("confirm");
    };

    const handleConfirmCreate = async () => {
        if (!selectedBilling) return;
        setIsSubmitting(true);
        try {
            await receiptApi.create(selectedBilling.id, new Date(receiptDate).toISOString());
            queryClient.invalidateQueries({ queryKey: ["receipts"] });
            queryClient.invalidateQueries({ queryKey: ["billing"] });
            onSuccess();
        } catch (error) {
            console.error("Create receipt error:", error);
            alert("ไม่สามารถสร้างใบเสร็จได้");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "PENDING":
                return (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        รอดำเนินการ
                    </span>
                );
            case "SUBMITTED":
                return (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        ส่งแล้ว
                    </span>
                );
            case "APPROVED":
                return (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        อนุมัติแล้ว
                    </span>
                );
            default:
                return (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                        {status}
                    </span>
                );
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/50 backdrop-blur-sm p-4 md:p-0">
            <div className="relative w-full max-w-3xl rounded-lg bg-white shadow-lg ring-1 ring-gray-900/5 my-8 max-h-[90vh] flex flex-col">
                <div className="p-6 flex-1 flex flex-col overflow-hidden">
                    <h2 className="text-xl font-bold mb-6">
                        {step === "select" ? "เลือกใบวางบิลเพื่อออกใบเสร็จ" : "ยืนยันการออกใบเสร็จ"}
                    </h2>

                    <div className="flex-1 overflow-y-auto">
                        {step === "select" ? (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-500">
                                    เลือกใบวางบิลที่ต้องการออกใบเสร็จ (สถานะ PENDING, SUBMITTED หรือ APPROVED)
                                </p>

                                {isLoading ? (
                                    <div className="text-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                        <p className="mt-2 text-gray-500">กำลังโหลด...</p>
                                    </div>
                                ) : availableBillingNotes.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        ไม่มีใบวางบิลที่รอออกใบเสร็จ
                                    </div>
                                ) : (
                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                        เลขที่
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                        วันที่วางบิล
                                                    </th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                                        สถานะ
                                                    </th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                                        ยอดเงิน
                                                    </th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                                        เลือก
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {availableBillingNotes.map((note) => (
                                                    <tr
                                                        key={note.id}
                                                        className="hover:bg-gray-50 cursor-pointer"
                                                        onClick={() => handleSelectBilling(note)}
                                                    >
                                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                            {note.billingRef}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-500">
                                                            {safeFormatDate(note.billingDate, "dd/MM/yyyy")}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {getStatusBadge(note.statusBillingNote)}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                                            {formatCurrency(Number(note.netTotal))}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSelectBilling(note);
                                                                }}
                                                                className="px-3 py-1 bg-green-50 text-green-600 rounded-md hover:bg-green-100 text-sm font-medium"
                                                            >
                                                                เลือก
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Selected Billing Summary */}
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-medium text-gray-900 mb-3">ใบวางบิลที่เลือก</h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-gray-500">เลขที่ใบวางบิล</p>
                                            <p className="font-medium">{selectedBilling?.billingRef}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">วันที่วางบิล</p>
                                            <p className="font-medium">
                                                {safeFormatDate(selectedBilling?.billingDate, "dd/MM/yyyy")}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">สถานะ</p>
                                            {selectedBilling && getStatusBadge(selectedBilling.statusBillingNote)}
                                        </div>
                                        <div>
                                            <p className="text-gray-500">ยอดสุทธิ</p>
                                            <p className="font-medium text-primary text-lg">
                                                {formatCurrency(Number(selectedBilling?.netTotal || 0))}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Receipt Date Input */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        วันที่รับเงิน (Receipt Date)
                                    </label>
                                    <input
                                        type="date"
                                        value={receiptDate}
                                        onChange={(e) => setReceiptDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        required
                                    />
                                </div>

                                {/* Warning */}
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <p className="text-sm text-yellow-800">
                                        <strong>คำเตือน:</strong> เมื่อออกใบเสร็จแล้วจะไม่สามารถแก้ไขหรือยกเลิกเอกสารได้
                                        กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนยืนยัน
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-2 pt-6 border-t border-gray-200 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                        >
                            ยกเลิก
                        </button>
                        {step === "confirm" && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setStep("select")}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300"
                                >
                                    ย้อนกลับ
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmCreate}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    {isSubmitting ? "กำลังสร้าง..." : "ยืนยันออกใบเสร็จ"}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
