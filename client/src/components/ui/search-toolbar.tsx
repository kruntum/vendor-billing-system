import { ReactNode } from "react";
import { Input } from "./input";
import { Select } from "./select";
import { Search, Calendar, RefreshCcw } from "lucide-react";

interface SearchToolbarProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    searchType?: string;
    onSearchTypeChange?: (value: string) => void;
    searchTypeOptions?: { value: string; label: string }[];
    dateRange?: { start: string; end: string };
    onDateRangeChange?: (range: { start: string; end: string }) => void;
    onReset: () => void;
    additionalFilters?: ReactNode;
}

export function SearchToolbar({
    searchTerm,
    onSearchChange,
    searchType,
    onSearchTypeChange,
    searchTypeOptions,
    dateRange,
    onDateRangeChange,
    onReset,
    additionalFilters,
}: SearchToolbarProps) {
    return (
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4 md:space-y-0 md:flex md:items-end md:gap-4">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search Type Select */}
                {searchTypeOptions && onSearchTypeChange && (
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">
                            ค้นหาตาม
                        </label>
                        <Select value={searchType} onChange={(e) => onSearchTypeChange(e.target.value)}>
                            {searchTypeOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </Select>
                    </div>
                )}

                {/* Search Input */}
                <div className={`space-y-1 ${searchTypeOptions ? "" : "md:col-span-2"}`}>
                    <label className="text-xs font-medium text-gray-500">
                        คำค้นหา
                    </label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="พิมพ์คำค้นหา..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                {/* Date Range */}
                {dateRange && onDateRangeChange && (
                    <>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">
                                ตั้งแต่วันที่
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) =>
                                        onDateRangeChange({ ...dateRange, start: e.target.value })
                                    }
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">
                                ถึงวันที่
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) =>
                                        onDateRangeChange({ ...dateRange, end: e.target.value })
                                    }
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    </>
                )}

                {/* Additional Filters Slot */}
                {additionalFilters}
            </div>

            {/* Reset Button */}
            <button
                onClick={onReset}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors mb-0.5"
                title="ล้างตัวกรอง"
            >
                <RefreshCcw className="h-5 w-5" />
            </button>
        </div>
    );
}
