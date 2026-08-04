"use client";

import { useRef, useState } from "react";
import { X, Calendar, Clock, User, Car, Wrench, Trash2, CheckCircle2, AlertCircle, FileText, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { updateCita, deleteCita } from "@/lib/services";
import { useUIStore } from "@/store";
import { Cita, OrdenTrabajo } from "@/types";

export type EventoTipo = "cita" | "entrega_orden";

export interface EventoAgenda {
  id: string;
  tipo: EventoTipo;
  titulo: string;
  fecha: string; // YYYY-MM-DD
  horaInicio?: string;
  horaFin?: string;
  clienteNombre?: string;
  vehiculoPlaca?: string;
  estado: string;
  descripcion?: string;
  asignadoANombre?: string;
  presupuestoId?: string;
  ordenId?: string;
  citaRaw?: Cita;
  ordenRaw?: OrdenTrabajo;
}

interface ModalDetalleEventoProps {
  evento: EventoAgenda | null;
  onClose: () => void;
  onEventoActualizado?: () => void;
}

export default function ModalDetalleEvento({
  evento,
  onClose,
  onEventoActualizado,
}: ModalDetalleEventoProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const { setOrdenSidebarOpen, setPresupuestoSidebarOpen } = useUIStore();
  const [updating, setUpdating] = useState(false);

  if (!evento) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (backdropRef.current && e.target === backdropRef.current) {
      onClose();
    }
  };

  const isCita = evento.tipo === "cita";
  const isEntrega = evento.tipo === "entrega_orden";

  const handleCambiarEstadoCita = async (nuevoEstado: "Agendada" | "Completada" | "Cancelada") => {
    if (!isCita || !evento.id) return;
    setUpdating(true);
    try {
      await updateCita(evento.id, { estado: nuevoEstado });
      toast.success(`Cita marcada como ${nuevoEstado}`);
      if (onEventoActualizado) onEventoActualizado();
      onClose();
    } catch (err) {
      console.error("Error al actualizar estado de la cita", err);
      toast.error("No se pudo actualizar el estado de la cita");
    } finally {
      setUpdating(false);
    }
  };

  const handleEliminarCita = async () => {
    if (!isCita || !evento.id) return;
    if (!confirm("¿Estás seguro de eliminar esta cita agendada?")) return;
    setUpdating(true);
    try {
      await deleteCita(evento.id);
      toast.success("Cita eliminada correctamente");
      if (onEventoActualizado) onEventoActualizado();
      onClose();
    } catch (err) {
      console.error("Error al eliminar la cita", err);
      toast.error("No se pudo eliminar la cita");
    } finally {
      setUpdating(false);
    }
  };

  const handleAbrirOrden = () => {
    if (evento.ordenId) {
      setOrdenSidebarOpen(true, evento.ordenId);
      onClose();
    }
  };

  const handleAbrirPresupuesto = () => {
    if (evento.presupuestoId) {
      setPresupuestoSidebarOpen(true, evento.presupuestoId);
      onClose();
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col my-auto">
        {/* Header con color representativo */}
        <div
          className={`px-5 py-4 border-b flex items-start justify-between gap-3 ${
            isCita
              ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/40"
              : "bg-purple-50/70 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/40"
          }`}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                  isCita
                    ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/60 dark:text-blue-200 dark:border-blue-700"
                    : "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/60 dark:text-purple-200 dark:border-purple-700"
                }`}
              >
                {isCita ? <Calendar size={11} /> : <Wrench size={11} />}
                {isCita ? "Cita Agendada" : "Entrega de Orden"}
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {evento.estado}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug break-words">
              {evento.titulo}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800 rounded-lg transition-colors border-0 bg-transparent cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Details */}
        <div className="p-5 space-y-3 text-xs text-slate-700 dark:text-slate-300">
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Calendar size={14} className={isCita ? "text-blue-500" : "text-purple-500"} />
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Fecha</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{evento.fecha}</span>
              </div>
            </div>

            {evento.horaInicio && (
              <div className="flex items-center gap-2">
                <Clock size={14} className={isCita ? "text-blue-500" : "text-purple-500"} />
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Horario</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {evento.horaInicio} {evento.horaFin ? `- ${evento.horaFin}` : ""}
                  </span>
                </div>
              </div>
            )}
          </div>

          {evento.clienteNombre && (
            <div className="flex items-center gap-2.5">
              <User size={14} className="text-slate-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Cliente</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{evento.clienteNombre}</span>
              </div>
            </div>
          )}

          {evento.vehiculoPlaca && (
            <div className="flex items-center gap-2.5">
              <Car size={14} className="text-slate-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Vehículo</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                  {evento.vehiculoPlaca}
                </span>
              </div>
            </div>
          )}

          {evento.asignadoANombre && (
            <div className="flex items-center gap-2.5">
              <User size={14} className="text-slate-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Asignado a</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{evento.asignadoANombre}</span>
              </div>
            </div>
          )}

          {evento.descripcion && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold mb-1">Descripción / Notas</span>
              <p className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                {evento.descripcion}
              </p>
            </div>
          )}

          {/* Links a Presupuesto u Orden */}
          {isEntrega && evento.ordenId && (
            <button
              type="button"
              onClick={handleAbrirOrden}
              className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-0 shadow-xs"
            >
              <ExternalLink size={14} />
              Ver Orden de Trabajo #{String(evento.ordenRaw?.numeroOrden || evento.ordenRaw?.numero || "").padStart(4, "0")}
            </button>
          )}

          {isCita && evento.presupuestoId && (
            <button
              type="button"
              onClick={handleAbrirPresupuesto}
              className="w-full py-2 px-3 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-blue-200 dark:border-blue-800"
            >
              <FileText size={14} />
              Ver Presupuesto Vinculado
            </button>
          )}
        </div>

        {/* Action Buttons for Citas */}
        {isCita && (
          <div className="px-5 py-3 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleEliminarCita}
              disabled={updating}
              className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg text-xs font-semibold flex items-center gap-1 border-0 cursor-pointer transition-colors"
              title="Eliminar esta cita"
            >
              <Trash2 size={14} />
              Eliminar
            </button>

            <div className="flex items-center gap-1.5">
              {evento.estado !== "Completada" && (
                <button
                  type="button"
                  onClick={() => handleCambiarEstadoCita("Completada")}
                  disabled={updating}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 border-0 cursor-pointer shadow-2xs transition-colors"
                >
                  <CheckCircle2 size={13} />
                  Completar
                </button>
              )}
              {evento.estado !== "Cancelada" && (
                <button
                  type="button"
                  onClick={() => handleCambiarEstadoCita("Cancelada")}
                  disabled={updating}
                  className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-rose-100 hover:text-rose-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 border-0 cursor-pointer transition-colors"
                >
                  <AlertCircle size={13} />
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
