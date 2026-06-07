"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { getCompras, getDevoluciones, getDevolucionesProveedor, getTodosPagos } from "@/lib/services";
import type { Compra, CompraMetodoPago, Devolucion, DevolucionProveedor, MetodoDevolucion, MetodoDevolucionProveedor, MetodoPago, Pago } from "@/types";
import { BANCOS_TRANSFERENCIA, normalizeBancoTransferencia } from "@/lib/paymentBanks";
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  BarChart3,
  Landmark,
  Loader2,
  ReceiptText,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";

type VistaReporte = "cobros" | "pagos" | "devoluciones" | "devoluciones-proveedor";

type Agrupado = {
  label: string;
  cantidad: number;
  total: number;
};

type MovimientoReporte = {
  id: string;
  fecha: Date | null;
  metodo: MetodoPago | CompraMetodoPago | MetodoDevolucion | MetodoDevolucionProveedor;
  metodoLabel: string;
  banco: string;
  referencia: string;
  notas: string;
  monto: number;
  entidad: string;
  documento: string;
};

const COBRO_METODO_LABELS: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  tarjeta_credito: "Tarjeta de credito",
  tarjeta_debito: "Tarjeta de debito",
  otro: "Otro",
};

const PAGO_METODO_LABELS: Record<CompraMetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta_debito: "Tarjeta de debito",
  nota_credito: "Nota de credito",
  otro: "Otro",
};

const DEVOLUCION_METODO_LABELS: Record<MetodoDevolucion, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  credito_cliente: "Credito cliente",
  nota_credito: "Nota de credito",
  otro: "Otro",
};

const DEVOLUCION_ACCION_LABELS: Record<Devolucion["accionInventario"], string> = {
  reingresar_stock: "Reingresa a stock",
  merma: "Merma",
  garantia_proveedor: "Garantia proveedor",
  sin_reingreso: "Sin reingreso",
};

const DEVOLUCION_PROVEEDOR_METODO_LABELS: Record<MetodoDevolucionProveedor, string> = {
  nota_credito: "Nota de credito",
  transferencia: "Transferencia",
  reembolso: "Reembolso",
  descuento_pendiente: "Descuento pendiente",
  sin_credito: "Sin credito",
};

function addToGroup(groups: Record<string, Agrupado>, key: string, monto: number) {
  if (!groups[key]) groups[key] = { label: key, cantidad: 0, total: 0 };
  groups[key].cantidad += 1;
  groups[key].total += monto;
}

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getCompraPagado(compra: Compra) {
  if (typeof compra.totalPagadoProveedor === "number") return compra.totalPagadoProveedor;
  return (compra.pagosProveedor ?? []).reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
}

function getCompraSaldo(compra: Compra) {
  if (typeof compra.saldoProveedor === "number") return compra.saldoProveedor;
  return Math.max(Number(compra.importeTotal || 0) - getCompraPagado(compra) - Number(compra.totalDevueltoProveedor ?? 0), 0);
}

function parseReporteFecha(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function ReporteFinancieroPage() {
  const [cobros, setCobros] = useState<Pago[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [devolucionesProveedor, setDevolucionesProveedor] = useState<DevolucionProveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<VistaReporte>("cobros");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [metodoFiltro, setMetodoFiltro] = useState<string>("todos");
  const [bancoFiltro, setBancoFiltro] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [pagosOrdenes, comprasRegistradas, devolucionesRegistradas, devolucionesProveedorRegistradas] = await Promise.all([
        getTodosPagos(),
        getCompras(),
        getDevoluciones(),
        getDevolucionesProveedor(),
      ]);
      setCobros(pagosOrdenes);
      setCompras(comprasRegistradas);
      setDevoluciones(devolucionesRegistradas);
      setDevolucionesProveedor(devolucionesProveedorRegistradas);
    } catch {
      toast.error("No se pudo cargar el reporte financiero");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const movimientosCobros = useMemo<MovimientoReporte[]>(
    () =>
      cobros.map((pago) => {
        const banco = pago.metodoPago === "transferencia" ? normalizeBancoTransferencia(pago.banco) : "";
        return {
          id: pago.id ?? `${pago.ordenId}-${pago.monto}-${pago.referencia ?? ""}`,
          fecha: parseReporteFecha(pago.createdAt),
          metodo: pago.metodoPago,
          metodoLabel: COBRO_METODO_LABELS[pago.metodoPago] ?? pago.metodoPago,
          banco,
          referencia: pago.referencia ?? "",
          notas: pago.notas ?? "",
          monto: pago.monto,
          entidad: "Orden de trabajo",
          documento: pago.ordenId,
        };
      }),
    [cobros]
  );

  const movimientosPagos = useMemo<MovimientoReporte[]>(
    () =>
      compras.flatMap((compra) =>
        (compra.pagosProveedor ?? []).map((pago, index) => {
          const banco = pago.metodoPago === "transferencia" ? normalizeBancoTransferencia(pago.banco) : "";
          return {
            id: `${compra.id ?? compra.claveAcceso}-${index}`,
            fecha: parseReporteFecha(pago.fecha) ?? parseReporteFecha(pago.createdAt) ?? parseReporteFecha(compra.createdAt),
            metodo: pago.metodoPago,
            metodoLabel: PAGO_METODO_LABELS[pago.metodoPago] ?? pago.metodoPago,
            banco,
            referencia: pago.referencia ?? "",
            notas: pago.notas ?? "",
            monto: pago.monto,
            entidad: compra.proveedorRazonSocial,
            documento: compra.numeroFactura,
          };
        })
      ),
    [compras]
  );

  const movimientosDevoluciones = useMemo<MovimientoReporte[]>(
    () =>
      devoluciones.map((devolucion) => ({
        id: devolucion.id ?? `${devolucion.ordenId}-${devolucion.itemOrdenId}-${devolucion.cantidad}`,
        fecha: parseReporteFecha(devolucion.createdAt),
        metodo: devolucion.metodoDevolucion ?? "otro",
        metodoLabel: DEVOLUCION_METODO_LABELS[devolucion.metodoDevolucion ?? "otro"],
        banco: DEVOLUCION_ACCION_LABELS[devolucion.accionInventario] ?? devolucion.accionInventario,
        referencia: [devolucion.motivo, devolucion.notas].filter(Boolean).join(" - "),
        notas: devolucion.notas ?? "",
        monto: devolucion.montoDevuelto,
        entidad: [devolucion.clienteNombre || "Cliente sin nombre", devolucion.productoNombre].filter(Boolean).join(" - "),
        documento: `Orden #${String(devolucion.numeroOrden ?? 0).padStart(4, "0")}`,
      })),
    [devoluciones]
  );

  const movimientosDevolucionesProveedor = useMemo<MovimientoReporte[]>(
    () =>
      devolucionesProveedor.map((devolucion) => ({
        id: devolucion.id ?? `${devolucion.compraId}-${devolucion.itemIndex}-${devolucion.cantidad}`,
        fecha: parseReporteFecha(devolucion.createdAt),
        metodo: devolucion.metodoDevolucion,
        metodoLabel: DEVOLUCION_PROVEEDOR_METODO_LABELS[devolucion.metodoDevolucion] ?? devolucion.metodoDevolucion,
        banco: devolucion.banco ? normalizeBancoTransferencia(devolucion.banco) : devolucion.ajustoInventario ? "Stock descontado" : "Sin ajuste",
        referencia: [devolucion.motivo, devolucion.referencia, devolucion.notas].filter(Boolean).join(" - "),
        notas: devolucion.notas ?? "",
        monto: devolucion.subtotalDevuelto,
        entidad: [devolucion.proveedorRazonSocial || "Proveedor sin nombre", devolucion.productoNombre].filter(Boolean).join(" - "),
        documento: devolucion.numeroFactura,
      })),
    [devolucionesProveedor]
  );

  const movimientosBase =
    vista === "cobros"
      ? movimientosCobros
      : vista === "pagos"
        ? movimientosPagos
        : vista === "devoluciones"
          ? movimientosDevoluciones
          : movimientosDevolucionesProveedor;
  const metodoLabels =
    vista === "cobros"
      ? COBRO_METODO_LABELS
      : vista === "pagos"
        ? PAGO_METODO_LABELS
        : vista === "devoluciones"
          ? DEVOLUCION_METODO_LABELS
          : DEVOLUCION_PROVEEDOR_METODO_LABELS;

  const bancosDisponibles = useMemo(() => {
    const bancos = movimientosBase.filter((movimiento) => movimiento.banco).map((movimiento) => movimiento.banco);
    return Array.from(new Set([...BANCOS_TRANSFERENCIA, ...bancos])).sort();
  }, [movimientosBase]);

  const movimientosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    const desde = fechaDesde ? new Date(`${fechaDesde}T00:00:00`) : null;
    const hasta = fechaHasta ? new Date(`${fechaHasta}T23:59:59`) : null;

    return movimientosBase.filter((movimiento) => {
      const searchable = [
        movimiento.metodoLabel,
        movimiento.banco,
        movimiento.referencia,
        movimiento.notas,
        movimiento.entidad,
        movimiento.documento,
        movimiento.monto.toFixed(2),
        movimiento.fecha ? format(movimiento.fecha, "dd/MM/yyyy HH:mm") : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !term || searchable.includes(term);
      const matchesMetodo = metodoFiltro === "todos" || movimiento.metodo === metodoFiltro;
      const matchesBanco = bancoFiltro === "todos" || movimiento.banco === bancoFiltro;
      const matchesDesde = !desde || (movimiento.fecha && movimiento.fecha >= desde);
      const matchesHasta = !hasta || (movimiento.fecha && movimiento.fecha <= hasta);

      return matchesSearch && matchesMetodo && matchesBanco && matchesDesde && matchesHasta;
    });
  }, [bancoFiltro, fechaDesde, fechaHasta, metodoFiltro, movimientosBase, search]);

  const facturasComprasFiltradas = useMemo(() => {
    const term = search.trim().toLowerCase();
    return compras.filter((compra) => {
      const searchable = [
        compra.proveedorRazonSocial,
        compra.proveedorRuc,
        compra.numeroFactura,
                      compra.fechaEmision,
                      compra.importeTotal.toFixed(2),
                      getCompraPagado(compra).toFixed(2),
                      Number(compra.totalDevueltoProveedor ?? 0).toFixed(2),
                      getCompraSaldo(compra).toFixed(2),
      ]
        .join(" ")
        .toLowerCase();
      return !term || searchable.includes(term);
    });
  }, [compras, search]);

  const hasFilters =
    search.trim() ||
    metodoFiltro !== "todos" ||
    bancoFiltro !== "todos" ||
    fechaDesde ||
    fechaHasta;

  const resetFilters = () => {
    setSearch("");
    setMetodoFiltro("todos");
    setBancoFiltro("todos");
    setFechaDesde("");
    setFechaHasta("");
  };

  const changeVista = (next: VistaReporte) => {
    setVista(next);
    setMetodoFiltro("todos");
    setBancoFiltro("todos");
  };

  const porMetodo = movimientosFiltrados.reduce<Record<string, Agrupado>>((acc, movimiento) => {
    addToGroup(acc, movimiento.metodoLabel, movimiento.monto);
    return acc;
  }, {});

  const porBanco = movimientosFiltrados.reduce<Record<string, Agrupado>>((acc, movimiento) => {
    if (!movimiento.banco) return acc;
    addToGroup(acc, movimiento.banco, movimiento.monto);
    return acc;
  }, {});

  const totalCobrado = movimientosCobros.reduce((sum, movimiento) => sum + movimiento.monto, 0);
  const totalPagado = movimientosPagos.reduce((sum, movimiento) => sum + movimiento.monto, 0);
  const totalDevuelto = movimientosDevoluciones.reduce((sum, movimiento) => sum + movimiento.monto, 0);
  const totalDevueltoProveedor = movimientosDevolucionesProveedor.reduce((sum, movimiento) => sum + movimiento.monto, 0);
  const totalComprasFacturado = compras.reduce((sum, compra) => sum + compra.importeTotal, 0);
  const totalComprasPendiente = compras.reduce((sum, compra) => sum + getCompraSaldo(compra), 0);
  const totalVista = movimientosFiltrados.reduce((sum, movimiento) => sum + movimiento.monto, 0);
  const metodos = Object.values(porMetodo).sort((a, b) => b.total - a.total);
  const bancos = Object.values(porBanco).sort((a, b) => b.total - a.total);
  const emptyMessage =
    vista === "cobros"
      ? "Aun no hay cobros registrados desde ordenes."
      : vista === "pagos"
      ? "Aun no hay pagos registrados para compras."
      : vista === "devoluciones"
      ? "Aun no hay devoluciones registradas."
      : "Aun no hay devoluciones a proveedores registradas.";

  return (
    <AppShell>
      <div className="page-header">
        <h1 className="page-title">Reporte Financiero</h1>
        <p className="page-subtitle">Cobros de ordenes y pagos a proveedores desde compras registradas</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(16,185,129,0.12)" }}>
            <ArrowUpCircle size={22} style={{ color: "var(--success)" }} />
          </div>
          <div>
            <div className="stat-value">{money(totalCobrado)}</div>
            <div className="stat-label">Cobros de ordenes</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(239,68,68,0.12)" }}>
            <ArrowDownCircle size={22} style={{ color: "var(--danger)" }} />
          </div>
          <div>
            <div className="stat-value">{money(totalPagado)}</div>
            <div className="stat-label">Pagos a proveedores</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(59,130,246,0.12)" }}>
            <RotateCcw size={22} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <div className="stat-value">{money(totalDevuelto)}</div>
            <div className="stat-label">Dev. clientes</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(245,158,11,0.12)" }}>
            <ReceiptText size={22} style={{ color: "var(--warning)" }} />
          </div>
          <div>
            <div className="stat-value">{money(totalComprasFacturado)}</div>
            <div className="stat-label">Facturas de compra</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(37,99,235,0.12)" }}>
            <Banknote size={22} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <div className="stat-value">{money(totalCobrado - totalPagado - totalDevuelto + totalDevueltoProveedor)}</div>
            <div className="stat-label">Flujo neto</div>
            <div className="stat-trend" style={{ color: "var(--warning)" }}>
              Dev. prov. {money(totalDevueltoProveedor)}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="inline-flex rounded-lg border border-[var(--border)] overflow-hidden w-full sm:w-auto">
            <button
              type="button"
              onClick={() => changeVista("cobros")}
              className={`btn-ghost justify-center flex-1 sm:flex-none ${vista === "cobros" ? "bg-[var(--bg-hover)] text-[var(--text-primary)]" : ""}`}
            >
              <ArrowUpCircle size={16} />
              Cobros
            </button>
            <button
              type="button"
              onClick={() => changeVista("pagos")}
              className={`btn-ghost justify-center flex-1 sm:flex-none ${vista === "pagos" ? "bg-[var(--bg-hover)] text-[var(--text-primary)]" : ""}`}
            >
              <ArrowDownCircle size={16} />
              Pagos
            </button>
            <button
              type="button"
              onClick={() => changeVista("devoluciones")}
              className={`btn-ghost justify-center flex-1 sm:flex-none ${vista === "devoluciones" ? "bg-[var(--bg-hover)] text-[var(--text-primary)]" : ""}`}
            >
              <RotateCcw size={16} />
              Dev. clientes
            </button>
            <button
              type="button"
              onClick={() => changeVista("devoluciones-proveedor")}
              className={`btn-ghost justify-center flex-1 sm:flex-none ${vista === "devoluciones-proveedor" ? "bg-[var(--bg-hover)] text-[var(--text-primary)]" : ""}`}
            >
              <RotateCcw size={16} />
              Dev. proveedores
            </button>
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {vista === "cobros"
              ? "Cobros registrados en ordenes de trabajo"
              : vista === "pagos"
              ? "Pagos y facturas registradas desde compras"
              : vista === "devoluciones"
              ? "Productos devueltos por clientes y motivos registrados"
              : "Productos devueltos a proveedores y credito reconocido"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="card flex justify-center py-14">
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : movimientosBase.length === 0 && (vista === "cobros" || vista === "devoluciones" || vista === "devoluciones-proveedor" || compras.length === 0) ? (
        <div className="card text-center py-12" style={{ color: "var(--text-muted)" }}>
          <AlertCircle size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="xl:col-span-2 flex justify-end">
              <button
                type="button"
                className={showFilters ? "btn-primary" : "btn-secondary"}
                onClick={() => setShowFilters((visible) => !visible)}
                aria-expanded={showFilters}
                aria-controls="reporte-financiero-filtros"
              >
                <Search size={16} />
                {showFilters ? "Ocultar filtros" : "Buscar y filtrar"}
              </button>
          </div>

          {showFilters && (
            <div id="reporte-financiero-filtros" className="card xl:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                <div className="relative md:col-span-2">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                  <input
                    type="search"
                    className="input pl-9"
                    placeholder="Buscar por metodo, banco, proveedor, factura, referencia o monto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="input"
                  value={metodoFiltro}
                  onChange={(e) => {
                    setMetodoFiltro(e.target.value);
                    if (e.target.value !== "transferencia") setBancoFiltro("todos");
                  }}
                >
                  <option value="todos">Todos los metodos</option>
                  {Object.entries(metodoLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <select
                  className="input"
                  value={bancoFiltro}
                  onChange={(e) => setBancoFiltro(e.target.value)}
                  disabled={metodoFiltro !== "todos" && metodoFiltro !== "transferencia"}
                >
                  <option value="todos">Todos los bancos</option>
                  {bancosDisponibles.map((banco) => (
                    <option key={banco} value={banco}>{banco}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-ghost justify-center"
                  onClick={resetFilters}
                  disabled={!hasFilters}
                >
                  <X size={15} />
                  Limpiar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div className="form-group">
                  <label className="label">Desde</label>
                  <input className="input" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="label">Hasta</label>
                  <input className="input" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
                </div>
              </div>
              <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                Mostrando {movimientosFiltrados.length} de {movimientosBase.length} movimiento(s).
              </p>
            </div>
          )}

          {movimientosFiltrados.length === 0 ? (
            <div className="card xl:col-span-2 text-center py-12" style={{ color: "var(--text-muted)" }}>
              <AlertCircle size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay movimientos que coincidan con la busqueda o filtros.</p>
            </div>
          ) : (
            <>
              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={18} style={{ color: "var(--accent)" }} />
                  <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    Por metodo de pago
                  </h2>
                </div>
                <div className="space-y-3">
                  {metodos.map((row) => (
                    <div key={row.label} className="flex items-center justify-between rounded-lg p-3" style={{ background: "var(--bg-secondary)" }}>
                      <div>
                        <p className="font-medium" style={{ color: "var(--text-primary)" }}>{row.label}</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{row.cantidad} movimiento(s)</p>
                      </div>
                      <p className="font-bold" style={{ color: vista === "cobros" ? "var(--success)" : "var(--danger)" }}>
                        {money(row.total)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  <Landmark size={18} style={{ color: "var(--warning)" }} />
                  <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    Transferencias por banco
                  </h2>
                </div>
                {bancos.length === 0 ? (
                  <p className="text-sm rounded-lg p-3" style={{ color: "var(--text-muted)", background: "var(--bg-secondary)" }}>
                    No hay transferencias registradas.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {bancos.map((row) => (
                      <div key={row.label} className="flex items-center justify-between rounded-lg p-3" style={{ background: "var(--bg-secondary)" }}>
                        <div>
                          <p className="font-medium" style={{ color: "var(--text-primary)" }}>{row.label}</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{row.cantidad} transferencia(s)</p>
                        </div>
                        <p className="font-bold" style={{ color: "var(--warning)" }}>{money(row.total)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card xl:col-span-2">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    {vista === "cobros"
                      ? "Cobros recientes"
                      : vista === "pagos"
                        ? "Pagos recientes"
                        : vista === "devoluciones"
                          ? "Devoluciones recientes"
                          : "Devoluciones a proveedores"}
                  </h2>
                  <p className="font-bold" style={{ color: vista === "cobros" ? "var(--success)" : "var(--danger)" }}>
                    {money(totalVista)}
                  </p>
                </div>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>{vista === "cobros" ? "Origen" : vista === "pagos" || vista === "devoluciones-proveedor" ? "Proveedor / producto" : "Cliente / producto"}</th>
                        <th>Documento</th>
                        <th>Metodo</th>
                        <th>{vista === "devoluciones" ? "Accion inventario" : vista === "devoluciones-proveedor" ? "Inventario" : "Banco"}</th>
                        <th>{vista === "devoluciones" || vista === "devoluciones-proveedor" ? "Motivo" : "Referencia"}</th>
                        <th className="text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientosFiltrados.slice(0, 30).map((movimiento) => (
                        <tr key={movimiento.id}>
                          <td>{movimiento.fecha ? format(movimiento.fecha, "dd/MM/yyyy HH:mm") : "Sin fecha"}</td>
                          <td>{movimiento.entidad}</td>
                          <td className="font-mono text-xs">{movimiento.documento || "-"}</td>
                          <td>{movimiento.metodoLabel}</td>
                          <td>{movimiento.banco || "-"}</td>
                          <td>{movimiento.referencia || "-"}</td>
                          <td className="text-right font-semibold">{money(movimiento.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {vista === "pagos" && (
            <div className="card xl:col-span-2">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  Facturas de compras registradas
                </h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Pendiente {money(totalComprasPendiente)}
                </p>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Factura</th>
                      <th>Fecha</th>
                      <th>Proveedor</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Pagado</th>
                      <th className="text-right">Devuelto</th>
                      <th className="text-right">Pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturasComprasFiltradas.slice(0, 30).map((compra) => (
                      <tr key={compra.id ?? compra.claveAcceso}>
                        <td className="font-mono text-xs">{compra.numeroFactura}</td>
                        <td>{compra.fechaEmision || "Sin fecha"}</td>
                        <td>
                          <p className="font-medium text-[var(--text-primary)]">{compra.proveedorRazonSocial}</p>
                          <p className="text-xs text-[var(--text-muted)]">{compra.proveedorRuc}</p>
                        </td>
                        <td className="text-right font-semibold">{money(compra.importeTotal)}</td>
                        <td className="text-right font-semibold text-[var(--success)]">{money(getCompraPagado(compra))}</td>
                        <td className="text-right font-semibold text-[var(--danger)]">{money(Number(compra.totalDevueltoProveedor ?? 0))}</td>
                        <td className="text-right font-semibold" style={{ color: getCompraSaldo(compra) > 0.01 ? "var(--warning)" : "var(--text-muted)" }}>
                          {money(getCompraSaldo(compra))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
