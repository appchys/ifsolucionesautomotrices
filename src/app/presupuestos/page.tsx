"use client";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  subscribeOrdenes,
  getClientes,
  getVehiculos,
  getItemsOrden,
  deleteOrden,
} from "@/lib/services";
import { OrdenTrabajo, Cliente, Vehiculo, ItemOrden } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import ModalNuevoIngreso from "@/components/recepcion/ModalNuevoIngreso";
import { toast } from "react-hot-toast";

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

export default function PresupuestosPage() {
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, Cliente>>({});
  const [vehiculosMap, setVehiculosMap] = useState<Record<string, Vehiculo>>(
    {}
  );
  const [totalesMap, setTotalesMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroActivo, setFiltroActivo] =
    useState<FiltroPresupuesto>("Todos");
  const [showModal, setShowModal] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuPosition | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  const loadRelations = useCallback(async () => {
    try {
      const [cList, vList] = await Promise.all([
        getClientes(),
        getVehiculos(),
      ]);
      const cMap: Record<string, Cliente> = {};
      const vMap: Record<string, Vehiculo> = {};
      cList.forEach((c) => {
        if (c.id) cMap[c.id] = c;
      });
      vList.forEach((v) => {
        if (v.id) vMap[v.id] = v;
      });
      setClientesMap(cMap);
      setVehiculosMap(vMap);
    } catch (err) {
      console.error("Error cargando clientes y vehiculos", err);
    }
  }, []);

  // Load item totals for each presupuesto
  const loadTotales = useCallback(async (presupuestos: OrdenTrabajo[]) => {
    const entries = await Promise.all(
      presupuestos.map(async (p) => {
        if (!p.id) return null;
        try {
          const items = await getItemsOrden(p.id);
          const total = items.reduce(
            (acc, it) =>
              acc +
              it.precioUnitario * it.cantidad * (1 + it.impuestoAplicable / 100),
            0
          );
          return [p.id, total] as [string, number];
        } catch {
          return [p.id, 0] as [string, number];
        }
      })
    );
    const map: Record<string, number> = {};
    entries.forEach((e) => {
      if (e) map[e[0]] = e[1];
    });
    setTotalesMap(map);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRelations();
    }, 0);
    const unsub = subscribeOrdenes(
      (data) => {
        const presupuestos = data.filter((o) => o.esCotizacion === true);
        setOrdenes(presupuestos);
        setLoading(false);
        void loadTotales(presupuestos);
      },
      (err) => {
        console.error("Error cargando presupuestos", err);
        setLoading(false);
      }
    );
    return () => {
      window.clearTimeout(timer);
      unsub();
    };
  }, [loadRelations, loadTotales]);

  useEffect(() => {
    if (!openMenu) return;
    const closeMenu = () => setOpenMenu(null);
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, [openMenu]);

  const presupuestosConDetalle = ordenes.map((o) => ({
    ...o,
    cliente: clientesMap[o.clienteId] || o.cliente,
    vehiculo: vehiculosMap[o.vehiculoId] || o.vehiculo,
  }));

  const getEstadoPresupuesto = (o: OrdenTrabajo) => {
    if (o.presupuestoConfirmadoPorCliente) return "Aprobado";
    return "Pendiente";
  };

  const filtered = presupuestosConDetalle
    .filter((o) => {
      const estado = getEstadoPresupuesto(o);
      const matchEstado = filtroActivo === "Todos" || estado === filtroActivo;
      const term = search.toLowerCase();
      const matchSearch =
        !search ||
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

  // Summary stats
  const totalPresupuestos = filtered.length;
  const pendientes = filtered.filter(
    (o) => !o.presupuestoConfirmadoPorCliente
  ).length;
  const aprobados = filtered.filter(
    (o) => o.presupuestoConfirmadoPorCliente
  ).length;
  const montoTotal = filtered.reduce(
    (acc, o) => acc + (totalesMap[o.id!] || 0),
    0
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-5 p-2">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-1 min-w-[300px]">
            <h1 className="text-2xl font-bold">Presupuestos</h1>
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                type="text"
                className="input pl-9 h-10 w-full"
                placeholder="Buscar por número, cliente, placa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary h-10"
          >
            <Plus size={18} /> Nuevo Presupuesto
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ background: "rgba(37,99,235,0.12)" }}
            >
              <FileText size={16} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <div className="stat-value">{totalPresupuestos}</div>
              <div className="stat-label">Total</div>
            </div>
          </div>
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ background: "rgba(245,158,11,0.12)" }}
            >
              <Clock size={16} style={{ color: "var(--warning)" }} />
            </div>
            <div>
              <div className="stat-value">{pendientes}</div>
              <div className="stat-label">Pendientes</div>
            </div>
          </div>
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ background: "rgba(16,185,129,0.12)" }}
            >
              <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
            </div>
            <div>
              <div className="stat-value">{aprobados}</div>
              <div className="stat-label">Aprobados</div>
            </div>
          </div>
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ background: "rgba(139,92,246,0.12)" }}
            >
              <DollarSign size={16} style={{ color: "#8b5cf6" }} />
            </div>
            <div>
              <div className="stat-value">${montoTotal.toFixed(2)}</div>
              <div className="stat-label">Monto total</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-sm font-medium text-[var(--text-muted)] mr-2">
            {filtered.length} presupuestos
          </span>
          {FILTROS.map((f) => (
            <button
              key={f}
              onClick={() => setFiltroActivo(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                filtroActivo === f
                  ? "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-[var(--accent)]" />
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="text-center py-16"
              style={{ color: "var(--text-muted)" }}
            >
              <FileCheck
                size={40}
                className="mx-auto mb-3 opacity-20"
              />
              <p>No se encontraron presupuestos</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                    <th>N° PRESUP.</th>
                    <th>FECHA</th>
                    <th>CLIENTE</th>
                    <th>VEHÍCULO</th>
                    <th>PLACA</th>
                    <th className="text-right">MONTO</th>
                    <th className="text-center">ESTADO</th>
                    <th className="w-12 text-right">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => {
                    const estado = getEstadoPresupuesto(o);
                    const total = totalesMap[o.id!] || 0;
                    return (
                      <tr
                        key={o.id}
                        className="hover:bg-[var(--bg-hover)] group cursor-pointer"
                        onClick={() =>
                          router.push(`/presupuestos/${o.id}`)
                        }
                      >
                        <td>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            #PRE-
                            {String(
                              o.numeroCotizacion ?? o.numero ?? 0
                            ).padStart(4, "0")}
                          </span>
                        </td>
                        <td className="text-sm text-[var(--text-secondary)]">
                          {toDate(o.createdAt)
                            ? format(toDate(o.createdAt)!, "dd-MMM-yy", {
                                locale: es,
                              })
                            : "—"}
                        </td>
                        <td className="font-semibold text-[var(--text-primary)]">
                          {o.cliente?.nombre} {o.cliente?.apellido}
                        </td>
                        <td className="text-[var(--text-secondary)]">
                          {o.vehiculo?.marca} {o.vehiculo?.modelo}{" "}
                          {o.vehiculo?.anio}
                        </td>
                        <td>
                          <span className="font-mono text-sm font-medium">
                            {o.vehiculo?.placa ?? "—"}
                          </span>
                        </td>
                        <td className="text-right font-semibold">
                          {total > 0 ? (
                            <span>${total.toFixed(2)}</span>
                          ) : (
                            <span className="text-[var(--text-muted)]">
                              —
                            </span>
                          )}
                        </td>
                        <td className="text-center">
                          {estado === "Aprobado" ? (
                            <span className="badge badge-green">
                              Aprobado
                            </span>
                          ) : (
                            <span className="badge badge-yellow">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          <div className="relative inline-flex">
                            <button
                              type="button"
                              className="btn-ghost btn-icon h-8 w-8"
                              title="Acciones"
                              aria-label="Acciones del presupuesto"
                              aria-expanded={openMenu?.id === o.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                const orderId = o.id;
                                if (!orderId) return;
                                const rect =
                                  event.currentTarget.getBoundingClientRect();
                                setOpenMenu((current) =>
                                  current?.id === orderId
                                    ? null
                                    : {
                                        id: orderId,
                                        top: rect.bottom + 4,
                                        left: Math.min(
                                          window.innerWidth - 152,
                                          Math.max(
                                            8,
                                            rect.right - 144
                                          )
                                        ),
                                      }
                                );
                              }}
                            >
                              {deletingId === o.id ? (
                                <Loader2
                                  size={15}
                                  className="animate-spin"
                                />
                              ) : (
                                <MoreVertical size={16} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {openMenu ? (
        <div
          className="fixed z-[1200] w-36 rounded-md border border-[var(--border)] bg-[var(--bg-card)] p-1 shadow-xl"
          style={{ top: openMenu.top, left: openMenu.left }}
          onClick={(event) => event.stopPropagation()}
        >
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
      ) : null}

      {showModal && (
        <ModalNuevoIngreso
          onClose={() => setShowModal(false)}
          tipoMode="presupuesto"
        />
      )}
    </AppShell>
  );
}
