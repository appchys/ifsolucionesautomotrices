"use client";
import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  ClipboardList, Users, Car,
  Wrench, Plus, ArrowRight, CheckCircle2
} from "lucide-react";
import { subscribeOrdenes, getClientes, getVehiculos } from "@/lib/services";
import { OrdenTrabajo, Cliente, Vehiculo } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import ModalNuevoIngreso from "@/components/recepcion/ModalNuevoIngreso";
import { useRouter } from "next/navigation";

function toDate(value: OrdenTrabajo["createdAt"]): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const maybeTimestamp = value as { toDate?: () => Date };
  return typeof maybeTimestamp.toDate === "function" ? maybeTimestamp.toDate() : null;
}

export default function DashboardPage() {
  const [allDocs, setAllDocs] = useState<OrdenTrabajo[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, Cliente>>({});
  const [vehiculosMap, setVehiculosMap] = useState<Record<string, Vehiculo>>({});
  const [clientesCount, setClientesCount] = useState(0);
  const [vehiculosCount, setVehiculosCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNuevoIngreso, setShowNuevoIngreso] = useState(false);
  const router = useRouter();

  const loadRelations = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRelations(); }, 0);
    const unsub = subscribeOrdenes((data) => {
      setAllDocs(data);
      setLoading(false);
    });
    return () => {
      window.clearTimeout(timer);
      unsub();
    };
  }, [loadRelations]);

  // Derived data — same logic as /ingresos and /ordenes pages
  const ingresos = allDocs.filter(o => !o.esCotizacion && !o.archivado);
  const ordenesActivas = allDocs.filter(o => !!o.numeroOrden && o.estado !== "Entregada" && o.estado !== "Cancelada");
  const ordenesFinalizadas = allDocs.filter(o => o.estado === "Entregada");
  const ingresosPendientes = ingresos.filter(o => (o.estado === "En Diagnóstico" || o.estado === "Borrador") && !o.numeroOrden);

  const hasInspeccion = (o: OrdenTrabajo) => {
    return (
      (o.inspeccionVisual?.danos?.length || 0) > 0 ||
      (o.fotosDiagnostico?.length || 0) > 0 ||
      (o.fotoUrls?.length || 0) > 0 ||
      (o.notasInternas?.length || 0) > 0 ||
      (o.informeTecnico?.length || 0) > 0
    );
  };

  const checkPresupuestoYOrden = (o: OrdenTrabajo) => {
    const derivados = allDocs.filter(
      p => p.vehiculoId === o.vehiculoId &&
      String(p.motivo).includes(String(o.numeroIngreso ?? o.numero))
    );
    const tienePresupuesto = derivados.some(d => d.esCotizacion);
    const tieneOrden = !!o.numeroOrden;
    return { tienePresupuesto, tieneOrden };
  };

  // Recent ingresos — only real ingresos, not cotizaciones
  const recientes = ingresos
    .slice(0, 8)
    .map(o => ({
      ...o,
      cliente: clientesMap[o.clienteId] || o.cliente,
      vehiculo: vehiculosMap[o.vehiculoId] || o.vehiculo,
    }));

  const stats = [
    {
      label: "Ingresos",
      value: ingresos.length,
      icon: ClipboardList,
      color: "#2563eb",
      bg: "rgba(37,99,235,0.12)",
      trend: `${ingresosPendientes.length} pendientes`,
    },
    {
      label: "Órdenes Activas",
      value: ordenesActivas.length,
      icon: Wrench,
      color: "#a78bfa",
      bg: "rgba(139,92,246,0.12)",
      trend: `${ordenesFinalizadas.length} entregadas`,
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
          onClick={() => setShowNuevoIngreso(true)}
          className="btn-primary w-full sm:w-auto justify-center"
        >
          <Plus size={16} />
          Nuevo Ingreso
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

      {/* Recent ingresos table */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Ingresos Recientes</h2>
          <Link href="/ingresos" className="btn-ghost btn-sm">
            Ver todos <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="spinner" />
          </div>
        ) : recientes.length === 0 ? (
          <div className="text-center py-10" style={{ color: "var(--text-muted)" }}>
            <ClipboardList size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay ingresos aún</p>
            <button
              onClick={() => setShowNuevoIngreso(true)}
              className="btn-primary btn-sm mt-3 inline-flex"
            >
              Registrar primer ingreso
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                  <th>N° Ingreso</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th className="hidden md:table-cell">Vehículo</th>
                  <th className="hidden md:table-cell">Placa</th>
                  <th className="text-center hidden sm:table-cell">Insp.</th>
                  <th className="text-center hidden sm:table-cell">Pres.</th>
                  <th className="text-center hidden sm:table-cell">Orden</th>
                  <th className="text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map((o) => {
                  const inspeccionOk = hasInspeccion(o);
                  const { tienePresupuesto, tieneOrden } = checkPresupuestoYOrden(o);
                  const numeroIngreso = o.numeroIngreso ?? o.numero;

                  return (
                    <tr
                      key={o.id}
                      onClick={() => router.push(`/ingresos/${o.id}`)}
                      className="cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <td>
                        <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                          #ING-{String(numeroIngreso ?? 0).padStart(5, "0")}
                        </span>
                      </td>
                      <td className="text-sm text-[var(--text-secondary)]">
                        {toDate(o.createdAt)
                          ? format(toDate(o.createdAt)!, "dd-MMM", { locale: es })
                          : "—"}
                      </td>
                      <td style={{ color: "var(--text-primary)" }}>
                        {o.cliente ? `${o.cliente.nombre} ${o.cliente.apellido}` : "—"}
                      </td>
                      <td className="hidden md:table-cell text-[var(--text-secondary)]">
                        {o.vehiculo ? `${o.vehiculo.marca} ${o.vehiculo.modelo}` : "—"}
                      </td>
                      <td className="hidden md:table-cell">
                        <span className="font-mono text-sm font-medium">{o.vehiculo?.placa ?? "—"}</span>
                      </td>
                      <td className="text-center hidden sm:table-cell">
                        <div className={`w-4 h-4 rounded-full border-2 mx-auto ${
                          inspeccionOk ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'
                        }`}></div>
                      </td>
                      <td className="text-center hidden sm:table-cell">
                        <div className={`w-4 h-4 rounded-full border-2 mx-auto ${
                          tienePresupuesto ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'
                        }`}></div>
                      </td>
                      <td className="text-center hidden sm:table-cell">
                        <div className={`w-4 h-4 rounded-full border-2 mx-auto ${
                          tieneOrden ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'
                        }`}></div>
                      </td>
                      <td className="text-right">
                        {tieneOrden ? (
                          <span className="badge bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                            ORD-{String(o.numeroOrden).padStart(5, "0")}
                          </span>
                        ) : (
                          <span className="badge bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            Recibido
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNuevoIngreso && <ModalNuevoIngreso onClose={() => setShowNuevoIngreso(false)} />}
    </AppShell>
  );
}
