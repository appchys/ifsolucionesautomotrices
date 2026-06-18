"use client";

import React, { useState, useEffect } from "react";
import { Mail, X, Paperclip, Loader2, Send } from "lucide-react";
import { toast } from "react-hot-toast";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { OrdenTrabajo, Cliente, Vehiculo, ItemOrden, Pago, DatosTaller } from "@/types";

interface ModalEnviarCorreoProps {
  isOpen: boolean;
  onClose: () => void;
  orden: OrdenTrabajo;
  cliente: Cliente;
  vehiculo: Vehiculo;
  items: ItemOrden[];
  pagos: Pago[];
  taller: DatosTaller | null;
}

function waitForFirebaseUser(timeoutMs = 5000): Promise<User | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe = () => {};
    const finish = (user: User | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe();
      resolve(user);
    };
    const timeout = window.setTimeout(() => finish(auth.currentUser), timeoutMs);
    unsubscribe = onAuthStateChanged(auth, finish, () => finish(null));
  });
}

async function getGmailAuthHeaders(): Promise<Record<string, string>> {
  const user = await waitForFirebaseUser();
  const token = await user?.getIdToken();
  if (!token) throw new Error("AUTH_REQUIRED");
  return { Authorization: `Bearer ${token}` };
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      } else {
        reject(new Error("Failed to convert blob to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export default function ModalEnviarCorreo({
  isOpen,
  onClose,
  orden,
  cliente,
  vehiculo,
  items,
  pagos,
  taller,
}: ModalEnviarCorreoProps) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [attachPdf, setAttachPdf] = useState(true);
  const [sending, setSending] = useState(false);

  const numOt = String(orden.numeroOrden ?? orden.numero ?? 0).padStart(4, "0");
  const tallerName = taller?.razonSocial || "I.F. SOLUCIONES AUTOMOTRICES";

  useEffect(() => {
    if (isOpen && cliente) {
      setTo(cliente.email || "");
      setSubject(`${tallerName} - Orden de Trabajo OT-${numOt}`);
      
      const clientFullName = `${cliente.nombre} ${cliente.apellido}`.trim().toUpperCase();
      setContent(
        `Hola ${clientFullName},\n\n` +
        `Le informamos sobre su orden de trabajo #OT-${numOt} — ${orden.motivo || "diagnostico inicial"}.\n` +
        `Total: $${(items.reduce((acc, it) => acc + it.precioUnitario * it.cantidad, 0) * 1.15).toFixed(2)}\n\n` +
        `Si tiene alguna consulta, no dude en contactarnos.\n\n` +
        `Saludos cordiales,\n` +
        `${tallerName}`
      );
    }
  }, [isOpen, cliente, orden, items, tallerName, numOt]);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim() || !subject.trim() || !content.trim()) {
      toast.error("Por favor completa todos los campos requeridos.");
      return;
    }

    setSending(true);
    const toastId = toast.loading("Enviando correo...");

    try {
      let attachmentBase64 = "";
      const attachmentName = `orden-OT-${numOt}.pdf`;

      if (attachPdf) {
        // Dynamically import PDF renderer and the Client PDF template
        const { pdf } = await import("@react-pdf/renderer");
        const OrdenClientePDF = (await import("@/components/recepcion/OrdenClientePDF")).default;

        const pdfBlob = await pdf(
          <OrdenClientePDF
            orden={orden}
            cliente={cliente}
            vehiculo={vehiculo}
            items={items}
            pagos={pagos}
            taller={taller}
          />
        ).toBlob();

        attachmentBase64 = await blobToBase64(pdfBlob);
      }

      const headers = await getGmailAuthHeaders();
      const response = await fetch("/api/gmail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          to,
          subject,
          content,
          attachmentBase64: attachPdf ? attachmentBase64 : undefined,
          attachmentName: attachPdf ? attachmentName : undefined,
          attachmentMime: attachPdf ? "application/pdf" : undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "GMAIL_SEND_FAILED");
      }

      toast.success("Correo enviado con éxito", { id: toastId });
      onClose();
    } catch (error) {
      console.error("[gmail:send_client] Failed:", error);
      toast.error("Error al enviar el correo.", { id: toastId });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-slate-100 dark:border-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Mail size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">Enviar por correo</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Orden de Trabajo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-0 bg-transparent cursor-pointer flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSend} className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1.5">
              Para
            </label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="cliente@ejemplo.com"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1.5">
              Asunto
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="Asunto del correo"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1.5">
              Contenido
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={6}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium focus:border-blue-500 focus:outline-none transition-colors resize-none"
              placeholder="Escribe el mensaje aquí..."
            />
          </div>

          {/* Attachment Box */}
          <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/20">
            <div className="flex items-center gap-3">
              <div className="p-2 text-slate-400 dark:text-slate-500 flex items-center justify-center">
                <Paperclip size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">orden-OT-{numOt}.pdf</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">PDF adjunto en formato A4</p>
              </div>
            </div>
            
            {/* Toggle Switch */}
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={attachPdf}
                onChange={(e) => setAttachPdf(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-transparent border-0 hover:underline cursor-pointer disabled:opacity-55"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sending}
              className="btn-primary px-5 py-2.5 text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {sending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send size={14} />
                  Enviar correo
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
