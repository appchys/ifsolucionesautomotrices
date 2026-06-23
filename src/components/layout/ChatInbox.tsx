"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  X, Search, ClipboardList, FileDown, FileText, Wrench, MessageSquare 
} from "lucide-react";
import { useChatStore, useUIStore, useAuthStore } from "@/store";
import { 
  subscribeOrdenes, 
  subscribeAllMensajes, 
  getUsuarios, 
  subscribeClientes, 
  subscribeVehiculos,
  getClientes,
  getVehiculos
} from "@/lib/services";
import { OrdenTrabajo, MensajeOrden, AppUser, Cliente, Vehiculo } from "@/types";

function formatRelativeTime(timestamp: any): string {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Ahora mismo";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  if (diffDays === 1) return "Ayer";
  return date.toLocaleDateString("es-EC", { day: "numeric", month: "short" });
}

export default function ChatInbox() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { isInboxOpen, setInboxOpen, setUnreadCount, activeOrdenId, activeChatId, setActiveChatId } = useChatStore();
  const { sidebarOpen } = useUIStore();

  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [todosLosMensajes, setTodosLosMensajes] = useState<MensajeOrden[]>([]);
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Cargar datos iniciales y configurar suscripciones
  useEffect(() => {
    // 1. Cargar usuarios (una sola vez)
    getUsuarios()
      .then(setUsuarios)
      .catch(console.error);

    // 2. Carga inicial asíncrona de clientes y vehículos para asegurar datos inmediatos
    getClientes()
      .then(setClientes)
      .catch((err) => console.error("Error al cargar clientes estáticos:", err));

    getVehiculos()
      .then(setVehiculos)
      .catch((err) => console.error("Error al cargar vehículos estáticos:", err));

    // 3. Suscribirse a los cambios en tiempo real
    const unsubOrdenes = subscribeOrdenes(
      (data) => {
        setOrdenes(data);
        setLoading(false);
      },
      (err) => console.error("Error al suscribirse a órdenes:", err)
    );

    const unsubMensajes = subscribeAllMensajes(
      (data) => {
        setTodosLosMensajes(data);
      },
      (err) => {
        console.warn("Suscripción collectionGroup a mensajes falló. ¿Falta índice?:", err);
      }
    );

    const unsubClientes = subscribeClientes(
      (data) => setClientes(data),
      (err) => console.error("Error al suscribirse en tiempo real a clientes:", err)
    );

    const unsubVehiculos = subscribeVehiculos(
      (data) => setVehiculos(data),
      (err) => console.error("Error al suscribirse en tiempo real a vehículos:", err)
    );

    return () => {
      unsubOrdenes();
      unsubMensajes();
      unsubClientes();
      unsubVehiculos();
    };
  }, []);

  // Agrupar mensajes por ordenId y calcular no leídos
  const conversaciones = useMemo(() => {
    if (!user) return [];

    // Agrupar mensajes
    const mensajesPorOrden: Record<string, MensajeOrden[]> = {};
    todosLosMensajes.forEach((msg) => {
      if (!msg.ordenId) return;
      if (!mensajesPorOrden[msg.ordenId]) {
        mensajesPorOrden[msg.ordenId] = [];
      }
      mensajesPorOrden[msg.ordenId].push(msg);
    });

    console.log("ChatInbox [conversaciones] recalculando:", {
      todosLosMensajesCount: todosLosMensajes.length,
      ordenesCount: ordenes.length,
      vehiculosCount: vehiculos.length,
      clientesCount: clientes.length
    });

    // Crear lista de conversaciones
    const lista = Object.entries(mensajesPorOrden)
      .map(([ordenId, msgs]) => {
        // Las consultas de collectionGroup vienen ordenadas desc, por lo que msgs[0] es el último mensaje
        const ultimoMensaje = msgs[0];
        const rawOrden = ordenes.find((o) => o.id === ordenId);
        
        // Si la orden asociada fue eliminada de la base de datos, filtramos esta conversación para que no aparezca
        if (!rawOrden) return null;

        // Poblar relaciones en tiempo real
        const vehiculoAsociado = vehiculos.find((v) => v.id === rawOrden.vehiculoId);
        const clienteAsociado = clientes.find((c) => c.id === rawOrden.clienteId);
        
        const ordenAsociada = {
          ...rawOrden,
          vehiculo: vehiculoAsociado,
          cliente: clienteAsociado
        };

        // Calcular unread count
        const lastRead = localStorage.getItem(`chat_last_read_${user.uid}_${ordenId}`);
        let unreadCount = 0;

        if (activeOrdenId !== ordenId) {
          if (!lastRead) {
            // Si no se ha leído nunca y el último no es del usuario actual
            if (ultimoMensaje && ultimoMensaje.autorId !== user.uid) {
              // Contamos cuántos mensajes son de otros
              unreadCount = msgs.filter((m) => m.autorId !== user.uid).length;
            }
          } else {
            const lastReadTime = parseInt(lastRead, 10);
            unreadCount = msgs.filter((m) => {
              if (m.autorId === user.uid) return false;
              const mTime = m.createdAt?.toDate ? m.createdAt.toDate().getTime() : Date.now();
              return mTime > lastReadTime;
            }).length;
          }
        }

        return {
          ordenId,
          orden: ordenAsociada,
          ultimoMensaje,
          unreadCount,
        };
      })
      .filter(Boolean) as {
        ordenId: string;
        orden: OrdenTrabajo;
        ultimoMensaje: MensajeOrden;
        unreadCount: number;
      }[];

    // Ordenar conversaciones por la fecha del último mensaje
    return lista.sort((a, b) => {
      const timeA = a.ultimoMensaje?.createdAt?.toDate
        ? a.ultimoMensaje.createdAt.toDate().getTime()
        : 0;
      const timeB = b.ultimoMensaje?.createdAt?.toDate
        ? b.ultimoMensaje.createdAt.toDate().getTime()
        : 0;
      return timeB - timeA;
    });
  }, [todosLosMensajes, ordenes, user, activeOrdenId, clientes, vehiculos]);

  // Actualizar unreadCount total en el store global
  useEffect(() => {
    const totalUnread = conversaciones.reduce((acc, curr) => acc + curr.unreadCount, 0);
    setUnreadCount(totalUnread);
  }, [conversaciones, setUnreadCount]);

  // Cerrar panel al clicar fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const inboxEl = document.getElementById("chat-inbox-panel");
      const toggleButtonEl = document.getElementById("sidebar-chat-toggle");
      const chatPanelEl = document.getElementById("active-chat-panel");

      if (
        inboxEl &&
        !inboxEl.contains(event.target as Node) &&
        (!chatPanelEl || !chatPanelEl.contains(event.target as Node)) &&
        (!toggleButtonEl || !toggleButtonEl.contains(event.target as Node))
      ) {
        setInboxOpen(false);
      }
    };

    if (isInboxOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isInboxOpen, setInboxOpen]);

  // Filtrar por la búsqueda
  const conversacionesFiltradas = useMemo(() => {
    if (!searchQuery.trim()) return conversaciones;
    const query = searchQuery.toLowerCase();
    return conversaciones.filter((c) => {
      const orden = c.orden;
      if (!orden) return false;

      const numStr = orden.esCotizacion 
        ? `presupuesto cotizacion #${orden.numeroCotizacion || orden.numero || ""}`
        : orden.numeroOrden 
          ? `orden #${orden.numeroOrden || ""}` 
          : `ingreso #${orden.numeroIngreso || orden.numero || ""}`;

      const clientName = `${orden.cliente?.nombre || ""} ${orden.cliente?.apellido || ""}`.toLowerCase();
      const placa = (orden.vehiculo?.placa || "").toLowerCase();
      const marca = (orden.vehiculo?.marca || "").toLowerCase();
      const modelo = (orden.vehiculo?.modelo || "").toLowerCase();
      const textoMensaje = (c.ultimoMensaje?.texto || "").toLowerCase();

      return (
        numStr.toLowerCase().includes(query) ||
        clientName.includes(query) ||
        placa.includes(query) ||
        marca.includes(query) ||
        modelo.includes(query) ||
        textoMensaje.includes(query)
      );
    });
  }, [conversaciones, searchQuery]);

  const handleItemClick = (ordenId: string, orden?: OrdenTrabajo) => {
    // Marcar como leído inmediatamente
    if (user) {
      localStorage.setItem(`chat_last_read_${user.uid}_${ordenId}`, Date.now().toString());
    }
    // Abrir o alternar el chat en el panel lateral derecho secundario
    if (activeChatId === ordenId) {
      setActiveChatId(null);
    } else {
      setActiveChatId(ordenId);
    }
  };

  return (
    <div
      id="chat-inbox-panel"
      className={`chat-inbox-panel ${isInboxOpen ? "open" : ""} ${
        sidebarOpen ? "sidebar-open-offset" : ""
      }`}
    >
      {/* Header */}
      <div className="chat-inbox-header">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-blue-600" />
          <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
            Bandeja de Chats
          </h2>
        </div>
        <button
          onClick={() => setInboxOpen(false)}
          className="btn-ghost btn-icon hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg p-1.5 cursor-pointer border-0"
          title="Cerrar panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Buscador */}
      <div className="p-3 border-b border-[var(--border-light)] bg-[var(--bg-primary)]">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Buscar por placa, cliente o nro..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-white border border-[var(--border)] text-[var(--text-primary)] placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Listado de conversaciones */}
      <div className="chat-inbox-list custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <div className="spinner mb-3" />
            <p className="text-[11px]">Cargando conversaciones...</p>
          </div>
        ) : conversacionesFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-slate-500">
            <MessageSquare size={36} className="text-slate-600 mb-2 opacity-50" />
            <p className="text-xs font-semibold text-slate-400">Sin mensajes</p>
            <p className="text-[10px] text-slate-500 mt-1 max-w-[200px]">
              {searchQuery ? "No se encontraron chats que coincidan con la búsqueda." : "Los chats iniciados en ingresos u órdenes aparecerán aquí."}
            </p>
          </div>
        ) : (
          conversacionesFiltradas.map((c) => {
            const orden = c.orden;
            const ultimoMsg = c.ultimoMensaje;
            
            // Determinar tipo e ícono
            let title = "Chat Interno";
            let Icon = Wrench;
            let iconColor = "text-blue-400 bg-blue-500/10";
            let subtitle = "";

            if (orden) {
              let docType = "";
              if (orden.esCotizacion) {
                docType = `Presupuesto #${orden.numeroCotizacion || orden.numero || ""}`;
                Icon = FileText;
                iconColor = "text-purple-400 bg-purple-500/10";
              } else if (orden.numeroOrden) {
                docType = `Orden #${orden.numeroOrden}`;
                Icon = ClipboardList;
                iconColor = "text-emerald-400 bg-emerald-500/10";
              } else {
                docType = `Ingreso #${orden.numeroIngreso || orden.numero || ""}`;
                Icon = FileDown;
                iconColor = "text-amber-400 bg-amber-500/10";
              }

              const placa = orden.vehiculo?.placa || "";
              const clienteStr = orden.cliente ? `${orden.cliente.nombre} ${orden.cliente.apellido}` : "";

              if (placa) {
                title = `${placa} - ${docType}`;
              } else if (clienteStr) {
                title = `${clienteStr} - ${docType}`;
              } else {
                title = docType;
              }

              // Vehículo y cliente para el subtítulo
              const vehiculoStr = orden.vehiculo ? `${orden.vehiculo.marca} ${orden.vehiculo.modelo}` : "";
              subtitle = [vehiculoStr, clienteStr].filter(Boolean).join(" - ");
            } else {
              // Si no encontramos la orden en el listado cargado
              title = `Chat ID: ...${c.ordenId.slice(-6)}`;
            }

            // Nombre autor del último mensaje
            const autorDb = usuarios.find((u) => u.uid === ultimoMsg?.autorId);
            const autorNombre = ultimoMsg?.autorId === user?.uid 
              ? "Tú" 
              : (autorDb?.displayName?.split(" ")[0] || ultimoMsg?.autorNombre || "Usuario");

            return (
              <button
                key={c.ordenId}
                onClick={() => handleItemClick(c.ordenId, orden)}
                className={`w-full chat-inbox-item ${
                  c.ordenId === activeChatId
                    ? "active"
                    : c.unreadCount > 0
                      ? "bg-blue-50/50 dark:bg-[#182339]/20"
                      : ""
                }`}
              >
                <div className="flex gap-3 items-start">
                  {/* Icono de tipo */}
                  <div className={`p-2 rounded-xl shrink-0 ${iconColor}`}>
                    <Icon size={16} />
                  </div>

                  {/* Detalle */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-1">
                      <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {title}
                      </h4>
                      <span className="text-[9px] text-slate-400 shrink-0 font-medium">
                        {formatRelativeTime(ultimoMsg?.createdAt)}
                      </span>
                    </div>

                    {subtitle && (
                      <p className="text-[10px] text-[var(--text-secondary)] truncate mt-0.5 font-semibold">
                        {subtitle}
                      </p>
                    )}

                    {ultimoMsg && (
                      <p className="text-[11px] text-slate-500 truncate mt-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 mr-1">
                          {autorNombre}:
                        </span>
                        {ultimoMsg.texto}
                      </p>
                    )}
                  </div>

                  {/* Badge de No Leídos */}
                  {c.unreadCount > 0 && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0 shadow-sm animate-pulse-glow">
                      {c.unreadCount}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
