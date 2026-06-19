"use client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Loader2,
  DollarSign,
  Boxes,
  Package,
  Info,
  History,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Tag,
  Truck,
  Ruler,
  Hash,
} from "lucide-react";
import { Producto, MovimientoStock } from "@/types";
import {
  updateProducto,
  getMovimientosStockByProducto,
  getHistorialPrecios,
  registrarMovimientoStockManual,
  calcularPrecioVenta,
  getOrdenById,
} from "@/lib/services";
import { toast } from "react-hot-toast";

type Tab = "detalles" | "precios" | "historial_precios" | "historial_stock";

interface ProductoDetalleSidebarProps {
  producto: Producto;
  onClose: () => void;
  onUpdate: () => void;
}

const formatCurrency = (value: number | undefined) => `$${Number(value ?? 0).toFixed(2)}`;

type DateLike = {
  toDate?: () => Date;
  seconds?: number;
};

type HistorialPrecio = {
  id: string;
  createdAt?: unknown;
  costoBase?: number;
  margenGanancia?: number;
  precioBase?: number;
};

const formatDate = (dateVal: any) => {
  if (!dateVal) return "-";
  try {
    let d: Date;
    if (typeof dateVal === "object" && dateVal !== null && "toDate" in dateVal && typeof (dateVal as DateLike).toDate === "function") {
      d = (dateVal as DateLike).toDate!();
    } else if (dateVal instanceof Date) {
      d = dateVal;
    } else if (typeof dateVal === "object" && dateVal !== null && "seconds" in dateVal && typeof (dateVal as DateLike).seconds === "number") {
      d = new Date((dateVal as DateLike).seconds! * 1000);
    } else {
      d = new Date(dateVal);
    }
    return d.toLocaleString("es-EC", { timeZone: "America/Guayaquil", hour12: false });
  } catch {
    return "-";
  }
};

const TAB_ITEMS: Array<{ id: Tab; label: string; icon: ReactNode }> = [
  { id: "detalles", label: "Detalles", icon: <Info size={13} /> },
  { id: "precios", label: "Precios", icon: <DollarSign size={13} /> },
  { id: "historial_precios", label: "Precios hist.", icon: <History size={13} /> },
  { id: "historial_stock", label: "Stock hist.", icon: <Boxes size={13} /> },
];

function Card({
  title,
  subtitle,
  action,
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3 shadow-sm">
      {(title || subtitle || action) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{title}</h3>}
            {subtitle && <p className="mt-1 text-xs text-[var(--text-secondary)]">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-3 shadow-sm ${
        accent
          ? "border-[rgba(59,130,246,0.24)] bg-[rgba(59,130,246,0.08)]"
          : "border-[var(--border-light)] bg-[var(--bg-secondary)]"
      }`}
    >
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        <span className="text-[var(--text-muted)]">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{value}</div>
      {helper && <div className="mt-1 text-[11px] text-[var(--text-muted)]">{helper}</div>}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
        active
          ? "border-[var(--accent)] bg-[rgba(59,130,246,0.1)] text-[var(--accent)]"
          : "border-transparent bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:border-[var(--border-light)] hover:text-[var(--text-primary)]"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default function ProductoDetalleSidebar({ producto, onClose, onUpdate }: ProductoDetalleSidebarProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [activeTab, setActiveTab] = useState<Tab>("detalles");
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [nombre, setNombre] = useState(producto.nombre);
  const [sku, setSku] = useState(producto.sku || "");
  const [categoria, setCategoria] = useState(producto.categoria || "");
  const [unidadMedida, setUnidadMedida] = useState(producto.unidadMedida || "Unidad");
  const [descripcion, setDescripcion] = useState(producto.descripcion || "");

  const [costoBase, setCostoBase] = useState(producto.costoBase || 0);
  const [margenGanancia, setMargenGanancia] = useState(producto.margenGanancia ?? 25);
  const [aplicaIva, setAplicaIva] = useState(producto.aplicaIva);

  const precioSinIvaInicial = Number(producto.costoBase || 0) * (1 + Number(producto.margenGanancia ?? 25) / 100);
  const precioConIvaInicial = precioSinIvaInicial * (producto.aplicaIva ? 1.15 : 1.0);

  const [costoInput, setCostoInput] = useState(String(producto.costoBase || 0));
  const [margenInput, setMargenInput] = useState(String(producto.margenGanancia ?? 25));
  const [precioSinIvaInput, setPrecioSinIvaInput] = useState(precioSinIvaInicial.toFixed(2));
  const [precioConIvaInput, setPrecioConIvaInput] = useState(precioConIvaInicial.toFixed(2));

  const handleCostoChange = (valStr: string) => {
    setCostoInput(valStr);
    const cost = Number(valStr || 0);
    setCostoBase(cost);
    
    const margen = Number(margenInput || 0);
    const sinIva = cost * (1 + margen / 100);
    setPrecioSinIvaInput(sinIva.toFixed(2));
    
    const conIva = sinIva * (aplicaIva ? 1.15 : 1.0);
    setPrecioConIvaInput(conIva.toFixed(2));
  };

  const handleMargenChange = (valStr: string) => {
    setMargenInput(valStr);
    const margen = Number(valStr || 0);
    setMargenGanancia(margen);
    
    const sinIva = costoBase * (1 + margen / 100);
    setPrecioSinIvaInput(sinIva.toFixed(2));
    
    const conIva = sinIva * (aplicaIva ? 1.15 : 1.0);
    setPrecioConIvaInput(conIva.toFixed(2));
  };

  const handlePrecioSinIvaChange = (valStr: string) => {
    setPrecioSinIvaInput(valStr);
    const sinIva = Number(valStr || 0);
    
    let margen = 0;
    if (costoBase > 0) {
      margen = ((sinIva / costoBase) - 1) * 100;
    }
    setMargenInput(margen.toFixed(1));
    setMargenGanancia(Number(margen.toFixed(2)));
    
    const conIva = sinIva * (aplicaIva ? 1.15 : 1.0);
    setPrecioConIvaInput(conIva.toFixed(2));
  };

  const handlePrecioConIvaChange = (valStr: string) => {
    setPrecioConIvaInput(valStr);
    const conIva = Number(valStr || 0);
    
    const sinIva = aplicaIva ? (conIva / 1.15) : conIva;
    setPrecioSinIvaInput(sinIva.toFixed(2));
    
    let margen = 0;
    if (costoBase > 0) {
      margen = ((sinIva / costoBase) - 1) * 100;
    }
    setMargenInput(margen.toFixed(1));
    setMargenGanancia(Number(margen.toFixed(2)));
  };

  const handleAplicaIvaChange = (checked: boolean) => {
    setAplicaIva(checked);
    const sinIva = Number(precioSinIvaInput || 0);
    const conIva = sinIva * (checked ? 1.15 : 1.0);
    setPrecioConIvaInput(conIva.toFixed(2));
  };

  const [historialPrecios, setHistorialPrecios] = useState<HistorialPrecio[]>([]);
  const [movimientosStock, setMovimientosStock] = useState<MovimientoStock[]>([]);
  const [historialError, setHistorialError] = useState<string | null>(null);
  const [stockHistoryError, setStockHistoryError] = useState<string | null>(null);
  const [ordenesMap, setOrdenesMap] = useState<Record<string, string>>({});

  const [mostrarAjusteStock, setMostrarAjusteStock] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState<"entrada" | "salida">("entrada");
  const [cantidadMovimiento, setCantidadMovimiento] = useState("");
  const [notaMovimiento, setNotaMovimiento] = useState("");

  const precioPublicoCalculado = calcularPrecioVenta(costoBase, margenGanancia, aplicaIva);
  const stockActual = Math.floor(Number(producto.stockActual ?? 0));
  const margenMostrado =
    typeof producto.margenGanancia === "number"
      ? producto.margenGanancia
      : Number(producto.costoBase ?? 0) > 0
        ? Number((((Number(producto.precioBase ?? 0) / Number(producto.costoBase ?? 0)) - 1) * 100).toFixed(1))
        : margenGanancia;

  useEffect(() => {
    if (!producto.id) return;
    let active = true;

    if (activeTab === "historial_precios") {
      void Promise.resolve().then(() => {
        if (active) setHistorialError(null);
      });
      void Promise.resolve().then(() => {
        if (active) setCargandoDatos(true);
      });
      getHistorialPrecios(producto.id)
        .then((hist: HistorialPrecio[]) => {
          if (active) setHistorialPrecios(hist);
        })
        .catch(() => {
          if (active) setHistorialError("No se pudo cargar el historial de prices.");
        })
        .finally(() => {
          if (active) setCargandoDatos(false);
        });
    } else if (activeTab === "historial_stock") {
      void Promise.resolve().then(() => {
        if (active) setStockHistoryError(null);
      });
      void Promise.resolve().then(() => {
        if (active) setCargandoDatos(true);
      });
      getMovimientosStockByProducto(producto.id)
        .then(async (movs: MovimientoStock[]) => {
          if (!active) return;
          
          // Extraer IDs de orden de Firestore (20 caracteres alfanumericos)
          const idsEncontrados = new Set<string>();
          movs.forEach((mov: MovimientoStock) => {
            if (mov.nota) {
              const matches = mov.nota.match(/[a-zA-Z0-9]{20}/g);
              if (matches) {
                matches.forEach((id: string) => idsEncontrados.add(id));
              }
            }
          });

          // Cargar ordenes en paralelo para mapear ID -> #OT
          const map: Record<string, string> = {};
          await Promise.all(
            Array.from(idsEncontrados).map(async (id: string) => {
              try {
                const orden = await getOrdenById(id);
                if (orden) {
                  const numDoc = orden.esCotizacion
                    ? (orden.numeroCotizacion ?? orden.numero)
                    : (orden.numeroOrden ?? orden.numero);
                  map[id] = `#OT ${String(numDoc ?? "").padStart(4, "0")}`;
                }
              } catch (e) {
                console.error("Error al cargar orden para nota:", id, e);
              }
            })
          );

          if (active) {
            setOrdenesMap(map);
            setMovimientosStock(movs);
          }
        })
        .catch(() => {
          if (active) setStockHistoryError("No se pudo cargar el historial de stock.");
        })
        .finally(() => {
          if (active) setCargandoDatos(false);
        });
    }

    return () => {
      active = false;
    };
  }, [activeTab, producto.id]);

  const handleGuardarDetalles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!producto.id) return;
    if (!nombre.trim() || !sku.trim()) {
      toast.error("Nombre y SKU son obligatorios");
      return;
    }

    setGuardando(true);
    try {
      await updateProducto(producto.id, {
        nombre: nombre.trim(),
        sku: sku.trim().toUpperCase(),
        categoria: categoria.trim(),
        unidadMedida: unidadMedida.trim(),
        descripcion: descripcion.trim(),
      });
      toast.success("Detalles actualizados");
      onUpdate();
    } catch {
      toast.error("Error al guardar cambios");
    } finally {
      setGuardando(false);
    }
  };

  const handleGuardarPrecios = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!producto.id) return;

    setGuardando(true);
    try {
      await updateProducto(producto.id, {
        costoBase: Number(costoBase),
        margenGanancia: Number(margenGanancia),
        aplicaIva: Boolean(aplicaIva),
      });
      toast.success("Precios actualizados");
      onUpdate();
    } catch {
      toast.error("Error al guardar precios");
    } finally {
      setGuardando(false);
    }
  };

  const handleRegistrarStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!producto.id) return;

    const cantidad = Math.floor(Number(cantidadMovimiento));
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      toast.error("Ingresa una cantidad valida");
      return;
    }

    const nuevoStock = tipoMovimiento === "entrada" ? stockActual + cantidad : stockActual - cantidad;
    if (nuevoStock < 0) {
      toast.error(`No puedes registrar una salida mayor al stock actual (${stockActual})`);
      return;
    }

    setGuardando(true);
    try {
      const stockRegistrado = await registrarMovimientoStockManual(producto, tipoMovimiento, cantidad, notaMovimiento);
      toast.success(`Stock actualizado: ${stockRegistrado}`);
      setMostrarAjusteStock(false);
      setCantidadMovimiento("");
      setNotaMovimiento("");
      onUpdate();

      const movs = await getMovimientosStockByProducto(producto.id);
      setMovimientosStock(movs);
    } catch {
      toast.error("Error al ajustar el stock");
    } finally {
      setGuardando(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[900] flex justify-end bg-slate-950/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <aside className="h-full w-full max-w-lg bg-[var(--bg-card)] shadow-2xl border-l border-[var(--border)] flex flex-col animate-slide-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30">
              <Package size={10} />
              Información del Producto
            </span>
            <h2 className="text-base font-bold mt-2.5 text-[var(--text-primary)] break-words leading-snug">
              {producto.nombre}
            </h2>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[var(--text-muted)] font-mono">
              <Tag size={12} />
              <span>SKU: {producto.sku || "Sin SKU"}</span>
              <span className="text-slate-300 dark:text-slate-800">|</span>
              <Boxes size={12} />
              <span>Stock: {stockActual}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all duration-200 border border-slate-200 dark:border-slate-800 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="flex border-b border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/10 px-6 shrink-0">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-xs font-semibold border-b-2 text-center transition-all ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === "detalles" && (
          <form onSubmit={handleGuardarDetalles} className="space-y-5 animate-fade-in">
            <Card title="Datos básicos">
              <div className="space-y-4">
                <div className="form-group">
                  <label className="label">Nombre *</label>
                  <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="input" required />
                </div>

                <div className="form-group">
                  <label className="label">SKU *</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    className="input uppercase font-mono"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Categoría</label>
                    <input type="text" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input" />
                  </div>

                  <div className="form-group">
                    <label className="label">Unidad de medida</label>
                    <input type="text" value={unidadMedida} onChange={(e) => setUnidadMedida(e.target.value)} className="input" />
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Descripción">
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="input resize-none"
                rows={3}
                placeholder="Descripción del artículo"
              />
            </Card>

            {(producto.ultimaCompraFactura || producto.ultimoProveedorNombre) && (
              <Card title="Última compra" action={<Truck size={14} className="text-[var(--text-muted)]" />}>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)]">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Factura</span>
                    <p className="mt-1 font-semibold text-[var(--text-primary)] font-mono">{producto.ultimaCompraFactura || "-"}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)]">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Fecha</span>
                    <p className="mt-1 font-semibold text-[var(--text-primary)]">{producto.ultimaCompraFecha || "-"}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)]">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Proveedor</span>
                    <p className="mt-1 font-semibold text-[var(--text-primary)] truncate" title={producto.ultimoProveedorNombre}>{producto.ultimoProveedorNombre || "-"}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)]">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">RUC</span>
                    <p className="mt-1 font-semibold text-[var(--text-primary)] font-mono">{producto.ultimoProveedorRuc || "-"}</p>
                  </div>
                </div>
              </Card>
            )}

            <button
              type="submit"
              disabled={guardando}
              className="btn-primary w-full justify-center py-2.5 text-xs font-bold shadow-md cursor-pointer mt-4"
            >
              {guardando ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Guardando cambios...
                </>
              ) : (
                <>
                  <Check size={14} className="mr-1.5" />
                  Guardar cambios
                </>
              )}
            </button>
          </form>
        )}

        {activeTab === "precios" && (
          <form onSubmit={handleGuardarPrecios} className="space-y-5 animate-fade-in">
            {/* Referencia Actual */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Valores de Referencia</p>
                <div className="mt-2 flex items-center gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-[var(--text-secondary)]">Costo actual:</span>{" "}
                    <span className="font-mono font-bold text-[var(--text-primary)]">{formatCurrency(producto.costoBase)}</span>
                  </div>
                  <div className="text-slate-300 dark:text-slate-800">|</div>
                  <div>
                    <span className="text-[var(--text-secondary)]">Precio actual:</span>{" "}
                    <span className="font-mono font-bold text-[var(--text-primary)]">{formatCurrency(producto.precioBase)}</span>
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300 border border-[var(--border)]">
                Precios Activos
              </span>
            </div>

            {/* Ajuste */}
            <Card title="Ajustes de Precios">
              <div className="space-y-4">
                {/* 1. Precio de compra (último) */}
                <div className="form-group">
                  <label className="label">
                    Precio de compra <span className="text-[10px] text-[var(--text-muted)] font-normal normal-case italic ml-0.5">(último)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--text-muted)]">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={costoInput}
                      onChange={(e) => handleCostoChange(e.target.value)}
                      className="input pl-8 font-mono font-semibold"
                      required
                    />
                  </div>
                </div>

                {/* 2. Margen */}
                <div className="form-group">
                  <label className="label">Margen (%)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="0.1"
                        value={margenInput}
                        onChange={(e) => handleMargenChange(e.target.value)}
                        className="input pr-8 font-mono font-semibold"
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--text-muted)]">%</span>
                    </div>
                    {[25, 40].map((margen) => (
                      <button
                        key={margen}
                        type="button"
                        onClick={() => handleMargenChange(String(margen))}
                        className={`btn justify-center w-16 font-semibold text-xs ${Number(margenInput) === margen ? "btn-primary" : "btn-secondary"}`}
                      >
                        {margen}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Precio antes de impuestos */}
                <div className="form-group">
                  <label className="label">Precio antes de impuestos ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--text-muted)]">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={precioSinIvaInput}
                      onChange={(e) => handlePrecioSinIvaChange(e.target.value)}
                      className="input pl-8 font-mono font-semibold"
                      required
                    />
                  </div>
                </div>

                {/* 4. Indicador de IVA o no */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                  <div className="min-w-0 pr-3">
                    <label className="text-xs font-bold text-[var(--text-primary)] block">Aplica IVA (15%)</label>
                    <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">Determina si se agrega el impuesto al precio de venta final</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={aplicaIva}
                    onChange={(e) => handleAplicaIvaChange(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-800 transition-colors cursor-pointer"
                  />
                </div>

                {/* 5. Precio de venta al público */}
                <div className="form-group">
                  <label className="label font-bold text-blue-600 dark:text-blue-400">Precio de venta al público ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--text-muted)]">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={precioConIvaInput}
                      onChange={(e) => handlePrecioConIvaChange(e.target.value)}
                      className="input pl-8 font-mono font-bold text-blue-600 dark:text-blue-400"
                      required
                    />
                  </div>
                </div>

                {/* 6. Margen de ganancia (Previsualización reactiva) */}
                <div className="p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-950/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Margen de ganancia</span>
                    <div className="text-right">
                      <p className="font-mono text-xl font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(Number(precioSinIvaInput || 0) - costoBase)}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                        Utilidad neta ({margenInput}%)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <button
              type="submit"
              disabled={guardando}
              className="btn-primary w-full justify-center py-2.5 text-xs font-bold shadow-md cursor-pointer mt-4"
            >
              {guardando ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Guardando precios...
                </>
              ) : (
                <>
                  <Check size={14} className="mr-1.5" />
                  Guardar Precios
                </>
              )}
            </button>
          </form>
        )}

        {activeTab === "historial_precios" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">Historial de Precios</h4>
              <span className="text-[10px] font-bold text-[var(--text-muted)]">{historialPrecios.length} cambios</span>
            </div>

            {cargandoDatos ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-blue-600 mb-2" />
                <span className="text-xs text-[var(--text-muted)]">Cargando historial...</span>
              </div>
            ) : historialError ? (
              <p className="py-4 text-center text-xs text-red-500">{historialError}</p>
            ) : historialPrecios.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)] text-xs">
                Sin cambios de precio registrados.
              </div>
            ) : (
              <div className="max-h-[480px] overflow-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/80 border-b border-[var(--border)] text-[10px] uppercase text-[var(--text-muted)] font-bold">
                    <tr>
                      <th className="px-3 py-2.5">Fecha</th>
                      <th className="px-3 py-2.5 text-right">Costo</th>
                      <th className="px-3 py-2.5 text-right">Margen</th>
                      <th className="px-3 py-2.5 text-right">Precio Púb.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] bg-white dark:bg-[var(--bg-card)]">
                    {historialPrecios.map((hist) => (
                      <tr key={hist.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                        <td className="px-3 py-2.5 text-[10px] font-mono text-[var(--text-secondary)] whitespace-nowrap align-top">
                          {formatDate(hist.createdAt)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[var(--text-secondary)] align-top">
                          {formatCurrency(hist.costoBase)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[var(--text-secondary)] align-top">
                          {hist.margenGanancia ?? "-"}%
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400 align-top">
                          {formatCurrency(hist.precioBase)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "historial_stock" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">Historial de Stock</h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[var(--text-muted)] mr-1">{movimientosStock.length} movimientos</span>
                <button
                  type="button"
                  onClick={() => setMostrarAjusteStock((prev) => !prev)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all cursor-pointer"
                >
                  {mostrarAjusteStock ? "Cerrar ajuste" : "Nuevo ajuste"}
                </button>
              </div>
            </div>

            {mostrarAjusteStock && (
              <Card title="Ajuste manual de stock">
                <form onSubmit={handleRegistrarStock} className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTipoMovimiento("entrada")}
                      className={`btn justify-center py-2 text-xs font-bold ${tipoMovimiento === "entrada" ? "btn-primary" : "btn-secondary"}`}
                    >
                      <ArrowDownToLine size={13} className="mr-1" /> Entrada
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoMovimiento("salida")}
                      className={`btn justify-center py-2 text-xs font-bold ${tipoMovimiento === "salida" ? "btn-primary" : "btn-secondary"}`}
                    >
                      <ArrowUpFromLine size={13} className="mr-1" /> Salida
                    </button>
                  </div>

                  <div className="form-group">
                    <label className="label">Cantidad *</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={cantidadMovimiento}
                      onChange={(e) => setCantidadMovimiento(e.target.value)}
                      className="input font-mono font-semibold"
                      placeholder="Cantidad"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Motivo / Nota</label>
                    <textarea
                      value={notaMovimiento}
                      onChange={(e) => setNotaMovimiento(e.target.value)}
                      className="input resize-none"
                      rows={2}
                      placeholder="Motivo del ajuste manual"
                    />
                  </div>

                  <button type="submit" disabled={guardando} className="btn-primary w-full justify-center py-2.5 text-xs font-bold shadow-md cursor-pointer">
                    {guardando ? (
                      <>
                        <Loader2 size={14} className="animate-spin mr-1.5" />
                        Registrando...
                      </>
                    ) : (
                      <>
                        <Check size={14} className="mr-1.5" />
                        Registrar ajuste
                      </>
                    )}
                  </button>
                </form>
              </Card>
            )}

            {cargandoDatos ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-blue-600 mb-2" />
                <span className="text-xs text-[var(--text-muted)]">Cargando movimientos...</span>
              </div>
            ) : stockHistoryError ? (
              <p className="py-4 text-center text-xs text-red-500">{stockHistoryError}</p>
            ) : movimientosStock.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)] text-xs">
                Sin movimientos de stock registrados.
              </div>
            ) : (
              <div className="max-h-[480px] overflow-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/80 border-b border-[var(--border)] text-[10px] uppercase text-[var(--text-muted)] font-bold">
                    <tr>
                      <th className="px-3 py-2.5">Fecha</th>
                      <th className="px-3 py-2.5 text-center">Tipo</th>
                      <th className="px-3 py-2.5 text-right">Cant.</th>
                      <th className="px-3 py-2.5 text-right">Stock</th>
                      <th className="px-3 py-2.5">Nota / Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] bg-white dark:bg-[var(--bg-card)]">
                    {movimientosStock.map((mov) => {
                      let notaFormateada = mov.nota || "";
                      Object.entries(ordenesMap).forEach(([id, otLabel]) => {
                        notaFormateada = notaFormateada.replace(id, otLabel);
                      });

                      return (
                        <tr key={mov.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="px-3 py-2.5 text-[10px] font-mono text-[var(--text-secondary)] whitespace-nowrap align-top">
                            {formatDate(mov.createdAt)}
                          </td>
                          <td className="px-3 py-2.5 text-center align-top">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
                                mov.tipo === "entrada"
                                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800/30 dark:text-emerald-400"
                                  : "border border-red-200 bg-red-50 text-red-700 dark:bg-red-950/20 dark:border-red-800/30 dark:text-red-400"
                              }`}
                            >
                              {mov.tipo}
                            </span>
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono font-bold align-top ${mov.tipo === "entrada" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                            {mov.tipo === "entrada" ? "+" : "-"}{mov.cantidad}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap align-top">
                            {mov.stockAnterior} → <span className="font-bold text-[var(--text-primary)]">{mov.stockNuevo}</span>
                          </td>
                          <td className="px-3 py-2.5 text-[var(--text-primary)] break-words max-w-[180px] align-top">
                            {notaFormateada || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-[var(--border)] flex justify-end shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all duration-200 cursor-pointer"
        >
          Cerrar
        </button>
      </div>
    </aside>
  </div>,
  document.getElementById("modal-root") || document.body
);
}
