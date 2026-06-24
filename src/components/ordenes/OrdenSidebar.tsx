"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useUIStore } from "@/store";
import VistaOrdenDetalle from "./VistaOrdenDetalle";

export default function OrdenSidebar() {
  const { isOrdenSidebarOpen, ordenSidebarId, setOrdenSidebarOpen, sidebarOpen } = useUIStore();

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebarEl = document.getElementById("orden-sidebar-panel");
      const triggerEl = document.getElementById("btn-abrir-orden-sidebar");
      const detailsMenuEl = document.getElementById("active-chat-panel");

      if (
        sidebarEl &&
        !sidebarEl.contains(event.target as Node) &&
        (!triggerEl || !triggerEl.contains(event.target as Node)) &&
        (!detailsMenuEl || !detailsMenuEl.contains(event.target as Node))
      ) {
        setOrdenSidebarOpen(false);
      }
    };

    if (isOrdenSidebarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOrdenSidebarOpen, setOrdenSidebarOpen]);

  if (!isOrdenSidebarOpen || !ordenSidebarId) return null;

  return (
    <div
      id="orden-sidebar-panel"
      className={`orden-sidebar-panel ${isOrdenSidebarOpen ? "open" : ""} ${
        sidebarOpen ? "sidebar-open-offset" : ""
      }`}
    >
      {/* Cabecera del Sidebar */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg-primary)] select-none shrink-0">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)]">
          Detalle de Orden de Trabajo
        </h3>
        <button
          onClick={() => setOrdenSidebarOpen(false)}
          className="btn-ghost btn-icon hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-550 hover:text-slate-850 dark:hover:text-slate-200 rounded-lg p-1.5 cursor-pointer border-0 bg-transparent"
          title="Cerrar panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Contenido del Sidebar */}
      <div className="flex-1 overflow-hidden">
        <VistaOrdenDetalle ordenId={ordenSidebarId} isSidebar />
      </div>
    </div>
  );
}
