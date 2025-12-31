import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobApi, Job, CreateJobInput } from "@/lib/api";
import { JobForm } from "./JobForm";
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { SearchToolbar } from "@/components/ui/search-toolbar";

// Icons
const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" x2="10" y1="11" y2="17" />
    <line x1="14" x2="14" y1="11" y2="17" />
  </svg>
);

export default function JobsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [initialFormValues, setInitialFormValues] = useState<Partial<CreateJobInput> | null>(null);

  // Filter & Pagination State
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState<"description" | "refInvoiceNo" | "containerNo">("description");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  const queryClient = useQueryClient();

  const { data: jobsResponse, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => jobApi.list().then((res) => res.data),
    refetchOnMount: "always",  // Always fetch fresh data when page loads
    staleTime: 0,              // Data is immediately considered stale
  });

  const deleteMutation = useMutation({
    mutationFn: jobApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this job?")) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleEdit = (job: Job) => {
    setEditingJob(job);
    setInitialFormValues(null);
    setIsFormOpen(true);
  };

  const handleCopy = (job: Job) => {
    setEditingJob(null);
    setInitialFormValues({
      description: job.description,
      items: job.items.map(item => ({ description: item.description, amount: item.amount })),
      clearanceDate: format(new Date(), "yyyy-MM-dd"),
      // Clear unique fields
      refInvoiceNo: "",
      containerNo: "",
      truckPlate: "",
      declarationNo: "",
    });
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingJob(null);
    setInitialFormValues(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingJob(null);
    setInitialFormValues(null);
  };

  const jobs = jobsResponse?.data || [];

  // Filter Logic
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // 1. Date Range Filter
      if (dateRange.start && dateRange.end) {
        const jobDate = parseISO(job.clearanceDate);
        const start = startOfDay(parseISO(dateRange.start));
        const end = endOfDay(parseISO(dateRange.end));

        if (!isWithinInterval(jobDate, { start, end })) {
          return false;
        }
      }

      // 2. Search Filter
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();

      if (searchType === "description") {
        return job.description?.toLowerCase().includes(term);
      }
      if (searchType === "refInvoiceNo") {
        return job.refInvoiceNo?.toLowerCase().includes(term);
      }
      if (searchType === "containerNo") {
        return job.containerNo?.toLowerCase().includes(term);
      }

      return true;
    })
  }, [jobs, searchTerm, searchType, dateRange]);


  // Pagination Logic
  const totalPages = Math.ceil(filteredJobs.length / pageSize);
  const paginatedJobs = filteredJobs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setDateRange({ start: "", end: "" });
    setSearchType("description");
    setCurrentPage(1);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Define columns
  const columns: DataTableColumn<Job>[] = [
    {
      header: "วันที่",
      cell: (job) => format(new Date(job.clearanceDate), "dd/MM/yyyy"),
    },
    {
      header: "รายละเอียด",
      cell: (job) => (
        <div>
          <div className="font-medium text-gray-900">{job.description}</div>
          <div className="text-xs text-gray-500">{job.items.length} รายการ</div>
        </div>
      ),
    },
    {
      header: "เลขที่อินวอย",
      cell: (job) => <span className="text-gray-500">{job.refInvoiceNo || "-"}</span>,
    },
    {
      header: "เบอร์ตู้คอนเทนเนอร์",
      cell: (job) => <span className="text-gray-500">{job.containerNo || "-"}</span>,
    },
    {
      header: "ยอดรวม",
      className: "text-right",
      cell: (job) => (
        <span className="font-medium text-gray-900">
          {job.totalAmount.toLocaleString()}
        </span>
      ),
    },
    {
      header: "สถานะ",
      className: "text-center",
      cell: (job) => (
        <span
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${job.statusJob === "BILLED"
            ? "bg-green-100 text-green-800"
            : "bg-yellow-100 text-yellow-800"
            }`}
        >
          {job.statusJob === "BILLED" ? "วางบิลแล้ว" : "รอดำเนินการ"}
        </span>
      ),
    },
    {
      header: "จัดการ",
      className: "text-center",
      cell: (job) => (
        <div className="flex items-center justify-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleCopy(job)}
                className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <CopyIcon />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>คัดลอก</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleEdit(job)}
                className="p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={job.statusJob === "BILLED"}
              >
                <EditIcon />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>แก้ไข</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleDelete(job.id)}
                className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={job.statusJob === "BILLED"}
              >
                <TrashIcon />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>ลบ</p>
            </TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">งาน (Jobs)</h1>
            <p className="text-sm text-gray-500">จัดการรายการงานทั้งหมด</p>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
          >
            สร้างงานใหม่
          </button>
        </div>

        <SearchToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchType={searchType}
          onSearchTypeChange={(value) => setSearchType(value as any)}
          searchTypeOptions={[
            { value: "description", label: "รายละเอียด" },
            { value: "refInvoiceNo", label: "เลขที่อินวอย" },
            { value: "containerNo", label: "เบอร์ตู้" },
          ]}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          onReset={resetFilters}
        />

        <DataTable
          data={paginatedJobs}
          columns={columns}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredJobs.length}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          rowKey={(job) => job.id}
          emptyMessage="ไม่พบข้อมูลงาน"
          maxHeight="calc(100vh - 350px)"
          showIndex={true}
        />

        {isFormOpen && (
          <JobForm
            job={editingJob}
            initialValues={initialFormValues}
            onClose={handleCloseForm}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["jobs"] });
              handleCloseForm();
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
