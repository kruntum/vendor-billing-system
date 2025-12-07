import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi, User, getRoleName } from "@/lib/api";
import { UserForm } from "@/features/users/UserForm";
import { useAuthStore } from "@/store/authStore";

export default function UsersPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  const { user: currentUser } = useAuthStore();
  const currentRole = currentUser ? getRoleName(currentUser.role) : "";
  const isAdmin = currentRole === "ADMIN";
  const isVendor = currentRole === "VENDOR";
  const hasVendor = !!currentUser?.vendor?.id; // Check if current user has a vendor

  const { data: usersResponse, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => userApi.list().then((res) => res.data),
  });

  const deleteMutation = useMutation({
    mutationFn: userApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const handleDelete = async (targetUser: User) => {
    // Admin users cannot be deleted
    if (getRoleName(targetUser.role) === "ADMIN") {
      alert("ไม่สามารถลบผู้ใช้ที่เป็น Admin ได้");
      return;
    }

    // Only admin can delete users
    if (!isAdmin) {
      alert("คุณไม่มีสิทธิ์ลบผู้ใช้");
      return;
    }

    if (window.confirm("คุณต้องการลบผู้ใช้นี้หรือไม่?")) {
      await deleteMutation.mutateAsync(targetUser.id);
    }
  };

  const handleEdit = (user: User) => {
    // Admin can only be edited by other admins
    if (getRoleName(user.role) === "ADMIN" && !isAdmin) {
      alert("เฉพาะ Admin เท่านั้นที่สามารถแก้ไข Admin ได้");
      return;
    }

    setEditingUser(user);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    // Vendor users can only add users if they have a company
    if (isVendor && !hasVendor) {
      alert("กรุณาตั้งค่าข้อมูลบริษัทก่อนเพิ่มผู้ใช้งาน");
      return;
    }

    setEditingUser(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingUser(null);
  };

  // Check if current user can edit the target user
  const canEdit = (targetUser: User) => {
    if (isAdmin) return true;
    // Vendor can only edit users in their own vendor
    if (isVendor && targetUser.vendor?.id === currentUser?.vendor?.id) return true;
    return false;
  };

  // Check if current user can delete the target user
  const canDelete = (targetUser: User) => {
    // Admin users cannot be deleted
    if (getRoleName(targetUser.role) === "ADMIN") return false;
    // Only admin can delete
    return isAdmin;
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const users = usersResponse?.data || [];

  // Filter users based on role
  // Vendor users only see users in their own vendor
  const filteredUsers = isAdmin
    ? users
    : users.filter(u => u.vendor?.id === currentUser?.vendor?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ผู้ใช้งาน (Users)</h1>
          <p className="text-sm text-gray-500">จัดการผู้ใช้งานในระบบ</p>
        </div>
        {(isAdmin || (isVendor && hasVendor)) && (
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            เพิ่มผู้ใช้งาน
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ชื่อ
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                อีเมล
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                บทบาท
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                บริษัท
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {user.name || "-"}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{user.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleName(user.role) === "ADMIN"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-blue-100 text-blue-800"
                    }`}>
                    {getRoleName(user.role) || "-"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {user.vendor?.companyName || "-"}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {canEdit(user) && (
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      แก้ไข
                    </button>
                  )}
                  {canDelete(user) && (
                    <button
                      onClick={() => handleDelete(user)}
                      className="text-red-600 hover:text-red-900"
                    >
                      ลบ
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <UserForm
          user={editingUser}
          onClose={handleCloseForm}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            handleCloseForm();
          }}
        />
      )}
    </div>
  );
}
