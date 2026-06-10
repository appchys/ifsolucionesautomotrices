"use client";
import { useState, useEffect, useMemo } from "react";
import { X, Search, Loader2, Plus } from "lucide-react";
import { getProductos, getServicios } from "@/lib/services";
import { Producto, Servicio, ItemOrden } from "@/types";

const SIN_CATEGORIA_VALUE = "__sin_categoria__";
type TipoItem = "producto" | "servicio";

interface AgregarItemModalProps {
  tipoInicial?: TipoItem;
  onClose: () => void;
  onAdd: (item: Omit<ItemOrden, "id" | "ordenId" | "subtotal"> & { stockDisponible?: number }) => Promise<void>;
}

export default function AgregarItemModal({ tipoInicial = "producto", onClose, onAdd }: AgregarItemModalProps) {
  const [tipo, setTipo] = useState<TipoItem>(tipoInicial);
  const [items, setItems] = useState<(Producto | Servicio)[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  
  // Custom manual entry
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState<number | "">("");
  const [manualQty, setManualQty] = useState<number>(1);
  const [manualIva, setManualIva] = useState<number>(15);

  const [addingItemStr, setAddingItemStr] = useState<string | null>(null);
  const [catalogQty, setCatalogQty] = useState<Record<string, number>>({});

  const precioUnitarioParaOrden = (item: Producto | Servicio) => {
    if (tipo !== "producto" || !item.aplicaIva) return item.precioBase;
    return Number((item.precioBase / 1.15).toFixed(2));
  };

  const categoriasProducto = useMemo(() => {
    if (tipo !== "producto") return [];
    return Array.from(
      new Set(
        items
          .map((item) => (item as Producto).categoria?.trim())
          .filter(Boolean) as string[]
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [items, tipo]);

  const hayProductosSinCategoria = useMemo(() => {
    return tipo === "producto" && items.some((item) => !(item as Producto).categoria?.trim());
  }, [items, tipo]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !term || item.nombre.toLowerCase().includes(term);
      if (tipo !== "producto" || !selectedCategory) return matchesSearch;

      const categoria = (item as Producto).categoria?.trim();
      const matchesCategory =
        selectedCategory === SIN_CATEGORIA_VALUE
          ? !categoria
          : categoria === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [items, search, selectedCategory, tipo]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const data = tipo === "producto" ? await getProductos() : await getServicios();
        if (active) setItems(data);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadData();
    return () => {
      active = false;
    };
  }, [tipo]);

  const cambiarTipo = (nuevoTipo: TipoItem) => {
    if (nuevoTipo === tipo) return;
    setSearch("");
    setSelectedCategory("");
    setShowManual(false);
    setManualName("");
    setManualPrice("");
    setManualQty(1);
    setManualIva(15);
    setCatalogQty({});
    setTipo(nuevoTipo);
  };

  const handleAddFromDb = async (item: Producto | Servicio) => {
    setAddingItemStr(item.id || "temp");
    try {
      const qty = catalogQty[item.id ?? ""] || 1;
      if (tipo === "producto" && qty > Math.floor(Number((item as Producto).stockActual ?? 0))) return;
      await onAdd({
        tipo,
        productoId: tipo === "producto" ? item.id : undefined,
        productoSku: tipo === "producto" ? (item as Producto).sku : undefined,
        productoNombre: tipo === "producto" ? item.nombre : undefined,
        stockDisponible: tipo === "producto" ? Math.floor(Number((item as Producto).stockActual ?? 0)) : undefined,
        descripcion: item.nombre,
        cantidad: qty,
        precioUnitario: precioUnitarioParaOrden(item),
        impuestoAplicable: item.aplicaIva ? 15 : 0,
      });
      setCatalogQty((prev) => ({ ...prev, [item.id ?? ""]: 1 }));
      if (tipo === "producto") onClose();
    } finally {
      setAddingItemStr(null);
    }
  };

  const handleAddManual = async () => {
    if (!manualName.trim() || !manualPrice) return;
    setAddingItemStr("manual");
    try {
      await onAdd({
        tipo,
        descripcion: manualName,
        cantidad: manualQty,
        precioUnitario: Number(manualPrice),
        impuestoAplicable: manualIva,
      });
      setManualName("");
      setManualPrice("");
      setManualQty(1);
      if (tipo === "producto") onClose();
    } finally {
      setAddingItemStr(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[var(--bg-card)] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Agregar productos y servicios
          </h2>
          <button onClick={onClose} className="btn-ghost btn-icon">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-1">
            <button
              type="button"
              onClick={() => cambiarTipo("producto")}
              className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                tipo === "producto"
                  ? "bg-[var(--bg-card)] text-[var(--accent)] shadow-sm"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              Productos
            </button>
            <button
              type="button"
              onClick={() => cambiarTipo("servicio")}
              className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                tipo === "servicio"
                  ? "bg-[var(--bg-card)] text-[var(--accent)] shadow-sm"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              Servicios
            </button>
          </div>

          {/* Buscar en base de datos */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
              Seleccionar del catálogo
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
              <input 
                type="text" 
                className="input w-full pl-10" 
                placeholder={`Buscar ${tipo}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {tipo === "producto" && (
              <div className="form-group">
                <label className="label">Categoria</label>
                <select
                  className="input"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  disabled={loading || (categoriasProducto.length === 0 && !hayProductosSinCategoria)}
                >
                  <option value="">Todas las categorias</option>
                  {categoriasProducto.map((categoria) => (
                    <option key={categoria} value={categoria}>
                      {categoria}
                    </option>
                  ))}
                  {hayProductosSinCategoria && (
                    <option value={SIN_CATEGORIA_VALUE}>Sin categoria</option>
                  )}
                </select>
              </div>
            )}
            
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[var(--text-muted)]" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>
                No se encontraron {tipo}s.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {filtered.map(item => {
                  const itemKey = item.id ?? "";
                  const stockActual = tipo === "producto" ? Math.floor(Number((item as Producto).stockActual ?? 0)) : Infinity;
                  const cantidadSeleccionada = catalogQty[itemKey] || 1;
                  const sinStock = tipo === "producto" && stockActual <= 0;
                  const excedeStock = tipo === "producto" && cantidadSeleccionada > stockActual;

                  return (
                  <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-body)] hover:border-[var(--accent)] transition-colors">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{item.nombre}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        ${item.precioBase.toFixed(2)} {tipo === "producto" && item.aplicaIva ? "IVA incluido" : item.aplicaIva ? "+ IVA" : ""}
                        {tipo === "producto" && (item as Producto).sku && ` • SKU: ${(item as Producto).sku}`}
                        {tipo === "producto" && (
                          <span className={`ml-1 font-medium ${stockActual <= 0 ? "text-red-500" : stockActual <= 5 ? "text-amber-500" : ""}`}>
                            • Stock: {stockActual}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center border border-[var(--border)] rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            setCatalogQty((prev) => ({
                              ...prev,
                              [itemKey]: Math.max(1, (prev[itemKey] || 1) - 1),
                            }))
                          }
                          className="px-2 py-1 text-xs font-bold hover:bg-[var(--bg-secondary)] transition-colors"
                          style={{ color: "var(--text-muted)" }}
                        >
                          -
                        </button>
                        <span className="px-2 py-1 text-xs font-semibold min-w-[24px] text-center" style={{ color: "var(--text-primary)" }}>
                          {cantidadSeleccionada}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCatalogQty((prev) => ({
                              ...prev,
                              [itemKey]: tipo === "producto"
                                ? Math.min(stockActual, (prev[itemKey] || 1) + 1)
                                : (prev[itemKey] || 1) + 1,
                            }))
                          }
                          disabled={tipo === "producto" && cantidadSeleccionada >= stockActual}
                          className="px-2 py-1 text-xs font-bold hover:bg-[var(--bg-secondary)] transition-colors"
                          style={{ color: "var(--text-muted)" }}
                        >
                          +
                        </button>
                      </div>
                      <button 
                        onClick={() => handleAddFromDb(item)} 
                        disabled={addingItemStr === item.id || sinStock || excedeStock}
                        className="btn-secondary btn-sm"
                      >
                        {addingItemStr === item.id ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        {sinStock ? "Sin stock" : "Agregar"}
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="section-divider my-2" />

          {/* Agregar manualmente */}
          <div className="space-y-3">
            {!showManual ? (
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="btn-secondary w-full justify-center"
              >
                <Plus size={16} />
                Agregar {tipo} manual
              </button>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Agregar {tipo} manual
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowManual(false)}
                    className="btn-ghost btn-icon p-1 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="form-group sm:col-span-2">
                    <label className="label">Descripción</label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder={`Ej: ${tipo === "producto" ? "Aceite 10W40" : "Limpieza de inyectores"}`}
                      value={manualName}
                      onChange={e => setManualName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Precio Unitario ($)</label>
                    <input 
                      type="number" 
                      className="input" 
                      min="0"
                      step="0.01"
                      value={manualPrice}
                      onChange={e => setManualPrice(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Cantidad</label>
                    <input 
                      type="number" 
                      className="input" 
                      min="1"
                      value={manualQty}
                      onChange={e => setManualQty(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group sm:col-span-2">
                    <label className="label">IVA (%)</label>
                    <select className="input" value={manualIva} onChange={e => setManualIva(Number(e.target.value))}>
                      <option value={0}>0% (Exento)</option>
                      <option value={15}>15%</option>
                    </select>
                  </div>
                </div>
                <button 
                  onClick={handleAddManual}
                  disabled={addingItemStr === "manual" || !manualName.trim() || !manualPrice}
                  className="btn-primary w-full justify-center"
                >
                  {addingItemStr === "manual" ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  Agregar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
