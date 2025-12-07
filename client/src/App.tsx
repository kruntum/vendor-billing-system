import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import LoginPage from "@/features/auth/LoginPage";

export default function App() {
  const { user, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <RouterProvider router={router} context={{ auth: { user } }} />;
}
