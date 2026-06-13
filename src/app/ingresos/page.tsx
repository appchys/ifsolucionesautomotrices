"use client";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { subscribeOrdenes, getClientes, getVehiculos } from "@/lib/services";
import { OrdenTrabajo, Cliente, Vehiculo } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Settings, Download } from "lucide-react";
import ModalNuevoIngreso from "@/components/recepcion/ModalNuevoIngreso";
import Link from "next/link";

const FILTROS = ["Todos", "Recibidos", "Inspeccionados", "Presupuestados", "Con Orden"] as const;
type FiltroIngreso = typeof FILTROS[number];

const getNumeroDocumento = (orden: OrdenTrabajo) => orden.numero;

function toDate(value: OrdenTrabajo["createdAt"]): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const maybeTimestamp = value as { toDate?: () => Date };
  return typeof maybeTimestamp.toDate === "function" ? maybeTimestamp.toDate() : null;
}

export default function IngresosPage() {
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, Cliente>>({});
  const [vehiculosMap, setVehiculosMap] = useState<Record<string, Vehiculo>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroActivo, setFiltroActivo] = useState<FiltroIngreso>("Todos");
  const [showModal, setShowModal] = useState(false);
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
        // En una app real filtraríamos por tipo o estado si es necesario
        // Por ahora cargamos las órdenes asumiendo que representan "Ingresos"
        setOrdenes(data);
        setLoading(false);
      },
      (err) => {
        console.error("Error cargando ordenes", err);
        setLoading(false);
      }
    );
    return () => {
      window.clearTimeout(timer);
      unsub();
    };
  }, [loadRelations]);

  const ordenesConDetalle = ordenes.map(o => ({
    ...o,
    cliente: clientesMap[o.clienteId] || o.cliente,
    vehiculo: vehiculosMap[o.vehiculoId] || o.vehiculo
  }));

  const filtered = ordenesConDetalle.filter((o) => {
    // Lógica básica de filtrado según captura
    const matchEstado = filtroActivo === "Todos" ? true : o.estado === filtroActivo;
    const term = search.toLowerCase();
    const matchSearch =
      !search ||
      o.vehiculo?.placa?.toLowerCase().includes(term) ||
      o.cliente?.nombre?.toLowerCase().includes(term) ||
      o.cliente?.apellido?.toLowerCase().includes(term) ||
      String(getNumeroDocumento(o) ?? "").includes(term);
    return matchEstado && matchSearch;
  });

  return (
    <AppShell>
      <div className="flex flex-col gap-6 p-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-1 min-w-[300px]">
            <h1 className="text-2xl font-bold">Ingresos a Taller</h1>
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                className="input pl-9 h-10 w-full"
                placeholder="Buscar por número, cliente, CI / RUC..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="btn btn-outline h-10">
              <Download size={16} /> Exportar
            </button>
            <button className="btn-icon h-10 w-10 border border-[var(--border)] rounded-xl">
              <Settings size={18} />
            </button>
            <button onClick={() => setShowModal(true)} className="btn-primary h-10">
              <Plus size={18} /> Nuevo Ingreso
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-sm font-medium text-[var(--text-muted)] mr-2">{filtered.length} ingresos</span>
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
              {f === "Todos" ? "" : <span className="inline-block w-2 h-2 rounded-full mr-2 opacity-70 bg-current"></span>}
              {f}
            </button>
          ))}
        </div>

        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[var(--accent)]" /></div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                    <th>N° INGRESO</th>
                    <th>FECHA</th>
                    <th>CLIENTE</th>
                    <th>VEHÍCULO</th>
                    <th>PLACA</th>
                    <th className="text-center">INSP.</th>
                    <th className="text-center">PRES.</th>
                    <th className="text-center">ORDEN</th>
                    <th className="text-right">ESTADO</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id} className="hover:bg-[var(--bg-hover)] group cursor-pointer" onClick={() => router.push(`/ingresos/${o.id}`)}>
                      <td>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          #ING-{String(getNumeroDocumento(o) ?? 0).padStart(5, "0")}
                        </span>
                      </td>
                      <td className="text-sm text-[var(--text-secondary)]">
                        {toDate(o.createdAt) ? format(toDate(o.createdAt)!, "dd-MMM", { locale: es }) : "—"}
                      </td>
                      <td className="font-semibold text-[var(--text-primary)]">
                        {o.cliente?.nombre} {o.cliente?.apellido}
                      </td>
                      <td className="text-[var(--text-secondary)]">
                        {o.vehiculo?.marca} {o.vehiculo?.modelo} {o.vehiculo?.anio}
                      </td>
                      <td>
                        <span className="font-mono text-sm font-medium">{o.vehiculo?.placa ?? "—"}</span>
                      </td>
                      <td className="text-center">
                        <div className="w-4 h-4 rounded-full border-2 mx-auto border-gray-300 dark:border-gray-600"></div>
                      </td>
                      <td className="text-center">
                        <div className="w-4 h-4 rounded-full border-2 mx-auto border-gray-300 dark:border-gray-600"></div>
                      </td>
                      <td className="text-center">
                        <div className="w-4 h-4 rounded-full border-2 mx-auto border-gray-300 dark:border-gray-600"></div>
                      </td>
                      <td className="text-right">
                        <span className="badge bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                          Recibido
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-[var(--text-muted)]">
                        No se encontraron ingresos
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && <ModalNuevoIngreso onClose={() => setShowModal(false)} />}
    </AppShell>
  );
}
