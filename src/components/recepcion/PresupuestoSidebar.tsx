"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useUIStore } from "@/store";
import VistaPresupuesto from "./VistaPresupuesto";

export default function PresupuestoSidebar() {
  const { isPresupuestoSidebarOpen, presupuestoSidebarId, setPresupuestoSidebarOpen, sidebarOpen } = useUIStore();

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebarEl = document.getElementById("presupuesto-sidebar-panel");
      const triggerEl = document.getElementById("btn-abrir-presupuesto-sidebar");
      const detailsMenuEl = document.getElementById("active-chat-panel");

      if (
        sidebarEl &&
        !sidebarEl.contains(event.target as Node) &&
        (!triggerEl || !triggerEl.contains(event.target as Node)) &&
        (!detailsMenuEl || !detailsMenuEl.contains(event.target as Node))
      ) {
        setPresupuestoSidebarOpen(false);
      }
    };

    if (isPresupuestoSidebarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPresupuestoSidebarOpen, setPresupuestoSidebarOpen]);

  if (!isPresupuestoSidebarOpen || !presupuestoSidebarId) return null;

  return (
    <div
      id="presupuesto-sidebar-panel"
      className={`presupuesto-sidebar-panel ${isPresupuestoSidebarOpen ? "open" : ""} ${
        sidebarOpen ? "sidebar-open-offset" : ""
      }`}
    >
      {/* Cabecera del Sidebar */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg-primary)] select-none shrink-0">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)]">
          Detalle del Presupuesto
        </h3>
        <button
          onClick={() => setPresupuestoSidebarOpen(false)}
          className="btn-ghost btn-icon hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-550 hover:text-slate-850 dark:hover:text-slate-200 rounded-lg p-1.5 cursor-pointer border-0 bg-transparent"
          title="Cerrar panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Contenido del Sidebar */}
      <div className="flex-1 overflow-hidden">
        <VistaPresupuesto presupuestoId={presupuestoSidebarId} isSidebar />
      </div>
    </div>
  );
}
