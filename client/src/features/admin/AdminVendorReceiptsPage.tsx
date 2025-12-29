import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { adminApi, vendorApi, receiptApi, pdfApi, ReceiptWithBilling } from "@/lib/api";
import { format, parseISO, isValid, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { th } from "date-fns/locale";
import { useAuthStore } from "@/store/authStore";
import { getRoleName } from "@/lib/api";
import { useState, useMemo } from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { toast } from "sonner";

// PDF files: in dev use backend directly, in Docker use Nginx (empty prefix)
const PDF_BASE_URL = import.meta.env.VITE_PDF_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:8801" : "");

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
const BackIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
);

const PrintIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
);

const TrashIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

export default function AdminVendorReceiptsPage() {
    const params = useParams({ strict: false });
    const vendorId = params.vendorId as string;
    const { user } = useAuthStore();

    // State
    const [searchTerm, setSearchTerm] = useState("");
    const [searchType, setSearchType] = useState<"receiptRef" | "billingRef">("receiptRef");
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(30);

    const queryClient = useQueryClient();

    const { data: vendorData } = useQuery({
        queryKey: ["vendor", vendorId],
        queryFn: () => vendorApi.get(vendorId).then((res) => res.data.data),
        enabled: !!vendorId,
    });

    const { data: receiptsResponse, isLoading } = useQuery({
        queryKey: ["adminReceipts", vendorId],
        queryFn: () => adminApi.listReceipts(vendorId).then((res) => res.data),
        enabled: !!vendorId,
    });

    const deleteReceiptMutation = useMutation({
        mutationFn: (id: string) => receiptApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["adminReceipts", vendorId] });
            queryClient.invalidateQueries({ queryKey: ["adminBilling", vendorId] });
            toast.success("ลบใบเสร็จเรียบร้อยแล้ว");
        },
        onError: () => {
            toast.error("เกิดข้อผิดพลาดในการลบใบเสร็จ");
        },
    });

    const receipts = (receiptsResponse?.data || []) as ReceiptWithBilling[];

    // Filter Logic
    const filteredReceipts = useMemo(() => {
        return receipts.filter((receipt) => {
            if (dateRange.start && dateRange.end) {
                if (!receipt.receiptDate) return false;
                const receiptDate = parseISO(receipt.receiptDate);
                const start = startOfDay(parseISO(dateRange.start));
                const end = endOfDay(parseISO(dateRange.end));
                if (!isWithinInterval(receiptDate, { start, end })) return false;
            }
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

    // Pagination
    const totalPages = Math.ceil(filteredReceipts.length / pageSize);
    const paginatedReceipts = filteredReceipts.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    const handleDownloadPdf = async (receiptId: string) => {
        try {
            const response = await pdfApi.generateReceipt(receiptId);
            if (response.data.success && response.data.data) {
                window.open(`${PDF_BASE_URL}${response.data.data.url}`, "_blank");
                toast.success("เปิด PDF สำเร็จ");
            } else {
                toast.error("ไม่สามารถสร้าง PDF ได้");
            }
        } catch (error) {
            toast.error("เกิดข้อผิดพลาดในการสร้าง PDF");
        }
    };

    if (isLoading) return <div>Loading...</div>;

    // Columns
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
            header: "วันที่",
            cell: (receipt) => <span className="text-gray-500">{safeFormatDate(receipt.receiptDate, "dd/MM/yyyy")}</span>,
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
                                onClick={() => handleDownloadPdf(receipt.id)}
                                className="p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors"
                            >
                                <PrintIcon />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Download PDF</p>
                        </TooltipContent>
                    </Tooltip>

                    <AlertDialog>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                    <button className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors">
                                        <TrashIcon />
                                    </button>
                                </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Delete Receipt</p>
                            </TooltipContent>
                        </Tooltip>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>ลบใบเสร็จ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    ต้องการลบใบเสร็จเลขที่ {receipt.receiptRef} ใช่หรือไม่?
                                    <br />
                                    การดำเนินการนี้จะย้อนสถานะใบวางบิลกลับเป็น "อนุมัติแล้ว"
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => deleteReceiptMutation.mutate(receipt.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                >
                                    ยืนยันการลบ
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            ),
        },
    ];

    return (
        <TooltipProvider delayDuration={200}>
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link to="/admin" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <BackIcon />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Receipts - {vendorData?.companyName || "Vendor"}
                        </h1>
                        <p className="text-sm text-gray-500">
                            Logged in as: {user?.email} ({user?.role ? getRoleName(user.role) : "Unknown"})
                        </p>
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
                    onReset={() => {
                        setSearchTerm("");
                        setSearchType("receiptRef");
                        setDateRange({ start: "", end: "" });
                        setCurrentPage(1);
                    }}
                />

                <DataTable
                    data={paginatedReceipts}
                    columns={columns}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={filteredReceipts.length}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setCurrentPage(1);
                    }}
                    rowKey={(receipt) => receipt.id}
                    emptyMessage="ไม่พบข้อมูลใบเสร็จ"
                    maxHeight="calc(100vh - 350px)"
                    showIndex={true}
                />

            </div>
        </TooltipProvider>
    );
}
