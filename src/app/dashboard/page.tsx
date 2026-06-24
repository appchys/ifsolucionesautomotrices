"use client";

import { useEffect, useState, Fragment } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRight, Car, ClipboardList, Plus, Users, Wrench } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { getDashboardStats, subscribeIngresosRecientes, type DashboardStats } from "@/lib/services";
import { OrdenTrabajo } from "@/types";

const ModalNuevoIngreso = dynamic(() => import("@/components/recepcion/ModalNuevoIngreso"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[var(--bg-card)] rounded-2xl w-full max-w-lg shadow-xl p-8 flex justify-center">
        <div className="spinner" />
      </div>
    </div>
  ),
});

const EMPTY_STATS: DashboardStats = {
  ingresos: 0,
  ingresosPendientes: 0,
  ordenesActivas: 0,
  ordenesFinalizadas: 0,
  clientes: 0,
  vehiculos: 0,
};

function toDate(value: OrdenTrabajo["createdAt"]): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const maybeTimestamp = value as { toDate?: () => Date };
  return typeof maybeTimestamp.toDate === "function" ? maybeTimestamp.toDate() : null;
}

function hasInspeccion(orden: OrdenTrabajo) {
  return (
    (orden.inspeccionVisual?.danos?.length || 0) > 0 ||
    (orden.fotosDiagnostico?.length || 0) > 0 ||
    (orden.fotoUrls?.length || 0) > 0 ||
    (orden.notasInternas?.length || 0) > 0 ||
    (orden.informeTecnico?.length || 0) > 0
  );
}

export default function DashboardPage() {
  const [recientes, setRecientes] = useState<OrdenTrabajo[]>([]);
  const [statsData, setStatsData] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [showNuevoIngreso, setShowNuevoIngreso] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    void getDashboardStats()
      .then((data) => {
        if (mounted) setStatsData(data);
      })
      .catch((err) => {
        console.error("Error cargando metricas del dashboard", err);
      });

    const unsub = subscribeIngresosRecientes(
      (data) => {
        if (!mounted) return;
        setRecientes(data);
        setLoading(false);
      },
      (err) => {
        console.error("Error cargando ingresos recientes", err);
        if (mounted) setLoading(false);
      }
    );

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const grupos: { [key: string]: OrdenTrabajo[] } = {};
  recientes.forEach((orden) => {
    const date = toDate(orden.createdAt);
    const key = date ? format(date, "yyyy-MM-dd") : "Sin fecha";
    if (!grupos[key]) {
      grupos[key] = [];
    }
    grupos[key].push(orden);
  });

  const keysOrdenadas = Object.keys(grupos).sort((a, b) => b.localeCompare(a));

  const stats = [
    {
      label: "Ingresos",
      value: statsData.ingresos,
      icon: ClipboardList,
      color: "#2563eb",
      bg: "rgba(37,99,235,0.12)",
      trend: `${statsData.ingresosPendientes} pendientes`,
    },
    {
      label: "Ordenes Activas",
      value: statsData.ordenesActivas,
      icon: Wrench,
      color: "#a78bfa",
      bg: "rgba(139,92,246,0.12)",
      trend: `${statsData.ordenesFinalizadas} entregadas`,
    },
    {
      label: "Clientes",
      value: statsData.clientes,
      icon: Users,
      color: "#10b981",
      bg: "rgba(16,185,129,0.12)",
      trend: "registrados",
    },
    {
      label: "Vehiculos",
      value: statsData.vehiculos,
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-icon" style={{ background: stat.bg }}>
              <stat.icon size={22} style={{ color: stat.color }} />
            </div>
            <div>
              <div className="stat-value">{loading ? "-" : stat.value}</div>
              <div className="stat-label">{stat.label}</div>
              <div className="stat-trend" style={{ color: stat.color }}>{stat.trend}</div>
            </div>
          </div>
        ))}
      </div>

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
            <p className="text-sm">No hay ingresos aun</p>
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
                  <th>N. Ingreso</th>
                  <th>Cliente</th>
                  <th className="hidden md:table-cell">Vehiculo</th>
                  <th className="hidden md:table-cell">Placa</th>
                  <th className="text-center hidden sm:table-cell">Insp.</th>
                  <th className="text-center hidden sm:table-cell">Pres.</th>
                  <th className="text-center hidden sm:table-cell">Orden</th>
                  <th className="text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {keysOrdenadas.map((key) => {
                  const ordenesGrupo = grupos[key];
                  let labelFecha = key;
                  if (key !== "Sin fecha") {
                    const dateObj = new Date(key + "T00:00:00");
                    const hoy = format(new Date(), "yyyy-MM-dd");
                    const ayer = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
                    if (key === hoy) {
                      labelFecha = "Hoy";
                    } else if (key === ayer) {
                      labelFecha = "Ayer";
                    } else {
                      labelFecha = format(dateObj, "EEEE, d 'de' MMMM", { locale: es });
                      labelFecha = labelFecha.charAt(0).toUpperCase() + labelFecha.slice(1);
                    }
                  }

                  return (
                    <Fragment key={key}>
                      <tr className="bg-[var(--bg-hover)]/30 border-y border-[var(--border-color)]">
                        <td colSpan={8} className="py-2 px-4 text-xs font-semibold text-[var(--text-secondary)]">
                          {labelFecha}
                        </td>
                      </tr>
                      {ordenesGrupo.map((orden) => {
                        const inspeccionOk = hasInspeccion(orden);
                        const tienePresupuesto = Boolean(orden.presupuestoConfirmadoPorCliente);
                        const tieneOrden = !!orden.numeroOrden;
                        const numeroIngreso = orden.numeroIngreso ?? orden.numero;

                        return (
                          <tr
                            key={orden.id}
                            onClick={() => router.push(`/ingresos/${orden.id}`)}
                            className="cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                          >
                            <td>
                              <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                                #ING-{String(numeroIngreso ?? 0).padStart(5, "0")}
                              </span>
                            </td>
                            <td style={{ color: "var(--text-primary)" }}>
                              {orden.cliente ? `${orden.cliente.nombre} ${orden.cliente.apellido}` : "-"}
                            </td>
                            <td className="hidden md:table-cell text-[var(--text-secondary)]">
                              {orden.vehiculo ? `${orden.vehiculo.marca} ${orden.vehiculo.modelo}` : "-"}
                            </td>
                            <td className="hidden md:table-cell">
                              <span className="font-mono text-sm font-medium">{orden.vehiculo?.placa ?? "-"}</span>
                            </td>
                            <td className="text-center hidden sm:table-cell">
                              <div className={`w-4 h-4 rounded-full border-2 mx-auto ${
                                inspeccionOk ? "bg-green-500 border-green-500" : "border-gray-300 dark:border-gray-600"
                              }`} />
                            </td>
                            <td className="text-center hidden sm:table-cell">
                              <div className={`w-4 h-4 rounded-full border-2 mx-auto ${
                                tienePresupuesto ? "bg-green-500 border-green-500" : "border-gray-300 dark:border-gray-600"
                              }`} />
                            </td>
                            <td className="text-center hidden sm:table-cell">
                              <div className={`w-4 h-4 rounded-full border-2 mx-auto ${
                                tieneOrden ? "bg-green-500 border-green-500" : "border-gray-300 dark:border-gray-600"
                              }`} />
                            </td>
                            <td className="text-right">
                              {tieneOrden ? (
                                <span className="badge bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                                  ORD-{String(orden.numeroOrden).padStart(5, "0")}
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
                    </Fragment>
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
