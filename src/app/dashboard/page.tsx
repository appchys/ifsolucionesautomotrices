"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  ClipboardList, Users, Car,
  Clock, CheckCircle2, Truck, Wrench, AlertCircle, Plus
} from "lucide-react";
import { subscribeOrdenes, getClientes, getVehiculos } from "@/lib/services";
import { OrdenTrabajo, EstadoOrden, Cliente, Vehiculo } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import NuevaOrdenSidebar from "@/components/recepcion/NuevaOrdenSidebar";
import { useRouter } from "next/navigation";

const ESTADO_CONFIG: Record<EstadoOrden, { label: string; badge: string; icon: React.ElementType }> = {
  Ingreso: { label: "Ingreso", badge: "status-ingreso", icon: Clock },
  Proceso: { label: "En Proceso", badge: "status-proceso", icon: Wrench },
  Finalizado: { label: "Finalizado", badge: "status-finalizado", icon: CheckCircle2 },
  Entregado: { label: "Entregado", badge: "status-entregado", icon: Truck },
};

const getNumeroDocumento = (orden: OrdenTrabajo) =>
  orden.esCotizacion ? orden.numeroCotizacion ?? orden.numero : orden.numero;

function toDate(value: OrdenTrabajo["createdAt"]): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const maybeTimestamp = value as { toDate?: () => Date };
  return typeof maybeTimestamp.toDate === "function" ? maybeTimestamp.toDate() : null;
}

export default function DashboardPage() {
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, Cliente>>({});
  const [vehiculosMap, setVehiculosMap] = useState<Record<string, Vehiculo>>({});
  const [clientesCount, setClientesCount] = useState(0);
  const [vehiculosCount, setVehiculosCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNuevaOrden, setShowNuevaOrden] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadMaps = async () => {
      try {
        const [cList, vList] = await Promise.all([getClientes(), getVehiculos()]);
        setClientesCount(cList.length);
        setVehiculosCount(vList.length);
        
        const cMap: Record<string, Cliente> = {};
        const vMap: Record<string, Vehiculo> = {};
        cList.forEach(c => { if (c.id) cMap[c.id] = c; });
        vList.forEach(v => { if (v.id) vMap[v.id] = v; });
        setClientesMap(cMap);
        setVehiculosMap(vMap);
      } catch (err) {
        console.error("Error cargando datos del dashboard", err);
      }
    };

    loadMaps();
    const unsub = subscribeOrdenes((data) => {
      setOrdenes(data);
      setLoading(false);
    });
    
    return () => unsub();
  }, []);

  const byEstado = (estado: EstadoOrden) => ordenes.filter((o) => o.estado === estado).length;
  
  const recientes = ordenes.slice(0, 6).map(o => ({
    ...o,
    cliente: clientesMap[o.clienteId] || o.cliente,
    vehiculo: vehiculosMap[o.vehiculoId] || o.vehiculo
  }));

  const stats = [
    {
      label: "Total Órdenes",
      value: ordenes.length,
      icon: ClipboardList,
      color: "#2563eb",
      bg: "rgba(37,99,235,0.12)",
      trend: `${byEstado("Proceso")} activas`,
    },
    {
      label: "Clientes",
      value: clientesCount,
      icon: Users,
      color: "#10b981",
      bg: "rgba(16,185,129,0.12)",
      trend: "registrados",
    },
    {
      label: "Vehículos",
      value: vehiculosCount,
      icon: Car,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.12)",
      trend: "en sistema",
    },
    {
      label: "En Proceso",
      value: byEstado("Proceso"),
      icon: Wrench,
      color: "#a78bfa",
      bg: "rgba(139,92,246,0.12)",
      trend: "actualmente",
    },
  ];

  return (
    <AppShell>
      <div className="page-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <button 
          onClick={() => setShowNuevaOrden(true)} 
          className="btn-primary w-full sm:w-auto justify-center"
        >
          <Plus size={16} />
          Nueva Orden
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg }}>
              <s.icon size={22} style={{ color: s.color }} />
            </div>
            <div>
              <div className="stat-value">{loading ? "—" : s.value}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-trend" style={{ color: s.color }}>{s.trend}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent orders table */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Órdenes Recientes</h2>
          <Link href="/ordenes" className="btn-ghost btn-sm">Ver todas</Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="spinner" />
          </div>
        ) : recientes.length === 0 ? (
          <div className="text-center py-10" style={{ color: "var(--text-muted)" }}>
            <AlertCircle size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay órdenes aún</p>
            <button 
              onClick={() => setShowNuevaOrden(true)} 
              className="btn-primary btn-sm mt-3 inline-flex"
            >
              Crear primera orden
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th># Orden</th>
                  <th>Cliente</th>
                  <th className="hidden md:table-cell">Vehículo</th>
                  <th className="hidden lg:table-cell">Tipo</th>
                  <th>Estado</th>
                  <th className="hidden sm:table-cell">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map((o) => {
                  const cfg = ESTADO_CONFIG[o.estado];
                  return (
                    <tr 
                      key={o.id} 
                      onClick={() => setEditingOrderId(o.id!)}
                      className="cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <td className="font-mono font-semibold" style={{ color: "var(--accent-light)" }}>
                        #{String(getNumeroDocumento(o) ?? 0).padStart(4, "0")}
                      </td>
                      <td style={{ color: "var(--text-primary)" }}>
                        {o.cliente ? `${o.cliente.nombre} ${o.cliente.apellido}` : "—"}
                      </td>
                      <td className="hidden md:table-cell">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-xs">{o.vehiculo?.placa ?? "—"}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {o.vehiculo ? `${o.vehiculo.marca} ${o.vehiculo.modelo}` : ""}
                          </span>
                        </div>
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className="badge badge-gray">{o.tipoServicio}</span>
                      </td>
                      <td>
                        {o.esCotizacion ? (
                          <span className="badge" style={{ background: "rgba(37,99,235,0.1)", color: "var(--accent)", border: "1px solid var(--accent-alpha)" }}>Cotización</span>
                        ) : (
                          <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
                        )}
                      </td>
                      <td className="text-xs hidden sm:table-cell">
                        {toDate(o.createdAt)
                          ? format(toDate(o.createdAt)!, "dd/MM/yyyy", { locale: es })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
