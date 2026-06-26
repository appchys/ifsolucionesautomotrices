"use client";

import { useEffect } from "react";
import { useUIStore, useChatStore } from "@/store";
import VistaPresupuesto from "./VistaPresupuesto";

export default function PresupuestoSidebar() {
  const { isPresupuestoSidebarOpen, presupuestoSidebarId, setPresupuestoSidebarOpen, sidebarOpen } = useUIStore();
  const { isInboxOpen, activeChatId } = useChatStore();
  const chatVisible = isInboxOpen && !!activeChatId;

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebarEl = document.getElementById("presupuesto-sidebar-panel");
      const triggerEl = document.getElementById("btn-abrir-presupuesto-sidebar");
      const detailsMenuEl = document.getElementById("active-chat-panel");
      const ingresoSidebarEl = document.getElementById("ingreso-sidebar-panel");
      const ordenSidebarEl = document.getElementById("orden-sidebar-panel");

      if (
        sidebarEl &&
        !sidebarEl.contains(event.target as Node) &&
        (!triggerEl || !triggerEl.contains(event.target as Node)) &&
        (!detailsMenuEl || !detailsMenuEl.contains(event.target as Node)) &&
        (!ingresoSidebarEl || !ingresoSidebarEl.contains(event.target as Node)) &&
        (!ordenSidebarEl || !ordenSidebarEl.contains(event.target as Node))
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
      } ${!chatVisible ? "full-width-sidebar" : ""}`}
      onMouseDown={(e) => e.nativeEvent.stopImmediatePropagation()}
    >
      {/* Contenido del Sidebar */}
      <div className="flex-1 overflow-hidden">
        <VistaPresupuesto presupuestoId={presupuestoSidebarId} isSidebar />
      </div>
    </div>
  );
}

