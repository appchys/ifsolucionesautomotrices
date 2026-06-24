"use client";

import { useEffect, useState, useMemo } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { X, ClipboardList, FileDown, FileText, Wrench, ArrowLeft, ChevronRight, Copy, User, Phone, Mail, ClipboardCheck } from "lucide-react";
import { useChatStore, useUIStore, useAuthStore } from "@/store";
import { getUsuarios, updateOrden, uploadOrdenFoto, getIngresoOrigenDePresupuesto, getPresupuestoPorIngreso } from "@/lib/services";
import { db } from "@/lib/firebase";
import { OrdenTrabajo, AppUser, Vehiculo, Cliente, DanoVehiculo, FotoDiagnostico } from "@/types";
import ChatOrden from "../ordenes/ChatOrden";
import ModalInspeccion from "../recepcion/ModalInspeccion";
import { toast } from "react-hot-toast";

import { useRouter } from "next/navigation";

export default function ActiveChatPanel() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeChatId, setActiveChatId, isInboxOpen } = useChatStore();
  const { sidebarOpen, setIngresoSidebarOpen, setPresupuestoSidebarOpen, setOrdenSidebarOpen } = useUIStore();

  const [orden, setOrden] = useState<OrdenTrabajo | null>(null);
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);

  // Estados para el menú de detalles del chat
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [ingresoIdRel, setIngresoIdRel] = useState<string | null>(null);
  const [presupuestoIdRel, setPresupuestoIdRel] = useState<string | null>(null);
  const [ordenIdRel, setOrdenIdRel] = useState<string | null>(null);

  // Cargar IDs de documentos vinculados (Ingreso, Presupuesto, Orden)
  useEffect(() => {
    async function cargarRelaciones() {
      if (!orden) {
        setIngresoIdRel(null);
        setPresupuestoIdRel(null);
        setOrdenIdRel(null);
        return;
      }

      if (orden.esCotizacion) {
        setPresupuestoIdRel(orden.id || null);
        try {
          const ingreso = await getIngresoOrigenDePresupuesto(orden);
          if (ingreso) {
            setIngresoIdRel(ingreso.id || null);
            if (ingreso.numeroOrden) {
              setOrdenIdRel(ingreso.id || null);
            } else {
              setOrdenIdRel(null);
            }
          } else {
            setIngresoIdRel(null);
            setOrdenIdRel(null);
          }
        } catch (err) {
          console.error("Error al cargar ingreso origen:", err);
          setIngresoIdRel(null);
          setOrdenIdRel(null);
        }
      } else {
        setIngresoIdRel(orden.id || null);
        if (orden.numeroOrden) {
          setOrdenIdRel(orden.id || null);
        } else {
          setOrdenIdRel(null);
        }

        try {
          const numIngreso = orden.numeroIngreso || orden.numero || 0;
          const presupuesto = await getPresupuestoPorIngreso(numIngreso, orden.vehiculoId);
          if (presupuesto) {
            setPresupuestoIdRel(presupuesto.id || null);
          } else {
            setPresupuestoIdRel(null);
          }
        } catch (err) {
          console.error("Error al cargar presupuesto relacionado:", err);
          setPresupuestoIdRel(null);
        }
      }
    }

    cargarRelaciones();
  }, [orden]);

  // Si cambia el chat activo, cerramos el menú de detalles
  useEffect(() => {
    setIsMenuOpen(false);
  }, [activeChatId]);

  // Estados locales para el modal de inspección
  const [isModalInspeccionOpen, setIsModalInspeccionOpen] = useState(false);
  const [danos, setDanos] = useState<DanoVehiculo[]>([]);
  const [observaciones, setObservaciones] = useState("");
  const [fotos, setFotos] = useState<FotoDiagnostico[]>([]);

  // Sincronizar estados locales de la inspección cuando cambia la orden
  useEffect(() => {
    if (orden) {
      setDanos(orden.inspeccionVisual?.danos || []);
      setObservaciones(orden.notasInternas || "");
      setFotos((orden.fotoUrls || []).map((url) => ({ url, descripcion: "" })));
    }
  }, [orden]);

  const handleSaveInspeccion = async () => {
    if (!activeChatId) return;
    try {
      await updateOrden(activeChatId, {
        inspeccionVisual: {
          ...orden?.inspeccionVisual,
          danos: danos
        },
        notasInternas: observaciones,
        fotoUrls: fotos.map((f) => f.url)
      });
      toast.success("Inspección guardada correctamente");
      setIsModalInspeccionOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar inspección");
    }
  };

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeChatId) return;

    const toastId = toast.loading("Subiendo foto...");
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadOrdenFoto(activeChatId, files[i]);
        urls.push(url);
      }
      const existingUrls = orden?.fotoUrls || [];
      const updatedUrls = [...existingUrls, ...urls];
      await updateOrden(activeChatId, { fotoUrls: updatedUrls });
      setFotos(updatedUrls.map((url) => ({ url, descripcion: "" })));
      toast.success("Foto(s) agregada(s)", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Error al subir foto", { id: toastId });
    }
  };

  const handleUpdateFoto = (url: string, descripcion: string) => {
    setFotos((prev) =>
      prev.map((f) => (f.url === url ? { ...f, descripcion } : f))
    );
  };

  const handleRemoveFoto = async (index: number) => {
    if (!confirm("¿Seguro que deseas eliminar esta foto?")) return;
    if (!activeChatId) return;
    try {
      const urls = [...(orden?.fotoUrls || [])];
      urls.splice(index, 1);
      await updateOrden(activeChatId, { fotoUrls: urls });
      setFotos(urls.map((url) => ({ url, descripcion: "" })));
      toast.success("Foto eliminada");
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar foto");
    }
  };

  // Cargar usuarios al montar
  useEffect(() => {
    getUsuarios()
      .then(setUsuarios)
      .catch(console.error);
  }, []);

  // Escuchar la orden activa en tiempo real para obtener personalAsignado y metadatos
  useEffect(() => {
    if (!activeChatId) {
      setOrden(null);
      return;
    }

    setLoading(true);
    const docRef = doc(db, "ordenesTrabajo", activeChatId);
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        setLoading(false);
        if (snap.exists()) {
          setOrden({ id: snap.id, ...snap.data() } as OrdenTrabajo);
        } else {
          setOrden(null);
        }
      },
      (err) => {
        console.error("Error al escuchar orden activa del chat:", err);
        setLoading(false);
      }
    );

    return unsub;
  }, [activeChatId]);

  // Escuchar vehículo de la orden activa en tiempo real
  useEffect(() => {
    if (!orden?.vehiculoId) {
      setVehiculo(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "vehiculos", orden.vehiculoId),
      (snap) => {
        if (snap.exists()) {
          setVehiculo({ id: snap.id, ...snap.data() } as Vehiculo);
        } else {
          setVehiculo(null);
        }
      },
      (err) => console.error("Error al escuchar vehículo del chat:", err)
    );
    return unsub;
  }, [orden?.vehiculoId]);

  // Escuchar cliente de la orden activa en tiempo real
  useEffect(() => {
    if (!orden?.clienteId) {
      setCliente(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "clientes", orden.clienteId),
      (snap) => {
        if (snap.exists()) {
          setCliente({ id: snap.id, ...snap.data() } as Cliente);
        } else {
          setCliente(null);
        }
      },
      (err) => console.error("Error al escuchar cliente del chat:", err)
    );
    return unsub;
  }, [orden?.clienteId]);

  // Cerrar al hacer clic fuera (tanto del chat panel como de la bandeja)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const chatPanelEl = document.getElementById("active-chat-panel");
      const inboxPanelEl = document.getElementById("chat-inbox-panel");
      const toggleButtonEl = document.getElementById("sidebar-chat-toggle");

      if (
        chatPanelEl &&
        !chatPanelEl.contains(event.target as Node) &&
        (!inboxPanelEl || !inboxPanelEl.contains(event.target as Node)) &&
        (!toggleButtonEl || !toggleButtonEl.contains(event.target as Node))
      ) {
        setActiveChatId(null);
      }
    };

    if (activeChatId) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeChatId, setActiveChatId]);

  // Fusionar orden con vehículo y cliente para derivar datos
  const populatedOrden = useMemo(() => {
    if (!orden) return null;
    return {
      ...orden,
      vehiculo: vehiculo || undefined,
      cliente: cliente || undefined
    };
  }, [orden, vehiculo, cliente]);

  // Si no hay chat activo o la bandeja de entrada está cerrada, no mostramos nada
  if (!activeChatId || !isInboxOpen) return null;

  // Determinar íconos y título del header
  let title = "Chat";
  let Icon = Wrench;
  let iconColor = "text-blue-400 bg-blue-500/10";
  let subtitle = "";

  if (populatedOrden) {
    let docType = "";
    if (populatedOrden.esCotizacion) {
      docType = `Presupuesto #${populatedOrden.numeroCotizacion || populatedOrden.numero || ""}`;
      Icon = FileText;
      iconColor = "text-purple-400 bg-purple-500/10";
    } else if (populatedOrden.numeroOrden) {
      docType = `Orden #${populatedOrden.numeroOrden}`;
      Icon = ClipboardList;
      iconColor = "text-emerald-400 bg-emerald-500/10";
    } else {
      docType = `Ingreso #${populatedOrden.numeroIngreso || populatedOrden.numero || ""}`;
      Icon = FileDown;
      iconColor = "text-amber-400 bg-amber-500/10";
    }

    const placa = populatedOrden.vehiculo?.placa || "";
    const clienteStr = populatedOrden.cliente ? `${populatedOrden.cliente.nombre} ${populatedOrden.cliente.apellido}` : "";

    if (placa) {
      title = `${placa} - ${docType}`;
    } else if (clienteStr) {
      title = `${clienteStr} - ${docType}`;
    } else {
      title = docType;
    }

    const vehiculoStr = populatedOrden.vehiculo ? `${populatedOrden.vehiculo.marca} ${populatedOrden.vehiculo.modelo}` : "";
    subtitle = [vehiculoStr, clienteStr].filter(Boolean).join(" - ");
  }

  return (
    <div
      id="active-chat-panel"
      className={`active-chat-panel ${activeChatId ? "open" : ""} ${
        sidebarOpen ? "sidebar-open-offset" : ""
      }`}
    >
      {/* Header */}
      <div className="chat-inbox-header justify-between flex items-center bg-[var(--bg-primary)] border-b border-[var(--border-light)] px-3 py-2">
        <div 
          onClick={() => setIsMenuOpen(true)}
          className="flex gap-2.5 items-center min-w-0 flex-1 hover:bg-slate-50 dark:hover:bg-slate-800/40 p-1 rounded-lg cursor-pointer transition-colors"
          title="Ver detalles del chat"
        >
          <div className={`p-1.5 rounded-lg shrink-0 ${iconColor}`}>
            <Icon size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
              {title}
            </h4>
            {subtitle && (
              <p className="text-[9px] text-[var(--text-secondary)] truncate mt-0.5 font-medium">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setActiveChatId(null)}
          className="btn-ghost btn-icon hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg p-1.5 cursor-pointer border-0"
          title="Cerrar chat"
        >
          <X size={14} />
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 min-h-0 bg-white relative">
        {loading && !orden ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-white">
            <div className="spinner mb-3" />
            <p className="text-[11px]">Cargando chat...</p>
          </div>
        ) : orden ? (
          <ChatOrden
            ordenId={activeChatId}
            personalAsignado={orden.personalAsignado || []}
            todosLosUsuarios={usuarios}
            onOpenInspeccion={() => setIsModalInspeccionOpen(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 px-4">
            <p className="text-xs font-semibold text-slate-400">Error al cargar chat</p>
            <p className="text-[10px] text-slate-500 mt-1">No se pudo encontrar la orden o ingreso seleccionado.</p>
          </div>
        )}
      </div>

      {/* Menú de Detalles del Chat */}
      {isMenuOpen && (
        <div className="absolute inset-0 z-20 bg-slate-50 dark:bg-slate-900 flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header del Menú */}
          <div className="flex items-center gap-3 bg-[var(--bg-primary)] border-b border-[var(--border-light)] px-3 py-3 select-none">
            <button
              type="button"
              onClick={() => setIsMenuOpen(false)}
              className="btn-ghost btn-icon hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg p-1.5 cursor-pointer text-slate-600 dark:text-slate-300 border-0"
              title="Volver al chat"
            >
              <ArrowLeft size={16} />
            </button>
            <h3 className="text-xs font-extrabold text-[var(--text-primary)]">
              Detalles del Chat
            </h3>
          </div>

          {/* Contenido del Menú */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Perfil */}
            <div className="flex flex-col items-center text-center pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-extrabold text-lg shadow-md mb-2">
                {vehiculo ? (vehiculo.placa ? vehiculo.placa.slice(0, 3) : "VEH") : "CH"}
              </div>
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                {title.split(" - ")[0]}
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </p>
            </div>

            {/* Fila de Botones Rápidos */}
            <div className="grid grid-cols-3 gap-2">
               {/* Botón Ingreso */}
              <button
                type="button"
                id="btn-abrir-ingreso-sidebar"
                onClick={() => ingresoIdRel && setIngresoSidebarOpen(true, ingresoIdRel)}
                disabled={!ingresoIdRel}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border bg-white dark:bg-slate-850 shadow-sm transition-all duration-200 ${
                  ingresoIdRel
                    ? "border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer active:scale-95 text-indigo-600 dark:text-indigo-400"
                    : "border-slate-100 dark:border-slate-900 opacity-40 cursor-not-allowed text-slate-400"
                }`}
              >
                <FileDown size={18} />
                <span className="text-[9px] font-bold mt-1.5 text-slate-700 dark:text-slate-350">
                  Ingreso
                </span>
                {!ingresoIdRel && (
                  <span className="text-[7px] text-slate-400 font-medium">No disponible</span>
                )}
              </button>

              {/* Botón Presupuesto */}
              <button
                type="button"
                id="btn-abrir-presupuesto-sidebar"
                onClick={() => presupuestoIdRel && setPresupuestoSidebarOpen(true, presupuestoIdRel)}
                disabled={!presupuestoIdRel}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border bg-white dark:bg-slate-850 shadow-sm transition-all duration-200 ${
                  presupuestoIdRel
                    ? "border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer active:scale-95 text-amber-500 dark:text-amber-400"
                    : "border-slate-100 dark:border-slate-900 opacity-40 cursor-not-allowed text-slate-400"
                }`}
              >
                <FileText size={18} />
                <span className="text-[9px] font-bold mt-1.5 text-slate-700 dark:text-slate-350">
                  Presupuesto
                </span>
                {!presupuestoIdRel && (
                  <span className="text-[7px] text-slate-400 font-medium">No creado</span>
                )}
              </button>

              {/* Botón Orden */}
              <button
                type="button"
                id="btn-abrir-orden-sidebar"
                onClick={() => ordenIdRel && setOrdenSidebarOpen(true, ordenIdRel)}
                disabled={!ordenIdRel}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border bg-white dark:bg-slate-850 shadow-sm transition-all duration-200 ${
                  ordenIdRel
                    ? "border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer active:scale-95 text-emerald-600 dark:text-emerald-400"
                    : "border-slate-100 dark:border-slate-900 opacity-40 cursor-not-allowed text-slate-400"
                }`}
              >
                <ClipboardList size={18} />
                <span className="text-[9px] font-bold mt-1.5 text-slate-700 dark:text-slate-350">
                  Orden
                </span>
                {!ordenIdRel && (
                  <span className="text-[7px] text-slate-400 font-medium">No creada</span>
                )}
              </button>
            </div>

            {/* Lista de Opciones - Grupo 1 */}
            <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-sm">
              {/* Opción Inspección */}
              <button
                type="button"
                onClick={() => {
                  setIsModalInspeccionOpen(true);
                }}
                className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800/60 text-left border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 bg-green-500/10 rounded-lg flex items-center justify-center text-green-600">
                    <ClipboardCheck size={14} className="shrink-0" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold text-slate-800 dark:text-slate-250">
                      Inspección Visual de Ingreso
                    </p>
                    <p className="text-[8px] text-slate-400">Ver y editar daños o fotos del vehículo</p>
                  </div>
                </div>
                <ChevronRight size={12} className="text-slate-400" />
              </button>

              {/* Opción Copiar ID */}
              <button
                type="button"
                onClick={async () => {
                  if (activeChatId) {
                    await navigator.clipboard.writeText(activeChatId);
                    toast.success("ID de orden copiado al portapapeles");
                  }
                }}
                className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors text-left border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-600">
                    <Copy size={14} />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold text-slate-800 dark:text-slate-250">
                      Copiar ID de la Orden
                    </p>
                    <p className="text-[8px] text-slate-400 truncate max-w-[180px]">{activeChatId}</p>
                  </div>
                </div>
                <ChevronRight size={12} className="text-slate-400" />
              </button>
            </div>

            {/* Lista de Opciones - Grupo 2 (Cliente) */}
            {cliente && (
              <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-sm p-4 space-y-3.5">
                <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  Información del Cliente
                </h5>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <User size={13} className="text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-[8px] text-slate-400">Nombre</p>
                      <p className="text-[10px] font-bold text-slate-800 dark:text-slate-250">
                        {cliente.nombre} {cliente.apellido}
                      </p>
                    </div>
                  </div>
                  {cliente.telefono && (
                    <div className="flex items-start gap-3">
                      <Phone size={13} className="text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-[8px] text-slate-400">Teléfono</p>
                        <p className="text-[10px] font-bold text-slate-800 dark:text-slate-250">
                          {cliente.telefono}
                        </p>
                      </div>
                    </div>
                  )}
                  {cliente.email && (
                    <div className="flex items-start gap-3">
                      <Mail size={13} className="text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-[8px] text-slate-400">Correo Electrónico</p>
                        <p className="text-[10px] font-bold text-slate-800 dark:text-slate-250 truncate max-w-[200px]">
                          {cliente.email}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {vehiculo && (
        <ModalInspeccion
          isOpen={isModalInspeccionOpen}
          onClose={() => setIsModalInspeccionOpen(false)}
          vehiculo={vehiculo}
          danos={danos}
          onChangeDanos={setDanos}
          onSave={handleSaveInspeccion}
          fotos={fotos}
          onUploadFoto={handleUploadFoto}
          onUpdateFoto={handleUpdateFoto}
          onRemoveFoto={handleRemoveFoto}
          observaciones={observaciones}
          onChangeObservaciones={setObservaciones}
        />
      )}
    </div>
  );
}
