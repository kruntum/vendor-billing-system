import { useState } from "react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import { th } from "date-fns/locale";

type PeriodType = "custom" | "this-month" | "last-month" | "this-year" | "last-year";

interface ReportFiltersProps {
    onFilterChange: (filters: {
        startDate: string;
        endDate: string;
        periodType: PeriodType;
    }) => void;
    showStatusFilter?: boolean;
    onStatusChange?: (status: string) => void;
}

export function ReportFilters({ onFilterChange, showStatusFilter, onStatusChange }: ReportFiltersProps) {
    const today = new Date();
    const [periodType, setPeriodType] = useState<PeriodType>("this-month");
    const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
    const [customEndDate, setCustomEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
    const [status, setStatus] = useState("ALL");

    const getDateRange = (type: PeriodType) => {
        const now = new Date();
        switch (type) {
            case "this-month":
                return {
                    startDate: format(startOfMonth(now), "yyyy-MM-dd"),
                    endDate: format(endOfMonth(now), "yyyy-MM-dd"),
                };
            case "last-month":
                const lastMonth = subMonths(now, 1);
                return {
                    startDate: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
                    endDate: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
                };
            case "this-year":
                return {
                    startDate: format(startOfYear(now), "yyyy-MM-dd"),
                    endDate: format(endOfYear(now), "yyyy-MM-dd"),
                };
            case "last-year":
                const lastYear = new Date(now.getFullYear() - 1, 0, 1);
                return {
                    startDate: format(startOfYear(lastYear), "yyyy-MM-dd"),
                    endDate: format(endOfYear(lastYear), "yyyy-MM-dd"),
                };
            case "custom":
            default:
                return {
                    startDate: customStartDate,
                    endDate: customEndDate,
                };
        }
    };

    const handlePeriodChange = (type: PeriodType) => {
        setPeriodType(type);
        const range = getDateRange(type);
        onFilterChange({ ...range, periodType: type });
    };

    const handleCustomDateChange = (start: string, end: string) => {
        setCustomStartDate(start);
        setCustomEndDate(end);
        if (periodType === "custom") {
            onFilterChange({ startDate: start, endDate: end, periodType: "custom" });
        }
    };

    const handleStatusChange = (newStatus: string) => {
        setStatus(newStatus);
        onStatusChange?.(newStatus);
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
                {/* Period Type Selector */}
                <div className="min-w-[140px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">ช่วงเวลา</label>
                    <select
                        value={periodType}
                        onChange={(e) => handlePeriodChange(e.target.value as PeriodType)}
                        className="w-full h-[42px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                        <option value="this-month">เดือนนี้</option>
                        <option value="last-month">เดือนที่แล้ว</option>
                        <option value="this-year">ปีนี้</option>
                        <option value="last-year">ปีที่แล้ว</option>
                        <option value="custom">กำหนดเอง</option>
                    </select>
                </div>

                {/* Custom Date Range */}
                {periodType === "custom" && (
                    <>
                        <div className="min-w-[160px]">
                            <label className="block text-sm font-medium text-gray-700 mb-1">วันที่เริ่มต้น</label>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => handleCustomDateChange(e.target.value, customEndDate)}
                                className="w-full h-[42px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        <div className="min-w-[160px]">
                            <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สิ้นสุด</label>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => handleCustomDateChange(customStartDate, e.target.value)}
                                className="w-full h-[42px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </>
                )}

                {/* Status Filter (optional) */}
                {showStatusFilter && (
                    <div className="min-w-[140px]">
                        <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                        <select
                            value={status}
                            onChange={(e) => handleStatusChange(e.target.value)}
                            className="w-full h-[42px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                            <option value="ALL">ทั้งหมด</option>
                            <option value="PENDING">รอดำเนินการ</option>
                            {/* <option value="SUBMITTED">ส่งแล้ว</option>
                            <option value="APPROVED">อนุมัติแล้ว</option> */}
                            <option value="PAID">ชำระแล้ว</option>
                            <option value="CANCELLED">ยกเลิก</option>
                        </select>
                    </div>
                )}
            </div>

            {/* Display Current Range */}
            <div className="text-sm text-gray-500">
                แสดงข้อมูลตั้งแต่{" "}
                <span className="font-medium text-gray-900">
                    {format(new Date(getDateRange(periodType).startDate), "d MMMM yyyy", { locale: th })}
                </span>{" "}
                ถึง{" "}
                <span className="font-medium text-gray-900">
                    {format(new Date(getDateRange(periodType).endDate), "d MMMM yyyy", { locale: th })}
                </span>
            </div>
        </div>
    );
}
