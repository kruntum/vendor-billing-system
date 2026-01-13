import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi, pdfApi, receiptApi, paymentVoucherApi, BillingNote } from "@/lib/api";
import { BillingForm } from "./BillingForm";
import { BillingDetailModal } from "./BillingDetailModal";
import { ReceiptDateModal } from "./ReceiptDateModal";
import { BillingNotePreviewDialog } from "./BillingNotePreviewDialog";
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { SearchToolbar } from "@/components/ui/search-toolbar";
import { toast } from "sonner";
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

// Icons
const EditIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
);

const CancelIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const ViewIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const PrintBillingIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
);

const PrintReceiptIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

const SendIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
);

const PreviewIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
    </svg>
);

export default function BillingPage() {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedBilling, setSelectedBilling] = useState<BillingNote | null>(null);
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [previewBilling, setPreviewBilling] = useState<BillingNote | null>(null);

    // Filter & Pagination State
    const [searchTerm, setSearchTerm] = useState("");
    const [searchType, setSearchType] = useState<"billingRef" | "containerNo" | "refInvoice">("billingRef");
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(30);

    const queryClient = useQueryClient();

    const { data: billingResponse, isLoading } = useQuery({
        queryKey: ["billing"],
        queryFn: () => billingApi.list().then((res) => res.data),
        refetchOnMount: "always",  // Always fetch fresh data when page loads
        staleTime: 0,              // Data is immediately considered stale
    });

    const billingNotes = Array.isArray(billingResponse?.data) ? billingResponse.data : [];

    // Filter Logic
    const filteredNotes = useMemo(() => {
        return billingNotes.filter((note) => {
            // 1. Date Range Filter
            if (dateRange.start && dateRange.end) {
                const noteDate = parseISO(note.billingDate);
                const start = startOfDay(parseISO(dateRange.start));
                const end = endOfDay(parseISO(dateRange.end));

                if (!isWithinInterval(noteDate, { start, end })) {
                    return false;
                }
            }

            // 2. Search Filter
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();

            if (searchType === "billingRef") {
                return note.billingRef?.toLowerCase().includes(term);
            }

            if (searchType === "containerNo" || searchType === "refInvoice") {
                return note.jobs?.some(job => {
                    if (searchType === "containerNo") {
                        return job.containerNo?.toLowerCase().includes(term) || job.truckPlate?.toLowerCase().includes(term);
                    }
                    if (searchType === "refInvoice") {
                        return job.refInvoiceNo?.toLowerCase().includes(term);
                    }
                    return false;
                });
            }

            return true;
        });
    }, [billingNotes, searchTerm, searchType, dateRange]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredNotes.length / pageSize);
    const paginatedNotes = filteredNotes.slice(
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
        setSearchType("billingRef");
        setCurrentPage(1);
    };

    const handleCreate = () => {
        setSelectedBilling(null);
        setIsFormOpen(true);
    };

    const handleViewDetails = (billing: BillingNote) => {
        setSelectedBilling(billing);
    };

    const handleCloseDetails = () => {
        setSelectedBilling(null);
    };

    const handleEdit = () => {
        if (!selectedBilling) return;
        setIsFormOpen(true);
    };

    const handleCancel = async () => {
        if (!selectedBilling) return;

        try {
            await billingApi.cancel(selectedBilling.id);
            queryClient.invalidateQueries({ queryKey: ["billing"] });
            queryClient.invalidateQueries({ queryKey: ["jobs"] });
            toast.success("ยกเลิกใบวางบิลเรียบร้อยแล้ว");
            handleCloseDetails();
        } catch (error) {
            console.error("Cancel error:", error);
            toast.error("เกิดข้อผิดพลาดในการยกเลิกเอกสาร");
        }
    };

    const handleSubmit = async () => {
        if (!selectedBilling) return;

        try {
            await billingApi.updateStatus(selectedBilling.id, "SUBMITTED");
            queryClient.invalidateQueries({ queryKey: ["billing"] });
            toast.success("ส่งใบวางบิลเรียบร้อยแล้ว");
            handleCloseDetails();
        } catch (error) {
            console.error("Submit error:", error);
            toast.error("เกิดข้อผิดพลาดในการส่งใบวางบิล");
        }
    };

    const handleCancelDirect = async (note: BillingNote) => {
        try {
            await billingApi.cancel(note.id);
            queryClient.invalidateQueries({ queryKey: ["billing"] });
            queryClient.invalidateQueries({ queryKey: ["jobs"] });
            toast.success("ยกเลิกใบวางบิลเรียบร้อยแล้ว");
        } catch (error) {
            console.error("Cancel error:", error);
            toast.error("เกิดข้อผิดพลาดในการยกเลิกเอกสาร");
        }
    };

    const handleSubmitDirect = async (note: BillingNote) => {
        try {
            await billingApi.updateStatus(note.id, "SUBMITTED");
            queryClient.invalidateQueries({ queryKey: ["billing"] });
            toast.success("ส่งใบวางบิลเรียบร้อยแล้ว");
        } catch (error) {
            console.error("Submit error:", error);
            toast.error("เกิดข้อผิดพลาดในการส่งใบวางบิล");
        }
    };

    const handleEditDirect = (note: BillingNote) => {
        setSelectedBilling(note);
        setIsFormOpen(true);
    };

    const handlePrint = async () => {
        if (!selectedBilling) return;

        setIsPdfGenerating(true);
        try {
            const response = await pdfApi.getBillingPreview(selectedBilling.id);
            const blob = new Blob([response.data], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            window.open(`${url}#view=Fit`, "_blank");
        } catch (error) {
            console.error("PDF generation error:", error);
            toast.error("เกิดข้อผิดพลาดในการสร้างไฟล์ PDF");
        } finally {
            setIsPdfGenerating(false);
        }
    };

    const handlePrintDirect = async (note: BillingNote) => {
        setIsPdfGenerating(true);
        try {
            const response = await pdfApi.getBillingPreview(note.id);
            const blob = new Blob([response.data], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            window.open(`${url}#view=Fit`, "_blank");
        } catch (error: any) {
            console.error("PDF generation error:", error);
            console.error("Error response:", error?.response?.data);
            toast.error("เกิดข้อผิดพลาดในการสร้างไฟล์ PDF ใบวางบิล");
        } finally {
            setIsPdfGenerating(false);
        }
    };

    const renderJobsTable = (note: BillingNote) => {
        if (!note.jobs || note.jobs.length === 0) return <div className="p-4 text-center text-gray-500 text-sm">ไม่มีรายการงาน</div>;

        return (
            <div className="pl-12 pr-4 py-2 bg-gray-100/50">
                <h4 className="text-xs font-semibold text-gray-500 mb-2">รายการงาน (Jobs)</h4>
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
                            {note.jobs.map((job: any, index: number) => {
                                // Note: job.items calculation might be needed if amount is not directly available or depends on items
                                // Based on PaymentVoucherPage checking if amount is available directly or needs summing
                                const amount = job.totalAmount || (job.items?.reduce((sum: number, item: any) => sum + Number(item.amount), 0) || 0);
                                return (
                                    <tr key={job.id}>
                                        <td className="px-4 py-2 text-sm text-gray-500">{index + 1}</td>
                                        <td className="px-4 py-2 text-sm text-gray-900">{job.containerNo || "-"}</td>
                                        <td className="px-4 py-2 text-sm text-gray-900">{job.truckPlate || "-"}</td>
                                        <td className="px-4 py-2 text-sm text-gray-900">{job.refInvoiceNo || "-"}</td>
                                        <td className="px-4 py-2 text-sm text-gray-900">{job.declarationNo || "-"}</td>
                                        <td className="px-4 py-2 text-sm text-gray-900">{job.description || "-"}</td>
                                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{Number(amount).toLocaleString()} ฿</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const handlePrintReceipt = async () => {
        const receipt = selectedBilling?.receipt || selectedBilling?.paymentVoucher?.receipt;
        if (!receipt) return;

        setIsPdfGenerating(true);
        try {
            const response = await pdfApi.getReceiptPreview(receipt.id);
            const blob = new Blob([response.data], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            window.open(`${url}#view=Fit`, "_blank");
        } catch (error) {
            console.error("Receipt PDF generation error:", error);
            toast.error("เกิดข้อผิดพลาดในการสร้างไฟล์ PDF ใบเสร็จ");
        } finally {
            setIsPdfGenerating(false);
        }
    };

    const handlePrintReceiptDirect = async (note: BillingNote) => {
        const receipt = note.receipt || note.paymentVoucher?.receipt;
        if (!receipt) return;
        setIsPdfGenerating(true);
        try {
            const response = await pdfApi.getReceiptPreview(receipt.id);
            const blob = new Blob([response.data], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            window.open(`${url}#view=Fit`, "_blank");
        } catch (error) {
            console.error("Receipt PDF generation error:", error);
            toast.error("เกิดข้อผิดพลาดในการสร้างไฟล์ PDF ใบเสร็จ");
        } finally {
            setIsPdfGenerating(false);
        }
    };

    const handleIssueReceipt = () => {
        setIsReceiptModalOpen(true);
    };

    const handleConfirmReceipt = async (data: any) => {
        if (!selectedBilling) return;

        try {
            if (selectedBilling.paymentVoucherId) {
                // New flow: Confirm Payment on PV
                await paymentVoucherApi.confirmPayment(selectedBilling.paymentVoucherId, data);
            } else {
                // Legacy flow: Create Receipt on Billing Note
                await receiptApi.create(selectedBilling.id, data.paymentDate);
            }

            queryClient.invalidateQueries({ queryKey: ["billing"] });
            queryClient.invalidateQueries({ queryKey: ["jobs"] });
            setIsReceiptModalOpen(false);
            toast.success("บันทึกการรับเงินและออกใบเสร็จเรียบร้อยแล้ว");
            handleCloseDetails();
        } catch (error) {
            console.error("Receipt creation error:", error);
            toast.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        }
    };

    if (isLoading) {
        return <div>Loading...</div>;
    }

    // Define columns
    const columns: DataTableColumn<BillingNote>[] = [
        {
            header: "เลขที่ใบวางบิล",
            cell: (note) => <span className="font-medium text-gray-900">{note.billingRef}</span>,
        },
        {
            header: "วันที่",
            cell: (note) => <span className="text-gray-500">{format(new Date(note.billingDate), "dd/MM/yyyy")}</span>,
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
                    {Number(note.netTotal).toLocaleString()} ฿
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
                        ? "ออกใบเสร็จแล้ว"
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
            header: "ใบเสร็จ",
            className: "text-center",
            cell: (note) => {
                const receipt = note.receipt || note.paymentVoucher?.receipt;
                return receipt ? (
                    <span className="text-xs text-green-600">{receipt.receiptRef}</span>
                ) : (
                    <span className="text-xs text-gray-400">-</span>
                );
            },
        },
        {
            header: "จัดการ",
            className: "text-center",
            cell: (note) => {
                const canEdit = note.statusBillingNote === "PENDING";
                const hasReceipt = !!(note.receipt || note.paymentVoucher?.receipt);
                const canConfirm = note.statusBillingNote === "APPROVED" && !hasReceipt; // Approved = Waiting for Payment/Receipt

                return (
                    <div className="flex items-center justify-center gap-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => handleViewDetails(note)}
                                    className="p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-colors"
                                >
                                    <ViewIcon />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>ดูรายละเอียด</p>
                            </TooltipContent>
                        </Tooltip>

                        {canEdit && (
                            <AlertDialog>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <AlertDialogTrigger asChild>
                                            <button className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors">
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
                                            คุณต้องการส่งใบวางบิลเลขที่ {note.billingRef} ให้ Admin ตรวจสอบใช่หรือไม่?
                                            <br />
                                            หลังจากส่งแล้วจะไม่สามารถแก้ไขได้
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => handleSubmitDirect(note)}
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            ยืนยันการส่ง
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setPreviewBilling(note)}
                                    className="p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-colors"
                                >
                                    <PreviewIcon />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>ดูตัวอย่าง PDF</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => handlePrintDirect(note)}
                                    className="p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors"
                                >
                                    <PrintBillingIcon />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>พิมพ์ใบวางบิล</p>
                            </TooltipContent>
                        </Tooltip>

                        {hasReceipt && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => handlePrintReceiptDirect(note)}
                                        className="p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors"
                                    >
                                        <PrintReceiptIcon />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>พิมพ์ใบเสร็จ</p>
                                </TooltipContent>
                            </Tooltip>
                        )}

                        {canEdit && (
                            <>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => handleEditDirect(note)}
                                            className="p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-colors"
                                        >
                                            <EditIcon />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>แก้ไข</p>
                                    </TooltipContent>
                                </Tooltip>

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
                                            <p>ยกเลิก</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>ยืนยันการยกเลิก?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                คุณต้องการยกเลิกใบวางบิลเลขที่ {note.billingRef} ใช่หรือไม่?
                                                <br />
                                                การดำเนินการนี้จะคืนสถานะงานทั้งหมดกลับเป็น "รอดำเนินการ"
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => handleCancelDirect(note)}
                                                className="bg-red-600 hover:bg-red-700"
                                            >
                                                ยืนยันการยกเลิก
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </>
                        )}

                        {canConfirm && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => {
                                            setSelectedBilling(note);
                                            setIsReceiptModalOpen(true);
                                        }}
                                        className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        ยืนยันรับเงิน
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>บันทึกการรับเงินและออกใบเสร็จ</p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <TooltipProvider delayDuration={200}>
            <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">ใบวางบิล (Billing Notes)</h1>
                        <p className="text-sm text-gray-500">จัดการใบวางบิลและการชำระเงิน</p>
                    </div>
                    <button
                        onClick={handleCreate}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        สร้างใบวางบิลใหม่
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
                        { value: "refInvoice", label: "เลขที่อินวอย" },
                    ]}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    onReset={resetFilters}
                />

                <DataTable
                    data={paginatedNotes}
                    columns={columns}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={filteredNotes.length}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                    rowKey={(note) => note.id}
                    emptyMessage="ไม่พบข้อมูลใบวางบิล"
                    maxHeight="calc(100vh - 365px)"
                    showIndex={true}
                    renderSubComponent={renderJobsTable}
                />

                {isFormOpen && (
                    <BillingForm
                        onClose={() => {
                            setIsFormOpen(false);
                            setSelectedBilling(null);
                        }}
                        initialData={selectedBilling || undefined}
                        onSuccess={() => {
                            queryClient.invalidateQueries({ queryKey: ["billing"] });
                            queryClient.invalidateQueries({ queryKey: ["jobs"] });
                            setIsFormOpen(false);
                            setSelectedBilling(null);
                            toast.success("บันทึกข้อมูลเรียบร้อยแล้ว");
                        }}
                    />
                )}

                <BillingDetailModal
                    billing={!isFormOpen ? selectedBilling : null}
                    onClose={handleCloseDetails}
                    onEdit={handleEdit}
                    onCancel={handleCancel}
                    onSubmit={handleSubmit}
                    onPrint={handlePrint}
                    onPrintReceipt={handlePrintReceipt}
                    onIssueReceipt={handleIssueReceipt}
                    isPdfGenerating={isPdfGenerating}
                />

                <ReceiptDateModal
                    isOpen={isReceiptModalOpen}
                    onClose={() => setIsReceiptModalOpen(false)}
                    onConfirm={handleConfirmReceipt}
                    billingRef={selectedBilling?.billingRef || ""}
                />

            </div>
            {/* Other Modals */}
            <BillingNotePreviewDialog
                billing={previewBilling}
                onClose={() => setPreviewBilling(null)}
            />
        </TooltipProvider>
    );
}
