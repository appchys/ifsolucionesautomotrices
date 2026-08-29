"use client";
import { useEffect, useState, useMemo, Suspense, Fragment } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  subscribeOrdenes,
  subscribeClientes,
  subscribeVehiculos,
  subscribeTotalesItemsDetalladosMap,
  calcularTotalConDescuento,
  InfoItemsOrden,
  deleteOrden,
  convertirPresupuestoAOrden,
} from "@/lib/services";
import { OrdenTrabajo, Cliente, Vehiculo } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  Plus,
  Search,
  FileText,
  MoreVertical,
  Trash2,
  DollarSign,
  Clock,
  CheckCircle2,
  FileCheck,
  Wrench,
  Eye,
} from "lucide-react";
import ModalNuevoIngreso from "@/components/recepcion/ModalNuevoIngreso";
import { toast } from "react-hot-toast";
import { useUIStore } from "@/store";

const FILTROS = ["Todos", "Pendiente", "Aprobado"] as const;
type FiltroPresupuesto = (typeof FILTROS)[number];

function toDate(value: OrdenTrabajo["createdAt"]): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const maybeTimestamp = value as { toDate?: () => Date };
  return typeof maybeTimestamp.toDate === "function"
    ? maybeTimestamp.toDate()
    : null;
}

type MenuPosition = { id: string; top: number; left: number };

function PresupuestosPageContent() {
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [ordenesReales, setOrdenesReales] = useState<OrdenTrabajo[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, Cliente>>({});
  const [vehiculosMap, setVehiculosMap] = useState<Record<string, Vehiculo>>({});
  const [totalesInfoMap, setTotalesInfoMap] = useState<Record<string, InfoItemsOrden>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroActivo, setFiltroActivo] = useState<FiltroPresupuesto>("Todos");
  const [showModal, setShowModal] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuPosition | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");
  const { setPresupuestoSidebarOpen, setOrdenSidebarOpen } = useUIStore();

  useEffect(() => {
    if (idParam) {
      setPresupuestoSidebarOpen(true, idParam);
    }
  }, [idParam, setPresupuestoSidebarOpen]);

  useEffect(() => {
    const unsubClientes = subscribeClientes((cList) => {
      const cMap: Record<string, Cliente> = {};
      cList.forEach((c) => {
        if (c.id) cMap[c.id] = c;
      });
      setClientesMap(cMap);
    });

    const unsubVehiculos = subscribeVehiculos((vList) => {
      const vMap: Record<string, Vehiculo> = {};
      vList.forEach((v) => {
        if (v.id) vMap[v.id] = v;
      });
      setVehiculosMap(vMap);
    });

    const unsubTotales = subscribeTotalesItemsDetalladosMap((totales) => {
      setTotalesInfoMap(totales);
    });

    const unsubOrdenes = subscribeOrdenes(
      (data) => {
        setOrdenes(data.filter((o) => o.esCotizacion === true));
        setOrdenesReales(data.filter((o) => o.esCotizacion !== true));
        setLoading(false);
      },
      (err) => {
        console.error("Error cargando presupuestos", err);
        setLoading(false);
      }
    );

    return () => {
      unsubClientes();
      unsubVehiculos();
      unsubTotales();
      unsubOrdenes();
    };
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const closeMenu = () => setOpenMenu(null);
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, [openMenu]);

  // Mapa de órdenes vinculadas memorizado
  const ordenesVinculadasMap = useMemo(() => {
    const map: Record<string, OrdenTrabajo> = {};
    ordenes.forEach((p) => {
      if (!p.id) return;
      const numCot = p.numeroCotizacion || p.numero;
      const numStr = numCot ? String(numCot) : null;
      const match = ordenesReales.find(
        (o) =>
          o.presupuestoId === p.id ||
          (numStr && String(o.motivo || "").includes(numStr)) ||
          (o.vehiculoId === p.vehiculoId && p.presupuestoConfirmadoPorCliente && o.estado !== "Borrador") ||
          (o.numeroIngreso && String(p.motivo || "").includes(String(o.numeroIngreso)))
      );
      if (match) {
        map[p.id] = match;
      }
    });
    return map;
  }, [ordenes, ordenesReales]);

  // Lista filtrada y enriquecida con useMemo
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return ordenes
      .map((o) => ({
        ...o,
        cliente: clientesMap[o.clienteId] || o.cliente,
        vehiculo: vehiculosMap[o.vehiculoId] || o.vehiculo,
      }))
      .filter((o) => {
        const estado = o.presupuestoConfirmadoPorCliente ? "Aprobado" : "Pendiente";
        const matchEstado = filtroActivo === "Todos" || estado === filtroActivo;
        const matchSearch =
          !term ||
          o.vehiculo?.placa?.toLowerCase().includes(term) ||
          o.cliente?.nombre?.toLowerCase().includes(term) ||
          o.cliente?.apellido?.toLowerCase().includes(term) ||
          String(o.numeroCotizacion ?? o.numero ?? "").includes(term);
        return matchEstado && matchSearch;
      })
      .sort((a, b) => {
        const timeA = toDate(a.createdAt)?.getTime() || 0;
        const timeB = toDate(b.createdAt)?.getTime() || 0;
        return timeB - timeA;
      });
  }, [ordenes, clientesMap, vehiculosMap, filtroActivo, search]);

  // Estadísticas calculadas en una sola pasada con useMemo
  const { totalPresupuestos, pendientes, aprobados, montoTotal } = useMemo(() => {
    let pend = 0;
    let aprob = 0;
    let monto = 0;

    filtered.forEach((o) => {
      if (o.presupuestoConfirmadoPorCliente) {
        aprob++;
      } else {
        pend++;
      }
      monto += calcularTotalConDescuento(totalesInfoMap[o.id!], o.descuento || 0);
    });

    return {
      totalPresupuestos: filtered.length,
      pendientes: pend,
      aprobados: aprob,
      montoTotal: monto,
    };
  }, [filtered, totalesInfoMap]);

  // Agrupación por fecha
  const gruposFecha = useMemo(() => {
    const grupos: Record<string, typeof filtered> = {};
    filtered.forEach((item) => {
      const date = toDate(item.createdAt);
      const key = date ? format(date, "yyyy-MM-dd") : "Sin fecha";
      if (!grupos[key]) {
        grupos[key] = [];
      }
      grupos[key].push(item);
    });
    return grupos;
  }, [filtered]);

  const keysFechaOrdenadas = useMemo(() => {
    return Object.keys(gruposFecha).sort((a, b) => b.localeCompare(a));
  }, [gruposFecha]);
  const crearOrdenDesdePresupuesto = async (orden: OrdenTrabajo) => {
    const id = orden.id;
    if (!id || convertingId) return;
    const numero = String(orden.numeroCotizacion ?? orden.numero ?? 0).padStart(4, "0");
    const confirmed = window.confirm(
      `¿Crear una Orden de Trabajo a partir del presupuesto #PRE-${numero}?`
    );
    if (!confirmed) return;
    setConvertingId(id);
    setOpenMenu(null);
    const toastId = toast.loading("Creando Orden de Trabajo...");
    try {
      const ordenIdResult = await convertirPresupuestoAOrden(id);
      toast.success("Orden de Trabajo creada con éxito", { id: toastId });
      setOrdenSidebarOpen(true, ordenIdResult);
    } catch (error) {
      console.error(error);
      toast.error("Error al crear la orden de trabajo", { id: toastId });
    } finally {
      setConvertingId(null);
    }
  };

  const eliminarPresupuesto = async (orden: OrdenTrabajo) => {
    const id = orden.id;
    if (!id || deletingId) return;
    const numero = String(
      orden.numeroCotizacion ?? orden.numero ?? 0
    ).padStart(4, "0");
    const confirmed = window.confirm(
      `¿Eliminar el presupuesto #PRE-${numero}?`
    );
    if (!confirmed) return;
    setDeletingId(id);
    setOpenMenu(null);
    try {
      await deleteOrden(id);
      toast.success("Presupuesto eliminado");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo eliminar el presupuesto");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppShell>
      <div className="w-full max-w-full min-w-0 space-y-3">
        {/* Header superior */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">Presupuestos</h1>
            <p className="text-[11px] text-[var(--text-muted)]">
              {filtered.length} {filtered.length === 1 ? "presupuesto" : "presupuestos"} en total
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary btn-sm flex items-center gap-1.5 shrink-0"
          >
            <Plus size={15} /> Nuevo Presupuesto
          </button>
        </div>

        {/* Resumen de métricas 2x2 en móvil / 4 cols en desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="card flex items-center gap-2.5 p-2 sm:p-2.5 bg-[var(--bg-card)]">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-600">
              <FileText size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold leading-tight">{totalPresupuestos}</div>
              <div className="text-[10px] text-[var(--text-muted)] truncate">Total</div>
            </div>
          </div>

          <div className="card flex items-center gap-2.5 p-2 sm:p-2.5 bg-[var(--bg-card)]">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-600">
              <Clock size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold leading-tight">{pendientes}</div>
              <div className="text-[10px] text-[var(--text-muted)] truncate">Pendientes</div>
            </div>
          </div>

          <div className="card flex items-center gap-2.5 p-2 sm:p-2.5 bg-[var(--bg-card)]">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold leading-tight">{aprobados}</div>
              <div className="text-[10px] text-[var(--text-muted)] truncate">Aprobados</div>
            </div>
          </div>

          <div className="card flex items-center gap-2.5 p-2 sm:p-2.5 bg-[var(--bg-card)]">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-purple-500/10 text-purple-600">
              <DollarSign size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold leading-tight">${montoTotal.toFixed(2)}</div>
              <div className="text-[10px] text-[var(--text-muted)] truncate">Monto Total</div>
            </div>
          </div>
        </div>

        {/* Buscador y Filtros */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="relative flex-1 max-w-md">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              type="search"
              className="input pl-8.5 h-8.5 w-full text-xs bg-[var(--bg-card)] border border-[var(--border)] shadow-sm"
              placeholder="Buscar por número, cliente, placa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
            {FILTROS.map((f) => (
              <button
                key={f}
                onClick={() => setFiltroActivo(f)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  filtroActivo === f
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
                    : "bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla Deslizable */}
        <div className="card p-0 overflow-hidden shadow-sm w-full max-w-full min-w-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-[var(--accent)]" size={24} />
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="text-center py-12"
              style={{ color: "var(--text-muted)" }}
            >
              <FileCheck
                size={36}
                className="mx-auto mb-2 opacity-20"
              />
              <p className="text-xs">No se encontraron presupuestos</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto overscroll-x-contain">
              <table className="w-full text-left border-collapse min-w-[540px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider font-bold text-[var(--text-muted)] bg-[var(--bg-secondary)]/60">
                    <th className="py-2.5 px-3.5 whitespace-nowrap">N° Presup.</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Cliente / Vehículo</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Placa</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap text-right">Monto</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap text-center">Estado</th>
                    <th className="py-2.5 px-3 whitespace-nowrap text-right w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/40 text-xs sm:text-sm">
                  {keysFechaOrdenadas.map((key) => {
                    const itemsGrupo = gruposFecha[key];
                    let labelFecha = key;
                    if (key !== "Sin fecha") {
                      const dateObj = new Date(key + "T00:00:00");
                      const hoy = format(new Date(), "yyyy-MM-dd");
                      const ayer = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
                      if (key === hoy) labelFecha = "Hoy";
                      else if (key === ayer) labelFecha = "Ayer";
                      else {
                        labelFecha = format(dateObj, "EEEE, d 'de' MMMM yyyy", { locale: es });
                        labelFecha = labelFecha.charAt(0).toUpperCase() + labelFecha.slice(1);
                      }
                    }

                    return (
                      <Fragment key={key}>
                        <tr className="bg-[var(--bg-secondary)]/80">
                          <td colSpan={6} className="py-1.5 px-3.5 text-[11px] font-bold text-[var(--text-secondary)] tracking-wide">
                            {labelFecha}
                          </td>
                        </tr>
                        {itemsGrupo.map((o) => {
                          const estado = o.presupuestoConfirmadoPorCliente ? "Aprobado" : "Pendiente";
                          const total = calcularTotalConDescuento(totalesInfoMap[o.id!], o.descuento || 0);
                          return (
                            <tr
                              key={o.id}
                              className="hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                              onClick={() => setPresupuestoSidebarOpen(true, o.id)}
                            >
                              <td className="py-2.5 px-3.5 whitespace-nowrap font-mono font-bold text-blue-600 dark:text-blue-400">
                                #PRE-{String(o.numeroCotizacion ?? o.numero ?? 0).padStart(4, "0")}
                              </td>
                              <td className="py-2.5 px-3.5 whitespace-nowrap">
                                <div
                                  className="font-medium text-[var(--text-primary)] truncate min-w-[15ch] max-w-[160px] sm:max-w-[240px] md:max-w-[360px] lg:max-w-none"
                                  title={o.cliente ? `${o.cliente.nombre} ${o.cliente.apellido}`.trim() : undefined}
                                >
                                  {o.cliente ? `${o.cliente.nombre} ${o.cliente.apellido}`.trim() : "—"}
                                </div>
                                <div
                                  className="text-xs text-[var(--text-secondary)] mt-0.5 truncate min-w-[15ch] max-w-[160px] sm:max-w-[240px] md:max-w-[360px] lg:max-w-none"
                                  title={o.vehiculo ? `${o.vehiculo.marca} ${o.vehiculo.modelo} ${o.vehiculo.anio ?? ""}`.trim() : undefined}
                                >
                                  {o.vehiculo ? `${o.vehiculo.marca} ${o.vehiculo.modelo} ${o.vehiculo.anio ?? ""}`.trim() : "—"}
                                </div>
                              </td>
                              <td className="py-2.5 px-3.5 whitespace-nowrap font-mono text-xs font-semibold">
                                {o.vehiculo?.placa ?? "—"}
                              </td>
                              <td className="py-2.5 px-3.5 whitespace-nowrap text-right font-bold">
                                {total > 0 ? `$${total.toFixed(2)}` : "—"}
                              </td>
                              <td className="py-2.5 px-3.5 whitespace-nowrap text-center">
                                {estado === "Aprobado" ? (
                                  <span className="badge badge-green text-[11px]">Aprobado</span>
                                ) : (
                                  <span className="badge badge-yellow text-[11px]">Pendiente</span>
                                )}
                              </td>
                              <td className="py-2.5 px-2 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="btn-ghost btn-icon h-7 w-7 rounded p-0 inline-flex items-center justify-center text-slate-400 hover:text-slate-700"
                                  onClick={(event) => {
                                    const orderId = o.id;
                                    if (!orderId) return;
                                    const rect = event.currentTarget.getBoundingClientRect();
                                    setOpenMenu((current) =>
                                      current?.id === orderId
                                        ? null
                                        : {
                                            id: orderId,
                                            top: rect.bottom + 4,
                                            left: Math.min(
                                              window.innerWidth - 180,
                                              Math.max(8, rect.right - 170)
                                            ),
                                          }
                                    );
                                  }}
                                >
                                  {deletingId === o.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <MoreVertical size={15} />
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {openMenu ? (() => {
        const ordenVinculada = openMenu.id ? ordenesVinculadasMap[openMenu.id] : null;
        const numOt = ordenVinculada ? String(ordenVinculada.numeroOrden || ordenVinculada.numero || 0).padStart(4, "0") : "";
        return (
          <div
            className="fixed z-[1200] w-48 rounded-md border border-[var(--border)] bg-[var(--bg-card)] p-1 shadow-xl"
            style={{ top: openMenu.top, left: openMenu.left }}
            onClick={(event) => event.stopPropagation()}
          >
            {ordenVinculada ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                onClick={() => {
                  setOpenMenu(null);
                  setOrdenSidebarOpen(true, ordenVinculada.id!);
                }}
              >
                <Eye size={14} />
                Ver Orden #OT-{numOt}
              </button>
            ) : (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 disabled:opacity-60"
                disabled={convertingId === openMenu.id}
                onClick={() => {
                  const orden = filtered.find(
                    (item) => item.id === openMenu.id
                  );
                  if (orden) void crearOrdenDesdePresupuesto(orden);
                }}
              >
                <Wrench size={14} />
                Crear Orden
              </button>
            )}
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-60"
              disabled={deletingId === openMenu.id}
              onClick={() => {
                const orden = filtered.find(
                  (item) => item.id === openMenu.id
                );
                if (orden) void eliminarPresupuesto(orden);
              }}
            >
              <Trash2 size={14} />
              Eliminar
            </button>
          </div>
        );
      })() : null}

      {showModal && (
        <ModalNuevoIngreso
          onClose={() => setShowModal(false)}
          tipoMode="presupuesto"
        />
      )}
    </AppShell>
  );
}

export default function PresupuestosPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[var(--bg-primary)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    }>
      <PresupuestosPageContent />
    </Suspense>
  );
}
