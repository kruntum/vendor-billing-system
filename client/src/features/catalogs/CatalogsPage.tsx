import { useState } from "react";
import { ServiceCatalog } from "./ServiceCatalog";
import { JobDescriptionCatalog } from "./JobDescriptionCatalog";

export default function CatalogsPage() {
  const [activeTab, setActiveTab] = useState<"services" | "job-descriptions">("services");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">แค็ตตาล็อก</h1>
        <p className="text-sm text-gray-500">จัดการรายการสินค้าและบริการ</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("services")}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === "services"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            บริการ (Services)
          </button>
          <button
            onClick={() => setActiveTab("job-descriptions")}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === "job-descriptions"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            รายละเอียดงาน (Job Descriptions)
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="mt-6">
        {activeTab === "services" ? <ServiceCatalog /> : <JobDescriptionCatalog />}
      </div>
    </div>
  );
}
