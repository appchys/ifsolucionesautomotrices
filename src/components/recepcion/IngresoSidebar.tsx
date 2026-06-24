"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useUIStore } from "@/store";
import VistaIngreso from "./VistaIngreso";

export default function IngresoSidebar() {
  const { isIngresoSidebarOpen, ingresoSidebarId, setIngresoSidebarOpen, sidebarOpen } = useUIStore();

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebarEl = document.getElementById("ingreso-sidebar-panel");
      // Evitar que el clic en otros botones de la interfaz que abren el sidebar lo cierre inmediatamente
      const triggerEl = document.getElementById("btn-abrir-ingreso-sidebar");
      const detailsMenuEl = document.getElementById("active-chat-panel");

      if (
        sidebarEl &&
        !sidebarEl.contains(event.target as Node) &&
        (!triggerEl || !triggerEl.contains(event.target as Node)) &&
        // Permitir interactuar con el menú de detalles del chat sin que se cierre este sidebar
        (!detailsMenuEl || !detailsMenuEl.contains(event.target as Node))
      ) {
        setIngresoSidebarOpen(false);
      }
    };

    if (isIngresoSidebarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isIngresoSidebarOpen, setIngresoSidebarOpen]);

  if (!isIngresoSidebarOpen || !ingresoSidebarId) return null;

  return (
    <div
      id="ingreso-sidebar-panel"
      className={`ingreso-sidebar-panel ${isIngresoSidebarOpen ? "open" : ""} ${
        sidebarOpen ? "sidebar-open-offset" : ""
      }`}
    >
      {/* Cabecera del Sidebar */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg-primary)] select-none shrink-0">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)]">
          Detalle del Ingreso
        </h3>
        <button
          onClick={() => setIngresoSidebarOpen(false)}
          className="btn-ghost btn-icon hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-550 hover:text-slate-850 dark:hover:text-slate-200 rounded-lg p-1.5 cursor-pointer border-0 bg-transparent"
          title="Cerrar panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Contenido del Sidebar */}
      <div className="flex-1 overflow-hidden">
        <VistaIngreso ingresoId={ingresoSidebarId} isSidebar />
      </div>
    </div>
  );
}
