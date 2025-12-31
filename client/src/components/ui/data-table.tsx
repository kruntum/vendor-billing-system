import { ReactNode, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "./table";
import { Pagination } from "./pagination";
import { ScrollArea } from "./scroll-area";

export interface DataTableColumn<T> {
    header: string;
    accessorKey?: keyof T;
    cell?: (row: T) => ReactNode;
    className?: string;
}

export interface DataTableProps<T> {
    data: T[];
    columns: DataTableColumn<T>[];
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    emptyMessage?: string;
    rowKey: (row: T) => string;
    maxHeight?: string;
    showIndex?: boolean;
    renderSubComponent?: (row: T) => ReactNode;
}

export function DataTable<T>({
    data,
    columns,
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    onPageChange,
    onPageSizeChange,
    emptyMessage = "ไม่พบข้อมูล",
    rowKey,
    maxHeight = "calc(100vh - 340px)",
    showIndex = false,
    renderSubComponent,
}: DataTableProps<T>) {
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const toggleRow = (id: string) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedRows(newSet);
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
            {/* Scrollable Area with Single Table */}
            <ScrollArea style={{ height: maxHeight }} className="relative">
                <Table>
                    <TableHeader className="sticky top-0 z-10 bg-gray-50 border-b shadow-sm">
                        <TableRow>
                            {renderSubComponent && <TableHead className="w-10"></TableHead>}
                            {showIndex && (
                                <TableHead className="w-16 text-center">#</TableHead>
                            )}
                            {columns.map((column, index) => (
                                <TableHead key={index} className={column.className}>
                                    {column.header}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={
                                        (renderSubComponent ? 1 : 0) +
                                        (showIndex ? 1 : 0) +
                                        columns.length
                                    }
                                    className="h-32 text-center text-gray-500"
                                >
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((row, rowIndex) => {
                                const id = rowKey(row);
                                const isExpanded = expandedRows.has(id);
                                return (
                                    <>
                                        <TableRow
                                            key={id}
                                            className={`hover:bg-gray-50/50 ${isExpanded ? "bg-gray-50" : ""}`}
                                        >
                                            {renderSubComponent && (
                                                <TableCell className="text-center">
                                                    <button
                                                        onClick={() => toggleRow(id)}
                                                        className="p-1 hover:bg-gray-200 rounded-md transition-colors"
                                                    >
                                                        {isExpanded ? (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6" /></svg>
                                                        ) : (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right"><path d="m9 18 6-6-6-6" /></svg>
                                                        )}
                                                    </button>
                                                </TableCell>
                                            )}
                                            {showIndex && (
                                                <TableCell className="text-center text-gray-500 font-medium">
                                                    {(currentPage - 1) * pageSize + rowIndex + 1}
                                                </TableCell>
                                            )}
                                            {columns.map((column, index) => (
                                                <TableCell key={index} className={column.className}>
                                                    {column.cell
                                                        ? column.cell(row)
                                                        : column.accessorKey
                                                            ? String(row[column.accessorKey])
                                                            : null}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                        {isExpanded && renderSubComponent && (
                                            <TableRow key={`${id}-sub`} className="bg-gray-50/50 hover:bg-gray-50/50">
                                                <TableCell
                                                    colSpan={
                                                        1 + // sub component toggle col
                                                        (showIndex ? 1 : 0) +
                                                        columns.length
                                                    }
                                                    className="p-0 border-b"
                                                >
                                                    {renderSubComponent(row)}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>

            <div className="border-t bg-gray-50/50">
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={totalItems}
                    onPageChange={onPageChange}
                    onPageSizeChange={onPageSizeChange}
                />
            </div>
        </div>
    );
}
