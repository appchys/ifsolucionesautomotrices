"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { getClienteById, getCompras, getDevoluciones, getDevolucionesProveedor, getItemsOrden, getOrdenes, getTodosPagos, getVehiculoById } from "@/lib/services";
import type { Compra, CompraMetodoPago, Devolucion, DevolucionProveedor, ItemOrden, MetodoDevolucion, MetodoDevolucionProveedor, MetodoPago, OrdenTrabajo, Pago } from "@/types";
import { BANCOS_TRANSFERENCIA, normalizeBancoTransferencia } from "@/lib/paymentBanks";
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  BarChart3,
  CalendarDays,
  Landmark,
  Loader2,
  ReceiptText,
  RotateCcw,
  Search,
  SlidersHorizontal,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";

type VistaReporte = "cobros" | "pagos" | "devoluciones" | "devoluciones-proveedor" | "tecnicos";
type PeriodoFiltro = "todos" | "hoy" | "semana" | "mes" | "rango";

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

type TecnicoPagoDetalle = {
  id: string;
  fecha: Date | null;
  tecnicoUid: string;
  tecnicoNombre: string;
  tecnicoEmail: string;
  ordenId: string;
  numeroOrden: string;
  cliente: string;
  vehiculo: string;
  serviciosCount: number;
  tecnicosCount: number;
  serviciosSubtotal: number;
  pagoTecnico: number;
};

type TecnicoPagoResumen = {
  uid: string;
  nombre: string;
  email: string;
  ordenes: number;
  serviciosSubtotal: number;
  totalPagar: number;
};

const PERIODO_LABELS: Record<PeriodoFiltro, string> = {
  todos: "Todos",
  hoy: "Hoy",
  semana: "Semana",
  mes: "Mes",
  rango: "Rango",
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

function getItemSubtotal(item: ItemOrden) {
  if (typeof item.subtotal === "number") return Number(item.subtotal || 0);
  return Number((Number(item.cantidad || 0) * Number(item.precioUnitario || 0) * (1 + Number(item.impuestoAplicable || 0) / 100)).toFixed(2));
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

function getReporteDateRange(periodo: PeriodoFiltro, fechaDesde: string, fechaHasta: string) {
  if (periodo === "todos") return { desde: null, hasta: null };

  if (periodo === "rango") {
    return {
      desde: fechaDesde ? new Date(`${fechaDesde}T00:00:00`) : null,
      hasta: fechaHasta ? new Date(`${fechaHasta}T23:59:59`) : null,
    };
  }

  const today = new Date();
  const desde = new Date(today);
  const hasta = new Date(today);

  if (periodo === "semana") {
    const mondayOffset = (today.getDay() + 6) % 7;
    desde.setDate(today.getDate() - mondayOffset);
    hasta.setDate(desde.getDate() + 6);
  }

  if (periodo === "mes") {
    desde.setDate(1);
    hasta.setMonth(desde.getMonth() + 1, 0);
  }

  desde.setHours(0, 0, 0, 0);
  hasta.setHours(23, 59, 59, 999);
  return { desde, hasta };
}

function isDateInRange(fecha: Date | null, desde: Date | null, hasta: Date | null) {
  if (!desde && !hasta) return true;
  if (!fecha) return false;
  return (!desde || fecha >= desde) && (!hasta || fecha <= hasta);
}

function calcularPagosTecnicosOrden(orden: OrdenTrabajo, items: ItemOrden[]): TecnicoPagoDetalle[] {
  if (!orden.id || orden.esCotizacion) return [];

  const tecnicosAsignados = (orden.personalAsignado ?? [])
    .filter((persona) => persona.role === "tecnico")
    .map((persona) => ({
      uid: persona.uid,
      nombre: persona.displayName || persona.email || "Tecnico sin nombre",
      email: persona.email || "",
    }));

  if (tecnicosAsignados.length === 0 && orden.tecnicoId) {
    tecnicosAsignados.push({
      uid: orden.tecnicoId,
      nombre: "Tecnico sin nombre",
      email: "",
    });
  }

  if (tecnicosAsignados.length === 0) return [];

  const servicios = items.filter((item) => item.tipo === "servicio");
  const serviciosSubtotal = Number(servicios.reduce((sum, item) => sum + getItemSubtotal(item), 0).toFixed(2));
  if (serviciosSubtotal <= 0) return [];

  const tecnicosCount = tecnicosAsignados.length;
  const pagoTecnico = Number(((serviciosSubtotal * 0.5) / tecnicosCount).toFixed(2));
  const numeroOrden = `Orden #${String(orden.numero ?? 0).padStart(4, "0")}`;
  const cliente = [orden.cliente?.nombre, orden.cliente?.apellido].filter(Boolean).join(" ") || "Cliente sin nombre";
  const vehiculo = [orden.vehiculo?.placa, orden.vehiculo?.marca, orden.vehiculo?.modelo].filter(Boolean).join(" ") || "";

  return tecnicosAsignados.map((tecnico) => ({
    id: `${orden.id}-${tecnico.uid}`,
    fecha: parseReporteFecha(orden.createdAt),
    tecnicoUid: tecnico.uid,
    tecnicoNombre: tecnico.nombre,
    tecnicoEmail: tecnico.email,
    ordenId: orden.id ?? "",
    numeroOrden,
    cliente,
    vehiculo,
    serviciosCount: servicios.length,
    tecnicosCount,
    serviciosSubtotal,
    pagoTecnico,
  }));
}

// ─── Compact stat pill ────────────────────────────────────────────────────────
function StatPill({
  icon,
  label,
  value,
  color,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 14px",
        borderRadius: "10px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        flex: "1 1 140px",
        minWidth: 0,
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 8,
          background: color,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: "var(--warning)", fontWeight: 500, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Compact group row ────────────────────────────────────────────────────────
function GroupRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "7px 10px",
        borderRadius: 8,
        background: "var(--bg-secondary)",
      }}
    >
      <div>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{label}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>{count} mov.</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{money(total)}</span>
    </div>
  );
}

export default function ReporteFinancieroPage() {
  const [cobros, setCobros] = useState<Pago[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [devolucionesProveedor, setDevolucionesProveedor] = useState<DevolucionProveedor[]>([]);
  const [pagosTecnicos, setPagosTecnicos] = useState<TecnicoPagoDetalle[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<VistaReporte>("cobros");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [metodoFiltro, setMetodoFiltro] = useState<string>("todos");
  const [bancoFiltro, setBancoFiltro] = useState("todos");
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodoFiltro>("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [pagosOrdenes, comprasRegistradas, devolucionesRegistradas, devolucionesProveedorRegistradas, ordenesRegistradas] = await Promise.all([
        getTodosPagos(),
        getCompras(),
        getDevoluciones(),
        getDevolucionesProveedor(),
        getOrdenes(),
      ]);
      const itemsPorOrden = await Promise.all(
        ordenesRegistradas.map(async (orden) => {
          const [items, cliente, vehiculo] = await Promise.all([
            orden.id ? getItemsOrden(orden.id) : [],
            orden.clienteId ? getClienteById(orden.clienteId) : null,
            orden.vehiculoId ? getVehiculoById(orden.vehiculoId) : null,
          ]);
          return { orden: { ...orden, cliente: cliente ?? undefined, vehiculo: vehiculo ?? undefined }, items };
        })
      );

      const tecnicoDetalles = itemsPorOrden.flatMap(({ orden, items }) => calcularPagosTecnicosOrden(orden, items));
      setCobros(pagosOrdenes);
      setCompras(comprasRegistradas);
      setDevoluciones(devolucionesRegistradas);
      setDevolucionesProveedor(devolucionesProveedorRegistradas);
      setPagosTecnicos(tecnicoDetalles);
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

  const movimientosBase = useMemo(
    () =>
      vista === "cobros"
        ? movimientosCobros
        : vista === "pagos"
          ? movimientosPagos
          : vista === "devoluciones"
            ? movimientosDevoluciones
            : vista === "devoluciones-proveedor"
              ? movimientosDevolucionesProveedor
              : [],
    [movimientosCobros, movimientosDevoluciones, movimientosDevolucionesProveedor, movimientosPagos, vista]
  );
  const metodoLabels: Partial<Record<string, string>> =
    vista === "cobros"
      ? COBRO_METODO_LABELS
      : vista === "pagos"
        ? PAGO_METODO_LABELS
        : vista === "devoluciones"
          ? DEVOLUCION_METODO_LABELS
          : vista === "devoluciones-proveedor"
            ? DEVOLUCION_PROVEEDOR_METODO_LABELS
            : {};

  const bancosDisponibles = useMemo(() => {
    const bancos = movimientosBase.filter((movimiento) => movimiento.banco).map((movimiento) => movimiento.banco);
    return Array.from(new Set([...BANCOS_TRANSFERENCIA, ...bancos])).sort();
  }, [movimientosBase]);

  const movimientosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    const { desde, hasta } = getReporteDateRange(periodoFiltro, fechaDesde, fechaHasta);

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
      const matchesFecha = isDateInRange(movimiento.fecha, desde, hasta);

      return matchesSearch && matchesMetodo && matchesBanco && matchesFecha;
    });
  }, [bancoFiltro, fechaDesde, fechaHasta, metodoFiltro, movimientosBase, periodoFiltro, search]);

  const facturasComprasFiltradas = useMemo(() => {
    const term = search.trim().toLowerCase();
    const { desde, hasta } = getReporteDateRange(periodoFiltro, fechaDesde, fechaHasta);

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

      const fecha = parseReporteFecha(compra.fechaEmision) ?? parseReporteFecha(compra.createdAt);
      return (!term || searchable.includes(term)) && isDateInRange(fecha, desde, hasta);
    });
  }, [compras, fechaDesde, fechaHasta, periodoFiltro, search]);

  const pagosTecnicosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    const { desde, hasta } = getReporteDateRange(periodoFiltro, fechaDesde, fechaHasta);

    return pagosTecnicos.filter((detalle) => {
      const searchable = [
        detalle.tecnicoNombre,
        detalle.tecnicoEmail,
        detalle.numeroOrden,
        detalle.cliente,
        detalle.vehiculo,
        detalle.serviciosSubtotal.toFixed(2),
        detalle.pagoTecnico.toFixed(2),
        detalle.fecha ? format(detalle.fecha, "dd/MM/yyyy HH:mm") : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !term || searchable.includes(term);
      const matchesFecha = isDateInRange(detalle.fecha, desde, hasta);

      return matchesSearch && matchesFecha;
    });
  }, [fechaDesde, fechaHasta, pagosTecnicos, periodoFiltro, search]);

  const pagosTecnicosResumen = useMemo<TecnicoPagoResumen[]>(() => {
    const rows = pagosTecnicosFiltrados.reduce<Record<string, TecnicoPagoResumen>>((acc, detalle) => {
      if (!acc[detalle.tecnicoUid]) {
        acc[detalle.tecnicoUid] = {
          uid: detalle.tecnicoUid,
          nombre: detalle.tecnicoNombre,
          email: detalle.tecnicoEmail,
          ordenes: 0,
          serviciosSubtotal: 0,
          totalPagar: 0,
        };
      }
      acc[detalle.tecnicoUid].ordenes += 1;
      acc[detalle.tecnicoUid].serviciosSubtotal += detalle.serviciosSubtotal / detalle.tecnicosCount;
      acc[detalle.tecnicoUid].totalPagar += detalle.pagoTecnico;
      return acc;
    }, {});

    return Object.values(rows).sort((a, b) => b.totalPagar - a.totalPagar);
  }, [pagosTecnicosFiltrados]);

  const hasFilters =
    search.trim() ||
    metodoFiltro !== "todos" ||
    bancoFiltro !== "todos" ||
    periodoFiltro !== "todos";

  const resetFilters = () => {
    setSearch("");
    setMetodoFiltro("todos");
    setBancoFiltro("todos");
    setPeriodoFiltro("todos");
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

  const periodoRango = getReporteDateRange(periodoFiltro, fechaDesde, fechaHasta);
  const movimientosCobrosPeriodo = movimientosCobros.filter((movimiento) => isDateInRange(movimiento.fecha, periodoRango.desde, periodoRango.hasta));
  const movimientosPagosPeriodo = movimientosPagos.filter((movimiento) => isDateInRange(movimiento.fecha, periodoRango.desde, periodoRango.hasta));
  const movimientosDevolucionesPeriodo = movimientosDevoluciones.filter((movimiento) => isDateInRange(movimiento.fecha, periodoRango.desde, periodoRango.hasta));
  const movimientosDevolucionesProveedorPeriodo = movimientosDevolucionesProveedor.filter((movimiento) => isDateInRange(movimiento.fecha, periodoRango.desde, periodoRango.hasta));
  const comprasPeriodo = compras.filter((compra) =>
    isDateInRange(parseReporteFecha(compra.fechaEmision) ?? parseReporteFecha(compra.createdAt), periodoRango.desde, periodoRango.hasta)
  );
  const pagosTecnicosPeriodo = pagosTecnicos.filter((detalle) => isDateInRange(detalle.fecha, periodoRango.desde, periodoRango.hasta));
  const totalCobrado = movimientosCobrosPeriodo.reduce((sum, movimiento) => sum + movimiento.monto, 0);
  const totalPagado = movimientosPagosPeriodo.reduce((sum, movimiento) => sum + movimiento.monto, 0);
  const totalDevuelto = movimientosDevolucionesPeriodo.reduce((sum, movimiento) => sum + movimiento.monto, 0);
  const totalDevueltoProveedor = movimientosDevolucionesProveedorPeriodo.reduce((sum, movimiento) => sum + movimiento.monto, 0);
  const totalComprasFacturado = comprasPeriodo.reduce((sum, compra) => sum + compra.importeTotal, 0);
  const totalComprasPendiente = facturasComprasFiltradas.reduce((sum, compra) => sum + getCompraSaldo(compra), 0);
  const totalPagosTecnicos = pagosTecnicosPeriodo.reduce((sum, detalle) => sum + detalle.pagoTecnico, 0);
  const totalPagosTecnicosFiltrado = pagosTecnicosFiltrados.reduce((sum, detalle) => sum + detalle.pagoTecnico, 0);
  const totalServiciosTecnicosFiltrado = pagosTecnicosFiltrados.reduce((sum, detalle) => sum + detalle.serviciosSubtotal / detalle.tecnicosCount, 0);
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
      : vista === "devoluciones-proveedor"
        ? "Aun no hay devoluciones a proveedores registradas."
        : "Aun no hay servicios con tecnicos asignados.";

  // ─── Vista labels & description ─────────────────────────────────────────────
  const vistaConfig: Record<VistaReporte, { label: string; icon: React.ReactNode; desc: string }> = {
    cobros: { label: "Cobros", icon: <ArrowUpCircle size={14} />, desc: "Cobros registrados en órdenes" },
    pagos: { label: "Pagos", icon: <ArrowDownCircle size={14} />, desc: "Pagos desde compras registradas" },
    devoluciones: { label: "Dev. clientes", icon: <RotateCcw size={14} />, desc: "Devoluciones a clientes" },
    "devoluciones-proveedor": { label: "Dev. prov.", icon: <RotateCcw size={14} />, desc: "Devoluciones a proveedores" },
    tecnicos: { label: "Técnicos", icon: <Users size={14} />, desc: "50% de servicios por técnico" },
  };

  return (
    <AppShell>
      {/* ── Toolbar: título + periodo + vista tabs ──────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "10px",
          marginBottom: "14px",
        }}
      >
        {/* Title */}
        <div style={{ flex: "1 1 160px", minWidth: 0 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Reporte Financiero</h1>
        </div>

        {/* Periodo pills */}
        <div
          style={{
            display: "inline-flex",
            gap: 2,
            background: "var(--bg-secondary)",
            borderRadius: 8,
            padding: 3,
            border: "1px solid var(--border)",
          }}
        >
          {Object.entries(PERIODO_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriodoFiltro(value as PeriodoFiltro)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                borderRadius: 6,
                border: 0,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.15s",
                background: periodoFiltro === value ? "var(--bg-card)" : "transparent",
                color: periodoFiltro === value ? "var(--accent)" : "var(--text-muted)",
                boxShadow: periodoFiltro === value ? "0 1px 4px rgba(15,23,42,0.1)" : "none",
              }}
            >
              {value === "rango" && <CalendarDays size={11} />}
              {label}
            </button>
          ))}
        </div>

        {/* Search/filter toggle */}
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          aria-controls="reporte-financiero-filtros"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            borderRadius: 8,
            border: `1px solid ${showFilters ? "var(--accent)" : "var(--border)"}`,
            background: showFilters ? "rgba(37,99,235,0.08)" : "var(--bg-card)",
            color: showFilters ? "var(--accent)" : "var(--text-secondary)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "all 0.15s",
          }}
        >
          <SlidersHorizontal size={13} />
          Filtros
          {hasFilters ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "var(--accent)",
                color: "#fff",
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              ✓
            </span>
          ) : null}
        </button>
      </div>

      {/* ── Rango de fechas ──────────────────────────────────────────────────── */}
      {periodoFiltro === "rango" && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>Desde</label>
            <input className="input" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={{ padding: "5px 10px", fontSize: 12, width: "auto" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>Hasta</label>
            <input className="input" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} style={{ padding: "5px 10px", fontSize: 12, width: "auto" }} />
          </div>
        </div>
      )}

      {/* ── Stats row ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <StatPill
          icon={<ArrowUpCircle size={16} color="var(--success)" />}
          label="Cobros"
          value={money(totalCobrado)}
          color="rgba(16,185,129,0.12)"
        />
        <StatPill
          icon={<ArrowDownCircle size={16} color="var(--danger)" />}
          label="Pagos prov."
          value={money(totalPagado)}
          color="rgba(239,68,68,0.12)"
        />
        <StatPill
          icon={<RotateCcw size={16} color="var(--accent)" />}
          label="Dev. clientes"
          value={money(totalDevuelto)}
          color="rgba(59,130,246,0.12)"
        />
        <StatPill
          icon={<ReceiptText size={16} color="var(--warning)" />}
          label="Facturas compra"
          value={money(totalComprasFacturado)}
          color="rgba(245,158,11,0.12)"
        />
        <StatPill
          icon={<TrendingUp size={16} color="var(--accent)" />}
          label="Flujo neto"
          value={money(totalCobrado - totalPagado - totalDevuelto + totalDevueltoProveedor)}
          color="rgba(37,99,235,0.12)"
          sub={`Dev. prov. ${money(totalDevueltoProveedor)}`}
        />
        <StatPill
          icon={<Users size={16} color="var(--info)" />}
          label="Pago técnicos"
          value={money(totalPagosTecnicos)}
          color="rgba(6,182,212,0.12)"
        />
      </div>

      {/* ── Vista tabs + description (in one bar) ────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            gap: 2,
            background: "var(--bg-secondary)",
            borderRadius: 8,
            padding: 3,
            border: "1px solid var(--border)",
          }}
        >
          {(Object.keys(vistaConfig) as VistaReporte[]).map((key) => {
            const cfg = vistaConfig[key];
            const active = vista === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => changeVista(key)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: 0,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                  background: active ? "var(--bg-card)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-muted)",
                  boxShadow: active ? "0 1px 4px rgba(15,23,42,0.1)" : "none",
                }}
              >
                {cfg.icon}
                {cfg.label}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{vistaConfig[vista].desc}</span>
      </div>

      {/* ── Inline filters panel ─────────────────────────────────────────────── */}
      {showFilters && (
        <div
          id="reporte-financiero-filtros"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            marginBottom: 14,
          }}
        >
          {/* Search */}
          <div style={{ position: "relative", flex: "2 1 200px", minWidth: 0 }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="search"
              className="input"
              placeholder={vista === "tecnicos" ? "Buscar técnico, orden, cliente..." : "Buscar metodo, banco, referencia..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 28, padding: "6px 10px 6px 28px", fontSize: 12 }}
            />
          </div>

          {/* Método & banco */}
          {vista !== "tecnicos" && (
            <>
              <select
                className="input"
                value={metodoFiltro}
                onChange={(e) => {
                  setMetodoFiltro(e.target.value);
                  if (e.target.value !== "transferencia") setBancoFiltro("todos");
                }}
                style={{ flex: "1 1 140px", fontSize: 12, padding: "6px 10px" }}
              >
                <option value="todos">Todos los métodos</option>
                {Object.entries(metodoLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                className="input"
                value={bancoFiltro}
                onChange={(e) => setBancoFiltro(e.target.value)}
                disabled={metodoFiltro !== "todos" && metodoFiltro !== "transferencia"}
                style={{ flex: "1 1 140px", fontSize: 12, padding: "6px 10px" }}
              >
                <option value="todos">Todos los bancos</option>
                {bancosDisponibles.map((banco) => (
                  <option key={banco} value={banco}>{banco}</option>
                ))}
              </select>
            </>
          )}

          {/* Clear */}
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasFilters}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 10px",
              borderRadius: 7,
              border: "1px solid var(--border)",
              background: "transparent",
              color: hasFilters ? "var(--danger)" : "var(--text-muted)",
              fontSize: 12,
              fontWeight: 500,
              cursor: hasFilters ? "pointer" : "not-allowed",
              opacity: hasFilters ? 1 : 0.5,
              fontFamily: "inherit",
            }}
          >
            <X size={12} />
            Limpiar
          </button>

          {/* Count */}
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
            {vista === "tecnicos" ? pagosTecnicosFiltrados.length : movimientosFiltrados.length} de{" "}
            {vista === "tecnicos" ? pagosTecnicos.length : movimientosBase.length} registros
          </span>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="card" style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : (vista === "tecnicos" && pagosTecnicos.length === 0) || (movimientosBase.length === 0 && (vista === "cobros" || vista === "devoluciones" || vista === "devoluciones-proveedor" || compras.length === 0)) ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
          <AlertCircle size={32} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
          <p style={{ fontSize: 13 }}>{emptyMessage}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {/* No results */}
          {(vista === "tecnicos" ? pagosTecnicosFiltrados.length === 0 : movimientosFiltrados.length === 0) ? (
            <div className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
              <AlertCircle size={28} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
              <p style={{ fontSize: 13 }}>No hay movimientos que coincidan.</p>
            </div>
          ) : vista === "tecnicos" ? (
            <>
              {/* Por técnico */}
              <div className="card" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Users size={15} style={{ color: "var(--info)" }} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>Por técnico</span>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "var(--info)" }}>{money(totalPagosTecnicosFiltrado)}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {pagosTecnicosResumen.map((row) => (
                    <GroupRow key={row.uid} label={row.nombre} count={row.ordenes} total={row.totalPagar} color="var(--info)" />
                  ))}
                </div>
              </div>

              {/* Base de servicios */}
              <div className="card" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <BarChart3 size={15} style={{ color: "var(--accent)" }} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>Base de servicios</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", borderRadius: 8, background: "var(--bg-secondary)" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Servicios asignados</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{money(totalServiciosTecnicosFiltrado)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", borderRadius: 8, background: "var(--bg-secondary)" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>50% a técnicos</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--info)" }}>{money(totalPagosTecnicosFiltrado)}</span>
                  </div>
                </div>
              </div>

              {/* Detalle por orden */}
              <div className="card" style={{ gridColumn: "1 / -1", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>Detalle por orden</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "var(--info)" }}>{money(totalPagosTecnicosFiltrado)}</span>
                </div>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Técnico</th>
                        <th>Orden</th>
                        <th>Cliente / vehículo</th>
                        <th className="text-right">Servicios</th>
                        <th className="text-right">Técnicos</th>
                        <th className="text-right">A pagar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagosTecnicosFiltrados.slice(0, 40).map((detalle) => (
                        <tr key={detalle.id}>
                          <td>{detalle.fecha ? format(detalle.fecha, "dd/MM/yy HH:mm") : "Sin fecha"}</td>
                          <td>
                            <p className="font-medium text-[var(--text-primary)]">{detalle.tecnicoNombre}</p>
                            {detalle.tecnicoEmail ? <p className="text-xs text-[var(--text-muted)]">{detalle.tecnicoEmail}</p> : null}
                          </td>
                          <td className="font-mono text-xs">{detalle.numeroOrden}</td>
                          <td>
                            <p className="font-medium text-[var(--text-primary)]">{detalle.cliente}</p>
                            <p className="text-xs text-[var(--text-muted)]">{detalle.vehiculo || "-"}</p>
                          </td>
                          <td className="text-right font-semibold">{money(detalle.serviciosSubtotal)}</td>
                          <td className="text-right">{detalle.tecnicosCount}</td>
                          <td className="text-right font-semibold" style={{ color: "var(--info)" }}>{money(detalle.pagoTecnico)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Por método de pago */}
              <div className="card" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <BarChart3 size={15} style={{ color: "var(--accent)" }} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>Por método de pago</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {metodos.map((row) => (
                    <GroupRow
                      key={row.label}
                      label={row.label}
                      count={row.cantidad}
                      total={row.total}
                      color={vista === "cobros" ? "var(--success)" : "var(--danger)"}
                    />
                  ))}
                </div>
              </div>

              {/* Transferencias por banco */}
              <div className="card" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <Landmark size={15} style={{ color: "var(--warning)" }} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>Transferencias por banco</span>
                </div>
                {bancos.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "7px 10px", borderRadius: 8, background: "var(--bg-secondary)" }}>
                    Sin transferencias registradas.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {bancos.map((row) => (
                      <GroupRow key={row.label} label={row.label} count={row.cantidad} total={row.total} color="var(--warning)" />
                    ))}
                  </div>
                )}
              </div>

              {/* Movimientos recientes */}
              <div className="card" style={{ gridColumn: "1 / -1", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>
                    {vista === "cobros" ? "Cobros recientes" : vista === "pagos" ? "Pagos recientes" : vista === "devoluciones" ? "Devoluciones recientes" : "Devoluciones a proveedores"}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: vista === "cobros" ? "var(--success)" : "var(--danger)" }}>
                    {money(totalVista)}
                  </span>
                </div>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>{vista === "cobros" ? "Origen" : vista === "pagos" || vista === "devoluciones-proveedor" ? "Proveedor / producto" : "Cliente / producto"}</th>
                        <th>Documento</th>
                        <th>Método</th>
                        <th>{vista === "devoluciones" ? "Acción inv." : vista === "devoluciones-proveedor" ? "Inventario" : "Banco"}</th>
                        <th>{vista === "devoluciones" || vista === "devoluciones-proveedor" ? "Motivo" : "Referencia"}</th>
                        <th className="text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientosFiltrados.slice(0, 30).map((movimiento) => (
                        <tr key={movimiento.id}>
                          <td>{movimiento.fecha ? format(movimiento.fecha, "dd/MM/yy HH:mm") : "Sin fecha"}</td>
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

          {/* Facturas de compras (solo en vista pagos) */}
          {vista === "pagos" && (
            <div className="card" style={{ gridColumn: "1 / -1", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>Facturas de compras registradas</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Pendiente {money(totalComprasPendiente)}</span>
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
