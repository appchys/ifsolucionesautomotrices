"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Car,
  Wrench,
  ArrowRight,
  Plus,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { subscribeCitas, subscribeOrdenes, getClientes, getVehiculos } from "@/lib/services";
import { Cita, OrdenTrabajo, Cliente, Vehiculo } from "@/types";
import ModalCrearCitaGlobal from "@/components/agenda/ModalCrearCitaGlobal";
import ModalDetalleEvento, { EventoAgenda } from "@/components/agenda/ModalDetalleEvento";

function parseDateToYYYYMMDD(val: any): string | null {
  if (!val) return null;
  try {
    let d: Date | null = null;
    if (typeof val?.toDate === "function") {
      d = val.toDate();
    } else if (val instanceof Date) {
      d = val;
    } else if (typeof val === "string") {
      if (val.length === 10 && val.includes("-")) return val;
      d = new Date(val);
    } else if (typeof val === "number") {
      d = new Date(val);
    }

    if (d && !isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch (err) {
    console.error("Error al formatear fecha:", err);
  }
  return null;
}

export default function MiniAgendaWidget() {
  const [citas, setCitas] = useState<Cita[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, Cliente>>({});
  const [vehiculosMap, setVehiculosMap] = useState<Record<string, Vehiculo>>({});
  const [loading, setLoading] = useState(true);

  const [isModalCrearOpen, setIsModalCrearOpen] = useState(false);
  const [eventoSeleccionado, setEventoSeleccionado] = useState<EventoAgenda | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [cList, vList] = await Promise.all([getClientes(), getVehiculos()]);
        if (active) {
          const cMap: Record<string, Cliente> = {};
          const vMap: Record<string, Vehiculo> = {};
          cList.forEach((c) => { if (c.id) cMap[c.id] = c; });
          vList.forEach((v) => { if (v.id) vMap[v.id] = v; });
          setClientesMap(cMap);
          setVehiculosMap(vMap);
        }
      } catch (err) {
        console.error("Error cargando mapa de clientes/vehículos en MiniAgenda", err);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const unsubCitas = subscribeCitas((citasData) => {
      if (active) setCitas(citasData);
    });

    const unsubOrdenes = subscribeOrdenes((ordenesData) => {
      if (active) {
        setOrdenes(ordenesData.filter((o) => !o.esCotizacion));
        setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubCitas();
      unsubOrdenes();
    };
  }, []);

  // Hoy string YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // Filtrar eventos de Hoy y Próximos (máximo 5)
  const proximosEventos = useMemo(() => {
    const lista: EventoAgenda[] = [];

    // 1. Citas (Agendadas o de Hoy en adelante)
    citas.forEach((c) => {
      if (!c.id || !c.fecha) return;
      if (c.fecha >= todayStr && c.estado !== "Cancelada") {
        lista.push({
          id: c.id,
          tipo: "cita",
          titulo: c.titulo,
          fecha: c.fecha,
          horaInicio: c.horaInicio,
          horaFin: c.horaFin,
          clienteNombre: c.clienteNombre,
          vehiculoPlaca: c.vehiculoPlaca,
          estado: c.estado || "Agendada",
          descripcion: c.descripcion,
          presupuestoId: c.presupuestoId,
          citaRaw: c,
        });
      }
    });

    // 2. Entregas de Órdenes
    ordenes.forEach((o) => {
      if (!o.id) return;
      const fechaStr = parseDateToYYYYMMDD(o.fechaEntrega);
      if (!fechaStr) return;

      if (fechaStr >= todayStr && o.estado !== "Entregada") {
        const client = o.clienteId ? clientesMap[o.clienteId] : o.cliente;
        const vehic = o.vehiculoId ? vehiculosMap[o.vehiculoId] : o.vehiculo;
        const numOrden = String(o.numeroOrden || o.numero || 0).padStart(4, "0");
        const clientName = client ? `${client.nombre} ${client.apellido || ""}`.trim() : "";
        const vehicPlaca = vehic?.placa || "";

        lista.push({
          id: `orden-${o.id}`,
          tipo: "entrega_orden",
          titulo: `Entrega OT #${numOrden} — ${vehicPlaca || clientName || "Vehículo"}`,
          fecha: fechaStr,
          horaInicio: "17:00",
          clienteNombre: clientName || undefined,
          vehiculoPlaca: vehicPlaca || undefined,
          estado: o.estado || "En Proceso",
          ordenId: o.id,
          ordenRaw: o,
        });
      }
    });

    // Ordenar cronológicamente y tomar los primeros 5
    return lista
      .sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha > b.fecha ? 1 : -1;
        return (a.horaInicio || "") > (b.horaInicio || "") ? 1 : -1;
      })
      .slice(0, 5);
  }, [citas, ordenes, clientesMap, vehiculosMap, todayStr]);

  return (
    <div className="bg-white dark:bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl">
            <Calendar size={18} />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-800 dark:text-slate-100">
              Mini Agenda
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Citas y entregas pendientes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsModalCrearOpen(true)}
            className="p-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold transition-colors border-0 cursor-pointer flex items-center gap-1"
            title="Agendar Cita Rápida"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Cita</span>
          </button>
          <Link href="/agenda" className="btn-ghost btn-sm text-xs font-bold flex items-center gap-1">
            Ver todas <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Body List */}
      {loading ? (
        <div className="flex items-center justify-center py-6 text-slate-400 gap-2 text-xs">
          <Loader2 size={16} className="animate-spin text-purple-600" />
          Cargando agenda...
        </div>
      ) : proximosEventos.length === 0 ? (
        <div className="p-5 text-center bg-slate-50/50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <Calendar size={28} className="text-slate-300 dark:text-slate-700 mx-auto" />
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            No hay eventos próximos agendados
          </p>
          <button
            type="button"
            onClick={() => setIsModalCrearOpen(true)}
            className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline border-0 bg-transparent cursor-pointer inline-flex items-center gap-1"
          >
            <Plus size={13} />
            Agendar una cita ahora
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {proximosEventos.map((ev) => {
            const isCita = ev.tipo === "cita";
            const esHoy = ev.fecha === todayStr;

            return (
              <div
                key={ev.id}
                onClick={() => setEventoSeleccionado(ev)}
                className={`p-3 rounded-xl border transition-all cursor-pointer hover:shadow-2xs flex items-center justify-between gap-3 ${
                  isCita
                    ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40 hover:border-blue-300"
                    : "bg-purple-50/40 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/40 hover:border-purple-300"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                        isCita
                          ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/60 dark:text-blue-200 dark:border-blue-700"
                          : "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/60 dark:text-purple-200 dark:border-purple-700"
                      }`}
                    >
                      {isCita ? <Calendar size={10} /> : <Wrench size={10} />}
                      {isCita ? "Cita" : "Entrega"}
                    </span>

                    {esHoy && (
                      <span className="bg-red-500 text-white font-black text-[9px] px-1.5 py-0.2 rounded-md uppercase">
                        Hoy
                      </span>
                    )}

                    <span className="text-[10px] text-slate-500 font-bold truncate">
                      {ev.fecha} {ev.horaInicio ? `• ${ev.horaInicio}` : ""}
                    </span>
                  </div>

                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                    {ev.titulo}
                  </h4>
                </div>

                {ev.vehiculoPlaca && (
                  <span className="shrink-0 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-200">
                    {ev.vehiculoPlaca}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modales */}
      {isModalCrearOpen && (
        <ModalCrearCitaGlobal
          isOpen={isModalCrearOpen}
          onClose={() => setIsModalCrearOpen(false)}
          onCitaCreada={() => {}}
        />
      )}

      {eventoSeleccionado && (
        <ModalDetalleEvento
          evento={eventoSeleccionado}
          onClose={() => setEventoSeleccionado(null)}
        />
      )}
    </div>
  );
}
