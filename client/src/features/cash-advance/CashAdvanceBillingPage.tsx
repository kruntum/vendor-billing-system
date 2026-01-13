import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";
import { th } from "date-fns/locale";
import { cashAdvanceBillingApi, CashAdvanceBilling } from "@/lib/api";
import { toast } from "sonner";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuthStore } from "@/store/authStore";
import { CreateCashAdvancePaymentInput } from "@/lib/api";
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
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { SearchToolbar } from "@/components/ui/search-toolbar";
import { CashAdvanceBillingForm } from "./CashAdvanceBillingForm";
import { CashAdvanceBillingDetailModal } from "./CashAdvanceBillingDetailModal";

// Icons
const ViewIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        <line x1="10" x2="10" y1="11" y2="17" />
        <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
);

const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
    </svg>
);

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

export default function CashAdvanceBillingPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [viewBilling, setViewBilling] = useState<CashAdvanceBilling | null>(null);
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);

    // Filter & Pagination State
    const [searchTerm, setSearchTerm] = useState("");
    const [searchType, setSearchType] = useState<"billingRef" | "containerNo">("billingRef");
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(30);

    // Fetch Billing History
    const { data: billingsResponse, isLoading } = useQuery({
        queryKey: ["cash-advance-billings"],
        queryFn: () => cashAdvanceBillingApi.list().then((res) => res.data),
    });

    const billings = Array.isArray(billingsResponse?.data) ? billingsResponse.data : [];

    // Filter Logic
    const filteredBillings = useMemo(() => {
        return billings.filter((billing) => {
            // 1. Date Range Filter
            if (dateRange.start && dateRange.end) {
                const billingDate = parseISO(billing.billingDate);
                const start = startOfDay(parseISO(dateRange.start));
                const end = endOfDay(parseISO(dateRange.end));

                if (!isWithinInterval(billingDate, { start, end })) {
                    return false;
                }
            }

            // 2. Search Filter
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();

            if (searchType === "billingRef") {
                return billing.billingRef.toLowerCase().includes(term);
            }

            if (searchType === "containerNo") {
                return billing.items?.some((item: any) =>
                    item.containerNo?.toLowerCase().includes(term) || item.truckPlate?.toLowerCase().includes(term)
                );
            }

            return true;
        });
    }, [billings, searchTerm, searchType, dateRange]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredBillings.length / pageSize);
    const paginatedBillings = filteredBillings.slice(
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
        setSearchType("billingRef");
        setDateRange({ start: "", end: "" });
        setCurrentPage(1);
    };

    // Mutation: Update Status
    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            cashAdvanceBillingApi.updateStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cash-advance-billings"] });
            toast.success("ส่งใบวางบิลเรียบร้อย");
            setViewBilling(null);
        },
        onError: () => {
            toast.error("เกิดข้อผิดพลาด");
        },
    });

    // Mutation: Cancel Billing
    const cancelBillingMutation = useMutation({
        mutationFn: cashAdvanceBillingApi.cancel,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cash-advances"] });
            queryClient.invalidateQueries({ queryKey: ["cash-advance-billings"] });
            toast.success("ยกเลิกใบวางบิลเรียบร้อย");
            setViewBilling(null);
        },
        onError: () => {
            toast.error("เกิดข้อผิดพลาด");
        },
    });

    // Mutation: Pay Billing
    const payBillingMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: CreateCashAdvancePaymentInput }) =>
            cashAdvanceBillingApi.pay(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cash-advance-billings"] });
            toast.success("บันทึกการจ่ายเงินเรียบร้อย");
            setViewBilling(null);
        },
        onError: () => {
            toast.error("เกิดข้อผิดพลาดในการบันทึกการจ่ายเงิน");
        },
    });

    // Handlers
    const handlePrint = async (id: string) => {
        setIsPdfGenerating(true);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`/api/pdf/cash-advance-billing/${id}/preview`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error("Failed to load PDF");
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            window.open(url + "#view=Fit", "_blank");
        } catch (error) {
            toast.error("ไม่สามารถสร้าง PDF ได้");
        } finally {
            setIsPdfGenerating(false);
        }
    };

    const handleCreate = () => {
        setIsFormOpen(true);
    };

    const handleSubmit = async () => {
        if (!viewBilling) return;
        updateStatusMutation.mutate({ id: viewBilling.id, status: "SUBMITTED" });
    };

    const handleCancel = async () => {
        if (!viewBilling) return;
        cancelBillingMutation.mutate(viewBilling.id);
    };

    const handleApprove = async () => {
        if (!viewBilling) return;
        updateStatusMutation.mutate({ id: viewBilling.id, status: "APPROVED" });
    };

    const handlePay = async (data: CreateCashAdvancePaymentInput) => {
        if (!viewBilling) return;
        payBillingMutation.mutate({ id: viewBilling.id, data });
    };

    // Helpers
    const formatDateHelper = (dateString: string) => {
        try {
            return format(new Date(dateString), "dd MMM yyyy", { locale: th });
        } catch {
            return "-";
        }
    };

    const formatCurrencyHelper = (amount: number) => {
        return new Intl.NumberFormat("th-TH", {
            style: "currency",
            currency: "THB",
        }).format(amount);
    };

    const renderItemsTable = (billing: CashAdvanceBilling) => {
        return (
            <div className="pl-12 pr-4 py-2 bg-gray-100/50">
                <h4 className="text-xs font-semibold text-gray-500 mb-2">รายการสำรองเงินสด (Cash Advance)</h4>
                <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-10">#</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Container No</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Truck Plate</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice No</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Declaration No</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {billing.items?.map((item: any, idx: number) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm text-gray-500">{idx + 1}</td>
                                    <td className="px-4 py-2 text-sm text-gray-900">{item.containerNo || "-"}</td>
                                    <td className="px-4 py-2 text-sm text-gray-900">{item.truckPlate || "-"}</td>
                                    <td className="px-4 py-2 text-sm text-gray-900">{item.refInvoiceNo || "-"}</td>
                                    <td className="px-4 py-2 text-sm text-gray-900">{item.declarationNo || "-"}</td>
                                    <td className="px-4 py-2 text-sm text-gray-900">{item.description || "-"}</td>
                                    <td className="px-4 py-2 text-sm text-gray-900 text-right">
                                        {formatCurrencyHelper(Number(item.totalAmount))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const columns: DataTableColumn<CashAdvanceBilling>[] = [
        {
            header: "เลขที่ใบวางบิล",
            cell: (billing) => <span className="font-medium text-gray-900">{billing.billingRef}</span>,
        },
        {
            header: "วันที่",
            cell: (billing) => <span className="text-gray-500">{formatDateHelper(billing.billingDate)}</span>,
        },
        {
            header: "จำนวนงาน",
            className: "text-center",
            cell: (billing) => <span className="text-gray-500">{billing.items?.length || 0} งาน</span>,
        },
        {
            header: "ยอดเงิน",
            className: "text-right",
            cell: (billing) => (
                <span className="font-medium text-green-600">
                    {formatCurrencyHelper(Number(billing.totalAmount))}
                </span>
            ),
        },
        {
            header: "สถานะ",
            className: "text-center",
            cell: (billing) => {
                const styles: Record<string, string> = {
                    PENDING: "bg-yellow-100 text-yellow-800",
                    SUBMITTED: "bg-blue-100 text-blue-800",
                    APPROVED: "bg-indigo-100 text-indigo-800",
                    PAID: "bg-green-100 text-green-800",
                    CANCELLED: "bg-red-100 text-red-800",
                };
                const labels: Record<string, string> = {
                    PENDING: "รอดำเนินการ",
                    SUBMITTED: "ส่งแล้ว",
                    APPROVED: "อนุมัติ",
                    PAID: "จ่ายแล้ว",
                    CANCELLED: "ยกเลิก",
                };
                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[billing.status] || "bg-gray-100"}`}>
                        {labels[billing.status] || billing.status}
                    </span>
                );
            }
        },
        {
            header: "จัดการ",
            className: "text-center",
            cell: (billing) => (
                <div className="flex items-center justify-center gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => setViewBilling(billing)}
                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                            >
                                <ViewIcon />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>ดูรายละเอียด / จัดการ</p>
                        </TooltipContent>
                    </Tooltip>

                    {billing.status === "PENDING" && (
                        <>
                            <AlertDialog>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <AlertDialogTrigger asChild>
                                            <button
                                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                                            >
                                                <SendIcon />
                                            </button>
                                        </AlertDialogTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>ส่งใบวางบิล</p>
                                    </TooltipContent>
                                </Tooltip>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>ยืนยันการส่งใบวางบิล?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            คุณต้องการส่งใบวางบิลเลขที่ {billing.billingRef} ให้ Admin ตรวจสอบใช่หรือไม่?
                                            <br />
                                            หลังจากส่งแล้วจะไม่สามารถแก้ไขได้
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => updateStatusMutation.mutate({ id: billing.id, status: "SUBMITTED" })} className="bg-blue-600 hover:bg-blue-700">
                                            ยืนยันการส่ง
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <AlertDialogTrigger asChild>
                                            <button
                                                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                            >
                                                <TrashIcon />
                                            </button>
                                        </AlertDialogTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>ยกเลิก</p>
                                    </TooltipContent>
                                </Tooltip>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>ยืนยันการยกเลิก?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            คุณต้องการยกเลิกใบวางบิลเลขที่ {billing.billingRef} ใช่หรือไม่?
                                            <br />
                                            การดำเนินการนี้จะคืนสถานะรายการทั้งหมดกลับเป็น "พร้อมวางบิล"
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => cancelBillingMutation.mutate(billing.id)} className="bg-red-600 hover:bg-red-700">
                                            ยืนยันการยกเลิก
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                    )}
                </div>
            )
        }
    ];

    if (isLoading) {
        return <div>Loading...</div>;
    }

    return (
        <TooltipProvider delayDuration={200}>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">วางบิลสำรองเงินสด (Cash Advance Billing)</h1>
                        <p className="text-sm text-gray-500">จัดการรายการวางบิลสำรองเงินสด</p>
                    </div>
                    <button
                        onClick={handleCreate}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                        <PlusIcon />
                        <span className="ml-2">สร้างใบวางบิล</span>
                    </button>
                </div>

                <SearchToolbar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    searchType={searchType}
                    onSearchTypeChange={(value) => setSearchType(value as any)}
                    searchTypeOptions={[
                        { value: "billingRef", label: "เลขที่ใบวางบิล" },
                        { value: "containerNo", label: "เบอร์ตู้/ทะเบียนรถ" },
                    ]}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    onReset={resetFilters}
                />

                <DataTable
                    data={paginatedBillings}
                    columns={columns}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={filteredBillings.length}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                    rowKey={(billing) => billing.id}
                    emptyMessage="ไม่พบข้อมูลใบวางบิล"
                    maxHeight="calc(100vh - 365px)"
                    showIndex={true}
                    renderSubComponent={renderItemsTable}
                />

                {/* Create Modal */}
                {isFormOpen && (
                    <CashAdvanceBillingForm
                        onClose={() => setIsFormOpen(false)}
                        onSuccess={() => {
                            setIsFormOpen(false);
                            queryClient.invalidateQueries({ queryKey: ["cash-advance-billings"] });
                            queryClient.invalidateQueries({ queryKey: ["cash-advance"] });
                            toast.success("สร้างใบวางบิลเรียบร้อย");
                        }}
                    />
                )}

                {/* Detail Modal */}
                {viewBilling && (
                    <CashAdvanceBillingDetailModal
                        billing={viewBilling}
                        onClose={() => setViewBilling(null)}
                        onCancel={handleCancel}
                        onSubmit={handleSubmit}
                        onApprove={handleApprove}
                        onPay={handlePay}
                        onPrint={() => handlePrint(viewBilling.id)}
                        isPdfGenerating={isPdfGenerating}
                        userRole={typeof user?.role === 'string' ? user.role : user?.role?.name}
                    />
                )}
            </div>
        </TooltipProvider>
    );
}