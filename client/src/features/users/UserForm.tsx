import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { userApi, User, CreateUserInput, UpdateUserInput, getRoleName } from "@/lib/api";
import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

interface UserFormProps {
  user?: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

// Helper to get role id
function getRoleId(role: User["role"]): string {
  if (typeof role === "string") return "";
  return role?.id || "";
}

export function UserForm({ user, onClose, onSuccess }: UserFormProps) {
  const { user: currentUser } = useAuthStore();
  const currentRole = currentUser ? getRoleName(currentUser.role) : "";
  const isAdmin = currentRole === "ADMIN";
  const isVendor = currentRole === "VENDOR";
  const currentVendorId = currentUser?.vendor?.id;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateUserInput>();

  // Fetch roles and vendors for dropdowns
  const { data: rolesResponse } = useQuery({
    queryKey: ["roles"],
    queryFn: () => userApi.getRoles().then((res) => res.data),
  });

  const { data: vendorsResponse } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => userApi.getVendors().then((res) => res.data),
    enabled: isAdmin, // Only fetch vendors if admin
  });

  const roles = rolesResponse?.data || [];
  const vendors = vendorsResponse?.data || [];

  // Filter roles for vendor users - they can only create VENDOR role users
  const availableRoles = isAdmin
    ? roles
    : roles.filter(r => r.name === "VENDOR");

  useEffect(() => {
    if (user) {
      reset({
        email: user.email,
        name: user.name || "",
        roleId: getRoleId(user.role),
        vendorId: user.vendor?.id || "",
      });
    } else if (isVendor && currentVendorId) {
      // Pre-set vendor for vendor users creating new employees
      setValue("vendorId", currentVendorId);
      // Pre-set role to VENDOR
      const vendorRole = roles.find(r => r.name === "VENDOR");
      if (vendorRole) {
        setValue("roleId", vendorRole.id);
      }
    }
  }, [user, reset, isVendor, currentVendorId, setValue, roles]);

  const createMutation = useMutation({
    mutationFn: userApi.create,
    onSuccess,
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateUserInput) => userApi.update(user!.id, data),
    onSuccess,
  });

  const onSubmit = (data: CreateUserInput) => {
    // If editing and password is empty, remove it
    if (user && !data.password) {
      delete data.password;
    }

    // If vendorId is empty string, set to undefined
    if (!data.vendorId) {
      delete data.vendorId;
    }

    // Force vendor ID for non-admin users
    if (isVendor && currentVendorId) {
      data.vendorId = currentVendorId;
    }

    if (user) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {user ? "แก้ไขผู้ใช้งาน" : "เพิ่มผู้ใช้งาน"}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">ชื่อ</label>
            <input
              {...register("name")}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">อีเมล</label>
            <input
              {...register("email", { required: "กรุณาระบุอีเมล" })}
              type="email"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              รหัสผ่าน {user && "(เว้นว่างไว้หากไม่ต้องการเปลี่ยน)"}
            </label>
            <input
              {...register("password", {
                required: !user ? "กรุณาระบุรหัสผ่าน" : false,
                minLength: { value: 6, message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" },
              })}
              type="password"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Role Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700">บทบาท (Role)</label>
            <select
              {...register("roleId", { required: "กรุณาเลือกบทบาท" })}
              disabled={isVendor} // Vendor users cannot change role
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2 disabled:bg-gray-100"
            >
              <option value="">-- เลือกบทบาท --</option>
              {availableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {isVendor && (
              <p className="text-xs text-gray-500 mt-1">ผู้ใช้ใหม่จะได้รับบทบาท VENDOR โดยอัตโนมัติ</p>
            )}
            {errors.roleId && (
              <p className="text-red-500 text-xs mt-1">{errors.roleId.message}</p>
            )}
          </div>

          {/* Vendor Dropdown - Only show for Admin */}
          {isAdmin ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">บริษัท (Vendor) - Optional</label>
              <select
                {...register("vendorId")}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
              >
                <option value="">-- ไม่ระบุ --</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.companyName}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700">บริษัท (Vendor)</label>
              <input
                type="text"
                value={currentUser?.vendor?.companyName || "-"}
                disabled
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm sm:text-sm border p-2"
              />
              <p className="text-xs text-gray-500 mt-1">ผู้ใช้ใหม่จะถูกเพิ่มเข้าบริษัทของคุณโดยอัตโนมัติ</p>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
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
  );
}
