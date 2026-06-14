"use client";
import React, { useEffect, useState } from "react";
import { X, Search, Loader2, Calendar, User, CornerDownLeft, AlertTriangle } from "lucide-react";
import { getVentas, anularVenta } from "@/lib/services";
import { Venta } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "react-hot-toast";

interface Props {
  onClose: () => void;
  onRefreshPOS?: () => void;
}

export default function HistorialVentasModal({ onClose, onRefreshPOS }: Props) {
  const [loading, setLoading] = useState(false);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [search, setSearch] = useState("");
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const [voiding, setVoiding] = useState(false);

  const fetchVentas = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await getVentas();
      setVentas(list);
      setSelectedVenta((prev) => {
        if (list.length > 0 && !prev) return list[0];
        if (prev) {
          const updated = list.find((v) => v.id === prev.id);
          return updated || prev;
        }
        return prev;
      });
    } catch (err) {
      console.error("Error al obtener ventas:", err);
      toast.error("Error al cargar historial de ventas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      await Promise.resolve();
      if (active) {
        fetchVentas();
      }
    };
    init();
    return () => {
      active = false;
    };
  }, [fetchVentas]);

  const filteredVentas = ventas.filter((v) => {
    const term = search.toLowerCase();
    return (
      v.numeroVenta.toLowerCase().includes(term) ||
      v.clienteNombre.toLowerCase().includes(term) ||
      (v.clienteIdentificacion && v.clienteIdentificacion.includes(term)) ||
      v.vendedorNombre.toLowerCase().includes(term)
    );
  });

  const handleAnularVenta = async (ventaId: string) => {
    if (!window.confirm("¿Estás seguro de que deseas anular esta venta? Esto reintegrará los productos al inventario.")) {
      return;
    }

    setVoiding(true);
    try {
      await anularVenta(ventaId);
      toast.success("Venta anulada correctamente. Stock devuelto.");
      await fetchVentas();
      if (onRefreshPOS) onRefreshPOS();
    } catch (err) {
      console.error("Error al anular venta:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error al anular la venta: ${msg}`);
    } finally {
      setVoiding(false);
    }
  };

  const toDate = (val: unknown): Date | null => {
    if (!val) return null;
    if (typeof val === "object" && val !== null && "toDate" in val && typeof (val as { toDate: unknown }).toDate === "function") {
      return (val as { toDate: () => Date }).toDate();
    }
    if (val instanceof Date) return val;
    return new Date(val as string);
  };

  const formatFecha = (val: unknown) => {
    const d = toDate(val);
    if (!d) return "—";
    return format(d, "dd-MMM-yyyy HH:mm", { locale: es });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[var(--bg-card)] rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col h-[85vh] overflow-hidden border border-[var(--border)] animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Historial de Ventas</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Consulta y anula las ventas registradas</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* Left panel: List */}
          <div className="w-2/5 border-r border-[var(--border)] flex flex-col min-w-[280px]">
            <div className="p-4 border-b border-[var(--border)]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  className="input pl-9 h-10 w-full"
                  placeholder="Buscar por N°, cliente, vendedor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)] divide-dashed">
              {loading && ventas.length === 0 ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="animate-spin text-[var(--accent)]" />
                </div>
              ) : filteredVentas.length === 0 ? (
                <p className="text-center py-16 text-sm text-[var(--text-muted)]">No se encontraron ventas</p>
              ) : (
                filteredVentas.map((v) => {
                  const isSelected = selectedVenta?.id === v.id;
                  const isAnulada = v.estado === "anulada";
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVenta(v)}
                      className={`w-full p-4 text-left transition-colors relative ${
                        isSelected 
                          ? "bg-blue-50/40 dark:bg-blue-900/5" 
                          : "hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--accent)]" />
                      )}
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-sm text-[var(--accent)]">
                          {v.numeroVenta}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {toDate(v.createdAt) ? format(toDate(v.createdAt)!, "dd/MM HH:mm") : "—"}
                        </span>
                      </div>
                      
                      <p className="font-semibold text-xs text-[var(--text-primary)] mt-1 truncate">
                        {v.clienteNombre}
                      </p>

                      <div className="flex justify-between items-center mt-2.5">
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          ${Number(v.total || 0).toFixed(2)}
                        </span>
                        
                        <span className={`badge ${
                          isAnulada 
                            ? "bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30" 
                            : "bg-green-50 text-green-600 border border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30"
                        }`}>
                          {isAnulada ? "Anulada" : "Completada"}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right panel: Details */}
          <div className="flex-1 flex flex-col overflow-y-auto p-6 bg-slate-50/30 dark:bg-[var(--bg-secondary)]/10">
            {selectedVenta ? (
              <div className="space-y-6">
                
                {/* Status Box */}
                <div className={`p-4 rounded-xl border flex items-center justify-between ${
                  selectedVenta.estado === "anulada"
                    ? "bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400"
                    : "bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-900/30 text-green-700 dark:text-green-400"
                }`}>
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle size={18} />
                    <div>
                      <p className="font-bold text-sm capitalize">Venta {selectedVenta.estado}</p>
                      <p className="text-xs opacity-80">Registrada el {formatFecha(selectedVenta.createdAt)}</p>
                    </div>
                  </div>

                  {selectedVenta.estado === "completada" && (
                    <button
                      onClick={() => handleAnularVenta(selectedVenta.id!)}
                      disabled={voiding}
                      className="btn btn-danger btn-sm h-8 px-4 flex items-center gap-1"
                    >
                      {voiding ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <CornerDownLeft size={13} />
                      )}
                      Anular Venta
                    </button>
                  )}
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="card p-4">
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Cliente</p>
                    <p className="font-bold text-sm text-[var(--text-primary)]">{selectedVenta.clienteNombre}</p>
                    {selectedVenta.clienteIdentificacion && (
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">Identificación: {selectedVenta.clienteIdentificacion}</p>
                    )}
                  </div>

                  <div className="card p-4">
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Detalle de Registro</p>
                    <p className="font-bold text-sm text-[var(--text-primary)]">Vendedor: {selectedVenta.vendedorNombre}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 capitalize font-bold text-blue-600 dark:text-blue-400">Pago: {selectedVenta.metodoPago}</p>
                  </div>
                </div>

                {/* Notes */}
                {selectedVenta.notas && (
                  <div className="card p-4">
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Notas de la Venta</p>
                    <p className="text-sm text-[var(--text-secondary)] italic">&ldquo;{selectedVenta.notas}&rdquo;</p>
                  </div>
                )}

                {/* Items Table */}
                <div className="card p-0 overflow-hidden border-[var(--border)]">
                  <table className="table">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/10 border-b border-[var(--border)]">
                        <th>Descripción</th>
                        <th className="text-center">Cant.</th>
                        <th className="text-right">Precio Unit.</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] divide-dashed">
                      {selectedVenta.items.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <p className="font-semibold text-sm text-[var(--text-primary)]">{item.nombre}</p>
                            <p className="text-[10px] text-[var(--text-muted)] font-mono">{item.sku}</p>
                          </td>
                          <td className="text-center text-sm">{item.cantidad}</td>
                          <td className="text-right text-sm">${item.precioUnitario.toFixed(2)}</td>
                          <td className="text-right font-semibold text-sm text-[var(--text-primary)]">${item.subtotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary */}
                <div className="flex justify-end">
                  <div className="w-64 space-y-2 border border-[var(--border)] rounded-xl p-4 bg-white dark:bg-[var(--bg-card)]">
                    <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                      <span>Subtotal:</span>
                      <span>${Number(selectedVenta.subtotal || 0).toFixed(2)}</span>
                    </div>
                    {selectedVenta.descuento > 0 && (
                      <div className="flex justify-between text-xs text-green-600">
                        <span>Descuento:</span>
                        <span>-${Number(selectedVenta.descuento).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                      <span>IVA (15%):</span>
                      <span>${Number(selectedVenta.iva || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-[var(--border)] font-bold text-base text-[var(--text-primary)]">
                      <span>Total:</span>
                      <span>${Number(selectedVenta.total || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
                <p>Selecciona una venta del historial para ver el detalle</p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
