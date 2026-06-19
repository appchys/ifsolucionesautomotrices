"use client";

import AppShell from "@/components/layout/AppShell";
import TableroKanban from "@/components/ordenes/TableroKanban";
import { Plus } from "lucide-react";
import { useState } from "react";
import NuevaOrdenSidebar from "@/components/recepcion/NuevaOrdenSidebar";

export default function TableroPage() {
  const [showNuevaOrden, setShowNuevaOrden] = useState(false);

  return (
    <AppShell>
      {/* Cabecera común de Órdenes */}
      <div className="page-header flex items-center justify-between flex-wrap gap-3 mb-2 shrink-0">
        <div>
          <h1 className="page-title">Órdenes de Trabajo</h1>
          <p className="page-subtitle">Visualización y gestión del flujo de trabajo</p>
        </div>
        <button 
          onClick={() => setShowNuevaOrden(true)} 
          className="btn-primary flex items-center gap-1.5"
        >
          <Plus size={16} /> Nueva Orden
        </button>
      </div>

      {/* Componente del Tablero */}
      <div className="flex flex-col overflow-hidden" style={{ height: "calc(100vh - 11rem)" }}>
        <TableroKanban />
      </div>

      {/* Sidebar de Nueva Orden */}
      {showNuevaOrden && (
        <NuevaOrdenSidebar 
          onClose={() => setShowNuevaOrden(false)} 
          onSuccess={() => {
            setShowNuevaOrden(false);
            // La recarga es reactiva por la suscripción al tablero
          }}
        />
      )}
    </AppShell>
  );
}
