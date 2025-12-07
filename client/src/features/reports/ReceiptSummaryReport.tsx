import { useQuery } from "@tanstack/react-query";
import { receiptApi } from "@/lib/api";
import { format, isValid, parseISO, getMonth, getYear } from "date-fns";
import { th } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";

interface ReceiptSummaryReportProps {
    startDate: string;
    endDate: string;
}

// Icons
const DownloadIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const ChartIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
);

const safeFormatDate = (dateString: string | undefined | null, formatStr: string) => {
    if (!dateString) return "-";
    const date = parseISO(dateString);
    if (!isValid(date)) return "-";
    return format(date, formatStr, { locale: th });
};

export function ReceiptSummaryReport({ startDate, endDate }: ReceiptSummaryReportProps) {
    const [showChart, setShowChart] = useState(true);

    // Fetch receipt data
    const { data: receiptResponse, isLoading } = useQuery({
        queryKey: ["receipts", "report", startDate, endDate],
        queryFn: () => receiptApi.list().then((res) => res.data),
    });

    const allReceipts = Array.isArray(receiptResponse?.data) ? receiptResponse.data : [];

    // Filter by date range
    const receipts = allReceipts.filter((r) => {
        const receiptDate = new Date(r.receiptDate);
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return receiptDate >= start && receiptDate <= end;
    });

    // Calculate summary
    const summary = {
        total: receipts.length,
        totalAmount: receipts.reduce((sum, r) => sum + Number(r.billingNote?.netTotal || 0), 0),
    };

    // Group by month for chart
    const monthlyData = receipts.reduce((acc, r) => {
        const date = new Date(r.receiptDate);
        const key = `${getYear(date)}-${String(getMonth(date) + 1).padStart(2, "0")}`;
        if (!acc[key]) {
            acc[key] = { month: key, count: 0, amount: 0 };
        }
        acc[key].count += 1;
        acc[key].amount += Number(r.billingNote?.netTotal || 0);
        return acc;
    }, {} as Record<string, { month: string; count: number; amount: number }>);

    const chartData = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    const maxAmount = Math.max(...chartData.map((d) => d.amount), 1);

    // Export to Excel with styling
    const handleExportExcel = async () => {
        const ExcelJS = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("รายงานใบเสร็จ");

        // Define columns
        worksheet.columns = [
            { header: "#", key: "no", width: 8 },
            { header: "เลขที่ใบเสร็จ", key: "receiptRef", width: 18 },
            { header: "เลขที่ใบวางบิล", key: "billingRef", width: 18 },
            { header: "วันที่ใบเสร็จ", key: "date", width: 14 },
            { header: "สถานะ", key: "status", width: 14 },
            { header: "ยอดเงิน", key: "amount", width: 14 },
        ];

        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF217346" }, // Green color for receipt report
        };
        headerRow.alignment = { horizontal: "center", vertical: "middle" };
        headerRow.height = 24;

        // Add data rows
        receipts.forEach((r, index) => {
            const row = worksheet.addRow({
                no: index + 1,
                receiptRef: r.receiptRef,
                billingRef: r.billingNote?.billingRef || "-",
                date: safeFormatDate(r.receiptDate, "dd/MM/yyyy"),
                status: r.statusReceipt,
                amount: Number(r.billingNote?.netTotal || 0),
            });

            // Alternating row colors
            if (index % 2 === 1) {
                row.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFF2F2F2" },
                };
            }

            // Number formatting
            row.getCell("amount").numFmt = "#,##0.00";
        });

        // Add empty row
        worksheet.addRow({});

        // Add summary section
        const summaryHeaderRow = worksheet.addRow({ receiptRef: "สรุป" });
        summaryHeaderRow.font = { bold: true };
        summaryHeaderRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE2EFDA" },
        };

        const totalCountRow = worksheet.addRow({ receiptRef: "จำนวนทั้งหมด", billingRef: summary.total });
        totalCountRow.font = { bold: true };

        const totalAmountRow = worksheet.addRow({ receiptRef: "ยอดรวม", amount: summary.totalAmount });
        totalAmountRow.font = { bold: true };
        totalAmountRow.getCell("amount").numFmt = "#,##0.00";

        // Add borders to all cells
        worksheet.eachRow((row: any) => {
            row.eachCell((cell: any) => {
                cell.border = {
                    top: { style: "thin", color: { argb: "FFD0D0D0" } },
                    left: { style: "thin", color: { argb: "FFD0D0D0" } },
                    bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
                    right: { style: "thin", color: { argb: "FFD0D0D0" } },
                };
            });
        });

        // Generate and download file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `receipt-report-${startDate}-to-${endDate}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "PAID":
                return (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        ชำระแล้ว
                    </span>
                );
            case "PENDING":
                return (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        รอดำเนินการ
                    </span>
                );
            default:
                return (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                        {status}
                    </span>
                );
        }
    };

    const formatMonthLabel = (monthKey: string) => {
        const [year, month] = monthKey.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return format(date, "MMM yyyy", { locale: th });
    };

    if (isLoading) {
        return (
            <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-gray-500">กำลังโหลดข้อมูล...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">จำนวนใบเสร็จ</p>
                    <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">ยอดรวมทั้งหมด</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalAmount)}</p>
                </div>
            </div>

            {/* Chart Toggle & Export */}
            <div className="flex justify-between items-center">
                <button
                    onClick={() => setShowChart(!showChart)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${showChart ? "bg-primary text-white" : "bg-gray-100 text-gray-700"
                        }`}
                >
                    <ChartIcon />
                    {showChart ? "ซ่อนกราฟ" : "แสดงกราฟ"}
                </button>
                <button
                    onClick={handleExportExcel}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                    <DownloadIcon />
                    ส่งออก Excel
                </button>
            </div>

            {/* Monthly Revenue Chart */}
            {showChart && chartData.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold mb-4">ยอดรับเงินรายเดือน</h3>
                    <div className="flex items-end gap-2 h-48">
                        {chartData.map((item) => (
                            <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
                                <div className="w-full flex flex-col items-center">
                                    <span className="text-xs font-medium text-gray-600 mb-1">
                                        {formatCurrency(item.amount)}
                                    </span>
                                    <div
                                        className="w-full bg-gradient-to-t from-green-500 to-emerald-400 rounded-t-lg transition-all duration-500"
                                        style={{
                                            height: `${(item.amount / maxAmount) * 150}px`,
                                            minHeight: "10px",
                                        }}
                                    />
                                </div>
                                <span className="text-xs text-gray-500">{formatMonthLabel(item.month)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Data Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {receipts.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        ไม่พบข้อมูลในช่วงเวลาที่เลือก
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        เลขที่ใบเสร็จ
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        เลขที่ใบวางบิล
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        วันที่ใบเสร็จ
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                        สถานะ
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                        ยอดเงิน
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {receipts.map((receipt) => (
                                    <tr key={receipt.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                            {receipt.receiptRef}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                            {receipt.billingNote?.billingRef || "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                            {safeFormatDate(receipt.receiptDate, "d MMM yyyy")}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {getStatusBadge(receipt.statusReceipt)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-green-600">
                                            {formatCurrency(Number(receipt.billingNote?.netTotal || 0))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50">
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-right font-semibold text-gray-900">
                                        รวมทั้งหมด
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-green-600">
                                        {formatCurrency(summary.totalAmount)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
