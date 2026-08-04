"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { subscribeCitas, subscribeOrdenes, getClientes, getVehiculos } from "@/lib/services";
import { Cita, OrdenTrabajo, Cliente, Vehiculo } from "@/types";
import {
  Calendar as CalendarIcon,
  CalendarDays,
  Plus,
  Search,
  Filter,
  Loader2,
  Clock,
  Car,
  Wrench,
  CheckCircle2,
  AlertCircle,
  FileText,
  RefreshCw,
} from "lucide-react";
import AgendaCalendarView from "@/components/agenda/AgendaCalendarView";
import AgendaListView from "@/components/agenda/AgendaListView";
import ModalCrearCitaGlobal from "@/components/agenda/ModalCrearCitaGlobal";
import ModalDetalleEvento, { EventoAgenda } from "@/components/agenda/ModalDetalleEvento";

type ViewMode = "calendar" | "list";
type FilterTipo = "todos" | "cita" | "entrega";

/** Helper para convertir Firestore Timestamps / Dates / Strings a formato YYYY-MM-DD */
function parseDateToYYYYMMDD(val: any): string | null {
  if (!val) return null;
  try {
    let d: Date | null = null;
    if (typeof val?.toDate === "function") {
      d = val.toDate();
    } else if (val instanceof Date) {
      d = val;
    } else if (typeof val === "string") {
      if (val.length === 10 && val.includes("-")) return val; // Ya es YYYY-MM-DD
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

export default function AgendaPage() {
  const [citas, setCitas] = useState<Cita[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, Cliente>>({});
  const [vehiculosMap, setVehiculosMap] = useState<Record<string, Vehiculo>>({});
  const [loading, setLoading] = useState(true);

  // Filtros y Vista
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [filterTipo, setFilterTipo] = useState<FilterTipo>("todos");
  const [search, setSearch] = useState("");

  // Modales
  const [isModalCrearOpen, setIsModalCrearOpen] = useState(false);
  const [fechaInicialCrear, setFechaInicialCrear] = useState<string | undefined>(undefined);
  const [eventoSeleccionado, setEventoSeleccionado] = useState<EventoAgenda | null>(null);

  // Cargar clientes y vehículos para autocompletar nombres/placas en órdenes si no vienen denormalizados
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
        console.error("Error cargando mapas de clientes y vehículos", err);
      }
    })();
    return () => { active = false; };
  }, []);

  // Suscribirse a Citas y Órdenes en tiempo real
  useEffect(() => {
    let active = true;
    setLoading(true);

    const unsubCitas = subscribeCitas((citasData) => {
      if (active) setCitas(citasData);
    });

    const unsubOrdenes = subscribeOrdenes((ordenesData) => {
      if (active) {
        // Filtrar órdenes que no sean cotizaciones de borrador
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

  // Unificar eventos en una sola lista EventoAgenda[]
  const todosEventos = useMemo(() => {
    const lista: EventoAgenda[] = [];

    // 1. Citas Agendadas
    citas.forEach((c) => {
      if (!c.id || !c.fecha) return;
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
        asignadoANombre: c.asignadoANombre,
        presupuestoId: c.presupuestoId,
        citaRaw: c,
      });
    });

    // 2. Fechas de Entrega de Órdenes de Trabajo
    ordenes.forEach((o) => {
      if (!o.id) return;
      // Usar fechaEntrega de la orden
      const fechaStr = parseDateToYYYYMMDD(o.fechaEntrega);
      if (!fechaStr) return;

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
        horaInicio: "17:00", // Hora habitual de entrega estimada si no tiene hora específica
        clienteNombre: clientName || undefined,
        vehiculoPlaca: vehicPlaca || undefined,
        estado: o.estado || "En Proceso",
        descripcion: o.motivo ? `Motivo: ${o.motivo}` : undefined,
        ordenId: o.id,
        ordenRaw: o,
      });
    });

    // Ordenar por fecha y hora de inicio asc
    return lista.sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha > b.fecha ? 1 : -1;
      return (a.horaInicio || "") > (b.horaInicio || "") ? 1 : -1;
    });
  }, [citas, ordenes, clientesMap, vehiculosMap]);

  // Aplicar filtros de búsqueda y tipo
  const eventosFiltrados = useMemo(() => {
    return todosEventos.filter((ev) => {
      // Filtro por tipo
      if (filterTipo === "cita" && ev.tipo !== "cita") return false;
      if (filterTipo === "entrega" && ev.tipo !== "entrega_orden") return false;

      // Filtro por búsqueda de texto
      if (search.trim()) {
        const query = search.toLowerCase();
        const inTitulo = ev.titulo.toLowerCase().includes(query);
        const inCliente = (ev.clienteNombre || "").toLowerCase().includes(query);
        const inPlaca = (ev.vehiculoPlaca || "").toLowerCase().includes(query);
        const inEstado = ev.estado.toLowerCase().includes(query);
        if (!inTitulo && !inCliente && !inPlaca && !inEstado) return false;
      }

      return true;
    });
  }, [todosEventos, filterTipo, search]);

  // Métricas rápidas
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const stats = useMemo(() => {
    const eventosHoy = todosEventos.filter((e) => e.fecha === todayStr).length;
    const citasPendientes = todosEventos.filter((e) => e.tipo === "cita" && e.estado === "Agendada").length;
    const entregasPendientes = todosEventos.filter(
      (e) => e.tipo === "entrega_orden" && e.estado !== "Entregada" && e.estado !== "Finalizado"
    ).length;

    return { eventosHoy, citasPendientes, entregasPendientes };
  }, [todosEventos, todayStr]);

  const handleCrearCitaEnFecha = useCallback((fechaStr: string) => {
    setFechaInicialCrear(fechaStr);
    setIsModalCrearOpen(true);
  }, []);

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl">
                <CalendarIcon size={20} />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Agenda & Calendario
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Visualiza en tiempo real las citas agendadas y las fechas de entrega de órdenes de trabajo.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setFechaInicialCrear(undefined);
              setIsModalCrearOpen(true);
            }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer border-0 transition-colors shrink-0"
          >
            <Plus size={16} />
            Agendar Nueva Cita
          </button>
        </div>

        {/* Tarjetas de Métricas Rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Eventos para Hoy
              </span>
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5 block">
                {stats.eventosHoy}
              </span>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
              <Clock size={20} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Citas Agendadas
              </span>
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5 block">
                {stats.citasPendientes}
              </span>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
              <CalendarIcon size={20} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Entregas Pendientes
              </span>
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-0.5 block">
                {stats.entregasPendientes}
              </span>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-2xl">
              <Wrench size={20} />
            </div>
          </div>
        </div>

        {/* Controls & Filter Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cita, cliente, placa..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Filter Pills por Tipo de Evento */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setFilterTipo("todos")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer border-0 ${
                filterTipo === "todos"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-transparent"
              }`}
            >
              Todos ({todosEventos.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTipo("cita")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer border-0 flex items-center gap-1.5 ${
                filterTipo === "cita"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 bg-transparent"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500 border border-white"></span>
              Citas Agendadas
            </button>
            <button
              type="button"
              onClick={() => setFilterTipo("entrega")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer border-0 flex items-center gap-1.5 ${
                filterTipo === "entrega"
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 bg-transparent"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-purple-500 border border-white"></span>
              Entregas de Órdenes
            </button>
          </div>

          {/* Switcher Vista Calendario / Agenda Lista */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border-0 ${
                viewMode === "calendar"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 bg-transparent"
              }`}
            >
              <CalendarIcon size={14} />
              Calendario
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border-0 ${
                viewMode === "list"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 bg-transparent"
              }`}
            >
              <CalendarDays size={14} />
              Agenda
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 size={24} className="animate-spin text-purple-600" />
            <p className="text-xs font-semibold">Cargando eventos de la agenda...</p>
          </div>
        ) : viewMode === "calendar" ? (
          <AgendaCalendarView
            eventos={eventosFiltrados}
            onSeleccionarEvento={(ev) => setEventoSeleccionado(ev)}
            onCrearCitaEnFecha={handleCrearCitaEnFecha}
          />
        ) : (
          <AgendaListView
            eventos={eventosFiltrados}
            onSeleccionarEvento={(ev) => setEventoSeleccionado(ev)}
            onCrearCita={() => {
              setFechaInicialCrear(undefined);
              setIsModalCrearOpen(true);
            }}
          />
        )}
      </div>

      {/* Modales */}
      {isModalCrearOpen && (
        <ModalCrearCitaGlobal
          isOpen={isModalCrearOpen}
          onClose={() => setIsModalCrearOpen(false)}
          fechaInicial={fechaInicialCrear}
          onCitaCreada={() => {
            // Firestore listener actualiza las citas automáticamente
          }}
        />
      )}

      {eventoSeleccionado && (
        <ModalDetalleEvento
          evento={eventoSeleccionado}
          onClose={() => setEventoSeleccionado(null)}
        />
      )}
    </AppShell>
  );
}
