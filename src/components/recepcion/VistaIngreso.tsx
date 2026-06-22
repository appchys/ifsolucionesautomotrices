"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { ChevronLeft, Download, Mail, MoreHorizontal, Printer, FileDown, Loader2, Camera, Trash2, Car, User, Plus, X, Search, Users, Eye, PenTool, ClipboardSignature, Edit, LogOut } from "lucide-react";
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
  getDatosTaller
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

const NIVELES_COMBUSTIBLE: { label: string; value: NivelCombustible; color: string }[] = [
  { label: "E", value: "Vacío", color: "bg-red-500 text-white" },
  { label: "1/4", value: "1/4", color: "bg-orange-400 text-white" },
  { label: "1/2", value: "1/2", color: "bg-yellow-400 text-slate-900" },
  { label: "3/4", value: "3/4", color: "bg-emerald-400 text-white" },
  { label: "F", value: "Lleno", color: "bg-emerald-600 text-white" },
];

export default function VistaIngreso({ ingresoId }: { ingresoId: string }) {
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
  const [tecnicosAsignados, setTecnicosAsignados] = useState<AppUser[]>([]);
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
      // Actualizar la fecha localmente para que la UI reaccione
      setOrden(prev => prev ? { ...prev, updatedAt: { toDate: () => new Date() } as any } : null);
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

      const tecnicoName = tecnicosAsignados.map(t => t.displayName || t.email).join(", ") || "Sin asignar";

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

      const tecnicoName = tecnicosAsignados.map(t => t.displayName || t.email).join(", ") || "Sin asignar";

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
    // Auto-save
    updateOrden(ingresoId, { personalAsignado: nuevos }).catch(console.error);
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
    return (
      <AppShell hideHeader noPadding>
        <div className="flex items-center justify-center h-full">
          <Loader2 size={40} className="animate-spin text-blue-500" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hideHeader noPadding>
      <div className="flex flex-col overflow-hidden" style={{ height: "calc(100vh - 2rem)" }}>

        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] shrink-0 bg-[var(--bg-card)] px-6 py-3 mb-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Link href="/ingresos" className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors text-slate-500 hover:text-slate-900 border-none bg-transparent cursor-pointer flex items-center justify-center">
              <ChevronLeft size={20} />
            </Link>
            <h1 className="text-lg font-extrabold flex items-center gap-2">
              Ingreso <span className="text-blue-600 font-mono">#{String(orden.numeroIngreso ?? orden.numero ?? 0).padStart(5, "0")}</span>
              {orden.numeroOrden && <span className="ml-2 badge bg-green-50 text-green-700 text-xs">ORD-{String(orden.numeroOrden).padStart(5, "0")}</span>}
            </h1>
            {saving && <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" />}
          </div>

          <div className="flex items-center gap-3">
            <button 
              className="bg-white hover:bg-orange-50 border border-orange-200 text-orange-600 font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer outline-none transition-colors"
              onClick={() => setIsRetirarModalOpen(true)}
              disabled={saving}
            >
               Retirar vehículo
            </button>
            <button 
              className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-[var(--border)] text-slate-700 dark:text-slate-200 font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer outline-none transition-colors" 
              onClick={handleCrearPresupuesto}
              disabled={creatingPresupuesto || saving}
            >
               {creatingPresupuesto ? <Loader2 size={12} className="animate-spin" /> : presupuestoId ? "Ver presupuesto" : "Crear presupuesto"}
            </button>
            <button 
              className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-[var(--border)] text-slate-700 dark:text-slate-200 font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer outline-none transition-colors" 
              onClick={handleSave}
            >
               Guardar
            </button>
            <button 
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer outline-none transition-colors"
              onClick={handleCrearOrden}
              disabled={creatingOrden || saving}
            >
              {creatingOrden ? <Loader2 size={12} className="animate-spin" /> : orden?.numeroOrden ? `Ver orden #ORD-${String(orden.numeroOrden).padStart(5, "0")}` : "+ Crear orden"}
            </button>

            {/* Botón de Descargar PDF (Solo ícono) */}
            <button 
              type="button"
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-50 bg-transparent border-none cursor-pointer flex items-center justify-center transition-colors"
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

            {/* Botón de Imprimir PDF (Solo ícono) */}
            <button 
              type="button"
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-50 bg-transparent border-none cursor-pointer flex items-center justify-center transition-colors"
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

            {/* 3-dots actions menu */}
            <div className="relative">
              <button 
                type="button"
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-transparent border-none cursor-pointer flex items-center justify-center transition-colors"
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
                      onClick={handleEliminarIngreso}
                      className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2 border-0 bg-transparent cursor-pointer font-inherit"
                    >
                      <Trash2 size={14} />
                      Eliminar ingreso
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 3 Columns Layout */}
        <div className="flex flex-1 gap-6 overflow-hidden px-6 pb-6">
          
          {/* Column 1: Client & Personal */}
          <div className="w-[300px] flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
            <div>
              <h3 className="font-bold flex items-center justify-between mb-4 text-[var(--text-secondary)]">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-slate-600"><User size={12} /></span>
                  Información del cliente
                </div>
                <button 
                  onClick={() => setIsClienteModalOpen(true)} 
                  className="p-1 hover:bg-slate-200 rounded text-blue-600 transition-colors"
                  title="Editar cliente"
                >
                  <Edit size={14} />
                </button>
              </h3>
              <div className="card">
                <div className="flex gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0 uppercase">
                    {(cliente.nombre?.[0] || "")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{cliente.nombre} {cliente.apellido}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{cliente.identificacion?.length === 13 ? "Empresa" : "Persona"}</p>
                  </div>
                </div>
                <div className="text-sm space-y-2 text-[var(--text-secondary)]">
                  <p className="truncate">Tel: {cliente.telefono || "—"}</p>
                  <p className="truncate">Email: {cliente.email || "—"}</p>
                  <p className="truncate">Cédula/RUC: {cliente.identificacion || "—"}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold flex items-center gap-2 mb-4 text-[var(--text-secondary)]">
                <span className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-slate-600"><Users size={12} /></span>
                Personal asociado
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Recibido por</label>
                  <div className="card p-3 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold uppercase shrink-0">
                      {user?.displayName?.[0] || user?.email?.[0] || "U"}
                    </div>
                    <span className="text-sm font-semibold truncate">{user?.displayName || user?.email}</span>
                  </div>
                </div>
                <div className="relative">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Técnicos Asignados</label>
                  
                  <div className="flex flex-wrap gap-2 mb-2">
                    {tecnicosAsignados.length === 0 && (
                      <span className="text-sm text-[var(--text-muted)] italic">Sin asignar</span>
                    )}
                    {tecnicosAsignados.map(t => (
                      <div key={t.uid} className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                        <span>{t.displayName || t.email}</span>
                        <button 
                          onClick={() => toggleTecnico(t)}
                          className="hover:bg-blue-200 rounded-full p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button 
                    className="btn btn-sm bg-white border border-[var(--border)] w-full justify-center shadow-sm"
                    onClick={() => setIsTecnicosPopoverOpen(!isTecnicosPopoverOpen)}
                  >
                    + Asignar técnico
                  </button>

                  {isTecnicosPopoverOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsTecnicosPopoverOpen(false)}></div>
                      <div className="absolute z-50 top-full mt-2 w-full bg-white dark:bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                        {tecnicos.length === 0 ? (
                          <div className="p-3 text-center text-sm text-[var(--text-muted)]">No hay técnicos disponibles</div>
                        ) : (
                          tecnicos.map(t => {
                            const isSelected = tecnicosAsignados.some(asignado => asignado.uid === t.uid);
                            return (
                              <button
                                key={t.uid}
                                className={`w-full text-left p-3 hover:bg-[var(--bg-hover)] border-b border-[var(--border)] last:border-0 flex items-center justify-between text-sm ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                onClick={() => toggleTecnico(t)}
                              >
                                <span>{t.displayName || t.email}</span>
                                {isSelected && <span className="text-blue-600 font-bold">✓</span>}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Vehicle details */}
          <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar border-x border-[var(--border)] px-6">
            <h3 className="font-bold flex items-center justify-between mb-2 text-[var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-slate-600"><Car size={12} /></span>
                Vehículo
              </div>
              <button 
                onClick={() => setIsVehiculoModalOpen(true)} 
                className="p-1 hover:bg-slate-200 rounded text-blue-600 transition-colors"
                title="Editar vehículo"
              >
                <Edit size={14} />
              </button>
            </h3>
            <div className="card flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                <Car size={24} className="text-slate-500" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-lg">{vehiculo.marca} {vehiculo.modelo} {vehiculo.anio}</h4>
                <div className="badge badge-gray font-mono uppercase">{vehiculo.placa}</div>
              </div>
            </div>

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

            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] mb-2 block flex items-center justify-between">
                <span>Inventario de vehículo</span>
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
                        isLeft ? "border-r" : ""
                      } ${hasBottomBorder ? "border-b" : ""} border-[var(--border)]`}
                    >
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
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
          <div className="w-[340px] flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar pb-10">
            {/* Flujo de Recepción (Stepper Vertical) */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex flex-col gap-4">
              <h3 className="font-bold flex items-center gap-2 text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                Progreso del Proceso
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
              <h3 className="font-bold flex items-center gap-2 mb-4 text-[var(--text-secondary)]">
                <span className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-slate-600"><Eye size={12} /></span>
                Inspección técnica {danos.length > 0 ? `(${danos.length} daños)` : ''}
              </h3>
              <button 
                className="btn w-full justify-center bg-white border border-[var(--border)] shadow-sm flex-col py-2 h-auto"
                onClick={() => setIsModalInspeccionOpen(true)}
              >
                {(danos.length > 0 || fotos.length > 0 || observaciones.length > 0) ? (
                  <>
                    <span>Ver / Editar inspección</span>
                    {orden?.updatedAt && typeof orden.updatedAt.toDate === 'function' && (
                      <span className="text-xs text-[var(--text-muted)] font-normal mt-0.5">
                        Actualizada el: {orden.updatedAt.toDate().toLocaleDateString()} a las {orden.updatedAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    )}
                  </>
                ) : (
                  "Registrar inspección"
                )}
              </button>
            </div>

            <div>
              <h3 className="font-bold flex items-center justify-between mb-4 text-[var(--text-secondary)]">
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-slate-600"><Camera size={12} /></span>
                  Fotos
                </span>
                <span className="text-xs font-normal text-[var(--text-muted)]">{fotos.length} fotos</span>
              </h3>
              
              <div className="grid grid-cols-2 gap-2 mb-3">
                {fotos.map((foto, index) => (
                  <div key={index} className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden group border border-[var(--border)]">
                    <img src={foto.url} alt="Inspeccion" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => handleRemoveFoto(index)}
                      className="absolute top-1 right-1 p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleUploadFoto}
              />
              <button 
                className="btn w-full justify-center bg-white border border-[var(--border)] shadow-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera size={16} className="mr-2 text-[var(--text-muted)]" />
                Agregar imagen
              </button>
            </div>

            <div>
              <h3 className="font-bold flex items-center gap-2 mb-4 text-[var(--text-secondary)]">
                <span className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-slate-600"><PenTool size={12} /></span>
                Diagnóstico y/o conclusión
              </h3>
              <textarea 
                className="input w-full min-h-[150px] bg-white text-sm" 
                placeholder="Escribe aquí el diagnóstico final del vehículo tras las inspecciones realizadas (ejemplo: causa del problema identificado y detalles técnicos)"
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
              <div className="space-y-3">
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
                  <button 
                    onClick={() => setIsFirmaModalOpen(true)}
                    className="btn w-full justify-start bg-white border border-[var(--border)] shadow-sm font-semibold flex items-center gap-2"
                  >
                    <ClipboardSignature size={14} className="text-slate-400" />
                    Firmar aquí
                  </button>
                )}
                
                <button 
                  onClick={() => {
                    if (cliente.email) {
                      toast.success(`Solicitud de firma enviada a ${cliente.email}`);
                    } else {
                      toast.error("El cliente no tiene un correo electrónico registrado");
                    }
                  }}
                  className="btn w-full justify-start bg-white border border-[var(--border)] shadow-sm text-slate-700 font-semibold flex items-center gap-2"
                >
                  <Mail size={14} className="text-slate-400" />
                  Solicitar firma a {cliente.email || "cliente"}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

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
    </AppShell>
  );
}
