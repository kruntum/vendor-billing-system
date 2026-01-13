import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cashAdvanceApi, cashAdvanceBillingApi, documentNumberApi, CashAdvanceBilling } from "@/lib/api";
import { format } from "date-fns";

interface CashAdvanceBillingFormProps {
    onClose: () => void;
    onSuccess: () => void;
    initialData?: CashAdvanceBilling;
}

export function CashAdvanceBillingForm({ onClose, onSuccess, initialData }: CashAdvanceBillingFormProps) {
    const [selectedSdkIds, setSelectedSdkIds] = useState<string[]>(
        initialData?.items?.map((item) => item.id) || []
    );
    const [step, setStep] = useState<"select" | "preview">("select");
    const [billingRef, setBillingRef] = useState(initialData?.billingRef || "");
    const [useCustomRef, setUseCustomRef] = useState(false);
    const [remark, setRemark] = useState(initialData?.remark || "");

    // Fetch pending cash advances (Status: PENDING = Ready to bill)
    const { data: advancesResponse, isLoading: isLoadingAdvances } = useQuery({
        queryKey: ["cash-advances", "pending"],
        queryFn: () => cashAdvanceApi.list({ status: "PENDING" }).then((res) => res.data),
        refetchOnMount: "always",
        staleTime: 0,
    });

    // Fetch document number preview (only for new billing)
    const { data: docNumberPreview } = useQuery({
        queryKey: ["documentNumberPreview", "CASH_ADVANCE_BILLING"],
        queryFn: () => documentNumberApi.getPreview("CASH_ADVANCE_BILLING" as any).then((res) => res.data.data),
        enabled: !initialData,
    });

    const pendingAdvances = Array.isArray(advancesResponse?.data) ? advancesResponse.data : [];

    // Combine pending with existing items (if editing)
    const existingItems = initialData?.items || [];
    // Sort by date descending
    const availableAdvances = [...existingItems, ...pendingAdvances].sort((a, b) =>
        new Date(b.advanceDate).getTime() - new Date(a.advanceDate).getTime()
    );

    // Preview mutation
    const previewMutation = useMutation({
        mutationFn: (cashAdvanceIds: string[]) =>
            cashAdvanceBillingApi.preview(cashAdvanceIds),
    });

    // Create mutation
    const createMutation = useMutation({
        mutationFn: (data: { cashAdvanceIds: string[]; billingRef?: string; remark?: string }) =>
            cashAdvanceBillingApi.create(data),
        onSuccess,
    });

    // Note: Update mutation might not exist in the same way for Cash Advance Billing yet, 
    // checking api.ts... updateStatus exists, but general update doesn't seem to be fully fleshed out 
    // or maybe effectively handled. For now assuming CREATE mostly.
    // Actually, wait, `cashAdvanceBillingApi.update` doesn't exist in the api.ts snippet I saw.
    // I saw list, get, preview, create, updateStatus, pay, cancel.
    // So NO update functionality for now? 
    // If initialData is present, it implies viewing/editing... but if no API, maybe just view?
    // User asked for "Clone of BillingForm", BillingForm supports edit.
    // But if backend doesn't support edit content, I can't implement it fully.
    // For now, I'll assume create mode primarily, or disable edit if backend missing.
    // Re-checking api.ts... correct, no update method for content.
    // So I'll focus on CREATE flow. If initialData is passed, maybe it's just for show or not supported yet?
    // Actually, usually "Edit" means editing the billing note (like remark or items).
    // If not supported, I won't include update logic.

    const handleToggleSdk = (id: string) => {
        setSelectedSdkIds((prev) =>
            prev.includes(id)
                ? prev.filter((item) => item !== id)
                : [...prev, id]
        );
    };

    const handleNext = () => {
        if (selectedSdkIds.length === 0) return;
        previewMutation.mutate(selectedSdkIds, {
            onSuccess: () => setStep("preview"),
        });
    };

    const handleSubmit = () => {
        // Only support Create for now as per available API
        createMutation.mutate({ cashAdvanceIds: selectedSdkIds, billingRef, remark });
    };

    const previewData = previewMutation.data?.data?.data;

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/50 backdrop-blur-sm p-4 md:p-0">
            <div className="relative w-full max-w-4xl rounded-lg bg-white shadow-lg ring-1 ring-gray-900/5 my-8 max-h-[90vh] flex flex-col">
                <div className="p-6 flex-1 flex flex-col overflow-hidden">
                    <h2 className="text-xl font-bold mb-6">
                        {initialData ? "แก้ไขใบวางบิลสำรองเงินสด (Edit Cash Advance Billing)" : "สร้างใบวางบิลสำรองเงินสด (Create Cash Advance Billing)"}
                    </h2>

                    <div className="flex-1 overflow-y-auto">
                        {step === "select" ? (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-500">
                                    เลือกรายการสำรองเงินสดที่ต้องการวางบิล (Select Cash Advances to bill)
                                </p>

                                {isLoadingAdvances ? (
                                    <div>Loading...</div>
                                ) : availableAdvances.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        ไม่มีรายการให้เลือก (No items available)
                                    </div>
                                ) : (
                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                availableAdvances.length > 0 &&
                                                                selectedSdkIds.length === availableAdvances.length
                                                            }
                                                            onChange={(e) =>
                                                                setSelectedSdkIds(
                                                                    e.target.checked
                                                                        ? availableAdvances.map((j) => j.id)
                                                                        : []
                                                                )
                                                            }
                                                            className="rounded border-gray-300 text-primary focus:ring-primary"
                                                        />
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        วันที่
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        รายละเอียด
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Ref Invoice
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        จำนวนเงิน
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {availableAdvances.map((advance) => (
                                                    <tr
                                                        key={advance.id}
                                                        className={
                                                            selectedSdkIds.includes(advance.id) ? "bg-blue-50" : ""
                                                        }
                                                        onClick={() => handleToggleSdk(advance.id)}
                                                    >
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedSdkIds.includes(advance.id)}
                                                                onChange={() => handleToggleSdk(advance.id)}
                                                                className="rounded border-gray-300 text-primary focus:ring-primary"
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                            {format(new Date(advance.advanceDate), "dd/MM/yyyy")}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                            {advance.description || advance.advanceRef}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {advance.refInvoiceNo || "-"}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                            {Number(advance.totalAmount).toLocaleString()}
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
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-medium text-gray-900 mb-4">สรุปรายการ (Summary)</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">จำนวนรายการที่เลือก:</span>
                                            <span className="font-medium">{selectedSdkIds.length} รายการ</span>
                                        </div>
                                        <div className="border-t pt-2 mt-2 flex justify-between text-lg font-bold">
                                            <span>ยอดรวม (Total):</span>
                                            <span className="text-primary">
                                                {Number(previewData?.totalAmount || 0).toLocaleString()} บาท
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        เลขที่ใบวางบิล (Billing Ref)
                                    </label>
                                    {!initialData && docNumberPreview?.preview ? (
                                        <div className="mt-1 space-y-2">
                                            <div className={`flex items-center gap-2 p-2 rounded-md border ${useCustomRef
                                                ? "bg-red-50 border-red-200"
                                                : "bg-green-50 border-green-200"
                                                }`}>
                                                {useCustomRef ? (
                                                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                                <span className={`text-sm ${useCustomRef ? "text-red-700 line-through" : "text-green-700"}`}>
                                                    เลขที่อัตโนมัติ: <span className="font-mono font-bold">{docNumberPreview.preview}</span>
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="useCustomRef"
                                                    checked={useCustomRef}
                                                    onChange={(e) => {
                                                        setUseCustomRef(e.target.checked);
                                                        if (!e.target.checked) {
                                                            setBillingRef("");
                                                        }
                                                    }}
                                                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                                                />
                                                <label htmlFor="useCustomRef" className="text-sm text-gray-600">
                                                    กำหนดเลขที่เองแทน
                                                </label>
                                            </div>
                                            {useCustomRef && (
                                                <input
                                                    type="text"
                                                    value={billingRef}
                                                    onChange={(e) => setBillingRef(e.target.value)}
                                                    placeholder="กรอกเลขที่เอกสาร"
                                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            value={billingRef}
                                            onChange={(e) => setBillingRef(e.target.value)}
                                            placeholder={initialData ? initialData.billingRef : "ถ้าไม่กรอก ระบบจะสร้างให้อัตโนมัติ"}
                                            disabled={!!initialData}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2 disabled:bg-gray-100"
                                        />
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        หมายเหตุ (Remark) - Optional
                                    </label>
                                    <textarea
                                        value={remark}
                                        onChange={(e) => setRemark(e.target.value)}
                                        rows={3}
                                        placeholder="ระบุหมายเหตุเพิ่มเติม..."
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-6 border-t border-gray-200 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                        >
                            ยกเลิก
                        </button>
                        {step === "select" ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={selectedSdkIds.length === 0 || previewMutation.isPending}
                                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                            >
                                {previewMutation.isPending ? "กำลังคำนวณ..." : "ถัดไป"}
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setStep("select")}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300"
                                >
                                    ย้อนกลับ
                                </button>
                                {!initialData && (
                                    <button
                                        type="button"
                                        onClick={handleSubmit}
                                        disabled={createMutation.isPending}
                                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                                    >
                                        {createMutation.isPending ? "กำลังบันทึก..." : "ยืนยัน"}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
