"use client";
import { useState, useEffect, useMemo } from "react";
import { X, Search, Box, PenTool, Package, Calendar } from "lucide-react";
import { getProductos, getServicios } from "@/lib/services";
import { Producto, Servicio, ItemOrden } from "@/types";
import { useUIStore } from "@/store";

type TipoItem = "producto" | "servicio" | "pack" | "plan";

interface AgregarItemModalProps {
  onClose: () => void;
  onAdd: (item: Omit<ItemOrden, "id" | "ordenId" | "subtotal"> & { stockDisponible?: number }) => Promise<void>;
  tipoInicial?: "producto" | "servicio" | "pack" | "plan";
}

export default function AgregarItemModal({ onClose, onAdd, tipoInicial }: AgregarItemModalProps) {
  const { sidebarOpen } = useUIStore();
  const [activeTab, setActiveTab] = useState<TipoItem>(tipoInicial || "producto");
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("");
  
  const [productos, setProductos] = useState<Producto[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);

  // Load all items once
  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const [prodData, servData] = await Promise.all([
          getProductos(),
          getServicios()
        ]);
        if (active) {
          setProductos(prodData);
          setServicios(servData);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadData();
    return () => { active = false; };
  }, []);

  const filteredProductos = useMemo(() => {
    const term = search.toLowerCase();
    return productos.filter(p => 
      (!term || p.nombre.toLowerCase().includes(term) || p.sku?.toLowerCase().includes(term)) &&
      (!categoria || p.categoria === categoria)
    );
  }, [productos, search, categoria]);

  const filteredServicios = useMemo(() => {
    const term = search.toLowerCase();
    return servicios.filter(s => 
      (!term || s.nombre.toLowerCase().includes(term)) &&
      (!categoria || (s as any).categoria === categoria)
    );
  }, [servicios, search, categoria]);

  const categoriasActuales = useMemo(() => {
    const items = activeTab === "producto" ? productos : activeTab === "servicio" ? servicios : [];
    return Array.from(new Set(items.map(i => (i as any).categoria).filter(Boolean))) as string[];
  }, [productos, servicios, activeTab]);

  const tabs = [
    { id: "producto", label: "Productos", count: filteredProductos.length, icon: Box },
    { id: "servicio", label: "Servicios", count: filteredServicios.length, icon: PenTool },
    { id: "pack", label: "Packs", count: 0, icon: Package },
    { id: "plan", label: "Planes", count: 0, icon: Calendar },
  ] as const;

  const currentItems = activeTab === "producto" ? filteredProductos : activeTab === "servicio" ? filteredServicios : [];

  const handleSelectItem = async (item: Producto | Servicio, cantidad: number) => {
    const isProd = activeTab === "producto";
    const stockActual = isProd ? Math.floor(Number((item as Producto).stockActual ?? 0)) : Infinity;
    
    if (isProd && stockActual <= 0) return; // Prevent adding if no stock

    const precioUnitario = (!isProd || !item.aplicaIva) ? item.precioBase : Number((item.precioBase / 1.15).toFixed(2));

    await onAdd({
      tipo: isProd ? "producto" : "servicio",
      productoId: item.id,
      productoSku: isProd ? (item as Producto).sku : undefined,
      productoNombre: item.nombre,
      stockDisponible: isProd ? stockActual : undefined,
      descripcion: item.nombre,
      cantidad: cantidad,
      precioUnitario,
      impuestoAplicable: item.aplicaIva ? 15 : 0,
    });
  };

  const CatalogItemRow = ({ item, isProd, outOfStock, stockActual }: { item: Producto | Servicio, isProd: boolean, outOfStock: boolean, stockActual: number }) => {
    const [cantidad, setCantidad] = useState(1);
    
    return (
      <div
        className={`w-full flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl transition-colors text-left border border-transparent gap-3 ${
          outOfStock ? "opacity-50 bg-slate-50 dark:bg-slate-900" : "bg-white dark:bg-transparent hover:bg-blue-50/50 hover:border-blue-100 dark:hover:bg-blue-900/20"
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-blue-600 shrink-0">
            {isProd ? <Box size={24} /> : <PenTool size={24} />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-sm text-[var(--text-primary)]">{item.nombre}</h4>
              {item.aplicaIva && (
                <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider border border-blue-200">
                  IVA
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mt-1">
              {isProd ? (
                <>
                  <span className="uppercase font-mono">{(item as Producto).sku || "S/N"}</span>
                  <span>·</span>
                  <span className={outOfStock ? "text-red-500 font-semibold" : ""}>Stock: {stockActual}</span>
                </>
              ) : (
                <span>Servicio</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pl-16 sm:pl-0">
          <div className="font-bold text-[var(--text-primary)] text-right text-lg">
            ${item.precioBase.toFixed(2)}
          </div>
          
          {!outOfStock && (
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-[var(--border)] rounded-lg bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
                <button 
                  onClick={() => setCantidad(Math.max(1, cantidad - 1))} 
                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-[var(--text-muted)] font-bold transition-colors"
                >
                  -
                </button>
                <input 
                  type="number" 
                  className="w-12 text-center text-sm py-1.5 focus:outline-none bg-transparent font-semibold" 
                  value={cantidad} 
                  onChange={e => setCantidad(Math.max(1, Math.min(stockActual, parseInt(e.target.value) || 1)))} 
                  onBlur={e => {
                    if (!e.target.value || parseInt(e.target.value) < 1) setCantidad(1);
                  }}
                />
                <button 
                  onClick={() => setCantidad(Math.min(stockActual, cantidad + 1))} 
                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-[var(--text-muted)] font-bold transition-colors"
                >
                  +
                </button>
              </div>
              <button 
                onClick={() => {
                  handleSelectItem(item, cantidad);
                  setCantidad(1);
                }} 
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-1"
              >
                Agregar
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4 pt-[calc(var(--header-height)+1rem)] transition-all duration-300 ${
        sidebarOpen ? "lg:pl-[calc(var(--sidebar-width)+1rem)]" : ""
      }`}
    >
      <div className="bg-white dark:bg-[var(--bg-card)] w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)] shrink-0">
          <h2 className="text-xl font-bold">Agregar Producto, Servicio, Pack o Plan</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-hidden">
          
          {/* Search Input and Category Filter */}
          <div className="flex gap-3 shrink-0">
            <div className="relative flex-1">
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input 
                type="text" 
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border-2 border-blue-600 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-600/20 text-base"
                placeholder="Buscar por nombre, SKU o código de barras..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            {categoriasActuales.length > 0 && (
              <select
                className="border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-slate-900 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20 text-sm w-48 shrink-0"
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {categoriasActuales.sort().map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto custom-scrollbar shrink-0 pb-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as TipoItem);
                    setCategoria("");
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap ${
                    isActive 
                      ? "bg-blue-700 text-white shadow-sm" 
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isActive ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2 pb-4">
            {loading ? (
              <div className="p-10 text-center text-[var(--text-muted)] animate-pulse">Cargando catálogo...</div>
            ) : currentItems.length === 0 ? (
              <div className="p-10 text-center text-[var(--text-muted)]">No se encontraron resultados en esta categoría.</div>
            ) : (
              currentItems.map((item) => {
                const isProd = activeTab === "producto";
                const stockActual = isProd ? Math.floor(Number((item as Producto).stockActual ?? 0)) : Infinity;
                const outOfStock = isProd && stockActual <= 0;

                return (
                  <CatalogItemRow 
                    key={item.id} 
                    item={item} 
                    isProd={isProd} 
                    outOfStock={outOfStock} 
                    stockActual={stockActual} 
                  />
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
