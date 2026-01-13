import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { cashAdvanceApi, CashAdvance, CreateCashAdvanceInput } from "@/lib/api";
import { toast } from "sonner";
import { CashAdvanceForm } from "./CashAdvanceForm";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { SearchToolbar } from "@/components/ui/search-toolbar";
import { isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";

// Helpers
const formatDate = (dateString: string) => {
    try {
        return format(new Date(dateString), "dd MMM yyyy", { locale: th });
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

// Icons
const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" />
        <path d="M12 5v14" />
    </svg>
);

const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
);

const ViewIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const EditIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
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

// Status Badge
function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
        DRAFT: "bg-gray-100 text-gray-800",
        PENDING: "bg-blue-100 text-blue-800",
        BILLED: "bg-green-100 text-green-800",
    };
    const labels: Record<string, string> = {
        DRAFT: "ร่าง",
        PENDING: "รอวางบิล",
        BILLED: "วางบิลแล้ว",
    };
    return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100"}`}>
            {labels[status] || status}
        </span>
    );
}

export default function CashAdvancePage() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editingAdvance, setEditingAdvance] = useState<CashAdvance | null>(null);
    const [viewingAdvance, setViewingAdvance] = useState<CashAdvance | null>(null);
    const [initialFormValues, setInitialFormValues] = useState<Partial<CreateCashAdvanceInput> | null>(null);

    // Fetch cash advances
    const { data: response, isLoading } = useQuery({
        queryKey: ["cash-advances"],
        queryFn: () => cashAdvanceApi.list().then((res) => res.data),
    });

    const advances = response?.data || [];

    // Filter State
    const [searchTerm, setSearchTerm] = useState("");
    const [searchType, setSearchType] = useState<"description" | "refInvoiceNo" | "containerNo">("description");
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });

    // Filter Logic
    const filteredAdvances = advances.filter((advance) => {
        // 1. Date Range Filter
        if (dateRange.start && dateRange.end) {
            const advanceDate = parseISO(advance.advanceDate);
            const start = startOfDay(parseISO(dateRange.start));
            const end = endOfDay(parseISO(dateRange.end));

            if (!isWithinInterval(advanceDate, { start, end })) {
                return false;
            }
        }

        // 2. Search Filter
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();

        if (searchType === "description") {
            return (
                advance.description?.toLowerCase().includes(term) ||
                advance.advanceRef?.toLowerCase().includes(term)
            );
        }
        if (searchType === "refInvoiceNo") {
            return advance.refInvoiceNo?.toLowerCase().includes(term);
        }
        if (searchType === "containerNo") {
            return advance.containerNo?.toLowerCase().includes(term);
        }

        return true;
    });

    const resetFilters = () => {
        setSearchTerm("");
        setDateRange({ start: "", end: "" });
        setSearchType("description");
    };

    // Submit mutation
    const submitMutation = useMutation({
        mutationFn: cashAdvanceApi.submit,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cash-advances"] });
            toast.success("ส่งรายการเรียบร้อย (รอวางบิล)");
        },
        onError: () => {
            toast.error("เกิดข้อผิดพลาด");
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: cashAdvanceApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cash-advances"] });
            toast.success("ลบรายการเรียบร้อย");
        },
        onError: () => {
            toast.error("เกิดข้อผิดพลาด");
        },
    });



    const handleCreate = () => {
        setEditingAdvance(null);
        setInitialFormValues(null);
        setShowForm(true);
    };

    const handleCopy = (advance: CashAdvance) => {
        setEditingAdvance(null);
        setInitialFormValues({
            advanceDate: format(new Date(), "yyyy-MM-dd"), // Today
            description: advance.description,
            // Clear unique fields
            refInvoiceNo: "",
            containerNo: "",
            truckPlate: "",
            declarationNo: "",
            items: advance.items.map(item => ({
                description: item.description,
                amount: item.amount,
                receiptFile: item.receiptFile
            }))
        });
        setShowForm(true);
    };

    const handleEdit = (advance: CashAdvance) => {
        setEditingAdvance(advance);
        setShowForm(true);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingAdvance(null);
    };

    const handleFormSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ["cash-advances"] });
        setShowForm(false);
        setEditingAdvance(null);
        setInitialFormValues(null);
        toast.success(editingAdvance ? "แก้ไขสำเร็จ" : "สร้างสำเร็จ");
    };

    const handleSubmit = (id: string) => {
        submitMutation.mutate(id);
    };

    const handleDelete = (id: string) => {
        deleteMutation.mutate(id);
    };

    if (isLoading) {
        return <div className="p-8 text-center">กำลังโหลด...</div>;
    }

    return (
        <TooltipProvider delayDuration={200}>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">งานสำรองเงินสด (Cash Advance)</h1>
                        <p className="text-sm text-gray-500">สร้างและจัดการรายการเบิกเงินสำรอง (เพื่อนำไปวางบิล)</p>
                    </div>
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        <PlusIcon />
                        <span>สร้างใหม่</span>
                    </button>
                </div>

                <SearchToolbar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    searchType={searchType}
                    onSearchTypeChange={(value) => setSearchType(value as any)}
                    searchTypeOptions={[
                        { value: "description", label: "รายละเอียด" },
                        { value: "refInvoiceNo", label: "เลขที่อินวอย" },
                        { value: "containerNo", label: "เบอร์ตู้" },
                    ]}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    onReset={resetFilters}
                />

                {/* Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">รายละเอียด</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขที่อินวอย</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เบอร์ตู้</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">ยอดรวม</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredAdvances.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        ยังไม่มีรายการ
                                    </td>
                                </tr>
                            ) : (
                                filteredAdvances.map((advance) => (
                                    <tr key={advance.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-2 text-sm text-gray-600">
                                            {formatDate(advance.advanceDate)}
                                        </td>
                                        <td className="px-6 py-2">
                                            <div>
                                                <div className="font-medium text-gray-900">{advance.description || "-"}</div>
                                                <div className="text-xs text-gray-500">
                                                    {advance.advanceRef} • {advance.items.length} รายการ
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-2 text-sm text-gray-500">
                                            {advance.refInvoiceNo || "-"}
                                        </td>
                                        <td className="px-6 py-2 text-sm text-gray-500">
                                            {advance.containerNo || "-"}
                                        </td>
                                        <td className="px-6 py-2 text-sm text-right font-medium">
                                            {formatCurrency(Number(advance.totalAmount))}
                                        </td>
                                        <td className="px-6 py-2 text-center">
                                            {getStatusBadge(advance.status)}
                                        </td>
                                        <td className="px-6 py-2">
                                            <div className="flex items-center justify-center gap-2">
                                                {/* View button */}
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            onClick={() => setViewingAdvance(advance)}
                                                            className="p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        >
                                                            <ViewIcon />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>ดูรายละเอียด</p>
                                                    </TooltipContent>
                                                </Tooltip>

                                                {/* Copy button */}
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            onClick={() => handleCopy(advance)}
                                                            className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                                                        >
                                                            <CopyIcon />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>คัดลอก</p>
                                                    </TooltipContent>
                                                </Tooltip>

                                                {/* Edit button */}
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            onClick={() => handleEdit(advance)}
                                                            className="p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            disabled={advance.status !== "DRAFT" && advance.status !== "PENDING"}
                                                        >
                                                            <EditIcon />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>แก้ไข</p>
                                                    </TooltipContent>
                                                </Tooltip>

                                                {/* Delete button */}
                                                <AlertDialog>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <AlertDialogTrigger asChild>
                                                                <button
                                                                    className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    disabled={advance.status !== "DRAFT"}
                                                                >
                                                                    <TrashIcon />
                                                                </button>
                                                            </AlertDialogTrigger>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>ลบ</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>ยืนยันการลบ?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                คุณต้องการลบรายการ {advance.advanceRef} นี้ใช่หรือไม่?<br />
                                                                การดำเนินการนี้ไม่สามารถย้อนกลับได้
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(advance.id)} className="bg-red-600 hover:bg-red-700">
                                                                ยืนยันลบ
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>

                                                {/* Send button (only for DRAFT) */}
                                                {advance.status === "DRAFT" && (
                                                    <AlertDialog>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <AlertDialogTrigger asChild>
                                                                    <button
                                                                        className="p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors"
                                                                    >
                                                                        <SendIcon />
                                                                    </button>
                                                                </AlertDialogTrigger>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>ส่ง (พร้อมวางบิล)</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>ยืนยันการส่งรายการ?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    คุณต้องการส่งรายการ {advance.advanceRef} นี้ใช่หรือไม่?<br />
                                                                    หลังจากส่งแล้ว รายการจะมีสถานะเป็น "รอวางบิล" และสามารถนำไปสร้างใบวางบิลได้
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleSubmit(advance.id)} className="bg-blue-600 hover:bg-blue-700">
                                                                    ยืนยัน
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Form Modal */}
                {showForm && (
                    <CashAdvanceForm
                        cashAdvance={editingAdvance}
                        initialValues={initialFormValues}
                        onClose={handleCloseForm}
                        onSuccess={handleFormSuccess}
                    />
                )}

                {/* Detail Modal */}
                {viewingAdvance && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/50 backdrop-blur-sm p-4 md:p-0">
                        <div className="relative w-full max-w-3xl rounded-lg bg-white shadow-lg ring-1 ring-gray-900/5 my-8 max-h-[90vh] flex flex-col">
                            <div className="p-6 flex-1 flex flex-col overflow-hidden">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">รายละเอียดงาน</h2>
                                        <p className="text-sm text-gray-500">{viewingAdvance.description || viewingAdvance.advanceRef}</p>
                                    </div>
                                    <button
                                        onClick={() => setViewingAdvance(null)}
                                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="overflow-y-auto flex-1 pr-2">
                                    {/* General Info */}
                                    <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
                                        <div>
                                            <p className="text-sm text-gray-500">วันที่ (Date)</p>
                                            <p className="font-medium">{formatDate(viewingAdvance.advanceDate)}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">สถานะ</p>
                                            {getStatusBadge(viewingAdvance.status)}
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Ref Invoice No.</p>
                                            <p className="font-medium">{viewingAdvance.refInvoiceNo || "-"}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Declaration No.</p>
                                            <p className="font-medium">{viewingAdvance.declarationNo || "-"}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Container No.</p>
                                            <p className="font-medium">{viewingAdvance.containerNo || "-"}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">ทะเบียนรถ</p>
                                            <p className="font-medium">{viewingAdvance.truckPlate || "-"}</p>
                                        </div>
                                    </div>

                                    {/* Items */}
                                    <h3 className="font-semibold mb-3">รายการค่าใช้จ่าย ({viewingAdvance.items.length} รายการ)</h3>
                                    <div className="border rounded-lg overflow-hidden mb-6">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">รายการ</th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">จำนวนเงิน</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {viewingAdvance.items.map((item, index) => (
                                                    <tr key={index}>
                                                        <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(Number(item.amount))}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50">
                                                <tr>
                                                    <td className="px-4 py-3 text-sm font-semibold text-right">รวมทั้งหมด</td>
                                                    <td className="px-4 py-3 text-sm text-right font-bold text-primary">
                                                        {formatCurrency(Number(viewingAdvance.totalAmount))}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4 border-t mt-4">
                                    <button
                                        onClick={() => setViewingAdvance(null)}
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
            </div>
        </TooltipProvider>
    );
}
