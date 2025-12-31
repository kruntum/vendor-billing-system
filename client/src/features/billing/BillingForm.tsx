import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { jobApi, billingApi, settingsApi, documentNumberApi, BillingNote } from "@/lib/api";
import { format } from "date-fns";

interface BillingFormProps {
  onClose: () => void;
  onSuccess: () => void;
  initialData?: BillingNote;
}

export function BillingForm({ onClose, onSuccess, initialData }: BillingFormProps) {
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>(
    initialData?.jobs?.map((j) => j.id) || []
  );
  const [step, setStep] = useState<"select" | "preview">("select");
  const [billingRef, setBillingRef] = useState(initialData?.billingRef || "");
  const [useCustomRef, setUseCustomRef] = useState(false);
  const [calculateBeforeVat, setCalculateBeforeVat] = useState(false);
  const [remark, setRemark] = useState(initialData?.remark || "");

  // Fetch settings for default
  const { data: settingsResponse } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get().then((res) => res.data),
  });



  // Use a flag to ensure we only auto-set the value once when data loads
  const [hasInitializedSettings, setHasInitializedSettings] = useState(false);

  if (settingsResponse?.data?.vatConfig && !hasInitializedSettings) {
    setCalculateBeforeVat(settingsResponse.data.vatConfig.calculateBeforeVat);
    setHasInitializedSettings(true);
  }

  // Fetch pending jobs
  const { data: jobsResponse, isLoading: isLoadingJobs } = useQuery({
    queryKey: ["jobs", "pending"],
    queryFn: () => jobApi.list({ status: "PENDING" }).then((res) => res.data),
    refetchOnMount: "always",  // Always fetch fresh data when form opens
    staleTime: 0,              // Data is immediately considered stale
  });

  // Fetch document number preview (only for new billing)
  const { data: docNumberPreview } = useQuery({
    queryKey: ["documentNumberPreview", "BILLING"],
    queryFn: () => documentNumberApi.getPreview("BILLING").then((res) => res.data),
    enabled: !initialData, // Only fetch for new billing
  });

  const pendingJobs = Array.isArray(jobsResponse?.data) ? jobsResponse.data : [];

  // Combine pending jobs with existing jobs (if editing)
  const existingJobs = initialData?.jobs || [];
  const availableJobs = [...existingJobs, ...pendingJobs].sort((a, b) =>
    new Date(b.clearanceDate).getTime() - new Date(a.clearanceDate).getTime()
  );

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: (data: { jobIds: string[]; calculateBeforeVat: boolean }) =>
      billingApi.preview(data.jobIds, data.calculateBeforeVat),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: { jobIds: string[]; billingRef?: string; calculateBeforeVat: boolean; remark?: string }) =>
      billingApi.create(data.jobIds, data.billingRef, data.calculateBeforeVat, data.remark),
    onSuccess,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { id: string; jobIds: string[]; remark?: string; calculateBeforeVat: boolean }) =>
      billingApi.update(data.id, data.jobIds, data.remark, data.calculateBeforeVat),
    onSuccess,
  });

  const handleToggleJob = (jobId: string) => {
    setSelectedJobIds((prev) =>
      prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId]
    );
  };

  const handleNext = () => {
    if (selectedJobIds.length === 0) return;
    previewMutation.mutate({ jobIds: selectedJobIds, calculateBeforeVat }, {
      onSuccess: () => setStep("preview"),
    });
  };

  const handleCalculateChange = (checked: boolean) => {
    setCalculateBeforeVat(checked);
    if (step === "preview") {
      previewMutation.mutate({ jobIds: selectedJobIds, calculateBeforeVat: checked });
    }
  };

  const handleSubmit = () => {
    if (initialData) {
      updateMutation.mutate({ id: initialData.id, jobIds: selectedJobIds, remark, calculateBeforeVat });
    } else {
      createMutation.mutate({ jobIds: selectedJobIds, billingRef, calculateBeforeVat, remark });
    }
  };

  const previewData = previewMutation.data?.data?.data;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/50 backdrop-blur-sm p-4 md:p-0">
      <div className="relative w-full max-w-4xl rounded-lg bg-white shadow-lg ring-1 ring-gray-900/5 my-8 max-h-[90vh] flex flex-col">
        <div className="p-6 flex-1 flex flex-col overflow-hidden">
          <h2 className="text-xl font-bold mb-6">
            {initialData ? "แก้ไขใบวางบิล (Edit Billing Note)" : "สร้างใบวางบิล (Create Billing Note)"}
          </h2>

          <div className="flex-1 overflow-y-auto">
            {step === "select" ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  เลือกงานที่ต้องการวางบิล (Select jobs to bill)
                </p>

                {isLoadingJobs ? (
                  <div>Loading jobs...</div>
                ) : availableJobs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    ไม่มีงานให้เลือก (No jobs available)
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
                                availableJobs.length > 0 &&
                                selectedJobIds.length === availableJobs.length
                              }
                              onChange={(e) =>
                                setSelectedJobIds(
                                  e.target.checked
                                    ? availableJobs.map((j) => j.id)
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
                            ยอดรวม
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {availableJobs.map((job) => (
                          <tr
                            key={job.id}
                            className={
                              selectedJobIds.includes(job.id) ? "bg-blue-50" : ""
                            }
                            onClick={() => handleToggleJob(job.id)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={selectedJobIds.includes(job.id)}
                                onChange={() => handleToggleJob(job.id)}
                                className="rounded border-gray-300 text-primary focus:ring-primary"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {format(new Date(job.clearanceDate), "dd/MM/yyyy")}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {job.description}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {job.refInvoiceNo}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              {job.totalAmount.toLocaleString()}
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
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium text-gray-900">สรุปรายการ (Summary)</h3>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="calculateBeforeVat"
                        checked={calculateBeforeVat}
                        onChange={(e) => handleCalculateChange(e.target.checked)}
                        className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                      />
                      <label htmlFor="calculateBeforeVat" className="ml-2 text-sm text-gray-700">
                        คำนวณหัก ณ ที่จ่าย ก่อน VAT
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">จำนวนงานที่เลือก:</span>
                      <span className="font-medium">{selectedJobIds.length} งาน</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">รวมเป็นเงิน (Subtotal):</span>
                      <span className="font-medium">
                        {previewData?.calculation.subtotal.toLocaleString()} บาท
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">มูลค่าก่อนภาษีมูลค่าเพิ่ม (Price Before VAT):</span>
                      <span className="font-medium">
                        {previewData?.calculation.priceBeforeVat.toLocaleString()} บาท
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">ภาษีมูลค่าเพิ่ม (VAT {previewData?.calculation.vatRate ?? 7}%):</span>
                      <span className="font-medium">
                        {previewData?.calculation.vatAmount.toLocaleString()} บาท
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">หัก ณ ที่จ่าย (WHT {previewData?.calculation.whtRate ?? 3}%):</span>
                      <span className="font-medium text-red-600">
                        -{previewData?.calculation.whtAmount.toLocaleString()} บาท
                      </span>
                    </div>
                    <div className="border-t pt-2 mt-2 flex justify-between text-lg font-bold">
                      <span>ยอดสุทธิ (Net Total):</span>
                      <span className="text-primary">
                        {previewData?.calculation.netTotal.toLocaleString()} บาท
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    เลขที่ใบวางบิล (Billing Ref)
                  </label>
                  {!initialData && docNumberPreview?.data?.preview ? (
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
                          เลขที่อัตโนมัติ: <span className="font-mono font-bold">{docNumberPreview.data.preview}</span>
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
                disabled={selectedJobIds.length === 0 || previewMutation.isPending}
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
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? "กำลังบันทึก..." : "ยืนยัน"}
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
