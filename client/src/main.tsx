import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import './fonts/fonts.css';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,              // Data is immediately considered stale
      refetchOnMount: "always",  // Always fetch fresh data when component mounts
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
