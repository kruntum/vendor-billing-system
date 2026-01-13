import { createPortal } from "react-dom";
import { Job } from "@/lib/api";
import { format } from "date-fns";
import { th } from "date-fns/locale";

interface JobDetailModalProps {
    job: Job | null;
    onClose: () => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
    }).format(amount);
};

const safeFormatDate = (dateString: string | undefined | null, formatStr: string) => {
    if (!dateString) return "-";
    try {
        return format(new Date(dateString), formatStr, { locale: th });
    } catch (error) {
        return "-";
    }
};

export function JobDetailModal({ job, onClose }: JobDetailModalProps) {
    if (!job) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/50 backdrop-blur-sm p-4 md:p-0">
            <div className="relative w-full max-w-3xl rounded-lg bg-white shadow-lg ring-1 ring-gray-900/5 my-8 max-h-[90vh] flex flex-col">
                <div className="p-6 flex-1 flex flex-col overflow-hidden">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">รายละเอียดงาน</h2>
                            <p className="text-sm text-gray-500">{job.description}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="overflow-y-auto flex-1 pr-2">
                        {/* General Info */}
                        <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
                            <div>
                                <p className="text-sm text-gray-500">วันที่ตรวจปล่อย</p>
                                <p className="font-medium">{safeFormatDate(job.clearanceDate, "dd MMMM yyyy")}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">สถานะ</p>
                                <span
                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${job.statusJob === "BILLED"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-yellow-100 text-yellow-800"
                                        }`}
                                >
                                    {job.statusJob === "BILLED" ? "วางบิลแล้ว" : "รอดำเนินการ"}
                                </span>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Ref Invoice No.</p>
                                <p className="font-medium">{job.refInvoiceNo || "-"}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Declaration No.</p>
                                <p className="font-medium">{job.declarationNo || "-"}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Container No.</p>
                                <p className="font-medium">{job.containerNo || "-"}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">ทะเบียนรถ</p>
                                <p className="font-medium">{job.truckPlate || "-"}</p>
                            </div>
                        </div>

                        {/* Items */}
                        <h3 className="font-semibold mb-3">รายการค่าใช้จ่าย ({job.items.length} รายการ)</h3>
                        <div className="border rounded-lg overflow-hidden mb-6">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">รายการ</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">จำนวนเงิน</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {job.items.map((item, index) => (
                                        <tr key={index}>
                                            <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(Number(item.amount))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50">
                                    <tr>
                                        <td className="px-4 py-3 text-sm font-semibold text-right">รวมทั้งหมด</td>
                                        <td className="px-4 py-3 text-sm text-right font-bold text-primary">
                                            {formatCurrency(job.totalAmount)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t mt-4">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                            ปิด
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
