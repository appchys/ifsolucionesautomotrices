"use client";

import { useEffect, useState, useMemo } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { X, ClipboardList, FileDown, FileText, Wrench } from "lucide-react";
import { useChatStore, useUIStore, useAuthStore } from "@/store";
import { getUsuarios, updateOrden, uploadOrdenFoto } from "@/lib/services";
import { db } from "@/lib/firebase";
import { OrdenTrabajo, AppUser, Vehiculo, Cliente, DanoVehiculo, FotoDiagnostico } from "@/types";
import ChatOrden from "../ordenes/ChatOrden";
import ModalInspeccion from "../recepcion/ModalInspeccion";
import { toast } from "react-hot-toast";

export default function ActiveChatPanel() {
  const { user } = useAuthStore();
  const { activeChatId, setActiveChatId, isInboxOpen } = useChatStore();
  const { sidebarOpen } = useUIStore();

  const [orden, setOrden] = useState<OrdenTrabajo | null>(null);
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);

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
        <div className="flex gap-2.5 items-center min-w-0">
          <div className={`p-1.5 rounded-lg shrink-0 ${iconColor}`}>
            <Icon size={14} />
          </div>
          <div className="min-w-0">
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
