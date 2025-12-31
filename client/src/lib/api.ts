import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Only redirect if not already trying to refresh
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

// API Types
// Note: role can be string (from /auth/login) or object (from /users API)
export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string | { id: string; name: string }; // Can be string or object depending on endpoint
  vendor: {
    id: string;
    companyName: string;
  } | null;
}

// Helper to get role name
export function getRoleName(role: User["role"]): string {
  if (typeof role === "string") return role;
  return role?.name || "";
}

export interface LoginResponse {
  success: boolean;
  data?: {
    token: string;
    user: User;
  };
  error?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>("/auth/login", { email, password }),

  me: () => api.get<ApiResponse<User>>("/auth/me"),
};

// User API
export interface Role {
  id: string;
  name: string;
}

export interface Vendor {
  id: string;
  companyName: string;
}

export interface CreateUserInput {
  email: string;
  password?: string;
  name?: string;
  roleId: string;
  vendorId?: string;
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  name?: string;
  roleId?: string;
  vendorId?: string;
}

export const userApi = {
  list: () => api.get<ApiResponse<User[]>>("/users"),
  create: (data: CreateUserInput) => api.post<ApiResponse<User>>("/users", data),
  update: (id: string, data: UpdateUserInput) => api.put<ApiResponse<User>>(`/users/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/users/${id}`),
  getRoles: () => api.get<ApiResponse<Role[]>>("/users/roles"),
  getVendors: () => api.get<ApiResponse<Vendor[]>>("/users/vendors"),
};

// Catalog API
export interface ServiceCatalog {
  id: string;
  name: string;
}

export interface JobDescriptionCatalog {
  id: string;
  title: string;
  price: number | null;
}

export const catalogApi = {
  getServices: () => api.get<ApiResponse<ServiceCatalog[]>>("/catalogs/services"),
  createService: (data: { name: string }) =>
    api.post<ApiResponse<ServiceCatalog>>("/catalogs/services", data),
  updateService: (id: string, data: { name: string }) =>
    api.put<ApiResponse<ServiceCatalog>>(`/catalogs/services/${id}`, data),
  deleteService: (id: string) =>
    api.delete<ApiResponse<void>>(`/catalogs/services/${id}`),

  getJobDescriptions: () =>
    api.get<ApiResponse<JobDescriptionCatalog[]>>("/catalogs/job-descriptions"),
  createJobDescription: (data: { title: string; price?: number }) =>
    api.post<ApiResponse<JobDescriptionCatalog>>("/catalogs/job-descriptions", data),
  updateJobDescription: (id: string, data: { title: string; price?: number }) =>
    api.put<ApiResponse<JobDescriptionCatalog>>(`/catalogs/job-descriptions/${id}`, data),
  deleteJobDescription: (id: string) =>
    api.delete<ApiResponse<void>>(`/catalogs/job-descriptions/${id}`),
};

// Job API
export interface JobItem {
  id: string;
  description: string;
  amount: number;
}

export interface Job {
  id: string;
  jobNo?: string;
  description: string;
  refInvoiceNo?: string;
  containerNo?: string;
  truckPlate?: string;
  clearanceDate: string;
  declarationNo: string;
  statusJob: "PENDING" | "BILLED";
  items: JobItem[];
  amount?: number; // Added for frontend compatibility if needed
  totalAmount: number;
  billingNote?: {
    id: string;
    billingRef: string;
  } | null;
}

export interface CreateJobInput {
  description: string;
  refInvoiceNo: string;
  containerNo: string;
  truckPlate: string;
  clearanceDate: string;
  declarationNo: string;
  items: { description: string; amount: number }[];
}

export const jobApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<Job[]>>("/jobs", { params }),
  get: (id: string) => api.get<ApiResponse<Job>>(`/jobs/${id}`),
  create: (data: CreateJobInput) => api.post<ApiResponse<Job>>("/jobs", data),
  update: (id: string, data: CreateJobInput) =>
    api.put<ApiResponse<Job>>(`/jobs/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/jobs/${id}`),
};

// Billing API
export interface BillingNote {
  id: string;
  billingRef: string;
  billingDate: string;
  subtotal: number;
  vatAmount: number;
  whtAmount: number;
  netTotal: number;
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "PAID" | "CANCELLED";
  vendorId: string;
  vendor?: Vendor;
  jobs?: Job[];
  remark?: string;
  priceBeforeVat?: number;
  vatRateText?: string;
  whtRateText?: string;
  receipt?: Receipt | null;
}

export interface Receipt {
  id: string;
  receiptRef: string;
  billingNoteId: string;
  receiptDate: string;
  statusReceipt: "PENDING" | "PAID";
}

export interface BillingPreview {
  jobs: Job[];
  calculation: {
    subtotal: number;
    priceBeforeVat: number;
    vatAmount: number;
    whtAmount: number;
    netTotal: number;
    vatRate: number;
    whtRate: number;
  };
}

export const billingApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<BillingNote[]>>("/billing", { params }),
  get: (id: string) => api.get<ApiResponse<BillingNote>>(`/billing/${id}`),
  preview: (jobIds: string[], calculateBeforeVat?: boolean) =>
    api.post<ApiResponse<BillingPreview>>("/billing/preview", {
      jobIds,
      calculateBeforeVat,
    }),
  create: (jobIds: string[], billingRef?: string, calculateBeforeVat?: boolean, remark?: string) =>
    api.post<ApiResponse<BillingNote>>("/billing", { jobIds, billingRef, calculateBeforeVat, remark }),
  updateStatus: (id: string, status: BillingNote["status"]) =>
    api.patch<ApiResponse<BillingNote>>(`/billing/${id}/status`, { status }),
  cancel: (id: string) => api.post<ApiResponse<void>>(`/billing/${id}/cancel`),
  update: (id: string, jobIds: string[], remark?: string, calculateBeforeVat?: boolean) =>
    api.put<ApiResponse<BillingNote>>(`/billing/${id}`, { jobIds, remark, calculateBeforeVat }),
};

// Settings API
export interface VendorSettings {
  id: string;
  companyName: string;
  companyAddress: string;
  taxId: string;
  bankAccount: string;
  bankName: string;
  bankBranch: string;
}

export interface VatConfig {
  vatRate: number;
  whtRate: number;
  calculateBeforeVat: boolean;
}

export interface SettingsData {
  vendor: VendorSettings | null;
  vatConfig: VatConfig;
}

export const settingsApi = {
  get: () => api.get<ApiResponse<SettingsData>>("/settings"),
  createVendor: (data: Omit<VendorSettings, "id">) =>
    api.post<ApiResponse<VendorSettings>>("/settings/vendor", data),
  updateVendor: (data: Omit<VendorSettings, "id">) =>
    api.put<ApiResponse<VendorSettings>>("/settings/vendor", data),
  updateVatConfig: (data: VatConfig) =>
    api.put<ApiResponse<VatConfig>>("/settings/vat-config", data),
};

// PDF API
export const pdfApi = {
  generateBilling: (billingId: string) =>
    api.get<ApiResponse<{ filename: string; url: string }>>(`/pdf/billing/${billingId}`),
  generateReceipt: (receiptId: string) =>
    api.get<ApiResponse<{ filename: string; url: string }>>(`/pdf/receipt/${receiptId}`),
};

export interface ReceiptWithBilling extends Receipt {
  billingNote: {
    billingRef: string;
    netTotal: number;
    billingDate: string;
  };
}

export const receiptApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<ReceiptWithBilling[]> & { pagination: { page: number; limit: number; total: number; totalPages: number } }>("/receipts", { params }),
  get: (id: string) =>
    api.get<ApiResponse<Receipt>>(`/receipts/${id}`),
  create: (billingNoteId: string, receiptDate: string) =>
    api.post<ApiResponse<Receipt>>("/receipts", { billingNoteId, receiptDate }),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/receipts/${id}`),
};

// Company Settings API (Admin only)
export interface CompanySettings {
  id?: string;
  companyName: string;
  companyAddress: string;
  taxId: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
}

export const companySettingsApi = {
  get: () => api.get<ApiResponse<CompanySettings | null>>("/settings/company"),
  update: (data: Omit<CompanySettings, "id">) =>
    api.put<ApiResponse<CompanySettings>>("/settings/company", data),
};

// Document Number Config API
export interface DocumentNumberConfig {
  billingEnabled: boolean;
  billingPrefix: string;
  receiptEnabled: boolean;
  receiptPrefix: string;
  dateFormat: "YYYYMMDD" | "YYYYMM" | "YYMM";
  runningDigits: number;
  resetPeriod: "DAILY" | "MONTHLY" | "YEARLY" | "NEVER";
}

export const documentNumberApi = {
  getConfig: () => api.get<ApiResponse<DocumentNumberConfig>>("/document-number/config"),
  updateConfig: (data: DocumentNumberConfig) =>
    api.put<ApiResponse<DocumentNumberConfig>>("/document-number/config", data),
  getPreview: (type: "BILLING" | "RECEIPT") =>
    api.get<ApiResponse<{ preview: string; documentType: string }>>(`/document-number/preview?type=${type}`),
};

// Vendor API (Admin only)
export interface VendorSummary {
  id: string;
  companyName: string;
  taxId: string;
  pendingBillingCount: number;
  pendingReceiptCount: number;
}

export const vendorApi = {
  list: () => api.get<ApiResponse<VendorSummary[]>>("/vendors"),
  get: (id: string) => api.get<ApiResponse<Vendor>>(`/vendors/${id}`),
};

// Admin API helpers (for accessing vendor data as admin/user)
export const adminApi = {
  // List billing notes for a specific vendor
  listBilling: (vendorId: string, params?: { status?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<BillingNote[]>>("/billing", { params: { vendorId, ...params } }),

  // List receipts for a specific vendor
  listReceipts: (vendorId: string, params?: { status?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<ReceiptWithBilling[]> & { pagination: { page: number; limit: number; total: number; totalPages: number } }>("/receipts", { params: { vendorId, ...params } }),

  // Update receipt status (admin only)
  updateReceiptStatus: (receiptId: string, status: "PENDING" | "PAID", revertBilling?: boolean) =>
    api.patch<ApiResponse<Receipt>>(`/receipts/${receiptId}/status`, { status, revertBilling }),
};

// Payment Voucher API (Admin/User only)
export interface PaymentVoucher {
  id: string;
  voucherRef: string;
  vendorId: string;
  voucherDate: string;
  subtotal: number;
  totalVat: number;
  totalWht: number;
  netTotal: number;
  remark?: string;
  pdfUrl?: string;
  status: "PENDING" | "APPROVED" | "CANCELLED";
  createdById: string;
  createdBy?: {
    id: string;
    email: string;
    name: string | null;
  };
  vendor?: Vendor;
  billingNotes?: BillingNote[];
  createdAt: string;
  updatedAt: string;
}

export const paymentVoucherApi = {
  list: (params?: { vendorId?: string; status?: string }) =>
    api.get<ApiResponse<PaymentVoucher[]>>("/payment-voucher", { params }),

  get: (id: string) =>
    api.get<ApiResponse<PaymentVoucher>>(`/payment-voucher/${id}`),

  create: (data: { vendorId: string; billingNoteIds: string[]; voucherDate: string; remark?: string }) =>
    api.post<ApiResponse<PaymentVoucher>>("/payment-voucher", data),

  updateStatus: (id: string, status: "PENDING" | "APPROVED" | "CANCELLED") =>
    api.patch<ApiResponse<PaymentVoucher>>(`/payment-voucher/${id}/status`, { status }),

  cancel: (id: string) =>
    api.post<ApiResponse<void>>(`/payment-voucher/${id}/cancel`),

  // Get submitted billing notes for a vendor (for creating voucher)
  getSubmittedBillings: (vendorId: string) =>
    api.get<ApiResponse<BillingNote[]>>(`/payment-voucher/billing-notes/${vendorId}`),

  // Generate PDF
  generatePdf: (id: string) =>
    api.get<ApiResponse<{ filename: string; url: string }>>(`/pdf/payment-voucher/${id}`),
};
