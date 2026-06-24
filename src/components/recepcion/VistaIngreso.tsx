"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { ChevronLeft, ChevronDown, ChevronUp, Download, Mail, MoreHorizontal, Printer, FileDown, Loader2, Camera, Trash2, Car, User, Plus, X, Search, Users, Eye, PenTool, ClipboardSignature, Edit, LogOut, MessageSquare, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  getOrdenById, 
  getClienteById, 
  getVehiculoById, 
  getUsuarios, 
  updateOrden,
  uploadOrdenFoto,
  convertirIngresoAOrden,
  deleteOrden,
  getPresupuestoPorIngreso,
  getDatosTaller,
  sendMensajeOrden
} from "@/lib/services";
import { OrdenTrabajo, Cliente, Vehiculo, AppUser, NivelCombustible, ChecklistItem, FotoDiagnostico, DatosTaller } from "@/types";
import { useAuthStore } from "@/store";
import { toast } from "react-hot-toast";
import { createOrdenConItems } from "@/lib/services";
import ModalInspeccion from "./ModalInspeccion";
import ModalFirmaCliente from "./ModalFirmaCliente";
import ClienteModal from "@/components/clientes/ClienteModal";
import VehiculoModal from "@/components/vehiculos/VehiculoModal";
import { CHECKLIST_DEFAULT, getMergedChecklist } from "@/lib/checklist";
import ChatOrden from "@/components/ordenes/ChatOrden";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

const NIVELES_COMBUSTIBLE: { label: string; value: NivelCombustible; color: string }[] = [
  { label: "E", value: "Vacío", color: "bg-red-500 text-white" },
  { label: "1/4", value: "1/4", color: "bg-orange-400 text-white" },
  { label: "1/2", value: "1/2", color: "bg-yellow-400 text-slate-900" },
  { label: "3/4", value: "3/4", color: "bg-emerald-400 text-white" },
  { label: "F", value: "Lleno", color: "bg-emerald-600 text-white" },
];

const AVATAR_COLORS: string[] = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

function getAvatarColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function VistaIngreso({ ingresoId, isSidebar = false }: { ingresoId: string; isSidebar?: boolean }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [orden, setOrden] = useState<OrdenTrabajo | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [presupuestoId, setPresupuestoId] = useState<string | null>(null);
  const [presupuesto, setPresupuesto] = useState<OrdenTrabajo | null>(null);
  const [tecnicos, setTecnicos] = useState<AppUser[]>([]);
  const [todosLosUsuarios, setTodosLosUsuarios] = useState<AppUser[]>([]);
  const [tecnicosAsignados, setTecnicosAsignados] = useState<AppUser[]>([]);
  const [tempTecnicosAsignados, setTempTecnicosAsignados] = useState<AppUser[]>([]);
  const [isTecnicosPopoverOpen, setIsTecnicosPopoverOpen] = useState(false);
  const [taller, setTaller] = useState<DatosTaller | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Formularios Locales
  const [tecnicoId, setTecnicoId] = useState("");
  const [km, setKm] = useState("");
  const [nivelCombustible, setNivelCombustible] = useState<NivelCombustible>("1/2");
  const [tipoServicio, setTipoServicio] = useState<OrdenTrabajo["tipoServicio"]>("Mantenimiento");
  const [motivo, setMotivo] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(CHECKLIST_DEFAULT);
  const [diagnostico, setDiagnostico] = useState("");
  const [fotos, setFotos] = useState<FotoDiagnostico[]>([]);
  
  const [isModalInspeccionOpen, setIsModalInspeccionOpen] = useState(false);
  const [danos, setDanos] = useState<OrdenTrabajo["inspeccionVisual"]["danos"]>([]);
  const [creatingPresupuesto, setCreatingPresupuesto] = useState(false);
  const [creatingOrden, setCreatingOrden] = useState(false);
  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
  const [isVehiculoModalOpen, setIsVehiculoModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRetirarModalOpen, setIsRetirarModalOpen] = useState(false);
  const [isFirmaModalOpen, setIsFirmaModalOpen] = useState(false);
  const [isClienteExpanded, setIsClienteExpanded] = useState(false);
  const [isVehiculoExpanded, setIsVehiculoExpanded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [ordenData, tecnicosData, tallerData] = await Promise.all([
        getOrdenById(ingresoId),
        getUsuarios(),
        getDatosTaller()
      ]);
      
      if (!ordenData) {
        toast.error("Ingreso no encontrado");
        router.push("/ingresos");
        return;
      }

      setTecnicos(tecnicosData.filter(u => u.role === "tecnico" && u.activo));
      setTodosLosUsuarios(tecnicosData);
      setOrden(ordenData);
      setTaller(tallerData);

      // Cargar relaciones
      const cData = ordenData.cliente || await getClienteById(ordenData.clienteId);
      const vData = ordenData.vehiculo || await getVehiculoById(ordenData.vehiculoId);
      setCliente(cData);
      setVehiculo(vData);

      const numeroIngreso = ordenData.numeroIngreso ?? ordenData.numero ?? 0;
      const pres = await getPresupuestoPorIngreso(numeroIngreso, ordenData.vehiculoId);
      setPresupuestoId(pres?.id || null);
      setPresupuesto(pres || null);

      // Settear estados locales
      setTecnicoId(ordenData.tecnicoId || (ordenData.personalAsignado?.[0]?.uid) || "");
      setKm(ordenData.kilometrajeIngreso ? String(ordenData.kilometrajeIngreso) : "");
      setNivelCombustible(ordenData.nivelCombustible || "1/2");
      setTipoServicio(ordenData.tipoServicio || "Mantenimiento");
      setMotivo(ordenData.motivo || "");
      setObservaciones(ordenData.notasInternas || "");
      setChecklist(getMergedChecklist(ordenData.checklistInventario));
      setDiagnostico(ordenData.informeTecnico || "");
      setFotos(ordenData.fotosDiagnostico?.length ? ordenData.fotosDiagnostico : (ordenData.fotoUrls || []).map(url => ({ url, descripcion: "" })));
      setDanos(ordenData.inspeccionVisual?.danos || []);
      setTecnicosAsignados((ordenData.personalAsignado as AppUser[]) || []);

    } catch (error) {
      console.error(error);
      toast.error("Error al cargar la información");
    } finally {
      setLoading(false);
    }
  }, [ingresoId, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Escuchar cambios en la orden en tiempo real para reflejar asignación de técnicos, firmas, etc.
  useEffect(() => {
    if (!ingresoId) return;
    const unsub = onSnapshot(doc(db, "ordenesTrabajo", ingresoId), (snap) => {
      if (snap.exists()) {
        const ordenData = { id: snap.id, ...snap.data() } as OrdenTrabajo;
        setOrden(ordenData);
        setTecnicosAsignados((ordenData.personalAsignado as AppUser[]) || []);
      }
    });
    return unsub;
  }, [ingresoId]);

  // Actualizar el título de la pestaña con el número de ingreso
  useEffect(() => {
    if (orden) {
      const numIngreso = String(orden.numeroIngreso ?? orden.numero ?? 0).padStart(5, "0");
      const originalTitle = document.title;
      document.title = `Ingreso #${numIngreso}`;
      return () => {
        document.title = originalTitle;
      };
    }
  }, [orden]);


  // Guardado automático debounced o manual
  const handleSave = async () => {
    if (!orden) return;
    setSaving(true);
    try {
      const teniaInspeccion = (orden.inspeccionVisual?.danos?.length || 0) > 0;
      const tieneInspeccionAhora = danos.length > 0;

      await updateOrden(ingresoId, {
        tecnicoId: tecnicoId || undefined,
        kilometrajeIngreso: km ? Number(km) : 0,
        nivelCombustible,
        tipoServicio,
        motivo,
        notasInternas: observaciones,
        checklistInventario: checklist,
        informeTecnico: diagnostico,
        fotosDiagnostico: fotos,
        inspeccionVisual: { danos },
        personalAsignado: tecnicosAsignados,
      });

      // Si antes no tenía inspección y ahora sí, enviamos el mensaje del sistema
      if (!teniaInspeccion && tieneInspeccionAhora) {
        await sendMensajeOrden(ingresoId, {
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

      // Actualizar la fecha localmente para que la UI reaccione
      setOrden(prev => prev ? { 
        ...prev, 
        inspeccionVisual: { danos },
        updatedAt: { toDate: () => new Date() } as any 
      } : null);
      toast.success("Cambios guardados", { id: "save" });
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleCrearPresupuesto = async () => {
    if (!orden || !cliente || !vehiculo) return;
    if (presupuestoId) {
      router.push(`/presupuestos/${presupuestoId}`);
      return;
    }
    setCreatingPresupuesto(true);
    try {
      const nuevoPresupuestoId = await createOrdenConItems({
        vehiculoId: orden.vehiculoId,
        clienteId: orden.clienteId,
        estado: "En Reparación", // o "Presupuestado"
        tipoServicio: orden.tipoServicio,
        motivo: "Cotización derivada del ingreso " + (orden.numero ?? ""),
        kilometrajeIngreso: orden.kilometrajeIngreso,
        nivelCombustible: orden.nivelCombustible,
        checklistInventario: orden.checklistInventario,
        inspeccionVisual: orden.inspeccionVisual,
        esCotizacion: true,
      }, []);
      
      toast.success("Presupuesto creado con éxito");
      
      // Enviar mensaje del sistema al chat
      await sendMensajeOrden(ingresoId, {
        autorId: "sistema",
        autorNombre: "Sistema",
        autorRole: "admin",
        texto: `Presupuesto creado por ${user?.displayName || "un técnico"}.`,
        sistema: true,
        accionSistema: "presupuesto",
        tecnicoAfectadoId: user?.uid || "",
        tecnicoAfectadoNombre: user?.displayName || "Técnico",
        presupuestoId: nuevoPresupuestoId
      }).catch(err => console.error("Error al enviar mensaje de presupuesto:", err));

      router.push(`/presupuestos/${nuevoPresupuestoId}`);
    } catch (error) {
      console.error(error);
      toast.error("Error al crear el presupuesto");
    } finally {
      setCreatingPresupuesto(false);
    }
  };

  const handleCrearOrden = async () => {
    if (!orden?.id) return;
    if (orden.numeroOrden) {
      // Already converted, navigate to ordenes
      router.push(`/ordenes/detalle?id=${orden.id}`);
      return;
    }
    setCreatingOrden(true);
    try {
      const numOrden = await convertirIngresoAOrden(orden.id);
      toast.success(`Orden #ORD-${String(numOrden).padStart(5, "0")} creada`);
      
      // Enviar mensaje del sistema al chat
      await sendMensajeOrden(orden.id, {
        autorId: "sistema",
        autorNombre: "Sistema",
        autorRole: "admin",
        texto: `Orden de trabajo creada por ${user?.displayName || "un técnico"}.`,
        sistema: true,
        accionSistema: "orden",
        tecnicoAfectadoId: user?.uid || "",
        tecnicoAfectadoNombre: user?.displayName || "Técnico"
      }).catch(err => console.error("Error al enviar mensaje de orden de trabajo:", err));

      void loadData();
    } catch (error) {
      console.error(error);
      toast.error("Error al crear la orden");
    } finally {
      setCreatingOrden(false);
    }
  };

  const handleEliminarIngreso = async () => {
    if (!orden) return;
    const isConfirmed = window.confirm(
      "¿Seguro de eliminar este ingreso? Esto también eliminará el presupuesto y la inspección asociados."
    );
    if (!isConfirmed) return;

    setSaving(true);
    const toastId = toast.loading("Eliminando ingreso y registros asociados...");
    try {
      // 1. Delete associated budget (cotización) if it exists
      const numeroIngreso = orden.numeroIngreso ?? orden.numero ?? 0;
      const presupuesto = await getPresupuestoPorIngreso(numeroIngreso, orden.vehiculoId);
      if (presupuesto?.id) {
        await deleteOrden(presupuesto.id);
      }

      // 2. Delete the ingress itself (which includes visual inspection)
      await deleteOrden(ingresoId);

      toast.success("Ingreso y registros asociados eliminados con éxito", { id: toastId });
      router.push("/ingresos");
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar el ingreso", { id: toastId });
    } finally {
      setSaving(false);
      setIsMenuOpen(false);
    }
  };

  const handleRetirarVehiculo = async () => {
    if (!orden) return;
    setSaving(true);
    const toastId = toast.loading("Registrando retiro de vehículo...");
    try {
      await updateOrden(ingresoId, {
        archivado: true,
      });
      toast.success("Vehículo retirado y registro archivado con éxito", { id: toastId });
      setIsRetirarModalOpen(false);
      router.push("/ingresos");
    } catch (err) {
      console.error(err);
      toast.error("Error al registrar el retiro del vehículo", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!orden || !cliente || !vehiculo) return;
    setGeneratingPdf(true);
    const toastId = toast.loading("Generando PDF...");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const ComprobanteIngresoPDF = (await import("./ComprobanteIngresoPDF")).default;

      const tecnicoName = tecnicosAsignados.map(t => t.displayName || t.email).join(", ");

      const blob = await pdf(
        <ComprobanteIngresoPDF
          orden={orden}
          cliente={cliente}
          vehiculo={vehiculo}
          taller={taller}
          tecnicoName={tecnicoName}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const numIngreso = String(orden.numeroIngreso ?? orden.numero ?? 0).padStart(5, "0");
      link.download = `comprobante_ingreso_${numIngreso}.pdf`;
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
      const ComprobanteIngresoPDF = (await import("./ComprobanteIngresoPDF")).default;

      const tecnicoName = tecnicosAsignados.map(t => t.displayName || t.email).join(", ");

      const blob = await pdf(
        <ComprobanteIngresoPDF
          orden={orden}
          cliente={cliente}
          vehiculo={vehiculo}
          taller={taller}
          tecnicoName={tecnicoName}
        />
      ).toBlob();

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

  const toggleTecnico = (tecnico: AppUser) => {
    let nuevos: AppUser[];
    if (tecnicosAsignados.find(t => t.uid === tecnico.uid)) {
      nuevos = tecnicosAsignados.filter(t => t.uid !== tecnico.uid);
    } else {
      nuevos = [...tecnicosAsignados, tecnico];
    }
    setTecnicosAsignados(nuevos);
    updateOrden(ingresoId, { personalAsignado: nuevos }).catch(console.error);
  };

  const toggleTempTecnico = (tecnico: AppUser) => {
    setTempTecnicosAsignados(prev =>
      prev.some(t => t.uid === tecnico.uid)
        ? prev.filter(t => t.uid !== tecnico.uid)
        : [...prev, tecnico]
    );
  };

  const toggleChecklistItem = (index: number) => {
    const newChecklist = [...checklist];
    newChecklist[index].checked = !newChecklist[index].checked;
    setChecklist(newChecklist);
  };

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setSaving(true);
    const toastId = toast.loading("Subiendo foto...");
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadOrdenFoto(ingresoId, files[i]);
        urls.push(url);
      }
      const nuevasFotos = [...fotos, ...urls.map(url => ({ url, descripcion: "" }))];
      setFotos(nuevasFotos);
      await updateOrden(ingresoId, { fotosDiagnostico: nuevasFotos });
      toast.success("Foto(s) subida(s)", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Error al subir foto", { id: toastId });
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUpdateFoto = (url: string, descripcion: string) => {
    const nuevasFotos = fotos.map(f => f.url === url ? { ...f, descripcion } : f);
    setFotos(nuevasFotos);
    updateOrden(ingresoId, { fotosDiagnostico: nuevasFotos }).catch(console.error);
  };

  const handleRemoveFoto = async (index: number) => {
    if (!window.confirm("¿Seguro de eliminar esta foto?")) return;
    const nuevasFotos = [...fotos];
    nuevasFotos.splice(index, 1);
    setFotos(nuevasFotos);
    handleSave(); // Guardamos el cambio de arreglo
  };

  const handleSaveFirma = async (signatureDataUrl: string) => {
    setSaving(true);
    const toastId = toast.loading("Guardando firma...");
    try {
      await updateOrden(ingresoId, { firmaClienteUrl: signatureDataUrl });
      setOrden(prev => prev ? { ...prev, firmaClienteUrl: signatureDataUrl } : null);
      toast.success("Firma registrada con éxito", { id: toastId });
    } catch (error) {
      console.error("Error al registrar la firma:", error);
      toast.error("Error al registrar la firma", { id: toastId });
    } finally {
      setSaving(false);
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
      <AppShell hideHeader noPadding>
        <div className="flex items-center justify-center h-full">
          <Loader2 size={40} className="animate-spin text-blue-500" />
        </div>
      </AppShell>
    );
  }

  const mainContent = (
    <div className={`flex flex-col overflow-hidden ${isSidebar ? "h-full bg-slate-50 dark:bg-slate-900" : "h-screen"}`}>

      {/* Header Bar */}
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] shrink-0 bg-[var(--bg-card)] ${isSidebar ? "px-4 py-2 mb-2" : "px-6 py-3 mb-3"} shadow-sm`}>
        <div className="flex items-center gap-2">
          {!isSidebar && (
            <Link href="/ingresos" className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors text-slate-500 hover:text-slate-900 border-none bg-transparent cursor-pointer flex items-center justify-center">
              <ChevronLeft size={20} />
            </Link>
          )}
          <h1 className={`${isSidebar ? "text-sm" : "text-lg"} font-extrabold flex items-center gap-1`}>
            Ingreso <span className="text-blue-600 font-mono">#{String(orden.numeroIngreso ?? orden.numero ?? 0).padStart(5, "0")}</span>
            {orden.numeroOrden && <span className="ml-1.5 badge bg-green-50 text-green-700 text-[10px] px-1 py-0.5 font-bold uppercase">ORD-{String(orden.numeroOrden).padStart(5, "0")}</span>}
          </h1>
          {saving && <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" />}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            className={`bg-white hover:bg-orange-50 border border-orange-200 text-orange-600 font-bold text-xs ${isSidebar ? "px-2 py-1 text-[10px]" : "px-3.5 py-1.5"} rounded-lg shadow-sm flex items-center gap-1 cursor-pointer outline-none transition-colors`}
            onClick={() => setIsRetirarModalOpen(true)}
            disabled={saving}
          >
             {isSidebar ? "Retirar" : "Retirar vehículo"}
          </button>
          <button 
            className={`bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-[var(--border)] text-slate-700 dark:text-slate-200 font-bold text-xs ${isSidebar ? "px-2 py-1 text-[10px]" : "px-3.5 py-1.5"} rounded-lg shadow-sm flex items-center gap-1 cursor-pointer outline-none transition-colors`} 
            onClick={handleCrearPresupuesto}
            disabled={creatingPresupuesto || saving}
          >
             {creatingPresupuesto ? <Loader2 size={12} className="animate-spin" /> : presupuestoId ? (isSidebar ? "Presupuesto" : "Ver presupuesto") : (isSidebar ? "Crear Pres." : "Crear presupuesto")}
          </button>
          <button 
            className={`bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-[var(--border)] text-slate-700 dark:text-slate-200 font-bold text-xs ${isSidebar ? "px-2 py-1 text-[10px]" : "px-3.5 py-1.5"} rounded-lg shadow-sm flex items-center gap-1 cursor-pointer outline-none transition-colors`} 
            onClick={handleSave}
          >
             Guardar
          </button>
          <button 
            className={`bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs ${isSidebar ? "px-2 py-1 text-[10px]" : "px-3.5 py-1.5"} rounded-lg shadow-sm flex items-center gap-1 cursor-pointer outline-none transition-colors`}
            onClick={handleCrearOrden}
            disabled={creatingOrden || saving}
          >
            {creatingOrden ? <Loader2 size={12} className="animate-spin" /> : orden?.numeroOrden ? (isSidebar ? "Ver Orden" : `Ver orden #ORD-${String(orden.numeroOrden).padStart(5, "0")}`) : (isSidebar ? "+ Orden" : "+ Crear orden")}
          </button>

          {/* Botón de Descargar PDF (Solo ícono) */}
          <button 
            type="button"
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-50 bg-transparent border-none cursor-pointer flex items-center justify-center transition-colors"
            onClick={handleDownloadPDF}
            disabled={generatingPdf || loading}
            title="Descargar PDF"
          >
            {generatingPdf ? (
              <Loader2 size={14} className="animate-spin text-blue-600" />
            ) : (
              <FileDown size={14} />
            )}
          </button>

          {/* Botón de Imprimir PDF (Solo ícono) */}
          <button 
            type="button"
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-50 bg-transparent border-none cursor-pointer flex items-center justify-center transition-colors"
            onClick={handlePrintPDF}
            disabled={generatingPdf || loading}
            title="Imprimir"
          >
            {generatingPdf ? (
              <Loader2 size={14} className="animate-spin text-blue-600" />
            ) : (
              <Printer size={14} />
            )}
          </button>

          {/* 3-dots actions menu */}
          <div className="relative">
            <button 
              type="button"
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-transparent border-none cursor-pointer flex items-center justify-center transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="Más acciones"
            >
              <MoreHorizontal size={14} />
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-42 bg-white dark:bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                  <button
                    type="button"
                    onClick={handleEliminarIngreso}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2 border-0 bg-transparent cursor-pointer font-inherit"
                  >
                    <Trash2 size={12} />
                    Eliminar ingreso
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Columns Layout */}
      <div className={`flex-1 overflow-y-auto ${isSidebar ? "flex flex-col gap-4 px-4 pb-4 custom-scrollbar" : "flex gap-6 overflow-hidden px-6 pb-4"}`}>
        
        {/* Column 1: Cliente Tarjeta + Chat */}
        <div className={`${isSidebar ? "w-full shrink-0" : "min-w-0 flex flex-col h-full gap-4 overflow-hidden"}`} style={isSidebar ? undefined : { flex: "1.2 1 0%" }}>
            {/* Tarjeta de Cliente */}
            {cliente && (
              <div className="bg-white dark:bg-slate-900 border border-[var(--border)] rounded-xl p-4 shadow-sm flex flex-col gap-3 shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <User size={12} className="text-blue-500 shrink-0" />
                    Cliente
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => setIsClienteModalOpen(true)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-blue-600 dark:text-blue-400 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
                      title="Editar cliente"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => setIsClienteExpanded(!isClienteExpanded)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
                      title={isClienteExpanded ? "Comprimir" : "Expandir"}
                    >
                      {isClienteExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold shrink-0 uppercase text-xs border border-blue-200/50">
                    {getInitials(cliente.nombre + " " + (cliente.apellido || ""))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white truncate">
                      {cliente.nombre} {cliente.apellido || ""}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                      <span className="text-[10px] text-slate-550 dark:text-slate-400 truncate font-mono">
                        Tel: {cliente.telefono || "—"}
                      </span>
                      {cliente.telefono && (
                        <a
                          href={`https://wa.me/${cliente.telefono.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-emerald-500 hover:text-emerald-600 transition-colors shrink-0"
                          title="Enviar WhatsApp"
                        >
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.039 2.875 1.184 3.074.145.198 2.038 3.111 4.938 4.362.69.298 1.23.476 1.653.61.692.22 1.32.19 1.815.116.551-.082 1.758-.718 2.008-1.411.25-.693.25-1.288.175-1.411-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {isClienteExpanded && (
                  <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-[var(--border-light)] text-[11px] text-slate-655 dark:text-slate-350 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold text-slate-500 dark:text-slate-400 shrink-0">CI/RUC:</span>
                      <span>{cliente.identificacion || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold text-slate-500 dark:text-slate-400 shrink-0">Email:</span>
                      <span className="truncate">{cliente.email || "—"}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* Chat Container */}
          {!isSidebar && (
            <div className="flex-1 min-h-0 flex flex-col border border-[var(--border)] rounded-xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <ChatOrden
                ordenId={ingresoId}
                personalAsignado={orden.personalAsignado || []}
                todosLosUsuarios={todosLosUsuarios}
                onOpenInspeccion={() => setIsModalInspeccionOpen(true)}
                cliente={null}
                recibidoPor={user}
              />
            </div>
          )}
        </div>

        {/* Column 2: Vehicle details */}
        <div className={`${isSidebar ? "w-full shrink-0" : "min-w-0 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar border-x border-[var(--border)] px-6"}`} style={isSidebar ? undefined : { flex: "2 1 0%" }}>
            {/* Tarjeta de Vehículo */}
            {vehiculo && (
              <div className="bg-white dark:bg-slate-900 border border-[var(--border)] rounded-xl p-4 shadow-sm flex flex-col gap-3 shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Car size={12} className="text-blue-500 shrink-0" />
                    Vehículo
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => setIsVehiculoModalOpen(true)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-blue-600 dark:text-blue-400 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
                      title="Editar vehículo"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => setIsVehiculoExpanded(!isVehiculoExpanded)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
                      title={isVehiculoExpanded ? "Comprimir" : "Expandir"}
                    >
                      {isVehiculoExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold shrink-0 uppercase text-xs border border-blue-200/50">
                    <Car size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white truncate">
                      {vehiculo.marca} {vehiculo.modelo} {vehiculo.anio}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                      <span className="text-[10px] text-slate-555 dark:text-slate-400 font-mono uppercase bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded tracking-wider border border-[var(--border-light)]">
                        {vehiculo.placa}
                      </span>
                    </div>
                  </div>
                </div>

                {isVehiculoExpanded && (
                  <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-[var(--border-light)] text-[11px] text-slate-655 dark:text-slate-350 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold text-slate-500 dark:text-slate-400 shrink-0">Color:</span>
                      <span>{vehiculo.color || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold text-slate-500 dark:text-slate-400 shrink-0">VIN / Chasis:</span>
                      <span className="truncate">{vehiculo.vin || "—"}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Campos de la orden */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] flex items-center gap-1 mb-2">Kilometraje</label>
                <input 
                  type="number" 
                  className="input w-full" 
                  placeholder="Ej: 85000" 
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                  onBlur={handleSave}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] mb-2 block">Tipo de Servicio</label>
                <select 
                  className="input w-full"
                  value={tipoServicio}
                  onChange={(e) => {
                    setTipoServicio(e.target.value as OrdenTrabajo["tipoServicio"]);
                    setTimeout(handleSave, 100);
                  }}
                >
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Reparación">Reparación</option>
                  <option value="Garantía">Garantía</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] flex items-center gap-1 mb-2">Nivel de combustible</label>
              <div className="flex rounded-lg overflow-hidden border border-[var(--border)] h-[42px] bg-slate-100 dark:bg-slate-800">
                {NIVELES_COMBUSTIBLE.map((nivel, index) => {
                  const selectedIndex = NIVELES_COMBUSTIBLE.findIndex(n => n.value === nivelCombustible);
                  const selectedColor = selectedIndex !== -1 ? NIVELES_COMBUSTIBLE[selectedIndex].color : "";
                  const isFilled = index <= selectedIndex;
                  return (
                    <button
                      key={nivel.value}
                      className={`flex-1 font-bold text-xs transition-colors ${isFilled ? selectedColor : "text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"}`}
                      onClick={() => {
                        setNivelCombustible(nivel.value);
                        setTimeout(handleSave, 100);
                      }}
                    >
                      {nivel.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] mb-2 block">Motivo de ingreso a taller</label>
              <textarea 
                className="input w-full min-h-[100px]" 
                placeholder="Escribe la falla o requerimiento del cliente"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                onBlur={handleSave}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] mb-2 block">Observaciones</label>
              <textarea 
                className="input w-full min-h-[80px]" 
                placeholder="Observaciones adicionales..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                onBlur={handleSave}
              />
            </div>

            {/* Inventario de vehículo */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-[var(--text-muted)] mb-2 block">
                Inventario de vehículo
              </label>
              <div className="grid grid-cols-2 border border-[var(--border)] rounded-xl overflow-hidden bg-white dark:bg-[var(--bg-card)]">
                {checklist.map((item, index) => {
                  const isLeft = index % 2 === 0;
                  const totalRows = Math.ceil(checklist.length / 2);
                  const lastRowStartIndex = (totalRows - 1) * 2;
                  const hasBottomBorder = index < lastRowStartIndex;
                  return (
                    <label 
                      key={index} 
                      className={`p-3 flex items-center gap-3 text-sm hover:bg-[var(--bg-hover)] cursor-pointer select-none transition-colors ${
                        isLeft ? "border-r border-[var(--border)]" : ""
                      } ${hasBottomBorder ? "border-b border-[var(--border)]" : ""} border-[var(--border)]`}
                    >
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                        checked={item.checked}
                        onChange={() => {
                          toggleChecklistItem(index);
                          setTimeout(handleSave, 100);
                        }}
                      />
                      <span className="text-slate-700 dark:text-slate-200">{item.label}</span>
                    </label>
                  );
                })}
                {checklist.length % 2 !== 0 && (
                  <div className="p-3 border-[var(--border)]" />
                )}
              </div>
            </div>
          </div>

        {/* Column 3: Inspections */}
        <div className={`${isSidebar ? "w-full shrink-0" : "min-w-0 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar"}`} style={isSidebar ? undefined : { flex: "1.2 1 0%" }}>
            {/* Flujo de Recepción (Stepper Vertical) */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex flex-col gap-4">
              <h3 className="font-bold flex items-center gap-2 text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                Proceso
              </h3>
              
              <div className="relative pl-6 border-l border-slate-200 dark:border-slate-800 ml-2.5 py-1 space-y-5">
                {/* Paso 1: Ingreso */}
                <div className="relative">
                  <div className="absolute -left-[33px] top-0 w-4 h-4 rounded-full bg-green-100 dark:bg-green-950 border border-green-600 flex items-center justify-center text-green-700 dark:text-green-400 text-[9px] font-extrabold">
                    ✓
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">1. Ingreso</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">
                      {(() => {
                        const dateObj = orden.createdAt?.toDate ? orden.createdAt.toDate() : (orden.createdAt ? new Date(orden.createdAt as any) : null);
                        return dateObj 
                          ? `${dateObj.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${dateObj.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: true })}`
                          : '—';
                      })()}
                    </span>
                  </div>
                </div>

                {/* Paso 2: Inspección */}
                {(() => {
                  const completado = danos.length > 0 || fotos.length > 0 || observaciones.length > 0;
                  return (
                    <div className="relative">
                      <div className={`absolute -left-[33px] top-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold border ${
                        completado 
                          ? 'bg-green-100 dark:bg-green-950 border-green-600 text-green-700 dark:text-green-400' 
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400'
                      }`}>
                        {completado ? '✓' : '2'}
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-xs font-bold ${completado ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>
                          2. Inspección Visual
                        </span>
                        <button 
                          onClick={() => setIsModalInspeccionOpen(true)}
                          className={`text-[10px] font-semibold mt-0.5 text-left border-none bg-transparent p-0 outline-none cursor-pointer hover:underline ${
                            completado ? 'text-green-600 hover:text-green-700' : 'text-blue-500 hover:text-blue-600'
                          }`}
                        >
                          {completado ? 'Ver / Editar inspección' : '+ Registrar inspección'}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Paso 3: Presupuesto */}
                {(() => {
                  const completado = !!presupuestoId;
                  return (
                    <div className="relative">
                      <div className={`absolute -left-[33px] top-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold border ${
                        completado 
                          ? 'bg-green-100 dark:bg-green-950 border-green-600 text-green-700 dark:text-green-400' 
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400'
                      }`}>
                        {completado ? '✓' : '3'}
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-xs font-bold ${completado ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>
                          3. Presupuesto
                        </span>
                        {completado ? (
                          <Link href={`/presupuestos/${presupuestoId}`} className="text-[10px] text-green-600 hover:text-green-700 font-semibold mt-0.5 hover:underline">
                            {presupuesto ? `#PRE-${String(presupuesto.numeroCotizacion || presupuesto.numero || 0).padStart(4, "0")}` : "Ver presupuesto"}
                          </Link>
                        ) : (
                          <button 
                            onClick={handleCrearPresupuesto}
                            disabled={creatingPresupuesto || saving}
                            className="text-[10px] text-blue-500 hover:text-blue-600 font-bold mt-0.5 text-left border-none bg-transparent p-0 outline-none cursor-pointer hover:underline disabled:opacity-50"
                          >
                            {creatingPresupuesto ? 'Creando...' : '+ Crear presupuesto'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Paso 4: Orden de Trabajo */}
                {(() => {
                  const completado = !!orden?.numeroOrden;
                  return (
                    <div className="relative">
                      <div className={`absolute -left-[33px] top-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold border ${
                        completado 
                          ? 'bg-green-100 dark:bg-green-950 border-green-600 text-green-700 dark:text-green-400' 
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400'
                      }`}>
                        {completado ? '✓' : '4'}
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-xs font-bold ${completado ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>
                          4. Orden de Trabajo
                        </span>
                        {completado ? (
                          <Link href={`/ordenes/detalle?id=${orden.id}`} className="text-[10px] text-green-600 hover:text-green-700 font-semibold mt-0.5 hover:underline">
                            #ORD-{String(orden.numeroOrden).padStart(5, "0")}
                          </Link>
                        ) : (
                          <button 
                            onClick={handleCrearOrden}
                            disabled={creatingOrden || saving}
                            className="text-[10px] text-blue-500 hover:text-blue-600 font-bold mt-0.5 text-left border-none bg-transparent p-0 outline-none cursor-pointer hover:underline disabled:opacity-50"
                          >
                            {creatingOrden ? 'Creando...' : '+ Crear orden de trabajo'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>



            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] mb-2 block">Diagnóstico y/o conclusión</label>
              <textarea 
                className="input w-full h-[155px]" 
                placeholder="Escribe aquí el diagnóstico final del vehículo tras las inspecciones realizadas"
                value={diagnostico}
                onChange={(e) => setDiagnostico(e.target.value)}
                onBlur={handleSave}
              />
            </div>

            <div>
              <h3 className="font-bold flex items-center gap-2 mb-4 text-[var(--text-secondary)]">
                <span className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-slate-600"><ClipboardSignature size={12} /></span>
                Firma del cliente
              </h3>
              {orden.firmaClienteUrl ? (
                <div className="card p-3 flex flex-col items-center gap-2 bg-slate-50 dark:bg-slate-900/10 border border-slate-200 rounded-xl relative group">
                  <img 
                    src={orden.firmaClienteUrl} 
                    alt="Firma del cliente" 
                    className="h-20 object-contain dark:invert" 
                  />
                  <div className="text-xs text-green-600 font-semibold flex items-center gap-1">
                    <span>✓ Firmado</span>
                  </div>
                  <button 
                    onClick={() => setIsFirmaModalOpen(true)}
                    className="btn btn-sm bg-white border border-[var(--border)] w-full justify-center shadow-sm text-xs mt-1"
                  >
                    Firmar de nuevo
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setIsFirmaModalOpen(true)}
                    className="w-full border border-[var(--border)] bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs py-2 px-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5"
                  >
                    <ClipboardSignature size={14} />
                    Firmar
                  </button>
                  <button 
                    onClick={() => {
                      if (cliente.email) {
                        toast.success(`Solicitud de firma enviada a ${cliente.email}`);
                      } else {
                        toast.error("El cliente no tiene un correo electrónico registrado");
                      }
                    }}
                    className="w-full border border-dashed border-[var(--border)] bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs py-2 px-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5"
                  >
                    <Mail size={14} />
                    Solicitar
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
  );

  const modalesYMas = (
    <>
      <ModalInspeccion 
        isOpen={isModalInspeccionOpen}
        onClose={() => setIsModalInspeccionOpen(false)}
        vehiculo={vehiculo}
        danos={danos}
        onChangeDanos={setDanos}
        onSave={handleSave}
        fotos={fotos}
        onUploadFoto={handleUploadFoto}
        onUpdateFoto={handleUpdateFoto}
        onRemoveFoto={handleRemoveFoto}
        observaciones={observaciones}
        onChangeObservaciones={setObservaciones}
      />

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

      <VehiculoModal
        isOpen={isVehiculoModalOpen}
        onClose={() => setIsVehiculoModalOpen(false)}
        editingVehiculo={vehiculo}
        onSuccess={() => {
          setIsVehiculoModalOpen(false);
          void loadData();
        }}
      />

      {isRetirarModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col items-center">
            <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/20 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-500 mb-4 border border-amber-100 dark:border-amber-900/30">
              <LogOut size={26} />
            </div>
            
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2 text-center">
              Retirar vehículo del taller
            </h3>
            
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6 leading-relaxed">
              El ingreso <span className="font-bold text-slate-700 dark:text-slate-200">#ING-{String(orden.numeroIngreso ?? orden.numero ?? 0).padStart(5, "0")}</span> será archivado y el vehículo dejará de aparecer como "en taller".
            </p>
            
            <div className="flex gap-3 w-full">
              <button 
                type="button"
                className="flex-1 btn bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 py-2.5 rounded-xl font-semibold justify-center transition-colors"
                onClick={() => setIsRetirarModalOpen(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button 
                type="button"
                className="flex-1 btn bg-amber-600 hover:bg-amber-700 text-white border-0 py-2.5 rounded-xl font-semibold justify-center transition-colors flex items-center gap-2"
                onClick={handleRetirarVehiculo}
                disabled={saving}
              >
                <LogOut size={16} /> Confirmar retiro
              </button>
            </div>
          </div>
        </div>
      )}

      <ModalFirmaCliente
        isOpen={isFirmaModalOpen}
        onClose={() => setIsFirmaModalOpen(false)}
        onSave={handleSaveFirma}
        clienteEmail={cliente.email}
        numeroIngreso={`ING-${String(orden.numeroIngreso ?? orden.numero ?? 0).padStart(5, "0")}`}
      />
    </>
  );

  if (isSidebar) {
    return (
      <>
        {mainContent}
        {modalesYMas}
      </>
    );
  }

  return (
    <AppShell hideHeader noPadding>
      {mainContent}
      {modalesYMas}
    </AppShell>
  );
}
