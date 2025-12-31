import { createPortal } from "react-dom";
import { BillingNote } from "@/lib/api";
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

// Icons
const PrintIcon = () => (
    <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
);

const ReceiptIcon = () => (
    <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

const EditIcon = () => (
    <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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

interface BillingDetailModalProps {
    billing: BillingNote | null;
    onClose: () => void;
    onEdit: () => void;
    onCancel: () => Promise<void>;
    onSubmit: () => Promise<void>;
    onPrint: () => Promise<void>;
    onPrintReceipt: () => Promise<void>;
    onIssueReceipt: () => void;
    isPdfGenerating: boolean;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
    }).format(amount);
};

export function BillingDetailModal({
    billing,
    onClose,
    onEdit,
    onCancel,
    onSubmit,
    onPrint,
    onPrintReceipt,
    onIssueReceipt,
    isPdfGenerating,
}: BillingDetailModalProps) {
    if (!billing) return null;

    const canEdit = billing.statusBillingNote === "PENDING";
    const canIssueReceipt = billing.statusBillingNote === "APPROVED" && !billing.receipt;
    const hasReceipt = !!billing.receipt;

    return createPortal(
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
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
                                    className={`font-medium ${billing.statusBillingNote === "APPROVED"
                                        ? "text-green-600"
                                        : billing.statusBillingNote === "PAID"
                                            ? "text-green-600"
                                            : billing.statusBillingNote === "SUBMITTED"
                                                ? "text-blue-600"
                                                : billing.statusBillingNote === "PENDING"
                                                    ? "text-yellow-600"
                                                    : billing.statusBillingNote === "CANCELLED"
                                                        ? "text-red-600"
                                                        : "text-gray-600"
                                        }`}
                                >
                                    {billing.statusBillingNote === "APPROVED"
                                        ? "อนุมัติแล้ว"
                                        : billing.statusBillingNote === "PAID"
                                            ? "ชำระแล้ว"
                                            : billing.statusBillingNote === "SUBMITTED"
                                                ? "ส่งแล้ว"
                                                : billing.statusBillingNote === "PENDING"
                                                    ? "รอดำเนินการ"
                                                    : billing.statusBillingNote === "CANCELLED"
                                                        ? "ยกเลิก"
                                                        : billing.statusBillingNote}
                                </p>
                            </div>
                            {billing.receipt && (
                                <div>
                                    <p className="text-sm text-gray-500">เลขที่ใบเสร็จ</p>
                                    <p className="font-medium text-green-600">{billing.receipt.receiptRef}</p>
                                </div>
                            )}
                        </div>

                        {billing.remark && (
                            <div>
                                <p className="text-sm text-gray-500">หมายเหตุ</p>
                                <p className="font-medium">{billing.remark}</p>
                            </div>
                        )}
                    </div>

                    {/* Jobs Table */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-3">รายการงาน</h3>
                        <div className="border rounded-lg overflow-hidden">
                            <div className="max-h-96 overflow-y-auto relative">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 w-16">#</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">วันที่</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">รายละเอียด</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">เบอร์ตู้/ทะเบียน</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">เลขที่อ้างอิง</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">จำนวนเงิน</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {billing.jobs?.map((job, index) => (
                                            <tr key={job.id}>
                                                <td className="px-4 py-2 text-sm text-center text-gray-500 font-medium">{index + 1}</td>
                                                <td className="px-4 py-2 text-sm whitespace-nowrap">
                                                    {job.clearanceDate ? format(new Date(job.clearanceDate), "dd/MM/yyyy") : "-"}
                                                </td>
                                                <td className="px-4 py-2 text-sm">{job.description}</td>
                                                <td className="px-4 py-2 text-sm">
                                                    <div className="flex flex-col">
                                                        {job.containerNo && <span>{job.containerNo}</span>}
                                                        {job.truckPlate && <span>{job.truckPlate}</span>}
                                                        {!job.containerNo && !job.truckPlate && <span>-</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-sm">{job.refInvoiceNo}</td>
                                                <td className="px-4 py-2 text-sm text-right">{job.totalAmount.toLocaleString()}</td>
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
                            <div className="flex justify-between">
                                <span>รวมเป็นเงิน:</span>
                                <span>{formatCurrency(billing.subtotal)}</span>
                            </div>
                            {billing.priceBeforeVat && (
                                <div className="flex justify-between">
                                    <span>มูลค่าก่อนภาษีมูลค่าเพิ่ม:</span>
                                    <span>{formatCurrency(billing.priceBeforeVat)}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span>ภาษีมูลค่าเพิ่ม {billing.vatRateText || "7%"}:</span>
                                <span>{formatCurrency(billing.vatAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>หัก ณ ที่จ่าย {billing.whtRateText || "3%"}:</span>
                                <span className="text-red-600">-{formatCurrency(billing.whtAmount)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-lg border-t pt-2">
                                <span>ยอดสุทธิ:</span>
                                <span className="text-green-600">{formatCurrency(billing.netTotal)}</span>
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

                        {hasReceipt && (
                            <button
                                onClick={onPrintReceipt}
                                disabled={isPdfGenerating}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                            >
                                <ReceiptIcon />
                                พิมพ์ใบเสร็จ
                            </button>
                        )}

                        {canIssueReceipt && (
                            <button
                                onClick={onIssueReceipt}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                            >
                                <ReceiptIcon />
                                ออกใบเสร็จ
                            </button>
                        )}

                        {canEdit && (
                            <>
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

                                <button
                                    onClick={onEdit}
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center"
                                >
                                    <EditIcon />
                                    แก้ไข
                                </button>

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
                                                การดำเนินการนี้จะคืนสถานะงานทั้งหมดกลับเป็น "รอดำเนินการ"
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
                            </>
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
        </div>,
        document.body
    );
}
