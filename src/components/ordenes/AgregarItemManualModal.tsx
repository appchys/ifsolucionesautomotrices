"use client";

import { useState } from "react";
import { X, Box, PenTool, Plus, Loader2, Database, Tag, DollarSign, Boxes, Ruler, Check, ChevronDown, ChevronUp, Sliders, FileText } from "lucide-react";
import { createProducto, createServicio, calcularPrecioVenta } from "@/lib/services";
import { Producto, Servicio, ItemOrden } from "@/types";
import { toast } from "react-hot-toast";

interface AgregarItemManualModalProps {
  onClose: () => void;
  onAdd: (item: Omit<ItemOrden, "id" | "ordenId" | "subtotal">) => Promise<void>;
}

const PRODUCT_UNITS = ["Unidad", "Litro", "Galón", "Metro", "Kilogramo", "Gramo", "Caja", "Par", "Juego"];

export default function AgregarItemManualModal({ onClose, onAdd }: AgregarItemManualModalProps) {
  const [tipo, setTipo] = useState<"producto" | "servicio">("producto");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [sku, setSku] = useState("");
  const [categoria, setCategoria] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [unidadMedida, setUnidadMedida] = useState("Unidad");
  
  const [costoBase, setCostoBase] = useState<number | "">(0);
  const [margenGanancia, setMargenGanancia] = useState<number | "">(25);
  const [precioSinIva, setPrecioSinIva] = useState<number | "">(0);
  const [precioVenta, setPrecioVenta] = useState<number | "">(0);
  const [aplicaIva, setAplicaIva] = useState(false); // Inicialmente desmarcado
  const [stockInicial, setStockInicial] = useState<number | "">(0);
  
  const [conservar, setConservar] = useState(false);
  const [mostrarDetalles, setMostrarDetalles] = useState(false);
  const [loading, setLoading] = useState(false);

  // Recalcular bidireccionalmente entre Costo Base, Margen, Valor antes de IVA y Precio Venta (Total)
  const handleCostoBaseChange = (val: string) => {
    const c = val === "" ? "" : Number(val);
    setCostoBase(c);
    if (typeof c === "number" && c >= 0) {
      if (typeof margenGanancia === "number") {
        const sinIva = Number((c * (1 + margenGanancia / 100)).toFixed(2));
        const conIva = aplicaIva ? Number((sinIva * 1.15).toFixed(2)) : sinIva;
        setPrecioSinIva(sinIva);
        setPrecioVenta(conIva);
      }
    }
  };

  const handleMargenChange = (val: string) => {
    const m = val === "" ? "" : Number(val);
    setMargenGanancia(m);
    if (typeof m === "number" && typeof costoBase === "number") {
      const sinIva = Number((costoBase * (1 + m / 100)).toFixed(2));
      const conIva = aplicaIva ? Number((sinIva * 1.15).toFixed(2)) : sinIva;
      setPrecioSinIva(sinIva);
      setPrecioVenta(conIva);
    }
  };

  const handlePrecioSinIvaChange = (val: string) => {
    const sinIva = val === "" ? "" : Number(val);
    setPrecioSinIva(sinIva);
    if (typeof sinIva === "number" && sinIva >= 0) {
      const conIva = aplicaIva ? Number((sinIva * 1.15).toFixed(2)) : sinIva;
      setPrecioVenta(conIva);
      if (typeof costoBase === "number" && costoBase > 0) {
        const m = Number((((sinIva / costoBase) - 1) * 100).toFixed(2));
        setMargenGanancia(Number.isFinite(m) && m >= 0 ? m : 0);
      }
    }
  };

  const handlePrecioVentaChange = (val: string) => {
    const conIva = val === "" ? "" : Number(val);
    setPrecioVenta(conIva);
    if (typeof conIva === "number" && conIva >= 0) {
      const sinIva = aplicaIva ? Number((conIva / 1.15).toFixed(2)) : conIva;
      setPrecioSinIva(sinIva);
      if (typeof costoBase === "number" && costoBase > 0) {
        const m = Number((((sinIva / costoBase) - 1) * 100).toFixed(2));
        setMargenGanancia(Number.isFinite(m) && m >= 0 ? m : 0);
      }
    }
  };

  const handleAplicaIvaChange = (conIva: boolean) => {
    setAplicaIva(conIva);
    if (typeof precioSinIva === "number") {
      const pTotal = conIva ? Number((precioSinIva * 1.15).toFixed(2)) : precioSinIva;
      setPrecioVenta(pTotal);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConservarChange = (checked: boolean) => {
    setConservar(checked);
    if (checked) {
      setMostrarDetalles(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombreClean = nombre.trim();
    if (!nombreClean) {
      toast.error("Ingresa el nombre del ítem");
      return;
    }

    const numCantidad = 1;
    const numPrecioVenta = Math.max(0, Number(precioVenta) || 0);
    const numPrecioSinIva = Math.max(0, Number(precioSinIva) || 0);
    const numCostoBase = Math.max(0, Number(costoBase) || 0);
    const numMargen = Math.max(0, Number(margenGanancia) || 0);
    const numStock = Math.max(0, Math.floor(Number(stockInicial) || 0));

    setLoading(true);
    try {
      let createdId: string | undefined = undefined;
      let finalSku = sku.trim().toUpperCase();

      if (conservar) {
        if (tipo === "producto") {
          if (!finalSku) {
            finalSku = `MAN-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
          }
          const productoData: Omit<Producto, "id"> = {
            nombre: nombreClean,
            descripcion: descripcion.trim() || undefined,
            sku: finalSku,
            categoria: categoria.trim() || undefined,
            fabricante: fabricante.trim() || undefined,
            unidadMedida: unidadMedida || "Unidad",
            costoBase: numCostoBase,
            margenGanancia: numMargen,
            aplicaIva,
            stockActual: numStock,
            precioBase: numPrecioVenta,
          };
          createdId = await createProducto(productoData);
        } else {
          const servicioData: Omit<Servicio, "id"> = {
            nombre: nombreClean,
            descripcion: descripcion.trim() || undefined,
            costoBase: numCostoBase,
            precioBase: numPrecioVenta,
            aplicaIva,
          };
          createdId = await createServicio(servicioData);
        }
      }

      // El precio unitario del ítem de la orden se envía como el valor antes de IVA
      const precioUnitario = numPrecioSinIva;

      await onAdd({
        tipo,
        productoId: createdId,
        productoSku: finalSku || undefined,
        productoNombre: nombreClean,
        descripcion: descripcion.trim() || nombreClean,
        cantidad: numCantidad,
        precioUnitario,
        impuestoAplicable: aplicaIva ? 15 : 0,
      });

      if (conservar) {
        toast.success(`${tipo === "producto" ? "Producto" : "Servicio"} guardado en el catálogo y agregado`);
      } else {
        toast.success("Ítem manual agregado al presupuesto");
      }

      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Error al agregar el ítem manual");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4 transition-all duration-300"
    >
      <div className="bg-white dark:bg-[var(--bg-card)] w-full max-w-lg rounded-2xl shadow-2xl flex flex-col border border-[var(--border)] max-h-[90vh] overflow-hidden min-h-0">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] shrink-0 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center font-bold">
              <Plus size={18} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[var(--text-primary)] leading-tight">
                Agregar Ítem Manual
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Crea un producto o servicio para este presupuesto
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md text-[var(--text-muted)] hover:text-slate-700 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          
          {/* Selector de Tipo (Producto / Servicio) */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Tipo de Ítem
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
              <button
                type="button"
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border-none ${
                  tipo === "producto"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 bg-transparent"
                }`}
                onClick={() => setTipo("producto")}
              >
                <Box size={16} /> Producto
              </button>
              <button
                type="button"
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border-none ${
                  tipo === "servicio"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 bg-transparent"
                }`}
                onClick={() => setTipo("servicio")}
              >
                <PenTool size={16} /> Servicio
              </button>
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800 dark:text-slate-100"
              placeholder={tipo === "producto" ? "Ej: Aceite Sintético 5W30 1L" : "Ej: Limpieza de Inyectores"}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
            />
          </div>

          {/* Precios y Costo Principales (Alineados Verticalmente) */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <DollarSign size={12} /> Costo Base ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  value={costoBase}
                  onChange={(e) => handleCostoBaseChange(e.target.value)}
                />
              </div>

              {tipo === "producto" && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Margen (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                    value={margenGanancia}
                    onChange={(e) => handleMargenChange(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Valor antes de IVA ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  value={precioSinIva}
                  onChange={(e) => handlePrecioSinIvaChange(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Precio Venta (Total) ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-extrabold text-blue-600 dark:text-blue-400 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={precioVenta}
                  onChange={(e) => handlePrecioVentaChange(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                  checked={aplicaIva}
                  onChange={(e) => handleAplicaIvaChange(e.target.checked)}
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Aplica IVA (15%)
                </span>
              </label>
            </div>
          </div>

          {/* CHECKBOX DE CONSERVAR (BASE DE DATOS) */}
          <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/50 rounded-xl transition-all">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 accent-blue-600 cursor-pointer shrink-0"
                checked={conservar}
                onChange={(e) => handleConservarChange(e.target.checked)}
              />
              <div>
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <Database size={14} className="text-blue-600" />
                  Conservar en el catálogo (Guardar en base de datos)
                </span>
                <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 mt-0.5 leading-snug">
                  {conservar
                    ? `El ${tipo} se guardará permanentemente en la base de datos para usarlo en futuros presupuestos.`
                    : `Solo se agregará a este presupuesto. No se registrará en el catálogo general.`}
                </p>
              </div>
            </label>
          </div>

          {/* COLAPSABLE: TODOS LOS DETALLES */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/40">
            <button
              type="button"
              onClick={() => setMostrarDetalles(!mostrarDetalles)}
              className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 transition-colors flex items-center justify-between text-left cursor-pointer border-none"
            >
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Sliders size={14} className="text-blue-600" />
                Todos los detalles
              </span>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <span>{mostrarDetalles ? "Ocultar" : "Mostrar"}</span>
                {mostrarDetalles ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {mostrarDetalles && (
              <div className="p-4 space-y-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                
                {/* Descripción / Detalles adicionales */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <FileText size={12} /> Descripción / Detalles adicionales
                  </label>
                  <input
                    type="text"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
                    placeholder="Detalle o especificación técnica opcional..."
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                  />
                </div>

                {/* Campos exclusivos de Producto */}
                {tipo === "producto" && (
                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
                        <Tag size={12} /> SKU (Código)
                      </label>
                      <input
                        type="text"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ej: ACE-5W30"
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
                        <Ruler size={12} /> Unidad Medida
                      </label>
                      <select
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100 cursor-pointer"
                        value={unidadMedida}
                        onChange={(e) => setUnidadMedida(e.target.value)}
                      >
                        {PRODUCT_UNITS.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Categoría
                      </label>
                      <input
                        type="text"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ej: Lubricantes"
                        value={categoria}
                        onChange={(e) => setCategoria(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Fabricante / Marca
                      </label>
                      <input
                        type="text"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ej: Mobil 1"
                        value={fabricante}
                        onChange={(e) => setFabricante(e.target.value)}
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Stock Inicial
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="w-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        value={stockInicial}
                        onChange={(e) => setStockInicial(e.target.value === "" ? "" : Number(e.target.value))}
                      />
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-none cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !nombre.trim()}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2 border-none cursor-pointer disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Agregar al Presupuesto</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
