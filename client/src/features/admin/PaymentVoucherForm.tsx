import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { paymentVoucherApi, VendorSummary } from "@/lib/api";
import { format, parseISO, isValid } from "date-fns";
import { th } from "date-fns/locale";
import { toast } from "sonner";

interface PaymentVoucherFormProps {
    vendors: VendorSummary[];
    onClose: () => void;
    onSuccess: () => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
    }).format(amount);
};

const safeFormatDate = (dateString: string | undefined | null, formatStr: string) => {
    if (!dateString) return "-";
    const date = parseISO(dateString);
    if (!isValid(date)) return "-";
    return format(date, formatStr, { locale: th });
};

export function PaymentVoucherForm({ vendors, onClose, onSuccess }: PaymentVoucherFormProps) {
    const [selectedVendorId, setSelectedVendorId] = useState<string>("");
    const [selectedBillingIds, setSelectedBillingIds] = useState<string[]>([]);
    const [voucherDate, setVoucherDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
    const [remark, setRemark] = useState<string>("");

    // Query submitted billing notes for selected vendor
    const { data: billingData, isLoading: billingLoading } = useQuery({
        queryKey: ["submitted-billings", selectedVendorId],
        queryFn: () => paymentVoucherApi.getSubmittedBillings(selectedVendorId).then((res) => res.data.data),
        enabled: !!selectedVendorId,
    });

    const billingNotes = billingData || [];

    // Calculate totals from selected billing notes
    const totals = useMemo(() => {
        const selected = billingNotes.filter((bn) => selectedBillingIds.includes(bn.id));
        return {
            subtotal: selected.reduce((sum, bn) => sum + Number(bn.subtotal), 0),
            vatAmount: selected.reduce((sum, bn) => sum + Number(bn.vatAmount), 0),
            whtAmount: selected.reduce((sum, bn) => sum + Number(bn.whtAmount), 0),
            netTotal: selected.reduce((sum, bn) => sum + Number(bn.netTotal), 0),
            count: selected.length,
        };
    }, [billingNotes, selectedBillingIds]);

    // Create mutation
    const createMutation = useMutation({
        mutationFn: () =>
            paymentVoucherApi.create({
                vendorId: selectedVendorId,
                billingNoteIds: selectedBillingIds,
                voucherDate,
                remark: remark || undefined,
            }),
        onSuccess: () => {
            toast.success("สร้างใบสำคัญจ่ายเรียบร้อยแล้ว");
            onSuccess();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || "เกิดข้อผิดพลาดในการสร้างใบสำคัญจ่าย");
        },
    });

    const handleSelectAll = () => {
        if (selectedBillingIds.length === billingNotes.length) {
            setSelectedBillingIds([]);
        } else {
            setSelectedBillingIds(billingNotes.map((bn) => bn.id));
        }
    };

    const handleToggleBilling = (id: string) => {
        setSelectedBillingIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleSubmit = () => {
        if (!selectedVendorId) {
            toast.error("กรุณาเลือก Vendor");
            return;
        }
        if (selectedBillingIds.length === 0) {
            toast.error("กรุณาเลือกใบวางบิลอย่างน้อย 1 ใบ");
            return;
        }
        createMutation.mutate();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-xl font-bold">สร้างใบสำคัญจ่าย</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Step 1: Select Vendor */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            1. เลือก Vendor <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={selectedVendorId}
                            onChange={(e) => {
                                setSelectedVendorId(e.target.value);
                                setSelectedBillingIds([]); // Reset selections
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                            <option value="">-- เลือก Vendor --</option>
                            {vendors.map((vendor) => (
                                <option key={vendor.id} value={vendor.id}>
                                    {vendor.companyName}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Step 2: Select Billing Notes */}
                    {selectedVendorId && (
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    2. เลือกใบวางบิล (สถานะ: ส่งแล้ว) <span className="text-red-500">*</span>
                                </label>
                                {billingNotes.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleSelectAll}
                                        className="text-sm text-primary hover:underline"
                                    >
                                        {selectedBillingIds.length === billingNotes.length ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
                                    </button>
                                )}
                            </div>

                            {billingLoading ? (
                                <p className="text-gray-500">กำลังโหลด...</p>
                            ) : billingNotes.length === 0 ? (
                                <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
                                    ไม่มีใบวางบิลที่สถานะ "ส่งแล้ว" สำหรับ Vendor นี้
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-10">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedBillingIds.length === billingNotes.length && billingNotes.length > 0}
                                                        onChange={handleSelectAll}
                                                        className="rounded border-gray-300"
                                                    />
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">เลขที่</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">วันที่</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">ยอดรวม</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">VAT</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">หัก ณ ที่จ่าย</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">สุทธิ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {billingNotes.map((bn) => (
                                                <tr
                                                    key={bn.id}
                                                    onClick={() => handleToggleBilling(bn.id)}
                                                    className={`cursor-pointer hover:bg-blue-50 ${selectedBillingIds.includes(bn.id) ? "bg-blue-50" : ""}`}
                                                >
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedBillingIds.includes(bn.id)}
                                                            onChange={() => handleToggleBilling(bn.id)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="rounded border-gray-300"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-medium">{bn.billingRef}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">{safeFormatDate(bn.billingDate, "dd/MM/yyyy")}</td>
                                                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(Number(bn.subtotal))}</td>
                                                    <td className="px-4 py-3 text-sm text-right text-blue-600">{formatCurrency(Number(bn.vatAmount))}</td>
                                                    <td className="px-4 py-3 text-sm text-right text-red-600">-{formatCurrency(Number(bn.whtAmount))}</td>
                                                    <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(Number(bn.netTotal))}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Summary & Details */}
                    {selectedBillingIds.length > 0 && (
                        <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                            <h3 className="font-semibold text-green-800 mb-3">3. สรุปยอด ({totals.count} ใบ)</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-500">ยอดรวม</p>
                                    <p className="font-semibold">{formatCurrency(totals.subtotal)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">VAT รวม</p>
                                    <p className="font-semibold text-blue-600">{formatCurrency(totals.vatAmount)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">หัก ณ ที่จ่าย รวม</p>
                                    <p className="font-semibold text-red-600">-{formatCurrency(totals.whtAmount)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">ยอดสุทธิ</p>
                                    <p className="font-bold text-green-700 text-lg">{formatCurrency(totals.netTotal)}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Voucher Date & Remark */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                วันที่ใบสำคัญจ่าย <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={voucherDate}
                                onChange={(e) => setVoucherDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                หมายเหตุ (ถ้ามี)
                            </label>
                            <input
                                type="text"
                                value={remark}
                                onChange={(e) => setRemark(e.target.value)}
                                placeholder="หมายเหตุเพิ่มเติม..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={createMutation.isPending || selectedBillingIds.length === 0}
                            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {createMutation.isPending ? "กำลังสร้าง..." : "สร้างใบสำคัญจ่าย"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
