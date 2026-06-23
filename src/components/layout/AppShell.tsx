"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore, useUIStore } from "@/store";
import Sidebar from "./Sidebar";
import Header from "./Header";
import ChatInbox from "./ChatInbox";
import ActiveChatPanel from "./ActiveChatPanel";

export default function AppShell({ 
  children, 
  hideHeader = false,
  noPadding = false
}: { 
  children: React.ReactNode;
  hideHeader?: boolean;
  noPadding?: boolean;
}) {
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
      <ChatInbox />
      <ActiveChatPanel />

      {/* Main area */}

      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarOpen ? "sidebar-displaced" : "sidebar-displaced-collapsed"
        }`}
      >
        {!hideHeader && <Header />}
        <main
          className="flex-1 overflow-y-auto animate-fade-in"
          style={{
            marginTop: hideHeader ? "0px" : "var(--header-height)",
            minHeight: hideHeader ? "100vh" : "calc(100vh - var(--header-height))",
            paddingTop: noPadding ? "0px" : (hideHeader ? "1rem" : "var(--app-content-gutter-y)"),
            paddingBottom: noPadding ? "0px" : (hideHeader ? "1rem" : "var(--app-content-gutter-y-lg)"),
            paddingLeft: noPadding ? "0px" : (hideHeader ? "1.5rem" : "var(--app-content-gutter-x)"),
            paddingRight: noPadding ? "0px" : (hideHeader ? "1.5rem" : "var(--app-content-gutter-x)"),
          }}
        >
          <div className="app-page-stack">{children}</div>
        </main>
      </div>
    </div>
  );
}

