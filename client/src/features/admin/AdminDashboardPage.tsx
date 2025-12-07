import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { vendorApi, VendorSummary } from "@/lib/api";

// Icons
const BuildingIcon = () => (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
);

const BillingIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

const ReceiptIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
);

export default function AdminDashboardPage() {
    const { data: vendorsResponse, isLoading } = useQuery({
        queryKey: ["vendors"],
        queryFn: () => vendorApi.list().then((res) => res.data),
    });

    const vendors = vendorsResponse?.data || [];

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
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">จัดการ Vendor</h1>
                <p className="text-sm text-gray-500">
                    เลือก Vendor เพื่อดูใบวางบิลและใบเสร็จ
                </p>
            </div>

            {/* Vendor Cards */}
            {vendors.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                    ไม่พบข้อมูล Vendor
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {vendors.map((vendor: VendorSummary) => (
                        <div
                            key={vendor.id}
                            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
                        >
                            {/* Vendor Header */}
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white">
                                    <BuildingIcon />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                                        {vendor.companyName}
                                    </h3>
                                    <p className="text-sm text-gray-500">{vendor.taxId}</p>
                                </div>
                            </div>

                            {/* Pending Counts */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-blue-50 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-blue-600">
                                        {vendor.pendingBillingCount}
                                    </p>
                                    <p className="text-xs text-blue-600">ใบวางบิลรอดำเนินการ</p>
                                </div>
                                <div className="bg-green-50 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-green-600">
                                        {vendor.pendingReceiptCount}
                                    </p>
                                    <p className="text-xs text-green-600">ใบเสร็จรอดำเนินการ</p>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                <Link
                                    to="/admin/vendor/$vendorId/billing"
                                    params={{ vendorId: vendor.id }}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                >
                                    <BillingIcon />
                                    ใบวางบิล
                                </Link>
                                <Link
                                    to="/admin/vendor/$vendorId/receipts"
                                    params={{ vendorId: vendor.id }}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                >
                                    <ReceiptIcon />
                                    ใบเสร็จ
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
