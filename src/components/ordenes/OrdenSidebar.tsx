"use client";

import { useUIStore, useChatStore } from "@/store";
import VistaOrdenDetalle from "./VistaOrdenDetalle";

export default function OrdenSidebar() {
  const { isOrdenSidebarOpen, ordenSidebarId, setOrdenSidebarOpen, sidebarOpen } = useUIStore();
  const { isInboxOpen, activeChatId } = useChatStore();

  let layoutClass = "full-width";
  if (isInboxOpen) {
    layoutClass = activeChatId ? "chat-active" : "inbox-only";
  }

  if (!isOrdenSidebarOpen || !ordenSidebarId) return null;

  return (
    <div
      id="orden-sidebar-panel"
      className={`orden-sidebar-panel ${isOrdenSidebarOpen ? "open" : ""} ${
        sidebarOpen ? "sidebar-open-offset" : ""
      } ${layoutClass}`}
      onMouseDown={(e) => e.nativeEvent.stopImmediatePropagation()}
    >
      {/* Contenido del Sidebar */}
      <div className="flex-1 overflow-hidden">
        <VistaOrdenDetalle ordenId={ordenSidebarId} isSidebar />
      </div>
    </div>
  );
}

