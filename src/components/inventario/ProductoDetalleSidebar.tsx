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
  Image as ImageIcon,
  Edit2,
  Trash2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Producto, MovimientoStock } from "@/types";
import {
  updateProducto,
  getMovimientosStockByProducto,
  getCompras,
  registrarMovimientoStockManual,
  calcularPrecioVenta,
  getOrdenById,
  uploadInventarioImagen,
  getProductos,
} from "@/lib/services";
import { toast } from "react-hot-toast";
import { useUIStore } from "@/store";

type Tab = "detalles" | "precios" | "historial_precios" | "proveedores" | "historial_stock";

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

type HistorialCompraItem = {
  fecha: string;
  proveedor: string;
  factura: string;
  cantidad: number;
  precioUnitario: number;
};

type ProveedorProductoItem = {
  ruc: string;
  nombre: string;
  transacciones: number;
  totalCantidad: number;
  ultimoCosto: number;
  ultimaFecha: string;
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
  { id: "detalles", label: "Producto", icon: <Info size={13} /> },
  { id: "precios", label: "Precios", icon: <DollarSign size={13} /> },
  { id: "historial_precios", label: "Costos hist.", icon: <History size={13} /> },
  { id: "proveedores", label: "Proveedores", icon: <Truck size={13} /> },
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
  const [isExpanded, setIsExpanded] = useState(false);
  const { sidebarOpen } = useUIStore();

  const [nombre, setNombre] = useState(producto.nombre);
  const [sku, setSku] = useState(producto.sku || "");
  const [categoria, setCategoria] = useState(producto.categoria || "");
  const [fabricante, setFabricante] = useState(producto.fabricante || "");
  const [unidadMedida, setUnidadMedida] = useState(producto.unidadMedida || "Unidad");
  const [descripcion, setDescripcion] = useState(producto.descripcion || "");

  const [categorias, setCategorias] = useState<string[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorProductoItem[]>([]);

  useEffect(() => {
    getProductos()
      .then((prods) => {
        const cats = Array.from(
          new Set(prods.map((p) => p.categoria?.trim()).filter(Boolean) as string[])
        ).sort();
        setCategorias(cats);
      })
      .catch((err) => console.error("Error al cargar categorías:", err));
  }, []);
  
  const [imagenPreview, setImagenPreview] = useState<string | null>(producto.imagenUrl || null);
  const [archivoImagen, setArchivoImagen] = useState<File | null>(null);
  const [eliminarImagen, setEliminarImagen] = useState(false);

  const handleImagenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setArchivoImagen(file);
      setImagenPreview(URL.createObjectURL(file));
      setEliminarImagen(false);
    }
  };

  const handleEliminarImagen = () => {
    setArchivoImagen(null);
    setImagenPreview(null);
    setEliminarImagen(true);
  };

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

  const [historialCompras, setHistorialCompras] = useState<HistorialCompraItem[]>([]);
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

    if (activeTab === "historial_precios" || activeTab === "proveedores") {
      void Promise.resolve().then(() => {
        if (active) setHistorialError(null);
      });
      void Promise.resolve().then(() => {
        if (active) setCargandoDatos(true);
      });
      getCompras()
        .then((todasLasCompras) => {
          if (!active) return;
          const sku = producto.sku?.trim().toUpperCase();
          if (!sku) {
            setHistorialCompras([]);
            setProveedores([]);
            return;
          }
          const history: HistorialCompraItem[] = [];
          const provMap = new Map<string, ProveedorProductoItem>();
          todasLasCompras.forEach((compra) => {
            compra.items.forEach((item) => {
              if (item.codigo?.trim().toUpperCase() === sku) {
                const fechaCompra = compra.fechaEmision || compra.fechaAutorizacion || "";
                history.push({
                  fecha: fechaCompra,
                  proveedor: compra.proveedorRazonSocial,
                  factura: compra.numeroFactura,
                  cantidad: item.cantidad,
                  precioUnitario: item.precioUnitario,
                });

                const ruc = compra.proveedorRuc || "SIN_RUC";
                const nombreProv = compra.proveedorRazonSocial || "Proveedor Desconocido";
                const costo = item.precioUnitario;
                const cant = item.cantidad;

                const prev = provMap.get(ruc);
                if (prev) {
                  prev.transacciones += 1;
                  prev.totalCantidad += cant;
                } else {
                  provMap.set(ruc, {
                    ruc,
                    nombre: nombreProv,
                    transacciones: 1,
                    totalCantidad: cant,
                    ultimoCosto: costo,
                    ultimaFecha: fechaCompra,
                  });
                }
              }
            });
          });
          setHistorialCompras(history);
          setProveedores(Array.from(provMap.values()));
        })
        .catch(() => {
          if (active) setHistorialError("No se pudo cargar el historial de compras/proveedores.");
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

  const hasChanges =
    nombre.trim() !== (producto.nombre || "").trim() ||
    sku.trim().toUpperCase() !== (producto.sku || "").trim().toUpperCase() ||
    categoria.trim() !== (producto.categoria || "").trim() ||
    fabricante.trim() !== (producto.fabricante || "").trim() ||
    unidadMedida.trim() !== (producto.unidadMedida || "Unidad").trim() ||
    descripcion.trim() !== (producto.descripcion || "").trim() ||
    archivoImagen !== null ||
    (Boolean(producto.imagenUrl) && eliminarImagen) ||
    Number(costoBase) !== Number(producto.costoBase || 0) ||
    Number(margenGanancia) !== Number(producto.margenGanancia ?? 25) ||
    Boolean(aplicaIva) !== Boolean(producto.aplicaIva);

  const handleGuardarGlobal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!producto.id) return;
    if (!nombre.trim() || !sku.trim()) {
      toast.error("Nombre y SKU son obligatorios");
      return;
    }

    setGuardando(true);
    try {
      let finalImageUrl = producto.imagenUrl || "";

      if (eliminarImagen) {
        finalImageUrl = "";
      }

      if (archivoImagen) {
        finalImageUrl = await uploadInventarioImagen(producto.id, archivoImagen, "producto");
      }

      const updates: Partial<Producto> = {
        nombre: nombre.trim(),
        sku: sku.trim().toUpperCase(),
        categoria: categoria.trim(),
        unidadMedida: unidadMedida.trim(),
        descripcion: descripcion.trim(),
        imagenUrl: finalImageUrl,
        fabricante: fabricante.trim(),
        costoBase: Number(costoBase),
        margenGanancia: Number(margenGanancia),
        aplicaIva: Boolean(aplicaIva),
      };

      await updateProducto(producto.id, updates);

      setArchivoImagen(null);
      setEliminarImagen(false);
      toast.success("Producto actualizado con éxito");
      onUpdate();
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar cambios");
    } finally {
      setGuardando(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      if (confirm("Tienes cambios sin guardar. ¿Estás seguro de que deseas cerrar y descartar los cambios?")) {
        onClose();
      }
    } else {
      onClose();
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
      className={`fixed inset-0 z-[900] flex justify-end bg-slate-950/50 backdrop-blur-sm animate-fade-in transition-all duration-300 ${
        isExpanded
          ? sidebarOpen
            ? "sidebar-aware-overlay"
            : "sidebar-aware-overlay-collapsed"
          : "left-0"
      }`}
      onClick={handleClose}
    >
      <aside
        className={`h-full w-full bg-[var(--bg-card)] shadow-2xl border-l border-[var(--border)] flex flex-col animate-slide-in transition-all duration-300 ${
          isExpanded ? "max-w-full" : "max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all duration-200 border border-slate-200 dark:border-slate-800 cursor-pointer"
              title={isExpanded ? "Restaurar tamaño" : "Ampliar"}
            >
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all duration-200 border border-slate-200 dark:border-slate-800 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
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
          <form id="form-detalles" onSubmit={handleGuardarGlobal} className="space-y-5 animate-fade-in">
            <div className={isExpanded ? "grid grid-cols-1 lg:grid-cols-3 gap-6 space-y-0 items-start" : "space-y-5"}>
              <Card title="Datos básicos">
                <div className={`space-y-4 ${isExpanded ? "grid grid-cols-2 gap-4 space-y-0" : ""}`}>
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

                  <div className="form-group">
                    <label className="label">Categoría</label>
                    <input
                      type="text"
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                      className="input"
                      list="categorias-sidebar-list"
                      placeholder="Selecciona o escribe una categoría"
                    />
                    <datalist id="categorias-sidebar-list">
                      {categorias.map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>

                  <div className="form-group">
                    <label className="label">Unidad de medida</label>
                    <input type="text" value={unidadMedida} onChange={(e) => setUnidadMedida(e.target.value)} className="input" />
                  </div>

                  <div className={`form-group ${isExpanded ? "col-span-2" : ""}`}>
                    <label className="label">Fabricante</label>
                    <input
                      type="text"
                      value={fabricante}
                      onChange={(e) => setFabricante(e.target.value)}
                      className="input"
                      placeholder="Ej: Bosch, Toyota, etc."
                    />
                  </div>
                </div>
              </Card>

              <Card title="Descripción y Foto">
                <div className="flex gap-4 items-start">
                  <div className="flex-1 min-w-0">
                    <textarea
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      className="input resize-none w-full"
                      rows={isExpanded ? 7 : 3}
                      placeholder="Descripción del artículo"
                    />
                  </div>
                  <div className="w-20 shrink-0">
                    <div className="relative group w-20 h-20 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-all duration-200">
                      {imagenPreview ? (
                        <>
                          <img src={imagenPreview} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                            <label className="p-1 rounded-md bg-white/20 hover:bg-white/40 text-white cursor-pointer transition-colors" title="Cambiar foto">
                              <Edit2 size={12} />
                              <input type="file" accept="image/*" onChange={handleImagenChange} className="hidden" />
                            </label>
                            <button
                              type="button"
                              onClick={handleEliminarImagen}
                              className="p-1 rounded-md bg-red-500/20 hover:bg-red-500/40 text-red-200 hover:text-white transition-colors"
                              title="Eliminar foto"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer text-[var(--text-muted)] hover:text-blue-500 hover:bg-blue-50/20 transition-colors p-2 text-center gap-1">
                          <ImageIcon size={18} />
                          <span className="text-[9px] font-semibold leading-tight">Añadir foto</span>
                          <input type="file" accept="image/*" onChange={handleImagenChange} className="hidden" />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              {(producto.ultimaCompraFactura || producto.ultimoProveedorNombre) && (
                <Card title="Última compra" action={<Truck size={14} className="text-[var(--text-muted)]" />}>
                  <div className={`grid gap-3 text-xs ${isExpanded ? "grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" : "grid-cols-2"}`}>
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
            </div>
          </form>
        )}

        {activeTab === "precios" && (
          <form id="form-precios" onSubmit={handleGuardarGlobal} className="space-y-5 animate-fade-in">
            {!isExpanded && (
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
            )}

            <div className={isExpanded ? "grid grid-cols-1 md:grid-cols-2 gap-6 space-y-0 items-start" : "space-y-5"}>
              <Card title="Ajustes de Precios">
                <div className={`space-y-4 ${isExpanded ? "grid grid-cols-2 gap-4 space-y-0" : ""}`}>
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

                  <div className={`form-group ${isExpanded ? "col-span-2" : ""}`}>
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

                  {!isExpanded && (
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
                  )}
                </div>
              </Card>

              {isExpanded && (
                <div className="space-y-5">
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

                  <div className="p-6 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-950/10 space-y-4">
                    <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Análisis de Utilidad</h4>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[var(--text-secondary)]">Margen de ganancia (Monto)</span>
                      <p className="font-mono text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                        {formatCurrency(Number(precioSinIvaInput || 0) - costoBase)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between border-t border-blue-200/30 dark:border-blue-900/30 pt-3">
                      <span className="text-sm font-semibold text-[var(--text-secondary)]">Porcentaje de Margen</span>
                      <p className="font-mono text-lg font-bold text-[var(--text-primary)]">
                        {margenInput}%
                      </p>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] leading-relaxed border-t border-blue-200/30 dark:border-blue-900/30 pt-3">
                      Este cálculo representa la utilidad neta estimada basada en el precio antes de impuestos y el costo base de adquisición.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </form>
        )}

        {activeTab === "historial_precios" && (
          <div className={`space-y-4 animate-fade-in ${isExpanded ? "max-w-5xl mx-auto" : ""}`}>
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">Compras Registradas del Artículo</h4>
              <span className="text-[10px] font-bold text-[var(--text-muted)]">{historialCompras.length} transacciones</span>
            </div>

            {cargandoDatos ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-blue-600 mb-2" />
                <span className="text-xs text-[var(--text-muted)]">Cargando historial...</span>
              </div>
            ) : historialError ? (
              <p className="py-4 text-center text-xs text-red-500">{historialError}</p>
            ) : historialCompras.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)] text-xs">
                No se encontraron registros de compra para este artículo.
              </div>
            ) : (
              <div className="max-h-[480px] overflow-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/80 border-b border-[var(--border)] text-[10px] uppercase text-[var(--text-muted)] font-bold">
                    <tr>
                      <th className="px-3 py-2.5">Fecha</th>
                      <th className="px-3 py-2.5">Factura / Proveedor</th>
                      <th className="px-3 py-2.5 text-right">Cant.</th>
                      <th className="px-3 py-2.5 text-right">Costo Unit.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] bg-white dark:bg-[var(--bg-card)]">
                    {historialCompras.map((hist, idx) => (
                      <tr key={`${hist.factura}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                        <td className="px-3 py-2.5 text-[10px] font-mono text-[var(--text-secondary)] whitespace-nowrap align-top">
                          {hist.fecha}
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <p className="font-semibold text-[var(--text-primary)] leading-tight">{hist.factura}</p>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate max-w-[180px]">{hist.proveedor}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-medium text-[var(--text-secondary)] align-top">
                          {hist.cantidad}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400 align-top">
                          {formatCurrency(hist.precioUnitario)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "proveedores" && (
          <div className={`space-y-4 animate-fade-in ${isExpanded ? "max-w-5xl mx-auto" : ""}`}>
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">Proveedores del Artículo</h4>
              <span className="text-[10px] font-bold text-[var(--text-muted)]">{proveedores.length} proveedores</span>
            </div>

            {cargandoDatos ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-blue-600 mb-2" />
                <span className="text-xs text-[var(--text-muted)]">Cargando proveedores...</span>
              </div>
            ) : historialError ? (
              <p className="py-4 text-center text-xs text-red-500">{historialError}</p>
            ) : proveedores.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)] text-xs">
                No se encontraron proveedores registrados para este artículo.
              </div>
            ) : (
              <div className="max-h-[480px] overflow-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/80 border-b border-[var(--border)] text-[10px] uppercase text-[var(--text-muted)] font-bold">
                    <tr>
                      <th className="px-3 py-2.5">Proveedor</th>
                      <th className="px-3 py-2.5 text-center">Compras</th>
                      <th className="px-3 py-2.5 text-right">Cant. Total</th>
                      <th className="px-3 py-2.5 text-right">Último Costo</th>
                      <th className="px-3 py-2.5 text-right">Última Compra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] bg-white dark:bg-[var(--bg-card)]">
                    {proveedores.map((prov) => (
                      <tr key={prov.ruc} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                        <td className="px-3 py-2.5 align-top">
                          <p className="font-semibold text-[var(--text-primary)] leading-tight">{prov.nombre}</p>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">{prov.ruc}</p>
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-[var(--text-secondary)] align-top">
                          {prov.transacciones}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[var(--text-secondary)] align-top">
                          {prov.totalCantidad}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400 align-top">
                          {formatCurrency(prov.ultimoCosto)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap align-top">
                          {prov.ultimaFecha}
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
          <div className={`space-y-4 animate-fade-in ${isExpanded ? "max-w-5xl mx-auto" : ""}`}>
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
                <form onSubmit={handleRegistrarStock} className={`space-y-4 ${isExpanded ? "grid grid-cols-2 gap-4 space-y-0 items-end" : ""}`}>
                  <div className={`grid grid-cols-2 gap-2 ${isExpanded ? "col-span-2" : ""}`}>
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
                      className="input resize-none w-full"
                      rows={1}
                      placeholder="Motivo del ajuste manual"
                    />
                  </div>

                  <button type="submit" disabled={guardando} className={`btn-primary w-full justify-center py-2.5 text-xs font-bold shadow-md cursor-pointer ${isExpanded ? "col-span-2" : ""}`}>
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
      <div className="p-6 border-t border-[var(--border)] flex justify-end items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={handleClose}
          className="px-5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all duration-200 cursor-pointer"
        >
          Cerrar
        </button>

        {hasChanges && (
          <button
            type="button"
            onClick={() => handleGuardarGlobal()}
            disabled={guardando}
            className="btn-primary px-5 py-2 text-xs font-bold shadow-md cursor-pointer flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed animate-fade-in"
          >
            {guardando ? (
              <>
                <Loader2 size={14} className="animate-spin mr-1.5" />
                Guardando...
              </>
            ) : (
              <>
                <Check size={14} className="mr-1.5" />
                Guardar cambios
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  </div>,
  document.getElementById("modal-root") || document.body
);
}
