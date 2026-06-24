"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getOrdenById,
  getItemsOrden,
  addItemOrden,
  updateItemOrden,
  deleteItemOrden,
  updateOrden,
  updateEstadoOrden,
  getClienteById,
  getVehiculoById,
  getUsuarios,
  getPagos,
  createPago,
  deletePago,
  uploadOrdenFoto,
  getPresupuestoPorIngreso,
  getDatosTaller,
  getProductos,
  getServicios,
  sendMensajeOrden,
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
  Vehiculo,
  Cliente,
  AppUser,
  DatosTaller,
  Producto,
  Servicio,
} from "@/types";
import {
  ChevronLeft,
  ChevronDown,
  Printer,
  Mail,
  MessageCircle,
  Loader2,
  Camera,
  Trash2,
  Car,
  User,
  Plus,
  X,
  Search,
  Users,
  Eye,
  PenTool,
  ClipboardSignature,
  Edit2,
  DollarSign,
  HeartPulse,
  FileText,
  HelpCircle,
  Tags,
  Check,
  Calendar,
  Grid,
  FileDown,
  MoreVertical,
  Box,
} from "lucide-react";
import { toast } from "react-hot-toast";
import AgregarItemModal from "@/components/ordenes/AgregarItemModal";
import OpcionesItemPopover from "@/components/ordenes/OpcionesItemPopover";
import ModalInspeccion from "@/components/recepcion/ModalInspeccion";
import ClienteModal from "@/components/clientes/ClienteModal";
import VehiculoModal from "@/components/vehiculos/VehiculoModal";
import { useAuthStore, useUIStore } from "@/store";
import { getMergedChecklist } from "@/lib/checklist";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import ModalEnviarCorreo from "@/components/ordenes/ModalEnviarCorreo";
import ModalFirmas from "@/components/ordenes/ModalFirmas";
import ChatOrden from "@/components/ordenes/ChatOrden";
import { useChatStore } from "@/store/chatStore";

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

const ESTADO_COLORS: Record<EstadoOrden, string> = {
  "Borrador": "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800/80 dark:bg-slate-900/50 dark:text-slate-400",
  "En Diagnóstico": "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400",
  "Esperando Repuestos": "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400",
  "Esperando Aprobación": "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-400",
  "En Reparación": "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-400",
  "Completada": "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400",
  "Listo para Entrega": "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-teal-400",
  "Entregada": "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  "Cancelada": "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400",
};

const ESTADO_DOT_COLORS: Record<EstadoOrden, string> = {
  "Borrador": "#94a3b8",
  "En Diagnóstico": "#3b82f6",
  "Esperando Repuestos": "#f59e0b",
  "Esperando Aprobación": "#a855f7",
  "En Reparación": "#06b6d4",
  "Completada": "#10b981",
  "Listo para Entrega": "#10b981",
  "Entregada": "#64748b",
  "Cancelada": "#94a3b8",
};

interface VistaOrdenDetalleProps {
  ordenId: string;
  isSidebar?: boolean;
}

export default function VistaOrdenDetalle({ ordenId, isSidebar = false }: VistaOrdenDetalleProps) {
  const router = useRouter();
  const { sidebarOpen } = useUIStore();
  const { user } = useAuthStore();
  const { unreadCount } = useChatStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Core Data
  const [orden, setOrden] = useState<OrdenTrabajo | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [items, setItems] = useState<ItemOrden[]>([]);
  const [tecnicos, setTecnicos] = useState<AppUser[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [taller, setTaller] = useState<DatosTaller | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [isPrintMenuOpen, setIsPrintMenuOpen] = useState(false);
  const [isEstadoMenuOpen, setIsEstadoMenuOpen] = useState(false);
  const [isTecnicoPopoverOpen, setIsTecnicoPopoverOpen] = useState(false);
  const [todosLosUsuarios, setTodosLosUsuarios] = useState<AppUser[]>([]);

  // Linking State
  const [linkedPresupuesto, setLinkedPresupuesto] = useState<OrdenTrabajo | null>(null);

  // Edit / Form State
  const [motivo, setMotivo] = useState("");
  const [tipoServicio, setTipoServicio] = useState<TipoServicio>("Mantenimiento");
  const [editingFactura, setEditingFactura] = useState(false);
  const [facturaVal, setFacturaVal] = useState("");
  const [fechaCreacion, setFechaCreacion] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [km, setKm] = useState("");
  const [nivelCombustible, setNivelCombustible] = useState<NivelCombustible>("1/2");
  const [estadoGeneral, setEstadoGeneral] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [danos, setDanos] = useState<DanoVehiculo[]>([]);
  const [informeTecnico, setInformeTecnico] = useState("");
  const [notasInternas, setNotasInternas] = useState("");

  // Modals & Panels State
  const [activeTab, setActiveTab] = useState<"Vehículo" | "Fotos" | "Notas" | "Diagnóstico" | "Informe" | "Chat">("Vehículo");
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isModalInspeccionOpen, setIsModalInspeccionOpen] = useState(false);
  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
  const [isVehiculoModalOpen, setIsVehiculoModalOpen] = useState(false);
  const [isPagoModalOpen, setIsPagoModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isFirmasModalOpen, setIsFirmasModalOpen] = useState(false);
  const [activePopoverItemId, setActivePopoverItemId] = useState<string | null>(null);

  // Catalog search states
  const [catalogoProductos, setCatalogoProductos] = useState<Producto[]>([]);
  const [catalogoServicios, setCatalogoServicios] = useState<Servicio[]>([]);
  const [searchText, setSearchText] = useState("");
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [searchQuantities, setSearchQuantities] = useState<Record<string, number>>({});

  // Local state for Payment Modal
  const [montoPago, setMontoPago] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [bancoPago, setBancoPago] = useState("");
  const [referenciaPago, setReferenciaPago] = useState("");
  const [notasPago, setNotasPago] = useState("");
  const [savingPago, setSavingPago] = useState(false);

  // File Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const oData = await getOrdenById(ordenId);
      if (!oData) {
        toast.error("Orden de trabajo no encontrada");
        router.push("/ordenes");
        return;
      }

      setOrden(oData);
      const [cData, vData, itemsData, uData, pagosData, tallerData, prodData, servData] = await Promise.all([
        oData.cliente || getClienteById(oData.clienteId),
        oData.vehiculo || getVehiculoById(oData.vehiculoId),
        getItemsOrden(ordenId),
        getUsuarios(),
        getPagos(ordenId),
        getDatosTaller(),
        getProductos(),
        getServicios(),
      ]);

      setCliente(cData);
      setVehiculo(vData);
      setItems(itemsData);
      setTecnicos(uData.filter((u) => u.role === "tecnico" && u.activo));
      setTodosLosUsuarios(uData);
      setPagos(pagosData);
      setTaller(tallerData);
      setCatalogoProductos(prodData);
      setCatalogoServicios(servData);

      // Populate local states
      setMotivo(oData.motivo || "");
      setTipoServicio(oData.tipoServicio || "Mantenimiento");
      setTecnicoId(oData.tecnicoId || "");
      setKm(oData.kilometrajeIngreso ? String(oData.kilometrajeIngreso) : "");
      setNivelCombustible(oData.nivelCombustible || "1/2");
      setEstadoGeneral(oData.notasInternas || "");
      setChecklist(getMergedChecklist(oData.checklistInventario));
      setDanos(oData.inspeccionVisual?.danos || []);
      setInformeTecnico(oData.informeTecnico || "");
      setNotasInternas(oData.notasInternas || "");
      setFacturaVal(oData.facturaManual || "");

      // Date parsing
      if (oData.createdAt) {
        const dateObj = oData.createdAt.toDate ? oData.createdAt.toDate() : new Date(oData.createdAt as any);
        setFechaCreacion(dateObj.toISOString().split("T")[0]);
      }
      if (oData.fechaEntrega) {
        const dateObj = oData.fechaEntrega.toDate ? oData.fechaEntrega.toDate() : new Date(oData.fechaEntrega as any);
        setFechaEntrega(dateObj.toISOString().split("T")[0]);
      }

      // Check linked budget if items are currently empty
      const numeroIngreso = oData.numeroIngreso ?? oData.numero ?? 0;
      const presupuesto = await getPresupuestoPorIngreso(numeroIngreso, oData.vehiculoId);
      setLinkedPresupuesto(presupuesto);

      if (itemsData.length === 0 && presupuesto?.id) {
        const itemsPresupuesto = await getItemsOrden(presupuesto.id);
        if (itemsPresupuesto.length > 0) {
          setSaving(true);
          const toastId = toast.loading("Vinculando e importando ítems de presupuesto...");
          
          for (const item of itemsPresupuesto) {
            const { id, ...itemData } = item;
            await addItemOrden(ordenId, { ...itemData, ordenId });
          }
          
          const updatedItems = await getItemsOrden(ordenId);
          setItems(updatedItems);
          
          toast.success("Se importaron automáticamente los ítems del presupuesto vinculado.", { id: toastId });
          setSaving(false);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar detalles de la orden");
    } finally {
      setLoading(false);
    }
  }, [ordenId, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Escuchar cambios en la orden en tiempo real para reflejar asignación de técnicos, firmas, etc.
  useEffect(() => {
    if (!ordenId) return;
    const unsub = onSnapshot(doc(db, "ordenesTrabajo", ordenId), (snap) => {
      if (snap.exists()) {
        const ordenData = { id: snap.id, ...snap.data() } as OrdenTrabajo;
        setOrden(ordenData);
      }
    });
    return unsub;
  }, [ordenId]);

  // Actualizar el título de la pestaña con el número de orden
  useEffect(() => {
    if (orden) {
      const numOt = String(orden.numeroOrden ?? orden.numero ?? 0).padStart(4, "0");
      const originalTitle = document.title;
      document.title = `Orden #OT-${numOt}`;
      return () => {
        document.title = originalTitle;
      };
    }
  }, [orden]);


  // Save changes
  const handleSaveField = async (fields: Partial<OrdenTrabajo>) => {
    if (!orden) return;
    setSaving(true);
    try {
      const teniaInspeccion = (orden.inspeccionVisual?.danos?.length || 0) > 0;
      const tieneInspeccionAhora = (fields.inspeccionVisual?.danos?.length || 0) > 0;

      const parsedFields = { ...fields };
      if (fields.fechaEntrega && typeof fields.fechaEntrega === "string") {
        parsedFields.fechaEntrega = new Date(fields.fechaEntrega as any) as any;
      }
      await updateOrden(ordenId, parsedFields);
      setOrden((prev) => (prev ? { ...prev, ...parsedFields } : null));

      // Si se acaba de registrar la inspección visual, enviar mensaje del sistema
      if (fields.inspeccionVisual && !teniaInspeccion && tieneInspeccionAhora) {
        await sendMensajeOrden(ordenId, {
          autorId: "sistema",
          autorNombre: "Sistema",
          autorRole: "admin",
          texto: `Inspección visual realizada por ${user?.displayName || "un técnico"}.`,
          sistema: true,
          accionSistema: "inspeccion" as any,
          tecnicoAfectadoId: user?.uid || "",
          tecnicoAfectadoNombre: user?.displayName || "Técnico"
        }).catch(err => console.error("Error al enviar mensaje de inspección:", err));
      }

      toast.success("Cambio guardado");
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar campo");
    } finally {
      setSaving(false);
    }
  };

  // Add Item to Order
  const handleAddItem = async (itemData: Omit<ItemOrden, "id" | "ordenId" | "subtotal">) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const subtotal = itemData.cantidad * itemData.precioUnitario;
    const itemOptimista: ItemOrden = {
      ...itemData,
      id: tempId,
      ordenId,
      subtotal,
    };

    // Actualización optimista del estado local
    setItems((prev) => [...prev, itemOptimista]);

    try {
      const newItemData = {
        ...itemData,
        ordenId,
        subtotal,
      };
      
      const realId = await addItemOrden(ordenId, newItemData);
      
      // Reemplazar el tempId con el ID real de Firestore en el estado
      setItems((prev) =>
        prev.map((it) => (it.id === tempId ? { ...it, id: realId } : it))
      );
      toast.success("Item agregado");
    } catch (err) {
      console.error(err);
      // Revertir el estado local en caso de error
      setItems((prev) => prev.filter((it) => it.id !== tempId));
      toast.error("Error al agregar item");
    }
  };

  // Sync external items to Purchases module
  const syncExternoItemWithCompra = async (item: ItemOrden, updatedFields: Partial<ItemOrden>) => {
    const finalItem = { ...item, ...updatedFields };
    
    // Si no es tipo externo y tiene compra vinculada, borramos la compra
    if (finalItem.tipo !== "externo") {
      if (finalItem.compraId) {
        try {
          const { deleteDoc, doc } = await import("firebase/firestore");
          const { db } = await import("@/lib/firebase");
          await deleteDoc(doc(db, "compras", finalItem.compraId));
          // Limpiar compraId y datos externos en Firebase
          await updateItemOrden(ordenId, finalItem.id!, {
            compraId: "",
            proveedorExterno: "",
            costoExterno: 0,
            pagadoExterno: false,
            metodoPagoExterno: "",
            bancoExterno: "",
            referenciaExterno: "",
            notasPagoExterno: "",
            fechaPagoExterno: "",
            fechaAcreditacionExterno: "",
            estadoAcreditacionExterno: null as any,
          });
        } catch (error) {
          console.error("Error al eliminar compra vinculada a item externo:", error);
        }
      }
      return;
    }

    // Si es externo pero no tiene costo, no guardamos aún en compras
    if (!finalItem.costoExterno) {
      return;
    }

    try {
      const { doc, setDoc, addDoc, collection } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");

      const compraData: any = {
        estadoAutorizacion: "AUTORIZADO",
        numeroAutorizacion: "AUT-" + Date.now(),
        fechaAutorizacion: new Date().toLocaleDateString(),
        proveedorRazonSocial: finalItem.proveedorExterno?.trim() || "Proveedor Externo",
        proveedorRuc: "EXTERNO",
        claveAcceso: "EXT-" + finalItem.id,
        establecimiento: "001",
        puntoEmision: "001",
        secuencial: String(Date.now()).slice(-9),
        numeroFactura: `OT-${String(orden?.numeroOrden ?? orden?.numero ?? 0).padStart(4, "0")}-${finalItem.id?.slice(-4)}`,
        fechaEmision: new Date().toISOString().split("T")[0],
        compradorRazonSocial: taller?.razonSocial || "Taller",
        compradorIdentificacion: taller?.ruc || "Taller RUC",
        totalSinImpuestos: finalItem.costoExterno * finalItem.cantidad,
        totalDescuento: 0,
        importeTotal: finalItem.costoExterno * finalItem.cantidad,
        moneda: "USD",
        items: [{
          codigo: "EXT",
          descripcion: `Servicio externo: ${finalItem.descripcion}`,
          cantidad: finalItem.cantidad,
          precioUnitario: finalItem.costoExterno,
          descuento: 0,
          subtotalSinImpuesto: finalItem.costoExterno * finalItem.cantidad,
          impuesto: 0,
          total: finalItem.costoExterno * finalItem.cantidad,
        }],
        pagosProveedor: finalItem.pagadoExterno ? [{
          monto: finalItem.costoExterno * finalItem.cantidad,
          metodoPago: finalItem.metodoPagoExterno || "efectivo",
          fecha: finalItem.fechaPagoExterno || new Date().toISOString().split("T")[0],
          createdAt: new Date(),
          ...(finalItem.bancoExterno ? { banco: finalItem.bancoExterno } : {}),
          ...(finalItem.referenciaExterno ? { referencia: finalItem.referenciaExterno } : {}),
          ...(finalItem.notasPagoExterno ? { notas: finalItem.notasPagoExterno } : {}),
          ...(finalItem.fechaAcreditacionExterno ? { fechaAcreditacion: finalItem.fechaAcreditacionExterno } : {}),
          ...(finalItem.estadoAcreditacionExterno ? { estadoAcreditacion: finalItem.estadoAcreditacionExterno } : {}),
        }] : [],
        totalPagadoProveedor: finalItem.pagadoExterno ? finalItem.costoExterno * finalItem.cantidad : 0,
        saldoProveedor: finalItem.pagadoExterno ? 0 : finalItem.costoExterno * finalItem.cantidad,
        estadoPagoProveedor: finalItem.pagadoExterno ? "pagado" : "pendiente",
        inventarioSincronizado: false,
        updatedAt: new Date(),
      };

      if (finalItem.compraId) {
        await setDoc(doc(db, "compras", finalItem.compraId), compraData, { merge: true });
      } else {
        compraData.createdAt = new Date();
        const docRef = await addDoc(collection(db, "compras"), compraData);
        await updateItemOrden(ordenId, finalItem.id!, {
          compraId: docRef.id
        });
        setItems(prev => prev.map(i => i.id === finalItem.id ? { ...i, compraId: docRef.id } : i));
      }
    } catch (error) {
      console.error("Error al sincronizar item externo con compra:", error);
    }
  };

  // Update multiple fields in Item
  const handleUpdateItemFields = async (itemId: string, updates: Partial<ItemOrden>) => {
    // Si es un item temporal, no permitir su actualización hasta que se guarde en Firestore
    if (itemId.startsWith("temp-")) return;

    const previousItems = [...items];
    let freshItem: ItemOrden | undefined;

    // Actualizar UI inmediatamente con el estado anterior más actualizado
    setItems((prev) => {
      const itemToUpdate = prev.find((i) => i.id === itemId);
      if (!itemToUpdate) return prev;
      const updatedItem = { ...itemToUpdate, ...updates };
      updatedItem.subtotal = updatedItem.cantidad * updatedItem.precioUnitario;
      freshItem = updatedItem;
      return prev.map((it) => (it.id === itemId ? updatedItem : it));
    });

    // Si no logramos obtener el freshItem desde prev (muy raro pero posible), usamos el de items actual
    const resolvedItem = freshItem || (() => {
      const itemToUpdate = items.find((i) => i.id === itemId);
      if (!itemToUpdate) return null;
      const updatedItem = { ...itemToUpdate, ...updates };
      updatedItem.subtotal = updatedItem.cantidad * updatedItem.precioUnitario;
      return updatedItem;
    })();

    if (!resolvedItem) return;

    try {
      await updateItemOrden(ordenId, itemId, {
        ...updates,
        subtotal: resolvedItem.subtotal,
      });

      // Sincronizar item externo con compras en segundo plano usando el resolvedItem completo
      void syncExternoItemWithCompra(resolvedItem, {});
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar item");
      // Revertir cambios en caso de error
      setItems(previousItems);
    }
  };

  // Update Item in Order (backward compatibility wrapper)
  const handleUpdateItem = async (itemId: string, fieldName: keyof ItemOrden, value: any) => {
    await handleUpdateItemFields(itemId, { [fieldName]: value });
  };

  // Delete Item from Order
  const handleDeleteItem = async (itemId?: string) => {
    if (!itemId) return;
    if (itemId.startsWith("temp-")) return; // No eliminar si es temporal y se está guardando
    if (!confirm("¿Eliminar este ítem?")) return;

    const itemToDelete = items.find((i) => i.id === itemId);
    if (!itemToDelete) return;

    const previousItems = [...items];

    // Actualizar UI inmediatamente
    setItems((prev) => prev.filter((i) => i.id !== itemId));

    try {
      if (itemToDelete.compraId) {
        try {
          const { deleteDoc, doc } = await import("firebase/firestore");
          const { db } = await import("@/lib/firebase");
          await deleteDoc(doc(db, "compras", itemToDelete.compraId));
        } catch (err) {
          console.error("Error al eliminar compra asociada a item externo:", err);
        }
      }
      await deleteItemOrden(ordenId, itemId);
      toast.success("Ítem eliminado");
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar item");
      // Revertir cambios en caso de error
      setItems(previousItems);
    }
  };

  // Change Order State
  const handleChangeEstado = async (estado: EstadoOrden) => {
    try {
      await updateEstadoOrden(ordenId, estado);
      setOrden((prev) => (prev ? { ...prev, estado } : null));
      toast.success(`Estado cambiado a: ${estado}`);
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar el estado");
    }
  };

  const handleTogglePersonalAsignado = async (tecnico: AppUser) => {
    if (!orden) return;
    const currentList = orden.personalAsignado || [];
    const exists = currentList.some((u) => u.uid === tecnico.uid);
    let nextList;
    if (exists) {
      nextList = currentList.filter((u) => u.uid !== tecnico.uid);
    } else {
      nextList = [
        ...currentList,
        {
          uid: tecnico.uid,
          email: tecnico.email,
          displayName: tecnico.displayName,
          role: tecnico.role,
        },
      ];
    }
    await handleSaveField({ personalAsignado: nextList });
  };

  // Upload Photo
  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setSaving(true);
    const toastId = toast.loading("Subiendo foto...");
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadOrdenFoto(ordenId, files[i]);
        urls.push(url);
      }
      const existingUrls = orden?.fotoUrls || [];
      const updatedUrls = [...existingUrls, ...urls];
      await updateOrden(ordenId, { fotoUrls: updatedUrls });
      setOrden((prev) => (prev ? { ...prev, fotoUrls: updatedUrls } : null));
      toast.success("Foto(s) agregada(s)", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Error al subir foto", { id: toastId });
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveFoto = async (index: number) => {
    if (!confirm("¿Seguro que deseas eliminar esta foto?")) return;
    try {
      const urls = [...(orden?.fotoUrls || [])];
      urls.splice(index, 1);
      await updateOrden(ordenId, { fotoUrls: urls });
      setOrden((prev) => (prev ? { ...prev, fotoUrls: urls } : null));
      toast.success("Foto eliminada");
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar foto");
    }
  };

  // Fuel list mapping
  const NIVELES_COMBUSTIBLE: { label: string; value: NivelCombustible }[] = [
    { label: "E", value: "Vacío" },
    { label: "1/4", value: "1/4" },
    { label: "1/2", value: "1/2" },
    { label: "3/4", value: "3/4" },
    { label: "F", value: "Lleno" },
  ];

  // Checklist updates
  const handleToggleChecklist = (index: number) => {
    const nextChecklist = [...checklist];
    nextChecklist[index].checked = !nextChecklist[index].checked;
    setChecklist(nextChecklist);
    handleSaveField({ checklistInventario: nextChecklist });
  };

  // Payment Calculation
  const subtotal = items.reduce((acc, it) => acc + it.precioUnitario * it.cantidad, 0);
  const iva = items.reduce((acc, it) => acc + it.precioUnitario * it.cantidad * (it.impuestoAplicable / 100), 0);
  const total = subtotal + iva;

  const totalAbonado = pagos.reduce((acc, p) => acc + (p.montoBase ?? p.monto), 0);
  const saldoPendiente = Math.max(0, total - totalAbonado);

  // Filter catalog items reactively
  const filteredCatalogResults = useMemo(() => {
    if (!searchText.trim()) return [];
    const term = searchText.toLowerCase();
    
    const matchedProds = catalogoProductos.filter((p) =>
      p.nombre.toLowerCase().includes(term) || (p.sku && p.sku.toLowerCase().includes(term))
    ).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      precio: p.precioBase,
      aplicaIva: p.aplicaIva,
      tipo: "producto" as const,
      sku: p.sku,
      stockActual: p.stockActual ?? 0,
    }));

    const matchedServs = catalogoServicios.filter((s) =>
      s.nombre.toLowerCase().includes(term)
    ).map((s) => ({
      id: s.id,
      nombre: s.nombre,
      precio: s.precioBase,
      aplicaIva: s.aplicaIva,
      tipo: "servicio" as const,
      sku: undefined,
      stockActual: Infinity,
    }));

    return [...matchedProds, ...matchedServs].slice(0, 10);
  }, [catalogoProductos, catalogoServicios, searchText]);

  const handleAddPago = async () => {
    if (!montoPago || isNaN(Number(montoPago)) || Number(montoPago) <= 0) {
      toast.error("Monto inválido");
      return;
    }
    const baseMonto = Number(montoPago);
    if (baseMonto > saldoPendiente + 0.01) {
      toast.error(`El abono no puede superar el saldo de $${saldoPendiente.toFixed(2)}`);
      return;
    }

    let porcentajeRecargo = 0;
    if (metodoPago === "tarjeta_credito") porcentajeRecargo = 8;
    else if (metodoPago === "tarjeta_debito") porcentajeRecargo = 2;

    const recargo = baseMonto * (porcentajeRecargo / 100);
    const montoTotal = baseMonto + recargo;

    setSavingPago(true);
    try {
      await createPago({
        ordenId,
        monto: montoTotal,
        montoBase: baseMonto,
        recargo: recargo > 0 ? recargo : undefined,
        porcentajeRecargo: porcentajeRecargo > 0 ? porcentajeRecargo : undefined,
        metodoPago,
        banco: metodoPago === "transferencia" || metodoPago.includes("tarjeta") ? bancoPago.trim() : undefined,
        referencia: referenciaPago.trim() || undefined,
        notas: notasPago.trim() || undefined,
      });
      setPagos(await getPagos(ordenId));
      setMontoPago("");
      setBancoPago("");
      setReferenciaPago("");
      setNotasPago("");
      setIsPagoModalOpen(false);
      toast.success("Pago registrado con éxito");
    } catch (err) {
      console.error(err);
      toast.error("Error al registrar pago");
    } finally {
      setSavingPago(false);
    }
  };

  const handleDeletePago = async (id?: string) => {
    if (!id || !confirm("¿Eliminar este registro de pago?")) return;
    try {
      await deletePago(id);
      setPagos(await getPagos(ordenId));
      toast.success("Pago eliminado");
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar pago");
    }
  };

  const handleDownloadPDF = async (type: "cliente" | "tecnico") => {
    if (!orden || !cliente || !vehiculo) return;
    
    setGeneratingPdf(true);
    const toastId = toast.loading("Generando PDF...");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      
      let blob;
      if (type === "cliente") {
        const OrdenClientePDF = (await import("@/components/recepcion/OrdenClientePDF")).default;
        blob = await pdf(
          <OrdenClientePDF
            orden={orden}
            cliente={cliente}
            vehiculo={vehiculo}
            items={items}
            pagos={pagos}
            taller={taller}
          />
        ).toBlob();
      } else {
        const OrdenTecnicoPDF = (await import("@/components/recepcion/OrdenTecnicoPDF")).default;
        blob = await pdf(
          <OrdenTecnicoPDF
            orden={orden}
            cliente={cliente}
            vehiculo={vehiculo}
            items={items}
            taller={taller}
          />
        ).toBlob();
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const numOt = String(orden.numeroOrden ?? orden.numero ?? 0).padStart(4, "0");
      link.download = `orden_trabajo_${type}_${numOt}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("PDF descargado con éxito", { id: toastId });
    } catch (error) {
      console.error("Error al generar PDF:", error);
      toast.error("Error al generar el PDF", { id: toastId });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePrintPDF = async (type: "cliente" | "tecnico") => {
    if (!orden || !cliente || !vehiculo) return;
    
    setGeneratingPdf(true);
    const toastId = toast.loading("Preparando impresión...");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      
      let blob;
      if (type === "cliente") {
        const OrdenClientePDF = (await import("@/components/recepcion/OrdenClientePDF")).default;
        blob = await pdf(
          <OrdenClientePDF
            orden={orden}
            cliente={cliente}
            vehiculo={vehiculo}
            items={items}
            pagos={pagos}
            taller={taller}
          />
        ).toBlob();
      } else {
        const OrdenTecnicoPDF = (await import("@/components/recepcion/OrdenTecnicoPDF")).default;
        blob = await pdf(
          <OrdenTecnicoPDF
            orden={orden}
            cliente={cliente}
            vehiculo={vehiculo}
            items={items}
            taller={taller}
          />
        ).toBlob();
      }

      const url = URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = url;
      document.body.appendChild(iframe);
      
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 1000);
      };
      
      toast.success("Ventana de impresión abierta", { id: toastId });
    } catch (error) {
      console.error("Error al preparar impresión:", error);
      toast.error("Error al preparar el PDF para impresión", { id: toastId });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleOpenEmailModal = async () => {
    const toastId = toast.loading("Verificando conexión de Gmail...");
    try {
      const user = auth.currentUser;
      if (!user) {
        toast.error("Inicia sesión para realizar esta acción.", { id: toastId });
        return;
      }
      
      const token = await user.getIdToken();
      const response = await fetch("/api/gmail/status", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "same-origin",
      });
      
      if (!response.ok) {
        throw new Error("GMAIL_STATUS_FAILED");
      }
      
      const data = await response.json();
      if (data.connected) {
        toast.dismiss(toastId);
        setIsEmailModalOpen(true);
      } else {
        toast.error("Para enviar correos, primero debe vincular su cuenta de Gmail en la sección de Compras.", { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al verificar la conexión de Gmail.", { id: toastId });
    }
  };

  const handleSaveFirmas = async (firmaClienteUrl: string, firmaTecnicoUrl: string) => {
    const toastId = toast.loading("Guardando firmas...");
    try {
      await updateOrden(ordenId, { firmaClienteUrl, firmaTecnicoUrl });
      setOrden((prev) =>
        prev
          ? {
              ...prev,
              firmaClienteUrl,
              firmaTecnicoUrl,
            }
          : null
      );
      toast.success("Firmas registradas con éxito", { id: toastId });
    } catch (error) {
      console.error("Error al registrar las firmas:", error);
      toast.error("Error al registrar las firmas", { id: toastId });
      throw error;
    }
  };

  if (loading || !orden || !cliente || !vehiculo) {
    if (isSidebar) {
      return (
        <div className="flex items-center justify-center h-full p-6 bg-slate-50 dark:bg-slate-900">
          <Loader2 size={32} className="animate-spin text-blue-500" />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={40} className="animate-spin text-blue-500 mb-4" />
        <p className="text-slate-500 text-sm">Cargando orden de trabajo...</p>
      </div>
    );
  }
  const assignedTechs = (orden.personalAsignado || []).filter(u => u.role === "tecnico");
  const firstTech = assignedTechs[0];
  const otherTechsCount = Math.max(0, assignedTechs.length - 1);
  const firstTechDetails = firstTech ? todosLosUsuarios.find(u => u.uid === firstTech.uid) : null;
  const firstTechPhoto = firstTechDetails?.photoURL;

  const advisorUser = (orden.personalAsignado || []).find((u) => u.role !== "tecnico") || user;
  const dbAdvisorUser = advisorUser?.uid ? todosLosUsuarios.find((u) => u.uid === advisorUser.uid) : null;
  const advisorPhoto = dbAdvisorUser?.photoURL || (advisorUser as any)?.photoURL;

  return (
    <div className="flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900" style={isSidebar ? { height: "100%" } : { height: "calc(100vh - 2rem)" }}>
      {/* Top Header Navigation */}
      <div className={`flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] shrink-0 bg-[var(--bg-card)] shadow-sm ${isSidebar ? "px-4 py-2.5 mb-3" : "px-6 py-3 mb-5"}`}>
        <div className="flex items-center gap-3">
          {!isSidebar && (
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors text-slate-500 hover:text-slate-900 border-none bg-transparent cursor-pointer flex items-center justify-center"
              title="Volver"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <div>
            <h1 className={`${isSidebar ? "text-sm" : "text-lg"} font-extrabold flex items-center gap-2`}>
              Orden <span className="text-blue-600 font-mono">#OT-{String(orden.numeroOrden ?? orden.numero ?? 0).padStart(4, "0")}</span>
            </h1>
            <div className="mt-0.5 leading-none flex">
              {editingFactura ? (
                <input
                  type="text"
                  className="bg-transparent border-b border-slate-300 dark:border-slate-700 text-[11px] font-semibold text-slate-400 dark:text-slate-500 focus:outline-none focus:border-blue-500 px-1 py-0 w-36"
                  value={facturaVal}
                  autoFocus
                  onChange={(e) => setFacturaVal(e.target.value)}
                  onBlur={async () => {
                    setEditingFactura(false);
                    await handleSaveField({ facturaManual: facturaVal.trim() });
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      setEditingFactura(false);
                      await handleSaveField({ facturaManual: facturaVal.trim() });
                    } else if (e.key === "Escape") {
                      setEditingFactura(false);
                      setFacturaVal(orden.facturaManual || "");
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingFactura(true)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 border-none bg-transparent cursor-pointer py-0"
                  title="Editar número de factura"
                >
                  <span>{orden.facturaManual ? `Factura: ${orden.facturaManual}` : "Sin factura"}</span>
                  <Edit2 size={10} className="opacity-60" />
                </button>
              )}
            </div>
          </div>
          
          {/* Creation and Delivery Dates */}
          {!isSidebar && (
            <div className="flex items-center gap-3 text-xs border-l border-[var(--border)] pl-4">
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 rounded-md border border-[var(--border)]">
                <span className="text-[var(--text-muted)] font-medium">Creación</span>
                <input
                  type="date"
                  className="bg-transparent border-0 font-semibold p-0 text-xs w-28 text-[var(--text-primary)] focus:ring-0 outline-none"
                  value={fechaCreacion}
                  onChange={(e) => {
                    setFechaCreacion(e.target.value);
                    handleSaveField({ createdAt: new Date(e.target.value) as any });
                  }}
                />
              </div>
              
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 rounded-md border border-[var(--border)]">
                <span className="text-[var(--text-muted)] font-medium">Entrega</span>
                <input
                  type="date"
                  className="bg-transparent border-0 font-semibold p-0 text-xs w-28 text-[var(--text-primary)] focus:ring-0 outline-none"
                  value={fechaEntrega}
                  onChange={(e) => {
                    setFechaEntrega(e.target.value);
                    handleSaveField({ fechaEntrega: e.target.value as any });
                  }}
                />
              </div>
            </div>
          )}

          {/* Technician Select Popover */}
          {!isSidebar && (
            <div className="relative border-l border-[var(--border)] pl-4">
              <button
                type="button"
                onClick={() => setIsTecnicoPopoverOpen(!isTecnicoPopoverOpen)}
                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-0 rounded-full text-xs font-bold px-3 py-1.5 cursor-pointer outline-none transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-300 font-extrabold uppercase text-[10px] overflow-hidden shrink-0">
                  {firstTechPhoto ? (
                    <img src={firstTechPhoto} alt={firstTech?.displayName} className="w-full h-full object-cover" />
                  ) : (
                    firstTech?.displayName?.substring(0, 2) || "—"
                  )}
                </div>
                <span className="text-[var(--text-primary)] max-w-[120px] truncate">
                  {firstTech?.displayName || "Sin técnico"}{otherTechsCount > 0 ? ` +${otherTechsCount}` : ""}
                </span>
                <ChevronDown size={14} className="text-slate-500 shrink-0" />
              </button>

              {isTecnicoPopoverOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsTecnicoPopoverOpen(false)}></div>
                  <div className="absolute left-0 mt-2 w-80 bg-white dark:bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-xl z-20 p-4 flex flex-col gap-4">
                    {/* ATENDIDO POR */}
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Atendido Por</span>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center text-orange-700 dark:text-orange-300 font-bold uppercase text-xs overflow-hidden shrink-0">
                          {advisorPhoto ? (
                            <img src={advisorPhoto} alt={advisorUser?.displayName} className="w-full h-full object-cover" />
                          ) : (
                            advisorUser?.displayName?.substring(0, 2) || "U"
                          )}
                        </div>
                        <div>
                          <p className="font-extrabold text-xs text-[var(--text-primary)]">{advisorUser?.displayName || "Asesor"}</p>
                          <p className="text-[10px] text-slate-400 font-medium capitalize">
                            {advisorUser?.role === "recepcion" ? "Recepción" : advisorUser?.role === "asesor_servicio" ? "Asesor de Servicio" : advisorUser?.role || "Asesor"}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <hr className="border-slate-100 dark:border-slate-800" />
                    
                    {/* TÉCNICOS */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Técnicos</span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {assignedTechs.length} asignado{assignedTechs.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      
                      <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                        {tecnicos.map((t) => {
                          const isAssigned = (orden.personalAsignado || []).some((u) => u.uid === t.uid);
                          return (
                            <label
                              key={t.uid}
                              className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer text-xs transition-colors"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase overflow-hidden shrink-0">
                                  {t.photoURL ? (
                                    <img src={t.photoURL} alt={t.displayName} className="w-full h-full object-cover" />
                                  ) : (
                                    t.displayName?.substring(0, 2) || "T"
                                  )}
                                </div>
                                <span className="font-semibold text-[var(--text-primary)]">{t.displayName}</span>
                              </div>
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={() => handleTogglePersonalAsignado(t)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    
                    <hr className="border-slate-100 dark:border-slate-800" />
                    
                    <button
                      type="button"
                      onClick={() => setIsTecnicoPopoverOpen(false)}
                      className="w-full py-1.5 text-center text-xs font-bold text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Top actions & Payment */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[var(--text-secondary)]">
            {/* Botón de Imprimir con Dropdown (Cliente/Técnico) */}
            <div className="relative">
              <button
                type="button"
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 disabled:opacity-50"
                onClick={() => setIsPrintMenuOpen(!isPrintMenuOpen)}
                disabled={generatingPdf || loading}
                title="Imprimir"
              >
                {generatingPdf ? (
                  <Loader2 size={16} className="animate-spin text-blue-600" />
                ) : (
                  <Printer size={16} />
                )}
              </button>
              {isPrintMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsPrintMenuOpen(false)}></div>
                  <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPrintMenuOpen(false);
                        handlePrintPDF("cliente");
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2 border-0 bg-transparent cursor-pointer font-semibold"
                    >
                      <User size={14} className="text-slate-500" />
                      Imprimir para Cliente
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPrintMenuOpen(false);
                        handlePrintPDF("tecnico");
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2 border-0 bg-transparent cursor-pointer font-semibold"
                    >
                      <PenTool size={14} className="text-slate-500" />
                      Imprimir para Técnico
                    </button>
                  </div>
                </>
              )}
            </div>
            
            {/* Botón de Descargar PDF con Dropdown (Cliente/Técnico) */}
            <div className="relative">
              <button
                type="button"
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 disabled:opacity-50"
                onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                disabled={generatingPdf || loading}
                title="Descargar PDF"
              >
                {generatingPdf ? (
                  <Loader2 size={16} className="animate-spin text-blue-600" />
                ) : (
                  <FileDown size={16} />
                )}
              </button>
              {isDownloadMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsDownloadMenuOpen(false)}></div>
                  <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDownloadMenuOpen(false);
                        handleDownloadPDF("cliente");
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2 border-0 bg-transparent cursor-pointer font-semibold"
                    >
                      <User size={14} className="text-slate-500" />
                      Orden para Cliente
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDownloadMenuOpen(false);
                        handleDownloadPDF("tecnico");
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2 border-0 bg-transparent cursor-pointer font-semibold"
                    >
                      <PenTool size={14} className="text-slate-500" />
                      Orden para Técnico
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleOpenEmailModal}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 bg-transparent border-0 cursor-pointer flex items-center justify-center"
              title="Enviar Email"
            >
              <Mail size={16} />
            </button>
            {!isSidebar && (
              <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500" title="Chat"><MessageCircle size={16} /></button>
            )}
          </div>

          {/* Estado Selector Personalizado */}
          <div className="relative">
            <button
              type="button"
              className={`flex items-center gap-2 border rounded-lg text-xs font-bold px-3 py-1.5 cursor-pointer outline-none transition-all ${ESTADO_COLORS[orden.estado] || "border-slate-200 bg-slate-50 text-slate-600"}`}
              onClick={() => setIsEstadoMenuOpen(!isEstadoMenuOpen)}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: ESTADO_DOT_COLORS[orden.estado] || "#94a3b8" }}
              />
              {orden.estado}
            </button>
            {isEstadoMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsEstadoMenuOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 py-1.5 overflow-hidden">
                  {ESTADOS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        setIsEstadoMenuOpen(false);
                        handleChangeEstado(e);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-3 border-0 bg-transparent cursor-pointer font-semibold transition-colors"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: ESTADO_DOT_COLORS[e] }}
                      />
                      <span className="flex-1 text-[var(--text-primary)]">{e}</span>
                      {orden.estado === e && (
                        <Check size={12} className="text-blue-600 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Dollar Sign / Pay button */}
          <button
            onClick={() => setIsPagoModalOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm"
          >
            <DollarSign size={14} /> Pagar
          </button>
        </div>
      </div>


      {/* Main 2-Column Grid */}
      <div className={`flex flex-1 gap-6 min-h-0 ${isSidebar ? "flex-col overflow-y-auto px-4 pb-4 custom-scrollbar" : "overflow-hidden px-6 pb-6"}`}>
        
        {/* Left Column (Items & Form) */}
        <div className={`${isSidebar ? "w-full shrink-0" : "flex-1 flex flex-col gap-5 overflow-y-auto pr-2 custom-scrollbar pb-6 min-w-0"}`}>
          


          {/* Items search */}
          <div className="flex gap-3 shrink-0 relative">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                className="input pl-10 w-full border border-[var(--border)] text-sm rounded-lg bg-[var(--bg-card)] focus:border-blue-500 text-[var(--text-primary)]"
                placeholder="Buscar producto, servicio o código de barras..."
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setSearchResultsOpen(true);
                }}
                onFocus={() => setSearchResultsOpen(true)}
              />

              {/* Autocomplete Dropdown Panel */}
              {searchResultsOpen && searchText.trim() && (
                <>
                  <div className="fixed inset-0 z-[100]" onClick={() => setSearchResultsOpen(false)}></div>
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-h-72 overflow-y-auto z-[110] divide-y divide-slate-100 dark:divide-slate-800 custom-scrollbar">
                    {filteredCatalogResults.length === 0 ? (
                      <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                        No se encontraron resultados para "{searchText}"
                      </div>
                    ) : (
                      filteredCatalogResults.map((result) => {
                        const isProd = result.tipo === "producto";
                        const stockActual = isProd ? Math.floor(result.stockActual) : Infinity;
                        const outOfStock = isProd && stockActual <= 0;
                        const qty = searchQuantities[result.id || ""] ?? 1;
                        return (
                          <div
                            key={result.id}
                            className={`w-full flex flex-col sm:flex-row sm:items-center justify-between p-3 text-left transition-colors text-xs gap-3 ${
                              outOfStock 
                                ? "opacity-50 bg-slate-50/50 cursor-not-allowed" 
                                : "hover:bg-blue-50/50 dark:hover:bg-blue-950/10"
                            }`}
                          >
                            {/* Información del item */}
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-blue-600 shrink-0">
                                {isProd ? <Box size={16} /> : <PenTool size={16} />}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-[var(--text-primary)]">{result.nombre}</span>
                                  {result.aplicaIva && (
                                    <span className="text-[8px] bg-blue-100 text-blue-700 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                                      IVA
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] mt-0.5">
                                  {isProd ? (
                                    <>
                                      <span className="uppercase font-mono">SKU: {result.sku || "S/N"}</span>
                                      <span>·</span>
                                      <span className={outOfStock ? "text-red-500 font-semibold" : ""}>Stock: {stockActual}</span>
                                    </>
                                  ) : (
                                    <span>Servicio</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Controles de Precio, Cantidad y Agregar */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-11 sm:pl-0">
                              <div className="font-extrabold text-[var(--text-primary)] text-sm whitespace-nowrap">
                                ${result.precio.toFixed(2)}
                              </div>

                              {outOfStock ? (
                                <span className="text-[10px] bg-red-100 dark:bg-red-950/30 text-red-600 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider border border-red-200 dark:border-red-900/30">
                                  Agotado
                                </span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {/* Controles de cantidad */}
                                  <div className="inline-flex items-center border border-[var(--border)] rounded-lg bg-white dark:bg-slate-800 overflow-hidden shadow-sm h-7">
                                    <button
                                      type="button"
                                      className="px-1.5 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-650 text-xs font-bold text-slate-500 h-full border-0 cursor-pointer"
                                      onClick={() => setSearchQuantities(prev => ({ ...prev, [result.id || ""]: Math.max(1, qty - 1) }))}
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      className="w-8 text-center border-0 p-0 text-xs font-semibold focus:ring-0 bg-transparent text-[var(--text-primary)]"
                                      value={qty}
                                      onChange={(e) => {
                                        const parsedVal = Math.max(1, Math.min(stockActual, Number(e.target.value) || 1));
                                        setSearchQuantities(prev => ({ ...prev, [result.id || ""]: parsedVal }));
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="px-1.5 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-650 text-xs font-bold text-slate-500 h-full border-0 cursor-pointer"
                                      onClick={() => setSearchQuantities(prev => ({ ...prev, [result.id || ""]: Math.min(stockActual, qty + 1) }))}
                                    >
                                      +
                                    </button>
                                  </div>

                                  {/* Botón Agregar */}
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const precioUnitario = (!isProd || !result.aplicaIva) ? result.precio : Number((result.precio / 1.15).toFixed(2));
                                      await handleAddItem({
                                        tipo: result.tipo,
                                        productoId: result.id,
                                        productoSku: result.sku,
                                        productoNombre: result.nombre,
                                        descripcion: result.nombre,
                                        cantidad: qty,
                                        precioUnitario,
                                        impuestoAplicable: result.aplicaIva ? 15 : 0,
                                      });
                                      // Limpiar búsqueda
                                      setSearchText("");
                                      setSearchResultsOpen(false);
                                      // Limpiar cantidad específica
                                      setSearchQuantities(prev => {
                                        const next = { ...prev };
                                        delete next[result.id || ""];
                                        return next;
                                      });
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs shadow-sm transition-colors cursor-pointer border-none flex items-center gap-1"
                                  >
                                    Agregar
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setIsCatalogOpen(true)}
              className="btn bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <Grid size={14} /> Catálogo
            </button>
          </div>

          {/* Table of items */}
          <div className="border border-[var(--border)] rounded-xl shadow-sm bg-[var(--bg-card)] overflow-visible">
            <table className="table w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-slate-50/50">
                  <th>Descripción</th>
                  <th className="text-center w-24">Cant</th>
                  <th className="text-right w-28">Precio</th>
                  <th className="text-center w-20">IVA</th>
                  <th className="text-right w-28">Total</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-[var(--text-muted)] text-sm">
                      No hay repuestos o servicios cargados a esta orden.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const isOptimistic = item.id?.startsWith("temp-");
                    return (
                      <tr key={item.id || idx} className={`hover:bg-slate-50/50 transition-opacity duration-300 ${isOptimistic ? "opacity-65 pointer-events-none select-none" : ""}`}>
                      <td className="py-2.5">
                        <p className="font-bold text-[var(--text-primary)] text-sm truncate" title={item.descripcion}>
                          {item.descripcion}
                        </p>
                        {item.productoSku && (
                          <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase mt-0.5">
                            SKU: {item.productoSku}
                          </p>
                        )}
                      </td>
                      <td className="text-center py-2.5">
                        <div className="inline-flex items-center border border-[var(--border)] rounded-lg bg-white overflow-hidden shadow-sm">
                          <button
                            type="button"
                            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-500"
                            onClick={() => handleUpdateItem(item.id!, "cantidad", Math.max(1, item.cantidad - 1))}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            className="w-10 text-center border-0 p-0 text-xs font-semibold focus:ring-0"
                            value={item.cantidad}
                            onChange={(e) => {
                              const newItems = [...items];
                              newItems[idx].cantidad = Number(e.target.value);
                              setItems(newItems);
                            }}
                            onBlur={(e) => handleUpdateItem(item.id!, "cantidad", Math.max(1, Number(e.target.value)))}
                          />
                          <button
                            type="button"
                            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-500"
                            onClick={() => handleUpdateItem(item.id!, "cantidad", item.cantidad + 1)}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="text-right py-2.5">
                        <div className="relative inline-block w-24">
                          <input
                            type="number"
                            className="w-full text-right border border-[var(--border)] rounded-lg p-1 text-xs focus:ring-0"
                            value={item.precioUnitario}
                            onChange={(e) => {
                              const newItems = [...items];
                              newItems[idx].precioUnitario = Number(e.target.value);
                              setItems(newItems);
                            }}
                            onBlur={(e) => handleUpdateItem(item.id!, "precioUnitario", Number(e.target.value))}
                          />
                        </div>
                      </td>
                      <td className="text-center text-xs text-slate-500 py-2.5">
                        {item.impuestoAplicable > 0 ? `${item.impuestoAplicable}%` : "0%"}
                      </td>
                      <td className="text-right font-extrabold text-sm text-[var(--text-primary)] py-2.5">
                        ${(item.precioUnitario * item.cantidad).toFixed(2)}
                      </td>
                      <td className="text-center py-2.5 relative flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setActivePopoverItemId(activePopoverItemId === item.id ? null : (item.id || null))}
                          className={`p-1 rounded-md transition-colors cursor-pointer hover:bg-slate-100 ${
                            activePopoverItemId === item.id ? "text-blue-600 bg-slate-100" : "text-[var(--text-muted)] hover:text-slate-700"
                          }`}
                          title="Opciones de ítem"
                        >
                          <MoreVertical size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-[var(--text-muted)] hover:text-red-500 p-1 rounded-md cursor-pointer hover:bg-slate-100"
                          title="Eliminar ítem"
                        >
                          <Trash2 size={14} />
                        </button>

                        {/* Popover flotante de 3 puntos */}
                        {activePopoverItemId === item.id && (
                          <OpcionesItemPopover
                            item={item}
                            onClose={() => setActivePopoverItemId(null)}
                            onUpdateFields={(updates) => handleUpdateItemFields(item.id!, updates)}
                            onLocalUpdate={(updates) => {
                              setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, ...updates } : it)));
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-start">
            <button className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1 shadow-sm">
              <Tags size={12} className="text-slate-500" /> Agregar tag
            </button>
          </div>
        </div>

        {/* Right Column (Sidebar Tabs) */}
        <div className={`${isSidebar ? "w-full min-h-[450px]" : "w-[340px]"} border border-[var(--border)] rounded-2xl flex flex-col bg-[var(--bg-card)] shadow-sm overflow-hidden shrink-0`}>
          {/* Tabs bar */}
          <div className="flex border-b border-[var(--border)] bg-slate-50/50 shrink-0">
            {(["Vehículo", "Fotos", "Notas", "Diagnóstico", "Informe", "Chat"] as const)
              .filter((tab) => !(isSidebar && tab === "Chat"))
              .map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === "Chat") useChatStore.getState().resetUnread();
                }}
                className={`flex-1 text-center py-2.5 text-[10px] font-bold transition-all border-b-2 uppercase tracking-wide relative ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-600 bg-white"
                    : "border-transparent text-[var(--text-muted)] hover:text-slate-900"
                }`}
              >
                {tab}
                {tab === "Chat" && unreadCount > 0 && activeTab !== "Chat" && (
                  <span className="absolute -top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center shadow-sm">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className={`flex-1 overflow-hidden ${activeTab === "Chat" ? "" : "overflow-y-auto p-4 custom-scrollbar space-y-4"}`}>
            
            {activeTab === "Vehículo" && (
              <div className="space-y-4">
                {/* Vehicle header */}
                <div className="flex items-center justify-between p-3 border border-[var(--border)] rounded-xl bg-slate-50/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white shrink-0">
                      <Car size={20} />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-[var(--text-primary)] leading-tight">
                        {vehiculo.marca} {vehiculo.modelo} {vehiculo.anio}
                      </h4>
                      <span className="inline-block badge badge-gray font-mono uppercase text-[9px] mt-1">
                        {vehiculo.placa}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsVehiculoModalOpen(true)}
                    className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"
                  >
                    <Edit2 size={13} />
                  </button>
                </div>

                <a
                  href="#"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 pl-1"
                >
                  Ver ficha completa del vehículo →
                </a>

                {/* Customer info card */}
                <div className="flex items-center justify-between p-3 border border-[var(--border)] rounded-xl bg-slate-50/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-bold uppercase shrink-0">
                      {cliente.nombre?.[0] || ""}{cliente.apellido?.[0] || ""}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-[var(--text-primary)] leading-tight uppercase">
                        {cliente.nombre} {cliente.apellido}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <a
                          href={`https://wa.me/${cliente.telefono.replace(/\D/g, "")}`}
                          target="_blank"
                          className="text-xs text-[var(--text-muted)] hover:text-green-600 flex items-center gap-1.5"
                        >
                          <MessageCircle size={14} className="text-green-500 fill-green-500/10" /> {cliente.telefono}
                        </a>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsClienteModalOpen(true)}
                    className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"
                    title="Cambiar cliente"
                  >
                    <Edit2 size={13} />
                  </button>
                </div>

                {/* MOTIVO DE INGRESO */}
                <div className="form-group border-b border-[var(--border)] pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="label">Motivo de Ingreso</label>
                    <div className="flex items-center gap-3 text-[10px] font-semibold text-[var(--text-secondary)]">
                      {["Diagnóstico", "Reparación", "Mantenimiento", "Garantía"].map((tipo) => (
                        <label key={tipo} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="tipoServicio"
                            className="text-blue-600 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                            checked={tipoServicio === tipo || (tipo === "Mantenimiento" && tipoServicio === "Mantenimiento")}
                            onChange={() => {
                              const parsedVal = tipo === "Diagnóstico" ? "Mantenimiento" : (tipo as TipoServicio);
                              setTipoServicio(parsedVal);
                              handleSaveField({ tipoServicio: parsedVal });
                            }}
                          />
                          {tipo}
                        </label>
                      ))}
                    </div>
                  </div>
                  <textarea
                    className="input w-full bg-slate-50/50 hover:bg-slate-50 border border-[var(--border)] text-xs rounded-lg"
                    placeholder="Describa el motivo detallado de ingreso"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    onBlur={() => handleSaveField({ motivo })}
                    rows={2}
                  />
                </div>

                {/* Kilometraje */}
                <div className="form-group">
                  <label className="label">Kilometraje</label>
                  <input
                    type="number"
                    className="input w-full bg-slate-50/50"
                    placeholder="Ej: 85000"
                    value={km}
                    onChange={(e) => setKm(e.target.value)}
                    onBlur={() => handleSaveField({ kilometrajeIngreso: Number(km) })}
                  />
                </div>

                {/* Combustible */}
                <div className="form-group">
                  <label className="label">Combustible</label>
                  <div className="flex rounded-lg overflow-hidden border border-[var(--border)] bg-slate-100 dark:bg-slate-800 p-0.5">
                    {NIVELES_COMBUSTIBLE.map((nivel) => {
                      const isSelected = nivelCombustible === nivel.value;
                      return (
                        <button
                          key={nivel.value}
                          type="button"
                          className={`flex-1 text-center py-1.5 text-xs font-extrabold rounded-md transition-all ${
                            isSelected
                              ? "bg-amber-500 text-white shadow-sm"
                              : "text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
                          }`}
                          onClick={() => {
                            setNivelCombustible(nivel.value);
                            handleSaveField({ nivelCombustible: nivel.value });
                          }}
                        >
                          {nivel.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Inspeccion visual */}
                <div className="form-group border-t border-[var(--border)] pt-4">
                  <label className="label">Inspección Visual</label>
                  <button
                    onClick={() => setIsModalInspeccionOpen(true)}
                    className="btn w-full justify-center bg-white hover:bg-slate-50 border border-[var(--border)] text-slate-700 font-bold text-xs py-2 shadow-sm rounded-lg"
                  >
                    Registrar inspección
                  </button>

                  {danos.length > 0 && (
                    <div className="flex items-center justify-between p-3 border border-blue-200 bg-blue-50/30 rounded-xl mt-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Eye size={15} className="text-blue-600" />
                        <div>
                          <p className="font-bold text-blue-900">Inspección de ingreso</p>
                          <p className="text-[10px] text-blue-700 mt-0.5">
                            {danos.length} marca{danos.length !== 1 ? "s" : ""} · {fechaCreacion || "Reciente"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsModalInspeccionOpen(true)}
                        className="text-blue-600 hover:text-blue-800 font-bold"
                      >
                        Ver
                      </button>
                    </div>
                  )}
                </div>

                {/* Estado General del Vehiculo */}
                <div className="form-group border-t border-[var(--border)] pt-4">
                  <label className="label">Estado General del Vehículo</label>
                  <textarea
                    className="input w-full bg-slate-50/50"
                    placeholder="Describe el estado general..."
                    value={estadoGeneral}
                    onChange={(e) => setEstadoGeneral(e.target.value)}
                    onBlur={() => handleSaveField({ notasInternas: estadoGeneral })}
                    rows={3}
                  />
                </div>

                {/* Inventario Checklist */}
                <div className="form-group border-t border-[var(--border)] pt-4">
                  <label className="label">Inventario del Vehículo</label>
                  <div className="border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                    {checklist.length === 0 ? (
                      <p className="p-3 text-center text-xs text-[var(--text-muted)] italic">
                        Sin inventario registrado
                      </p>
                    ) : (
                      checklist.map((item, idx) => (
                        <label
                          key={idx}
                          className="flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer text-xs"
                        >
                          <span className="text-slate-700 font-medium">{item.label}</span>
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => handleToggleChecklist(idx)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-0"
                          />
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "Fotos" && (
              <div className="space-y-4">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleUploadFoto}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn w-full justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 shadow-sm rounded-lg"
                >
                  <Camera size={14} className="mr-1.5" /> Agregar Imagen
                </button>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  {(orden.fotoUrls || []).map((url, index) => (
                    <div
                      key={index}
                      className="relative aspect-square rounded-xl overflow-hidden border border-[var(--border)] bg-slate-100 group shadow-sm"
                    >
                      <img src={url} alt="Evidencia" className="w-full h-full object-cover" />
                      <button
                        onClick={() => handleRemoveFoto(index)}
                        className="absolute top-1 right-1 p-1 bg-red-600/90 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {(orden.fotoUrls || []).length === 0 && (
                    <p className="col-span-2 text-center text-xs text-[var(--text-muted)] py-8">
                      No hay imágenes cargadas a esta orden.
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "Notas" && (
              <div className="space-y-3">
                <label className="label">Notas Internas / Observaciones</label>
                <textarea
                  className="input w-full bg-slate-50/50"
                  placeholder="Escribe observaciones de uso interno..."
                  value={notasInternas}
                  onChange={(e) => setNotasInternas(e.target.value)}
                  onBlur={() => handleSaveField({ notasInternas })}
                  rows={10}
                />
              </div>
            )}

            {activeTab === "Diagnóstico" && (
              <div className="space-y-3">
                <label className="label">Informe Técnico / Diagnóstico</label>
                <textarea
                  className="input w-full bg-slate-50/50"
                  placeholder="Escriba aquí los detalles del diagnóstico y conclusiones..."
                  value={informeTecnico}
                  onChange={(e) => setInformeTecnico(e.target.value)}
                  onBlur={() => handleSaveField({ informeTecnico })}
                  rows={10}
                />
              </div>
            )}

            {activeTab === "Informe" && (
              <div className="space-y-4 py-4 text-center">
                <FileText size={40} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs text-[var(--text-muted)]">
                  Generación y descarga de informes técnicos para enviar al cliente en formato PDF.
                </p>
                <button className="btn bg-white border border-[var(--border)] text-slate-700 text-xs py-2 w-full justify-center rounded-lg shadow-sm">
                  Descargar Informe Técnico PDF
                </button>
              </div>
            )}

            {activeTab === "Chat" && (
              <ChatOrden
                ordenId={ordenId}
                personalAsignado={orden.personalAsignado || []}
                todosLosUsuarios={todosLosUsuarios}
                onOpenInspeccion={() => setIsModalInspeccionOpen(true)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <div className={`mt-4 pt-3 border-t border-[var(--border)] flex flex-wrap justify-between items-center bg-[var(--bg-card)] py-2 shrink-0 rounded-xl shadow-sm gap-4 ${isSidebar ? "px-3 text-xs" : "px-4"}`}>
        {/* Progress bar */}
        {!isSidebar && (
          <div className="flex items-center gap-2.5 w-60 text-xs">
            <span className="font-extrabold text-[var(--text-secondary)]">Progreso</span>
            <div className="flex-1 progress-bar h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="progress-fill h-full bg-blue-600" style={{ width: "0%" }}></div>
            </div>
            <span className="font-extrabold text-[var(--text-secondary)]">0%</span>
          </div>
        )}

        {/* Totals panel compact */}
        <div className={`flex items-center text-xs font-semibold ${isSidebar ? "gap-3" : "gap-6"}`}>
          <div>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block leading-none mb-0.5">Subtotal</span>
            <span className="font-bold text-[var(--text-primary)]">${subtotal.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block leading-none mb-0.5">IVA (15%)</span>
            <span className="font-bold text-[var(--text-primary)]">${iva.toFixed(2)}</span>
          </div>
          <div className="border-l border-[var(--border)] pl-4">
            <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block leading-none mb-0.5">Total</span>
            <span className="font-extrabold text-sm text-blue-600">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Control actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFirmasModalOpen(true)}
            className="btn bg-white border border-[var(--border)] text-slate-700 text-xs py-1.5 px-3 rounded-lg shadow-sm cursor-pointer"
          >
            Firmar
          </button>
          <button className="btn bg-white border border-[var(--border)] text-slate-700 text-xs py-1.5 px-3 rounded-lg shadow-sm">
            Etiqueta
          </button>
        </div>
      </div>

      {/* AgregarItemModal */}
      {isCatalogOpen && (
        <AgregarItemModal
          onClose={() => setIsCatalogOpen(false)}
          onAdd={handleAddItem}
        />
      )}

      {/* ModalInspeccion */}
      <ModalInspeccion
        isOpen={isModalInspeccionOpen}
        onClose={() => setIsModalInspeccionOpen(false)}
        vehiculo={vehiculo}
        danos={danos}
        onChangeDanos={setDanos}
        onSave={() => handleSaveField({ inspeccionVisual: { danos } })}
        fotos={(orden.fotoUrls || []).map((url) => ({ url, descripcion: "" }))}
        onUploadFoto={handleUploadFoto}
        onUpdateFoto={async () => {}}
        onRemoveFoto={handleRemoveFoto}
        observaciones={notasInternas}
        onChangeObservaciones={setNotasInternas}
      />

      {/* ClienteModal */}
      {isClienteModalOpen && (
        <ClienteModal
          cliente={cliente}
          onClose={() => setIsClienteModalOpen(false)}
          onSaved={() => {
            setIsClienteModalOpen(false);
            void loadData();
          }}
        />
      )}

      {/* VehiculoModal */}
      <VehiculoModal
        isOpen={isVehiculoModalOpen}
        onClose={() => setIsVehiculoModalOpen(false)}
        editingVehiculo={vehiculo}
        onSuccess={() => {
          setIsVehiculoModalOpen(false);
          void loadData();
        }}
      />

      {/* PagoModal */}
      {isPagoModalOpen && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPagoModalOpen(false);
          }}
          className={`fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200 pt-[calc(var(--header-height)+1rem)] transition-all ${
            sidebarOpen ? "lg:pl-[calc(var(--sidebar-width)+1rem)]" : ""
          }`}
        >
          <div className="bg-[var(--bg-card)] w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                <DollarSign size={16} className="text-emerald-600" /> Registrar Abonos / Pagos
              </h2>
              <button
                onClick={() => setIsPagoModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Totals info */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-[var(--border)] text-xs">
                  <p className="text-[var(--text-muted)] font-semibold uppercase">Total</p>
                  <p className="font-extrabold text-[var(--text-primary)] mt-0.5">${total.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-[var(--border)] text-xs">
                  <p className="text-[var(--text-muted)] font-semibold uppercase">Cobrado</p>
                  <p className="font-extrabold text-emerald-600 mt-0.5">${totalAbonado.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-[var(--border)] text-xs">
                  <p className="text-[var(--text-muted)] font-semibold uppercase">Saldo</p>
                  <p className="font-extrabold text-amber-600 mt-0.5">${saldoPendiente.toFixed(2)}</p>
                </div>
              </div>

              {/* Form fields */}
              <div className="form-group">
                <label className="label">Monto ($)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="0.00"
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  disabled={saldoPendiente <= 0.01}
                />
              </div>

              <div className="form-group">
                <label className="label">Método de pago</label>
                <select
                  className="input"
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
                  disabled={saldoPendiente <= 0.01}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="tarjeta_credito">Tarjeta de Crédito</option>
                  <option value="tarjeta_debito">Tarjeta de Débito</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              {(metodoPago === "tarjeta_credito" || metodoPago === "tarjeta_debito") && montoPago && !isNaN(Number(montoPago)) ? (
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-800">
                  <p className="font-bold flex justify-between">
                    <span>Recargo por tarjeta ({metodoPago === "tarjeta_credito" ? "8%" : "2%"}):</span>
                    <span>${(Number(montoPago) * (metodoPago === "tarjeta_credito" ? 0.08 : 0.02)).toFixed(2)}</span>
                  </p>
                  <p className="font-extrabold flex justify-between mt-1 text-sm text-[var(--text-primary)]">
                    <span>Total a cobrar al cliente:</span>
                    <span>${(Number(montoPago) * (metodoPago === "tarjeta_credito" ? 1.08 : 1.02)).toFixed(2)}</span>
                  </p>
                </div>
              ) : null}

              {(metodoPago === "transferencia" || metodoPago.includes("tarjeta")) && (
                <div className="form-group">
                  <label className="label">Banco</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Escriba o seleccione banco"
                    value={bancoPago}
                    onChange={(e) => setBancoPago(e.target.value)}
                    list="bancos-list"
                  />
                  <datalist id="bancos-list">
                    <option value="Banco Pichincha" />
                    <option value="Banco Guayaquil" />
                    <option value="Banco del Pacífico" />
                    <option value="Produbanco" />
                    <option value="Banco Bolivariano" />
                    <option value="Banco Internacional" />
                    <option value="Banco del Austro" />
                    <option value="Cooperativa JEP" />
                  </datalist>
                </div>
              )}

              <div className="form-group">
                <label className="label">Referencia / Comprobante</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: #123456"
                  value={referenciaPago}
                  onChange={(e) => setReferenciaPago(e.target.value)}
                  disabled={saldoPendiente <= 0.01}
                />
              </div>

              <div className="form-group">
                <label className="label">Notas (Opcional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Detalles sobre el pago..."
                  value={notasPago}
                  onChange={(e) => setNotasPago(e.target.value)}
                  disabled={saldoPendiente <= 0.01}
                />
              </div>

              <button
                type="button"
                onClick={handleAddPago}
                disabled={savingPago || saldoPendiente <= 0.01}
                className="btn-primary w-full justify-center py-2"
              >
                {savingPago ? <Loader2 size={16} className="animate-spin" /> : "Registrar Pago"}
              </button>

              {/* Payments log */}
              <div className="border-t border-[var(--border)] pt-4">
                <label className="label uppercase text-[10px] tracking-wider mb-2 block font-bold">
                  Historial de Pagos ({pagos.length})
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                  {pagos.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-[var(--border)] text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-800">
                          ${(p.montoBase ?? p.monto).toFixed(2)}
                          {p.recargo ? <span className="text-amber-600 font-semibold text-[10px] ml-1">(+${p.recargo.toFixed(2)} recargo)</span> : null}
                        </p>
                        <p className="text-[10px] text-slate-500 capitalize">
                          {p.metodoPago} {p.banco ? `· Banco: ${p.banco}` : ""} {p.referencia ? `· Ref: ${p.referencia}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeletePago(p.id)}
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {pagos.length === 0 && (
                    <p className="text-center text-xs text-[var(--text-muted)] italic py-2">
                      Sin abonos registrados.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--border)] bg-slate-50 flex justify-end">
              <button
                onClick={() => setIsPagoModalOpen(false)}
                className="btn-secondary text-xs px-4 py-2"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ModalEnviarCorreo */}
      <ModalEnviarCorreo
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        orden={orden}
        cliente={cliente}
        vehiculo={vehiculo}
        items={items}
        pagos={pagos}
        taller={taller}
      />

      {/* ModalFirmas */}
      <ModalFirmas
        isOpen={isFirmasModalOpen}
        onClose={() => setIsFirmasModalOpen(false)}
        onSave={handleSaveFirmas}
        clienteNombre={`${cliente.nombre} ${cliente.apellido}`}
        tecnicoNombre={assignedTechs[0]?.displayName || "Técnico responsable"}
        numeroOrden={String(orden.numeroOrden ?? orden.numero ?? 0).padStart(4, "0")}
        initialFirmaClienteUrl={orden.firmaClienteUrl}
        initialFirmaTecnicoUrl={orden.firmaTecnicoUrl}
      />
    </div>
  );
}
