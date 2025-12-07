import { useState } from "react";
import { ReportFilters } from "./components/ReportFilters";
import { BillingSummaryReport } from "./BillingSummaryReport";
import { ReceiptSummaryReport } from "./ReceiptSummaryReport";
import { format, startOfMonth, endOfMonth } from "date-fns";

type ReportType = "billing-summary" | "receipt-summary" | null;
type PeriodType = "custom" | "this-month" | "last-month" | "this-year" | "last-year";

// Icons
const BillingIcon = () => (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

const ReceiptIcon = () => (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
);

const BackIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
);

interface Filters {
    startDate: string;
    endDate: string;
    periodType: PeriodType;
}

export default function ReportsPage() {
    const [selectedReport, setSelectedReport] = useState<ReportType>(null);
    const today = new Date();
    const [filters, setFilters] = useState<Filters>({
        startDate: format(startOfMonth(today), "yyyy-MM-dd"),
        endDate: format(endOfMonth(today), "yyyy-MM-dd"),
        periodType: "this-month",
    });
    const [statusFilter, setStatusFilter] = useState("ALL");

    const reportCards = [
        {
            id: "billing-summary" as ReportType,
            title: "รายงานใบวางบิล",
            description: "สรุปใบวางบิลตามช่วงเวลา แยกตามสถานะ พร้อมยอดรวม VAT และ WHT",
            icon: <BillingIcon />,
            color: "from-blue-500 to-indigo-600",
        },
        {
            id: "receipt-summary" as ReportType,
            title: "รายงานใบเสร็จ",
            description: "สรุปใบเสร็จรับเงินตามช่วงเวลา พร้อมยอดรวมที่ได้รับ",
            icon: <ReceiptIcon />,
            color: "from-green-500 to-emerald-600",
        },
    ];

    const handleFilterChange = (newFilters: typeof filters) => {
        setFilters(newFilters);
    };

    const renderReportContent = () => {
        switch (selectedReport) {
            case "billing-summary":
                return (
                    <BillingSummaryReport
                        startDate={filters.startDate}
                        endDate={filters.endDate}
                        status={statusFilter === "ALL" ? undefined : statusFilter}
                    />
                );
            case "receipt-summary":
                return (
                    <ReceiptSummaryReport
                        startDate={filters.startDate}
                        endDate={filters.endDate}
                    />
                );
            default:
                return null;
        }
    };

    if (selectedReport) {
        return (
            <div className="space-y-6">
                {/* Header with Back Button */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setSelectedReport(null)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <BackIcon />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {reportCards.find((r) => r.id === selectedReport)?.title}
                        </h1>
                        <p className="text-sm text-gray-500">
                            {reportCards.find((r) => r.id === selectedReport)?.description}
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <ReportFilters
                    onFilterChange={handleFilterChange}
                    showStatusFilter={selectedReport === "billing-summary"}
                    onStatusChange={setStatusFilter}
                />

                {/* Report Content */}
                {renderReportContent()}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">รายงาน</h1>
                <p className="text-sm text-gray-500">
                    เลือกประเภทรายงานที่ต้องการดู
                </p>
            </div>

            {/* Report Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reportCards.map((report) => (
                    <button
                        key={report.id}
                        onClick={() => setSelectedReport(report.id)}
                        className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:shadow-lg hover:border-gray-300 transition-all group"
                    >
                        <div
                            className={`w-14 h-14 rounded-xl bg-gradient-to-br ${report.color} text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                        >
                            {report.icon}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {report.title}
                        </h3>
                        <p className="text-sm text-gray-500">{report.description}</p>
                    </button>
                ))}
            </div>
        </div>
    );
}
