import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { settingsApi, companySettingsApi, documentNumberApi, VendorSettings, VatConfig, CompanySettings, DocumentNumberConfig, getRoleName } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function SettingsPage() {
  const { user } = useAuthStore();
  // Use getRoleName helper for consistent role checking
  const roleName = user ? getRoleName(user.role) : "";
  const isAdmin = roleName === "ADMIN";
  const isAdminOrUser = roleName === "ADMIN" || roleName === "USER";
  const hasVendor = !!user?.vendor?.id;
  const userId = user?.id;

  // Default tab: Admin/User go directly to "admin" tab, Vendor goes to "company" tab
  const [activeTab, setActiveTab] = useState<"company" | "vat" | "docnumber" | "admin">(
    isAdminOrUser && !hasVendor ? "admin" : "company"
  );

  // Vendor settings query - scoped by user id for cache separation
  const { data: settingsResponse, isLoading } = useQuery({
    queryKey: ["settings", userId],
    queryFn: () => settingsApi.get().then((res) => res.data),
    enabled: hasVendor,
    staleTime: 0, // Always refetch on mount
    refetchOnMount: true,
  });

  // Admin company settings query - scoped by user id
  const { data: companySettingsResponse, isLoading: isLoadingCompany } = useQuery({
    queryKey: ["companySettings", userId],
    queryFn: () => companySettingsApi.get().then((res) => res.data),
    enabled: isAdmin,
    staleTime: 0, // Always refetch on mount
    refetchOnMount: true,
  });

  const settings = settingsResponse?.data;
  const companySettings = companySettingsResponse?.data;

  if (isLoading && hasVendor) {
    return <div className="p-8 text-center">กำลังโหลด...</div>;
  }

  // For Admin/User without vendor, show only admin company settings
  if (isAdminOrUser && !hasVendor) {
    // Show loading for admin company settings
    if (isLoadingCompany && isAdmin) {
      return <div className="p-8 text-center">กำลังโหลด...</div>;
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ตั้งค่า</h1>
          <p className="text-sm text-gray-500">ตั้งค่าบริษัทที่จ่ายเงิน</p>
        </div>

        {/* Only Admin company tab */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {isAdmin && (
              <button
                onClick={() => setActiveTab("admin")}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === "admin"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
              >
                บริษัทที่จ่ายเงิน (Bill To)
              </button>
            )}
          </nav>
        </div>

        {/* Content */}
        <div className="mt-6">
          {isAdmin && <AdminCompanyForm companySettings={companySettings} />}
        </div>
      </div>
    );
  }

  // For VENDOR without company setup - show company creation form
  const isVendor = roleName === "VENDOR";
  if (isVendor && !hasVendor) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ตั้งค่า</h1>
          <p className="text-sm text-gray-500">กรุณาตั้งค่าข้อมูลบริษัทของคุณเพื่อเริ่มใช้งาน</p>
        </div>

        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              className="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm border-primary text-primary"
            >
              ข้อมูลบริษัท (Vendor)
            </button>
          </nav>
        </div>

        <div className="mt-6">
          <CompanyForm vendor={null} />
        </div>
      </div>
    );
  }

  // Normal vendor flow
  if (!settings) {
    return (
      <div className="p-8 text-center text-gray-500">
        เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ตั้งค่า</h1>
        <p className="text-sm text-gray-500">จัดการข้อมูลบริษัทและการตั้งค่าภาษี</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("company")}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === "company"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            ข้อมูลบริษัท (Vendor)
          </button>
          <button
            onClick={() => setActiveTab("vat")}
            disabled={!settings.vendor}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === "vat"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
              ${!settings.vendor ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            ตั้งค่าภาษี (VAT/WHT)
          </button>
          <button
            onClick={() => setActiveTab("docnumber")}
            disabled={!settings.vendor}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === "docnumber"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
              ${!settings.vendor ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            เลขที่เอกสาร (Document Number)
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === "admin"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              บริษัทที่จ่ายเงิน (Admin)
            </button>
          )}
        </nav>
      </div>

      {/* Content */}
      <div className="mt-6">
        {activeTab === "company" ? (
          <CompanyForm vendor={settings.vendor} />
        ) : activeTab === "vat" ? (
          settings.vendor && <VatConfigForm vatConfig={settings.vatConfig} />
        ) : activeTab === "docnumber" ? (
          settings.vendor && <DocumentNumberForm />
        ) : isAdmin ? (
          <AdminCompanyForm companySettings={companySettings} />
        ) : null}
      </div>
    </div>
  );
}

interface CompanyFormProps {
  vendor: VendorSettings | null;
}

function CompanyForm({ vendor }: CompanyFormProps) {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuthStore();
  const isNewVendor = !vendor;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Omit<VendorSettings, "id">>({
    defaultValues: {
      companyName: "",
      companyAddress: "",
      taxId: "",
      bankAccount: "",
      bankName: "",
      bankBranch: "",
    },
  });

  // Reset form when vendor data loads
  useEffect(() => {
    if (vendor) {
      reset({
        companyName: vendor.companyName,
        companyAddress: vendor.companyAddress,
        taxId: vendor.taxId,
        bankAccount: vendor.bankAccount,
        bankName: vendor.bankName,
        bankBranch: vendor.bankBranch,
      });
    }
  }, [vendor, reset]);

  const createMutation = useMutation({
    mutationFn: settingsApi.createVendor,
    onSuccess: async () => {
      // Refresh user data to get updated vendor info
      await refreshUser();
      // Invalidate settings query to refetch
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      alert("สร้างข้อมูลบริษัทสำเร็จ");
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error || "เกิดข้อผิดพลาด");
    },
  });

  const updateMutation = useMutation({
    mutationFn: settingsApi.updateVendor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      alert("บันทึกเรียบร้อยแล้ว");
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error || "เกิดข้อผิดพลาด");
    },
  });

  const onSubmit = (data: Omit<VendorSettings, "id">) => {
    if (isNewVendor) {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {isNewVendor && (
        <div className="p-4 bg-yellow-50 border-b border-yellow-100">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                กรุณาตั้งค่าข้อมูลบริษัทของคุณ
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                คุณยังไม่ได้ตั้งค่าข้อมูลบริษัท กรุณากรอกข้อมูลด้านล่างเพื่อเริ่มใช้งานระบบ
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อบริษัท <span className="text-red-500">*</span>
              </label>
              <input
                {...register("companyName", { required: "กรุณาระบุชื่อบริษัท" })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary border p-2"
                placeholder="บริษัท ตัวอย่าง จำกัด"
              />
              {errors.companyName && (
                <p className="text-red-500 text-xs mt-1">{errors.companyName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เลขประจำตัวผู้เสียภาษี <span className="text-red-500">*</span>
              </label>
              <input
                {...register("taxId", { required: "กรุณาระบุเลขประจำตัวผู้เสียภาษี" })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary border p-2"
                placeholder="0123456789012"
              />
              {errors.taxId && (
                <p className="text-red-500 text-xs mt-1">{errors.taxId.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ที่อยู่บริษัท <span className="text-red-500">*</span>
              </label>
              <textarea
                {...register("companyAddress", { required: "กรุณาระบุที่อยู่" })}
                rows={3}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary border p-2"
                placeholder="123 ถนนตัวอย่าง แขวงตัวอย่าง เขตตัวอย่าง กรุงเทพฯ 10XXX"
              />
              {errors.companyAddress && (
                <p className="text-red-500 text-xs mt-1">{errors.companyAddress.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อธนาคาร <span className="text-red-500">*</span>
              </label>
              <input
                {...register("bankName", { required: "กรุณาระบุชื่อธนาคาร" })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary border p-2"
                placeholder="ธนาคารกสิกรไทย"
              />
              {errors.bankName && (
                <p className="text-red-500 text-xs mt-1">{errors.bankName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                สาขา <span className="text-red-500">*</span>
              </label>
              <input
                {...register("bankBranch", { required: "กรุณาระบุสาขา" })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary border p-2"
                placeholder="สาขาสีลม"
              />
              {errors.bankBranch && (
                <p className="text-red-500 text-xs mt-1">{errors.bankBranch.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เลขบัญชีธนาคาร <span className="text-red-500">*</span>
              </label>
              <input
                {...register("bankAccount", { required: "กรุณาระบุเลขบัญชี" })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary border p-2"
                placeholder="123-4-56789-0"
              />
              {errors.bankAccount && (
                <p className="text-red-500 text-xs mt-1">{errors.bankAccount.message}</p>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 flex justify-end border-t">
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoading
              ? "กำลังบันทึก..."
              : isNewVendor
                ? "สร้างข้อมูลบริษัท"
                : "บันทึกการเปลี่ยนแปลง"}
          </button>
        </div>
      </form>
    </div>
  );
}

interface VatConfigFormProps {
  vatConfig: VatConfig;
}

function VatConfigForm({ vatConfig }: VatConfigFormProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VatConfig>({
    defaultValues: {
      vatRate: vatConfig.vatRate,
      whtRate: vatConfig.whtRate,
      calculateBeforeVat: vatConfig.calculateBeforeVat,
    },
  });

  const updateMutation = useMutation({
    mutationFn: settingsApi.updateVatConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      alert("บันทึกเรียบร้อยแล้ว");
    },
  });

  const onSubmit = (data: VatConfig) => {
    updateMutation.mutate({
      ...data,
      vatRate: Number(data.vatRate),
      whtRate: Number(data.whtRate),
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="p-6 space-y-6">
          <div className="max-w-md space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                อัตราภาษีมูลค่าเพิ่ม (VAT %)
              </label>
              <input
                type="number"
                step="0.01"
                {...register("vatRate", {
                  required: "กรุณาระบุอัตรา VAT",
                  min: { value: 0, message: "ต้องไม่ต่ำกว่า 0" },
                  max: { value: 100, message: "ต้องไม่เกิน 100" },
                })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary border p-2"
              />
              {errors.vatRate && (
                <p className="text-red-500 text-xs mt-1">{errors.vatRate.message}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">โดยปกติคือ 7%</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                อัตราหัก ณ ที่จ่าย (WHT %)
              </label>
              <input
                type="number"
                step="0.01"
                {...register("whtRate", {
                  required: "กรุณาระบุอัตรา WHT",
                  min: { value: 0, message: "ต้องไม่ต่ำกว่า 0" },
                  max: { value: 100, message: "ต้องไม่เกิน 100" },
                })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary border p-2"
              />
              {errors.whtRate && (
                <p className="text-red-500 text-xs mt-1">{errors.whtRate.message}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">โดยปกติคือ 1% หรือ 3%</p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="calculateBeforeVat"
                {...register("calculateBeforeVat")}
                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
              />
              <label htmlFor="calculateBeforeVat" className="ml-2 text-sm text-gray-700">
                คำนวณหัก ณ ที่จ่าย ก่อน VAT
              </label>
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 flex justify-end border-t">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Admin Company Settings Form
interface AdminCompanyFormProps {
  companySettings: CompanySettings | null | undefined;
}

function AdminCompanyForm({ companySettings }: AdminCompanyFormProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Omit<CompanySettings, "id">>({
    defaultValues: companySettings
      ? {
        companyName: companySettings.companyName,
        companyAddress: companySettings.companyAddress,
        taxId: companySettings.taxId,
        phone: companySettings.phone || "",
        email: companySettings.email || "",
      }
      : {
        companyName: "",
        companyAddress: "",
        taxId: "",
        phone: "",
        email: "",
      },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Omit<CompanySettings, "id">) => companySettingsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
      alert("บันทึกข้อมูลเรียบร้อยแล้ว");
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      alert(error.response?.data?.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    },
  });

  const onSubmit = (data: Omit<CompanySettings, "id">) => {
    updateMutation.mutate(data);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            ข้อมูลบริษัทที่จ่ายเงิน (Bill To)
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            ข้อมูลนี้จะแสดงในใบวางบิลในส่วน "เรียกเก็บจาก"
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อบริษัท *
              </label>
              <input
                {...register("companyName", { required: "กรุณาระบุชื่อบริษัท" })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary border p-2"
                placeholder="บริษัท ตัวอย่าง จำกัด"
              />
              {errors.companyName && (
                <p className="text-red-500 text-xs mt-1">{errors.companyName.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ที่อยู่ *
              </label>
              <textarea
                {...register("companyAddress", { required: "กรุณาระบุที่อยู่" })}
                rows={3}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary border p-2"
                placeholder="123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110"
              />
              {errors.companyAddress && (
                <p className="text-red-500 text-xs mt-1">{errors.companyAddress.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เลขประจำตัวผู้เสียภาษี *
              </label>
              <input
                {...register("taxId", { required: "กรุณาระบุเลขประจำตัวผู้เสียภาษี" })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary border p-2"
                placeholder="0123456789012"
              />
              {errors.taxId && (
                <p className="text-red-500 text-xs mt-1">{errors.taxId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เบอร์โทรศัพท์
              </label>
              <input
                {...register("phone")}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary border p-2"
                placeholder="02-xxx-xxxx"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                อีเมล
              </label>
              <input
                type="email"
                {...register("email")}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary border p-2"
                placeholder="contact@example.com"
              />
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 flex justify-end border-t">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Document Number Form
function DocumentNumberForm() {
  const queryClient = useQueryClient();

  const { data: configResponse, isLoading } = useQuery({
    queryKey: ["documentNumberConfig"],
    queryFn: () => documentNumberApi.getConfig().then((res) => res.data),
  });

  const { refetch: refetchBillingPreview } = useQuery({
    queryKey: ["documentNumberPreview", "BILLING"],
    queryFn: () => documentNumberApi.getPreview("BILLING").then((res) => res.data),
  });

  const { refetch: refetchReceiptPreview } = useQuery({
    queryKey: ["documentNumberPreview", "RECEIPT"],
    queryFn: () => documentNumberApi.getPreview("RECEIPT").then((res) => res.data),
  });

  const config = configResponse?.data;

  const {
    register,
    handleSubmit,
    watch,
    reset,
  } = useForm<DocumentNumberConfig>({
    defaultValues: {
      billingEnabled: false,
      billingPrefix: "B",
      receiptEnabled: false,
      receiptPrefix: "R",
      dateFormat: "YYYYMMDD",
      runningDigits: 3,
      resetPeriod: "DAILY",
    },
  });

  // Reset form when config loads
  useEffect(() => {
    if (config) {
      reset(config);
    }
  }, [config, reset]);

  const updateMutation = useMutation({
    mutationFn: documentNumberApi.updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentNumberConfig"] });
      refetchBillingPreview();
      refetchReceiptPreview();
      alert("บันทึกการตั้งค่าเรียบร้อยแล้ว");
    },
    onError: () => {
      alert("เกิดข้อผิดพลาดในการบันทึก");
    },
  });

  const onSubmit = (data: DocumentNumberConfig) => {
    updateMutation.mutate(data);
  };

  // Watch form values for preview
  const billingEnabled = watch("billingEnabled");
  const billingPrefix = watch("billingPrefix");
  const receiptEnabled = watch("receiptEnabled");
  const receiptPrefix = watch("receiptPrefix");
  const dateFormat = watch("dateFormat");
  const runningDigits = watch("runningDigits");

  // Generate local preview
  const generatePreview = (prefix: string): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    let datePart = "";
    switch (dateFormat) {
      case "YYYYMMDD":
        datePart = `${year}${month}${day}`;
        break;
      case "YYYYMM":
        datePart = `${year}${month}`;
        break;
      case "YYMM":
        datePart = `${String(year).slice(-2)}${month}`;
        break;
    }

    const runNumber = "1".padStart(runningDigits, "0");
    return `${prefix}${datePart}${runNumber}`;
  };

  if (isLoading) {
    return <div className="p-8 text-center">กำลังโหลด...</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="p-6 space-y-8">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">ตั้งค่าเลขที่เอกสาร</h2>
            <p className="text-sm text-gray-500">
              กำหนดรูปแบบการรันเลขที่เอกสารอัตโนมัติสำหรับใบวางบิลและใบเสร็จ
            </p>
          </div>

          {/* Billing Note Settings */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">ใบวางบิล (Billing Note)</h3>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register("billingEnabled")}
                  className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-sm text-gray-700">เปิดใช้งาน</span>
              </label>
            </div>

            <div className={!billingEnabled ? "opacity-50 pointer-events-none" : ""}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ตัวอักษรนำหน้า (Prefix)
              </label>
              <input
                {...register("billingPrefix")}
                maxLength={10}
                className="w-32 rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary border p-2"
                placeholder="B"
              />
            </div>

            {billingEnabled && (
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-sm text-gray-600">ตัวอย่าง: </span>
                <span className="font-mono font-medium text-primary">
                  {generatePreview(billingPrefix || "B")}
                </span>
              </div>
            )}
          </div>

          {/* Receipt Settings */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">ใบเสร็จ (Receipt)</h3>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register("receiptEnabled")}
                  className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-sm text-gray-700">เปิดใช้งาน</span>
              </label>
            </div>

            <div className={!receiptEnabled ? "opacity-50 pointer-events-none" : ""}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ตัวอักษรนำหน้า (Prefix)
              </label>
              <input
                {...register("receiptPrefix")}
                maxLength={10}
                className="w-32 rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary border p-2"
                placeholder="R"
              />
            </div>

            {receiptEnabled && (
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-sm text-gray-600">ตัวอย่าง: </span>
                <span className="font-mono font-medium text-primary">
                  {generatePreview(receiptPrefix || "R")}
                </span>
              </div>
            )}
          </div>

          {/* Shared Settings */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-medium text-gray-900">ตั้งค่าทั่วไป</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รูปแบบวันที่
                </label>
                <select
                  {...register("dateFormat")}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary border p-2"
                >
                  <option value="YYYYMMDD">ปีเดือนวัน (YYYYMMDD)</option>
                  <option value="YYYYMM">ปีเดือน (YYYYMM)</option>
                  <option value="YYMM">ปีเดือนย่อ (YYMM)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  จำนวนเลขรัน
                </label>
                <select
                  {...register("runningDigits", { valueAsNumber: true })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary border p-2"
                >
                  <option value={3}>3 หลัก (001-999)</option>
                  <option value={4}>4 หลัก (0001-9999)</option>
                  <option value={5}>5 หลัก (00001-99999)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รีเซ็ตเลขรัน
                </label>
                <select
                  {...register("resetPeriod")}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary border p-2"
                >
                  <option value="DAILY">รายวัน</option>
                  <option value="MONTHLY">รายเดือน</option>
                  <option value="YEARLY">รายปี</option>
                  <option value="NEVER">ไม่รีเซ็ต (ต่อเนื่อง)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  หากปิดใช้งานระบบรันเลขอัตโนมัติ ระบบจะใช้รูปแบบเดิม เช่น B2025-0001, RE2025-0001
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 flex justify-end border-t">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
          </button>
        </div>
      </form>
    </div>
  );
}
