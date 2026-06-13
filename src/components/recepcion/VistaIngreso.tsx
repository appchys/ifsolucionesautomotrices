"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { ChevronLeft, Download, Mail, MoreHorizontal, Printer, FileDown, Loader2, Camera, Trash2, Car, User, Plus, X, Search, Users, Eye, PenTool, ClipboardSignature, Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  getOrdenById, 
  getClienteById, 
  getVehiculoById, 
  getUsuarios, 
  updateOrden,
  uploadOrdenFoto
} from "@/lib/services";
import { OrdenTrabajo, Cliente, Vehiculo, AppUser, NivelCombustible, ChecklistItem, FotoDiagnostico } from "@/types";
import { useAuthStore } from "@/store";
import { toast } from "react-hot-toast";
import { createOrdenConItems } from "@/lib/services";
import ModalInspeccion from "./ModalInspeccion";
import ClienteModal from "@/components/clientes/ClienteModal";
import VehiculoModal from "@/components/vehiculos/VehiculoModal";

const CHECKLIST_DEFAULT: ChecklistItem[] = [
  { label: "Gata", checked: false },
  { label: "Llanta de repuesto", checked: false },
  { label: "Herramientas (llaves)", checked: false },
  { label: "Extintor", checked: false },
  { label: "Triángulos de emergencia", checked: false },
  { label: "Documentos del vehículo", checked: false },
];

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
  const [tecnicos, setTecnicos] = useState<AppUser[]>([]);
  const [tecnicosAsignados, setTecnicosAsignados] = useState<AppUser[]>([]);
  const [isTecnicosPopoverOpen, setIsTecnicosPopoverOpen] = useState(false);

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
  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
  const [isVehiculoModalOpen, setIsVehiculoModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [ordenData, tecnicosData] = await Promise.all([
        getOrdenById(ingresoId),
        getUsuarios()
      ]);
      
      if (!ordenData) {
        toast.error("Ingreso no encontrado");
        router.push("/ingresos");
        return;
      }

      setTecnicos(tecnicosData.filter(u => u.role === "tecnico" && u.activo));
      setOrden(ordenData);

      // Cargar relaciones
      const cData = ordenData.cliente || await getClienteById(ordenData.clienteId);
      const vData = ordenData.vehiculo || await getVehiculoById(ordenData.vehiculoId);
      setCliente(cData);
      setVehiculo(vData);

      // Settear estados locales
      setTecnicoId(ordenData.tecnicoId || (ordenData.personalAsignado?.[0]?.uid) || "");
      setKm(ordenData.kilometrajeIngreso ? String(ordenData.kilometrajeIngreso) : "");
      setNivelCombustible(ordenData.nivelCombustible || "1/2");
      setTipoServicio(ordenData.tipoServicio || "Mantenimiento");
      setMotivo(ordenData.motivo || "");
      setObservaciones(ordenData.notasInternas || "");
      setChecklist(ordenData.checklistInventario?.length ? ordenData.checklistInventario : CHECKLIST_DEFAULT);
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
    setCreatingPresupuesto(true);
    try {
      const nuevoPresupuestoId = await createOrdenConItems({
        vehiculoId: orden.vehiculoId,
        clienteId: orden.clienteId,
        estado: "Proceso", // o "Presupuestado"
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

  if (loading || !orden || !cliente || !vehiculo) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <Loader2 size={40} className="animate-spin text-blue-500" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-2rem)] overflow-hidden">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4 mb-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <Link href="/ingresos" className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold flex items-center gap-2">
              Ingreso <span className="font-mono text-blue-600">#{String(orden.numero ?? 0).padStart(5, "0")}</span>
            </h1>
            {saving && <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" />}
          </div>

          <div className="flex-1 max-w-xl hidden lg:flex items-center justify-center gap-8 text-sm">
            <div className="flex flex-col items-center gap-1 text-green-600 font-semibold">
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center border border-green-600 text-xs">✓</div>
              <span>Ingreso</span>
            </div>
            <div className="w-12 h-px bg-[var(--border)]"></div>
            
            {/* Inspección step */}
            {(() => {
              const inspeccionCompletada = danos.length > 0 || fotos.length > 0 || observaciones.length > 0;
              return (
                <div className={`flex flex-col items-center gap-1 ${inspeccionCompletada ? 'text-green-600 font-semibold' : 'text-[var(--text-muted)]'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${inspeccionCompletada ? 'bg-green-100 border border-green-600' : 'border border-[var(--border)]'}`}>
                    {inspeccionCompletada ? '✓' : '2'}
                  </div>
                  <span>Inspección</span>
                </div>
              );
            })()}

            <div className="w-12 h-px bg-[var(--border)]"></div>
            <div className="flex flex-col items-center gap-1 text-[var(--text-muted)]">
              <div className="w-6 h-6 rounded-full border border-[var(--border)] flex items-center justify-center text-xs">3</div>
              <span>Presupuesto</span>
            </div>
            <div className="w-12 h-px bg-[var(--border)]"></div>
            <div className="flex flex-col items-center gap-1 text-[var(--text-muted)]">
              <div className="w-6 h-6 rounded-full border border-[var(--border)] flex items-center justify-center text-xs">4</div>
              <span>Orden</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="btn font-semibold text-orange-600 border-orange-200 hover:bg-orange-50 bg-white">
               Retirar vehículo
            </button>
            <button 
              className="btn font-semibold bg-white border-[var(--border)] shadow-sm hover:bg-[var(--bg-hover)]" 
              onClick={handleCrearPresupuesto}
              disabled={creatingPresupuesto || saving}
            >
               {creatingPresupuesto ? <Loader2 size={16} className="animate-spin" /> : "Crear presupuesto"}
            </button>
            <button className="btn font-semibold bg-white border-[var(--border)] shadow-sm hover:bg-[var(--bg-hover)]" onClick={handleSave}>
               Guardar
            </button>
            <button className="btn-primary">
              + Crear orden
            </button>
          </div>
        </div>

        {/* 3 Columns Layout */}
        <div className="flex flex-1 gap-6 overflow-hidden">
          
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
                  {NIVELES_COMBUSTIBLE.map((nivel) => {
                    const isSelected = nivelCombustible === nivel.value;
                    return (
                      <button
                        key={nivel.value}
                        className={`flex-1 font-bold text-xs transition-colors ${isSelected ? nivel.color : "text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"}`}
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
              <div className="card p-0 divide-y divide-[var(--border)] overflow-hidden">
                {checklist.map((item, index) => (
                  <label key={index} className="p-3 flex items-center justify-between text-sm hover:bg-[var(--bg-hover)] cursor-pointer">
                    <span>{item.label}</span> 
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded text-blue-600" 
                      checked={item.checked}
                      onChange={() => {
                        toggleChecklistItem(index);
                        setTimeout(handleSave, 100);
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Column 3: Inspections */}
          <div className="w-[340px] flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar pb-10">
            <div>
              <h3 className="font-bold flex items-center gap-2 mb-4 text-[var(--text-secondary)]">
                <span className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-slate-600"><Eye size={12} /></span>
                Inspección técnica {danos.length > 0 ? `(${danos.length} daños)` : ''}
              </h3>
              <button 
                className="btn w-full justify-center bg-white border border-[var(--border)] shadow-sm"
                onClick={() => setIsModalInspeccionOpen(true)}
              >
                {(danos.length > 0 || fotos.length > 0 || observaciones.length > 0) ? "Ver / Editar inspección" : "Registrar inspección"}
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
                <button className="btn w-full justify-start bg-white border border-[var(--border)] shadow-sm">
                  Firmar aquí
                </button>
                <button className="btn w-full justify-start bg-white border border-[var(--border)] shadow-sm">
                  ✉ Solicitar firma a {cliente.email || "cliente"}
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="mt-2 pt-4 border-t border-[var(--border)] flex justify-end gap-3 flex-shrink-0 bg-white dark:bg-[var(--bg-card)]">
          <button className="btn-primary bg-blue-700 hover:bg-blue-800 border-transparent shadow flex items-center gap-2">
            <Printer size={16} /> Imprimir
          </button>
          <button className="btn bg-white border border-[var(--border)] shadow-sm flex items-center gap-2">
            <FileDown size={16} /> PDF
          </button>
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
    </AppShell>
  );
}
