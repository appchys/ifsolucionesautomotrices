"use client";

import { useEffect } from "react";
import { useUIStore, useChatStore } from "@/store";
import VistaIngreso from "./VistaIngreso";

export default function IngresoSidebar() {
  const { isIngresoSidebarOpen, ingresoSidebarId, setIngresoSidebarOpen, sidebarOpen } = useUIStore();
  const { isInboxOpen, activeChatId } = useChatStore();
  const chatVisible = isInboxOpen && !!activeChatId;

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebarEl = document.getElementById("ingreso-sidebar-panel");
      // Evitar que el clic en otros botones de la interfaz que abren el sidebar lo cierre inmediatamente
      const triggerEl = document.getElementById("btn-abrir-ingreso-sidebar");
      const detailsMenuEl = document.getElementById("active-chat-panel");
      const ordenSidebarEl = document.getElementById("orden-sidebar-panel");
      const presupuestoSidebarEl = document.getElementById("presupuesto-sidebar-panel");

      if (
        sidebarEl &&
        !sidebarEl.contains(event.target as Node) &&
        (!triggerEl || !triggerEl.contains(event.target as Node)) &&
        // Permitir interactuar con el menú de detalles del chat sin que se cierre este sidebar
        (!detailsMenuEl || !detailsMenuEl.contains(event.target as Node)) &&
        // No cerrar si el clic ocurre dentro de los otros sidebars
        (!ordenSidebarEl || !ordenSidebarEl.contains(event.target as Node)) &&
        (!presupuestoSidebarEl || !presupuestoSidebarEl.contains(event.target as Node))
      ) {
        if (typeof (window as any).__handleRequestCloseIngreso === "function") {
          void (window as any).__handleRequestCloseIngreso();
        } else {
          setIngresoSidebarOpen(false);
        }
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
      } ${!chatVisible ? "full-width-sidebar" : ""}`}
      onMouseDown={(e) => e.nativeEvent.stopImmediatePropagation()}
    >
      {/* Contenido del Sidebar */}
      <div className="flex-1 overflow-hidden">
        <VistaIngreso ingresoId={ingresoSidebarId} isSidebar />
      </div>
    </div>
  );
}


