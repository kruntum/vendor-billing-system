import { useQuery } from "@tanstack/react-query";
import { billingApi } from "@/lib/api";
import { format, isValid, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";

interface BillingSummaryReportProps {
    startDate: string;
    endDate: string;
    status?: string;
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

export function BillingSummaryReport({ startDate, endDate, status }: BillingSummaryReportProps) {
    const [showChart, setShowChart] = useState(true);

    // Fetch billing data
    const { data: billingResponse, isLoading } = useQuery({
        queryKey: ["billing", "report", startDate, endDate, status],
        queryFn: () => billingApi.list({ status: status as any }).then((res) => res.data),
    });

    const allBillings = Array.isArray(billingResponse?.data) ? billingResponse.data : [];

    // Filter by date range
    const billings = allBillings.filter((b) => {
        const billingDate = new Date(b.billingDate);
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return billingDate >= start && billingDate <= end;
    });

    // Calculate summary
    const summary = {
        total: billings.length,
        totalAmount: billings.reduce((sum, b) => sum + Number(b.netTotal), 0),
        totalVat: billings.reduce((sum, b) => sum + Number(b.vatAmount), 0),
        totalWht: billings.reduce((sum, b) => sum + Number(b.whtAmount), 0),
        byStatus: billings.reduce((acc, b) => {
            acc[b.status] = (acc[b.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>),
    };

    // Export to Excel with styling
    const handleExportExcel = async () => {
        const ExcelJS = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("รายงานใบวางบิล");

        // Define columns
        worksheet.columns = [
            { header: "#", key: "no", width: 8 },
            { header: "เลขที่ใบวางบิล", key: "billingRef", width: 18 },
            { header: "วันที่", key: "date", width: 14 },
            { header: "สถานะ", key: "status", width: 14 },
            { header: "ยอดรวม", key: "subtotal", width: 14 },
            { header: "VAT", key: "vat", width: 12 },
            { header: "WHT", key: "wht", width: 12 },
            { header: "ยอดสุทธิ", key: "netTotal", width: 14 },
        ];

        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF4472C4" },
        };
        headerRow.alignment = { horizontal: "center", vertical: "middle" };
        headerRow.height = 24;

        // Add data rows
        billings.forEach((b, index) => {
            const row = worksheet.addRow({
                no: index + 1,
                billingRef: b.billingRef,
                date: safeFormatDate(b.billingDate, "dd/MM/yyyy"),
                status: b.status,
                subtotal: Number(b.subtotal),
                vat: Number(b.vatAmount),
                wht: Number(b.whtAmount),
                netTotal: Number(b.netTotal),
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
            row.getCell("subtotal").numFmt = "#,##0.00";
            row.getCell("vat").numFmt = "#,##0.00";
            row.getCell("wht").numFmt = "#,##0.00";
            row.getCell("netTotal").numFmt = "#,##0.00";
        });

        // Add empty row
        worksheet.addRow({});

        // Add summary section
        const summaryHeaderRow = worksheet.addRow({ billingRef: "สรุป" });
        summaryHeaderRow.font = { bold: true };
        summaryHeaderRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE2EFDA" },
        };

        const totalCountRow = worksheet.addRow({ billingRef: "จำนวนทั้งหมด", date: summary.total });
        totalCountRow.font = { bold: true };

        const totalAmountRow = worksheet.addRow({ billingRef: "ยอดรวมสุทธิ", netTotal: summary.totalAmount });
        totalAmountRow.font = { bold: true };
        totalAmountRow.getCell("netTotal").numFmt = "#,##0.00";

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
        link.download = `billing-report-${startDate}-to-${endDate}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const getStatusBadge = (statusVal: string) => {
        const statusMap: Record<string, { label: string; color: string }> = {
            PENDING: { label: "รอดำเนินการ", color: "bg-yellow-100 text-yellow-800" },
            SUBMITTED: { label: "ส่งแล้ว", color: "bg-blue-100 text-blue-800" },
            APPROVED: { label: "อนุมัติแล้ว", color: "bg-green-100 text-green-800" },
            PAID: { label: "ชำระแล้ว", color: "bg-emerald-100 text-emerald-800" },
            CANCELLED: { label: "ยกเลิก", color: "bg-red-100 text-red-800" },
        };
        const info = statusMap[statusVal] || { label: statusVal, color: "bg-gray-100 text-gray-800" };
        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${info.color}`}>
                {info.label}
            </span>
        );
    };

    // Simple bar chart data
    const chartData = Object.entries(summary.byStatus).map(([statusVal, count]) => ({
        status: statusVal,
        count,
        percentage: summary.total > 0 ? (count / summary.total) * 100 : 0,
    }));

    const statusColors: Record<string, string> = {
        PENDING: "bg-yellow-500",
        SUBMITTED: "bg-blue-500",
        APPROVED: "bg-green-500",
        PAID: "bg-emerald-500",
        CANCELLED: "bg-red-500",
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">จำนวนใบวางบิล</p>
                    <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">ยอดรวมสุทธิ</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(summary.totalAmount)}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">VAT รวม</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.totalVat)}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">หัก ณ ที่จ่าย รวม</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalWht)}</p>
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

            {/* Chart */}
            {showChart && chartData.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold mb-4">สถานะใบวางบิล</h3>
                    <div className="space-y-3">
                        {chartData.map((item) => (
                            <div key={item.status} className="flex items-center gap-4">
                                <div className="w-24 text-sm text-gray-600">
                                    {getStatusBadge(item.status)}
                                </div>
                                <div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${statusColors[item.status] || "bg-gray-500"} transition-all duration-500`}
                                        style={{ width: `${item.percentage}%` }}
                                    />
                                </div>
                                <div className="w-20 text-right text-sm font-medium">
                                    {item.count} ({item.percentage.toFixed(0)}%)
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Data Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {billings.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        ไม่พบข้อมูลในช่วงเวลาที่เลือก
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        เลขที่
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        วันที่
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                        สถานะ
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                        ยอดรวม
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                        VAT
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                        WHT
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                        ยอดสุทธิ
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {billings.map((billing) => (
                                    <tr key={billing.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                            {billing.billingRef}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                            {safeFormatDate(billing.billingDate, "d MMM yyyy")}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {getStatusBadge(billing.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900">
                                            {formatCurrency(Number(billing.subtotal))}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-blue-600">
                                            {formatCurrency(Number(billing.vatAmount))}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-red-600">
                                            -{formatCurrency(Number(billing.whtAmount))}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-primary">
                                            {formatCurrency(Number(billing.netTotal))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50">
                                <tr>
                                    <td colSpan={3} className="px-6 py-4 text-right font-semibold text-gray-900">
                                        รวมทั้งหมด
                                    </td>
                                    <td className="px-6 py-4 text-right font-semibold text-gray-900">
                                        {formatCurrency(billings.reduce((sum, b) => sum + Number(b.subtotal), 0))}
                                    </td>
                                    <td className="px-6 py-4 text-right font-semibold text-blue-600">
                                        {formatCurrency(summary.totalVat)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-semibold text-red-600">
                                        -{formatCurrency(summary.totalWht)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-primary">
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
