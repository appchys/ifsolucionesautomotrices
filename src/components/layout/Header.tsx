"use client";
import { Menu, Bell, Search } from "lucide-react";
import { useUIStore, useAuthStore } from "@/store";

export default function Header() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { user } = useAuthStore();

  return (
    <header
      className={`fixed top-0 right-0 z-20 flex items-center justify-between gap-4 transition-all duration-300 ${
        sidebarOpen ? "header-displaced" : "left-0"
      }`}
      style={{
        height: "var(--header-height)",
        background: "rgba(248,250,252,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        paddingLeft: "var(--app-content-gutter-x)",
        paddingRight: "var(--app-content-gutter-x)",
      }}
    >
      <button
        onClick={toggleSidebar}
        className="btn-ghost btn-icon"
        aria-label={sidebarOpen ? "Ocultar menú" : "Mostrar menú"}
        aria-expanded={sidebarOpen}
        aria-controls="app-sidebar"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 max-w-md hidden sm:block">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Buscar orden, cliente, placa..."
            className="input pl-9 text-sm"
            style={{ background: "var(--bg-card)" }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-ghost btn-icon relative">
          <Bell size={18} />
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full"
            style={{ background: "var(--accent)" }}
          />
        </button>

        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {user?.displayName?.charAt(0).toUpperCase() ?? "U"}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium leading-none" style={{ color: "var(--text-primary)" }}>
              {user?.displayName ?? "Usuario"}
            </p>
            <p className="text-xs capitalize mt-0.5" style={{ color: "var(--text-muted)" }}>
              {user?.role}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
