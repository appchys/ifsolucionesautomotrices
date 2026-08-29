"use client";
import { useEffect, useState, useMemo, Suspense, Fragment } from "react";
import AppShell from "@/components/layout/AppShell";
import { deleteOrden, subscribeOrdenes, updateEstadoOrden, subscribeClientes, subscribeVehiculos } from "@/lib/services";
import { OrdenTrabajo, EstadoOrden, Cliente, Vehiculo } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MoreVertical, Search, Trash2, Wrench, Filter, ChevronDown } from "lucide-react";
import { toast } from "react-hot-toast";
import ModalNuevoIngreso from "@/components/recepcion/ModalNuevoIngreso";
import { useUIStore } from "@/store";
import BotonNuevoPopover from "@/components/ordenes/BotonNuevoPopover";

const ESTADOS: EstadoOrden[] = [
  "Borrador",
  "En Diagnóstico",
  "Esperando Repuestos",
  "Esperando Aprobación",
  "En Reparación",
  "Completada",
  "Listo para Entrega",
  "Entregada",
  "Cancelada",
];

const ESTADO_COLORES: Record<EstadoOrden, { dot: string; bg: string; text: string }> = {
  "Borrador": { dot: "#ef4444", bg: "rgba(239, 68, 68, 0.08)", text: "text-red-700 dark:text-red-400" },
  "En Diagnóstico": { dot: "#3b82f6", bg: "rgba(59, 130, 246, 0.08)", text: "text-blue-700 dark:text-blue-400" },
  "Esperando Repuestos": { dot: "#f59e0b", bg: "rgba(245, 158, 11, 0.08)", text: "text-amber-700 dark:text-amber-400" },
  "Esperando Aprobación": { dot: "#8b5cf6", bg: "rgba(139, 92, 246, 0.08)", text: "text-purple-700 dark:text-purple-400" },
  "En Reparación": { dot: "#06b6d4", bg: "rgba(6, 182, 212, 0.08)", text: "text-cyan-700 dark:text-cyan-400" },
  "Listo para Entrega": { dot: "#14b8a6", bg: "rgba(20, 184, 166, 0.08)", text: "text-teal-700 dark:text-teal-400" },
  "Completada": { dot: "#10b981", bg: "rgba(16, 185, 129, 0.08)", text: "text-emerald-700 dark:text-emerald-400" },
  "Entregada": { dot: "#64748b", bg: "rgba(100, 116, 139, 0.08)", text: "text-slate-700 dark:text-slate-400" },
  "Cancelada": { dot: "#71717a", bg: "rgba(113, 113, 122, 0.08)", text: "text-zinc-700 dark:text-zinc-400" },
};

type MenuPosition = { id: string; top: number; left: number };

const getNumeroDocumento = (orden: OrdenTrabajo) =>
  orden.numeroOrden ?? (orden.esCotizacion ? orden.numeroCotizacion ?? orden.numero : orden.numero);

function toDate(value: OrdenTrabajo["createdAt"]): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const maybeTimestamp = value as { toDate?: () => Date };
  return typeof maybeTimestamp.toDate === "function" ? maybeTimestamp.toDate() : null;
}

function OrdenesPageContent() {
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, Cliente>>({});
  const [vehiculosMap, setVehiculosMap] = useState<Record<string, Vehiculo>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoOrden | "Todos">("Todos");
  const [tipoNuevo, setTipoNuevo] = useState<"ingreso" | "presupuesto" | "orden" | null>(null);
  const [openMenu, setOpenMenu] = useState<MenuPosition | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [estadosColapsados, setEstadosColapsados] = useState<Record<string, boolean>>({
    Entregada: true,
  });
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");
  const { setOrdenSidebarOpen } = useUIStore();

  useEffect(() => {
    if (idParam) {
      setOrdenSidebarOpen(true, idParam);
    }
  }, [idParam, setOrdenSidebarOpen]);

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

    const unsubOrdenes = subscribeOrdenes(
      (data) => {
        setOrdenes(data);
        setLoading(false);
      },
      (err) => {
        console.error("Error cargando ordenes", err);
        toast.error("No se pudieron cargar las ordenes");
        setLoading(false);
      }
    );

    return () => {
      unsubClientes();
      unsubVehiculos();
      unsubOrdenes();
    };
  }, []);

  useEffect(() => {
    if (!openMenu) return;

    const closeMenu = () => setOpenMenu(null);
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, [openMenu]);

  // Lista filtrada memorizada con useMemo
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return ordenes
      .filter((o) => Boolean(o.numeroOrden))
      .map((o) => ({
        ...o,
        cliente: clientesMap[o.clienteId] || o.cliente,
        vehiculo: vehiculosMap[o.vehiculoId] || o.vehiculo,
      }))
      .filter((o) => {
        const matchEstado = filtroEstado === "Todos" || o.estado === filtroEstado;
        const matchSearch =
          !term ||
          o.vehiculo?.placa?.toLowerCase().includes(term) ||
          o.cliente?.nombre?.toLowerCase().includes(term) ||
          o.cliente?.apellido?.toLowerCase().includes(term) ||
          String(getNumeroDocumento(o) ?? "").includes(term);
        return matchEstado && matchSearch;
      });
  }, [ordenes, clientesMap, vehiculosMap, filtroEstado, search]);

  const gruposEstado = useMemo(() => {
    const grupos: Record<string, typeof filtered> = {};
    filtered.forEach((orden) => {
      const estadoKey = orden.estado || "Borrador";
      if (!grupos[estadoKey]) {
        grupos[estadoKey] = [];
      }
      grupos[estadoKey].push(orden);
    });
    return grupos;
  }, [filtered]);

  const estadosConOrdenes = useMemo(() => {
    const baseEstados = filtroEstado === "Todos" 
      ? ESTADOS 
      : [filtroEstado];
    return baseEstados.filter((est) => (gruposEstado[est]?.length || 0) > 0);
  }, [gruposEstado, filtroEstado]);

  const toggleEstadoColapsado = (estado: string) => {
    setEstadosColapsados((prev) => ({
      ...prev,
      [estado]: !prev[estado],
    }));
  };

  const cambiarEstado = async (id: string, estado: EstadoOrden) => {
    await updateEstadoOrden(id, estado);
    toast.success(`Estado actualizado: ${estado}`);
  };

  const eliminarOrden = async (orden: OrdenTrabajo) => {
    const id = orden.id;
    if (!id || deletingOrderId) return;

    const numero = String(getNumeroDocumento(orden) ?? 0).padStart(4, "0");
    const confirmed = window.confirm(`Eliminar la orden #${numero}?`);
    if (!confirmed) return;

    setDeletingOrderId(id);
    setOpenMenu(null);
    try {
      await deleteOrden(id);
      toast.success("Orden eliminada");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo eliminar la orden");
    } finally {
      setDeletingOrderId(null);
    }
  };

  return (
    <AppShell hideHeader>
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Órdenes de Trabajo</h1>
          <p className="page-subtitle">{ordenes.length} órdenes en total</p>
        </div>
        <BotonNuevoPopover onSelect={(tipo) => setTipoNuevo(tipo)} />
      </div>


      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            className="input pl-9 w-full text-sm"
            placeholder="Buscar por placa, cliente, # orden..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative min-w-[200px] sm:w-64">
          <Filter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
          <select
            className="input pl-9 pr-8 w-full text-sm appearance-none cursor-pointer font-medium"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoOrden | "Todos")}
          >
            <option value="Todos">Todos los estados</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
            <Wrench size={40} className="mx-auto mb-3 opacity-20" />
            <p>No se encontraron órdenes</p>
          </div>
        ) : (
          <div className="table-container overflow-x-auto">
            <table className="table min-w-[620px]">
              <thead>
                <tr>
                  <th># Orden</th>
                  <th className="whitespace-nowrap">Cliente / Vehículo</th>
                  <th className="whitespace-nowrap">Placa</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th className="w-12 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/40 text-xs sm:text-sm">
                {estadosConOrdenes.map((estado) => {
                  const ordenesGrupo = gruposEstado[estado] || [];
                  const isColapsado = Boolean(estadosColapsados[estado]);
                  const colorConfig = ESTADO_COLORES[estado] || {
                    dot: "#64748b",
                    bg: "rgba(100, 116, 139, 0.08)",
                    text: "text-slate-700 dark:text-slate-400",
                  };

                  return (
                    <Fragment key={estado}>
                      <tr 
                        onClick={() => toggleEstadoColapsado(estado)}
                        className="border-y border-[var(--border)] cursor-pointer select-none hover:opacity-90 transition-all"
                        style={{ background: colorConfig.bg }}
                      >
                        <td colSpan={7} className="py-2 px-3.5 text-xs font-bold">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ChevronDown 
                                size={15} 
                                className={`transition-transform duration-200 ${isColapsado ? "-rotate-90" : "rotate-0"}`} 
                                style={{ color: colorConfig.dot }}
                              />
                              <span 
                                className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-xs" 
                                style={{ backgroundColor: colorConfig.dot }}
                              />
                              <span className={`uppercase tracking-wider font-bold ${colorConfig.text}`}>
                                {estado}
                              </span>
                            </div>
                            <span 
                              className="text-[11px] font-bold px-2 py-0.5 rounded-full border shadow-2xs"
                              style={{
                                background: "var(--bg-card)",
                                borderColor: `${colorConfig.dot}40`,
                                color: colorConfig.dot,
                              }}
                            >
                              {ordenesGrupo.length} {ordenesGrupo.length === 1 ? "orden" : "órdenes"}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {!isColapsado && ordenesGrupo.map((o) => (
                        <tr 
                          key={o.id} 
                          onClick={() => setOrdenSidebarOpen(true, o.id)}
                          className="cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                        >
                          <td className="whitespace-nowrap">
                            <span className="font-mono font-bold text-sm" style={{ color: "var(--accent-light)" }}>
                              #ORD-{String(o.numeroOrden ?? 0).padStart(5, "0")}
                            </span>
                          </td>
                          <td className="whitespace-nowrap">
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
                          <td className="whitespace-nowrap">
                            <span className="font-mono font-semibold text-xs">{o.vehiculo?.placa ?? "—"}</span>
                          </td>
                          <td className="whitespace-nowrap"><span className="badge badge-gray">{o.tipoServicio}</span></td>
                          <td>
                            {o.esCotizacion ? (
                              <span className="badge" style={{ background: "rgba(37,99,235,0.1)", color: "var(--accent)", border: "1px solid var(--accent-alpha)" }}>Cotización</span>
                            ) : (
                              <select
                                className="badge cursor-pointer outline-none"
                                value={o.estado}
                                onChange={(e) => cambiarEstado(o.id!, e.target.value as EstadoOrden)}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "inherit",
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {ESTADOS.map((est) => (
                                  <option key={est} value={est} style={{ background: "#ffffff", color: "#0f172a" }}>
                                    {est}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="text-xs whitespace-nowrap">
                            {toDate(o.createdAt)
                              ? format(toDate(o.createdAt)!, "dd/MM/yy", { locale: es })
                              : "—"}
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <div className="relative inline-flex">
                              <button
                                type="button"
                                className="btn-ghost btn-icon h-8 w-8"
                                title="Acciones"
                                aria-label="Acciones de la orden"
                                aria-expanded={openMenu?.id === o.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  const orderId = o.id;
                                  if (!orderId) return;
                                  const rect = event.currentTarget.getBoundingClientRect();
                                  setOpenMenu((current) =>
                                    current?.id === orderId
                                      ? null
                                      : {
                                          id: orderId,
                                          top: rect.bottom + 4,
                                          left: Math.min(window.innerWidth - 152, Math.max(8, rect.right - 144)),
                                        }
                                  );
                                }}
                              >
                                {deletingOrderId === o.id ? (
                                  <Loader2 size={15} className="animate-spin" />
                                ) : (
                                  <MoreVertical size={16} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openMenu ? (
        <div
          className="fixed z-[1200] w-36 rounded-md border border-[var(--border)] bg-[var(--bg-card)] p-1 shadow-xl"
          style={{ top: openMenu.top, left: openMenu.left }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-60"
            disabled={deletingOrderId === openMenu.id}
            onClick={() => {
              const orden = filtered.find((item) => item.id === openMenu.id);
              if (orden) void eliminarOrden(orden);
            }}
          >
            <Trash2 size={14} />
            Eliminar
          </button>
        </div>
      ) : null}

      {tipoNuevo && (
        <ModalNuevoIngreso
          onClose={() => setTipoNuevo(null)}
          tipoMode={tipoNuevo}
        />
      )}
    </AppShell>
  );
}

export default function OrdenesPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[var(--bg-primary)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    }>
      <OrdenesPageContent />
    </Suspense>
  );
}
