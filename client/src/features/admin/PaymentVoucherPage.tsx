import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
    PaymentVoucher,
    paymentVoucherApi,
    BillingNote,
    vendorApi
} from "@/lib/api";
import { format, parseISO, isValid, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { th } from "date-fns/locale";
import { useAuthStore } from "@/store/authStore";
import { getRoleName } from "@/lib/api";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { SearchToolbar } from "@/components/ui/search-toolbar";
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { PaymentVoucherForm } from "./PaymentVoucherForm";
import { PdfPreviewDialog } from "./PdfPreviewDialog";

// Helpers
const safeFormatDate = (dateString: string | undefined | null, formatStr: string) => {
    if (!dateString) return "-";
    const date = parseISO(dateString);
    if (!isValid(date)) return "-";
    return format(date, formatStr, { locale: th });
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
    }).format(amount);
};

// Icons
const PlusIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
);

const EyeIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const CancelIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const PrintIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
);

const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
        PENDING: { label: "รออนุมัติ", color: "bg-yellow-100 text-yellow-800" },
        APPROVED: { label: "รอจ่ายเงิน", color: "bg-blue-100 text-blue-800" },
        PAID: { label: "จ่ายแล้ว", color: "bg-green-100 text-green-800" },
        CANCELLED: { label: "ยกเลิก", color: "bg-gray-100 text-gray-800" },
    };
    const info = statusMap[status] || { label: status, color: "bg-gray-100 text-gray-800" };
    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${info.color}`}>
            {info.label}
        </span>
    );
};

export default function PaymentVoucherPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();

    // State
    const [searchTerm, setSearchTerm] = useState("");
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
    const [selectedVendorId, setSelectedVendorId] = useState<string>("");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(30);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedVoucher, setSelectedVoucher] = useState<PaymentVoucher | null>(null);
    const [previewVoucher, setPreviewVoucher] = useState<PaymentVoucher | null>(null);
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState<"pending" | "approved" | "history">("pending");

    // Queries
    const { data: vendorData } = useQuery({
        queryKey: ["vendors"],
        queryFn: () => vendorApi.list().then((res) => res.data.data),
    });

    const { data: voucherData, isLoading } = useQuery({
        queryKey: ["payment-vouchers", selectedVendorId],
        queryFn: () => paymentVoucherApi.list({ vendorId: selectedVendorId || undefined }).then((res) => res.data.data),
    });

    const approveMutation = useMutation({
        mutationFn: (id: string) => paymentVoucherApi.approve(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["payment-vouchers"] });
            toast.success("อนุมัติใบสำคัญจ่ายเรียบร้อยแล้ว");
        },
        onError: () => {
            toast.error("เกิดข้อผิดพลาดในการอนุมัติ");
        },
    });

    const cancelMutation = useMutation({
        mutationFn: (id: string) => paymentVoucherApi.cancel(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["payment-vouchers"] });
            toast.success("ยกเลิกและลบใบสำคัญจ่ายเรียบร้อยแล้ว");
        },
        onError: () => {
            toast.error("เกิดข้อผิดพลาดในการยกเลิก");
        },
    });

    const handlePrint = async (voucher: PaymentVoucher) => {
        setIsPdfGenerating(true);
        try {
            const response = await paymentVoucherApi.getPreview(voucher.id);
            const blob = new Blob([response.data], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            window.open(`${url}#view=Fit`, "_blank");
        } catch (error) {
            toast.error("เกิดข้อผิดพลาดในการสร้าง PDF");
        } finally {
            setIsPdfGenerating(false);
        }
    };

    const handlePrintDetailed = async (voucher: PaymentVoucher) => {
        setIsPdfGenerating(true);
        try {
            const response = await paymentVoucherApi.getDetailedPreview(voucher.id);
            const blob = new Blob([response.data], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            window.open(`${url}#view=Fit`, "_blank");
        } catch (error) {
            toast.error("เกิดข้อผิดพลาดในการสร้าง PDF แบบละเอียด");
        } finally {
            setIsPdfGenerating(false);
        }
    };

    const vouchers = Array.isArray(voucherData) ? voucherData : [];
    const vendors = Array.isArray(vendorData) ? vendorData : [];


    // Filter Logic
    const filteredVouchers = useMemo(() => {
        return vouchers.filter((voucher) => {
            // Filter by tab
            if (activeTab === "pending" && voucher.status !== "PENDING") return false;
            if (activeTab === "approved" && voucher.status !== "APPROVED") return false;
            if (activeTab === "history" && voucher.status !== "PAID") return false;

            if (dateRange.start && dateRange.end) {
                const voucherDate = parseISO(voucher.voucherDate);
                const start = startOfDay(parseISO(dateRange.start));
                const end = endOfDay(parseISO(dateRange.end));
                if (!isWithinInterval(voucherDate, { start, end })) return false;
            }
            if (!searchTerm) return true;
            return (
                voucher.voucherRef?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                voucher.vendor?.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        });
    }, [vouchers, searchTerm, dateRange, activeTab]);

    // Pagination
    const totalPages = Math.ceil(filteredVouchers.length / pageSize);
    const paginatedVouchers = filteredVouchers.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );



    const renderJobsTable = (bn: BillingNote) => {
        if (!bn.jobs || bn.jobs.length === 0) return <div className="p-4 text-center text-gray-500 text-sm">ไม่มีรายการงาน</div>;

        return (
            <div className="pl-12 pr-4 py-2 bg-gray-100/50">
                <h4 className="text-xs font-semibold text-gray-500 mb-2">รายการงาน (Jobs)</h4>
                <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Container No</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice No</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {bn.jobs.map((job: any) => {
                                const amount = job.items?.reduce((sum: number, item: any) => sum + Number(item.amount), 0) || 0;
                                return (
                                    <tr key={job.id}>
                                        <td className="px-4 py-2 text-sm text-gray-900">{job.containerNo || "-"}</td>
                                        <td className="px-4 py-2 text-sm text-gray-900">{job.refInvoiceNo || "-"}</td>
                                        <td className="px-4 py-2 text-sm text-gray-900">{job.description || "-"}</td>
                                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(amount)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // Billing Note Columns
    const billingNoteColumns: DataTableColumn<BillingNote>[] = [
        { header: "เลขที่ใบวางบิล", accessorKey: "billingRef" },
        { header: "วันที่", cell: (bn) => safeFormatDate(bn.billingDate, "dd/MM/yyyy") },
        { header: "ยอดรวม", className: "text-right", cell: (bn) => formatCurrency(Number(bn.subtotal)) },
        { header: "สุทธิ", className: "text-right", cell: (bn) => formatCurrency(Number(bn.netTotal)) },
    ];

    const renderBillingNotesTable = (voucher: PaymentVoucher) => {
        if (!voucher.billingNotes || voucher.billingNotes.length === 0) {
            return <div className="p-4 text-center text-gray-500 text-sm">ไม่มีใบวางบิลในรายการนี้</div>;
        }

        return (
            <div className="p-4 bg-gray-50 border-b">
                <h4 className="font-semibold mb-2 ml-1">รายการใบวางบิล</h4>
                <DataTable
                    data={voucher.billingNotes}
                    columns={billingNoteColumns}
                    currentPage={1}
                    totalPages={1}
                    pageSize={100}
                    totalItems={voucher.billingNotes.length}
                    onPageChange={() => { }}
                    onPageSizeChange={() => { }}
                    rowKey={(row) => row.id}
                    maxHeight="auto"
                    renderSubComponent={renderJobsTable}
                />
            </div>
        );
    };

    // Columns
    const columns: DataTableColumn<PaymentVoucher>[] = [
        {
            header: "เลขที่",
            cell: (voucher) => <span className="font-medium text-gray-900">{voucher.voucherRef}</span>,
        },
        {
            header: "Vendor",
            cell: (voucher) => <span className="text-gray-600">{voucher.vendor?.companyName || "-"}</span>,
        },
        {
            header: "วันที่",
            cell: (voucher) => <span className="text-gray-500">{safeFormatDate(voucher.voucherDate, "dd/MM/yyyy")}</span>,
        },
        {
            header: "จำนวนบิล",
            className: "text-center",
            cell: (voucher) => <span className="text-gray-500">{voucher.billingNotes?.length || 0} ใบ</span>,
        },
        {
            header: "ยอดสุทธิ",
            className: "text-right",
            cell: (voucher) => (
                <span className="font-medium text-green-600">
                    {formatCurrency(Number(voucher.netTotal))}
                </span>
            ),
        },
        {
            header: "สถานะ",
            className: "text-center",
            cell: (voucher) => getStatusBadge(voucher.status),
        },
        {
            header: "ผู้สร้าง",
            cell: (voucher) => <span className="text-gray-500 text-sm">{voucher.createdBy?.name || voucher.createdBy?.email}</span>,
        },
        {
            header: "จัดการ",
            className: "text-center",
            cell: (voucher) => (
                <div className="flex items-center justify-center gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => setSelectedVoucher(voucher)}
                                className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                                <EyeIcon />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>ดูรายละเอียด</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => handlePrint(voucher)}
                                disabled={isPdfGenerating}
                                className="p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <PrintIcon />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>พิมพ์ PDF (ปกติ)</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => handlePrintDetailed(voucher)}
                                disabled={isPdfGenerating}
                                className="p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>พิมพ์ PDF (ละเอียด)</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => setPreviewVoucher(voucher)}
                                className="p-2 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
                                </svg>
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>ตัวอย่าง PDF</p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Approve Button - only for PENDING */}
                    {voucher.status === "PENDING" && (
                        <AlertDialog>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                        <button className="p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </button>
                                    </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>อนุมัติ</p>
                                </TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>อนุมัติใบสำคัญจ่าย?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        ต้องการอนุมัติใบสำคัญจ่ายเลขที่ {voucher.voucherRef} ใช่หรือไม่?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => approveMutation.mutate(voucher.id)}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        อนุมัติ
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}

                    {/* Cancel Button - for PENDING and APPROVED (admin/user can cancel) */}
                    {(voucher.status === "PENDING" || voucher.status === "APPROVED") && (
                        <AlertDialog>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                        <button className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors">
                                            <CancelIcon />
                                        </button>
                                    </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>ลบและย้อนสถานะ</p>
                                </TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>ลบใบสำคัญจ่าย?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        ต้องการลบใบสำคัญจ่ายเลขที่ {voucher.voucherRef} ใช่หรือไม่?
                                        ใบวางบิลที่เกี่ยวข้องจะกลับไปเป็นสถานะ "ส่งแล้ว"
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => cancelMutation.mutate(voucher.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                    >
                                        ลบ
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            ),
        },
    ];

    if (isLoading) return <div>Loading...</div>;

    return (
        <TooltipProvider delayDuration={200}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">ใบสำคัญจ่าย</h1>
                        <p className="text-sm text-gray-500">
                            Logged in as: {user?.email} ({user?.role ? getRoleName(user.role) : "Unknown"})
                        </p>
                    </div>
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        <PlusIcon />
                        สร้างใบสำคัญจ่าย
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab("pending")}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "pending"
                            ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                            : "text-gray-600 hover:bg-gray-100"
                            }`}
                    >
                        รออนุมัติ
                    </button>
                    <button
                        onClick={() => setActiveTab("approved")}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "approved"
                            ? "bg-blue-100 text-blue-800 border border-blue-300"
                            : "text-gray-600 hover:bg-gray-100"
                            }`}
                    >
                        รอจ่ายเงิน
                    </button>
                    <button
                        onClick={() => setActiveTab("history")}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "history"
                            ? "bg-green-100 text-green-800 border border-green-300"
                            : "text-gray-600 hover:bg-gray-100"
                            }`}
                    >
                        ประวัติ
                    </button>
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
                        {vendors.map((vendor) => (
                            <option key={vendor.id} value={vendor.id}>
                                {vendor.companyName}
                            </option>
                        ))}
                    </select>
                </div>

                <SearchToolbar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    onReset={() => {
                        setSearchTerm("");
                        setDateRange({ start: "", end: "" });
                        setCurrentPage(1);
                    }}
                />

                <DataTable
                    data={paginatedVouchers}
                    columns={columns}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={filteredVouchers.length}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                    rowKey={(row) => row.id}
                    emptyMessage="ไม่พบข้อมูลใบสำคัญจ่าย"
                    maxHeight="calc(100vh - 500px)"
                    showIndex
                    renderSubComponent={renderBillingNotesTable}
                />

                {/* Form Modal */}
                {isFormOpen && (
                    <PaymentVoucherForm
                        vendors={vendors}
                        onClose={() => setIsFormOpen(false)}
                        onSuccess={() => {
                            setIsFormOpen(false);
                            queryClient.invalidateQueries({ queryKey: ["payment-vouchers"] });
                        }}
                    />
                )}

                {/* Detail Modal */}
                {selectedVoucher && createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-xl shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold">ใบสำคัญจ่าย {selectedVoucher.voucherRef}</h2>
                                        <p className="text-sm text-gray-500">{selectedVoucher.vendor?.companyName}</p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedVoucher(null)}
                                        className="p-2 hover:bg-gray-100 rounded-lg"
                                    >
                                        <CancelIcon />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <p className="text-sm text-gray-500">วันที่</p>
                                        <p className="font-medium">{safeFormatDate(selectedVoucher.voucherDate, "dd MMMM yyyy")}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">สถานะ</p>
                                        {getStatusBadge(selectedVoucher.status)}
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">ผู้สร้าง</p>
                                        <p className="font-medium">{selectedVoucher.createdBy?.name || selectedVoucher.createdBy?.email}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">หมายเหตุ</p>
                                        <p className="font-medium">{selectedVoucher.remark || "-"}</p>
                                    </div>
                                </div>

                                <h3 className="font-semibold mb-3">ใบวางบิลที่รวม ({selectedVoucher.billingNotes?.length || 0} ใบ)</h3>
                                <div className="border rounded-lg overflow-hidden mb-6">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">เลขที่</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">วันที่</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">ยอดรวม</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">VAT</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">หัก ณ ที่จ่าย</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">สุทธิ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {selectedVoucher.billingNotes?.map((bn) => (
                                                <tr key={bn.id}>
                                                    <td className="px-4 py-3 text-sm">{bn.billingRef}</td>
                                                    <td className="px-4 py-3 text-sm">{safeFormatDate(bn.billingDate, "dd/MM/yyyy")}</td>
                                                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(Number(bn.subtotal))}</td>
                                                    <td className="px-4 py-3 text-sm text-right text-blue-600">{formatCurrency(Number(bn.vatAmount))}</td>
                                                    <td className="px-4 py-3 text-sm text-right text-red-600">-{formatCurrency(Number(bn.whtAmount))}</td>
                                                    <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(Number(bn.netTotal))}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-50">
                                            <tr>
                                                <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-right">รวมทั้งหมด</td>
                                                <td className="px-4 py-3 text-sm text-right font-semibold">{formatCurrency(Number(selectedVoucher.subtotal))}</td>
                                                <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">{formatCurrency(Number(selectedVoucher.totalVat))}</td>
                                                <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">-{formatCurrency(Number(selectedVoucher.totalWht))}</td>
                                                <td className="px-4 py-3 text-sm text-right font-bold text-green-600">{formatCurrency(Number(selectedVoucher.netTotal))}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        onClick={() => setSelectedVoucher(null)}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                    >
                                        ปิด
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* PDF Preview Modal */}
                <PdfPreviewDialog
                    voucher={previewVoucher}
                    onClose={() => setPreviewVoucher(null)}
                />
            </div>
        </TooltipProvider>
    );
}
