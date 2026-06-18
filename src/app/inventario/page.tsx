"use client";
import { Fragment, useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import AppShell from "@/components/layout/AppShell";
import { Plus, Package, Wrench, Edit2, Trash2, Loader2, Image as ImageIcon, X, Check, Tag, DollarSign, Boxes, Truck, Search, Ruler, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import {
  getProductos, getServicios, createProducto, updateProducto, deleteProducto,
  createServicio, updateServicio, deleteServicio, uploadInventarioImagen,
  registrarMovimientoStockManual
} from "@/lib/services";
import { Producto, Servicio } from "@/types";

type Tab = "productos" | "servicios";
type InventarioItem = Producto | Servicio;
type InventarioForm = {
  nombre: string;
  descripcion?: string;
  precioBase: number | string;
  costoBase: number | string;
  margenGanancia?: number | string;
  aplicaIva: boolean;
  sku?: string;
  stockActual?: number | string;
  categoria?: string;
  unidadMedida?: string;
};

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

type TipoMovimientoStock = "entrada" | "salida";
type GrupoProductos = {
  categoria: string;
  productos: Producto[];
};

const formatCurrency = (value: number | undefined) => `$${Number(value ?? 0).toFixed(2)}`;
const IVA_RATE = 15;
const SIN_CATEGORIA_LABEL = "Sin categoria";

function normalizarMargenGanancia(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 25;
}

function calcularPrecioVenta(costoBase: number, margenGanancia: number, aplicaIva = false): number {
  const precioConMargen = Number(costoBase || 0) * (1 + margenGanancia / 100);
  const precioFinal = aplicaIva ? precioConMargen * (1 + IVA_RATE / 100) : precioConMargen;
  return Number(precioFinal.toFixed(2));
}

function resolverMargenProducto(producto: Producto): number {
  if (typeof producto.margenGanancia === "number") return producto.margenGanancia;
  const costoBase = Number(producto.costoBase ?? 0);
  if (costoBase <= 0) return 25;
  return Number(((Number(producto.precioBase ?? 0) / costoBase - 1) * 100).toFixed(2));
}
const PRODUCT_UNITS = ["Unidad", "Litro", "Galón", "Metro", "Kilogramo", "Gramo", "Caja", "Par", "Juego"];

function isProducto(item: InventarioItem): item is Producto {
  return "sku" in item;
}

function Modal({ isOpen, onClose, title, children }: ModalProps) {
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-all duration-200 ${isOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"}`}>
      <div className={`bg-[var(--bg-card)] rounded-xl shadow-2xl max-w-lg w-full p-6 relative transition-transform duration-200 ${isOpen ? "scale-100" : "scale-95"} max-h-[90vh] overflow-y-auto`}>
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <X size={20} />
        </button>
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ProductoDetalle({
  item,
  onClose,
  onEdit,
  isMobile = false,
}: {
  item: InventarioItem | null;
  onClose: () => void;
  onEdit: (item: InventarioItem) => void;
  isMobile?: boolean;
}) {
  if (!item) {
    return (
      <div className="h-full rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] p-6 flex flex-col items-center justify-center text-center">
        <Package size={32} className="text-[var(--text-muted)] mb-3" />
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Selecciona un producto</h2>
        <p className="text-xs mt-1 text-[var(--text-muted)]">
          Toca una fila para ver su informaci&oacute;n aqu&iacute;.
        </p>
      </div>
    );
  }

  const producto = isProducto(item) ? item : null;
  const margenGanancia = producto ? resolverMargenProducto(producto) : null;
  const margen = Number(item.precioBase ?? 0) - Number(item.costoBase ?? 0);

  return (
    <aside className="h-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase font-bold tracking-wide text-[var(--text-muted)]">
            {producto ? "Producto" : "Servicio"}
          </p>
          <h2 className="text-base font-bold text-[var(--text-primary)] truncate">{item.nombre}</h2>
        </div>
        <button type="button" onClick={onClose} className="btn-ghost btn-icon shrink-0" aria-label="Cerrar detalle">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="aspect-[4/3] rounded-xl border border-[var(--border)] bg-[var(--bg-body)] overflow-hidden flex items-center justify-center">
          {item.imagenUrl ? (
            <img src={item.imagenUrl} alt={item.nombre} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
              <ImageIcon size={32} />
              <span className="text-xs">Sin imagen</span>
            </div>
          )}
        </div>

        {item.descripcion && (
          <div>
            <p className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Descripci&oacute;n</p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.descripcion}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)] p-3">
            <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
              <DollarSign size={14} />
              <p className="text-[10px] uppercase font-bold">Costo</p>
            </div>
            <p className="font-bold text-sm text-[var(--text-primary)]">{formatCurrency(item.costoBase)}</p>
          </div>
          <div className="rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)] p-3">
            <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
              <Tag size={14} />
              <p className="text-[10px] uppercase font-bold">Precio</p>
            </div>
            <p className="font-bold text-sm text-[var(--text-primary)]">{formatCurrency(item.precioBase)}</p>
          </div>
          <div className="rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)] p-3">
            <p className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Margen</p>
            <p className={`font-bold text-sm ${margen >= 0 ? "text-[var(--success)]" : "text-red-500"}`}>
              {producto && margenGanancia ? `${margenGanancia}%` : formatCurrency(margen)}
            </p>
            {producto && <p className="text-[11px] mt-1 text-[var(--text-muted)]">{formatCurrency(margen)} utilidad</p>}
          </div>
          <div className="rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)] p-3">
            <p className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">IVA</p>
            <p className="font-bold text-sm text-[var(--text-primary)]">{item.aplicaIva ? "Con IVA" : "Sin IVA"}</p>
          </div>
        </div>

        {producto && (
          <div className="space-y-3">
            <div className="rounded-lg border border-[var(--border)] p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <Tag size={15} />
                <span className="text-xs font-semibold">SKU</span>
              </div>
              <span className="text-sm font-mono font-bold text-[var(--text-primary)]">{producto.sku || "-"}</span>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <Package size={15} />
                <span className="text-xs font-semibold">Categor&iacute;a</span>
              </div>
              <span className="text-sm font-bold text-[var(--text-primary)] text-right">{producto.categoria || "-"}</span>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <Ruler size={15} />
                <span className="text-xs font-semibold">Unidad de medida</span>
              </div>
              <span className="text-sm font-bold text-[var(--text-primary)] text-right">{producto.unidadMedida || "-"}</span>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <Boxes size={15} />
                <span className="text-xs font-semibold">Stock actual</span>
              </div>
              <span className="text-sm font-bold text-[var(--text-primary)]">
                {Math.floor(Number(producto.stockActual ?? 0))}
              </span>
            </div>
            {(producto.ultimaCompraFactura || producto.ultimoProveedorNombre) && (
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2">
                  <Truck size={15} />
                  <span className="text-xs font-semibold">&Uacute;ltima compra</span>
                </div>
                <div className="space-y-1 text-xs text-[var(--text-secondary)]">
                  <p>Factura: <span className="font-semibold">{producto.ultimaCompraFactura || "-"}</span></p>
                  <p>Fecha: <span className="font-semibold">{producto.ultimaCompraFecha || "-"}</span></p>
                  <p>Proveedor: <span className="font-semibold">{producto.ultimoProveedorNombre || "-"}</span></p>
                  <p>RUC: <span className="font-semibold">{producto.ultimoProveedorRuc || "-"}</span></p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-card)]">
        <button
          type="button"
          onClick={() => onEdit(item)}
          className={`btn-primary w-full justify-center ${isMobile ? "py-3" : ""}`}
        >
          <Edit2 size={16} /> Editar
        </button>
      </div>
    </aside>
  );
}

export default function InventarioPage() {
  const [tab, setTab] = useState<Tab>("productos");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [cargando, setCargando] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [itemEditando, setItemEditando] = useState<Producto | Servicio | null>(null);
  const [guardando, setGuardando] = useState(false);
  
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [archivoImagen, setArchivoImagen] = useState<File | null>(null);
  const [togglingIva, setTogglingIva] = useState<Set<string>>(new Set());
  const [togglingMargen, setTogglingMargen] = useState<Set<string>>(new Set());
  const [itemSeleccionado, setItemSeleccionado] = useState<InventarioItem | null>(null);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroUnidad, setFiltroUnidad] = useState("");
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [productoStock, setProductoStock] = useState<Producto | null>(null);
  const [tipoMovimientoStock, setTipoMovimientoStock] = useState<TipoMovimientoStock>("entrada");
  const [cantidadMovimientoStock, setCantidadMovimientoStock] = useState("");
  const [notaMovimientoStock, setNotaMovimientoStock] = useState("");
  const [guardandoStock, setGuardandoStock] = useState(false);
  const [costoBaseForm, setCostoBaseForm] = useState(0);
  const [margenGananciaForm, setMargenGananciaForm] = useState<number>(25);
  const [aplicaIvaForm, setAplicaIvaForm] = useState(true);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<InventarioForm>();
  const precioVentaCalculado = calcularPrecioVenta(costoBaseForm, margenGananciaForm, aplicaIvaForm);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [prods, servs] = await Promise.all([getProductos(), getServicios()]);
      setProductos(prods);
      setServicios(servs);
    } catch {
      toast.error("Error al cargar datos");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(cargarDatos);
  }, []);

  const abrirModalNuevo = () => {
    setItemEditando(null);
    setImagenPreview(null);
    setArchivoImagen(null);
    setCostoBaseForm(0);
    setMargenGananciaForm(25);
    setAplicaIvaForm(true);
    reset({
      nombre: "", descripcion: "", precioBase: 0, costoBase: 0, aplicaIva: true, sku: "", stockActual: 0,
      categoria: "", unidadMedida: "Unidad", margenGanancia: 25,
    });
    setModalOpen(true);
  };

  const abrirModalEditar = (item: Producto | Servicio) => {
    setItemEditando(item);
    setImagenPreview(item.imagenUrl || null);
    setArchivoImagen(null);
    setCostoBaseForm(Number(item.costoBase ?? 0));
    setMargenGananciaForm(isProducto(item) ? resolverMargenProducto(item) : 25);
    setAplicaIvaForm(item.aplicaIva);
    reset({
      nombre: item.nombre,
      descripcion: item.descripcion ?? "",
      precioBase: item.precioBase,
      costoBase: item.costoBase,
      margenGanancia: isProducto(item) ? resolverMargenProducto(item) : 25,
      aplicaIva: item.aplicaIva,
      sku: isProducto(item) ? item.sku : "",
      stockActual: isProducto(item) ? item.stockActual ?? 0 : 0,
      categoria: isProducto(item) ? item.categoria ?? "" : "",
      unidadMedida: isProducto(item) ? item.unidadMedida ?? "Unidad" : "Unidad",
    });
    setModalOpen(true);
  };

  const handleImagenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setArchivoImagen(file);
      setImagenPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: InventarioForm) => {
    setGuardando(true);
    try {
      let finalImageUrl = itemEditando?.imagenUrl || "";

      const basePayload = {
        nombre: data.nombre,
        descripcion: data.descripcion,
        costoBase: Number(data.costoBase),
        aplicaIva: Boolean(data.aplicaIva),
        imagenUrl: finalImageUrl,
      };

      if (tab === "productos") {
        const margenGanancia = normalizarMargenGanancia(data.margenGanancia);
        const payload: Omit<Producto, "id"> = {
          ...basePayload,
          margenGanancia,
          precioBase: calcularPrecioVenta(Number(data.costoBase), margenGanancia, Boolean(data.aplicaIva)),
          sku: data.sku ?? "",
          stockActual: Math.floor(Number(data.stockActual ?? 0)),
          categoria: data.categoria?.trim() ?? "",
          unidadMedida: data.unidadMedida?.trim() ?? "",
        };
        
        let savedId = itemEditando?.id;
        if (savedId) {
          await updateProducto(savedId, payload);
        } else {
          savedId = await createProducto(payload);
        }

        if (archivoImagen && savedId) {
          finalImageUrl = await uploadInventarioImagen(savedId, archivoImagen, "producto");
          await updateProducto(savedId, { imagenUrl: finalImageUrl });
        }
      } else {
        const payload: Omit<Servicio, "id"> = {
          ...basePayload,
          precioBase: Number(data.precioBase),
        };
        let savedId = itemEditando?.id;
        if (savedId) {
          await updateServicio(savedId, payload);
        } else {
          savedId = await createServicio(payload);
        }

        if (archivoImagen && savedId) {
          finalImageUrl = await uploadInventarioImagen(savedId, archivoImagen, "servicio");
          await updateServicio(savedId, { imagenUrl: finalImageUrl });
        }
      }

      toast.success(`${tab === "productos" ? "Producto" : "Servicio"} guardado`);
      setModalOpen(false);
      void cargarDatos();
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarItem = async (id: string, isProduct: boolean) => {
    if (!confirm(`¿Estás seguro de eliminar este ${isProduct ? "producto" : "servicio"}?`)) return;
    try {
      if (isProduct) await deleteProducto(id);
      else await deleteServicio(id);
      setItemSeleccionado((prev) => prev?.id === id ? null : prev);
      toast.success("Eliminado correctamente");
      cargarDatos();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const toggleIva = async (item: Producto | Servicio) => {
    if (togglingIva.has(item.id!)) return;
    setTogglingIva((prev) => new Set(prev).add(item.id!));
    try {
      const nuevoValor = !item.aplicaIva;
      if (tab === "productos") {
        await updateProducto(item.id!, { aplicaIva: nuevoValor });
      } else {
        await updateServicio(item.id!, { aplicaIva: nuevoValor });
      }
      setProductos((prev) =>
        prev.map((p) => {
          if (p.id !== item.id) return p;
          const precioBase = calcularPrecioVenta(Number(p.costoBase ?? 0), resolverMargenProducto(p), nuevoValor);
          return { ...p, aplicaIva: nuevoValor, precioBase };
        })
      );
      setServicios((prev) => prev.map((s) => s.id === item.id ? { ...s, aplicaIva: nuevoValor } : s));
      setItemSeleccionado((prev) => {
        if (!prev || prev.id !== item.id) return prev;
        if (!isProducto(prev)) return { ...prev, aplicaIva: nuevoValor } as InventarioItem;
        const precioBase = calcularPrecioVenta(Number(prev.costoBase ?? 0), resolverMargenProducto(prev), nuevoValor);
        return { ...prev, aplicaIva: nuevoValor, precioBase } as InventarioItem;
      });
    } catch {
      toast.error("Error al cambiar IVA");
    } finally {
      setTogglingIva((prev) => { const next = new Set(prev); next.delete(item.id!); return next; });
    }
  };

  const cambiarMargenProducto = async (producto: Producto, margenGanancia: number) => {
    if (!producto.id || togglingMargen.has(producto.id)) return;
    const margenActual = resolverMargenProducto(producto);
    if (margenActual === margenGanancia) return;

    setTogglingMargen((prev) => new Set(prev).add(producto.id!));
    try {
      const precioBase = calcularPrecioVenta(Number(producto.costoBase ?? 0), margenGanancia, producto.aplicaIva);
      await updateProducto(producto.id, { margenGanancia });
      const actualizado = { ...producto, margenGanancia, precioBase };

      setProductos((prev) => prev.map((item) => (item.id === producto.id ? actualizado : item)));
      setItemSeleccionado((prev) => {
        if (!prev || prev.id !== producto.id || !isProducto(prev)) return prev;
        return { ...prev, margenGanancia, precioBase };
      });
      toast.success(`Margen actualizado al ${margenGanancia}%`);
    } catch (error) {
      console.error(error);
      toast.error("Error al cambiar margen");
    } finally {
      setTogglingMargen((prev) => {
        const next = new Set(prev);
        next.delete(producto.id!);
        return next;
      });
    }
  };

  const abrirModalStock = (producto: Producto) => {
    setProductoStock(producto);
    setTipoMovimientoStock("entrada");
    setCantidadMovimientoStock("");
    setNotaMovimientoStock("");
    setStockModalOpen(true);
  };

  const registrarMovimientoStock = async () => {
    if (!productoStock?.id) return;
    const cantidad = Math.floor(Number(cantidadMovimientoStock));
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      toast.error("Ingresa una cantidad valida");
      return;
    }

    const stockActual = Math.floor(Number(productoStock.stockActual ?? 0));
    const nuevoStock = tipoMovimientoStock === "entrada"
      ? stockActual + cantidad
      : stockActual - cantidad;

    if (nuevoStock < 0) {
      toast.error(`No puedes registrar una salida mayor al stock actual (${stockActual})`);
      return;
    }

    setGuardandoStock(true);
    try {
      const stockRegistrado = await registrarMovimientoStockManual(
        productoStock,
        tipoMovimientoStock,
        cantidad,
        notaMovimientoStock
      );
      setProductos((prev) =>
        prev.map((producto) =>
          producto.id === productoStock.id ? { ...producto, stockActual: stockRegistrado } : producto
        )
      );
      setItemSeleccionado((prev) => {
        if (!prev || prev.id !== productoStock.id || !isProducto(prev)) return prev;
        return { ...prev, stockActual: stockRegistrado };
      });
      toast.success(`Stock actualizado: ${stockRegistrado}`);
      setStockModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar stock");
    } finally {
      setGuardandoStock(false);
    }
  };

  const cambiarTab = (nextTab: Tab) => {
    setTab(nextTab);
    setItemSeleccionado(null);
  };

  const categoriasProducto = useMemo(() => {
    return Array.from(new Set(productos.map((p) => p.categoria?.trim()).filter(Boolean) as string[])).sort();
  }, [productos]);

  const unidadesProducto = useMemo(() => {
    return Array.from(new Set(productos.map((p) => p.unidadMedida?.trim()).filter(Boolean) as string[])).sort();
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    const term = busquedaProducto.trim().toLowerCase();
    return productos.filter((producto) => {
      const matchesSearch = !term || [
        producto.nombre,
        producto.descripcion,
        producto.sku,
        producto.categoria,
        producto.unidadMedida,
      ].some((value) => String(value ?? "").toLowerCase().includes(term));
      const matchesCategoria = !filtroCategoria || producto.categoria?.trim() === filtroCategoria;
      const matchesUnidad = !filtroUnidad || producto.unidadMedida?.trim() === filtroUnidad;
      return matchesSearch && matchesCategoria && matchesUnidad;
    });
  }, [busquedaProducto, filtroCategoria, filtroUnidad, productos]);

  const productosAgrupados = useMemo<GrupoProductos[]>(() => {
    const grupos = new Map<string, Producto[]>();

    productosFiltrados.forEach((producto) => {
      const categoria = producto.categoria?.trim() || SIN_CATEGORIA_LABEL;
      const productosCategoria = grupos.get(categoria) ?? [];
      productosCategoria.push(producto);
      grupos.set(categoria, productosCategoria);
    });

    return Array.from(grupos, ([categoria, productosGrupo]) => ({
      categoria,
      productos: productosGrupo,
    })).sort((a, b) => {
      if (a.categoria === SIN_CATEGORIA_LABEL) return 1;
      if (b.categoria === SIN_CATEGORIA_LABEL) return -1;
      return a.categoria.localeCompare(b.categoria, "es", { sensitivity: "base" });
    });
  }, [productosFiltrados]);

  const itemsMostrados: InventarioItem[] = tab === "productos" ? productosFiltrados : servicios;

  return (
    <AppShell>
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Productos y Servicios</h1>
          <p className="page-subtitle">Gestiona tu inventario y catálogo de servicios</p>
        </div>
        <button onClick={abrirModalNuevo} className="btn-primary">
          <Plus size={18} /> Nuevo {tab === "productos" ? "Producto" : "Servicio"}
        </button>
      </div>

      <div className="flex border-b border-[var(--border)] mb-6">
        <button
          className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
            tab === "productos" ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
          onClick={() => cambiarTab("productos")}
        >
          <div className="flex items-center gap-2">
            <Package size={16} /> Productos
          </div>
        </button>
        <button
          className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
            tab === "servicios" ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
          onClick={() => cambiarTab("servicios")}
        >
          <div className="flex items-center gap-2">
            <Wrench size={16} /> Servicios
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
      <div className="card min-w-0">
        {cargando ? (
          <div className="flex justify-center p-8">
            <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
          </div>
        ) : (
          <div className="space-y-4">
            {tab === "productos" && (
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px_180px] gap-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="search"
                    value={busquedaProducto}
                    onChange={(e) => setBusquedaProducto(e.target.value)}
                    placeholder="Buscar por nombre, SKU, categor&iacute;a..."
                    className="input pl-9"
                  />
                </div>
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className="input"
                  aria-label="Filtrar por categor&iacute;a"
                >
                  <option value="">Todas las categor&iacute;as</option>
                  {categoriasProducto.map((categoria) => (
                    <option key={categoria} value={categoria}>{categoria}</option>
                  ))}
                </select>
                <select
                  value={filtroUnidad}
                  onChange={(e) => setFiltroUnidad(e.target.value)}
                  className="input"
                  aria-label="Filtrar por unidad de medida"
                >
                  <option value="">Todas las unidades</option>
                  {unidadesProducto.map((unidad) => (
                    <option key={unidad} value={unidad}>{unidad}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-sm">
                  <th className="pb-3 px-4 font-semibold">Imagen</th>
                  {tab === "productos" && <th className="pb-3 px-4 font-semibold">SKU</th>}
                  <th className="pb-3 px-4 font-semibold">Nombre</th>
                  <th className="pb-3 px-4 font-semibold">Costo Base</th>
                  {tab === "productos" && <th className="pb-3 px-4 font-semibold">Margen</th>}
                  {tab !== "productos" && <th className="pb-3 px-4 font-semibold">IVA</th>}
                  <th className="pb-3 px-4 font-semibold">Precio P&uacute;blico</th>
                  {tab === "productos" && <th className="pb-3 px-4 font-semibold">Stock</th>}
                  <th className="pb-3 px-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {itemsMostrados.length === 0 ? (
                  <tr>
                    <td colSpan={tab === "productos" ? 8 : 6} className="text-center py-8 text-[var(--text-muted)]">
                      {tab === "productos" && (busquedaProducto || filtroCategoria || filtroUnidad)
                        ? "No hay productos que coincidan con la busqueda o filtros."
                        : `No hay ${tab} registrados.`}
                    </td>
                  </tr>
                ) : tab === "productos" ? (
                  productosAgrupados.map((grupo) => (
                    <Fragment key={grupo.categoria}>
                      <tr className="bg-[var(--bg-secondary)] border-y border-[var(--border)]">
                        <td colSpan={8} className="py-2.5 px-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <Tag size={14} className="text-[var(--accent)] shrink-0" />
                              <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-primary)] truncate">
                                {grupo.categoria}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-[var(--text-muted)] whitespace-nowrap">
                              {grupo.productos.length} {grupo.productos.length === 1 ? "producto" : "productos"}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {grupo.productos.map((item) => {
                        const itemId = item.id ?? "";
                        const producto = item;
                        const isSelected = itemSeleccionado?.id === item.id;
                        return (
                        <tr
                          key={itemId || `${grupo.categoria}-${item.nombre}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => setItemSeleccionado(item)}
                          onPointerUp={(e) => {
                            if ((e.target as HTMLElement).closest("button")) return;
                            setItemSeleccionado(item);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setItemSeleccionado(item);
                            }
                          }}
                          className={`border-b border-[var(--border)] last:border-0 transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-[rgba(37,99,235,0.08)] ring-1 ring-inset ring-[var(--accent)]"
                              : "hover:bg-[var(--bg-body)]"
                          }`}
                        >
                          <td className="py-3 px-4">
                            {item.imagenUrl ? (
                              <img src={item.imagenUrl} alt={item.nombre} className="w-10 h-10 object-cover rounded-md bg-[var(--bg-card)] border border-[var(--border)]" />
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-[var(--bg-body)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)]">
                                <ImageIcon size={16} />
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm">{producto.sku}</td>
                          <td className="py-3 px-4 text-sm">
                            <span className="font-semibold text-[var(--text-primary)]">{item.nombre}</span>
                            {item.descripcion && <span className="text-[var(--text-muted)] ml-2 truncate max-w-[200px] inline-block align-bottom">{item.descripcion}</span>}
                          </td>
                          <td className="py-3 px-4 text-sm">${Number(item.costoBase).toFixed(2)}</td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              disabled={togglingMargen.has(itemId)}
                              onClick={(e) => {
                                e.stopPropagation();
                                const actual = resolverMargenProducto(producto);
                                const nuevo = actual === 25 ? 40 : 25;
                                cambiarMargenProducto(producto, nuevo);
                              }}
                              className={`text-xs px-2 py-1 rounded-full font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait ${
                                resolverMargenProducto(producto) === 40
                                  ? 'bg-[rgba(16,185,129,0.1)] text-emerald-500 hover:bg-[rgba(16,185,129,0.2)]'
                                  : 'bg-[rgba(59,130,246,0.1)] text-blue-500 hover:bg-[rgba(59,130,246,0.2)]'
                              }`}
                            >
                              {togglingMargen.has(itemId) ? '...' : `${resolverMargenProducto(producto)}%`}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-sm font-bold text-[var(--text-primary)] whitespace-nowrap text-right">
                            ${Number(item.precioBase).toFixed(2)}
                            {item.aplicaIva && (
  <span
    className="inline-block w-2 h-2 rounded-full bg-emerald-500 ml-2 -mr-2 cursor-help"
    title="Este producto registra IVA"
  />
)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirModalStock(producto);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    abrirModalStock(producto);
                                  }
                                }}
                                className="text-sm font-semibold text-[var(--text-primary)] min-w-8 cursor-pointer"
                              >
                                {Math.floor(Number(producto.stockActual ?? 0))}
                              </span>

                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirModalEditar(item);
                                }}
                                className="p-2 rounded-lg bg-[var(--bg-body)] hover:bg-[var(--bg-hover)] text-[var(--accent)] transition-colors"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  eliminarItem(itemId, true);
                                }}
                                className="p-2 rounded-lg bg-[var(--bg-body)] hover:bg-red-500 hover:text-white text-red-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </Fragment>
                  ))
                ) : (
                  itemsMostrados.map((item) => {
                    const itemId = item.id ?? "";
                    const isSelected = itemSeleccionado?.id === item.id;
                    return (
                    <tr
                      key={itemId || item.nombre}
                      role="button"
                      tabIndex={0}
                      onClick={() => setItemSeleccionado(item)}
                      onPointerUp={(e) => {
                        if ((e.target as HTMLElement).closest("button")) return;
                        setItemSeleccionado(item);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setItemSeleccionado(item);
                        }
                      }}
                      className={`border-b border-[var(--border)] last:border-0 transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-[rgba(37,99,235,0.08)] ring-1 ring-inset ring-[var(--accent)]"
                          : "hover:bg-[var(--bg-body)]"
                      }`}
                    >
                      <td className="py-3 px-4">
                        {item.imagenUrl ? (
                          <img src={item.imagenUrl} alt={item.nombre} className="w-10 h-10 object-cover rounded-md bg-[var(--bg-card)] border border-[var(--border)]" />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-[var(--bg-body)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)]">
                            <ImageIcon size={16} />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span className="font-semibold text-[var(--text-primary)]">{item.nombre}</span>
                        {item.descripcion && <span className="text-[var(--text-muted)] ml-2 truncate max-w-[200px] inline-block align-bottom">{item.descripcion}</span>}
                      </td>
                      <td className="py-3 px-4 text-sm">${Number(item.costoBase).toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          disabled={togglingIva.has(itemId)}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleIva(item);
                          }}
                          className={`text-xs px-2 py-1 rounded-full font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait ${
                            item.aplicaIva
                              ? 'bg-[rgba(16,185,129,0.1)] text-emerald-500 hover:bg-[rgba(16,185,129,0.2)]'
                              : 'bg-[var(--bg-body)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          {togglingIva.has(itemId) ? '...' : item.aplicaIva ? 'Con IVA' : 'Sin IVA'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-sm font-bold text-[var(--text-primary)] whitespace-nowrap text-right">
                        ${Number(item.precioBase).toFixed(2)}
                        {item.aplicaIva && (
  <span
    className="inline-block w-2 h-2 rounded-full bg-emerald-500 ml-2 -mr-2 cursor-help"
    title="Este producto registra IVA"
  />
)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirModalEditar(item);
                            }}
                            className="p-2 rounded-lg bg-[var(--bg-body)] hover:bg-[var(--bg-hover)] text-[var(--accent)] transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              eliminarItem(itemId, false);
                            }}
                            className="p-2 rounded-lg bg-[var(--bg-body)] hover:bg-red-500 hover:text-white text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

        <div className="hidden lg:block sticky top-24 h-[calc(100vh-8rem)]">
          <ProductoDetalle
            item={itemSeleccionado}
            onClose={() => setItemSeleccionado(null)}
            onEdit={abrirModalEditar}
          />
        </div>
      </div>

      {itemSeleccionado && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setItemSeleccionado(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-[420px] p-3">
            <ProductoDetalle
              item={itemSeleccionado}
              onClose={() => setItemSeleccionado(null)}
              onEdit={abrirModalEditar}
              isMobile
            />
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={itemEditando ? `Editar ${tab === "productos" ? "Producto" : "Servicio"}` : `Nuevo ${tab === "productos" ? "Producto" : "Servicio"}`}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-20 h-20 rounded-xl bg-[var(--bg-body)] border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center text-[var(--text-muted)] overflow-hidden flex-shrink-0 relative">
              {imagenPreview ? (
                <img src={imagenPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={24} />
              )}
              <input type="file" accept="image/*" onChange={handleImagenChange} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            <div className="text-sm text-[var(--text-muted)]">
              <p className="font-semibold text-[var(--text-primary)]">Imagen del {tab === "productos" ? "producto" : "servicio"}</p>
              <p>Haz clic para subir una imagen (opcional)</p>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Nombre *</label>
            <input className={`input ${errors.nombre ? "border-red-500" : ""}`} {...register("nombre", { required: true })} />
          </div>
          
          <div className="form-group">
            <label className="label">Descripción</label>
            <textarea className="input resize-none" rows={2} {...register("descripcion")} />
          </div>

          {tab === "productos" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label">SKU *</label>
                <input className={`input uppercase font-mono ${errors.sku ? "border-red-500" : ""}`} {...register("sku", { required: tab === "productos" })} />
              </div>
              <div className="form-group">
                <label className="label">Stock actual</label>
                <input type="number" step="1" min="0" className="input font-mono" {...register("stockActual", { min: 0 })} />
              </div>
            </div>
          )}

          {tab === "productos" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label">Categor&iacute;a</label>
                <input
                  className="input"
                  list="categorias-producto"
                  placeholder="Escribe o selecciona"
                  {...register("categoria")}
                />
                <datalist id="categorias-producto">
                  {categoriasProducto.map((categoria) => (
                    <option key={categoria} value={categoria} />
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <label className="label">Unidad de medida</label>
                <input className="input" list="unidades-producto" {...register("unidadMedida")} />
                <datalist id="unidades-producto">
                  {Array.from(new Set([...PRODUCT_UNITS, ...unidadesProducto])).map((unidad) => (
                    <option key={unidad} value={unidad} />
                  ))}
                </datalist>
              </div>
            </div>
          )}

          {tab === "productos" ? (
            <div className="space-y-4">
              <input type="hidden" {...register("margenGanancia")} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Costo Base *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">$</span>
                    <input
                      type="number"
                      step="0.01"
                      className={`input pl-8 ${errors.costoBase ? "border-red-500" : ""}`}
                      {...register("costoBase", {
                        required: true,
                        min: 0,
                        onChange: (event) => setCostoBaseForm(Number(event.target.value || 0)),
                      })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">Precio p&uacute;blico</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">$</span>
                    <input
                      type="text"
                      readOnly
                      value={precioVentaCalculado.toFixed(2)}
                      className="input pl-8 font-mono bg-[var(--bg-secondary)]"
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="label">Margen de ganancia</label>
                <div className="grid grid-cols-2 gap-2">
                  {[25, 40].map((margen) => (
                    <button
                      key={margen}
                      type="button"
                      onClick={() => {
                        const nextMargen = margen as 25 | 40;
                        setMargenGananciaForm(nextMargen);
                        setValue("margenGanancia", nextMargen, { shouldDirty: true });
                      }}
                      className={`btn justify-center ${
                        margenGananciaForm === margen ? "btn-primary" : "btn-secondary"
                      }`}
                    >
                      {margen}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label">Costo Base *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">$</span>
                  <input type="number" step="0.01" className={`input pl-8 ${errors.costoBase ? "border-red-500" : ""}`} {...register("costoBase", { required: true, min: 0 })} />
                </div>
              </div>
              <div className="form-group">
                <label className="label">Precio Base *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">$</span>
                  <input type="number" step="0.01" className={`input pl-8 ${errors.precioBase ? "border-red-500" : ""}`} {...register("precioBase", { required: true, min: 0 })} />
                </div>
              </div>
            </div>
          )}

          <div className="form-group mt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)]"
                {...register("aplicaIva", {
                  onChange: (event) => {
                    if (event.target.checked !== aplicaIvaForm && !confirm("¿Segura que deseas cambiarlo?")) {
                      event.target.checked = aplicaIvaForm;
                    } else {
                      setAplicaIvaForm(event.target.checked);
                    }
                  },
                })}
              />
              <span className="text-sm font-medium text-[var(--text-primary)]">Aplica IVA (15%)</span>
            </label>
          </div>

          <button type="submit" disabled={guardando} className="btn-primary w-full mt-6 justify-center">
            {guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        title="Movimiento de stock"
      >
        {productoStock && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{productoStock.nombre}</p>
              <p className="text-xs text-[var(--text-muted)]">
                Stock actual: <span className="font-bold text-[var(--text-primary)]">{Math.floor(Number(productoStock.stockActual ?? 0))}</span>
                {productoStock.unidadMedida ? ` ${productoStock.unidadMedida}` : ""}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipoMovimientoStock("entrada")}
                className={`btn justify-center ${tipoMovimientoStock === "entrada" ? "btn-primary" : "btn-secondary"}`}
              >
                <ArrowDownToLine size={16} /> Entrada
              </button>
              <button
                type="button"
                onClick={() => setTipoMovimientoStock("salida")}
                className={`btn justify-center ${tipoMovimientoStock === "salida" ? "btn-primary" : "btn-secondary"}`}
              >
                <ArrowUpFromLine size={16} /> Salida
              </button>
            </div>

            <div className="form-group">
              <label className="label">Cantidad *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={cantidadMovimientoStock}
                onChange={(e) => setCantidadMovimientoStock(e.target.value)}
                className="input font-mono"
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label className="label">Nota</label>
              <textarea
                value={notaMovimientoStock}
                onChange={(e) => setNotaMovimientoStock(e.target.value)}
                className="input resize-none"
                rows={2}
                placeholder="Motivo del ajuste manual"
              />
            </div>

            <div className="rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)] p-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--text-secondary)]">Stock resultante</span>
              <span className="text-lg font-bold text-[var(--text-primary)]">
                {Math.max(
                  0,
                  Math.floor(Number(productoStock.stockActual ?? 0)) +
                    (tipoMovimientoStock === "entrada" ? 1 : -1) * Math.max(0, Math.floor(Number(cantidadMovimientoStock || 0)))
                )}
              </span>
            </div>

            <button
              type="button"
              onClick={registrarMovimientoStock}
              disabled={guardandoStock}
              className="btn-primary w-full justify-center"
            >
              {guardandoStock ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {guardandoStock ? "Registrando..." : "Registrar movimiento"}
            </button>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
