"use client";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getOrdenById,
  getItemsOrden,
  addItemOrden,
  updateItemOrden,
  deleteItemOrden,
  updateOrden,
  updateEstadoOrden,
  uploadOrdenFoto,
  getClienteById,
  getVehiculoById,
  getPagos,
  createPago,
  deletePago,
  deleteOrden,
  createDevolucion,
  getDevolucionesByOrden,
} from "@/lib/services";
import {
  OrdenTrabajo,
  ItemOrden,
  EstadoOrden,
  Pago,
  MetodoPago,
  TipoServicio,
  NivelCombustible,
  ChecklistItem,
  DanoVehiculo,
  Devolucion,
  AccionInventarioDevolucion,
  MetodoDevolucion,
  Vehiculo,
} from "@/types";
import {
  X,
  Plus,
  Trash2,
  Save,
  Camera,
  MessageCircle,
  FileText,
  Loader2,
  Check,
  Car,
  User,
  DollarSign,
  RotateCcw,
  Edit2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import AgregarItemModal from "@/components/ordenes/AgregarItemModal";
import DamageSelector from "@/components/recepcion/DamageSelector";
import ChecklistInventario from "@/components/recepcion/ChecklistInventario";
import FuelSelector from "@/components/recepcion/FuelSelector";
import VehiculoModal from "@/components/vehiculos/VehiculoModal";
import { BANCOS_TRANSFERENCIA, BANCO_TRANSFERENCIA_LIST_ID } from "@/lib/paymentBanks";
import {
  calcularPagoConRecargo,
  getPagoMetodoLabel,
  getPagoMontoBase,
  getPagoRecargo,
  METODOS_PAGO_ORDEN,
} from "@/lib/orderPayments";
import { getMergedChecklist } from "@/lib/checklist";

const ESTADOS: EstadoOrden[] = [
  "Borrador",
  "En Diagnóstico",
  "Esperando Repuestos",
  "Esperando Aprobación",
  "En Reparación",
  "Completada",
  "Listo para Entrega",
  "Entregada",
  "Cancelada",
];

const ESTADO_BADGES: Record<EstadoOrden, string> = {
  "Borrador": "badge-gray",
  "En Diagnóstico": "badge-blue",
  "Esperando Repuestos": "badge-yellow",
  "Esperando Aprobación": "badge-purple",
  "En Reparación": "badge-cyan",
  "Completada": "badge-green",
  "Listo para Entrega": "badge-green",
  "Entregada": "badge-gray",
  "Cancelada": "badge-red",
};

const getNumeroDocumento = (orden: OrdenTrabajo) =>
  orden.esCotizacion ? orden.numeroCotizacion ?? orden.numero : orden.numero;
interface Props {
  ordenId: string;
  onClose: () => void;
  onUpdate?: () => void;
  onEdit?: (ordenId: string) => void;
}

export default function OrdenDetalleSidebar({ ordenId, onClose, onUpdate, onEdit }: Props) {
  const [mounted, setMounted] = useState(false);
  const [orden, setOrden] = useState<OrdenTrabajo | null>(null);
  const [items, setItems] = useState<ItemOrden[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingInforme, setSavingInforme] = useState(false);
  const [deletingOrden, setDeletingOrden] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [activeTab, setActiveTab] = useState<"orden" | "inspeccion" | "personal" | "devoluciones">("orden");
  const [activeModal, setActiveModal] = useState<"producto" | "servicio" | null>(null);
  const [editingVehiculo, setEditingVehiculo] = useState(false);

  const [tipoServicio, setTipoServicio] = useState<TipoServicio>("Mantenimiento");
  const [motivo, setMotivo] = useState("");
  const [km, setKm] = useState("");
  const [nivelCombustible, setNivelCombustible] = useState<NivelCombustible>("1/2");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [danos, setDanos] = useState<DanoVehiculo[]>([]);
  const [informeTecnico, setInformeTecnico] = useState("");
  const [notasInternas, setNotasInternas] = useState("");

  const [pagos, setPagos] = useState<Pago[]>([]);
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [montoPago, setMontoPago] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [bancoPago, setBancoPago] = useState("");
  const [referenciaPago, setReferenciaPago] = useState("");
  const [savingPago, setSavingPago] = useState(false);
  const [mostrarFormPago, setMostrarFormPago] = useState(false);
  const [itemDevolucion, setItemDevolucion] = useState<ItemOrden | null>(null);
  const [cantidadDevolucion, setCantidadDevolucion] = useState("1");
  const [motivoDevolucion, setMotivoDevolucion] = useState("");
  const [accionInventarioDevolucion, setAccionInventarioDevolucion] = useState<AccionInventarioDevolucion>("reingresar_stock");
  const [montoDevolucion, setMontoDevolucion] = useState("");
  const [metodoDevolucion, setMetodoDevolucion] = useState<MetodoDevolucion>("efectivo");
  const [notasDevolucion, setNotasDevolucion] = useState("");
  const [savingDevolucion, setSavingDevolucion] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const deletingOrdenRef = useRef(false);

  const subtotalItems = items.reduce((s, item) => s + item.cantidad * item.precioUnitario, 0);
  const ivaItems = items.reduce((s, item) => s + item.cantidad * item.precioUnitario * (item.impuestoAplicable / 100), 0);
  const totalBruto = subtotalItems + ivaItems;
  const itemsAgrupados = [
    { label: "Productos", items: items.filter((item) => item.tipo === "producto") },
    { label: "Servicios", items: items.filter((item) => item.tipo === "servicio") },
  ];
  const valorProductosDevueltos = devoluciones.reduce((s, devolucion) => s + devolucion.subtotalDevuelto, 0);
  const totalDevuelto = devoluciones.reduce((s, devolucion) => s + devolucion.montoDevuelto, 0);
  const totalNeto = Math.max(0, totalBruto - valorProductosDevueltos);
  const totalAbonado = pagos.reduce((s, p) => s + getPagoMontoBase(p), 0);
  const totalRecargos = pagos.reduce((s, p) => s + getPagoRecargo(p), 0);
  const totalCobrado = pagos.reduce((s, p) => s + p.monto, 0);
  const abonoBaseNeto = Math.max(0, totalAbonado - totalDevuelto);
  const cobradoNeto = Math.max(0, totalCobrado - totalDevuelto);
  const saldoPendiente = Math.max(0, totalNeto - abonoBaseNeto);
  const saldoAFavor = Math.max(0, abonoBaseNeto - totalNeto);
  const estadoPago =
    saldoPendiente <= 0.01 && totalNeto > 0
      ? "pagado"
      : abonoBaseNeto > 0
      ? "parcial"
      : "pendiente";
  const pagoPreview = calcularPagoConRecargo(Number(montoPago || 0), metodoPago);

  const load = useCallback(async () => {
    if (!ordenId) return;
    setLoading(true);
    const o = await getOrdenById(ordenId);
    if (!o) {
      if (!deletingOrdenRef.current) toast.error("Orden no encontrada");
      onClose();
      return;
    }

    const [cliente, vehiculo, pagosList, itemsList, devolucionesList] = await Promise.all([
      getClienteById(o.clienteId),
      getVehiculoById(o.vehiculoId),
      getPagos(ordenId),
      getItemsOrden(ordenId),
      getDevolucionesByOrden(ordenId),
    ]);

    setOrden({ ...o, cliente: cliente ?? undefined, vehiculo: vehiculo ?? undefined });
    setItems(itemsList);
    setPagos(pagosList);
    setDevoluciones(devolucionesList);
    setTipoServicio(o.tipoServicio);
    setMotivo(o.motivo ?? "");
    setKm(String(o.kilometrajeIngreso ?? ""));
    setNivelCombustible(o.nivelCombustible ?? "1/2");
    setChecklist(getMergedChecklist(o.checklistInventario));
    setDanos(o.inspeccionVisual?.danos ?? []);
    setInformeTecnico(o.informeTecnico ?? "");
    setNotasInternas(o.notasInternas ?? "");
    setLoading(false);
  }, [ordenId, onClose]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setMounted(true);
      void load();
    }, 0);
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = "auto";
    };
  }, [ordenId, load]);

  const cambiarEstado = async (estado: EstadoOrden) => {
    await updateEstadoOrden(ordenId, estado);
    setOrden((prev) => (prev ? { ...prev, estado } : prev));
    toast.success(`Estado: ${estado}`);
    onUpdate?.();
  };

  const guardarInforme = async () => {
    if (!motivo.trim()) {
      toast.error("Ingrese el motivo de la visita");
      return;
    }
    if (!km || isNaN(Number(km))) {
      toast.error("Ingrese un kilometraje valido");
      return;
    }

    setSavingInforme(true);
    try {
      const cambios: Partial<OrdenTrabajo> = {
        tipoServicio,
        motivo,
        kilometrajeIngreso: Number(km),
        nivelCombustible,
        checklistInventario: checklist,
        inspeccionVisual: { ...(orden?.inspeccionVisual ?? {}), danos },
        informeTecnico,
        notasInternas,
      };
      await updateOrden(ordenId, cambios);
      setOrden((prev) => (prev ? { ...prev, ...cambios } : prev));
      toast.success("Cambios guardados");
      onUpdate?.();
    } finally {
      setSavingInforme(false);
    }
  };

  const handleVehiculoSaved = async (vehiculo: Vehiculo) => {
    if (!vehiculo.id) return;

    await updateOrden(ordenId, {
      vehiculoId: vehiculo.id,
      clienteId: vehiculo.clienteId,
    });
    await load();
    onUpdate?.();
  };

  const convertirAOrden = async () => {
    setSavingInforme(true);
    try {
      await updateOrden(ordenId, { esCotizacion: false });
      setOrden((prev) => (prev ? { ...prev, esCotizacion: false } : prev));
      toast.success("Cotizacion convertida a Orden");
      onUpdate?.();
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
      setOrden((prev) => (prev ? { ...prev, fotoUrls } : prev));
      toast.success("Foto cargada");
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleAddItem = async (item: Omit<ItemOrden, "id" | "ordenId" | "subtotal">) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const subtotal = item.cantidad * item.precioUnitario * (1 + item.impuestoAplicable / 100);
    const itemOptimista: ItemOrden = {
      ...item,
      id: tempId,
      ordenId,
      subtotal,
    };

    setItems((prev) => [...prev, itemOptimista]);

    try {
      const realId = await addItemOrden(ordenId, { ...item, subtotal, ordenId });
      setItems((prev) =>
        prev.map((it) => (it.id === tempId ? { ...it, id: realId } : it))
      );
      toast.success("Item agregado");
      onUpdate?.();
    } catch (error) {
      console.error(error);
      setItems((prev) => prev.filter((it) => it.id !== tempId));
      toast.error(error instanceof Error && error.message === "STOCK_INSUFICIENTE"
        ? "Stock insuficiente para agregar el producto"
        : "Error al agregar item");
    }
  };

  const toggleIvaItem = async (item: ItemOrden) => {
    if (!item.id) return;
    const nuevoImpuesto = item.impuestoAplicable > 0 ? 0 : 15;
    const subtotal = item.cantidad * item.precioUnitario * (1 + nuevoImpuesto / 100);
    try {
      await updateItemOrden(ordenId, item.id, { impuestoAplicable: nuevoImpuesto, subtotal });
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, impuestoAplicable: nuevoImpuesto, subtotal } : i))
      );
      toast.success("IVA actualizado");
      onUpdate?.();
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar IVA");
    }
  };

  const actualizarCantidad = async (item: ItemOrden, delta: number) => {
    if (!item.id) return;
    const nuevaCantidad = Math.max(1, item.cantidad + delta);
    if (nuevaCantidad === item.cantidad) return;
    const subtotal = nuevaCantidad * item.precioUnitario * (1 + item.impuestoAplicable / 100);

    const previousItems = [...items];

    // Actualización optimista de la UI
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, cantidad: nuevaCantidad, subtotal } : i))
    );

    try {
      await updateItemOrden(ordenId, item.id, { cantidad: nuevaCantidad, subtotal });
      onUpdate?.();
    } catch (error) {
      console.error(error);
      // Revertir en caso de error
      setItems(previousItems);
      toast.error(error instanceof Error && error.message === "STOCK_INSUFICIENTE"
        ? "Stock insuficiente para aumentar la cantidad"
        : "Error al actualizar cantidad");
    }
  };

  const eliminarItem = async (itemId: string) => {
    if (itemId.startsWith("temp-")) return;

    const previousItems = [...items];

    // Actualización optimista de la UI
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    toast.success("Item eliminado");

    try {
      await deleteItemOrden(ordenId, itemId);
      onUpdate?.();
    } catch (error) {
      console.error(error);
      // Revertir en caso de error
      setItems(previousItems);
      toast.error("Error al eliminar item");
    }
  };

  const getCantidadDevuelta = (itemId?: string) => {
    if (!itemId) return 0;
    return devoluciones
      .filter((devolucion) => devolucion.itemOrdenId === itemId)
      .reduce((sum, devolucion) => sum + devolucion.cantidad, 0);
  };

  const abrirDevolucion = (item: ItemOrden) => {
    const disponible = Math.max(0, item.cantidad - getCantidadDevuelta(item.id));
    if (!item.id || !item.productoId || disponible <= 0) {
      toast.error("Este producto ya no tiene unidades disponibles para devolver");
      return;
    }
    setItemDevolucion(item);
    setCantidadDevolucion("1");
    setMotivoDevolucion("");
    setAccionInventarioDevolucion("reingresar_stock");
    setMontoDevolucion(calcularSubtotalDevolucion(item, 1).toFixed(2));
    setMetodoDevolucion("efectivo");
    setNotasDevolucion("");
  };

  const itemsDevolvibles = items.filter((item) => item.tipo === "producto" && item.productoId && item.id);

  const cerrarDevolucion = () => {
    if (savingDevolucion) return;
    setItemDevolucion(null);
  };

  const calcularSubtotalDevolucion = (item: ItemOrden, cantidad: number) =>
    Number((cantidad * item.precioUnitario * (1 + item.impuestoAplicable / 100)).toFixed(2));

  const registrarDevolucion = async () => {
    if (!itemDevolucion?.id) return;
    const cantidad = Math.floor(Number(cantidadDevolucion));
    const disponible = Math.max(0, itemDevolucion.cantidad - getCantidadDevuelta(itemDevolucion.id));
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      toast.error("Ingresa una cantidad valida");
      return;
    }
    if (cantidad > disponible) {
      toast.error(`Solo puedes devolver ${disponible} unidad(es)`);
      return;
    }
    if (!motivoDevolucion.trim()) {
      toast.error("Indica el motivo de la devolucion");
      return;
    }

    setSavingDevolucion(true);
    try {
      await createDevolucion({
        ordenId,
        itemOrdenId: itemDevolucion.id,
        cantidad,
        motivo: motivoDevolucion,
        accionInventario: accionInventarioDevolucion,
        montoDevuelto: Number(montoDevolucion || calcularSubtotalDevolucion(itemDevolucion, cantidad)),
        metodoDevolucion,
        clienteNombre: [orden?.cliente?.nombre, orden?.cliente?.apellido].filter(Boolean).join(" "),
        vehiculoPlaca: orden?.vehiculo?.placa,
        notas: notasDevolucion,
      });
      setDevoluciones(await getDevolucionesByOrden(ordenId));
      toast.success("Devolucion registrada");
      setItemDevolucion(null);
      onUpdate?.();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error && error.message === "DEVOLUCION_EXCEDE_CANTIDAD"
        ? "La cantidad supera lo vendido disponible"
        : "No se pudo registrar la devolucion");
    } finally {
      setSavingDevolucion(false);
    }
  };

  const registrarPago = async () => {
    if (!montoPago || isNaN(Number(montoPago)) || Number(montoPago) <= 0) {
      toast.error("Ingrese un monto valido");
      return;
    }
    if (Number(montoPago) > saldoPendiente + 0.01) {
      toast.error(`El monto no puede superar el saldo pendiente ($${saldoPendiente.toFixed(2)})`);
      return;
    }

    const pagoCalculado = calcularPagoConRecargo(Number(montoPago), metodoPago);
    setSavingPago(true);
    try {
      await createPago({
        ordenId,
        monto: pagoCalculado.montoCobrado,
        montoBase: pagoCalculado.montoBase,
        recargo: pagoCalculado.recargo,
        porcentajeRecargo: pagoCalculado.porcentajeRecargo,
        metodoPago,
        banco: metodoPago === "transferencia" ? bancoPago.trim() || undefined : undefined,
        referencia: referenciaPago,
      });
      toast.success("Pago registrado");
      setMontoPago("");
      setBancoPago("");
      setReferenciaPago("");
      setPagos(await getPagos(ordenId));
      setMostrarFormPago(false);
      onUpdate?.();
    } catch (e) {
      console.error(e);
      toast.error("Error al registrar pago");
    } finally {
      setSavingPago(false);
    }
  };

  const eliminarPago = async (pagoId: string) => {
    if (!confirm("Eliminar este pago?")) return;
    try {
      await deletePago(pagoId);
      toast.success("Pago eliminado");
      setPagos(await getPagos(ordenId));
      onUpdate?.();
    } catch (e) {
      console.error(e);
      toast.error("Error al eliminar pago");
    }
  };

  const eliminarOrdenHandler = async () => {
    if (!confirm("Eliminar esta orden de trabajo? Esta accion no se puede deshacer.")) return;
    deletingOrdenRef.current = true;
    setDeletingOrden(true);
    try {
      await deleteOrden(ordenId);
      toast.success("Orden eliminada");
      onUpdate?.();
      onClose();
    } catch (e) {
      deletingOrdenRef.current = false;
      console.error(e);
      toast.error("Error al eliminar la orden");
    } finally {
      setDeletingOrden(false);
    }
  };

  const enviarWhatsApp = () => {
    if (!orden?.cliente?.telefono) {
      toast.error("Cliente sin telefono registrado");
      return;
    }
    const tel = orden.cliente.telefono.replace(/\D/g, "");
    const numeroDocumento = getNumeroDocumento(orden);
    const msg = encodeURIComponent(
      `Hola ${orden.cliente.nombre}, le informamos que su vehiculo *${orden.vehiculo?.placa ?? ""}* ` +
        `(${orden.vehiculo?.marca} ${orden.vehiculo?.modelo}) se encuentra en estado: *${orden.estado}*.\n\n` +
        `Motivo: ${orden.motivo}\n` +
        `${orden.esCotizacion ? "Cotizacion" : "Orden"} #${String(numeroDocumento ?? 0).padStart(4, "0")}\n\n` +
        "Gracias por confiar en I.F. Soluciones Automotrices."
    );
    window.open(`https://wa.me/${tel}?text=${msg}`, "_blank");
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

      <div className="relative w-full bg-[var(--bg-primary)] h-full min-h-0 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-[var(--border)] flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center justify-between bg-[var(--bg-card)] sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="btn-ghost btn-icon -ml-2">
              <X size={20} />
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {orden?.esCotizacion ? "Cotizacion" : "Orden"} #{orden ? String(getNumeroDocumento(orden) ?? 0).padStart(4, "0") : "..."}
              </h2>
              {orden && (
                <p className="text-[10px] sm:text-xs" style={{ color: "var(--text-muted)" }}>
                  {orden.createdAt ? format(orden.createdAt.toDate(), "d 'de' MMMM, yyyy", { locale: es }) : "Detalle de orden"}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto justify-end">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(ordenId)}
                disabled={loading}
                className="btn-secondary btn-sm text-[10px] sm:text-xs px-2 py-1.5 sm:px-3 sm:py-2"
              >
                <Edit2 size={12} className="sm:mr-1" /> Editar
              </button>
            )}
            {orden?.esCotizacion && (
              <button type="button" onClick={convertirAOrden} disabled={savingInforme} className="btn-success btn-sm text-[10px] sm:text-xs px-2 py-1.5 sm:px-3 sm:py-2">
                <Check size={12} className="sm:mr-1" /> Confirmar
              </button>
            )}
            <button type="button" onClick={enviarWhatsApp} disabled={!orden} className="btn-success btn-sm text-[10px] sm:text-xs px-2 py-1.5 sm:px-3 sm:py-2">
              <MessageCircle size={13} className="sm:mr-1" /> WhatsApp
            </button>
            <button type="button" onClick={guardarInforme} disabled={savingInforme || loading} className="btn-primary btn-sm text-[10px] sm:text-xs px-2 py-1.5 sm:px-3 sm:py-2">
              {savingInforme ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} className="sm:mr-1" />}
              Guardar
            </button>
            <button type="button" onClick={eliminarOrdenHandler} disabled={loading || deletingOrden} className="btn-danger btn-sm text-[10px] sm:text-xs px-2 py-1.5 sm:px-3 sm:py-2">
              {deletingOrden ? <Loader2 size={12} className="animate-spin sm:mr-1" /> : <Trash2 size={12} className="sm:mr-1" />}
              Eliminar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="spinner" />
          </div>
        ) : !orden ? null : (
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start min-h-0">
              <div className="lg:col-span-4 space-y-6">
                <div className="card bg-[var(--bg-card)]">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <FileText size={18} className="text-[#8b5cf6]" />
                      <h3 className="font-semibold text-sm">Estado de la orden</h3>
                    </div>
                    <span className={`badge ${orden.esCotizacion ? "badge-gray" : ESTADO_BADGES[orden.estado]}`}>
                      {orden.esCotizacion ? "Cotizacion" : orden.estado}
                    </span>
                  </div>

                  {!orden.esCotizacion ? (
                    <div className="flex gap-2 flex-wrap">
                      {ESTADOS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => cambiarEstado(e)}
                          className={`badge cursor-pointer transition-all ${orden.estado === e ? ESTADO_BADGES[e] + " glow-ring" : "badge-gray"}`}
                          style={{ padding: "6px 12px", fontSize: "12px" }}
                        >
                          {orden.estado === e && <Check size={12} />}
                          {e}
                        </button>
                      ))}
                    </div>
                  ) : activeTab === "devoluciones" ? (
                    <div className="space-y-8">
                      <div className="card bg-[var(--bg-card)] space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <RotateCcw size={18} className="text-[var(--accent)]" />
                            <h3 className="font-semibold text-sm">Registrar devolución</h3>
                          </div>
                          {devoluciones.length > 0 && (
                            <span className="badge badge-gray">{devoluciones.length} registrada{devoluciones.length !== 1 ? "s" : ""}</span>
                          )}
                        </div>

                        {orden.esCotizacion ? (
                          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                            <p className="text-sm font-medium text-[var(--text-primary)]">Las cotizaciones no admiten devoluciones.</p>
                            <p className="text-xs mt-1 text-[var(--text-muted)]">Confirma la cotización como orden antes de registrar productos devueltos.</p>
                          </div>
                        ) : itemsDevolvibles.length === 0 ? (
                          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                            <p className="text-sm font-medium text-[var(--text-primary)]">No hay productos devolvibles.</p>
                            <p className="text-xs mt-1 text-[var(--text-muted)]">Solo los productos agregados desde inventario pueden registrarse como devolución.</p>
                          </div>
                        ) : (
                          <>
                            <div className="form-group">
                              <label className="label">Producto devuelto</label>
                              <select
                                className="input"
                                value={itemDevolucion?.id ?? ""}
                                onChange={(e) => {
                                  const item = itemsDevolvibles.find((current) => current.id === e.target.value);
                                  if (item) abrirDevolucion(item);
                                  else setItemDevolucion(null);
                                }}
                              >
                                <option value="">Selecciona un producto</option>
                                {itemsDevolvibles.map((item) => {
                                  const devuelto = getCantidadDevuelta(item.id);
                                  const disponible = Math.max(0, item.cantidad - devuelto);
                                  return (
                                    <option key={item.id} value={item.id} disabled={disponible <= 0}>
                                      {item.descripcion} ({devuelto}/{item.cantidad} devuelto)
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            {itemDevolucion && (
                              <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                                  <div>
                                    <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Vendido</p>
                                    <p className="font-bold">{itemDevolucion.cantidad}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Devuelto</p>
                                    <p className="font-bold">{getCantidadDevuelta(itemDevolucion.id)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Disponible</p>
                                    <p className="font-bold text-[var(--accent)]">{Math.max(0, itemDevolucion.cantidad - getCantidadDevuelta(itemDevolucion.id))}</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="form-group">
                                    <label className="label">Cantidad *</label>
                                    <input
                                      type="number"
                                      min="1"
                                      max={Math.max(1, itemDevolucion.cantidad - getCantidadDevuelta(itemDevolucion.id))}
                                      step="1"
                                      className="input"
                                      value={cantidadDevolucion}
                                      onChange={(e) => {
                                        setCantidadDevolucion(e.target.value);
                                        const cantidad = Math.max(1, Math.floor(Number(e.target.value || 1)));
                                        setMontoDevolucion(calcularSubtotalDevolucion(itemDevolucion, cantidad).toFixed(2));
                                      }}
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label className="label">Monto devuelto</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="input"
                                      value={montoDevolucion}
                                      onChange={(e) => setMontoDevolucion(e.target.value)}
                                    />
                                  </div>
                                </div>

                                <div className="form-group">
                                  <label className="label">Motivo *</label>
                                  <input
                                    className="input"
                                    placeholder="Ej: producto defectuoso, error de compra..."
                                    value={motivoDevolucion}
                                    onChange={(e) => setMotivoDevolucion(e.target.value)}
                                  />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="form-group">
                                    <label className="label">Inventario</label>
                                    <select
                                      className="input"
                                      value={accionInventarioDevolucion}
                                      onChange={(e) => setAccionInventarioDevolucion(e.target.value as AccionInventarioDevolucion)}
                                    >
                                      <option value="reingresar_stock">Reingresar a stock</option>
                                      <option value="merma">Merma / dañado</option>
                                      <option value="garantia_proveedor">Garantía con proveedor</option>
                                      <option value="sin_reingreso">Sin reingreso</option>
                                    </select>
                                  </div>
                                  <div className="form-group">
                                    <label className="label">Método</label>
                                    <select
                                      className="input"
                                      value={metodoDevolucion}
                                      onChange={(e) => setMetodoDevolucion(e.target.value as MetodoDevolucion)}
                                    >
                                      <option value="efectivo">Efectivo</option>
                                      <option value="transferencia">Transferencia</option>
                                      <option value="credito_cliente">Crédito cliente</option>
                                      <option value="nota_credito">Nota de crédito</option>
                                      <option value="otro">Otro</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="form-group">
                                  <label className="label">Notas</label>
                                  <textarea
                                    className="input resize-none"
                                    rows={2}
                                    value={notasDevolucion}
                                    onChange={(e) => setNotasDevolucion(e.target.value)}
                                  />
                                </div>

                                <button type="button" onClick={registrarDevolucion} disabled={savingDevolucion} className="btn-primary w-full justify-center">
                                  {savingDevolucion ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                                  Registrar devolución
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="card bg-[var(--bg-card)] space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-semibold text-sm">Historial de devoluciones</h3>
                          <span className="text-sm font-bold text-red-500">-${valorProductosDevueltos.toFixed(2)}</span>
                        </div>
                        {devoluciones.length === 0 ? (
                          <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
                            No hay devoluciones registradas para esta orden.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {devoluciones.map((devolucion) => (
                              <div key={devolucion.id} className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-secondary)] p-3 text-xs">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-[var(--text-primary)] truncate">{devolucion.productoNombre}</p>
                                    <p className="text-[10px] text-[var(--text-muted)]">
                                      {devolucion.cantidad} unidad(es) - {devolucion.motivo}
                                    </p>
                                  </div>
                                  <span className="font-bold text-red-500">-${devolucion.montoDevuelto.toFixed(2)}</span>
                                </div>
                                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                                  {devolucion.accionInventario === "reingresar_stock"
                                    ? "Reingresado a stock"
                                    : devolucion.accionInventario === "merma"
                                    ? "Merma / dañado"
                                    : devolucion.accionInventario === "garantia_proveedor"
                                    ? "Garantía con proveedor"
                                    : "Sin reingreso a stock"}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Esta cotizacion aun no ha sido confirmada como orden de trabajo.
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[var(--border)] text-xs">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Fecha</p>
                      <p>{orden.createdAt ? format(orden.createdAt.toDate(), "dd/MM/yyyy", { locale: es }) : "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Venta neta</p>
                      <p className="font-semibold text-[var(--success)]">${totalNeto.toFixed(2)}</p>
                    </div>
                    {!orden.esCotizacion && (
                      <>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Cobrado</p>
                          <p>${cobradoNeto.toFixed(2)}</p>
                          {totalRecargos > 0 && (
                            <p className="text-[10px] text-[var(--text-muted)]">Incluye recargos: ${totalRecargos.toFixed(2)}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                            {saldoAFavor > 0.01 ? "A favor" : "Saldo"}
                          </p>
                          <p className="font-semibold" style={{ color: saldoPendiente > 0.01 ? "var(--warning)" : saldoAFavor > 0.01 ? "var(--success)" : "var(--text-muted)" }}>
                            ${(saldoAFavor > 0.01 ? saldoAFavor : saldoPendiente).toFixed(2)}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="card bg-[var(--bg-card)]">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Car size={18} className="text-[var(--warning)]" />
                      <h3 className="font-semibold text-sm">Datos del Vehiculo</h3>
                    </div>
                    {orden.vehiculo && (
                      <button
                        type="button"
                        onClick={() => setEditingVehiculo(true)}
                        className="btn-ghost btn-sm text-xs"
                      >
                        <Edit2 size={13} /> Editar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border)] text-xs">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Placa</p>
                      <p className="font-mono font-bold text-sm">{orden.vehiculo?.placa ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Tipo</p>
                      <p className="capitalize">{orden.vehiculo?.tipoVehiculo ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Marca</p>
                      <p>{orden.vehiculo?.marca ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Modelo</p>
                      <p>{orden.vehiculo?.modelo ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Anio</p>
                      <p>{orden.vehiculo?.anio ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Color</p>
                      <p>{orden.vehiculo?.color ?? "-"}</p>
                    </div>
                  </div>
                </div>

                <div className="card bg-[var(--bg-card)]">
                  <div className="flex items-center gap-2 mb-4">
                    <User size={18} className="text-[var(--success)]" />
                    <h3 className="font-semibold text-sm">Datos del Cliente</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border)] text-xs">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Nombre</p>
                      <p>{orden.cliente?.nombre} {orden.cliente?.apellido}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Identificacion</p>
                      <p>{orden.cliente?.identificacion ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Telefono</p>
                      <p>{orden.cliente?.telefono ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Email</p>
                      <p className="truncate">{orden.cliente?.email || "-"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8 flex flex-col min-h-0">
                <div className="flex gap-4 border-b border-[var(--border)] mb-6 bg-[var(--bg-primary)] z-10 py-2 overflow-x-auto">
                  {[
                    { id: "orden", label: "Detalles y Items" },
                    { id: "inspeccion", label: "Inspeccion de ingreso" },
                    { id: "personal", label: "Personal asignado" },
                    { id: "devoluciones", label: "Devoluciones" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`pb-2 px-1 text-sm font-semibold whitespace-nowrap transition-all border-b-2 ${
                        activeTab === tab.id
                          ? "border-[var(--accent)] text-[var(--accent)]"
                          : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-8 min-h-0">
                  {activeTab === "orden" ? (
                    <>
                      <div className="card bg-[var(--bg-card)]">
                        <div className="flex items-center gap-2 mb-4">
                          <FileText size={18} className="text-[#8b5cf6]" />
                          <h3 className="font-semibold text-sm">Detalles de la Orden</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          <div className="form-group">
                            <label className="label">Tipo de Servicio</label>
                            <select className="input text-sm" value={tipoServicio} onChange={(e) => setTipoServicio(e.target.value as TipoServicio)}>
                              <option>Mantenimiento</option>
                              <option>ReparaciÃ³n</option>
                              <option>GarantÃ­a</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="label">Motivo de la visita *</label>
                            <input className="input text-sm" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="label">Informe Tecnico</label>
                            <textarea className="input text-sm resize-none" rows={4} placeholder="Diagnostico y trabajos realizados..." value={informeTecnico} onChange={(e) => setInformeTecnico(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="label">Notas Internas</label>
                            <textarea className="input text-sm resize-none" rows={2} placeholder="Notas privadas para el equipo..." value={notasInternas} onChange={(e) => setNotasInternas(e.target.value)} />
                          </div>
                        </div>
                      </div>

                      <div className="card bg-[var(--bg-card)] space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-semibold text-sm">Productos y Servicios</h3>
                          <button type="button" onClick={() => setActiveModal("producto")} className="btn-secondary btn-sm">
                            <Plus size={14} /> Agregar
                          </button>
                        </div>

                        {items.length > 0 ? (
                          <div className="table-container border border-[var(--border)] rounded-lg">
                            <table className="table">
                              <thead className="bg-[var(--bg-secondary)]">
                                <tr>
                                  <th className="text-[10px]">Desc.</th>
                                  <th className="text-[10px] text-center">Cant.</th>
                                  <th className="text-[10px] text-center">P. Unit.</th>
                                  <th className="text-[10px] text-center">IVA</th>
                                  <th className="text-[10px]">Total</th>
                                  <th></th>
                                </tr>
                              </thead>
                              <tbody>
                                {itemsAgrupados.map((grupo) =>
                                  grupo.items.length > 0 ? (
                                    <Fragment key={grupo.label}>
                                      <tr className="bg-[var(--bg-secondary)]">
                                        <td colSpan={6} className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                                          {grupo.label}
                                        </td>
                                      </tr>
                                      {grupo.items.map((item) => (
                                        <tr key={item.id ?? item.descripcion} className="text-xs">
                                          <td>
                                            <p>{item.descripcion}</p>
                                            {item.productoSku && (
                                              <p className="text-[10px] text-[var(--text-muted)] font-mono">{item.productoSku}</p>
                                            )}
                                          </td>
                                          <td className="text-center">
                                            <div className="flex items-center justify-center gap-1">
                                              <button
                                                type="button"
                                                onClick={() => actualizarCantidad(item, -1)}
                                                className="w-6 h-6 flex items-center justify-center text-xs font-bold rounded hover:bg-[var(--bg-secondary)] transition-colors"
                                                style={{ color: "var(--text-muted)" }}
                                              >
                                                -
                                              </button>
                                              <span className="text-xs font-semibold min-w-[20px] text-center">{item.cantidad}</span>
                                              <button
                                                type="button"
                                                onClick={() => actualizarCantidad(item, 1)}
                                                className="w-6 h-6 flex items-center justify-center text-xs font-bold rounded hover:bg-[var(--bg-secondary)] transition-colors"
                                                style={{ color: "var(--text-muted)" }}
                                              >
                                                +
                                              </button>
                                            </div>
                                          </td>
                                          <td className="text-center">${item.precioUnitario.toFixed(2)}</td>
                                          <td className="text-center">
                                            <button type="button" onClick={() => toggleIvaItem(item)} className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${item.impuestoAplicable > 0 ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20" : "bg-gray-500/10 text-gray-400 border border-gray-500/20 hover:bg-gray-500/20"}`}>
                                              {item.impuestoAplicable > 0 ? "15%" : "0%"}
                                            </button>
                                          </td>
                                          <td className="font-semibold">${item.subtotal.toFixed(2)}</td>
                                          <td className="text-right">
                                            <button type="button" onClick={() => item.id && eliminarItem(item.id)} className="text-red-500 hover:bg-red-500/10 p-1 rounded transition-colors">
                                              <Trash2 size={14} />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </Fragment>
                                  ) : null
                                )}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
                            No hay productos o servicios agregados.
                          </p>
                        )}

                        <div className="ml-auto w-full max-w-xs space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span style={{ color: "var(--text-secondary)" }}>Subtotal</span>
                            <span className="font-semibold">${subtotalItems.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span style={{ color: "var(--text-secondary)" }}>IVA</span>
                            <span className="font-semibold">${ivaItems.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-2">
                            <span className="font-bold">Total</span>
                            <span className="font-bold text-base text-[var(--success)]">${totalBruto.toFixed(2)}</span>
                          </div>
                        </div>

                        {false && devoluciones.length > 0 && (
                          <div className="pt-3 border-t border-[var(--border)] space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <h4 className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                                Devoluciones registradas
                              </h4>
                              <span className="text-xs font-bold text-red-500">-${valorProductosDevueltos.toFixed(2)}</span>
                            </div>
                            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                              {devoluciones.map((devolucion) => (
                                <div key={devolucion.id} className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-secondary)] p-2 text-xs">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="font-semibold text-[var(--text-primary)] truncate">{devolucion.productoNombre}</p>
                                      <p className="text-[10px] text-[var(--text-muted)]">
                                        {devolucion.cantidad} unidad(es) - {devolucion.motivo}
                                      </p>
                                    </div>
                                    <span className="font-bold text-red-500">-${devolucion.montoDevuelto.toFixed(2)}</span>
                                  </div>
                                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                                    {devolucion.accionInventario === "reingresar_stock"
                                      ? "Reingresado a stock"
                                      : devolucion.accionInventario === "merma"
                                      ? "Merma / dañado"
                                      : devolucion.accionInventario === "garantia_proveedor"
                                      ? "Garantía con proveedor"
                                      : "Sin reingreso a stock"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {!orden.esCotizacion && (
                        <div className="card bg-[var(--bg-card)] space-y-4">
                          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                            <div className="flex items-center gap-2">
                              <DollarSign size={18} className="text-[var(--success)]" />
                              <h3 className="font-semibold text-sm">Gestion de Pagos</h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`badge ${estadoPago === "pagado" ? "badge-green" : estadoPago === "parcial" ? "badge-yellow" : "badge-gray"}`}>
                                {estadoPago === "pagado" ? "Pagado" : estadoPago === "parcial" ? "Pago Parcial" : "Pendiente"}
                              </span>
                              {saldoPendiente > 0.01 && (
                                <button type="button" onClick={() => setMostrarFormPago(!mostrarFormPago)} className="btn btn-secondary btn-sm py-1 px-2 text-xs font-semibold flex items-center gap-1 cursor-pointer">
                                  {mostrarFormPago ? "Cerrar" : <><Plus size={12} /> Registrar Pago</>}
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                            <div className="bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border-light)]">
                              <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">Venta bruta</p>
                              <p className="font-bold text-sm">${totalBruto.toFixed(2)}</p>
                            </div>
                            <div className="bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border-light)]">
                              <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">Devuelto</p>
                              <p className="font-bold text-sm text-red-500">-${valorProductosDevueltos.toFixed(2)}</p>
                            </div>
                            <div className="bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border-light)]">
                              <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">Venta neta</p>
                              <p className="font-bold text-sm">${totalNeto.toFixed(2)}</p>
                            </div>
                            <div className="bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border-light)]">
                              <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">Abonado</p>
                              <p className="font-bold text-sm text-[var(--success)]">${totalAbonado.toFixed(2)}</p>
                              {totalRecargos > 0 && (
                                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Recargos: ${totalRecargos.toFixed(2)}</p>
                              )}
                            </div>
                            <div className="bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border-light)]">
                              <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">
                                {saldoAFavor > 0.01 ? "A favor" : "Saldo"}
                              </p>
                              <p className="font-bold text-sm" style={{ color: saldoPendiente > 0.01 ? "var(--warning)" : saldoAFavor > 0.01 ? "var(--success)" : "var(--text-muted)" }}>
                                ${(saldoAFavor > 0.01 ? saldoAFavor : saldoPendiente).toFixed(2)}
                              </p>
                            </div>
                          </div>

                          <div className={`grid grid-cols-1 ${mostrarFormPago ? "md:grid-cols-2" : ""} gap-4 pt-2`}>
                            <div className={`space-y-2 ${mostrarFormPago ? "border-r border-[var(--border-light)] pr-0 md:pr-4" : ""}`}>
                              <h4 className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Historial de abonos</h4>
                              {pagos.length === 0 ? (
                                <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
                                  No hay abonos registrados para esta orden.
                                </p>
                              ) : (
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                  {pagos.map((p) => (
                                    <div key={p.id} className="flex items-center justify-between p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-light)] text-xs">
                                      <div>
                                        <p className="font-semibold text-[var(--success)]">${getPagoMontoBase(p).toFixed(2)}</p>
                                        <p className="text-[10px] text-[var(--text-muted)] capitalize">
                                          {getPagoMetodoLabel(p.metodoPago)} {p.banco ? `- ${p.banco}` : ""} {p.referencia ? `- ${p.referencia}` : ""}
                                        </p>
                                        {getPagoRecargo(p) > 0 && (
                                          <p className="text-[10px] text-[var(--text-muted)]">
                                            Recargo: ${getPagoRecargo(p).toFixed(2)} - Cobrado: ${p.monto.toFixed(2)}
                                          </p>
                                        )}
                                      </div>
                                      <button type="button" onClick={() => p.id && eliminarPago(p.id)} className="text-red-500 hover:bg-red-500/10 p-1 rounded transition-colors">
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {mostrarFormPago && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Registrar nuevo abono</h4>
                                  <button type="button" onClick={() => setMostrarFormPago(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-medium">
                                    Cancelar
                                  </button>
                                </div>
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="form-group">
                                      <label className="label">Monto ($)</label>
                                      <input type="number" className="input text-xs" placeholder="0.00" value={montoPago} onChange={(e) => setMontoPago(e.target.value)} step="0.01" />
                                    </div>
                                    <div className="form-group">
                                      <label className="label">Metodo</label>
                                      <select className="input text-xs" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}>
                                        {METODOS_PAGO_ORDEN.map((metodo) => (
                                          <option key={metodo} value={metodo}>{getPagoMetodoLabel(metodo)}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                  {pagoPreview.recargo > 0 && (
                                    <div className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-secondary)] p-2 text-[10px]">
                                      <div className="flex items-center justify-between">
                                        <span>Recargo tarjeta ({pagoPreview.porcentajeRecargo}%)</span>
                                        <strong>${pagoPreview.recargo.toFixed(2)}</strong>
                                      </div>
                                      <div className="flex items-center justify-between mt-1">
                                        <span>Total a cobrar</span>
                                        <strong className="text-[var(--success)]">${pagoPreview.montoCobrado.toFixed(2)}</strong>
                                      </div>
                                    </div>
                                  )}
                                  {metodoPago === "transferencia" && (
                                    <div className="form-group">
                                      <label className="label">Banco</label>
                                      <input type="text" className="input text-xs" list={`${BANCO_TRANSFERENCIA_LIST_ID}-detalle`} placeholder="Selecciona o escribe el banco" value={bancoPago} onChange={(e) => setBancoPago(e.target.value)} />
                                      <datalist id={`${BANCO_TRANSFERENCIA_LIST_ID}-detalle`}>
                                        {BANCOS_TRANSFERENCIA.map((b) => (
                                          <option key={b} value={b} />
                                        ))}
                                      </datalist>
                                    </div>
                                  )}
                                  <div className="form-group">
                                    <label className="label">Referencia / Comprobante</label>
                                    <input type="text" className="input text-xs" placeholder="Ej: #12345" value={referenciaPago} onChange={(e) => setReferenciaPago(e.target.value)} />
                                  </div>
                                  <button type="button" onClick={registrarPago} disabled={savingPago} className="btn-primary btn-sm w-full justify-center">
                                    {savingPago ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                                    Registrar Abono
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : activeTab === "inspeccion" ? (
                    <div className="space-y-8">
                      <div className="card bg-[var(--bg-card)]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                          <div className="form-group">
                            <label className="label">Kilometraje de Ingreso *</label>
                            <input type="number" className="input text-sm" value={km} onChange={(e) => setKm(e.target.value)} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm mb-4">Nivel de Combustible</h3>
                            <FuelSelector value={nivelCombustible} onChange={setNivelCombustible} />
                          </div>
                        </div>
                      </div>
                      <div className="card bg-[var(--bg-card)]">
                        <h3 className="font-semibold text-sm mb-3">Checklist de Inventario</h3>
                        <ChecklistInventario items={checklist} onChange={setChecklist} />
                      </div>
                      <div className="card bg-[var(--bg-card)]">
                        <h3 className="font-semibold text-sm mb-3">Inspeccion Visual</h3>
                        <DamageSelector danos={danos} onChange={setDanos} />
                      </div>
                      <div className="card bg-[var(--bg-card)]">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-sm">Fotos</h3>
                          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingFoto} className="btn-ghost btn-sm text-[var(--accent)]">
                            <Camera size={14} className="mr-1" /> Subir
                          </button>
                          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFotoUpload} />
                        </div>
                        {orden.fotoUrls?.length ? (
                          <div className="grid grid-cols-3 gap-2">
                            {orden.fotoUrls.map((url, i) => (
                              <a href={url} target="_blank" key={url} className="relative rounded-lg overflow-hidden aspect-square border border-[var(--border)]">
                                <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
                            No hay fotos registradas para esta orden.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : activeTab === "devoluciones" ? (
                    <div className="space-y-8">
                      <div className="card bg-[var(--bg-card)] space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <RotateCcw size={18} className="text-[var(--accent)]" />
                            <h3 className="font-semibold text-sm">Registrar devolucion</h3>
                          </div>
                          {devoluciones.length > 0 && (
                            <span className="badge badge-gray">
                              {devoluciones.length} registrada{devoluciones.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        {orden.esCotizacion ? (
                          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                            <p className="text-sm font-medium text-[var(--text-primary)]">Las cotizaciones no admiten devoluciones.</p>
                            <p className="text-xs mt-1 text-[var(--text-muted)]">Confirma la cotizacion como orden antes de registrar productos devueltos.</p>
                          </div>
                        ) : itemsDevolvibles.length === 0 ? (
                          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                            <p className="text-sm font-medium text-[var(--text-primary)]">No hay productos devolvibles.</p>
                            <p className="text-xs mt-1 text-[var(--text-muted)]">Solo los productos agregados desde inventario pueden registrarse como devolucion.</p>
                          </div>
                        ) : (
                          <>
                            <div className="form-group">
                              <label className="label">Producto devuelto</label>
                              <select
                                className="input"
                                value={itemDevolucion?.id ?? ""}
                                onChange={(e) => {
                                  const item = itemsDevolvibles.find((current) => current.id === e.target.value);
                                  if (item) abrirDevolucion(item);
                                  else setItemDevolucion(null);
                                }}
                              >
                                <option value="">Selecciona un producto</option>
                                {itemsDevolvibles.map((item) => {
                                  const devuelto = getCantidadDevuelta(item.id);
                                  const disponible = Math.max(0, item.cantidad - devuelto);
                                  return (
                                    <option key={item.id} value={item.id} disabled={disponible <= 0}>
                                      {item.descripcion} ({devuelto}/{item.cantidad} devuelto)
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            {itemDevolucion && (
                              <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                                  <div>
                                    <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Vendido</p>
                                    <p className="font-bold">{itemDevolucion.cantidad}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Devuelto</p>
                                    <p className="font-bold">{getCantidadDevuelta(itemDevolucion.id)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Disponible</p>
                                    <p className="font-bold text-[var(--accent)]">{Math.max(0, itemDevolucion.cantidad - getCantidadDevuelta(itemDevolucion.id))}</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="form-group">
                                    <label className="label">Cantidad *</label>
                                    <input
                                      type="number"
                                      min="1"
                                      max={Math.max(1, itemDevolucion.cantidad - getCantidadDevuelta(itemDevolucion.id))}
                                      step="1"
                                      className="input"
                                      value={cantidadDevolucion}
                                      onChange={(e) => {
                                        setCantidadDevolucion(e.target.value);
                                        const cantidad = Math.max(1, Math.floor(Number(e.target.value || 1)));
                                        setMontoDevolucion(calcularSubtotalDevolucion(itemDevolucion, cantidad).toFixed(2));
                                      }}
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label className="label">Monto devuelto</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="input"
                                      value={montoDevolucion}
                                      onChange={(e) => setMontoDevolucion(e.target.value)}
                                    />
                                  </div>
                                </div>

                                <div className="form-group">
                                  <label className="label">Motivo *</label>
                                  <input
                                    className="input"
                                    placeholder="Ej: producto defectuoso, error de compra..."
                                    value={motivoDevolucion}
                                    onChange={(e) => setMotivoDevolucion(e.target.value)}
                                  />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="form-group">
                                    <label className="label">Inventario</label>
                                    <select
                                      className="input"
                                      value={accionInventarioDevolucion}
                                      onChange={(e) => setAccionInventarioDevolucion(e.target.value as AccionInventarioDevolucion)}
                                    >
                                      <option value="reingresar_stock">Reingresar a stock</option>
                                      <option value="merma">Merma / dañado</option>
                                      <option value="garantia_proveedor">Garantia con proveedor</option>
                                      <option value="sin_reingreso">Sin reingreso</option>
                                    </select>
                                  </div>
                                  <div className="form-group">
                                    <label className="label">Metodo</label>
                                    <select
                                      className="input"
                                      value={metodoDevolucion}
                                      onChange={(e) => setMetodoDevolucion(e.target.value as MetodoDevolucion)}
                                    >
                                      <option value="efectivo">Efectivo</option>
                                      <option value="transferencia">Transferencia</option>
                                      <option value="credito_cliente">Credito cliente</option>
                                      <option value="nota_credito">Nota de credito</option>
                                      <option value="otro">Otro</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="form-group">
                                  <label className="label">Notas</label>
                                  <textarea
                                    className="input resize-none"
                                    rows={2}
                                    value={notasDevolucion}
                                    onChange={(e) => setNotasDevolucion(e.target.value)}
                                  />
                                </div>

                                <button type="button" onClick={registrarDevolucion} disabled={savingDevolucion} className="btn-primary w-full justify-center">
                                  {savingDevolucion ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                                  Registrar devolucion
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="card bg-[var(--bg-card)] space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-semibold text-sm">Historial de devoluciones</h3>
                          <span className="text-sm font-bold text-red-500">-${valorProductosDevueltos.toFixed(2)}</span>
                        </div>
                        {devoluciones.length === 0 ? (
                          <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
                            No hay devoluciones registradas para esta orden.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {devoluciones.map((devolucion) => (
                              <div key={devolucion.id} className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-secondary)] p-3 text-xs">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-[var(--text-primary)] truncate">{devolucion.productoNombre}</p>
                                    <p className="text-[10px] text-[var(--text-muted)]">
                                      {devolucion.cantidad} unidad(es) - {devolucion.motivo}
                                    </p>
                                  </div>
                                  <span className="font-bold text-red-500">-${devolucion.montoDevuelto.toFixed(2)}</span>
                                </div>
                                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                                  {devolucion.accionInventario === "reingresar_stock"
                                    ? "Reingresado a stock"
                                    : devolucion.accionInventario === "merma"
                                    ? "Merma / dañado"
                                    : devolucion.accionInventario === "garantia_proveedor"
                                    ? "Garantia con proveedor"
                                    : "Sin reingreso a stock"}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="card bg-[var(--bg-card)]">
                      <div className="flex items-center gap-2 mb-4">
                        <User size={18} className="text-[var(--accent)]" />
                        <h3 className="font-semibold text-sm">Personal asignado</h3>
                      </div>
                      {orden.personalAsignado?.length ? (
                        <div className="space-y-2">
                          {orden.personalAsignado.map((usuario) => (
                            <div key={usuario.uid} className="flex items-center gap-3 p-3 rounded-lg border bg-[var(--bg-secondary)] border-[var(--border)]">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--accent)", color: "#fff" }}>
                                {(usuario.displayName || usuario.email || "U").charAt(0).toUpperCase()}
                              </div>
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm font-medium truncate">{usuario.displayName || usuario.email}</span>
                                <span className="block text-xs truncate capitalize" style={{ color: "var(--text-muted)" }}>
                                  {usuario.role} - {usuario.email}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            No hay personal asignado.
                          </p>
                          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                            Esta orden fue creada sin tecnicos asignados.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {activeModal && (
        <AgregarItemModal
          tipoInicial={activeModal}
          onClose={() => setActiveModal(null)}
          onAdd={handleAddItem}
        />
      )}

      {orden && (
        <VehiculoModal
          isOpen={editingVehiculo}
          onClose={() => setEditingVehiculo(false)}
          editingVehiculo={orden.vehiculo ?? null}
          onSuccess={handleVehiculoSaved}
        />
      )}

      {itemDevolucion && false && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--bg-card)] w-full max-w-lg rounded-xl shadow-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Registrar devolución</h3>
                <p className="text-xs text-[var(--text-muted)]">{itemDevolucion!.descripcion}</p>
              </div>
              <button type="button" onClick={cerrarDevolucion} className="btn-ghost btn-icon">
                <X size={18} />
              </button>
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-3 text-xs">
              <div className="flex items-center justify-between">
                <span>Vendido</span>
                <span className="font-bold">{itemDevolucion!.cantidad}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span>Ya devuelto</span>
                <span className="font-bold">{getCantidadDevuelta(itemDevolucion!.id)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span>Disponible</span>
                <span className="font-bold text-[var(--accent)]">
                  {Math.max(0, itemDevolucion!.cantidad - getCantidadDevuelta(itemDevolucion!.id))}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Cantidad *</label>
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, itemDevolucion!.cantidad - getCantidadDevuelta(itemDevolucion!.id))}
                  step="1"
                  className="input"
                  value={cantidadDevolucion}
                  onChange={(e) => {
                    setCantidadDevolucion(e.target.value);
                    const cantidad = Math.max(1, Math.floor(Number(e.target.value || 1)));
                    setMontoDevolucion(calcularSubtotalDevolucion(itemDevolucion!, cantidad).toFixed(2));
                  }}
                />
              </div>
              <div className="form-group">
                <label className="label">Monto devuelto</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  value={montoDevolucion}
                  onChange={(e) => setMontoDevolucion(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Motivo *</label>
              <input
                className="input"
                placeholder="Ej: producto defectuoso, error de compra..."
                value={motivoDevolucion}
                onChange={(e) => setMotivoDevolucion(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Inventario</label>
                <select
                  className="input"
                  value={accionInventarioDevolucion}
                  onChange={(e) => setAccionInventarioDevolucion(e.target.value as AccionInventarioDevolucion)}
                >
                  <option value="reingresar_stock">Reingresar a stock</option>
                  <option value="merma">Merma / dañado</option>
                  <option value="garantia_proveedor">Garantía con proveedor</option>
                  <option value="sin_reingreso">Sin reingreso</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label">Método</label>
                <select
                  className="input"
                  value={metodoDevolucion}
                  onChange={(e) => setMetodoDevolucion(e.target.value as MetodoDevolucion)}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="credito_cliente">Crédito cliente</option>
                  <option value="nota_credito">Nota de crédito</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="label">Notas</label>
              <textarea
                className="input resize-none"
                rows={2}
                value={notasDevolucion}
                onChange={(e) => setNotasDevolucion(e.target.value)}
              />
            </div>

            <button type="button" onClick={registrarDevolucion} disabled={savingDevolucion} className="btn-primary w-full justify-center">
              {savingDevolucion ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
              Registrar devolución
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
