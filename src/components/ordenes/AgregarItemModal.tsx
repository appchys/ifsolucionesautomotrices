"use client";
import { useState, useEffect } from "react";
import { X, Search, Loader2, Plus } from "lucide-react";
import { getProductos, getServicios } from "@/lib/services";
import { Producto, Servicio, ItemOrden } from "@/types";

interface AgregarItemModalProps {
  tipo: "producto" | "servicio";
  onClose: () => void;
  onAdd: (item: Omit<ItemOrden, "id" | "ordenId" | "subtotal">) => Promise<void>;
}

export default function AgregarItemModal({ tipo, onClose, onAdd }: AgregarItemModalProps) {
  const [items, setItems] = useState<(Producto | Servicio)[]>([]);
  const [filtered, setFiltered] = useState<(Producto | Servicio)[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Custom manual entry
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState<number | "">("");
  const [manualQty, setManualQty] = useState<number>(1);
  const [manualIva, setManualIva] = useState<number>(12);

  const [addingItemStr, setAddingItemStr] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [tipo]);

  useEffect(() => {
    const term = search.toLowerCase();
    if (!term) {
      setFiltered(items);
    } else {
      setFiltered(items.filter(i => i.nombre.toLowerCase().includes(term)));
    }
  }, [search, items]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tipo === "producto") {
        const p = await getProductos();
        setItems(p);
      } else {
        const s = await getServicios();
        setItems(s);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFromDb = async (item: Producto | Servicio) => {
    setAddingItemStr(item.id || "temp");
    try {
      await onAdd({
        tipo,
        descripcion: item.nombre,
        cantidad: 1, // Default 1 for quick add
        precioUnitario: item.precioBase,
        impuestoAplicable: item.aplicaIva ? 12 : 0, // Assume 12% if aplicaIva is true
      });
      // Optionally don't close, let them add multiple!
      // onClose();
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
    } finally {
      setAddingItemStr(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[var(--bg-card)] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Agregar {tipo === "producto" ? "Productos" : "Servicios"}
          </h2>
          <button onClick={onClose} className="btn-ghost btn-icon">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
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
            
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[var(--text-muted)]" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>
                No se encontraron {tipo}s.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {filtered.map(item => (
                  <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-body)] hover:border-[var(--accent)] transition-colors">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{item.nombre}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        ${item.precioBase.toFixed(2)} {item.aplicaIva ? "+ IVA" : ""}
                        {tipo === "producto" && (item as Producto).sku && ` • SKU: ${(item as Producto).sku}`}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleAddFromDb(item)} 
                      disabled={addingItemStr === item.id}
                      className="btn-secondary btn-sm flex-shrink-0"
                    >
                      {addingItemStr === item.id ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      Agregar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section-divider my-2" />

          {/* Agregar manualmente */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
              Agregar {tipo} manual
            </h3>
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
                  <option value={12}>12%</option>
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
              Agregar Manual
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
