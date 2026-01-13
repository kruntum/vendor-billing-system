import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { adminApi, vendorApi, BillingNote, billingApi, pdfApi } from "@/lib/api";
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



export default function AdminVendorBillingPage() {
    const params = useParams({ strict: false });
    const vendorId = params.vendorId as string;
    const { user } = useAuthStore();

    // State
    const [searchTerm, setSearchTerm] = useState("");
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(30);

    const queryClient = useQueryClient();

    const { data: vendorData } = useQuery({
        queryKey: ["vendor", vendorId],
        queryFn: () => vendorApi.get(vendorId).then((res) => res.data.data),
        enabled: !!vendorId,
    });

    const { data: billingData, isLoading } = useQuery({
        queryKey: ["adminBilling", vendorId],
        queryFn: () => adminApi.listBilling(vendorId).then((res) => res.data.data),
        enabled: !!vendorId,
    });

    const cancelBillingMutation = useMutation({
        mutationFn: (id: string) => billingApi.cancel(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["adminBilling", vendorId] });
            toast.success("ยกเลิกใบวางบิลเรียบร้อยแล้ว");
        },
        onError: () => {
            toast.error("เกิดข้อผิดพลาดในการยกเลิกใบวางบิล");
        },
    });

    const rejectBillingMutation = useMutation({
        mutationFn: (id: string) => billingApi.updateStatus(id, "PENDING"),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["adminBilling", vendorId] });
            toast.success("ส่งคืนใบวางบิลกลับไปให้ Vendor แก้ไขเรียบร้อยแล้ว");
        },
        onError: () => {
            toast.error("เกิดข้อผิดพลาดในการส่งคืนใบวางบิล");
        },
    });

    const billingNotes = billingData || [];

    // Filter Logic
    const filteredNotes = useMemo(() => {
        return billingNotes.filter((note) => {
            // Hide PENDING notes (Vendor drafts)
            if (note.statusBillingNote === "PENDING") return false;

            if (dateRange.start && dateRange.end) {
                const noteDate = parseISO(note.billingDate);
                const start = startOfDay(parseISO(dateRange.start));
                const end = endOfDay(parseISO(dateRange.end));
                if (!isWithinInterval(noteDate, { start, end })) return false;
            }
            if (!searchTerm) return true;
            return note.billingRef?.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [billingNotes, searchTerm, dateRange]);

    // Pagination
    const totalPages = Math.ceil(filteredNotes.length / pageSize);
    const paginatedNotes = filteredNotes.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    const handleDownloadPdf = async (billingId: string) => {
        try {
            const response = await pdfApi.getBillingPreview(billingId);
            const blob = new Blob([response.data], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            window.open(`${url}#view=Fit`, "_blank");
            toast.success("เปิด PDF สำเร็จ");
        } catch (error) {
            toast.error("เกิดข้อผิดพลาดในการสร้าง PDF");
        }
    };

    if (isLoading) return <div>Loading...</div>;

    // Columns
    const columns: DataTableColumn<BillingNote>[] = [
        {
            header: "เลขที่ใบวางบิล",
            cell: (note) => <span className="font-medium text-gray-900">{note.billingRef}</span>,
        },
        {
            header: "วันที่",
            cell: (note) => <span className="text-gray-500">{safeFormatDate(note.billingDate, "dd/MM/yyyy")}</span>,
        },
        {
            header: "จำนวนงาน",
            className: "text-center",
            cell: (note) => <span className="text-gray-500">{note.jobs?.length || 0} งาน</span>,
        },
        {
            header: "ยอดเงิน",
            className: "text-right",
            cell: (note) => (
                <span className="font-medium text-green-600">
                    {formatCurrency(Number(note.netTotal))}
                </span>
            ),
        },
        {
            header: "สถานะ",
            className: "text-center",
            cell: (note) => (
                <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${note.statusBillingNote === "PAID"
                        ? "bg-green-100 text-green-800"
                        : note.statusBillingNote === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : note.statusBillingNote === "SUBMITTED"
                                ? "bg-blue-100 text-blue-800"
                                : note.statusBillingNote === "CANCELLED"
                                    ? "bg-gray-100 text-gray-800"
                                    : "bg-yellow-100 text-yellow-800"
                        }`}
                >
                    {note.statusBillingNote === "PAID"
                        ? "ชำระแล้ว"
                        : note.statusBillingNote === "APPROVED"
                            ? "อนุมัติแล้ว"
                            : note.statusBillingNote === "SUBMITTED"
                                ? "ส่งแล้ว"
                                : note.statusBillingNote === "CANCELLED"
                                    ? "ยกเลิก"
                                    : "รอดำเนินการ"}
                </span>
            ),
        },
        {
            header: "จัดการ",
            className: "text-center",
            cell: (note) => (
                <div className="flex items-center justify-center gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => handleDownloadPdf(note.id)}
                                className="p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors"
                            >
                                <PrintIcon />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Download PDF</p>
                        </TooltipContent>
                    </Tooltip>

                    {note.statusBillingNote === "SUBMITTED" && !note.paymentVoucherId && (
                        <AlertDialog>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                        <button className="p-2 text-orange-600 hover:text-orange-900 hover:bg-orange-50 rounded-lg transition-colors">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                            </svg>
                                        </button>
                                    </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>ส่งกลับแก้ไข</p>
                                </TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>ส่งคืนใบวางบิล?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        ต้องการส่งคืนใบวางบิลเลขที่ {note.billingRef} กลับไปให้ Vendor แก้ไขใช่หรือไม่?
                                        <br />
                                        <span className="text-red-500 text-sm">* สถานะจะถูกเปลี่ยนกลับเป็น "รอดำเนินการ"</span>
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => rejectBillingMutation.mutate(note.id)}
                                        className="bg-orange-600 hover:bg-orange-700"
                                    >
                                        ยืนยันส่งคืน
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}

                    {note.statusBillingNote === "PENDING" && (
                        <AlertDialog>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                        <button className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>ลบใบวางบิล</p>
                                </TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>ลบใบวางบิล?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        ต้องการลบใบวางบิลเลขที่ {note.billingRef} ใช่หรือไม่?
                                        <br />
                                        <span className="text-red-500 text-sm">* การลบจะทำให้เลขที่ใบวางบิลหายไปจากระบบ</span>
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => cancelBillingMutation.mutate(note.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                    >
                                        ยืนยันลบ
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
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
                            Billing Notes - {vendorData?.companyName || "Vendor"}
                        </h1>
                        <p className="text-sm text-gray-500">
                            Logged in as: {user?.email} ({user?.role ? getRoleName(user.role) : "Unknown"})
                        </p>
                    </div>
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
                    data={paginatedNotes}
                    columns={columns}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={filteredNotes.length}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setCurrentPage(1);
                    }}
                    rowKey={(note) => note.id}
                    emptyMessage="ไม่พบข้อมูลใบวางบิล"
                    maxHeight="calc(100vh - 365px)"
                    showIndex={true}
                />

            </div>
        </TooltipProvider>
    );
}
