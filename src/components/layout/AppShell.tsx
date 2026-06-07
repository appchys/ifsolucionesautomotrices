"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore, useUIStore } from "@/store";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  const { sidebarOpen } = useUIStore();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <Loader2 className="animate-spin" size={40} style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-primary)" }}>
      <Sidebar />

      {/* Main area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarOpen ? "sidebar-displaced" : "ml-0"
        }`}
      >
        <Header />
        <main
          className="flex-1 overflow-y-auto animate-fade-in"
          style={{
            marginTop: "var(--header-height)",
            minHeight: "calc(100vh - var(--header-height))",
            paddingTop: "var(--app-content-gutter-y)",
            paddingBottom: "var(--app-content-gutter-y-lg)",
            paddingLeft: "var(--app-content-gutter-x)",
            paddingRight: "var(--app-content-gutter-x)",
          }}
        >
          <div className="app-page-stack">{children}</div>
        </main>
      </div>
    </div>
  );
}
