"use client";

import { useEffect } from "react";
import { useUIStore, useChatStore } from "@/store";
import VistaOrdenDetalle from "./VistaOrdenDetalle";

export default function OrdenSidebar() {
  const { isOrdenSidebarOpen, ordenSidebarId, setOrdenSidebarOpen, sidebarOpen } = useUIStore();
  const { isInboxOpen, activeChatId } = useChatStore();
  const chatVisible = isInboxOpen && !!activeChatId;

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebarEl = document.getElementById("orden-sidebar-panel");
      const triggerEl = document.getElementById("btn-abrir-orden-sidebar");
      const detailsMenuEl = document.getElementById("active-chat-panel");
      const ingresoSidebarEl = document.getElementById("ingreso-sidebar-panel");
      const presupuestoSidebarEl = document.getElementById("presupuesto-sidebar-panel");

      if (
        sidebarEl &&
        !sidebarEl.contains(event.target as Node) &&
        (!triggerEl || !triggerEl.contains(event.target as Node)) &&
        (!detailsMenuEl || !detailsMenuEl.contains(event.target as Node)) &&
        (!ingresoSidebarEl || !ingresoSidebarEl.contains(event.target as Node)) &&
        (!presupuestoSidebarEl || !presupuestoSidebarEl.contains(event.target as Node))
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
      } ${!chatVisible ? "full-width-sidebar" : ""}`}
      onMouseDown={(e) => e.nativeEvent.stopImmediatePropagation()}
    >
      {/* Contenido del Sidebar */}
      <div className="flex-1 overflow-hidden">
        <VistaOrdenDetalle ordenId={ordenSidebarId} isSidebar />
      </div>
    </div>
  );
}

