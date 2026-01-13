import { useQuery } from "@tanstack/react-query";
import { jobApi, billingApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  // Fetch jobs stats
  const { data: pendingJobs } = useQuery({
    queryKey: ["jobs", "pending"],
    queryFn: () => jobApi.list({ status: "PENDING", limit: 5 }),
    enabled: !!user?.vendor,
  });

  // Fetch billing stats
  const { data: recentBillings } = useQuery({
    queryKey: ["billing", "recent"],
    queryFn: () => billingApi.list({ limit: 5 }),
    enabled: !!user?.vendor,
  });

  const stats = [
    {
      label: "งานรอบิล",
      value: pendingJobs?.data?.pagination?.total || 0,
      icon: "📦",
      color: "bg-blue-500",
    },
    {
      label: "ใบวางบิลเดือนนี้",
      value: recentBillings?.data?.pagination?.total || 0,
      icon: "📄",
      color: "bg-green-500",
    },
    {
      label: "ยอดรวม (เดือนนี้)",
      value: formatCurrency(
        recentBillings?.data?.data?.reduce(
          (sum, b) => b.statusBillingNote !== "CANCELLED" ? sum + Number(b.netTotal) : sum,
          0
        ) || 0
      ),
      icon: "💰",
      color: "bg-yellow-500",
    },
    {
      label: "รอชำระ",
      value:
        recentBillings?.data?.data?.filter(
          (b) => b.statusBillingNote !== "PAID" && b.statusBillingNote !== "CANCELLED"
        ).length || 0,
      icon: "⏳",
      color: "bg-purple-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          สวัสดี, {user?.name || user?.email.split("@")[0]} 👋
        </h1>
        <p className="text-gray-500 mt-1">
          {user?.vendor?.companyName
            ? `บริษัท ${user.vendor.companyName}`
            : "ระบบบริหารจัดการวางบิล"}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stat.value}
                </p>
              </div>
              <div
                className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center`}
              >
                <span className="text-2xl">{stat.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Pending Jobs */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">งานรอวางบิล</h2>
            <a
              href="/jobs"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              ดูทั้งหมด →
            </a>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingJobs?.data?.data?.length ? (
              pendingJobs.data.data.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="px-5 py-3 flex items-center justify-between hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {job.description}
                    </p>
                    <p className="text-sm text-gray-500">{job.containerNo}</p>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(job.totalAmount)}
                  </span>
                </div>
              ))
            ) : (
              <p className="px-5 py-8 text-center text-gray-500">
                ไม่มีงานรอวางบิล
              </p>
            )}
          </div>
        </div>

        {/* Recent Billings */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">ใบวางบิลล่าสุด</h2>
            <a
              href="/billing"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              ดูทั้งหมด →
            </a>
          </div>
          <div className="divide-y divide-gray-100">
            {recentBillings?.data?.data?.length ? (
              recentBillings.data.data.slice(0, 5).map((billing) => (
                <div
                  key={billing.id}
                  className="px-5 py-3 flex items-center justify-between hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {billing.billingRef}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(billing.billingDate).toLocaleDateString("th-TH")}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`font-semibold ${billing.statusBillingNote === "CANCELLED" ? "text-gray-400 line-through" : "text-gray-900"}`}>
                      {formatCurrency(Number(billing.netTotal))}
                    </span>
                    <p
                      className={`text-xs mt-0.5 ${billing.statusBillingNote === "PAID"
                        ? "text-green-600"
                        : billing.statusBillingNote === "APPROVED"
                          ? "text-emerald-600"
                          : billing.statusBillingNote === "SUBMITTED"
                            ? "text-blue-600"
                            : billing.statusBillingNote === "CANCELLED"
                              ? "text-gray-500"
                              : "text-yellow-600"
                        }`}
                    >
                      {billing.statusBillingNote === "PAID"
                        ? "ชำระแล้ว"
                        : billing.statusBillingNote === "APPROVED"
                          ? "อนุมัติแล้ว"
                          : billing.statusBillingNote === "SUBMITTED"
                            ? "ส่งแล้ว"
                            : billing.statusBillingNote === "CANCELLED"
                              ? "ยกเลิก"
                              : "รอดำเนินการ"}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-5 py-8 text-center text-gray-500">
                ยังไม่มีใบวางบิล
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
