"use client";

import AppShell from "@/components/layout/AppShell";
import TableroKanban from "@/components/ordenes/TableroKanban";
import { useState } from "react";
import ModalNuevoIngreso from "@/components/recepcion/ModalNuevoIngreso";
import BotonNuevoPopover from "@/components/ordenes/BotonNuevoPopover";

export default function TableroPage() {
  const [tipoNuevo, setTipoNuevo] = useState<"ingreso" | "presupuesto" | "orden" | null>(null);

  return (
    <AppShell>
      {/* Cabecera común de Órdenes */}
      <div className="page-header flex items-center justify-between flex-wrap gap-3 mb-2 shrink-0">
        <div>
          <h1 className="page-title">Órdenes de Trabajo</h1>
          <p className="page-subtitle">Visualización y gestión del flujo de trabajo</p>
        </div>
        <BotonNuevoPopover onSelect={(tipo) => setTipoNuevo(tipo)} />
      </div>

      {/* Componente del Tablero */}
      <div className="flex flex-col overflow-hidden" style={{ height: "calc(100vh - 11rem)" }}>
        <TableroKanban />
      </div>

      {/* Sidebar de Nueva Orden */}
      {tipoNuevo && (
        <ModalNuevoIngreso
          onClose={() => setTipoNuevo(null)}
          tipoMode={tipoNuevo}
        />
      )}
    </AppShell>
  );
}
