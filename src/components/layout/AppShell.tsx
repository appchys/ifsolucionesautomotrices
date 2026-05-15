"use client";
import { useAuthStore, useUIStore } from "@/store";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarOpen } = useUIStore();

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
