import { ReactNode } from "react";
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

interface DataTableProps<T> {
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
}: DataTableProps<T>) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
            {/* Scrollable Area with Single Table */}
            <ScrollArea style={{ height: maxHeight }} className="relative">
                <Table>
                    <TableHeader className="sticky top-0 z-10 bg-gray-50 border-b shadow-sm">
                        <TableRow>
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
                                    colSpan={showIndex ? columns.length + 1 : columns.length}
                                    className="h-32 text-center text-gray-500"
                                >
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((row, rowIndex) => (
                                <TableRow key={rowKey(row)} className="hover:bg-gray-50/50">
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
                            ))
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
