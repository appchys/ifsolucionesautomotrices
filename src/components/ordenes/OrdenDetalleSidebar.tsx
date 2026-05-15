"use client";
import { useEffect, useState, useRef } from "react";
import {
  getOrdenById, getItemsOrden, addItemOrden, updateItemOrden, deleteItemOrden,
  updateOrden, updateEstadoOrden, uploadOrdenFoto, getClienteById, getVehiculoById
} from "@/lib/services";
import { OrdenTrabajo, ItemOrden, EstadoOrden } from "@/types";
import {
  X, Plus, Trash2, Save, Camera, MessageCircle, FileText,
  Loader2, Check, Car, User, Wrench, DollarSign
} from "lucide-react";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import AgregarItemModal from "@/components/ordenes/AgregarItemModal";

const ESTADOS: EstadoOrden[] = ["Ingreso", "Proceso", "Finalizado", "Entregado"];
const ESTADO_BADGES: Record<EstadoOrden, string> = {
  Ingreso: "status-ingreso", Proceso: "status-proceso",
  Finalizado: "status-finalizado", Entregado: "status-entregado",
};

interface Props {
  ordenId: string;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function OrdenDetalleSidebar({ ordenId, onClose, onUpdate }: Props) {
  const [orden, setOrden] = useState<OrdenTrabajo | null>(null);
  const [items, setItems] = useState<ItemOrden[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingInforme, setSavingInforme] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [informeTecnico, setInformeTecnico] = useState("");
  const [notasInternas, setNotasInternas] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeModal, setActiveModal] = useState<"producto" | "servicio" | null>(null);

  const load = async () => {
    if (!ordenId) return;
    setLoading(true);
    const o = await getOrdenById(ordenId);
    if (!o) { 
      toast.error("Orden no encontrada"); 
      onClose(); 
      return; 
    }
    const [cliente, vehiculo] = await Promise.all([
      getClienteById(o.clienteId),
      getVehiculoById(o.vehiculoId)
    ]);
    setOrden({ ...o, cliente: cliente ?? undefined, vehiculo: vehiculo ?? undefined });
    setItems(await getItemsOrden(ordenId));
    setInformeTecnico(o.informeTecnico ?? "");
    setNotasInternas(o.notasInternas ?? "");
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Bloquear scroll del body
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, [ordenId]);

  const cambiarEstado = async (estado: EstadoOrden) => {
    await updateEstadoOrden(ordenId, estado);
    setOrden((prev) => prev ? { ...prev, estado } : prev);
    toast.success(`Estado: ${estado}`);
    if (onUpdate) onUpdate();
  };

  const guardarInforme = async () => {
    setSavingInforme(true);
    await updateOrden(ordenId, { informeTecnico, notasInternas });
    toast.success("Informe guardado");
    setSavingInforme(false);
    if (onUpdate) onUpdate();
  };

  const convertirAOrden = async () => {
    setSavingInforme(true);
    try {
      await updateOrden(ordenId, { esCotizacion: false });
      setOrden((prev) => prev ? { ...prev, esCotizacion: false } : prev);
      toast.success("¡Cotización convertida a Orden!");
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error(error);
      toast.error("Error al convertir");
    } finally {
      setSavingInforme(false);
    }
  };

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFoto(true);
    try {
      const url = await uploadOrdenFoto(ordenId, file);
      const fotoUrls = [...(orden?.fotoUrls ?? []), url];
      await updateOrden(ordenId, { fotoUrls });
      setOrden((prev) => prev ? { ...prev, fotoUrls } : prev);
      toast.success("Foto cargada");
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleAddItem = async (item: Omit<ItemOrden, "id" | "ordenId" | "subtotal">) => {
    const subtotal = item.cantidad * item.precioUnitario * (1 + item.impuestoAplicable / 100);
    await addItemOrden(ordenId, { ...item, subtotal, ordenId: ordenId });
    setItems(await getItemsOrden(ordenId));
    toast.success("Ítem agregado");
  };

  const eliminarItem = async (itemId: string) => {
    await deleteItemOrden(ordenId, itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    toast.success("Ítem eliminado");
  };

  const total = items.reduce((s, i) => s + i.subtotal, 0);

  const enviarWhatsApp = () => {
    if (!orden?.cliente?.telefono) { toast.error("Cliente sin teléfono registrado"); return; }
    const tel = orden.cliente.telefono.replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Hola ${orden.cliente.nombre}, le informamos que su vehículo *${orden.vehiculo?.placa ?? ""}* ` +
      `(${orden.vehiculo?.marca} ${orden.vehiculo?.modelo}) se encuentra en estado: *${orden.estado}*.\n\n` +
      `Motivo: ${orden.motivo}\n` +
      `Orden #${String(orden.numero ?? 0).padStart(4, "0")}\n\n` +
      `Gracias por confiar en I.F. Soluciones Automotrices.`
    );
    window.open(`https://wa.me/${tel}?text=${msg}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* Sidebar Content */}
      <div className="relative w-full bg-[var(--bg-primary)] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-card)] sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="btn-ghost btn-icon -ml-2">
              <X size={20} />
            </button>
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {orden?.esCotizacion ? "Cotización" : "Orden"} #{orden ? String(orden.numero ?? 0).padStart(4, "0") : "..."}
              </h2>
              {orden && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {orden.createdAt ? format((orden.createdAt as any).toDate(), "d 'de' MMMM, yyyy", { locale: es }) : ""}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {orden?.esCotizacion && (
              <button onClick={convertirAOrden} disabled={savingInforme} className="btn-success btn-sm">
                <Check size={14} /> Confirmar Orden
              </button>
            )}
            <button onClick={enviarWhatsApp} className="btn-success btn-sm">
              <MessageCircle size={15} /> WhatsApp
            </button>
            <button onClick={guardarInforme} disabled={savingInforme || loading} className="btn-primary btn-sm">
              {savingInforme ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="spinner" />
          </div>
        ) : !orden ? null : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {!orden.esCotizacion && (
              <div className="flex gap-2 flex-wrap pb-4 border-b border-[var(--border)]">
                {ESTADOS.map((e) => (
                  <button
                    key={e}
                    onClick={() => cambiarEstado(e)}
                    className={`badge cursor-pointer transition-all ${
                      orden.estado === e ? ESTADO_BADGES[e] + " glow-ring" : "badge-gray"
                    }`}
                    style={{ padding: "6px 14px", fontSize: "12px" }}
                  >
                    {orden.estado === e && <Check size={12} />}
                    {e}
                  </button>
                ))}
              </div>
            )}
            
            {orden.esCotizacion && (
              <div className="pb-4 border-b border-[var(--border)]">
                <span className="badge" style={{ background: "rgba(37,99,235,0.1)", color: "var(--accent)", border: "1px solid var(--accent-alpha)", padding: "6px 14px" }}>
                  ESTADO: COTIZACIÓN PENDIENTE
                </span>
                <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                  Esta cotización aún no ha sido confirmada como orden de trabajo.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Cliente & Vehiculo */}
              <div className="card bg-[var(--bg-card)]">
                <div className="flex items-center gap-2 mb-3">
                  <User size={16} style={{ color: "var(--accent-light)" }} />
                  <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Cliente</h3>
                </div>
                <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                  {orden.cliente?.nombre} {orden.cliente?.apellido}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{orden.cliente?.identificacion}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{orden.cliente?.telefono}</p>
              </div>

              <div className="card bg-[var(--bg-card)]">
                <div className="flex items-center gap-2 mb-3">
                  <Car size={16} style={{ color: "var(--warning)" }} />
                  <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Vehículo</h3>
                </div>
                <p className="font-mono font-bold text-sm" style={{ color: "var(--text-primary)" }}>{orden.vehiculo?.placa}</p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {orden.vehiculo?.marca} {orden.vehiculo?.modelo} {orden.vehiculo?.anio}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{orden.vehiculo?.color} · {orden.vehiculo?.tipoVehiculo}</p>
              </div>
            </div>

            {/* Detalles */}
            <div className="card bg-[var(--bg-card)]">
              <h3 className="font-semibold text-sm mb-3" style={{ color: "var(--text-primary)" }}>Información de Ingreso</h3>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                <div>
                  <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Tipo de Servicio</p>
                  <p className="text-sm font-medium">{orden.tipoServicio}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Kilometraje</p>
                  <p className="text-sm font-medium">{orden.kilometrajeIngreso.toLocaleString()} km</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Motivo de Visita</p>
                  <p className="text-sm">{orden.motivo}</p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="card bg-[var(--bg-card)] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Productos y Servicios</h3>
                <span className="font-bold text-base" style={{ color: "var(--success)" }}>Total: ${total.toFixed(2)}</span>
              </div>
              
              <div className="flex gap-2">
                <button onClick={() => setActiveModal("producto")} className="btn-secondary btn-sm flex-1 justify-center">
                  <Plus size={14} /> Producto
                </button>
                <button onClick={() => setActiveModal("servicio")} className="btn-secondary btn-sm flex-1 justify-center">
                  <Plus size={14} /> Servicio
                </button>
              </div>

              <div className="table-container border border-[var(--border)] rounded-lg">
                <table className="table">
                  <thead className="bg-[var(--bg-secondary)]">
                    <tr>
                      <th className="text-[10px]">Desc.</th>
                      <th className="text-[10px]">Cant.</th>
                      <th className="text-[10px]">Subt.</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="text-xs">
                        <td>{item.descripcion}</td>
                        <td>{item.cantidad}</td>
                        <td className="font-semibold">${item.subtotal.toFixed(2)}</td>
                        <td className="text-right">
                          <button onClick={() => eliminarItem(item.id!)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Informe y Notas */}
            <div className="space-y-4">
              <div className="card bg-[var(--bg-card)]">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={16} style={{ color: "var(--accent-light)" }} />
                  <h3 className="font-semibold text-sm">Informe Técnico</h3>
                </div>
                <textarea
                  className="input text-sm resize-none"
                  rows={4}
                  placeholder="Escribe el diagnóstico y trabajos realizados..."
                  value={informeTecnico}
                  onChange={(e) => setInformeTecnico(e.target.value)}
                />
              </div>
              <div className="card bg-[var(--bg-card)]">
                <h3 className="font-semibold text-sm mb-2">Notas Internas</h3>
                <textarea
                  className="input text-sm resize-none"
                  rows={2}
                  placeholder="Notas privadas para el equipo..."
                  value={notasInternas}
                  onChange={(e) => setNotasInternas(e.target.value)}
                />
              </div>
            </div>

            {/* Fotos */}
            <div className="card bg-[var(--bg-card)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Fotos</h3>
                <button 
                  onClick={() => fileRef.current?.click()} 
                  disabled={uploadingFoto}
                  className="btn-ghost btn-sm text-[var(--accent)]"
                >
                  <Camera size={14} className="mr-1" /> Subir
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFotoUpload} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {orden.fotoUrls?.map((url, i) => (
                  <a href={url} target="_blank" key={i} className="relative rounded-lg overflow-hidden aspect-square border border-[var(--border)]">
                    <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {activeModal && (
        <AgregarItemModal 
          tipo={activeModal} 
          onClose={() => setActiveModal(null)} 
          onAdd={handleAddItem} 
        />
      )}
    </div>
  );
}
