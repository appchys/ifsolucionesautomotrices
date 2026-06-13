"use client";
import React, { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import ModalNuevoIngreso from "@/components/recepcion/ModalNuevoIngreso";
import { Plus, Search } from "lucide-react";

export default function PresupuestosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold">Presupuestos</h1>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary shadow-sm hover:shadow flex items-center gap-2"
          >
            <Plus size={20} /> Nuevo Presupuesto
          </button>
        </div>

        {/* Filters and Search (Placeholder) */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input 
              type="text" 
              placeholder="Buscar presupuesto..." 
              className="input pl-10 w-full bg-white shadow-sm"
            />
          </div>
          <button className="btn bg-white shadow-sm border border-[var(--border)] font-semibold">Todos</button>
          <button className="btn bg-white shadow-sm border border-transparent hover:border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]">Pendientes</button>
          <button className="btn bg-white shadow-sm border border-transparent hover:border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]">Aprobados</button>
        </div>

        {/* Placeholder Table */}
        <div className="card flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] p-8">
          <p className="mb-2">La tabla de presupuestos se listará aquí.</p>
          <p className="text-sm">Por ahora, puedes crear uno nuevo haciendo clic en el botón de arriba.</p>
        </div>

        {isModalOpen && (
          <ModalNuevoIngreso 
            onClose={() => setIsModalOpen(false)} 
            tipoMode="presupuesto" 
          />
        )}
      </div>
    </AppShell>
  );
}
