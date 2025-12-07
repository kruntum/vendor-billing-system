import { useQueryClient } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useAuthStore } from "@/store/authStore";
import { getRoleName } from "@/lib/api";
import { Toaster } from "@/components/ui/sonner";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const queryClient = useQueryClient();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    queryClient.removeQueries();
    router.invalidate();
  };

  // Get user role name
  const roleName = user ? getRoleName(user.role) : "";
  const isAdminOrUser = roleName === "ADMIN" || roleName === "USER";
  const hasVendor = !!user?.vendor?.id;

  // Build navigation based on role
  const navigation = [
    { name: "แดชบอร์ด", icon: "📊", href: "/", show: hasVendor },
    // Admin/User only menu
    { name: "จัดการ Vendor", icon: "🏢", href: "/admin", show: isAdminOrUser },
    // Vendor-specific menus (hidden for Admin/User without vendor)
    { name: "งาน (Jobs)", icon: "📦", href: "/jobs", show: hasVendor },
    { name: "ใบวางบิล", icon: "📄", href: "/billing", show: hasVendor },
    { name: "ใบเสร็จ", icon: "🧾", href: "/receipts", show: hasVendor },
    { name: "รายงาน", icon: "📈", href: "/reports", show: hasVendor }, // Hide for Admin/User
    { name: "แค็ตตาล็อก", icon: "📋", href: "/catalogs", show: hasVendor },
    { name: "ผู้ใช้งาน", icon: "👥", href: "/users", show: true },
    { name: "ตั้งค่า", icon: "⚙️", href: "/settings", show: hasVendor || isAdminOrUser },
  ].filter((item) => item.show);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
            <span className="text-white text-lg">📄</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900">VBS</h1>
            <p className="text-xs text-gray-500">Billing System</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className="flex items-center gap-3 px-3 py-2.5 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              activeProps={{
                className: "bg-gray-100 text-primary font-medium",
              }}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium">{item.name}</span>
            </Link>
          ))}
        </nav>

        {/* User Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-600 font-medium">
                {user?.name?.[0] || user?.email[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name || user?.email}
              </p>
              <p className="text-xs text-gray-500">
                {user?.vendor?.companyName || (user ? getRoleName(user.role) : "")}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="ออกจากระบบ"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`${sidebarOpen ? "lg:pl-64" : ""} transition-all duration-300`}>
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-4 ml-auto">
              <span className="text-sm text-gray-500">
                {new Date().toLocaleDateString("th-TH", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="px-4 pt-4">{children}</main>
      </div>
      <Toaster />
    </div >
  );
}
