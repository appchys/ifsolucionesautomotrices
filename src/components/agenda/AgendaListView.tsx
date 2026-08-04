"use client";

import { useMemo } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Car,
  Wrench,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Plus,
} from "lucide-react";
import { EventoAgenda } from "./ModalDetalleEvento";

interface AgendaListViewProps {
  eventos: EventoAgenda[];
  onSeleccionarEvento: (evento: EventoAgenda) => void;
  onCrearCita: () => void;
}

export default function AgendaListView({
  eventos,
  onSeleccionarEvento,
  onCrearCita,
}: AgendaListViewProps) {
  // Hoy en string YYYY-MM-DD
  const todayStr = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  // Mañana string
  const tomorrowStr = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const d = String(tomorrow.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  // Agrupar eventos por categoría temporal
  const grupos = useMemo(() => {
    const hoy: EventoAgenda[] = [];
    const manana: EventoAgenda[] = [];
    const proximos: EventoAgenda[] = [];
    const pasados: EventoAgenda[] = [];

    eventos.forEach((ev) => {
      if (!ev.fecha) return;
      if (ev.fecha === todayStr) {
        hoy.push(ev);
      } else if (ev.fecha === tomorrowStr) {
        manana.push(ev);
      } else if (ev.fecha > tomorrowStr) {
        proximos.push(ev);
      } else {
        pasados.push(ev);
      }
    });

    return [
      { id: "hoy", titulo: "Hoy", badgeColor: "bg-blue-600 text-white", items: hoy },
      { id: "manana", titulo: "Mañana", badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200", items: manana },
      { id: "proximos", titulo: "Próximos Días", badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", items: proximos },
      { id: "pasados", titulo: "Anteriores / Pasados", badgeColor: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400", items: pasados },
    ];
  }, [eventos, todayStr, tomorrowStr]);

  if (eventos.length === 0) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
        <CalendarIcon size={40} className="text-slate-300 dark:text-slate-700 mx-auto" />
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">No hay eventos en la agenda</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          No se encontraron citas ni entregas de órdenes registradas para los filtros seleccionados.
        </p>
        <button
          type="button"
          onClick={onCrearCita}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer border-0 transition-colors"
        >
          <Plus size={14} />
          Agendar una Cita Ahora
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grupos.map((grupo) => {
        if (grupo.items.length === 0) return null;
        return (
          <div key={grupo.id} className="space-y-3">
            {/* Header del Grupo */}
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${grupo.badgeColor}`}>
                {grupo.titulo}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                ({grupo.items.length} {grupo.items.length === 1 ? "evento" : "eventos"})
              </span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
            </div>

            {/* List of events */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {grupo.items.map((ev) => {
                const isCita = ev.tipo === "cita";
                return (
                  <div
                    key={ev.id}
                    onClick={() => onSeleccionarEvento(ev)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md flex flex-col justify-between gap-3 ${
                      isCita
                        ? "bg-white dark:bg-slate-900 border-blue-100 dark:border-blue-900/40 hover:border-blue-300 dark:hover:border-blue-700"
                        : "bg-white dark:bg-slate-900 border-purple-100 dark:border-purple-900/40 hover:border-purple-300 dark:hover:border-purple-700"
                    }`}
                  >
                    {/* Top Bar */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                              isCita
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800"
                                : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800"
                            }`}
                          >
                            {isCita ? <CalendarIcon size={11} /> : <Wrench size={11} />}
                            {isCita ? "Cita" : "Entrega Orden"}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            {ev.estado}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                          {ev.titulo}
                        </h4>
                      </div>

                      <div className="shrink-0 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400">
                        <ChevronRight size={16} />
                      </div>
                    </div>

                    {/* Meta Data */}
                    <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-1">
                        <CalendarIcon size={13} className={isCita ? "text-blue-500" : "text-purple-500"} />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{ev.fecha}</span>
                      </div>

                      {ev.horaInicio && (
                        <div className="flex items-center gap-1">
                          <Clock size={13} className={isCita ? "text-blue-500" : "text-purple-500"} />
                          <span>{ev.horaInicio} {ev.horaFin ? `- ${ev.horaFin}` : ""}</span>
                        </div>
                      )}

                      {ev.clienteNombre && (
                        <div className="flex items-center gap-1 truncate max-w-[180px]">
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate">{ev.clienteNombre}</span>
                        </div>
                      )}

                      {ev.vehiculoPlaca && (
                        <div className="flex items-center gap-1">
                          <Car size={13} className="text-slate-400 shrink-0" />
                          <span className="font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] text-slate-700 dark:text-slate-200">
                            {ev.vehiculoPlaca}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
