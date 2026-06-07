"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { subscribeOrdenes, updateEstadoOrden, getClientes, getVehiculos } from "@/lib/services";
import { OrdenTrabajo, EstadoOrden, Cliente, Vehiculo } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { Search, Plus, Wrench } from "lucide-react";
import { toast } from "react-hot-toast";
import OrdenDetalleSidebar from "@/components/ordenes/OrdenDetalleSidebar";
import NuevaOrdenSidebar from "@/components/recepcion/NuevaOrdenSidebar";

const ESTADOS: EstadoOrden[] = ["Ingreso", "Proceso", "Finalizado", "Entregado"];

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
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showNuevaOrden, setShowNuevaOrden] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadMaps = async () => {
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
    };
    loadMaps();
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
    return () => unsub();
  }, []);

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
      String(o.numero).includes(term);
    return matchEstado && matchSearch;
  });

  const cambiarEstado = async (id: string, estado: EstadoOrden) => {
    await updateEstadoOrden(id, estado);
    toast.success(`Estado actualizado: ${estado}`);
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
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr 
                    key={o.id} 
                    onClick={() => setSelectedOrderId(o.id!)}
                    className="cursor-pointer hover:bg-[var(--bg-hover)]"
                  >
                    <td>
                      <span className="font-mono font-bold text-sm" style={{ color: "var(--accent-light)" }}>
                        #{String(o.numero ?? 0).padStart(4, "0")}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedOrderId && (
        <OrdenDetalleSidebar 
          ordenId={selectedOrderId} 
          onClose={() => setSelectedOrderId(null)} 
          onEdit={(id) => {
            setSelectedOrderId(null);
            setEditingOrderId(id);
          }}
        />
      )}

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
            if (!editingOrderId) router.push(`/ordenes/detalle?id=${id}`);
          }}
        />
      )}
    </AppShell>
  );
}
