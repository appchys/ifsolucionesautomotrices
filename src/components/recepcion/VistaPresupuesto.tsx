"use client";
import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { ChevronLeft, Download, Mail, Printer, FileDown, Calendar, Search, Loader2, Plus, MessageSquare, Trash2, MoreHorizontal, MoreVertical, Percent, Check, Phone, Tag, Car, FileText, StickyNote, ClipboardCheck, Paperclip, ExternalLink, Eye, Pencil, Camera, Clock, Wrench, Package, CheckCircle2 } from "lucide-react";
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
  getOrdenVinculadaAPresupuesto,
  convertirPresupuestoAOrden,
  deleteOrden,
  getDatosTaller,
  getLogoAsBase64Png,
  uploadAdjuntoPresupuesto,
  uploadOrdenFoto,
  getCitasByPresupuesto,
  deleteCita,
} from "@/lib/services";
import { OrdenTrabajo, Cliente, Vehiculo, ItemOrden, DatosTaller, DanoVehiculo, FotoDiagnostico, ChecklistItem, Cita } from "@/types";
import { toast } from "react-hot-toast";
import AgregarItemModal from "@/components/ordenes/AgregarItemModal";
import AgregarItemManualModal from "@/components/ordenes/AgregarItemManualModal";
import OpcionesItemPopover from "@/components/ordenes/OpcionesItemPopover";
import ConfigurarTerminosModal from "@/components/configuracion/ConfigurarTerminosModal";
import ModalInspeccion from "./ModalInspeccion";
import ChecklistInventario from "./ChecklistInventario";
import ModalAgendarCita from "./ModalAgendarCita";
import { CHECKLIST_DEFAULT, getMergedChecklist } from "@/lib/checklist";
import { useUIStore } from "@/store";

export default function VistaPresupuesto({ presupuestoId, isSidebar = false }: { presupuestoId: string; isSidebar?: boolean }) {
  const router = useRouter();
  const { setPresupuestoSidebarOpen, setOrdenSidebarOpen } = useUIStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [convertingToOrden, setConvertingToOrden] = useState(false);
  
  const [orden, setOrden] = useState<OrdenTrabajo | null>(null);
  const [ordenVinculada, setOrdenVinculada] = useState<OrdenTrabajo | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [items, setItems] = useState<ItemOrden[]>([]);
  const [activeTab, setActiveTab] = useState("Vehículo");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [taller, setTaller] = useState<DatosTaller | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [activePopoverItemId, setActivePopoverItemId] = useState<string | null>(null);
  const [isConfigTerminosOpen, setIsConfigTerminosOpen] = useState(false);
  const [uploadingAdjunto, setUploadingAdjunto] = useState(false);

  // Inspección & Checklist
  const [isModalInspeccionOpen, setIsModalInspeccionOpen] = useState(false);
  const [inspeccionSubTab, setInspeccionSubTab] = useState<"visual" | "checklist">("visual");
  const [danos, setDanos] = useState<DanoVehiculo[]>([]);
  const [fotos, setFotos] = useState<FotoDiagnostico[]>([]);
  const [inspeccionObservaciones, setInspeccionObservaciones] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(CHECKLIST_DEFAULT);

  // Citas
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loadingCitas, setLoadingCitas] = useState(false);
  const [isModalCitaOpen, setIsModalCitaOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const ordenData = await getOrdenById(presupuestoId);
      
      if (!ordenData) {
        if (isSidebar) {
          setPresupuestoSidebarOpen(false);
        } else {
          toast.error("Presupuesto no encontrado");
          router.push("/presupuestos");
        }
        return;
      }

      setOrden(ordenData);

      const [cData, vData, itemsData, tallerData, citasData, ordenVin] = await Promise.all([
        ordenData.cliente || getClienteById(ordenData.clienteId),
        ordenData.vehiculo || getVehiculoById(ordenData.vehiculoId),
        getItemsOrden(presupuestoId),
        getDatosTaller(),
        getCitasByPresupuesto(presupuestoId),
        getOrdenVinculadaAPresupuesto(ordenData),
      ]);
      setOrdenVinculada(ordenVin);
 
      if (ordenData.esCotizacion) {
        const ingresoOrigen = await getIngresoOrigenDePresupuesto(ordenData);
        if (ingresoOrigen) {
          if (!ordenData.informeTecnico) ordenData.informeTecnico = ingresoOrigen.informeTecnico;
          if (!ordenData.kilometrajeIngreso) ordenData.kilometrajeIngreso = ingresoOrigen.kilometrajeIngreso;
          if (ordenData.motivo?.startsWith("Cotización derivada del ingreso")) {
             ordenData.motivo = ingresoOrigen.motivo;
          }
        }
      }
 
      setCliente(cData);
      setVehiculo(vData);
      setItems(itemsData);
      setTaller(tallerData);

      setDanos(ordenData.inspeccionVisual?.danos || []);
      setFotos(ordenData.fotosDiagnostico || []);
      setInspeccionObservaciones(ordenData.inspeccionVisual?.notasGenerales || "");
      setChecklist(getMergedChecklist(ordenData.checklistInventario));
      setCitas(citasData);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar la información");
    } finally {
      setLoading(false);
    }
  }, [presupuestoId, isSidebar, router, setPresupuestoSidebarOpen]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Actualizar el título de la pestaña con el número de presupuesto
  useEffect(() => {
    if (orden) {
      const numPre = String(orden.numeroCotizacion || orden.numero || 0).padStart(4, "0");
      const originalTitle = document.title;
      document.title = `Presupuesto #PRE-${numPre}`;
      return () => {
        document.title = originalTitle;
      };
    }
  }, [orden]);


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

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    try {
      const toastId = toast.loading("Subiendo foto...");
      const url = await uploadOrdenFoto(presupuestoId, file);
      const nuevasFotos = [...fotos, { url, descripcion: "" }];
      setFotos(nuevasFotos);
      void handleSaveField({ fotosDiagnostico: nuevasFotos });
      toast.success("Foto agregada", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Error al subir foto");
    }
  };

  const handleUpdateFoto = (url: string, descripcion: string) => {
    const nuevasFotos = fotos.map((f) => (f.url === url ? { ...f, descripcion } : f));
    setFotos(nuevasFotos);
    void handleSaveField({ fotosDiagnostico: nuevasFotos });
  };

  const handleRemoveFoto = (index: number) => {
    const nuevasFotos = fotos.filter((_, i) => i !== index);
    setFotos(nuevasFotos);
    void handleSaveField({ fotosDiagnostico: nuevasFotos });
  };

  const handleAddItem = async (itemData: Omit<ItemOrden, "id" | "ordenId" | "subtotal">) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const subtotal = itemData.cantidad * itemData.precioUnitario;
    const itemOptimista: ItemOrden = {
      ...itemData,
      id: tempId,
      ordenId: presupuestoId,
      subtotal,
    };
    
    // Actualización optimista de estado local instantánea
    setItems((prev) => [...prev, itemOptimista]);
    toast.success("Ítem agregado", { duration: 1500 });

    try {
      const { id: _, ...itemPayload } = itemOptimista;
      const realId = await addItemOrden(presupuestoId, itemPayload);
      setItems((prev) =>
        prev.map((it) => (it.id === tempId ? { ...it, id: realId } : it))
      );
    } catch (error) {
      console.error(error);
      setItems((prev) => prev.filter((it) => it.id !== tempId));
      toast.error("Error al agregar ítem");
    }
  };

  const handleDeleteItem = async (itemId?: string) => {
    if (!itemId) return;
    if (!confirm("¿Eliminar este ítem?")) return;
    const itemToDelete = items.find((i) => i.id === itemId);
    if (!itemToDelete) return;

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
      await deleteItemOrden(presupuestoId, itemId);
      setItems(items.filter(i => i.id !== itemId));
      toast.success("Ítem eliminado");
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar");
    }
  };

  const syncExternoItemWithCompra = async (item: ItemOrden, updatedFields: Partial<ItemOrden>) => {
    const finalItem = { ...item, ...updatedFields };
    
    if (finalItem.tipo !== "externo") {
      if (finalItem.compraId) {
        try {
          const { deleteDoc, doc } = await import("firebase/firestore");
          const { db } = await import("@/lib/firebase");
          await deleteDoc(doc(db, "compras", finalItem.compraId));
          await updateItemOrden(presupuestoId, finalItem.id!, {
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
        numeroFactura: `OT-${String(orden?.numeroCotizacion ?? orden?.numero ?? 0).padStart(4, "0")}-${finalItem.id?.slice(-4)}`,
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
        await updateItemOrden(presupuestoId, finalItem.id!, {
          compraId: docRef.id
        });
        setItems(prev => prev.map(i => i.id === finalItem.id ? { ...i, compraId: docRef.id } : i));
      }
    } catch (error) {
      console.error("Error al sincronizar item externo con compra:", error);
    }
  };

  const handleUpdateItemFields = async (itemId: string, updates: Partial<ItemOrden>) => {
    if (!itemId) return;
    try {
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

      await updateItemOrden(presupuestoId, itemId, {
        ...updates,
        subtotal: resolvedItem.subtotal,
      });

      // Sincronizar item externo con compras en segundo plano usando el resolvedItem completo
      void syncExternoItemWithCompra(resolvedItem, {});
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar item");
      void loadData();
    }
  };

  const handleUpdateItem = async (itemId: string, fieldName: keyof ItemOrden, value: any) => {
    await handleUpdateItemFields(itemId, { [fieldName]: value });
  };

  const handleToggleAllIva = async (aplicaIva: boolean) => {
    if (!items || items.length === 0) return;
    const nuevoImpuesto = aplicaIva ? 15 : 0;

    // Actualizar UI inmediatamente (optimistic UI)
    const updatedItems = items.map((it) => ({
      ...it,
      impuestoAplicable: nuevoImpuesto,
      subtotal: Number((it.cantidad * it.precioUnitario).toFixed(2)),
    }));
    setItems(updatedItems);

    const toastId = toast.loading(aplicaIva ? "Aplicando IVA a todos los productos..." : "Quitando IVA a todos los productos...");

    try {
      await Promise.all(
        items.map((it) =>
          it.id
            ? updateItemOrden(presupuestoId, it.id, {
                impuestoAplicable: nuevoImpuesto,
                subtotal: Number((it.cantidad * it.precioUnitario).toFixed(2)),
              })
            : Promise.resolve()
        )
      );
      toast.success(
        aplicaIva ? "IVA (15%) aplicado a todos los productos" : "IVA removido de todos los productos",
        { id: toastId }
      );
    } catch (err) {
      console.error("Error al actualizar IVA masivo:", err);
      toast.error("Error al actualizar IVA masivo", { id: toastId });
      void loadData();
    }
  };

  const handleDownloadPDF = async () => {
    if (!orden || !cliente || !vehiculo) return;
    setGeneratingPdf(true);
    const toastId = toast.loading("Generando PDF...");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const PresupuestoPDF = (await import("./PresupuestoPDF")).default;

      let tallerConLogo = taller;
      if (taller?.logoUrl) {
        const logoBase64 = await getLogoAsBase64Png(taller.logoUrl);
        if (logoBase64) tallerConLogo = { ...taller, logoUrl: logoBase64 };
      }

      const blob = await pdf(
        <PresupuestoPDF
          orden={orden}
          cliente={cliente}
          vehiculo={vehiculo}
          items={items}
          taller={tallerConLogo}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const numPre = String(orden.numeroCotizacion || orden.numero || 0).padStart(4, "0");
      link.download = `presupuesto_${numPre}.pdf`;
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

  const handlePrintPDF = async () => {
    if (!orden || !cliente || !vehiculo) return;
    setGeneratingPdf(true);
    const toastId = toast.loading("Preparando impresión...");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const PresupuestoPDF = (await import("./PresupuestoPDF")).default;

      let tallerConLogo = taller;
      if (taller?.logoUrl) {
        const logoBase64 = await getLogoAsBase64Png(taller.logoUrl);
        if (logoBase64) tallerConLogo = { ...taller, logoUrl: logoBase64 };
      }

      const blob = await pdf(
        <PresupuestoPDF
          orden={orden}
          cliente={cliente}
          vehiculo={vehiculo}
          items={items}
          taller={tallerConLogo}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.visibility = "hidden";

      const cleanup = () => {
        try {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          URL.revokeObjectURL(url);
        } catch (e) {}
      };

      iframe.onload = () => {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.onafterprint = cleanup;
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          }
        } catch (e) {
          console.error("Error al ejecutar impresión:", e);
        }
        setTimeout(cleanup, 120000);
      };

      iframe.src = url;
      document.body.appendChild(iframe);
      
      toast.success("Ventana de impresión abierta", { id: toastId });
    } catch (error) {
      console.error("Error al preparar impresión:", error);
      toast.error("Error al preparar el PDF para impresión", { id: toastId });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleCrearOrden = async () => {
    if (!orden) return;
    const confirmed = window.confirm("¿Deseas crear una Orden de Trabajo a partir de este presupuesto?");
    if (!confirmed) return;

    setConvertingToOrden(true);
    const toastId = toast.loading("Creando Orden de Trabajo...");
    try {
      const ordenIdResult = await convertirPresupuestoAOrden(presupuestoId);
      toast.success("Orden de Trabajo creada con éxito", { id: toastId });

      if (isSidebar) {
        setPresupuestoSidebarOpen(false);
        setOrdenSidebarOpen(true, ordenIdResult);
      } else {
        router.push(`/ordenes?id=${ordenIdResult}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al crear la orden de trabajo", { id: toastId });
    } finally {
      setConvertingToOrden(false);
    }
  };

  const handleAprobar = async () => {
    if (!orden) return;
    if (confirm("¿Estás seguro de aprobar este presupuesto?")) {
      setSaving(true);
      try {
        await updateOrden(presupuestoId, { estado: "En Reparación", presupuestoConfirmadoPorCliente: true });
        setOrden({ ...orden, estado: "En Reparación", presupuestoConfirmadoPorCliente: true });
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
      if (isSidebar) {
        setPresupuestoSidebarOpen(false);
      } else {
        router.push("/presupuestos");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar el presupuesto", { id: toastId });
      setSaving(false);
    } finally {
      setIsMenuOpen(false);
    }
  };

  if (loading || !orden || !cliente || !vehiculo) {
    if (isSidebar) {
      return (
        <div className="flex items-center justify-center h-full p-6 bg-slate-50">
          <Loader2 size={32} className="animate-spin text-blue-500" />
        </div>
      );
    }
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

  const mainContent = (
    <div className={`flex flex-col overflow-hidden ${isSidebar ? "h-full bg-slate-50" : ""}`} style={isSidebar ? undefined : { height: "calc(100vh - 8.5rem)" }}>
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-2 mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          {!isSidebar ? (
            <button 
              onClick={() => router.back()} 
              className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors border-none bg-transparent cursor-pointer text-inherit flex items-center justify-center"
              title="Volver"
            >
              <ChevronLeft size={20} />
            </button>
          ) : (
            <button 
              onClick={() => setPresupuestoSidebarOpen(false)} 
              className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors border-none bg-transparent cursor-pointer text-inherit flex items-center justify-center"
              title="Cerrar panel"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <h1 className="text-xl font-bold flex items-center gap-1.5">
            Presupuesto <span className="text-blue-600 font-mono">#PRE-{String(orden.numeroCotizacion || orden.numero || 0).padStart(4, "0")}</span>
          </h1>
          {!isSidebar && (
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] bg-slate-100 px-3 py-1.5 rounded-lg border border-[var(--border)]">
               <span>Creación</span>
               <span className="font-semibold text-[var(--text-primary)]">
                 {orden.createdAt ? new Date(orden.createdAt.toMillis()).toLocaleDateString('es-ES') : "N/A"}
               </span>
               <Calendar size={14} className="ml-1" />
            </div>
          )}
          {saving && <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" />}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Actions icons */}
          <div className="flex items-center gap-1 text-[var(--text-secondary)]">
            <button 
              type="button"
              className="p-1 text-slate-700 hover:text-blue-600 disabled:opacity-50 bg-transparent border-0 cursor-pointer" 
              onClick={handlePrintPDF}
              disabled={generatingPdf || loading}
              title="Imprimir"
            >
              {generatingPdf ? (
                <Loader2 size={16} className="animate-spin text-blue-600" />
              ) : (
                <Printer size={16} />
              )}
            </button>
            <button 
              type="button"
              className="p-1 text-slate-700 hover:text-blue-600 disabled:opacity-50 bg-transparent border-0 cursor-pointer"
              onClick={handleDownloadPDF}
              disabled={generatingPdf || loading}
              title="Descargar PDF"
            >
              {generatingPdf ? (
                <Loader2 size={16} className="animate-spin text-blue-600" />
              ) : (
                <FileDown size={16} />
              )}
            </button>
          </div>
          <button className="btn bg-white border border-[var(--border)] shadow-sm font-semibold px-3.5 py-1.5 text-xs flex items-center gap-1.5">
             <Mail size={14} /> Solicitar
          </button>
          <button 
            className="btn-primary bg-green-500 hover:bg-green-600 border-none shadow disabled:opacity-50 px-3.5 py-1.5 text-xs flex items-center gap-1.5"
            onClick={handleAprobar}
            disabled={saving || orden.presupuestoConfirmadoPorCliente}
          >
             {saving ? <Loader2 size={12} className="animate-spin" /> : orden.presupuestoConfirmadoPorCliente ? <><Check size={12} /> Aprobado</> : <><Check size={12} /> Aprobar</>}
          </button>
          {ordenVinculada || orden.esCotizacion === false ? (
            <button 
              type="button"
              className="btn bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm font-semibold px-3.5 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer rounded-lg transition-colors"
              onClick={() => {
                const targetId = ordenVinculada?.id || orden.id!;
                if (isSidebar) {
                  setPresupuestoSidebarOpen(false);
                  setOrdenSidebarOpen(true, targetId);
                } else {
                  router.push(`/ordenes?id=${targetId}`);
                }
              }}
            >
              <CheckCircle2 size={13} className="text-emerald-600" />
              Ver Orden #OT-{String((ordenVinculada?.numeroOrden ?? ordenVinculada?.numero ?? orden.numeroOrden ?? orden.numero) || 0).padStart(4, "0")}
            </button>
          ) : (
            <button 
              type="button"
              className="btn-primary bg-blue-600 hover:bg-blue-700 border-none text-white shadow disabled:opacity-50 px-3.5 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer font-semibold rounded-lg"
              onClick={handleCrearOrden}
              disabled={convertingToOrden || saving}
              title="Crear Orden de Trabajo a partir de este presupuesto"
            >
              {convertingToOrden ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Wrench size={13} />
              )}
              Crear Orden
            </button>
          )}
          <div className="relative">
            <button 
              type="button"
              className="btn bg-white border border-[var(--border)] shadow-sm hover:bg-[var(--bg-hover)] btn-icon h-8 w-8 justify-center"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="Más acciones"
            >
              <MoreHorizontal size={14} />
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-48 bg-white border border-[var(--border)] rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                  {ordenVinculada || orden.esCotizacion === false ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        const targetId = ordenVinculada?.id || orden.id!;
                        if (isSidebar) {
                          setPresupuestoSidebarOpen(false);
                          setOrdenSidebarOpen(true, targetId);
                        } else {
                          router.push(`/ordenes?id=${targetId}`);
                        }
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 border-0 bg-transparent cursor-pointer font-inherit"
                    >
                      <Eye size={12} />
                      Ver Orden #OT-{String((ordenVinculada?.numeroOrden ?? ordenVinculada?.numero ?? orden.numeroOrden ?? orden.numero) || 0).padStart(4, "0")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        void handleCrearOrden();
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-2 border-0 bg-transparent cursor-pointer font-inherit"
                    >
                      <Wrench size={12} />
                      Crear Orden de Trabajo
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleEliminarPresupuesto}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 border-0 bg-transparent cursor-pointer font-inherit"
                  >
                    <Trash2 size={12} />
                    Eliminar presupuesto
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Columns Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-y-auto lg:overflow-hidden px-6 pb-4 custom-scrollbar lg:custom-scrollbar-none">
        
        {/* Left Column: Items */}
        <div className="w-full lg:flex-1 flex flex-col gap-4 lg:overflow-y-auto pr-2 custom-scrollbar lg:border-r lg:border-[var(--border)]">
            {/* Client Card */}
            <div className="flex gap-4 items-center mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0 uppercase">
                {(cliente.nombre?.[0] || "")}
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm uppercase">{cliente.nombre} {cliente.apellido}</p>
                <p className="text-xs text-[var(--text-muted)] flex items-center gap-1"><Phone size={12} className="text-slate-400" /> {cliente.telefono}</p>
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
                type="button"
                className="btn-primary bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center gap-2"
                onClick={() => setIsCatalogOpen(true)}
              >
                <Search size={16} /> Catálogo
              </button>
              <button 
                type="button"
                className="btn bg-white hover:bg-slate-50 border border-[var(--border)] shadow-sm flex items-center gap-2 text-slate-700 hover:text-blue-700 font-semibold cursor-pointer"
                onClick={() => setIsManualModalOpen(true)}
                title="Agregar producto o servicio creado manualmente"
              >
                <Plus size={16} className="text-blue-600" /> Manual
              </button>
            </div>

            {/* Items Header & Batch IVA Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Productos / Servicios ({items.length})
              </span>
              {items.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleAllIva(true)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Aplicar IVA (15%) a todos los productos"
                  >
                    <Percent size={13} />
                    Con IVA a todos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAllIva(false)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Quitar IVA (0%) a todos los productos"
                  >
                    <Percent size={13} className="opacity-40" />
                    Sin IVA a todos
                  </button>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="border border-[var(--border)] rounded-xl bg-white overflow-visible">
              <div className="overflow-visible">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)] p-8 text-center">
                    <p className="text-sm">No hay ítems en el presupuesto.</p>
                    <p className="text-xs">Busca un producto o servicio arriba para agregarlo.</p>
                  </div>
                ) : (
                  <>
                    {/* Sección Mano de obra */}
                    {items.filter((it) => it.tipo === "servicio").length > 0 && (
                      <div>
                        <div className="grid grid-cols-12 gap-2 p-3 text-xs font-bold uppercase tracking-wider bg-slate-100/90 border-b border-[var(--border)] items-center">
                          <div className="col-span-4 flex items-center gap-1.5 text-slate-800 font-extrabold">
                            <Wrench size={14} className="text-blue-600" />
                            Mano de obra
                          </div>
                          <div className="col-span-2 text-center text-slate-500">Cant</div>
                          <div className="col-span-2 text-right text-slate-500">Precio</div>
                          <div className="col-span-1 text-center text-slate-500">IVA</div>
                          <div className="col-span-1 text-center text-slate-500">Dcto</div>
                          <div className="col-span-2 text-right text-slate-500">Total</div>
                        </div>
                        {items.filter((it) => it.tipo === "servicio").map((item) => {
                          const idx = items.findIndex((it) => (it.id && it.id === item.id) || it === item);
                          return (
                            <div key={item.id || idx} className="grid grid-cols-12 gap-2 p-3 text-sm border-b border-[var(--border)] items-center hover:bg-slate-50">
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
                                    if (idx !== -1) {
                                      newItems[idx].cantidad = Number(e.target.value);
                                      setItems(newItems);
                                    }
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
                                    if (idx !== -1) {
                                      newItems[idx].precioUnitario = Number(e.target.value);
                                      setItems(newItems);
                                    }
                                  }}
                                  onBlur={(e) => handleUpdateItem(item.id!, "precioUnitario", Number(e.target.value))}
                                />
                              </div>
                              <div className="col-span-1 text-center text-xs">{item.impuestoAplicable > 0 ? `${item.impuestoAplicable}%` : '0%'}</div>
                              <div className="col-span-1 text-center text-xs">0</div>
                              <div className="col-span-2 text-right font-bold flex items-center justify-end gap-2 relative">
                                ${(item.precioUnitario * item.cantidad).toFixed(2)}
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
                                  className="text-[var(--text-muted)] hover:text-red-500 p-1 rounded-md cursor-pointer hover:bg-slate-100 flex items-center justify-center"
                                  title="Eliminar ítem"
                                >
                                  <Trash2 size={14} />
                                </button>

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
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Sección Repuestos */}
                    {items.filter((it) => it.tipo !== "servicio").length > 0 && (
                      <div>
                        <div className="grid grid-cols-12 gap-2 p-3 text-xs font-bold uppercase tracking-wider bg-slate-100/90 border-b border-[var(--border)] items-center">
                          <div className="col-span-4 flex items-center gap-1.5 text-slate-800 font-extrabold">
                            <Package size={14} className="text-amber-600" />
                            Repuestos
                          </div>
                          <div className="col-span-2 text-center text-slate-500">Cant</div>
                          <div className="col-span-2 text-right text-slate-500">Precio</div>
                          <div className="col-span-1 text-center text-slate-500">IVA</div>
                          <div className="col-span-1 text-center text-slate-500">Dcto</div>
                          <div className="col-span-2 text-right text-slate-500">Total</div>
                        </div>
                        {items.filter((it) => it.tipo !== "servicio").map((item) => {
                          const idx = items.findIndex((it) => (it.id && it.id === item.id) || it === item);
                          return (
                            <div key={item.id || idx} className="grid grid-cols-12 gap-2 p-3 text-sm border-b border-[var(--border)] items-center hover:bg-slate-50">
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
                                    if (idx !== -1) {
                                      newItems[idx].cantidad = Number(e.target.value);
                                      setItems(newItems);
                                    }
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
                                    if (idx !== -1) {
                                      newItems[idx].precioUnitario = Number(e.target.value);
                                      setItems(newItems);
                                    }
                                  }}
                                  onBlur={(e) => handleUpdateItem(item.id!, "precioUnitario", Number(e.target.value))}
                                />
                              </div>
                              <div className="col-span-1 text-center text-xs">{item.impuestoAplicable > 0 ? `${item.impuestoAplicable}%` : '0%'}</div>
                              <div className="col-span-1 text-center text-xs">0</div>
                              <div className="col-span-2 text-right font-bold flex items-center justify-end gap-2 relative">
                                ${(item.precioUnitario * item.cantidad).toFixed(2)}
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
                                  className="text-[var(--text-muted)] hover:text-red-500 p-1 rounded-md cursor-pointer hover:bg-slate-100 flex items-center justify-center"
                                  title="Eliminar ítem"
                                >
                                  <Trash2 size={14} />
                                </button>

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
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Totals */}
              <div className="bg-slate-50 border-t border-[var(--border)] p-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-[var(--text-muted)] uppercase">Subtotal</span>
                      <span className="font-bold">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <button className="text-blue-600 hover:underline flex items-center gap-1 text-xs border-0 bg-transparent cursor-pointer">
                        <Tag size={12} /> Aplicar descuento
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
        <div className="w-full lg:w-[340px] flex flex-col lg:overflow-hidden pb-4 lg:shrink-0 pt-4 border-t border-[var(--border)] lg:pt-0 lg:border-t-0">
            
            {/* Tabs */}
            <div className="flex border-b border-[var(--border)] mb-4 overflow-x-auto custom-scrollbar shrink-0 justify-between items-center px-1">
              {[
                { id: "Vehículo", label: "Vehículo", icon: Car },
                { id: "Condiciones", label: "Condiciones", icon: FileText },
                { id: "Notas", label: "Notas", icon: StickyNote },
                { id: "Inspección", label: "Inspección", icon: ClipboardCheck },
                { id: "Citas", label: "Citas", icon: Calendar },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`flex flex-col items-center justify-center px-2 py-1.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                      isActive
                        ? "border-blue-600 text-blue-600 font-bold"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon size={18} className="mb-0.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
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

              {activeTab === "Condiciones" && (
                <div className="space-y-4 py-1">
                  {/* TÉRMINOS Y CONDICIONES */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                      TÉRMINOS Y CONDICIONES
                    </label>
                    <textarea
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[90px] text-slate-800 resize-y"
                      placeholder="Términos, garantía, condiciones de pago..."
                      value={orden.terminosYCondiciones || ""}
                      onChange={(e) => setOrden({ ...orden, terminosYCondiciones: e.target.value })}
                      onBlur={() => handleSaveField({ terminosYCondiciones: orden.terminosYCondiciones || "" })}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                          checked={orden.usarTerminosPredeterminados ?? true}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const defaultText = taller?.terminosPredeterminados || "Los trabajos realizados tienen una garantía de 3 meses. El cliente debe retirar el vehículo dentro de los 5 días hábiles posteriores a la notificación de término.";
                            const newTerminos = checked ? (orden.terminosYCondiciones || defaultText) : orden.terminosYCondiciones;
                            setOrden({ ...orden, usarTerminosPredeterminados: checked, terminosYCondiciones: newTerminos });
                            void handleSaveField({ usarTerminosPredeterminados: checked, terminosYCondiciones: newTerminos || "" });
                          }}
                        />
                        <span className="text-xs text-slate-700 font-medium">Usar términos predeterminados</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsConfigTerminosOpen(true)}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-semibold bg-transparent border-0 cursor-pointer p-0"
                      >
                        Configurar términos
                      </button>
                    </div>
                  </div>

                  {/* TIEMPO ESTIMADO EN REPARACIÓN */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                      TIEMPO ESTIMADO EN REPARACIÓN
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800"
                        placeholder="Ej: 2"
                        value={orden.tiempoEstimadoReparacion || ""}
                        onChange={(e) => setOrden({ ...orden, tiempoEstimadoReparacion: e.target.value })}
                        onBlur={() => handleSaveField({ tiempoEstimadoReparacion: orden.tiempoEstimadoReparacion || "" })}
                      />
                      <select
                        className="w-28 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800 cursor-pointer"
                        value={orden.unidadTiempoEstimado || "Días"}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOrden({ ...orden, unidadTiempoEstimado: val });
                          void handleSaveField({ unidadTiempoEstimado: val });
                        }}
                      >
                        <option value="Días">Días</option>
                        <option value="Horas">Horas</option>
                        <option value="Semanas">Semanas</option>
                        <option value="Meses">Meses</option>
                      </select>
                    </div>
                  </div>

                  {/* VALIDEZ DEL PRESUPUESTO */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                      VALIDEZ DEL PRESUPUESTO
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800"
                        placeholder="Ej: 30"
                        value={orden.validezPresupuesto || ""}
                        onChange={(e) => setOrden({ ...orden, validezPresupuesto: e.target.value })}
                        onBlur={() => handleSaveField({ validezPresupuesto: orden.validezPresupuesto || "" })}
                      />
                      <select
                        className="w-28 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800 cursor-pointer"
                        value={orden.unidadValidezPresupuesto || "Días"}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOrden({ ...orden, unidadValidezPresupuesto: val });
                          void handleSaveField({ unidadValidezPresupuesto: val });
                        }}
                      >
                        <option value="Días">Días</option>
                        <option value="Horas">Horas</option>
                        <option value="Semanas">Semanas</option>
                      </select>
                    </div>
                  </div>

                  {/* FORMAS DE PAGO DISPONIBLES */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                      FORMAS DE PAGO DISPONIBLES
                    </label>
                    <div className="space-y-2">
                      {["Cheque", "Efectivo", "Tarjeta de crédito", "Tarjeta de débito", "Transferencia"].map((metodo) => {
                        const formasActuales = orden.formasPagoDisponibles || [];
                        const isChecked = formasActuales.includes(metodo);
                        return (
                          <label key={metodo} className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                              checked={isChecked}
                              onChange={(e) => {
                                let nuevasFormas: string[];
                                if (e.target.checked) {
                                  nuevasFormas = [...formasActuales, metodo];
                                } else {
                                  nuevasFormas = formasActuales.filter((f) => f !== metodo);
                                }
                                setOrden({ ...orden, formasPagoDisponibles: nuevasFormas });
                                void handleSaveField({ formasPagoDisponibles: nuevasFormas });
                              }}
                            />
                            <span className="text-xs font-semibold text-slate-800">{metodo}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* OBSERVACIÓN DE FORMA DE PAGO */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                      OBSERVACIÓN DE FORMA DE PAGO
                    </label>
                    <textarea
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[70px] text-slate-800 resize-y"
                      placeholder="Ej: Se requiere 50% adelanto..."
                      value={orden.observacionFormaPago || ""}
                      onChange={(e) => setOrden({ ...orden, observacionFormaPago: e.target.value })}
                      onBlur={() => handleSaveField({ observacionFormaPago: orden.observacionFormaPago || "" })}
                    />
                  </div>
                </div>
              )}

              {activeTab === "Notas" && (
                <div className="space-y-6 py-1">
                  {/* NOTAS INTERNAS */}
                  <div>
                    <h3 className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block mb-0.5">
                      NOTAS INTERNAS
                    </h3>
                    <p className="text-xs text-slate-500 mb-2">
                      No se imprimen en el PDF, solo las ve tu equipo.
                    </p>
                    <textarea
                      className="w-full bg-[#fefcf3] border border-amber-200/90 rounded-xl p-3 text-xs sm:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none min-h-[140px] resize-y shadow-sm transition-all placeholder:text-slate-400"
                      placeholder="Escribe notas o recordatorios internos sobre este presupuesto..."
                      value={orden.notasInternas || ""}
                      onChange={(e) => setOrden({ ...orden, notasInternas: e.target.value })}
                      onBlur={() => handleSaveField({ notasInternas: orden.notasInternas || "" })}
                    />
                  </div>

                  {/* ADJUNTOS DE NOTAS */}
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Paperclip size={14} className="text-blue-600" />
                        ADJUNTOS
                      </h3>
                      <label className="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors flex items-center gap-1.5">
                        {uploadingAdjunto ? (
                          <Loader2 size={13} className="animate-spin text-blue-600" />
                        ) : (
                          <Plus size={13} />
                        )}
                        <span>{uploadingAdjunto ? "Subiendo..." : "Subir adjunto"}</span>
                        <input
                          type="file"
                          className="sr-only"
                          disabled={uploadingAdjunto}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file || !orden?.id) return;

                            setUploadingAdjunto(true);
                            const toastId = toast.loading("Subiendo archivo adjunto...");
                            try {
                              const nuevoAdjunto = await uploadAdjuntoPresupuesto(presupuestoId, file);
                              const adjuntosActuales = orden.adjuntos || [];
                              const nuevosAdjuntos = [...adjuntosActuales, nuevoAdjunto];

                              setOrden({ ...orden, adjuntos: nuevosAdjuntos });
                              await handleSaveField({ adjuntos: nuevosAdjuntos });
                              toast.success("Archivo subido con éxito", { id: toastId });
                            } catch (err) {
                              console.error(err);
                              toast.error("Error al subir archivo adjunto", { id: toastId });
                            } finally {
                              setUploadingAdjunto(false);
                            }
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">
                      Archivos o imágenes adjuntas a esta cotización.
                    </p>

                    {/* Lista de adjuntos */}
                    {(!orden.adjuntos || orden.adjuntos.length === 0) ? (
                      <div className="flex flex-col items-center justify-center p-5 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-center">
                        <Paperclip size={24} className="text-slate-300 mb-1.5" />
                        <p className="text-xs font-medium text-slate-500">No hay archivos adjuntos</p>
                        <p className="text-[11px] text-slate-400">Haz clic en &quot;Subir adjunto&quot; para agregar archivos o fotos.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {orden.adjuntos.map((adj) => (
                          <div
                            key={adj.id}
                            className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors shadow-2xs"
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden flex-1 mr-2">
                              {adj.tipo === "imagen" ? (
                                <img
                                  src={adj.url}
                                  alt={adj.nombre}
                                  className="w-9 h-9 object-cover rounded-lg border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 font-bold text-xs uppercase">
                                  {adj.nombre.split('.').pop()?.substring(0, 4) || "DOC"}
                                </div>
                              )}
                              <div className="flex-1 truncate">
                                <p className="text-xs font-semibold text-slate-800 truncate" title={adj.nombre}>
                                  {adj.nombre}
                                </p>
                                {adj.tamano ? (
                                  <p className="text-[10px] text-slate-400">
                                    {(adj.tamano / 1024).toFixed(1)} KB
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <a
                                href={adj.url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Abrir / Descargar"
                              >
                                <ExternalLink size={14} />
                              </a>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!confirm("¿Eliminar este archivo adjunto?")) return;
                                  const nuevosAdjuntos = (orden.adjuntos || []).filter((a) => a.id !== adj.id);
                                  setOrden({ ...orden, adjuntos: nuevosAdjuntos });
                                  await handleSaveField({ adjuntos: nuevosAdjuntos });
                                  toast.success("Adjunto eliminado");
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border-0 bg-transparent cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "Inspección" && (
                <div className="space-y-4 py-1">
                  {/* Sub-pestañas: Inspección Visual vs Checklist */}
                  <div className="flex border border-slate-200 bg-slate-100/70 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setInspeccionSubTab("visual")}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer border-0 ${
                        inspeccionSubTab === "visual"
                          ? "bg-white text-blue-600 shadow-xs"
                          : "text-slate-500 hover:text-slate-700 bg-transparent"
                      }`}
                    >
                      <Eye size={14} />
                      Inspección Visual ({danos.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspeccionSubTab("checklist")}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer border-0 ${
                        inspeccionSubTab === "checklist"
                          ? "bg-white text-blue-600 shadow-xs"
                          : "text-slate-500 hover:text-slate-700 bg-transparent"
                      }`}
                    >
                      <ClipboardCheck size={14} />
                      Checklist ({checklist.filter((c) => c.checked).length}/{checklist.length})
                    </button>
                  </div>

                  {/* Inspección Visual */}
                  {inspeccionSubTab === "visual" && (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Eye size={14} className="text-blue-600" />
                            Inspección Visual de Daños
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Marcar daños gráficos en las 5 vistas del vehículo y fotos.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsModalInspeccionOpen(true)}
                          className="btn-primary text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer border-0"
                        >
                          <Pencil size={13} />
                          {danos.length > 0 ? "Ver / Editar" : "+ Registrar"}
                        </button>
                      </div>

                      {danos.length === 0 ? (
                        <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                          <p className="text-xs text-slate-500">No se han registrado daños visuales aún.</p>
                          <button
                            type="button"
                            onClick={() => setIsModalInspeccionOpen(true)}
                            className="text-xs text-blue-600 hover:underline font-semibold mt-1 inline-block border-0 bg-transparent cursor-pointer"
                          >
                            Abrir editor de inspección visual
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {danos.map((d, i) => (
                              <span
                                key={d.id || i}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                              >
                                <span className="capitalize">{d.tipo}</span>
                                {d.vista ? <span className="opacity-70">({d.vista})</span> : null}
                              </span>
                            ))}
                          </div>
                          {fotos.length > 0 ? (
                            <p className="text-xs text-slate-500 flex items-center gap-1 pt-1">
                              <Camera size={13} className="text-blue-500" />
                              {fotos.length} foto(s) de diagnóstico guardada(s)
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Checklist de Inventario */}
                  {inspeccionSubTab === "checklist" && (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <ClipboardCheck size={14} className="text-blue-600" />
                          Checklist de Inventario del Vehículo
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Selecciona los accesorios y objetos presentes en el vehículo.
                        </p>
                      </div>
                      <ChecklistInventario
                        items={checklist}
                        onChange={(updated) => {
                          setChecklist(updated);
                          void handleSaveField({ checklistInventario: updated });
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {activeTab === "Citas" && (
                <div className="space-y-4 py-1">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar size={14} className="text-blue-600" />
                          Citas Agendadas
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Agenda reuniones, entregas o revisiones vinculadas a este presupuesto.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsModalCitaOpen(true)}
                        className="btn-primary text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer border-0 text-white font-bold"
                      >
                        <Plus size={13} />
                        Agendar cita
                      </button>
                    </div>

                    {loadingCitas ? (
                      <div className="flex items-center justify-center py-8 text-slate-400 gap-2 text-xs">
                        <Loader2 size={16} className="animate-spin text-blue-600" />
                        Cargando citas...
                      </div>
                    ) : citas.length === 0 ? (
                      <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
                        <Calendar size={32} className="text-slate-300 mx-auto" />
                        <p className="text-xs font-semibold text-slate-700">No hay citas agendadas</p>
                        <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                          Crea una cita para coordinar el ingreso o entrega del vehículo con el cliente.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsModalCitaOpen(true)}
                          className="text-xs text-blue-600 hover:underline font-bold inline-flex items-center gap-1 mt-1 border-0 bg-transparent cursor-pointer"
                        >
                          <Plus size={13} />
                          Agendar cita ahora
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {citas.map((c) => (
                          <div
                            key={c.id}
                            className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col gap-2 hover:border-slate-300 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h5 className="font-bold text-xs text-slate-800 truncate">{c.titulo}</h5>
                                {c.descripcion && (
                                  <p className="text-[11px] text-slate-600 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    {c.descripcion}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                                  {c.estado || "Agendada"}
                                </span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!c.id) return;
                                    if (!confirm("¿Deseas eliminar esta cita agendada?")) return;
                                    await deleteCita(c.id);
                                    setCitas((prev) => prev.filter((item) => item.id !== c.id));
                                    toast.success("Cita eliminada");
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border-0 bg-transparent cursor-pointer"
                                  title="Eliminar cita"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-500 border-t border-slate-100">
                              <div className="flex items-center gap-1">
                                <Calendar size={13} className="text-blue-500" />
                                <span className="font-semibold text-slate-700">{c.fecha}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock size={13} className="text-blue-500" />
                                <span>
                                  {c.horaInicio} - {c.horaFin}
                                </span>
                              </div>
                              {c.agenda && (
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-medium text-slate-600">
                                  {c.agenda}
                                </span>
                              )}
                              {c.asignadoANombre && (
                                <span className="text-slate-600 font-medium">
                                  Asignado a: <strong className="text-slate-700">{c.asignadoANombre}</strong>
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab !== "Vehículo" && activeTab !== "Condiciones" && activeTab !== "Notas" && activeTab !== "Inspección" && activeTab !== "Citas" && (
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
              <button 
                type="button"
                className="btn bg-white border border-[var(--border)] shadow-sm flex items-center gap-2 text-slate-700 hover:text-blue-600"
                onClick={handleDownloadPDF}
                disabled={generatingPdf || loading}
              >
                {generatingPdf ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} PDF
              </button>
              <button 
                type="button"
                className="btn-primary bg-blue-700 hover:bg-blue-800 border-none shadow flex items-center gap-2 disabled:opacity-50"
                onClick={handlePrintPDF}
                disabled={generatingPdf || loading}
              >
                {generatingPdf ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} Imprimir
              </button>
            </div>

        </div>
      </div>

    </div>
  );

  const modales = (
    <>
      {isCatalogOpen && (
        <AgregarItemModal 
          onClose={() => setIsCatalogOpen(false)}
          onAdd={handleAddItem}
        />
      )}
      {isManualModalOpen && (
        <AgregarItemManualModal
          onClose={() => setIsManualModalOpen(false)}
          onAdd={handleAddItem}
        />
      )}
      {isConfigTerminosOpen && (
        <ConfigurarTerminosModal
          onClose={() => setIsConfigTerminosOpen(false)}
          onSaved={(nuevosTerminos) => {
            setTaller((prev) => prev ? { ...prev, terminosPredeterminados: nuevosTerminos } : prev);
            if (orden?.usarTerminosPredeterminados ?? true) {
              setOrden((prev) => prev ? { ...prev, terminosYCondiciones: nuevosTerminos } : prev);
              void handleSaveField({ terminosYCondiciones: nuevosTerminos });
            }
          }}
        />
      )}
      {isModalInspeccionOpen && vehiculo && (
        <ModalInspeccion
          isOpen={isModalInspeccionOpen}
          onClose={() => setIsModalInspeccionOpen(false)}
          vehiculo={vehiculo}
          danos={danos}
          onChangeDanos={(nuevosDanos) => {
            setDanos(nuevosDanos);
            void handleSaveField({
              inspeccionVisual: { danos: nuevosDanos, notasGenerales: inspeccionObservaciones },
            });
          }}
          onSave={() => {
            void handleSaveField({
              inspeccionVisual: { danos, notasGenerales: inspeccionObservaciones },
              fotosDiagnostico: fotos,
            });
            toast.success("Inspección guardada");
          }}
          fotos={fotos}
          onUploadFoto={handleUploadFoto}
          onUpdateFoto={handleUpdateFoto}
          onRemoveFoto={handleRemoveFoto}
          observaciones={inspeccionObservaciones}
          onChangeObservaciones={(val) => setInspeccionObservaciones(val)}
        />
      )}
      {isModalCitaOpen && cliente && vehiculo && (
        <ModalAgendarCita
          isOpen={isModalCitaOpen}
          onClose={() => setIsModalCitaOpen(false)}
          presupuestoId={presupuestoId}
          numeroPresupuesto={orden?.numeroCotizacion || orden?.numero || 0}
          cliente={cliente}
          vehiculo={vehiculo}
          motivoInicial={orden?.motivo}
          onCitaCreada={(nuevaCita) => {
            setCitas((prev) => [...prev, nuevaCita]);
          }}
        />
      )}
    </>
  );

  if (isSidebar) {
    return (
      <>
        {mainContent}
        {modales}
      </>
    );
  }

  return (
    <AppShell>
      {mainContent}
      {modales}
    </AppShell>
  );
}
