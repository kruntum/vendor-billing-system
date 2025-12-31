import { createRouter, createRoute, createRootRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/store/authStore";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DashboardPage from "@/features/dashboard/DashboardPage";
import JobsPage from "@/features/jobs/JobsPage";
import BillingPage from "@/features/billing/BillingPage";
import ReceiptsPage from "@/features/receipts/ReceiptsPage";
import CatalogsPage from "@/features/catalogs/CatalogsPage";
import SettingsPage from "@/features/settings/SettingsPage";
import UsersPage from "@/features/users/UsersPage";
import ReportsPage from "@/features/reports/ReportsPage";
import AdminDashboardPage from "@/features/admin/AdminDashboardPage";
import AdminVendorBillingPage from "@/features/admin/AdminVendorBillingPage";
import AdminVendorReceiptsPage from "@/features/admin/AdminVendorReceiptsPage";
import PaymentVoucherPage from "@/features/admin/PaymentVoucherPage";

// Create a root route
const rootRoute = createRootRoute({
  component: () => (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  ),
});

// Create index route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const jobsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/jobs",
  component: JobsPage,
});

const billingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/billing",
  component: BillingPage,
});

const receiptsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/receipts",
  component: ReceiptsPage,
});

const catalogsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/catalogs",
  component: CatalogsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/users",
  component: UsersPage,
});

const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reports",
  component: ReportsPage,
});

// Login route (for redirecting authenticated users)
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: () => {
    const user = useAuthStore.getState().user;
    if (user?.role === "ADMIN" || user?.role === "USER") {
      return <Navigate to="/admin" />;
    }
    return <Navigate to="/" />;
  },
});

// Admin Routes
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminDashboardPage,
});

const adminVendorBillingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/vendor/$vendorId/billing",
  component: AdminVendorBillingPage,
});

const adminVendorReceiptsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/vendor/$vendorId/receipts",
  component: AdminVendorReceiptsPage,
});

const paymentVoucherRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/payment-vouchers",
  component: PaymentVoucherPage,
});

// Create the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  jobsRoute,
  billingRoute,
  receiptsRoute,
  catalogsRoute,
  settingsRoute,
  usersRoute,
  reportsRoute,
  adminRoute,
  adminVendorBillingRoute,
  adminVendorReceiptsRoute,
  paymentVoucherRoute,
  loginRoute,
]);

// Create the router
export const router = createRouter({ routeTree });

// Register the router for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
