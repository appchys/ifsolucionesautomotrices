"use client";

import AppShell from "@/components/layout/AppShell";
import TableroKanban from "@/components/ordenes/TableroKanban";
import Link from "next/link";
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

      {/* Selector de pestañas (Tabs) */}
      <div className="flex gap-2 border-b border-[var(--border)] mb-5 shrink-0">
        <Link 
          href="/ordenes" 
          className="py-2 px-4 text-sm font-semibold transition-all border-b-2 border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Lista
        </Link>
        <Link 
          href="/ordenes/tablero" 
          className="py-2 px-4 text-sm font-extrabold transition-all border-b-2 border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400"
        >
          Tablero
        </Link>
      </div>

      {/* Componente del Tablero */}
      <div className="flex flex-col overflow-hidden" style={{ height: "calc(100vh - 13.5rem)" }}>
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
