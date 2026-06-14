"use client";
import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { ChevronLeft, Download, Mail, Printer, FileDown, Calendar, Search, Loader2, Plus, MessageSquare, Trash2, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  getOrdenById, 
  getClienteById, 
  getVehiculoById, 
  getItemsOrden,
  updateOrden,
  addItemOrden,
  deleteItemOrden,
  updateItemOrden,
  getIngresoOrigenDePresupuesto,
  deleteOrden
} from "@/lib/services";
import { OrdenTrabajo, Cliente, Vehiculo, ItemOrden } from "@/types";
import { toast } from "react-hot-toast";
import AgregarItemModal from "@/components/ordenes/AgregarItemModal";

export default function VistaPresupuesto({ presupuestoId }: { presupuestoId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [orden, setOrden] = useState<OrdenTrabajo | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [items, setItems] = useState<ItemOrden[]>([]);
  const [activeTab, setActiveTab] = useState("Vehículo");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const ordenData = await getOrdenById(presupuestoId);
      
      if (!ordenData) {
        toast.error("Presupuesto no encontrado");
        router.push("/presupuestos");
        return;
      }

      setOrden(ordenData);

      const [cData, vData, itemsData] = await Promise.all([
        ordenData.cliente || getClienteById(ordenData.clienteId),
        ordenData.vehiculo || getVehiculoById(ordenData.vehiculoId),
        getItemsOrden(presupuestoId)
      ]);

      if (ordenData.esCotizacion) {
        const ingresoOrigen = await getIngresoOrigenDePresupuesto(ordenData);
        if (ingresoOrigen) {
          if (!ordenData.informeTecnico) ordenData.informeTecnico = ingresoOrigen.informeTecnico;
          if (ordenData.motivo?.startsWith("Cotización derivada del ingreso")) {
             ordenData.motivo = ingresoOrigen.motivo;
          }
        }
      }

      setCliente(cData);
      setVehiculo(vData);
      setItems(itemsData);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar la información");
    } finally {
      setLoading(false);
    }
  }, [presupuestoId, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSaveField = async (field: Partial<OrdenTrabajo>) => {
    if (!orden) return;
    setSaving(true);
    try {
      await updateOrden(presupuestoId, field);
      setOrden({ ...orden, ...field });
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = async (itemData: Omit<ItemOrden, "id" | "ordenId" | "subtotal">) => {
    try {
      const subtotal = itemData.cantidad * itemData.precioUnitario;
      const newItem: Omit<ItemOrden, "id"> = {
        ...itemData,
        ordenId: presupuestoId,
        subtotal
      };
      
      const id = await addItemOrden(presupuestoId, newItem);
      setItems([...items, { ...newItem, id }]);
      toast.success("Agregado");
    } catch (error) {
      console.error(error);
      toast.error("Error al agregar");
    }
  };

  const handleDeleteItem = async (itemId?: string) => {
    if (!itemId) return;
    try {
      await deleteItemOrden(presupuestoId, itemId);
      setItems(items.filter(i => i.id !== itemId));
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar");
    }
  };

  const handleUpdateItem = async (itemId: string, fieldName: keyof ItemOrden, value: any) => {
    if (!itemId) return;
    try {
      const itemToUpdate = items.find(i => i.id === itemId);
      if (!itemToUpdate) return;
      const updatedItem = { ...itemToUpdate, [fieldName]: value };
      updatedItem.subtotal = updatedItem.cantidad * updatedItem.precioUnitario;
      
      await updateItemOrden(presupuestoId, itemId, { [fieldName]: value, subtotal: updatedItem.subtotal });
      setItems(items.map(it => it.id === itemId ? updatedItem : it));
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar");
    }
  };

  const handleAprobar = async () => {
    if (!orden) return;
    if (confirm("¿Estás seguro de aprobar este presupuesto?")) {
      setSaving(true);
      try {
        await updateOrden(presupuestoId, { estado: "Proceso", presupuestoConfirmadoPorCliente: true });
        setOrden({ ...orden, estado: "Proceso", presupuestoConfirmadoPorCliente: true });
        toast.success("Presupuesto aprobado");
      } catch (err) {
        console.error(err);
        toast.error("Error al aprobar");
      } finally {
        setSaving(false);
      }
    }
  };

  const handleEliminarPresupuesto = async () => {
    if (!orden) return;
    const isConfirmed = window.confirm("¿Seguro de eliminar este presupuesto?");
    if (!isConfirmed) return;

    setSaving(true);
    const toastId = toast.loading("Eliminando presupuesto...");
    try {
      await deleteOrden(presupuestoId);
      toast.success("Presupuesto eliminado con éxito", { id: toastId });
      router.push("/presupuestos");
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar el presupuesto", { id: toastId });
      setSaving(false);
    } finally {
      setIsMenuOpen(false);
    }
  };

  if (loading || !orden || !cliente || !vehiculo) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <Loader2 size={40} className="animate-spin text-blue-500" />
        </div>
      </AppShell>
    );
  }

  const subtotal = items.reduce((acc, it) => acc + (it.precioUnitario * it.cantidad), 0);
  const descuento = items.reduce((acc, it) => acc + (it.cantidad * 0 /* asumiendo dcto 0 por ahora */), 0);
  const base = subtotal - descuento;
  const iva = items.reduce((acc, it) => acc + ((it.precioUnitario * it.cantidad) * (it.impuestoAplicable / 100)), 0);
  const total = base + iva;

  return (
    <AppShell>
      <div className="flex flex-col overflow-hidden" style={{ height: "calc(100vh - 8.5rem)" }}>
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-3 mb-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <Link href="/presupuestos" className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold flex items-center gap-2">
              Presupuesto <span className="text-blue-600">#PRE-{String(orden.numeroCotizacion || orden.numero || 0).padStart(4, "0")}</span>
            </h1>
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-[var(--border)]">
               <span>Creación</span>
               <span className="font-semibold text-[var(--text-primary)]">
                 {orden.createdAt ? new Date(orden.createdAt.toMillis()).toLocaleDateString('es-ES') : "N/A"}
               </span>
               <Calendar size={14} className="ml-1" />
            </div>
            {saving && <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" />}
          </div>

          <div className="flex items-center gap-3">
            {/* Actions icons */}
            <div className="flex items-center gap-1 mr-2 text-[var(--text-secondary)]">
              <button className="btn-icon"><Printer size={18} /></button>
              <button className="btn-icon"><FileDown size={18} /></button>
              <button className="btn-icon"><Mail size={18} /></button>
              <button className="btn-icon"><MessageSquare size={18} /></button>
              <button className="btn-icon"><Calendar size={18} /></button>
            </div>
            <button className="btn bg-white border border-[var(--border)] shadow-sm font-semibold">
               ✉ Solicitar aprobación
            </button>
            <button 
              className="btn-primary bg-green-500 hover:bg-green-600 border-none shadow disabled:opacity-50"
              onClick={handleAprobar}
              disabled={saving || orden.presupuestoConfirmadoPorCliente}
            >
               {saving ? <Loader2 size={16} className="animate-spin" /> : orden.presupuestoConfirmadoPorCliente ? "✓ Aprobado" : "✓ Aprobar"}
            </button>
            <div className="relative">
              <button 
                type="button"
                className="btn bg-white border border-[var(--border)] shadow-sm hover:bg-[var(--bg-hover)] btn-icon h-10 w-10 justify-center"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                title="Más acciones"
              >
                <MoreHorizontal size={16} />
              </button>
              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                    <button
                      type="button"
                      onClick={handleEliminarPresupuesto}
                      className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2 border-0 bg-transparent cursor-pointer font-inherit"
                    >
                      <Trash2 size={14} />
                      Eliminar presupuesto
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 2 Columns Layout */}
        <div className="flex flex-1 gap-6 overflow-hidden">
          
          {/* Left Column: Items */}
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar border-r border-[var(--border)]">
            {/* Client Card */}
            <div className="flex gap-4 items-center mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0 uppercase">
                {(cliente.nombre?.[0] || "")}
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm uppercase">{cliente.nombre} {cliente.apellido}</p>
                <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">📞 {cliente.telefono}</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
                <input 
                  type="text" 
                  className="input pl-9 w-full border-blue-200 focus:border-blue-500 hover:border-blue-400 bg-blue-50/30" 
                  placeholder="Buscar producto, servicio o código de barras..." 
                  onClick={() => setIsCatalogOpen(true)}
                  readOnly
                />
              </div>
              <button 
                className="btn-primary bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center gap-2"
                onClick={() => setIsCatalogOpen(true)}
              >
                <Search size={16} /> Catálogo
              </button>
            </div>

            {/* Items Table */}
            <div className="flex-1 border border-[var(--border)] rounded-xl bg-white dark:bg-[var(--bg-card)] overflow-hidden flex flex-col">
              <div className="grid grid-cols-12 gap-2 p-3 text-xs font-bold text-[var(--text-muted)] uppercase border-b border-[var(--border)]">
                <div className="col-span-4">Descripción</div>
                <div className="col-span-2 text-center">Cant</div>
                <div className="col-span-2 text-right">Precio</div>
                <div className="col-span-1 text-center">IVA</div>
                <div className="col-span-1 text-center">Dcto</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] p-8 text-center">
                    <p className="text-sm">No hay ítems en el presupuesto.</p>
                    <p className="text-xs">Busca un producto o servicio arriba para agregarlo.</p>
                  </div>
                ) : (
                  items.map((item, idx) => (
                    <div key={item.id || idx} className="grid grid-cols-12 gap-2 p-3 text-sm border-b border-[var(--border)] items-center hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div className="col-span-4 font-semibold uppercase truncate" title={item.descripcion}>{item.descripcion}</div>
                      <div className="col-span-2 flex items-center justify-center gap-1">
                        <button 
                          className="w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-xs border border-slate-200 text-slate-600" 
                          onClick={() => handleUpdateItem(item.id!, "cantidad", Math.max(1, item.cantidad - 1))}
                        >
                          -
                        </button>
                        <input 
                          type="number" 
                          className="w-10 text-center border border-[var(--border)] rounded p-1 text-xs" 
                          value={item.cantidad} 
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[idx].cantidad = Number(e.target.value);
                            setItems(newItems);
                          }}
                          onBlur={(e) => handleUpdateItem(item.id!, "cantidad", Number(e.target.value))}
                        />
                        <button 
                          className="w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-xs border border-slate-200 text-slate-600" 
                          onClick={() => handleUpdateItem(item.id!, "cantidad", item.cantidad + 1)}
                        >
                          +
                        </button>
                      </div>
                      <div className="col-span-2 text-right">
                        <input 
                          type="number" 
                          className="w-16 text-right border border-[var(--border)] rounded p-1 text-xs" 
                          value={item.precioUnitario} 
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[idx].precioUnitario = Number(e.target.value);
                            setItems(newItems);
                          }}
                          onBlur={(e) => handleUpdateItem(item.id!, "precioUnitario", Number(e.target.value))}
                        />
                      </div>
                      <div className="col-span-1 text-center text-xs">{item.impuestoAplicable > 0 ? `${item.impuestoAplicable}%` : '0%'}</div>
                      <div className="col-span-1 text-center text-xs">0</div>
                      <div className="col-span-2 text-right font-bold flex items-center justify-end gap-2">
                        ${(item.precioUnitario * item.cantidad).toFixed(2)}
                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-[var(--text-muted)] hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Totals */}
              <div className="bg-slate-50 dark:bg-slate-900 border-t border-[var(--border)] p-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-[var(--text-muted)] uppercase">Subtotal</span>
                      <span className="font-bold">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <button className="text-blue-600 hover:underline flex items-center gap-1 text-xs">
                        🏷 Aplicar descuento
                      </button>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-[var(--text-muted)] uppercase">IVA (15%)</span>
                      <span className="font-bold">${iva.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg pt-2 border-t border-[var(--border)]">
                      <span className="font-bold uppercase">Total</span>
                      <span className="font-bold">${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Sidebar */}
          <div className="w-[340px] flex flex-col overflow-hidden pb-4">
            
            {/* Tabs */}
            <div className="flex border-b border-[var(--border)] mb-4 overflow-x-auto custom-scrollbar shrink-0">
              {["Vehículo", "Condiciones", "Notas", "Inspección", "Citas", "Adjuntos"].map(tab => (
                <button
                  key={tab}
                  className={`px-3 py-2 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {activeTab === "Vehículo" && (
                <div className="space-y-5">
                  <div className="card flex items-center gap-4 bg-white shadow-sm border border-[var(--border)]">
                    <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-white font-bold text-xl leading-none">V</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm leading-tight">{vehiculo.marca} {vehiculo.modelo}</h4>
                      <div className="badge badge-gray font-mono uppercase text-[10px] mt-1">{vehiculo.placa}</div>
                    </div>
                    <ChevronLeft size={16} className="rotate-[-90deg] text-[var(--text-muted)]" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold mb-1.5 block text-[var(--text-muted)]">Kilometraje</label>
                    <input 
                      type="number" 
                      className="input w-full bg-white text-sm" 
                      placeholder="Ej: 120000" 
                      value={orden.kilometrajeIngreso || ""}
                      onChange={(e) => setOrden({ ...orden, kilometrajeIngreso: Number(e.target.value) })}
                      onBlur={() => handleSaveField({ kilometrajeIngreso: orden.kilometrajeIngreso })}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold mb-1.5 block text-[var(--text-muted)]">Falla o Motivo</label>
                    <textarea 
                      className="input w-full bg-white text-sm min-h-[100px]" 
                      placeholder="Describe la falla o el motivo de la reparación..."
                      value={orden.motivo || ""}
                      onChange={(e) => setOrden({ ...orden, motivo: e.target.value })}
                      onBlur={() => handleSaveField({ motivo: orden.motivo })}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold mb-1.5 block text-[var(--text-muted)]">Diagnóstico</label>
                    <textarea 
                      className="input w-full bg-white text-sm min-h-[100px]" 
                      placeholder="Escribe el diagnóstico del vehículo..."
                      value={orden.informeTecnico || ""}
                      onChange={(e) => setOrden({ ...orden, informeTecnico: e.target.value })}
                      onBlur={() => handleSaveField({ informeTecnico: orden.informeTecnico })}
                    />
                  </div>
                </div>
              )}

              {activeTab !== "Vehículo" && (
                <div className="flex items-center justify-center h-40 text-sm text-[var(--text-muted)]">
                  Contenido de {activeTab} en construcción...
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="mt-4 pt-4 border-t border-[var(--border)] flex justify-end gap-2 shrink-0">
              <button className="btn bg-white border border-[var(--border)] shadow-sm flex items-center gap-2">
                <Mail size={16} /> Enviar
              </button>
              <button className="btn bg-white border border-[var(--border)] shadow-sm flex items-center gap-2">
                <FileDown size={16} /> PDF
              </button>
              <button className="btn-primary bg-blue-700 hover:bg-blue-800 border-none shadow flex items-center gap-2">
                <Printer size={16} /> Imprimir
              </button>
            </div>

          </div>
        </div>

      </div>
      
      {isCatalogOpen && (
        <AgregarItemModal 
          onClose={() => setIsCatalogOpen(false)}
          onAdd={handleAddItem}
        />
      )}
    </AppShell>
  );
}
