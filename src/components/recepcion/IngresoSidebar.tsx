"use client";

import { useUIStore, useChatStore } from "@/store";
import VistaIngreso from "./VistaIngreso";

export default function IngresoSidebar() {
  const { isIngresoSidebarOpen, ingresoSidebarId, setIngresoSidebarOpen, sidebarOpen } = useUIStore();
  const { isInboxOpen, activeChatId } = useChatStore();

  let layoutClass = "full-width";
  if (isInboxOpen) {
    layoutClass = activeChatId ? "chat-active" : "inbox-only";
  }

  if (!isIngresoSidebarOpen || !ingresoSidebarId) return null;

  return (
    <div
      id="ingreso-sidebar-panel"
      className={`ingreso-sidebar-panel ${isIngresoSidebarOpen ? "open" : ""} ${
        sidebarOpen ? "sidebar-open-offset" : ""
      } ${layoutClass}`}
      onMouseDown={(e) => e.nativeEvent.stopImmediatePropagation()}
    >
      {/* Contenido del Sidebar */}
      <div className="flex-1 overflow-hidden">
        <VistaIngreso ingresoId={ingresoSidebarId} isSidebar />
      </div>
    </div>
  );
}


