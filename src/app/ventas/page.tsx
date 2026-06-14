"use client";
import React, { useEffect, useState, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import { getProductos, createVenta } from "@/lib/services";
import { Producto, Cliente, VentaItem, MetodoPago, Venta, Pago } from "@/types";
import { useAuthStore } from "@/store";
import { toast } from "react-hot-toast";
import { 
  Loader2, Search, History, RefreshCw, User, FileText, 
  Pause, Play, Trash2, Grid, List, Plus, Minus, X, Info, 
  ShoppingBag, ShoppingCart, Check, Save, ArrowLeft, ShieldAlert
} from "lucide-react";

import ClienteSelectorModal from "@/components/ventas/ClienteSelectorModal";
import CobrarModal from "@/components/ventas/CobrarModal";
import HistorialVentasModal from "@/components/ventas/HistorialVentasModal";

export default function VentasPage() {
  const { user } = useAuthStore();
  
  // Data State
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [conStockOnly, setConStockOnly] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"grid" | "list">("grid");

  // Sale/Cart State
  const [cart, setCart] = useState<VentaItem[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [vendedor, setVendedor] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [showDiscountInput, setShowDiscountInput] = useState(false);

  // Drafts / Paused Sales state
  const [pausedSales, setPausedSales] = useState<{ id: string; timestamp: number; cart: VentaItem[]; cliente: Cliente | null; notes: string; vendedor: string }[]>([]);
  const [showPausedList, setShowPausedList] = useState(false);

  // Modals state
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showCobrarModal, setShowCobrarModal] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [selectedProductInfo, setSelectedProductInfo] = useState<Producto | null>(null);
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [changingVendedor, setChangingVendedor] = useState(false);
  const [tempVendedor, setTempVendedor] = useState("");

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
  };

  // Initialize Vendedor with current user and load products & drafts
  useEffect(() => {
    if (user && !vendedor) {
      setVendedor(user.displayName || user.email);
    }
  }, [user, vendedor]);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await getProductos();
      setProductos(list);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar catálogo de productos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Load cart draft from localStorage
    const savedCart = localStorage.getItem("pos_cart");
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error(e);
      }
    }

    const savedCliente = localStorage.getItem("pos_cliente");
    if (savedCliente) {
      try {
        setSelectedCliente(JSON.parse(savedCliente));
      } catch (e) {
        console.error(e);
      }
    }

    const savedNotes = localStorage.getItem("pos_notes");
    if (savedNotes) setNotes(savedNotes);

    const savedVendedor = localStorage.getItem("pos_vendedor");
    if (savedVendedor) setVendedor(savedVendedor);

    // Load paused sales
    const savedPaused = localStorage.getItem("pos_paused_sales");
    if (savedPaused) {
      try {
        const parsed = JSON.parse(savedPaused);
        setPausedSales(parsed);
        if (parsed.length > 0) {
          setShowPausedList(true);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Sync state to localStorage drafts
  useEffect(() => {
    localStorage.setItem("pos_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (selectedCliente) {
      localStorage.setItem("pos_cliente", JSON.stringify(selectedCliente));
    } else {
      localStorage.removeItem("pos_cliente");
    }
  }, [selectedCliente]);

  useEffect(() => {
    localStorage.setItem("pos_notes", notes);
  }, [notes]);

  useEffect(() => {
    if (vendedor) {
      localStorage.setItem("pos_vendedor", vendedor);
    }
  }, [vendedor]);

  // Categories list
  const categories = useMemo(() => {
    const list = new Set<string>();
    productos.forEach((p) => {
      if (p.categoria) {
        list.add(p.categoria.trim());
      }
    });
    return ["Todos", ...Array.from(list)];
  }, [productos]);

  // Filtered Products catalog
  const filteredProducts = useMemo(() => {
    return productos.filter((p) => {
      const term = search.toLowerCase();
      const matchSearch =
        p.nombre.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(term));
      
      const matchCategory =
        activeCategory === "Todos" ||
        (p.categoria && p.categoria.trim().toLowerCase() === activeCategory.toLowerCase());

      const matchStock = !conStockOnly || (p.stockActual !== undefined && p.stockActual > 0);

      return matchSearch && matchCategory && matchStock;
    });
  }, [productos, search, activeCategory, conStockOnly]);

  // Cart operations
  const addToCart = (product: Producto) => {
    const stockActual = product.stockActual ?? 0;
    if (stockActual <= 0) {
      toast.error("Producto agotado");
      return;
    }

    const existingIndex = cart.findIndex((item) => item.productoId === product.id);
    if (existingIndex > -1) {
      const existingItem = cart[existingIndex];
      if (existingItem.cantidad >= stockActual) {
        toast.error(`Stock máximo alcanzado (${stockActual} en stock)`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex] = {
        ...existingItem,
        cantidad: existingItem.cantidad + 1,
        subtotal: Number(((existingItem.cantidad + 1) * existingItem.precioUnitario).toFixed(2)),
      };
      setCart(updated);
    } else {
      const newItem: VentaItem = {
        productoId: product.id!,
        sku: product.sku,
        nombre: product.nombre,
        cantidad: 1,
        precioUnitario: product.precioBase,
        costoUnitario: product.costoBase,
        aplicaIva: product.aplicaIva,
        impuestoAplicable: product.aplicaIva ? 15 : 0, // IVA default 15%
        subtotal: product.precioBase,
      };
      setCart([...cart, newItem]);
    }
    toast.success(`${product.nombre} añadido`);
  };

  const updateQuantity = (productoId: string, delta: number) => {
    const updated = cart.map((item) => {
      if (item.productoId === productoId) {
        const prod = productos.find((p) => p.id === productoId);
        const maxStock = prod?.stockActual ?? 9999;
        const nextQty = item.cantidad + delta;
        
        if (nextQty <= 0) return null;
        if (nextQty > maxStock) {
          toast.error(`Stock máximo alcanzado (${maxStock} en stock)`);
          return item;
        }
        
        return {
          ...item,
          cantidad: nextQty,
          subtotal: Number((nextQty * item.precioUnitario).toFixed(2)),
        };
      }
      return item;
    }).filter(Boolean) as VentaItem[];

    setCart(updated);
  };

  const removeFromCart = (productoId: string) => {
    setCart(cart.filter((item) => item.productoId !== productoId));
    toast.success("Producto eliminado del carrito");
  };

  // Math totals
  const subtotal = useMemo(() => {
    return Number(cart.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
  }, [cart]);

  const subtotalWithDiscount = Math.max(0, subtotal - discount);

  const iva = useMemo(() => {
    // Computes tax on taxable items proportionally after discount
    if (subtotal === 0) return 0;
    const discountRatio = subtotalWithDiscount / subtotal;
    const taxableSubtotal = cart.reduce((sum, item) => {
      return sum + (item.aplicaIva ? item.subtotal : 0);
    }, 0);
    return Number((taxableSubtotal * discountRatio * 0.15).toFixed(2)); // IVA rate 15%
  }, [cart, subtotal, subtotalWithDiscount]);

  const total = Number((subtotalWithDiscount + iva).toFixed(2));

  // Toolbar actions
  const handleAnular = () => {
    if (cart.length === 0) return;
    if (window.confirm("¿Estás seguro de que deseas anular la venta actual? Se vaciará el carrito.")) {
      setCart([]);
      setSelectedCliente(null);
      setNotes("");
      setDiscount(0);
      toast.success("Venta anulada/limpiada");
    }
  };

  const handlePausar = () => {
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    const newPaused = [
      ...pausedSales,
      {
        id: `pausada_${Date.now()}`,
        timestamp: Date.now(),
        cart,
        cliente: selectedCliente,
        notes,
        vendedor,
      },
    ];
    setPausedSales(newPaused);
    localStorage.setItem("pos_paused_sales", JSON.stringify(newPaused));
    setShowPausedList(true);
    
    // Clear current cart/state
    setCart([]);
    setSelectedCliente(null);
    setNotes("");
    setDiscount(0);
    toast.success("Venta pausada y guardada");
  };

  const handleRecuperarPausada = (id: string) => {
    const found = pausedSales.find((item) => item.id === id);
    if (!found) return;

    // Load to active POS
    setCart(found.cart);
    setSelectedCliente(found.cliente);
    setNotes(found.notes);
    setVendedor(found.vendedor);

    // Remove from paused list
    const filtered = pausedSales.filter((item) => item.id !== id);
    setPausedSales(filtered);
    localStorage.setItem("pos_paused_sales", JSON.stringify(filtered));
    setShowPausedList(false);
    toast.success("Venta recuperada");
  };

  const handleEliminarPausada = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = pausedSales.filter((item) => item.id !== id);
    setPausedSales(filtered);
    localStorage.setItem("pos_paused_sales", JSON.stringify(filtered));
    toast.success("Borrador eliminado");
  };

  const handleCobrarClick = () => {
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    setShowCobrarModal(true);
  };

  const handleProcessCheckout = async (pagos: Omit<Pago, "id" | "ordenId">[]) => {
    try {
      const itemsPayload = cart.map((item) => ({
        productoId: item.productoId,
        sku: item.sku,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        costoUnitario: item.costoUnitario,
        aplicaIva: item.aplicaIva,
        impuestoAplicable: item.impuestoAplicable,
        subtotal: item.subtotal,
      }));

      await createVenta({
        clienteNombre: selectedCliente ? `${selectedCliente.nombre} ${selectedCliente.apellido || ""}`.trim() : "Consumidor Final",
        clienteId: selectedCliente?.id || "",
        clienteIdentificacion: selectedCliente?.identificacion || "9999999999999",
        vendedorNombre: vendedor,
        items: itemsPayload,
        subtotal,
        descuento: discount,
        iva,
        total,
        metodoPago: pagos[0]?.metodoPago || "efectivo",
        notas: notes || undefined,
        pagos,
      });

      toast.success("¡Venta cobrada con éxito!");
      setCart([]);
      setSelectedCliente(null);
      setNotes("");
      setDiscount(0);
      setShowCobrarModal(false);
      
      // Reload products catalog
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(`Error al registrar la venta: ${err?.message || err}`);
    }
  };

  const handleSaveVendedor = () => {
    if (tempVendedor.trim()) {
      setVendedor(tempVendedor.trim());
      setChangingVendedor(false);
      toast.success("Vendedor actualizado");
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-4 p-1 h-full max-h-[88vh]">
        
        {/* TOP TOOLBAR POS */}
        <div className="flex items-center justify-between gap-4 bg-white dark:bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border)] shadow-sm shrink-0 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold tracking-tight">Ventas</h1>
            <span className="badge bg-green-50 text-green-600 border border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30 font-bold flex items-center gap-1.5 py-1 px-3">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></span>
              Caja abierta
            </span>
          </div>

          {/* Search bar product */}
          <div className="relative w-full max-w-sm flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              className="input pl-9 h-10 w-full"
              placeholder="Buscar producto o escanear código de barras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* History */}
            <button 
              onClick={() => setShowHistorialModal(true)} 
              className="btn btn-secondary h-10 px-4 flex items-center gap-1.5 font-semibold"
            >
              <History size={16} />
              <span>Historial</span>
            </button>

            {/* Sync Catalog */}
            <button 
              onClick={loadData} 
              className="btn btn-ghost h-10 w-10 border border-[var(--border)] rounded-xl flex items-center justify-center p-0"
              title="Sincronizar Catálogo"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-[var(--accent)]" : ""} />
            </button>

            {/* Seller Select display */}
            <div className="flex items-center bg-green-50/50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/30 px-3 py-1.5 rounded-xl gap-2 max-w-[250px] shrink-0">
              <User size={14} className="text-green-600 dark:text-green-400" />
              {changingVendedor ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    className="input h-7 py-0.5 px-2 text-xs w-28"
                    value={tempVendedor}
                    onChange={(e) => setTempVendedor(e.target.value)}
                    autoFocus
                  />
                  <button onClick={handleSaveVendedor} className="btn-primary p-1 rounded h-7 w-7 flex items-center justify-center">
                    <Check size={12} />
                  </button>
                  <button onClick={() => setChangingVendedor(false)} className="btn-secondary p-1 rounded h-7 w-7 flex items-center justify-center">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                  <span className="truncate">Vendedor: {vendedor || "N/A"}</span>
                  <button 
                    onClick={() => {
                      setTempVendedor(vendedor);
                      setChangingVendedor(true);
                    }} 
                    className="underline text-[10px] text-green-600 dark:text-green-500 hover:text-green-800"
                  >
                    Cambiar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MAIN BODY AREA */}
        <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
          
          {/* LEFT AREA: Product catalog */}
          <div className="flex-1 flex flex-col gap-4 overflow-hidden min-w-[350px]">
            
            {/* Filter buttons */}
            <div className="flex items-center justify-between gap-4 flex-wrap shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-[70%] custom-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 uppercase tracking-wider ${
                      activeCategory === cat
                        ? "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "bg-white dark:bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Layout controls */}
              <div className="flex items-center gap-3 bg-white dark:bg-[var(--bg-card)] border border-[var(--border)] px-3 py-1.5 rounded-xl shrink-0">
                {/* Stock Toggle */}
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold select-none">
                  <input
                    type="checkbox"
                    checked={conStockOnly}
                    onChange={(e) => setConStockOnly(e.target.checked)}
                    className="w-3.5 h-3.5 text-[var(--accent)] rounded border-[var(--border)] focus:ring-0 focus:outline-none"
                  />
                  <span>Con stock</span>
                </label>
                
                <div className="w-[1px] h-4 bg-[var(--border)]" />
                
                {/* Layout Buttons */}
                <button
                  onClick={() => setLayoutMode("grid")}
                  className={`p-1 rounded-lg transition-colors ${layoutMode === "grid" ? "text-[var(--accent)] bg-blue-50 dark:bg-blue-950/20" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"}`}
                >
                  <Grid size={15} />
                </button>
                <button
                  onClick={() => setLayoutMode("list")}
                  className={`p-1 rounded-lg transition-colors ${layoutMode === "list" ? "text-[var(--accent)] bg-blue-50 dark:bg-blue-950/20" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"}`}
                >
                  <List size={15} />
                </button>
              </div>
            </div>

            {/* Grid/List Catalog view */}
            <div className="flex-1 overflow-y-auto pr-1">
              {loading ? (
                <div className="flex justify-center py-24">
                  <Loader2 className="animate-spin text-[var(--accent)]" size={32} />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-24 bg-white dark:bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl">
                  <ShoppingBag className="mx-auto text-[var(--text-muted)] opacity-50 mb-3" size={36} />
                  <p className="text-sm text-[var(--text-secondary)] font-medium">No se encontraron productos en el catálogo</p>
                </div>
              ) : layoutMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredProducts.map((p) => {
                    const stock = p.stockActual ?? 0;
                    const inStock = stock > 0;
                    return (
                      <div
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className={`card-hover relative flex flex-col justify-between overflow-hidden border bg-white dark:bg-[var(--bg-card)] group select-none min-h-[170px] ${
                          !inStock ? "opacity-60 hover:border-[var(--border)] hover:transform-none hover:shadow-sm" : ""
                        }`}
                      >
                        {/* Stock status badge */}
                        <div className="absolute top-3 left-3 z-10">
                          <span className={`badge ${
                            inStock 
                              ? "bg-green-50 text-green-600 border border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30" 
                              : "bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30"
                          } font-bold`}>
                            {inStock ? `${stock} en stock` : "Agotado"}
                          </span>
                        </div>

                        {/* Info Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProductInfo(p);
                          }}
                          className="absolute bottom-3 right-3 p-1.5 hover:bg-[var(--bg-hover)] rounded-full text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-all z-10"
                          title="Detalles"
                        >
                          <Info size={14} />
                        </button>

                        {/* Product Visual Container */}
                        <div className="flex justify-center items-center h-20 mt-8 mb-2">
                          {p.imagenUrl ? (
                            <img src={p.imagenUrl} alt={p.nombre} className="max-h-full max-w-full object-contain" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[var(--text-muted)] opacity-60">
                              <ShoppingBag size={24} />
                            </div>
                          )}
                        </div>

                        {/* Text values */}
                        <div className="mt-auto pt-2 border-t border-[var(--border)] border-dashed">
                          <p className="font-extrabold text-[13px] uppercase truncate text-[var(--text-primary)] tracking-wide">
                            {p.nombre}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] truncate font-mono mt-0.5">{p.sku}</p>
                          <p className="text-sm font-extrabold text-[var(--accent)] mt-1.5">
                            ${Number(p.precioBase).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* List Layout */
                <div className="card p-0 overflow-hidden bg-white dark:bg-[var(--bg-card)] border-[var(--border)]">
                  <table className="table">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/10 border-b border-[var(--border)]">
                        <th>Producto</th>
                        <th>SKU</th>
                        <th>Categoría</th>
                        <th className="text-center">Stock</th>
                        <th className="text-right">Precio</th>
                        <th className="text-center">Detalle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] divide-dashed">
                      {filteredProducts.map((p) => {
                        const stock = p.stockActual ?? 0;
                        const inStock = stock > 0;
                        return (
                          <tr
                            key={p.id}
                            onClick={() => addToCart(p)}
                            className="hover:bg-[var(--bg-hover)] cursor-pointer"
                          >
                            <td className="font-bold text-[var(--text-primary)] uppercase">{p.nombre}</td>
                            <td className="font-mono text-xs text-[var(--text-secondary)]">{p.sku}</td>
                            <td className="text-xs uppercase text-[var(--text-muted)]">{p.categoria || "Otros"}</td>
                            <td className="text-center">
                              <span className={`badge ${
                                inStock 
                                  ? "bg-green-50 text-green-600 border border-green-200" 
                                  : "bg-red-50 text-red-600 border border-red-200"
                              } font-bold`}>
                                {stock}
                              </span>
                            </td>
                            <td className="text-right font-extrabold text-[var(--accent)]">
                              ${Number(p.precioBase).toFixed(2)}
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProductInfo(p);
                                }}
                                className="p-1 hover:bg-[var(--bg-hover)] rounded text-[var(--text-muted)]"
                              >
                                <Info size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT AREA: Cart Detail & Totals */}
          <div className="w-[380px] bg-white dark:bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-sm flex flex-col min-w-[340px] shrink-0 overflow-hidden">
            
            {/* Action Bar (Cliente, Notas, Pausar, Anular) */}
            <div className="grid grid-cols-4 border-b border-[var(--border)]">
              {/* Cliente selector trigger */}
              <button
                onClick={() => setShowClienteModal(true)}
                className={`p-3 border-r border-[var(--border)] hover:bg-[var(--bg-hover)] flex flex-col items-center justify-center gap-1 transition-all ${
                  selectedCliente ? "bg-green-50/50 dark:bg-green-950/10 text-green-600" : "text-[var(--text-secondary)]"
                }`}
                title="Seleccionar Cliente"
              >
                <User size={16} />
                <span className="text-[10px] font-bold truncate max-w-full">
                  {selectedCliente ? selectedCliente.nombre : "Cliente"}
                </span>
              </button>

              {/* Notes toggler */}
              <button
                onClick={() => setShowNotesInput(!showNotesInput)}
                className={`p-3 border-r border-[var(--border)] hover:bg-[var(--bg-hover)] flex flex-col items-center justify-center gap-1 transition-all ${
                  notes ? "bg-yellow-50/50 dark:bg-yellow-950/10 text-yellow-600" : "text-[var(--text-secondary)]"
                }`}
                title="Notas de la Venta"
              >
                <FileText size={16} />
                <span className="text-[10px] font-bold">Notas</span>
              </button>

              {/* Pause/Pausadas Sale (Holds sale in local storage drafts or views drafts list) */}
              <div className="relative border-r border-[var(--border)]">
                <button
                  onClick={cart.length > 0 ? handlePausar : () => setShowPausedList(!showPausedList)}
                  className={`w-full h-full p-3 hover:bg-[var(--bg-hover)] flex flex-col items-center justify-center gap-1 transition-all ${
                    showPausedList && cart.length === 0 ? "bg-orange-50/30 text-orange-600 dark:bg-orange-950/10" : "text-[var(--text-secondary)]"
                  }`}
                  title={cart.length > 0 ? "Pausar venta actual" : "Ver ventas pausadas"}
                >
                  {cart.length > 0 ? <Pause size={16} /> : <Play size={16} />}
                  <span className="text-[10px] font-bold">
                    {cart.length > 0 ? "Pausar" : "Pausadas"}
                  </span>
                </button>
                {cart.length === 0 && pausedSales.length > 0 && (
                  <span className="absolute top-1 right-3.5 bg-orange-600 text-white font-extrabold rounded-full w-4 h-4 flex items-center justify-center text-[9px] shadow-sm">
                    {pausedSales.length}
                  </span>
                )}
              </div>

              {/* Anular/Cancel active cart */}
              <button
                onClick={handleAnular}
                className="p-3 hover:bg-[var(--bg-hover)] flex flex-col items-center justify-center gap-1 text-[var(--text-secondary)] hover:text-red-600 transition-colors"
                title="Anular Cart"
              >
                <Trash2 size={16} />
                <span className="text-[10px] font-bold">Anular</span>
              </button>
            </div>

            {/* Notes Inline Input (conditional display) */}
            {showNotesInput && (
              <div className="p-3 border-b border-[var(--border)] bg-yellow-50/20 dark:bg-yellow-900/5 animate-fade-in">
                <label className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider mb-1 block">Notas de la Venta</label>
                <textarea
                  className="input h-14 text-xs bg-white dark:bg-slate-900"
                  placeholder="Comentarios adicionales para el recibo..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            )}

            {/* Ventas Pausadas List Panel */}
            {showPausedList && pausedSales.length > 0 && (
              <div className="m-4 p-4 rounded-xl border border-orange-200 bg-orange-50/40 dark:bg-orange-950/10 text-orange-800 dark:text-orange-400 animate-fade-in shrink-0">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-orange-700 dark:text-orange-500">
                    <Play size={12} className="fill-current" />
                    <span>Ventas pausadas ({pausedSales.length})</span>
                  </div>
                  <button 
                    onClick={() => setShowPausedList(false)}
                    className="p-0.5 hover:bg-orange-100 dark:hover:bg-orange-900/50 rounded-full text-orange-600 border-0"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="space-y-3 divide-y divide-orange-100 dark:divide-orange-900/40">
                  {pausedSales.map((item, idx) => (
                    <div key={item.id} className={`flex justify-between items-center ${idx > 0 ? "pt-2.5" : ""}`}>
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                          {item.cliente ? `${item.cliente.nombre} ${item.cliente.apellido || ""}`.trim() : "Cliente ocasional"}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                          {item.cart.reduce((s, i) => s + i.cantidad, 0)} art. - {formatTime(item.timestamp)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRecuperarPausada(item.id)}
                        className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline bg-transparent border-0 cursor-pointer shrink-0"
                      >
                        Retomar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Cart Items List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)] divide-dashed p-4 space-y-3 min-h-[150px]">
              {cart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-[var(--text-muted)] h-full opacity-60">
                  <ShoppingCart size={48} className="mb-3 stroke-[1.2]" />
                  <p className="text-xs font-semibold">Agrega productos para comenzar</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.productoId} className="flex justify-between items-start pt-2 first:pt-0">
                    <div className="min-w-0 pr-2">
                      <p className="font-extrabold text-[13px] text-[var(--text-primary)] uppercase truncate">
                        {item.nombre}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        ${Number(item.precioUnitario).toFixed(2)} c/u {item.aplicaIva && "%"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Quantity buttons */}
                      <div className="flex items-center border border-[var(--border)] rounded-lg overflow-hidden h-7 bg-slate-50 dark:bg-slate-900">
                        <button
                          onClick={() => updateQuantity(item.productoId, -1)}
                          className="px-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] h-full flex items-center justify-center"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="px-2 text-xs font-bold text-[var(--text-primary)] min-w-[20px] text-center">
                          {item.cantidad}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productoId, 1)}
                          className="px-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] h-full flex items-center justify-center"
                        >
                          <Plus size={11} />
                        </button>
                      </div>

                      {/* Line subtotal */}
                      <span className="text-xs font-bold text-[var(--text-primary)] w-14 text-right">
                        ${Number(item.subtotal).toFixed(2)}
                      </span>

                      {/* Remove */}
                      <button
                        onClick={() => removeFromCart(item.productoId)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-[var(--text-muted)] hover:text-red-500"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total Financial Summary Panel */}
            <div className="border-t border-[var(--border)] p-4 bg-slate-50 dark:bg-slate-900/10 space-y-2.5 shrink-0">
              <div className="flex justify-between items-center text-xs text-[var(--text-secondary)]">
                <span>Subtotal:</span>
                <span className="font-semibold">${subtotal.toFixed(2)}</span>
              </div>

              {/* Discount apply line */}
              <div className="flex justify-between items-center text-xs">
                {showDiscountInput ? (
                  <div className="flex items-center gap-1 w-full justify-between">
                    <span className="text-[var(--text-secondary)]">Descuento ($):</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        className="input h-6 py-0.5 px-2 text-xs w-16"
                        value={discount || ""}
                        onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="0.00"
                        autoFocus
                      />
                      <button onClick={() => setShowDiscountInput(false)} className="text-[var(--accent)] font-semibold hover:underline px-1 text-[10px]">
                        Listo
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button 
                      onClick={() => setShowDiscountInput(true)} 
                      className="text-[var(--accent)] hover:underline flex items-center gap-1 font-semibold text-[11px]"
                    >
                      Aplicar descuento
                    </button>
                    {discount > 0 && (
                      <span className="font-semibold text-green-600">-${discount.toFixed(2)}</span>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-between items-center text-xs text-[var(--text-secondary)]">
                <span>IVA (15%):</span>
                <span className="font-semibold">${iva.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-[var(--border)] border-dashed text-base text-[var(--text-primary)] font-extrabold">
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>

              {/* Cobrar Button */}
              <button
                onClick={handleCobrarClick}
                disabled={cart.length === 0}
                className="btn btn-primary w-full h-11 text-sm font-extrabold flex justify-center items-center shadow mt-1 border-none bg-blue-600 hover:bg-blue-700"
              >
                Cobrar ${total.toFixed(2)}
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* MODALS */}
      {showClienteModal && (
        <ClienteSelectorModal
          onClose={() => setShowClienteModal(false)}
          onSelect={(c) => setSelectedCliente(c)}
          selectedClienteId={selectedCliente?.id}
        />
      )}

      {showCobrarModal && (
        <CobrarModal
          total={total}
          onClose={() => setShowCobrarModal(false)}
          onConfirm={handleProcessCheckout}
        />
      )}

      {showHistorialModal && (
        <HistorialVentasModal
          onClose={() => setShowHistorialModal(false)}
          onRefreshPOS={loadData}
        />
      )}

      {/* Product Details popup */}
      {selectedProductInfo && (
        <div className="fixed inset-0 bg-black/60 z-[1200] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[var(--bg-card)] rounded-2xl w-full max-w-sm shadow-xl p-5 border border-[var(--border)]">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)] uppercase">{selectedProductInfo.nombre}</h3>
              <button onClick={() => setSelectedProductInfo(null)} className="p-1 hover:bg-[var(--bg-hover)] rounded-full text-[var(--text-secondary)]">
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-2.5 text-xs text-[var(--text-secondary)]">
              <div>
                <span className="font-semibold text-[var(--text-primary)] block mb-0.5">SKU / Código de Barra:</span>
                <span className="font-mono bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded block">{selectedProductInfo.sku}</span>
              </div>
              {selectedProductInfo.categoria && (
                <div>
                  <span className="font-semibold text-[var(--text-primary)]">Categoría:</span>
                  <span className="ml-2 uppercase">{selectedProductInfo.categoria}</span>
                </div>
              )}
              {selectedProductInfo.unidadMedida && (
                <div>
                  <span className="font-semibold text-[var(--text-primary)]">Unidad de Medida:</span>
                  <span className="ml-2">{selectedProductInfo.unidadMedida}</span>
                </div>
              )}
              <div>
                <span className="font-semibold text-[var(--text-primary)]">Stock Disponible:</span>
                <span className={`ml-2 badge font-bold ${
                  (selectedProductInfo.stockActual ?? 0) > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                }`}>
                  {selectedProductInfo.stockActual ?? 0} unidades
                </span>
              </div>
              {selectedProductInfo.descripcion && (
                <div>
                  <span className="font-semibold text-[var(--text-primary)] block mb-0.5">Descripción:</span>
                  <p className="bg-slate-50 dark:bg-slate-900 p-2 rounded italic text-[11px] leading-relaxed">
                    "{selectedProductInfo.descripcion}"
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                addToCart(selectedProductInfo);
                setSelectedProductInfo(null);
              }}
              className="btn btn-primary w-full h-9 justify-center font-bold mt-4"
            >
              Añadir al carrito
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
