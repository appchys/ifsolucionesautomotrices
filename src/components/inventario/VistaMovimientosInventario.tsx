"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  Calendar,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  ExternalLink,
} from "lucide-react";
import { getMovimientosStock, getOrdenById } from "@/lib/services";
import { MovimientoStock, Producto } from "@/types";
import { toast } from "react-hot-toast";

type FiltroPreset = "hoy" | "7dias" | "esteMes" | "mesAnterior" | "todo" | "personalizado";
type FiltroTipo = "todos" | "entrada" | "salida";

interface VistaMovimientosInventarioProps {
  onVerProducto?: (producto: Producto) => void;
  productos?: Producto[];
  busqueda?: string;
  onMovimientosDataChange?: (data: {
    movimientos: MovimientoStock[];
    periodo: string;
    ordenesMap: Record<string, string>;
  }) => void;
}

interface GrupoProducto {
  productoId: string;
  nombre: string;
  sku: string;
  unidad?: string;
  stockActual?: number;
  costoBase?: number;
  precioBase?: number;
  producto?: Producto;
  totalMovimientos: number;
  entradas: number;
  salidas: number;
  balance: number;
  items: MovimientoStock[];
}

// Formateador de fechas para Ecuador (UTC-5)
function parseDateEC(val: unknown): Date | null {
  if (!val) return null;
  if (typeof val === "object" && val !== null && "toDate" in val && typeof (val as { toDate: () => Date }).toDate === "function") {
    return (val as { toDate: () => Date }).toDate();
  }
  if (val instanceof Date) return val;
  if (typeof val === "object" && val !== null && "seconds" in val && typeof (val as { seconds: number }).seconds === "number") {
    return new Date((val as { seconds: number }).seconds * 1000);
  }
  const d = new Date(val as string | number);
  return isNaN(d.getTime()) ? null : d;
}

function formatTimeEC(date: Date): string {
  return date.toLocaleTimeString("es-EC", {
    timeZone: "America/Guayaquil",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getDayKeyEC(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function formatDateTimeEC(date: Date): string {
  const now = new Date();
  const todayKey = getDayKeyEC(now);
  const yesterdayKey = getDayKeyEC(new Date(now.getTime() - 86400000));
  const dateKey = getDayKeyEC(date);
  const timeStr = formatTimeEC(date);

  if (dateKey === todayKey) return `Hoy ${timeStr}`;
  if (dateKey === yesterdayKey) return `Ayer ${timeStr}`;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const d = parts.find((p) => p.type === "day")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const y = parts.find((p) => p.type === "year")?.value;

  return `${d}/${m}/${y} ${timeStr}`;
}

export default function VistaMovimientosInventario({
  onVerProducto,
  productos = [],
  busqueda = "",
  onMovimientosDataChange,
}: VistaMovimientosInventarioProps) {
  const [movimientos, setMovimientos] = useState<MovimientoStock[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ordenesMap, setOrdenesMap] = useState<Record<string, string>>({});

  // Filtros
  const [presetFecha, setPresetFecha] = useState<FiltroPreset>("7dias");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [modoCargado, setModoCargado] = useState<"7dias" | "completo">("7dias");

  // Control de grupos colapsados por producto
  const [productosColapsados, setProductosColapsados] = useState<Record<string, boolean>>({});

  // Referencias para evitar re-render loops
  const onDataChangeRef = useRef(onMovimientosDataChange);
  useEffect(() => {
    onDataChangeRef.current = onMovimientosDataChange;
  });
  const lastEmittedKeyRef = useRef<string>("");

  // Inicializar rangos según preset
  useEffect(() => {
    const now = new Date();
    const todayKey = getDayKeyEC(now);

    if (presetFecha === "hoy") {
      setFechaInicio(todayKey);
      setFechaFin(todayKey);
    } else if (presetFecha === "7dias") {
      const hace7Dias = new Date(now.getTime() - 6 * 86400000);
      setFechaInicio(getDayKeyEC(hace7Dias));
      setFechaFin(todayKey);
    } else if (presetFecha === "esteMes") {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      setFechaInicio(`${y}-${m}-01`);
      setFechaFin(todayKey);
    } else if (presetFecha === "mesAnterior") {
      const primerDiaMesAnt = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const ultimoDiaMesAnt = new Date(now.getFullYear(), now.getMonth(), 0);
      setFechaInicio(getDayKeyEC(primerDiaMesAnt));
      setFechaFin(getDayKeyEC(ultimoDiaMesAnt));
    } else if (presetFecha === "todo") {
      setFechaInicio("");
      setFechaFin("");
    }
  }, [presetFecha]);

  // Resolver OTs encontradas en las notas
  const resolverOrdenesNotas = async (data: MovimientoStock[]) => {
    const idsEncontrados = new Set<string>();
    data.forEach((m) => {
      if (m.nota) {
        const matches = m.nota.match(/[a-zA-Z0-9]{20}/g);
        if (matches) {
          matches.forEach((id) => idsEncontrados.add(id));
        }
      }
    });

    if (idsEncontrados.size > 0) {
      const map: Record<string, string> = { ...ordenesMap };
      const idsPendientes = Array.from(idsEncontrados).filter((id) => !map[id]);
      if (idsPendientes.length > 0) {
        await Promise.all(
          idsPendientes.map(async (id) => {
            try {
              const orden = await getOrdenById(id);
              if (orden) {
                const numDoc = orden.esCotizacion
                  ? (orden.numeroCotizacion ?? orden.numero)
                  : (orden.numeroOrden ?? orden.numero);
                map[id] = `#OT ${String(numDoc ?? "").padStart(4, "0")}`;
              }
            } catch {
              // Ignorar si no es una orden
            }
          })
        );
        setOrdenesMap(map);
      }
    }
  };

  // Cargar datos: inicial 7 días o completo bajo demanda
  const cargarMovimientos = async (opciones?: { completo?: boolean }) => {
    setCargando(true);
    try {
      const pedirCompleto = opciones?.completo ?? (modoCargado === "completo");
      let data: MovimientoStock[];

      if (pedirCompleto) {
        data = await getMovimientosStock();
        setModoCargado("completo");
      } else {
        // Carga inicial optimizada: solo últimos 7 días
        const now = new Date();
        const desde7Dias = new Date(now.getTime() - 7 * 86400000);
        desde7Dias.setHours(0, 0, 0, 0);
        data = await getMovimientosStock({ desde: desde7Dias });
      }

      setMovimientos(data);
      void resolverOrdenesNotas(data);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar movimientos");
    } finally {
      setCargando(false);
    }
  };

  // Carga inicial optimizada (7 días)
  useEffect(() => {
    void Promise.resolve().then(() => cargarMovimientos({ completo: false }));
  }, []);

  // Carga bajo demanda si el usuario selecciona un rango más amplio o realiza búsquedas
  useEffect(() => {
    if (modoCargado === "completo") return;

    const necesitaCompleto =
      presetFecha === "esteMes" ||
      presetFecha === "mesAnterior" ||
      presetFecha === "todo" ||
      Boolean(busqueda.trim()) ||
      (Boolean(fechaInicio) && (() => {
        const hace7DiasKey = getDayKeyEC(new Date(Date.now() - 6 * 86400000));
        return fechaInicio < hace7DiasKey;
      })());

    if (necesitaCompleto) {
      void cargarMovimientos({ completo: true });
    }
  }, [presetFecha, busqueda, fechaInicio, modoCargado]);

  // Formatear notas con las OTs resueltas
  const formatearNota = (nota?: string) => {
    if (!nota) return "-";
    let formatted = nota;
    Object.entries(ordenesMap).forEach(([id, label]) => {
      formatted = formatted.replace(id, label);
    });
    return formatted;
  };

  // Mapa de productos para enriquecer costos y precios base
  const productosMap = useMemo(() => {
    const map: Record<string, Producto> = {};
    productos.forEach((p) => {
      if (p.id) map[p.id] = p;
    });
    return map;
  }, [productos]);

  const obtenerValoresFinancieros = (mov: MovimientoStock) => {
    const prod = productosMap[mov.productoId];
    const cantidad = Math.max(0, Number(mov.cantidad || 0));

    // Costo unitario
    const costoUnitario =
      mov.costoUnitario != null
        ? Number(mov.costoUnitario)
        : prod?.costoBase != null
        ? Number(prod.costoBase)
        : null;

    // Precio de venta bruto unitario
    const precioBruto =
      mov.precioVentaUnitario != null
        ? Number(mov.precioVentaUnitario)
        : prod?.precioBase != null
        ? Number(prod.precioBase)
        : null;

    if (precioBruto == null) {
      return {
        costoUnitario,
        precioUnitario: null,
        ivaUnitario: null,
        subtotal: null,
        ivaTotal: null,
        total: null,
      };
    }

    const aplicaIva = prod ? Boolean(prod.aplicaIva) : false;

    // 1. Valores Unitarios:
    const precioUnitario = aplicaIva ? Number((precioBruto / 1.15).toFixed(2)) : precioBruto;
    const ivaUnitario = aplicaIva ? Number((precioUnitario * 0.15).toFixed(2)) : 0;

    // 2. Valores Totales (multiplicados por la cantidad):
    const subtotal = Number((cantidad * precioUnitario).toFixed(2));
    const ivaTotal = Number((cantidad * ivaUnitario).toFixed(2));
    const total = Number((subtotal + ivaTotal).toFixed(2));

    return {
      costoUnitario,
      precioUnitario,
      ivaUnitario,
      subtotal,
      ivaTotal,
      total,
    };
  };

  // Filtrado de movimientos
  const movimientosFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();

    return movimientos.filter((m) => {
      // 1. Tipo
      if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;

      // 2. Rango de fechas
      const fechaObj = parseDateEC(m.createdAt);
      if (fechaObj) {
        const diaKey = getDayKeyEC(fechaObj);
        if (fechaInicio && diaKey < fechaInicio) return false;
        if (fechaFin && diaKey > fechaFin) return false;
      }

      // 3. Búsqueda por texto (nombre, SKU, nota)
      if (term) {
        const matchNombre = m.productoNombre?.toLowerCase().includes(term);
        const matchSku = m.sku?.toLowerCase().includes(term);
        const matchNota = m.nota?.toLowerCase().includes(term);
        if (!matchNombre && !matchSku && !matchNota) return false;
      }

      return true;
    });
  }, [movimientos, filtroTipo, fechaInicio, fechaFin, busqueda]);

  // Métricas globales del período
  const metricas = useMemo(() => {
    let entradas = 0;
    let salidas = 0;
    movimientosFiltrados.forEach((m) => {
      if (m.tipo === "entrada") {
        entradas += Number(m.cantidad || 0);
      } else {
        salidas += Number(m.cantidad || 0);
      }
    });
    return {
      total: movimientosFiltrados.length,
      entradas,
      salidas,
      balance: entradas - salidas,
    };
  }, [movimientosFiltrados]);

  // Label del período activo para reportes y exportación
  const labelPeriodo = useMemo(() => {
    if (presetFecha === "hoy") return "Hoy";
    if (presetFecha === "7dias") return "Últimos 7 días";
    if (presetFecha === "esteMes") return "Este mes";
    if (presetFecha === "mesAnterior") return "Mes anterior";
    if (presetFecha === "todo") return "Todo el historial";
    if (fechaInicio || fechaFin) return `${fechaInicio || "..."} al ${fechaFin || "..."}`;
    return "Período seleccionado";
  }, [presetFecha, fechaInicio, fechaFin]);

  // Sincronizar datos para el modal de impresión sin provocar ciclos de render
  useEffect(() => {
    const key = `${movimientosFiltrados.length}_${labelPeriodo}_${movimientosFiltrados[0]?.id || ""}_${Object.keys(ordenesMap).length}`;
    if (lastEmittedKeyRef.current === key) return;
    lastEmittedKeyRef.current = key;

    onDataChangeRef.current?.({
      movimientos: movimientosFiltrados,
      periodo: labelPeriodo,
      ordenesMap,
    });
  }, [movimientosFiltrados, labelPeriodo, ordenesMap]);

  // AGRUPACIÓN PRINCIPAL: SOLO POR PRODUCTO
  const gruposPorProducto = useMemo<GrupoProducto[]>(() => {
    const prodMap = new Map<string, MovimientoStock[]>();

    movimientosFiltrados.forEach((m) => {
      const key = m.productoId || `${m.productoNombre}_${m.sku}`;
      const list = prodMap.get(key) ?? [];
      list.push(m);
      prodMap.set(key, list);
    });

    return Array.from(prodMap.entries())
      .map(([key, items]) => {
        const primer = items[0];
        let ent = 0;
        let sal = 0;

        items.forEach((m) => {
          if (m.tipo === "entrada") ent += Number(m.cantidad || 0);
          else sal += Number(m.cantidad || 0);
        });

        const prodMatch = productos.find((p) => p.id === primer.productoId);
        const stockActual = prodMatch?.stockActual !== undefined ? prodMatch.stockActual : primer.stockNuevo;

        return {
          productoId: primer.productoId || key,
          nombre: primer.productoNombre || prodMatch?.nombre || "Sin nombre",
          sku: primer.sku || prodMatch?.sku || "",
          unidad: primer.unidadMedida || prodMatch?.unidadMedida,
          stockActual,
          costoBase: prodMatch?.costoBase,
          precioBase: prodMatch?.precioBase,
          producto: prodMatch,
          totalMovimientos: items.length,
          entradas: ent,
          salidas: sal,
          balance: ent - sal,
          items,
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  }, [movimientosFiltrados, productos]);

  const toggleProducto = (productoId: string) => {
    setProductosColapsados((prev) => ({
      ...prev,
      [productoId]: !prev[productoId],
    }));
  };

  const expandirTodos = () => {
    setProductosColapsados({});
  };

  const colapsarTodos = () => {
    const todos: Record<string, boolean> = {};
    gruposPorProducto.forEach((g) => {
      todos[g.productoId] = true;
    });
    setProductosColapsados(todos);
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros Compacta */}
      <div className="card p-2 sm:p-2.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Presets Rápidos de Fecha */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] mr-1 hidden md:inline">
              Período:
            </span>
            {(
              [
                { key: "hoy", label: "Hoy" },
                { key: "7dias", label: "7 días" },
                { key: "esteMes", label: "Este mes" },
                { key: "mesAnterior", label: "Mes anterior" },
                { key: "todo", label: "Todo" },
              ] as const
            ).map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPresetFecha(p.key)}
                className={`px-2 py-1 text-[11px] rounded-lg font-medium transition-colors cursor-pointer ${
                  presetFecha === p.key
                    ? "bg-[var(--accent)] text-white font-semibold"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Rango Manual, Tipo y Botón Recargar */}
          <div className="flex flex-wrap items-center gap-1.5 ml-auto">
            {/* Fechas manuales */}
            <div className="flex items-center gap-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-2 py-0.5 text-xs">
              <Calendar size={12} className="text-[var(--text-muted)]" />
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => {
                  setFechaInicio(e.target.value);
                  setPresetFecha("personalizado");
                }}
                className="bg-transparent border-0 text-[11px] focus:outline-hidden p-0 text-[var(--text-primary)] w-24 sm:w-28"
                aria-label="Fecha inicial"
              />
              <span className="text-[var(--text-muted)] text-[10px]">-</span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => {
                  setFechaFin(e.target.value);
                  setPresetFecha("personalizado");
                }}
                className="bg-transparent border-0 text-[11px] focus:outline-hidden p-0 text-[var(--text-primary)] w-24 sm:w-28"
                aria-label="Fecha final"
              />
            </div>

            {/* Selector de Tipo Entrada / Salida */}
            <div className="relative">
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as FiltroTipo)}
                className="input h-7 py-0 pl-2 pr-6 text-[11px] bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg cursor-pointer"
                aria-label="Filtrar por tipo"
              >
                <option value="todos">Todos los tipos</option>
                <option value="entrada">Solo Entradas (+)</option>
                <option value="salida">Solo Salidas (-)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => cargarMovimientos({ completo: modoCargado === "completo" })}
              disabled={cargando}
              className="btn-secondary h-7 px-2 text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
              title="Recargar movimientos"
            >
              <RefreshCw size={12} className={cargando ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards del Período - Compactas en una sola fila */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
        {/* Total Movimientos */}
        <div className="card p-2 sm:p-2.5 flex items-center gap-2 border border-[var(--border)] bg-[var(--bg-card)] rounded-xl min-w-0">
          <div className="p-1 sm:p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 shrink-0">
            <Activity size={13} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] font-medium truncate uppercase">
              Movimientos
            </p>
            <p className="text-xs sm:text-sm md:text-base font-bold text-[var(--text-primary)] leading-tight truncate">
              {metricas.total}
            </p>
          </div>
        </div>

        {/* Unidades Entradas */}
        <div className="card p-2 sm:p-2.5 flex items-center gap-2 border border-[var(--border)] bg-[var(--bg-card)] rounded-xl min-w-0">
          <div className="p-1 sm:p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 shrink-0">
            <TrendingUp size={13} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] font-medium truncate uppercase">
              Entradas
            </p>
            <p className="text-xs sm:text-sm md:text-base font-bold text-emerald-600 leading-tight truncate">
              +{metricas.entradas}
            </p>
          </div>
        </div>

        {/* Unidades Salidas */}
        <div className="card p-2 sm:p-2.5 flex items-center gap-2 border border-[var(--border)] bg-[var(--bg-card)] rounded-xl min-w-0">
          <div className="p-1 sm:p-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 shrink-0">
            <TrendingDown size={13} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] font-medium truncate uppercase">
              Salidas
            </p>
            <p className="text-xs sm:text-sm md:text-base font-bold text-red-600 leading-tight truncate">
              -{metricas.salidas}
            </p>
          </div>
        </div>

        {/* Balance Neto */}
        <div className="card p-2 sm:p-2.5 flex items-center gap-2 border border-[var(--border)] bg-[var(--bg-card)] rounded-xl min-w-0">
          <div className="p-1 sm:p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 shrink-0">
            <Layers size={13} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] font-medium truncate uppercase">
              Balance
            </p>
            <p
              className={`text-xs sm:text-sm md:text-base font-bold leading-tight truncate ${
                metricas.balance > 0
                  ? "text-emerald-600"
                  : metricas.balance < 0
                  ? "text-red-600"
                  : "text-[var(--text-primary)]"
              }`}
            >
              {metricas.balance > 0 ? `+${metricas.balance}` : metricas.balance}
            </p>
          </div>
        </div>
      </div>

      {/* Controles de expansión y estado */}
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-1">
        <span className="font-medium">
          {movimientosFiltrados.length === 0
            ? "No se encontraron movimientos"
            : `${gruposPorProducto.length} ${gruposPorProducto.length === 1 ? "producto" : "productos"} con actividad`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandirTodos}
            className="hover:text-[var(--text-primary)] transition-colors cursor-pointer text-[11px]"
          >
            Expandir todos
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={colapsarTodos}
            className="hover:text-[var(--text-primary)] transition-colors cursor-pointer text-[11px]"
          >
            Colapsar todos
          </button>
        </div>
      </div>

      {/* Listado Principal: AGRUPADO POR PRODUCTO */}
      {cargando ? (
        <div className="card p-12 text-center text-xs text-[var(--text-muted)]">
          <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[var(--accent)]" />
          Cargando movimientos de stock...
        </div>
      ) : movimientosFiltrados.length === 0 ? (
        <div className="card p-12 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-xl">
          <Activity size={32} className="mx-auto mb-2 opacity-30" />
          <p className="font-semibold text-sm text-[var(--text-secondary)]">No hay movimientos registrados</p>
          <p className="text-[11px] mt-1">Prueba seleccionando otro rango de fechas o limpiando los filtros.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {gruposPorProducto.map((grupo) => {
            const colapsado = !!productosColapsados[grupo.productoId];

            return (
              <div
                key={grupo.productoId}
                className="card p-0 overflow-hidden border border-[var(--border)] rounded-xl bg-[var(--bg-card)] shadow-xs"
              >
                {/* Cabecera del Producto (Slate 900 #0f172a) */}
                <button
                  type="button"
                  onClick={() => toggleProducto(grupo.productoId)}
                  className="w-full flex items-center justify-between p-3 sm:p-3.5 bg-slate-900 text-white hover:bg-slate-800 transition-colors text-left cursor-pointer border-b border-slate-800"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-slate-400 shrink-0">
                      {colapsado ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </span>
                    <Package size={16} className="text-sky-400 shrink-0" />
                    <span className="font-bold text-xs sm:text-sm text-white truncate">
                      {grupo.nombre}
                    </span>
                    {grupo.sku ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300">
                        [{grupo.sku}]
                      </span>
                    ) : null}
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-medium whitespace-nowrap">
                      {grupo.totalMovimientos} {grupo.totalMovimientos === 1 ? "mov." : "movs."}
                    </span>
                    <span className="text-[10px] text-slate-400 hidden md:inline whitespace-nowrap">
                      Stock: <strong className="text-slate-200">{grupo.stockActual ?? "-"}</strong> {grupo.unidad || ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 text-xs shrink-0">
                    {grupo.entradas > 0 && (
                      <span className="text-emerald-400 font-semibold text-[11px] hidden sm:inline">
                        +{grupo.entradas} ent.
                      </span>
                    )}
                    {grupo.salidas > 0 && (
                      <span className="text-rose-400 font-semibold text-[11px] hidden sm:inline">
                        -{grupo.salidas} sal.
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        grupo.balance >= 0
                          ? "bg-emerald-950/70 border border-emerald-500/40 text-emerald-300"
                          : "bg-rose-950/70 border border-rose-500/40 text-rose-300"
                      }`}
                    >
                      Variación: {grupo.balance > 0 ? `+${grupo.balance}` : grupo.balance}
                    </span>

                    {/* Botón Ver Producto en catálogo si existe */}
                    {grupo.producto && onVerProducto && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onVerProducto(grupo.producto!);
                        }}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors hidden sm:inline-block cursor-pointer"
                        title="Ver detalle del producto"
                      >
                        <ExternalLink size={13} />
                      </span>
                    )}
                  </div>
                </button>

                {/* Tabla de Movimientos del Producto */}
                {!colapsado && (
                  <div className="overflow-x-auto bg-[var(--bg-card)]">
                    <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                      <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-[var(--border)] text-[10px] uppercase text-[var(--text-muted)] font-bold">
                        <tr>
                          <th className="px-2.5 py-2 w-28">Fecha / Hora</th>
                          <th className="px-2 py-2 w-20 text-center">Tipo</th>
                          <th className="px-2 py-2 w-14 text-right">Cant.</th>
                          <th className="px-2.5 py-2 w-24 text-right">Stock</th>
                          <th className="px-2.5 py-2 min-w-[130px]">Detalle / Referencia</th>
                          {/* Valores Unitarios */}
                          <th className="px-2 py-2 w-18 text-right bg-slate-100/60 dark:bg-slate-800/40">Costo U.</th>
                          <th className="px-2 py-2 w-20 text-right bg-slate-100/60 dark:bg-slate-800/40">P. Venta U.</th>
                          <th className="px-2 py-2 w-16 text-right bg-slate-100/60 dark:bg-slate-800/40">IVA U.</th>
                          {/* Totales de la transacción */}
                          <th className="px-2 py-2 w-20 text-right border-l border-[var(--border)]/70">Subtotal</th>
                          <th className="px-2 py-2 w-16 text-right">IVA</th>
                          <th className="px-2.5 py-2 w-20 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]/60">
                        {grupo.items.map((mov) => {
                          const dateObj = parseDateEC(mov.createdAt);
                          const isEntrada = mov.tipo === "entrada";
                          const fin = obtenerValoresFinancieros(mov);

                          return (
                            <tr
                              key={mov.id}
                              className="hover:bg-slate-100/50 dark:hover:bg-slate-800/20 transition-colors"
                            >
                              <td className="px-2.5 py-2 font-mono text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                                {dateObj ? formatDateTimeEC(dateObj) : "-"}
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                    isEntrada
                                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-400"
                                      : "border border-red-200 bg-red-50 text-red-700 dark:bg-red-950/30 dark:border-red-800/40 dark:text-red-400"
                                  }`}
                                >
                                  {isEntrada ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                                  {mov.tipo}
                                </span>
                              </td>
                              <td
                                className={`px-2 py-2 text-right font-mono font-bold ${
                                  isEntrada ? "text-emerald-600" : "text-red-600"
                                }`}
                              >
                                {isEntrada ? `+${mov.cantidad}` : `-${mov.cantidad}`}
                              </td>
                              <td className="px-2.5 py-2 text-right font-mono text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
                                {mov.stockAnterior} →{" "}
                                <span className="font-bold text-[var(--text-primary)]">{mov.stockNuevo}</span>
                              </td>
                              <td className="px-2.5 py-2 text-[11px] text-[var(--text-secondary)]">
                                {formatearNota(mov.nota)}
                              </td>
                              {/* Valores Unitarios */}
                              <td className="px-2 py-2 text-right font-mono text-[11px] text-[var(--text-secondary)] whitespace-nowrap bg-slate-50/40 dark:bg-slate-900/20">
                                {fin.costoUnitario != null ? `$${fin.costoUnitario.toFixed(2)}` : "-"}
                              </td>
                              <td className="px-2 py-2 text-right font-mono text-[11px] font-medium text-[var(--text-primary)] whitespace-nowrap bg-slate-50/40 dark:bg-slate-900/20">
                                {fin.precioUnitario != null ? `$${fin.precioUnitario.toFixed(2)}` : "-"}
                              </td>
                              <td className="px-2 py-2 text-right font-mono text-[11px] text-[var(--text-muted)] whitespace-nowrap bg-slate-50/40 dark:bg-slate-900/20">
                                {fin.ivaUnitario != null ? `$${fin.ivaUnitario.toFixed(2)}` : "-"}
                              </td>
                              {/* Totales */}
                              <td className="px-2 py-2 text-right font-mono text-[11px] text-[var(--text-secondary)] whitespace-nowrap border-l border-[var(--border)]/70">
                                {fin.subtotal != null ? `$${fin.subtotal.toFixed(2)}` : "-"}
                              </td>
                              <td className="px-2 py-2 text-right font-mono text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                                {fin.ivaTotal != null ? `$${fin.ivaTotal.toFixed(2)}` : "-"}
                              </td>
                              <td className="px-2.5 py-2 text-right font-mono text-[11px] font-bold text-[var(--text-primary)] whitespace-nowrap">
                                {fin.total != null ? `$${fin.total.toFixed(2)}` : "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
