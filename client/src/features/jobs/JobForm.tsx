import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { jobApi, catalogApi, CreateJobInput, Job } from "@/lib/api";
import { format } from "date-fns";
import { Autocomplete } from "@/components/ui/Autocomplete";

interface JobFormProps {
  job?: Job | null;
  initialValues?: Partial<CreateJobInput> | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function JobForm({ job, initialValues, onClose, onSuccess }: JobFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateJobInput>({
    defaultValues: {
      description: "",
      refInvoiceNo: "",
      containerNo: "",
      truckPlate: "",
      clearanceDate: format(new Date(), "yyyy-MM-dd"),
      declarationNo: "",
      items: [{ description: "", amount: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  // Fetch catalogs for autocomplete
  const { data: servicesResponse } = useQuery({
    queryKey: ["services"],
    queryFn: () => catalogApi.getServices().then((res) => res.data),
  });

  const { data: jobDescriptionsResponse } = useQuery({
    queryKey: ["job-descriptions"],
    queryFn: () => catalogApi.getJobDescriptions().then((res) => res.data),
  });

  const services = servicesResponse?.data || [];
  const jobDescriptions = jobDescriptionsResponse?.data || [];

  useEffect(() => {
    if (job) {
      setValue("description", job.description);
      setValue("refInvoiceNo", job.refInvoiceNo);
      setValue("containerNo", job.containerNo);
      setValue("truckPlate", job.truckPlate);
      setValue("clearanceDate", format(new Date(job.clearanceDate), "yyyy-MM-dd"));
      setValue("declarationNo", job.declarationNo);
      setValue("items", job.items.map(i => ({ description: i.description, amount: i.amount })));
    } else if (initialValues) {
      if (initialValues.description) setValue("description", initialValues.description);
      if (initialValues.refInvoiceNo) setValue("refInvoiceNo", initialValues.refInvoiceNo);
      if (initialValues.containerNo) setValue("containerNo", initialValues.containerNo);
      if (initialValues.truckPlate) setValue("truckPlate", initialValues.truckPlate);
      if (initialValues.clearanceDate) setValue("clearanceDate", initialValues.clearanceDate);
      if (initialValues.declarationNo) setValue("declarationNo", initialValues.declarationNo);
      if (initialValues.items) setValue("items", initialValues.items);
    }
  }, [job, initialValues, setValue]);

  const createMutation = useMutation({
    mutationFn: jobApi.create,
    onSuccess,
  });

  const updateMutation = useMutation({
    mutationFn: (data: CreateJobInput) => jobApi.update(job!.id, data),
    onSuccess,
  });

  const onSubmit = (data: CreateJobInput) => {
    // Ensure amounts are numbers
    const payload = {
      ...data,
      items: data.items.map((item) => ({
        ...item,
        amount: Number(item.amount),
      })),
    };

    if (job) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // Autocomplete helpers
  const handleItemSelect = (index: number, value: string) => {
    // When items use jobDescriptions, there is no price to auto-fill
    setValue(`items.${index}.description`, value);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/50 backdrop-blur-sm p-4 md:p-0">
      <div className="relative w-full max-w-4xl rounded-lg bg-white shadow-lg ring-1 ring-gray-900/5 my-8">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-6">
            {job ? "แก้ไขงาน" : "สร้างงานใหม่"}
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Header Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รายละเอียดงาน (Job Description)
                </label>
                <Controller
                  control={control}
                  name="description"
                  rules={{ required: "กรุณาระบุรายละเอียดงาน" }}
                  render={({ field }) => (
                    <Autocomplete
                      options={services.map((s) => ({
                        label: s.name,
                        value: s.id,
                        subLabel: s.price ? s.price.toLocaleString() : undefined,
                      }))}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="เช่น ขนส่งสินค้า..."
                      error={errors.description?.message}
                    />
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  วันที่ตรวจปล่อย (Clearance Date)
                </label>
                <input
                  type="date"
                  {...register("clearanceDate", { required: "กรุณาระบุวันที่" })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ref Invoice No.
                </label>
                <input
                  {...register("refInvoiceNo", { required: "กรุณาระบุ Ref Invoice No." })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Container No.
                </label>
                <input
                  {...register("containerNo", { required: "กรุณาระบุ Container No." })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ทะเบียนรถ (Truck Plate)
                </label>
                <input
                  {...register("truckPlate", { required: "กรุณาระบุทะเบียนรถ" })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Declaration No.
                </label>
                <input
                  {...register("declarationNo", { required: "กรุณาระบุ Declaration No." })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
                />
              </div>
            </div>

            {/* Job Items */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">รายการค่าใช้จ่าย</h3>
                <button
                  type="button"
                  onClick={() => append({ description: "", amount: 0 })}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                >
                  + เพิ่มรายการ
                </button>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-4 items-start">
                    <div className="flex-1">
                      <Controller
                        control={control}
                        name={`items.${index}.description`}
                        rules={{ required: "ระบุรายการ" }}
                        render={({ field: { onChange, value } }) => (
                          <Autocomplete
                            options={jobDescriptions.map((d) => ({
                              label: d.title,
                              value: d.id,
                            }))}
                            value={value}
                            onChange={(val) => {
                              onChange(val);
                              handleItemSelect(index, val);
                            }}
                            placeholder="รายการค่าใช้จ่าย"
                            error={errors.items?.[index]?.description?.message}
                          />
                        )}
                      />
                    </div>
                    <div className="w-40">
                      <input
                        type="number"
                        step="0.01"
                        {...register(`items.${index}.amount` as const, {
                          required: "ระบุจำนวนเงิน",
                          min: 0,
                        })}
                        placeholder="จำนวนเงิน"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2 text-right"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-2 text-red-600 hover:text-red-800"
                      disabled={fields.length === 1}
                    >
                      ลบ
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {isLoading ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
