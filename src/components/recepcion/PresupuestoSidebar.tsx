"use client";

import { useUIStore, useChatStore } from "@/store";
import VistaPresupuesto from "./VistaPresupuesto";

export default function PresupuestoSidebar() {
  const { isPresupuestoSidebarOpen, presupuestoSidebarId, setPresupuestoSidebarOpen, sidebarOpen } = useUIStore();
  const { isInboxOpen, activeChatId } = useChatStore();

  let layoutClass = "full-width";
  if (isInboxOpen) {
    layoutClass = activeChatId ? "chat-active" : "inbox-only";
  }

  if (!isPresupuestoSidebarOpen || !presupuestoSidebarId) return null;

  return (
    <div
      id="presupuesto-sidebar-panel"
      className={`presupuesto-sidebar-panel ${isPresupuestoSidebarOpen ? "open" : ""} ${
        sidebarOpen ? "sidebar-open-offset" : ""
      } ${layoutClass}`}
      onMouseDown={(e) => e.nativeEvent.stopImmediatePropagation()}
    >
      {/* Contenido del Sidebar */}
      <div className="flex-1 overflow-hidden">
        <VistaPresupuesto presupuestoId={presupuestoSidebarId} isSidebar />
      </div>
    </div>
  );
}

