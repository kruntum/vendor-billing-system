import { useQueryClient } from "@tanstack/react-query";
import { ReactNode, useState, useEffect } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useAuthStore } from "@/store/authStore";
import { getRoleName } from "@/lib/api";
import { Toaster } from "@/components/ui/sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true); // Mobile toggle
  // Initialize from localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    return saved === "true";
  });
  const [currentTime, setCurrentTime] = useState(new Date());

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", isCollapsed.toString());
  }, [isCollapsed]);
  const queryClient = useQueryClient();
  const router = useRouter();

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    queryClient.removeQueries();
    router.invalidate();
  };

  // Get user role name
  const roleName = user ? getRoleName(user.role) : "";
  const isAdminOrUser = roleName === "ADMIN" || roleName === "USER";
  const isVendor = roleName === "VENDOR";
  const hasVendor = !!user?.vendor?.id;

  // Build navigation based on role
  const navigation = [
    { name: "แดชบอร์ด", icon: "📊", href: "/", show: hasVendor },
    // Admin/User only menu
    { name: "จัดการ Vendor", icon: "🏢", href: "/admin", show: isAdminOrUser },
    { name: "ใบสำคัญจ่าย", icon: "💰", href: "/admin/payment-vouchers", show: isAdminOrUser },
    { name: "อนุมัติสำรองเงินสด", icon: "✅", href: "/admin/cash-advance-approval", show: isAdminOrUser },
    // Vendor-specific menus (hidden for Admin/User without vendor)
    { name: "งาน (Jobs)", icon: "📦", href: "/jobs", show: hasVendor },
    { name: "ใบวางบิล", icon: "📄", href: "/billing", show: hasVendor },
    { name: "ใบเสร็จ", icon: "🧾", href: "/receipts", show: hasVendor },
    { name: "งานสำรองเงินสด", icon: "💵", href: "/cash-advance", show: hasVendor },
    { name: "วางบิลสำรองเงินสด", icon: "📑", href: "/cash-advance-billing", show: hasVendor },
    { name: "รายงาน", icon: "📈", href: "/reports", show: hasVendor },
    { name: "แค็ตตาล็อก", icon: "📋", href: "/catalogs", show: hasVendor },
    { name: "ผู้ใช้งาน", icon: "👥", href: "/users", show: true },

    // Settings: show for VENDOR role (even without company) and Admin/User
    { name: "ตั้งค่า", icon: "⚙️", href: "/settings", show: isVendor || isAdminOrUser },
  ].filter((item) => item.show);

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transform transition-all duration-300 ease-in-out 
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} 
          lg:translate-x-0 lg:static lg:block
          ${isCollapsed ? "w-20" : "w-64"}
          relative group
        `}
      >
        {/* Desktop Sidebar Collapse Toggle - Floating on Border */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-6 z-50 hidden lg:flex items-center justify-center w-6 h-6 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-full border border-gray-200 shadow-sm transition-all"
          title={isCollapsed ? "ขยายเมนู" : "ย่อเมนู"}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            )}
          </svg>
        </button>

        <div className="flex flex-col h-full">
          {/* Logo / Brand - Fixed Height h-16 */}
          <div className={`flex items-center ${isCollapsed ? "justify-center px-0" : "px-6 gap-3"} h-16 border-b border-gray-200 transition-all duration-300 overflow-hidden whitespace-nowrap`}>
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg">📄</span>
            </div>
            {!isCollapsed && (
              <div className="opacity-100 transition-opacity duration-300">
                <h1 className="font-bold text-gray-900">VBS</h1>
                <p className="text-xs text-gray-500">Billing System</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
            <TooltipProvider>
              {navigation.map((item) => (
                <div key={item.name}>
                  {isCollapsed ? (
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.href}
                          className={`flex items-center justify-center px-0 py-2.5 text-gray-700 rounded-lg hover:bg-gray-100 transition-all duration-300 group relative`}
                          activeProps={{
                            className: "bg-gray-100 text-primary font-medium",
                          }}
                        >
                          <span className="text-lg flex-shrink-0">{item.icon}</span>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="ml-2">
                        <p>{item.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link
                      to={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 text-gray-700 rounded-lg hover:bg-gray-100 transition-all duration-300 group relative`}
                      activeProps={{
                        className: "bg-gray-100 text-primary font-medium",
                      }}
                    >
                      <span className="text-lg flex-shrink-0">{item.icon}</span>
                      <span className="font-medium whitespace-nowrap overflow-hidden transition-all duration-300 opacity-100">{item.name}</span>
                    </Link>
                  )}
                </div>
              ))}
            </TooltipProvider>
          </nav>

          {/* User Info */}
          <div className="p-4 border-t border-gray-200">
            <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-gray-600 font-medium">
                  {user?.name?.[0] || user?.email[0].toUpperCase()}
                </span>
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0 transition-all duration-300 opacity-100 overflow-hidden">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.name || user?.email}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.vendor?.companyName || (user ? getRoleName(user.role) : "")}
                  </p>
                </div>
              )}
              {!isCollapsed && (
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
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
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        {/* Top Header - Fixed Height h-16 */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 h-16 flex items-center px-6">
          <div className="flex items-center gap-4">
            {/* Mobile Sidebar Toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            {/* Clock Display */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-gray-700 tabular-nums">
                {currentTime.toLocaleTimeString("th-TH", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
            {/* Date Display */}
            <span className="text-sm text-gray-500">
              {currentTime.toLocaleDateString("th-TH", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden overscroll-none">
          {children}
        </main>
      </div>

      <Toaster richColors position="top-right" />
    </div>
  );
}
