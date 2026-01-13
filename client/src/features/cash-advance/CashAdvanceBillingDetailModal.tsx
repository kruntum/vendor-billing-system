import { createPortal } from "react-dom";
import { CashAdvanceBilling, CreateCashAdvancePaymentInput } from "@/lib/api";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CashAdvancePaymentModal } from "@/features/cash-advance/CashAdvancePaymentModal";
import { useState } from "react";

// Icons
const PrintIcon = () => (
    <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
);

const CancelIcon = () => (
    <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const CloseIcon = () => (
    <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

// Send Icon
const SendIcon = () => (
    <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
);

interface CashAdvanceBillingDetailModalProps {
    billing: CashAdvanceBilling | null;
    onClose: () => void;
    // onEdit: () => void; // Unused for now
    onCancel: () => Promise<void>;
    onSubmit: () => Promise<void>;
    onApprove: () => Promise<void>;
    onPay: (data: CreateCashAdvancePaymentInput) => Promise<void>;
    onPrint: () => Promise<void>;
    isPdfGenerating: boolean;
    userRole?: string; // "VENDOR" | "ADMIN" | "USER"
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
    }).format(amount);
};

export function CashAdvanceBillingDetailModal({
    billing,
    onClose,
    // onEdit,
    onCancel,
    onSubmit,
    onApprove,
    onPay,
    onPrint,
    isPdfGenerating,
    userRole,
}: CashAdvanceBillingDetailModalProps) {
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isPvGenerating, setIsPvGenerating] = useState(false);

    if (!billing) return null;

    const handlePrintPaymentVoucher = async () => {
        if (!billing.payment) return;
        setIsPvGenerating(true);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`/api/pdf/cash-advance-payment/${billing.id}/preview`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error("Failed to load PDF");
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            window.open(url + "#view=Fit", "_blank");
        } catch (error) {
            console.error(error);
            alert("ไม่สามารถโหลด PDF ใบสำคัญจ่ายได้");
        } finally {
            setIsPvGenerating(false);
        }
    };

    const isVendor = userRole === "VENDOR";
    const canSubmit = isVendor && billing.status === "PENDING";
    const canCancel = isVendor ? billing.status === "PENDING" : (billing.status !== "PAID" && billing.status !== "CANCELLED");

    // Admin/User Actions
    const canApprove = !isVendor && billing.status === "SUBMITTED";
    const canPay = !isVendor && (billing.status === "APPROVED" || billing.status === "SUBMITTED");

    return createPortal(
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">รายละเอียดใบวางบิล</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                        >
                            ×
                        </button>
                    </div>

                    {/* Billing Info */}
                    <div className="space-y-4 mb-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-500">เลขที่ใบวางบิล</p>
                                <p className="font-medium">{billing.billingRef}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">วันที่</p>
                                <p className="font-medium">
                                    {format(new Date(billing.billingDate), "d MMMM yyyy", { locale: th })}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">สถานะ</p>
                                <p
                                    className={`font-medium ${billing.status === "APPROVED"
                                        ? "text-green-600"
                                        : billing.status === "PAID"
                                            ? "text-green-600"
                                            : billing.status === "SUBMITTED"
                                                ? "text-blue-600"
                                                : billing.status === "PENDING"
                                                    ? "text-yellow-600"
                                                    : billing.status === "CANCELLED"
                                                        ? "text-red-600"
                                                        : "text-gray-600"
                                        }`}
                                >
                                    {billing.status === "APPROVED"
                                        ? "อนุมัติแล้ว"
                                        : billing.status === "PAID"
                                            ? "ชำระแล้ว"
                                            : billing.status === "SUBMITTED"
                                                ? "ส่งแล้ว"
                                                : billing.status === "PENDING"
                                                    ? "รอดำเนินการ"
                                                    : billing.status === "CANCELLED"
                                                        ? "ยกเลิก"
                                                        : billing.status}
                                </p>
                            </div>
                        </div>

                        {billing.remark && (
                            <div>
                                <p className="text-sm text-gray-500">หมายเหตุ</p>
                                <p className="font-medium">{billing.remark}</p>
                            </div>
                        )}

                        {/* Payment Info (if PAID) */}
                        {billing.payment && (
                            <div className="border-t pt-4 mt-4">
                                <h3 className="font-semibold text-gray-900 mb-3">ข้อมูลการการจ่ายเงิน</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-500">เลขที่เอกสารการจ่าย</p>
                                        <p className="font-medium">{billing.payment.paymentRef}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">วันที่จ่าย</p>
                                        <p className="font-medium">{format(new Date(billing.payment.paymentDate), "d/MM/yyyy")}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">วิธีการจ่าย</p>
                                        <p className="font-medium">{billing.payment.paymentMethod}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">ยอดเงิน</p>
                                        <p className="font-medium text-green-600">{formatCurrency(billing.payment.amount)}</p>
                                    </div>
                                    {billing.payment.chequeNo && (
                                        <div>
                                            <p className="text-sm text-gray-500">เลขที่เช็ค</p>
                                            <p className="font-medium">{billing.payment.chequeNo}</p>
                                        </div>
                                    )}
                                    {billing.payment.bankInfo && (
                                        <div>
                                            <p className="text-sm text-gray-500">ธนาคาร/บัญชี</p>
                                            <p className="font-medium">{billing.payment.bankInfo}</p>
                                        </div>
                                    )}
                                    {billing.payment.remark && (
                                        <div className="col-span-2">
                                            <p className="text-sm text-gray-500">หมายเหตุการจ่าย</p>
                                            <p className="font-medium">{billing.payment.remark}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Jobs Table */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-3">รายการ (Cash Advances)</h3>
                        <div className="border rounded-lg overflow-hidden">
                            <div className="max-h-96 overflow-y-auto relative">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 w-16">#</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">วันที่</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">รายละเอียด</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Ref Invoice</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">จำนวนเงิน</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {billing.items?.map((item, index) => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-2 text-sm text-center text-gray-500 font-medium">{index + 1}</td>
                                                <td className="px-4 py-2 text-sm whitespace-nowrap">
                                                    {format(new Date(item.advanceDate), "dd/MM/yyyy")}
                                                </td>
                                                <td className="px-4 py-2 text-sm">
                                                    {item.description || item.advanceRef}
                                                </td>
                                                <td className="px-4 py-2 text-sm">{item.refInvoiceNo || "-"}</td>
                                                <td className="px-4 py-2 text-sm text-right">{Number(item.totalAmount).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-gray-50 p-4 rounded-lg mb-6">
                        <div className="space-y-2">
                            <div className="flex justify-between font-bold text-lg">
                                <span>ยอดสุทธิ (Net Total):</span>
                                <span className="text-green-600">{formatCurrency(billing.totalAmount)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={onPrint}
                            disabled={isPdfGenerating}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                        >
                            <PrintIcon />
                            {isPdfGenerating ? "กำลังสร้าง PDF..." : "พิมพ์ใบวางบิล"}
                        </button>

                        {/* Print Payment Voucher (Only if PAID) */}
                        {billing.status === "PAID" && (
                            <button
                                onClick={handlePrintPaymentVoucher}
                                disabled={isPvGenerating}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                            >
                                <PrintIcon />
                                {isPvGenerating ? "กำลังสร้าง..." : "พิมพ์ใบสำคัญจ่าย"}
                            </button>
                        )}

                        {/* Vendor: Send Button */}
                        {canSubmit && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center">
                                        <SendIcon />
                                        ส่งใบวางบิล
                                    </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>ยืนยันการส่งใบวางบิล?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            คุณต้องการส่งใบวางบิลเลขที่ {billing.billingRef} ให้ Admin ตรวจสอบใช่หรือไม่?
                                            <br />
                                            หลังจากส่งแล้วจะไม่สามารถแก้ไขได้
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                        <AlertDialogAction onClick={onSubmit} className="bg-blue-600 hover:bg-blue-700">
                                            ยืนยันการส่ง
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}

                        {/* Admin: Approve Button */}
                        {canApprove && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <button className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center">
                                        ยืนยันตรวจสอบ (Approve)
                                    </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>อนุมัติใบวางบิล?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            ยืนยันการอนุมัติใบวางบิลเลขที่ {billing.billingRef}?
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                        <AlertDialogAction onClick={onApprove} className="bg-indigo-600 hover:bg-indigo-700">
                                            ยืนยัน
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}

                        {/* Admin: Pay Button */}
                        {canPay && (
                            <button
                                onClick={() => setIsPaymentModalOpen(true)}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center shadow-sm"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                จ่ายเงิน (Pay)
                            </button>
                        )}

                        {/* Cancel Button */}
                        {canCancel && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <button className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center">
                                        <CancelIcon />
                                        ยกเลิก
                                    </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>ยืนยันการยกเลิก?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            คุณต้องการยกเลิกใบวางบิลเลขที่ {billing.billingRef} ใช่หรือไม่?
                                            <br />
                                            การดำเนินการนี้จะคืนสถานะรายการทั้งหมดกลับเป็น "พร้อมวางบิล"
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                        <AlertDialogAction onClick={onCancel} className="bg-red-600 hover:bg-red-700">
                                            ยืนยันการยกเลิก
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}

                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center"
                        >
                            <CloseIcon />
                            ปิด
                        </button>
                    </div>
                </div>
            </div>

            <CashAdvancePaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onSubmit={(data) => {
                    onPay(data);
                    setIsPaymentModalOpen(false);
                }}
                isLoading={false}
                totalAmount={billing.totalAmount}
            />
        </div>,
        document.body
    );
}
