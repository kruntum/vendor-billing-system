import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { receiptApi, pdfApi, ReceiptWithBilling } from "@/lib/api";
import { format, isValid, parseISO, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { th } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { ReceiptForm } from "./ReceiptForm";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { SearchToolbar } from "@/components/ui/search-toolbar";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

// Helper for safe date formatting
const safeFormatDate = (dateString: string | undefined | null, formatStr: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (!isValid(date)) return "-";
    return format(date, formatStr, { locale: th });
};

// Icons
const PrintIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
);

const EyeIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
);

export default function ReceiptsPage() {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState<ReceiptWithBilling | null>(null);

    // Filter & Pagination State
    const [searchTerm, setSearchTerm] = useState("");
    const [searchType, setSearchType] = useState<"receiptRef" | "billingRef">("receiptRef");
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(30);

    const queryClient = useQueryClient();

    const { data: receiptsResponse, isLoading } = useQuery({
        queryKey: ["receipts"],
        queryFn: () => receiptApi.list().then((res) => res.data),
    });

    const receipts = receiptsResponse?.data || [];

    // Calculate statistics
    const totalReceipts = receipts.length;
    const paidReceipts = receipts.filter((r) => r.statusReceipt === "PAID").length;
    const pendingReceipts = receipts.filter((r) => r.statusReceipt === "PENDING").length;
    const totalAmount = receipts.reduce((sum, r) => sum + Number(r.billingNote?.netTotal || 0), 0);

    // Filter Logic
    const filteredReceipts = useMemo(() => {
        return receipts.filter((receipt) => {
            // 1. Date Range Filter
            if (dateRange.start && dateRange.end) {
                if (!receipt.receiptDate) return false;
                const receiptDate = parseISO(receipt.receiptDate);
                const start = startOfDay(parseISO(dateRange.start));
                const end = endOfDay(parseISO(dateRange.end));

                if (!isWithinInterval(receiptDate, { start, end })) {
                    return false;
                }
            }

            // 2. Search Filter
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();

            if (searchType === "receiptRef") {
                return receipt.receiptRef?.toLowerCase().includes(term);
            }
            if (searchType === "billingRef") {
                return receipt.billingNote?.billingRef?.toLowerCase().includes(term);
            }

            return true;
        });
    }, [receipts, searchTerm, searchType, dateRange]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredReceipts.length / pageSize);
    const paginatedReceipts = filteredReceipts.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setCurrentPage(1);
    };

    const resetFilters = () => {
        setSearchTerm("");
        setDateRange({ start: "", end: "" });
        setSearchType("receiptRef");
        setCurrentPage(1);
    };

    const handlePrint = async (receipt: ReceiptWithBilling) => {
        try {
            const response = await pdfApi.generateReceipt(receipt.id);
            if (response.data.success && response.data.data) {
                const pdfUrl = `${API_BASE_URL}${response.data.data.url}`;
                window.open(pdfUrl, "_blank");
            }
        } catch (error) {
            console.error("PDF generation error:", error);
            alert("ไม่สามารถสร้าง PDF ได้");
        }
    };

    const handleView = (receipt: ReceiptWithBilling) => {
        setSelectedReceipt(receipt);
    };

    const closeModal = () => {
        setSelectedReceipt(null);
    };

    if (isLoading) {
        return <div>Loading...</div>;
    }

    // Define columns
    const columns: DataTableColumn<ReceiptWithBilling>[] = [
        {
            header: "เลขที่ใบเสร็จ",
            cell: (receipt) => <span className="font-medium text-gray-900">{receipt.receiptRef}</span>,
        },
        {
            header: "เลขที่ใบวางบิล",
            cell: (receipt) => <span className="text-gray-500">{receipt.billingNote?.billingRef || "-"}</span>,
        },
        {
            header: "วันที่ออกใบเสร็จ",
            cell: (receipt) => <span className="text-gray-500">{safeFormatDate(receipt.receiptDate, "d MMM yyyy")}</span>,
        },
        {
            header: "ยอดเงิน",
            className: "text-right",
            cell: (receipt) => (
                <span className="font-medium text-green-600">
                    {formatCurrency(Number(receipt.billingNote?.netTotal || 0))}
                </span>
            ),
        },
        {
            header: "สถานะ",
            className: "text-center",
            cell: (receipt) => (
                <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${receipt.statusReceipt === "PAID"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                        }`}
                >
                    {receipt.statusReceipt === "PAID" ? "ชำระแล้ว" : "รอดำเนินการ"}
                </span>
            ),
        },
        {
            header: "จัดการ",
            className: "text-center",
            cell: (receipt) => (
                <div className="flex items-center justify-center gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => handlePrint(receipt)}
                                className="p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors"
                            >
                                <PrintIcon />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>พิมพ์ใบเสร็จ</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => handleView(receipt)}
                                className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                                <EyeIcon />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>ดูรายละเอียด</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            ),
        },
    ];

    return (
        <TooltipProvider delayDuration={200}>
            <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">ใบเสร็จ (Receipts)</h1>
                        <p className="text-sm text-gray-500">จัดการใบเสร็จทั้งหมด</p>
                    </div>
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        ออกใบเสร็จใหม่
                    </button>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="p-5">
                            <div className="flex items-center">
                                <div className="flex-1">
                                    <dt className="text-sm font-medium text-gray-500 truncate">ใบเสร็จทั้งหมด</dt>
                                    <dd className="mt-1 text-3xl font-semibold text-gray-900">{totalReceipts}</dd>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="p-5">
                            <div className="flex items-center">
                                <div className="flex-1">
                                    <dt className="text-sm font-medium text-gray-500 truncate">ชำระแล้ว</dt>
                                    <dd className="mt-1 text-3xl font-semibold text-green-600">{paidReceipts}</dd>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="p-5">
                            <div className="flex items-center">
                                <div className="flex-1">
                                    <dt className="text-sm font-medium text-gray-500 truncate">รอดำเนินการ</dt>
                                    <dd className="mt-1 text-3xl font-semibold text-yellow-600">{pendingReceipts}</dd>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="p-5">
                            <div className="flex items-center">
                                <div className="flex-1">
                                    <dt className="text-sm font-medium text-gray-500 truncate">ยอดเงินรวม</dt>
                                    <dd className="mt-1 text-3xl font-semibold text-blue-600">
                                        {formatCurrency(totalAmount)}
                                    </dd>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <SearchToolbar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    searchType={searchType}
                    onSearchTypeChange={(value) => setSearchType(value as any)}
                    searchTypeOptions={[
                        { value: "receiptRef", label: "เลขที่ใบเสร็จ" },
                        { value: "billingRef", label: "เลขที่ใบวางบิล" },
                    ]}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    onReset={resetFilters}
                />

                <DataTable
                    data={paginatedReceipts}
                    columns={columns}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={filteredReceipts.length}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                    rowKey={(receipt) => receipt.id}
                    emptyMessage="ไม่พบข้อมูลใบเสร็จ"
                    maxHeight="calc(100vh - 500px)"
                    showIndex={true}
                />

                {isFormOpen && (
                    <ReceiptForm
                        onClose={() => setIsFormOpen(false)}
                        onSuccess={() => {
                            queryClient.invalidateQueries({ queryKey: ["receipts"] });
                            setIsFormOpen(false);
                        }}
                    />
                )}

                {selectedReceipt &&
                    createPortal(
                        <div
                            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                            onClick={closeModal}
                        >
                            <div
                                className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-6">
                                        <h2 className="text-2xl font-bold text-gray-900">รายละเอียดใบเสร็จ</h2>
                                        <button
                                            onClick={closeModal}
                                            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                                        >
                                            ×
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-sm text-gray-500">เลขที่ใบเสร็จ</p>
                                                <p className="font-medium">{selectedReceipt.receiptRef}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">เลขที่ใบวางบิล</p>
                                                <p className="font-medium">{selectedReceipt.billingNote?.billingRef || "-"}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">วันที่ออกใบเสร็จ</p>
                                                <p className="font-medium">{safeFormatDate(selectedReceipt.receiptDate, "d MMMM yyyy")}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">สถานะ</p>
                                                <p className="font-medium">
                                                    {selectedReceipt.statusReceipt === "PAID" ? "ชำระแล้ว" : "รอดำเนินการ"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">ยอดเงิน</p>
                                                <p className="font-medium text-green-600">
                                                    {formatCurrency(Number(selectedReceipt.billingNote?.netTotal || 0))}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-4">
                                            <button
                                                onClick={() => handlePrint(selectedReceipt)}
                                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                            >
                                                พิมพ์ใบเสร็จ
                                            </button>
                                            <button
                                                onClick={closeModal}
                                                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                                            >
                                                ปิด
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
            </div>
        </TooltipProvider>
    );
}
