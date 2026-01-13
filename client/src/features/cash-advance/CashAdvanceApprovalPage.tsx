import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";

import { cashAdvanceBillingApi, CashAdvanceBilling, CreateCashAdvancePaymentInput, vendorApi } from "@/lib/api";
import { toast } from "sonner";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { CashAdvanceBillingDetailModal } from "./CashAdvanceBillingDetailModal";
import { useAuthStore } from "@/store/authStore";
import { BanknoteIcon, CheckIcon, PrinterIcon, FileSearchIcon, SearchIcon, FileTextIcon } from "lucide-react";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";



const formatDateShort = (dateString: string) => {
    try {
        return format(new Date(dateString), "dd/MM/yyyy");
    } catch {
        return "-";
    }
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
    }).format(amount);
};

// Icons (Same set)






// Form for Payment


// Helper
function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
        PENDING: "bg-yellow-100 text-yellow-800",
        SUBMITTED: "bg-blue-100 text-blue-800",
        APPROVED: "bg-indigo-100 text-indigo-800",
        PAID: "bg-green-100 text-green-800",
        CANCELLED: "bg-red-100 text-red-800",
    };
    const labels: Record<string, string> = {
        PENDING: "รอส่ง",
        SUBMITTED: "ส่งแล้ว",
        APPROVED: "อนุมัติ",
        PAID: "จ่ายแล้ว",
        CANCELLED: "ยกเลิก",
    };
    return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100"}`}>
            {labels[status] || status}
        </span>
    );
}

export default function CashAdvanceApprovalPage() {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'submitted' | 'approved' | 'history'>('submitted');
    const [viewBilling, setViewBilling] = useState<CashAdvanceBilling | null>(null);
    const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
    const [selectedVendorId, setSelectedVendorId] = useState<string>("");

    // Fetch Vendors for dropdown
    const { data: vendorData } = useQuery({
        queryKey: ["vendors"],
        queryFn: () => vendorApi.list().then((res) => res.data.data),
    });
    const vendors = Array.isArray(vendorData) ? vendorData : [];

    // Fetch All Billings
    const { data: response, isLoading } = useQuery({
        queryKey: ["cash-advance-billings-all", selectedVendorId],
        queryFn: () => cashAdvanceBillingApi.list({
            vendorId: selectedVendorId || undefined
        }).then((res) => res.data),
    });

    const billings = response?.data || [];

    // Filter items based on activeTab
    const filteredBillings = billings.filter((b: CashAdvanceBilling) => {
        if (activeTab === 'submitted') return b.status === 'SUBMITTED';
        if (activeTab === 'approved') return b.status === 'APPROVED';
        if (activeTab === 'history') return ['PAID', 'CANCELLED', 'PENDING'].includes(b.status);
        return false;
    });

    // Sort by date desc
    filteredBillings.sort((a: CashAdvanceBilling, b: CashAdvanceBilling) => new Date(b.billingDate).getTime() - new Date(a.billingDate).getTime());

    // Mutations
    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            cashAdvanceBillingApi.updateStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cash-advance-billings-all"] });
            toast.success("อัปเดตสถานะเรียบร้อย");
        },
        onError: () => toast.error("เกิดข้อผิดพลาด"),
    });

    const handleApprove = async (id?: string) => {
        if (id) {
            if (confirm("ยืนยันการอนุมัติ?")) {
                updateStatusMutation.mutate({ id, status: "APPROVED" });
            }
            return;
        }

        if (!viewBilling) return;
        updateStatusMutation.mutate({ id: viewBilling.id, status: "APPROVED" });
        setViewBilling(null);
    };

    const handlePay = async (data: CreateCashAdvancePaymentInput) => {
        if (!viewBilling) return;
        try {
            await cashAdvanceBillingApi.pay(viewBilling.id, data);
            queryClient.invalidateQueries({ queryKey: ["cash-advance-billings-all"] });
            toast.success("บันทึกการจ่ายเงินเรียบร้อย");
            setViewBilling(null);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "บันทึกการจ่ายเงินไม่สำเร็จ");
        }
    };

    const handleCancel = async () => {
        toast.error("Cancel not implemented for Admin yet in this view context, use Detail Modal");
    };

    const handlePreviewPdf = async (id?: string, isModal: boolean = false) => {
        const targetId = id || viewBilling?.id;
        if (!targetId) return;

        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`/api/pdf/cash-advance-billing/${targetId}/preview`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error("Failed to load PDF");
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            if (isModal) {
                setPreviewPdfUrl(url);
            } else {
                window.open(url + "#view=Fit", "_blank");
            }
        } catch (error) {
            toast.error("ไม่สามารถโหลด PDF ได้");
        }
    };

    const handlePrintPaymentVoucher = async (id: string) => {
        try {
            const token = localStorage.getItem("token");
            console.log("Generating Payment Voucher PDF for:", id);
            const response = await fetch(`/api/pdf/cash-advance-payment/${id}/preview`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to generate PDF');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            window.open(url + "#view=Fit", '_blank');
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast.error("ไม่สามารถสร้าง PDF ได้");
        }
    };

    // Render Cash Advance Items in expanded row
    const renderCashAdvances = (billing: CashAdvanceBilling) => {
        const items = (billing as any).items || [];
        if (items.length === 0) {
            return <div className="p-4 text-center text-gray-500 text-sm">ไม่มีรายการสำรองเงินสด</div>;
        }

        return (
            <div className="pl-12 pr-4 py-3 bg-gray-50">
                <h4 className="text-xs font-semibold text-gray-500 mb-2">รายการสำรองเงินสด ({items.length} รายการ)</h4>
                <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase w-12">#</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">วันที่</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice No</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">รายละเอียด</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Container / Plate</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">ยอดเงิน</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {items.map((item: any, idx: number) => (
                                <tr key={item.id || idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm text-gray-500 text-center">{idx + 1}</td>
                                    <td className="px-4 py-2 text-sm text-gray-600">{item.advanceDate ? formatDateShort(item.advanceDate) : "-"}</td>
                                    <td className="px-4 py-2 text-sm text-gray-600">{item.refInvoiceNo || "-"}</td>
                                    <td className="px-4 py-2 text-sm text-gray-600">{item.description || "-"}</td>
                                    <td className="px-4 py-2 text-sm text-gray-600">
                                        {[item.containerNo, item.truckPlate].filter(Boolean).join(" / ") || "-"}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">{formatCurrency(Number(item.totalAmount))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // Define columns for DataTable
    const columns: DataTableColumn<CashAdvanceBilling>[] = [
        {
            header: "เลขที่วางบิล",
            cell: (billing) => <span className="font-medium text-gray-900">{billing.billingRef}</span>,
        },
        {
            header: "ผู้ให้บริการ",
            cell: (billing) => billing.vendor?.companyName || "-",
        },
        {
            header: "วันที่",
            cell: (billing) => formatDateShort(billing.billingDate),
        },
        {
            header: "ยอดรวม",
            className: "text-right",
            cell: (billing) => formatCurrency(Number(billing.totalAmount)),
        },
        {
            header: "สถานะ",
            className: "text-center",
            cell: (billing) => getStatusBadge(billing.status),
        },
        {
            header: "จัดการ",
            className: "text-center",
            cell: (billing) => (
                <div className="flex items-center justify-center gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={(e) => { e.stopPropagation(); setViewBilling(billing); }}
                                className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                                <SearchIcon className="w-4 h-4" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent><p>ดูรายละเอียด</p></TooltipContent>
                    </Tooltip>

                    {(billing.status === "APPROVED" || billing.status === "PAID") && (
                        <>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handlePreviewPdf(billing.id); }}
                                        className="p-1.5 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors"
                                    >
                                        <PrinterIcon className="w-4 h-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent><p>พิมพ์ใบวางบิล</p></TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handlePreviewPdf(billing.id, true); }}
                                        className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <FileTextIcon className="w-4 h-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent><p>ตัวอย่าง PDF</p></TooltipContent>
                            </Tooltip>
                        </>
                    )}

                    {billing.status === "SUBMITTED" && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleApprove(billing.id); }}
                                    className="p-1.5 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors"
                                >
                                    <CheckIcon className="w-4 h-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent><p>อนุมัติ</p></TooltipContent>
                        </Tooltip>
                    )}

                    {billing.status === "APPROVED" && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setViewBilling(billing); }}
                                    className="p-1.5 text-amber-600 hover:text-amber-900 hover:bg-amber-50 rounded-lg transition-colors"
                                >
                                    <BanknoteIcon className="w-4 h-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent><p>บันทึกการจ่ายเงิน</p></TooltipContent>
                        </Tooltip>
                    )}

                    {billing.status === "PAID" && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handlePrintPaymentVoucher(billing.id); }}
                                    className="p-1.5 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded-lg transition-colors"
                                >
                                    <FileSearchIcon className="w-4 h-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent><p>พิมพ์ใบสำคัญจ่าย</p></TooltipContent>
                        </Tooltip>
                    )}
                </div>
            ),
        },
    ];

    return (
        <TooltipProvider delayDuration={200}>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">ตรวจสอบการวางบิล (สำรองเงินสด)</h1>
                    <p className="text-sm text-gray-500">อนุมัติและจ่ายเงินรายการวางบิลสำรองเงินสด</p>
                </div>

                {/* Vendor Filter */}
                <div className="flex gap-4 items-center">
                    <label className="text-sm font-medium text-gray-700">กรอง Vendor:</label>
                    <select
                        value={selectedVendorId}
                        onChange={(e) => setSelectedVendorId(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                        <option value="">ทั้งหมด</option>
                        {vendors.map((vendor: any) => (
                            <option key={vendor.id} value={vendor.id}>
                                {vendor.companyName}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab("submitted")}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "submitted"
                            ? "border-primary text-primary"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        รออนุมัติ
                    </button>
                    <button
                        onClick={() => setActiveTab("approved")}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "approved"
                            ? "border-primary text-primary"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        รอจ่ายเงิน
                    </button>
                    <button
                        onClick={() => setActiveTab("history")}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "history"
                            ? "border-primary text-primary"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        ประวัติทั้งหมด
                    </button>
                </div>

                {/* DataTable with expandable rows */}
                {isLoading ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">กำลังโหลด...</div>
                ) : (
                    <DataTable
                        data={filteredBillings}
                        columns={columns}
                        currentPage={1}
                        totalPages={1}
                        pageSize={100}
                        totalItems={filteredBillings.length}
                        onPageChange={() => { }}
                        onPageSizeChange={() => { }}
                        rowKey={(row) => row.id}
                        emptyMessage="ไม่พบข้อมูล"
                        maxHeight="calc(100vh - 365px)"
                        renderSubComponent={renderCashAdvances}
                    />
                )}

                {/* Detail Modal */}
                {viewBilling && (
                    <CashAdvanceBillingDetailModal
                        billing={viewBilling}
                        onClose={() => setViewBilling(null)}
                        onCancel={handleCancel}
                        onSubmit={async () => { }}
                        onApprove={handleApprove}
                        onPay={handlePay}
                        onPrint={() => handlePreviewPdf()}
                        isPdfGenerating={false}
                        userRole={typeof user?.role === 'string' ? user.role : user?.role?.name}
                    />
                )}

                {/* PDF Preview Modal */}
                {previewPdfUrl && createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-xl shadow-lg w-[95vw] h-[95vh] flex flex-col">
                            <div className="flex justify-between items-center p-4 border-b">
                                <h2 className="text-xl font-bold">ตัวอย่าง PDF</h2>
                                <button
                                    onClick={() => {
                                        if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
                                        setPreviewPdfUrl(null);
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <div className="flex-1 overflow-hidden bg-gray-100 relative">
                                <iframe
                                    src={`${previewPdfUrl}#view=Fit`}
                                    className="w-full h-full"
                                    title="PDF Preview"
                                />
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        </TooltipProvider>
    );
}
