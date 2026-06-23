"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Users, UserPlus } from "lucide-react";
import { MensajeOrden, AppUser, UserRole } from "@/types";
import { sendMensajeOrden, subscribeMensajesOrden } from "@/lib/services";
import { useAuthStore } from "@/store";
import { useChatStore } from "@/store/chatStore";
import { toast } from "react-hot-toast";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";

interface ChatOrdenProps {
  ordenId: string;
  personalAsignado: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
  }[];
  todosLosUsuarios: AppUser[];
}

/* Genera un "pop" corto usando Web Audio API */
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(587, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);

    // Segundo tono para darle ese sonido "pop-pop"
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1174, ctx.currentTime + 0.06);
    osc2.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.14);
    gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc2.start(ctx.currentTime + 0.06);
    osc2.stop(ctx.currentTime + 0.2);

    setTimeout(() => ctx.close(), 500);
  } catch {
    /* Audio API no disponible */
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";

  return date.toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
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

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  gerente: "Gerente",
  tecnico: "Técnico",
  recepcion: "Recepción",
  contador: "Contador",
  asesor_servicio: "Asesor",
  logistica: "Logística",
};

export default function ChatOrden({
  ordenId,
  personalAsignado,
  todosLosUsuarios,
}: ChatOrdenProps) {
  const { user } = useAuthStore();
  const { resetUnread, setActiveOrdenId } = useChatStore();
  const [mensajes, setMensajes] = useState<MensajeOrden[]>([]);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [showAddParticipants, setShowAddParticipants] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const initialLoadRef = useRef(true);
  const [lecturas, setLecturas] = useState<Record<string, any>>({});
  const [ordenData, setOrdenData] = useState<any>(null);

  // Cerrar selector de participantes al clicar fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowAddParticipants(false);
      }
    };
    if (showAddParticipants) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAddParticipants]);

  const tecnicosDisponibles = todosLosUsuarios.filter(
    (u) => u.role === "tecnico" && u.activo !== false
  );

  const participantsList = personalAsignado || [];

  const handleToggleParticipant = async (tecnico: AppUser) => {
    const isAssigned = participantsList.some((p) => p.uid === tecnico.uid);
    let nuevos: {
      uid: string;
      email: string;
      displayName: string;
      role: UserRole;
    }[];

    if (isAssigned) {
      nuevos = participantsList.filter((p) => p.uid !== tecnico.uid);
    } else {
      nuevos = [
        ...participantsList,
        {
          uid: tecnico.uid,
          email: tecnico.email || "",
          displayName: tecnico.displayName || "",
          role: tecnico.role || "tecnico"
        }
      ];
    }

    try {
      await updateDoc(doc(db, "ordenesTrabajo", ordenId), {
        personalAsignado: nuevos
      });
      toast.success(isAssigned ? "Técnico removido del chat" : "Técnico asignado al chat");

      // Determinar el nombre del tipo de documento para el mensaje
      let docName = "ingreso";
      if (ordenData) {
        if (ordenData.esCotizacion) {
          docName = "presupuesto";
        } else if (ordenData.numeroOrden) {
          docName = "orden";
        }
      }

      // Mensaje de sistema estilo WhatsApp (fallback neutro en tercera persona)
      const txt = isAssigned
        ? `Se removió al técnico ${tecnico.displayName} de este ${docName}.`
        : `Se asignó al técnico ${tecnico.displayName} a este ${docName}.`;

      await sendMensajeOrden(ordenId, {
        autorId: "sistema",
        autorNombre: "Sistema",
        autorRole: "admin" as UserRole,
        texto: txt,
        sistema: true,
        tecnicoAfectadoId: tecnico.uid,
        tecnicoAfectadoNombre: tecnico.displayName,
        accionSistema: isAssigned ? "remover" : "asignar"
      });
    } catch (err) {
      console.error("Error al actualizar participantes del chat:", err);
      toast.error("Error al actualizar participantes");
    }
  };

  // Escuchar lecturas de la orden en tiempo real
  useEffect(() => {
    if (!ordenId) return;
    const unsub = onSnapshot(doc(db, "ordenesTrabajo", ordenId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLecturas(data.lecturas || {});
        setOrdenData(data);
      }
    });
    return unsub;
  }, [ordenId]);

  // Actualizar lectura del usuario actual al abrir o recibir mensajes
  const updateLectura = useCallback(() => {
    if (user?.uid && ordenId) {
      updateDoc(doc(db, "ordenesTrabajo", ordenId), {
        [`lecturas.${user.uid}`]: serverTimestamp()
      }).catch(console.error);
    }
  }, [user?.uid, ordenId]);

  useEffect(() => {
    updateLectura();
  }, [ordenId, mensajes, updateLectura]);

  // Set active orden and reset on unmount
  useEffect(() => {
    setActiveOrdenId(ordenId);
    if (user?.uid && ordenId) {
      localStorage.setItem(`chat_last_read_${user.uid}_${ordenId}`, Date.now().toString());
    }
    return () => {
      setActiveOrdenId(null);
      resetUnread();
    };
  }, [ordenId, setActiveOrdenId, resetUnread, user?.uid]);

  // Mark as read in localStorage when messages change (since chat is open)
  useEffect(() => {
    if (user?.uid && ordenId && mensajes.length > 0) {
      localStorage.setItem(`chat_last_read_${user.uid}_${ordenId}`, Date.now().toString());
    }
  }, [mensajes, user?.uid, ordenId]);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "instant",
      });
    }
  }, []);

  // Subscribe to messages
  useEffect(() => {
    const unsub = subscribeMensajesOrden(
      ordenId,
      (msgs) => {
        setMensajes(msgs);

        const isInitial = initialLoadRef.current;
        const newCount = msgs.length;
        const prevCount = prevCountRef.current;

        if (isInitial) {
          initialLoadRef.current = false;
          prevCountRef.current = newCount;
          // Scroll sin animación en la carga inicial
          setTimeout(() => scrollToBottom(false), 50);
          return;
        }

        // Mensaje nuevo
        if (newCount > prevCount) {
          const lastMsg = msgs[msgs.length - 1];
          // Solo sonar si es de otro usuario
          if (lastMsg && lastMsg.autorId !== user?.uid) {
            playNotificationSound();
            useChatStore.getState().incrementUnread();
          }
          setTimeout(() => scrollToBottom(true), 50);
        }

        prevCountRef.current = newCount;
      },
      (err) => {
        console.error("Error en suscripción de chat:", err);
      }
    );
    return unsub;
  }, [ordenId, user?.uid, scrollToBottom]);

  // Reset unread when the user scrolls to the bottom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < 60) {
        resetUnread();
      }
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [resetUnread]);

  const renderChecks = (msg: MensajeOrden) => {
    if (!msg.id || !msg.createdAt) {
      // Enviándose
      return (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-200/50 shrink-0">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    }

    // Comprobar si el mensaje fue leído por algún otro participante
    const isRead = Object.entries(lecturas).some(([uid, time]) => {
      if (uid === user?.uid) return false;
      const readTime = (time as any)?.toDate ? (time as any).toDate().getTime() : 0;
      const msgTime = msg.createdAt?.toDate ? msg.createdAt.toDate().getTime() : Date.now();
      return readTime >= msgTime;
    });

    return (
      <div className="relative flex items-center shrink-0" style={{ width: "15px", height: "10px" }}>
        <svg 
          width="10" 
          height="10" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="3" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="absolute left-0"
          style={{ color: isRead ? "#38bdf8" : "rgba(255, 255, 255, 0.45)" }}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <svg 
          width="10" 
          height="10" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="3" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="absolute"
          style={{ 
            left: "5px",
            color: isRead ? "#38bdf8" : "rgba(255, 255, 255, 0.8)" 
          }}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  };

  const handleSend = async () => {
    if (!texto.trim() || !user || sending) return;
    const msg = texto.trim();
    setTexto("");
    setSending(true);

    try {
      const dbUser = todosLosUsuarios.find((u) => u.uid === user.uid);
      const photoURL = dbUser?.photoURL;
      await sendMensajeOrden(ordenId, {
        autorId: user.uid,
        autorNombre: user.displayName,
        autorRole: user.role,
        ...(photoURL ? { autorPhotoURL: photoURL } : {}),
        texto: msg,
      });
    } catch (err) {
      console.error(err);
      toast.error("Error al enviar mensaje");
      setTexto(msg);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by day
  const groupedMessages: { date: Date; msgs: MensajeOrden[] }[] = [];
  mensajes.forEach((m) => {
    const msgDate = m.createdAt?.toDate
      ? m.createdAt.toDate()
      : new Date();
    const dateStr = msgDate.toDateString();
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date.toDateString() === dateStr) {
      last.msgs.push(m);
    } else {
      groupedMessages.push({ date: msgDate, msgs: [m] });
    }
  });

  // Participants header

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Participants header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-slate-50/50 shrink-0">
        <Users size={13} className="text-slate-400 shrink-0" />
        <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto hide-scrollbar">
          {participantsList.map((p) => {
            const dbUser = todosLosUsuarios.find((u) => u.uid === p.uid);
            const photo = dbUser?.photoURL;
            return (
              <div
                key={p.uid}
                className="flex items-center gap-1.5 shrink-0 bg-white border border-[var(--border)] rounded-full pl-0.5 pr-2 py-0.5"
                title={`${p.displayName} (${ROLE_LABELS[p.role] || p.role})`}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold uppercase overflow-hidden shrink-0"
                  style={{ backgroundColor: getAvatarColor(p.uid) }}
                >
                  {photo ? (
                    <img
                      src={photo}
                      alt={p.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getInitials(p.displayName)
                  )}
                </div>
                <span className="text-[10px] font-semibold text-slate-600 truncate max-w-[70px]">
                  {p.displayName.split(" ")[0]}
                </span>
              </div>
            );
          })}
          {participantsList.length === 0 && (
            <span className="text-[10px] text-slate-400 italic">
              Sin participantes asignados
            </span>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e2e8f0' fill-opacity='0.25'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          backgroundColor: "var(--bg-primary)",
        }}
      >
        {mensajes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/30 dark:to-indigo-950/30 flex items-center justify-center mb-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-xs font-bold text-slate-500 mb-1">
              Inicia la conversación
            </p>
            <p className="text-[10px] text-slate-400 max-w-[200px]">
              Los mensajes son visibles para todos los miembros asignados a esta
              orden.
            </p>
          </div>
        )}

        {groupedMessages.map((group, gi) => (
          <div key={gi}>
            {/* Date separator */}
            <div className="flex justify-center my-3">
              <span className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-[10px] font-bold text-slate-500 px-3 py-1 rounded-full shadow-sm border border-slate-200/50 dark:border-slate-700/50 capitalize">
                {formatDateLabel(group.date)}
              </span>
            </div>

            {group.msgs.map((msg, mi) => {
              if (msg.sistema || msg.autorId === "sistema") {
                let mensajeTexto = msg.texto;
                const esInspeccion = msg.accionSistema === "inspeccion";

                // Generar texto personalizado en tiempo real según el usuario logueado
                if (msg.tecnicoAfectadoId && msg.accionSistema) {
                  if (esInspeccion) {
                    const esUsuarioAfectado = msg.tecnicoAfectadoId === user?.uid;
                    mensajeTexto = esUsuarioAfectado
                      ? "Inspección visual realizada por ti."
                      : `Inspección visual realizada por ${msg.tecnicoAfectadoNombre || "un técnico"}.`;
                  } else {
                    let docName = "ingreso";
                    if (ordenData) {
                      if (ordenData.esCotizacion) {
                        docName = "presupuesto";
                      } else if (ordenData.numeroOrden) {
                        docName = "orden";
                      }
                    }

                    const esUsuarioAfectado = msg.tecnicoAfectadoId === user?.uid;
                    if (esUsuarioAfectado) {
                      mensajeTexto = msg.accionSistema === "asignar"
                        ? `Se te asignó este ${docName}.`
                        : `Se te removió de este ${docName}.`;
                    } else {
                      mensajeTexto = msg.accionSistema === "asignar"
                        ? `Se asignó a ${msg.tecnicoAfectadoNombre || "un técnico"} a este ${docName}.`
                        : `Se removió a ${msg.tecnicoAfectadoNombre || "un técnico"} de este ${docName}.`;
                    }
                  }
                }

                const bgClass = esInspeccion
                  ? "bg-[#dcfce7] dark:bg-[#132d17] text-green-800 dark:text-green-200 border-green-100/50 dark:border-green-950/20"
                  : "bg-[#ffeecd] dark:bg-[#2c2214] text-slate-700 dark:text-amber-200 border-amber-100/50 dark:border-amber-950/20";

                return (
                  <div key={msg.id || mi} className="flex justify-center my-2.5">
                    <div className={`${bgClass} text-[10px] font-medium px-3.5 py-1.5 rounded-lg max-w-[85%] text-center shadow-sm border leading-relaxed`}>
                      {mensajeTexto}
                    </div>
                  </div>
                );
              }

              const isOwn = msg.autorId === user?.uid;
              const msgDate = msg.createdAt?.toDate
                ? msg.createdAt.toDate()
                : new Date();
              const dbUser = todosLosUsuarios.find(
                (u) => u.uid === msg.autorId
              );
              const photo = msg.autorPhotoURL || dbUser?.photoURL;

              // Check if previous message is from the same author (for grouping)
              const prevMsg = mi > 0 ? group.msgs[mi - 1] : null;
              const sameSender = prevMsg?.autorId === msg.autorId;

              return (
                <div
                  key={msg.id || mi}
                  className={`flex items-end gap-1.5 mb-1 ${
                    isOwn ? "justify-end" : "justify-start"
                  } ${!sameSender ? "mt-3" : ""}`}
                >
                  {/* Avatar (left side, only for others) */}
                  {!isOwn && (
                    <div className="shrink-0 mb-0.5">
                      {!sameSender ? (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold uppercase overflow-hidden"
                          style={{
                            backgroundColor: getAvatarColor(msg.autorId),
                          }}
                        >
                          {photo ? (
                            <img
                              src={photo}
                              alt={msg.autorNombre}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            getInitials(msg.autorNombre)
                          )}
                        </div>
                      ) : (
                        <div className="w-7" />
                      )}
                    </div>
                  )}

                  {/* Bubble */}
                  <div
                    className={`max-w-[75%] relative group ${
                      isOwn
                        ? "chat-bubble-own"
                        : "chat-bubble-other"
                    }`}
                  >
                    {/* Sender name (only for others, first message in group) */}
                    {!isOwn && !sameSender && (
                      <p
                        className="text-[9px] font-extrabold mb-0.5 truncate"
                        style={{ color: getAvatarColor(msg.autorId) }}
                      >
                        {msg.autorNombre}
                        <span className="text-slate-400 font-semibold ml-1">
                          {ROLE_LABELS[msg.autorRole] || msg.autorRole}
                        </span>
                      </p>
                    )}
                    <p className="text-[12px] leading-relaxed whitespace-pre-wrap break-words">
                      {msg.texto}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-0.5 select-none">
                      <span
                        className={`text-[9px] ${
                          isOwn
                            ? "text-emerald-100/80"
                            : "text-slate-400"
                        }`}
                      >
                        {formatTime(msgDate)}
                      </span>
                      {isOwn && renderChecks(msg)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-[var(--border)] bg-slate-50/80 p-2 flex items-end gap-2 relative" ref={popoverRef}>
        {showAddParticipants && (
          <div className="absolute bottom-full right-2 mb-2 w-56 bg-white dark:bg-slate-800 border border-[var(--border)] rounded-xl shadow-lg z-50 p-2 flex flex-col max-h-60 overflow-y-auto custom-scrollbar">
            <h5 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 px-2 py-1 uppercase tracking-wider border-b border-[var(--border-light)] mb-1">
              Asignar Técnicos
            </h5>
            <div className="flex flex-col gap-0.5">
              {tecnicosDisponibles.map((t) => {
                const isAssigned = participantsList.some((p) => p.uid === t.uid);
                return (
                  <button
                    key={t.uid}
                    onClick={() => handleToggleParticipant(t)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 text-left border-0 cursor-pointer text-xs bg-transparent"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold uppercase overflow-hidden shrink-0"
                        style={{ backgroundColor: getAvatarColor(t.uid) }}
                      >
                        {t.photoURL ? (
                          <img src={t.photoURL} alt={t.displayName} className="w-full h-full object-cover" />
                        ) : (
                          getInitials(t.displayName)
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate">
                        {t.displayName}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      readOnly
                      className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 pointer-events-none"
                    />
                  </button>
                );
              })}
              {tecnicosDisponibles.length === 0 && (
                <span className="text-[10px] text-slate-400 italic text-center py-2">
                  No hay técnicos activos
                </span>
              )}
            </div>
          </div>
        )}

        <textarea
          className="flex-1 resize-none border border-[var(--border)] rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-900 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 text-[var(--text-primary)] placeholder:text-slate-400"
          placeholder="Escribe un mensaje..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          style={{ maxHeight: 80 }}
        />
        
        {texto.trim() || sending ? (
          <button
            onClick={handleSend}
            disabled={!texto.trim() || sending}
            className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 transition-colors border-0 cursor-pointer shadow-sm"
            title="Enviar mensaje"
          >
            <Send size={14} />
          </button>
        ) : (
          <button
            onClick={() => setShowAddParticipants(!showAddParticipants)}
            className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shrink-0 transition-colors border-0 cursor-pointer shadow-sm"
            title="Añadir participantes (técnicos)"
          >
            <UserPlus size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
