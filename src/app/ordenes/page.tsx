"use client";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { deleteOrden, subscribeOrdenes, updateEstadoOrden, getClientes, getVehiculos } from "@/lib/services";
import { OrdenTrabajo, EstadoOrden, Cliente, Vehiculo } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { Loader2, MoreVertical, Plus, Search, Trash2, Wrench } from "lucide-react";
import { toast } from "react-hot-toast";
import NuevaOrdenSidebar from "@/components/recepcion/NuevaOrdenSidebar";

const ESTADOS: EstadoOrden[] = ["Ingreso", "Proceso", "Finalizado", "Entregado"];
type MenuPosition = { id: string; top: number; left: number };

const getNumeroDocumento = (orden: OrdenTrabajo) =>
  orden.esCotizacion ? orden.numeroCotizacion ?? orden.numero : orden.numero;

function toDate(value: OrdenTrabajo["createdAt"]): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const maybeTimestamp = value as { toDate?: () => Date };
  return typeof maybeTimestamp.toDate === "function" ? maybeTimestamp.toDate() : null;
}

export default function OrdenesPage() {
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, Cliente>>({});
  const [vehiculosMap, setVehiculosMap] = useState<Record<string, Vehiculo>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoOrden | "Todos">("Todos");
  const [showNuevaOrden, setShowNuevaOrden] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<MenuPosition | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const router = useRouter();

  const loadRelations = useCallback(async () => {
    try {
      const [cList, vList] = await Promise.all([getClientes(), getVehiculos()]);
      const cMap: Record<string, Cliente> = {};
      const vMap: Record<string, Vehiculo> = {};
      cList.forEach(c => { if (c.id) cMap[c.id] = c; });
      vList.forEach(v => { if (v.id) vMap[v.id] = v; });
      setClientesMap(cMap);
      setVehiculosMap(vMap);
    } catch (err) {
      console.error("Error cargando clientes y vehiculos", err);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRelations();
    }, 0);
    const unsub = subscribeOrdenes(
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
      window.clearTimeout(timer);
      unsub();
    };
  }, [loadRelations]);

  useEffect(() => {
    if (!openMenu) return;

    const closeMenu = () => setOpenMenu(null);
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, [openMenu]);

  const ordenesConDetalle = ordenes.map(o => ({
    ...o,
    cliente: clientesMap[o.clienteId] || o.cliente,
    vehiculo: vehiculosMap[o.vehiculoId] || o.vehiculo
  }));

  const filtered = ordenesConDetalle.filter((o) => {
    const matchEstado = filtroEstado === "Todos" || o.estado === filtroEstado;
    const term = search.toLowerCase();
    const matchSearch =
      !search ||
      o.vehiculo?.placa?.toLowerCase().includes(term) ||
      o.cliente?.nombre?.toLowerCase().includes(term) ||
      o.cliente?.apellido?.toLowerCase().includes(term) ||
      String(getNumeroDocumento(o) ?? "").includes(term);
    return matchEstado && matchSearch;
  });

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
      void loadRelations();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo eliminar la orden");
    } finally {
      setDeletingOrderId(null);
    }
  };

  return (
    <AppShell>
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Órdenes de Trabajo</h1>
          <p className="page-subtitle">{ordenes.length} órdenes en total</p>
        </div>
        <button onClick={() => setShowNuevaOrden(true)} className="btn-primary">
          <Plus size={16} /> Nueva Orden
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            className="input pl-9"
            placeholder="Buscar por placa, cliente, # orden..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["Todos", ...ESTADOS] as const).map((e) => (
            <button
              key={e}
              onClick={() => setFiltroEstado(e)}
              className="btn btn-sm"
              style={{
                background: filtroEstado === e ? "var(--accent)" : "var(--bg-card)",
                color: filtroEstado === e ? "#fff" : "var(--text-secondary)",
                border: `1px solid ${filtroEstado === e ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              {e}
            </button>
          ))}
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
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th># Orden</th>
                  <th>Cliente</th>
                  <th>Placa</th>
                  <th>Vehículo</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th className="w-12 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr 
                    key={o.id} 
                    onClick={() => setEditingOrderId(o.id!)}
                    className="cursor-pointer hover:bg-[var(--bg-hover)]"
                  >
                    <td>
                      <span className="font-mono font-bold text-sm" style={{ color: "var(--accent-light)" }}>
                        #{String(getNumeroDocumento(o) ?? 0).padStart(4, "0")}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-primary)" }}>
                      {o.cliente?.nombre} {o.cliente?.apellido}
                    </td>
                    <td>
                      <span className="font-mono font-semibold">{o.vehiculo?.placa ?? "—"}</span>
                    </td>
                    <td>{o.vehiculo?.marca} {o.vehiculo?.modelo}</td>
                    <td><span className="badge badge-gray">{o.tipoServicio}</span></td>
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
                    <td className="text-xs">
                      {toDate(o.createdAt)
                        ? format(toDate(o.createdAt)!, "dd/MM/yy", { locale: es })
                        : "—"}
                    </td>
                    <td className="text-right">
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

      {(showNuevaOrden || editingOrderId) && (
        <NuevaOrdenSidebar 
          ordenId={editingOrderId ?? undefined}
          onClose={() => {
            setShowNuevaOrden(false);
            setEditingOrderId(null);
          }} 
          onSuccess={(id) => {
            setShowNuevaOrden(false);
            setEditingOrderId(null);
            void loadRelations();
            if (!editingOrderId) router.push(`/ordenes/detalle?id=${id}`);
          }}
        />
      )}
    </AppShell>
  );
}
