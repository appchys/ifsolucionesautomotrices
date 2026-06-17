"use client";
import React, { useRef, useState, useEffect } from "react";
import { X, Mail, Edit2 } from "lucide-react";
import { toast } from "react-hot-toast";

interface ModalFirmaClienteProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureDataUrl: string) => Promise<void>;
  clienteEmail?: string;
  numeroIngreso: string;
}

export default function ModalFirmaCliente({
  isOpen,
  onClose,
  onSave,
  clienteEmail,
  numeroIngreso,
}: ModalFirmaClienteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      
      ctx.strokeStyle = "#1e293b"; // Slate-800
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      ctx.clearRect(0, 0, rect.width, rect.height);
      setIsEmpty(true);
    };

    resizeCanvas();
    const timer = setTimeout(resizeCanvas, 100);

    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX: number;
    let clientY: number;

    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e.cancelable) e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setIsEmpty(false);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if (e.cancelable) e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setIsEmpty(true);
  };

  const handleSave = async () => {
    if (isEmpty) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      await onSave(dataUrl);
      toast.success("Firma del cliente guardada con éxito");
      onClose();
    } catch (error) {
      console.error("Error al guardar la firma:", error);
      toast.error("Error al guardar la firma");
    } finally {
      setSaving(false);
    }
  };

  const handleSolicitarFirma = () => {
    if (clienteEmail) {
      toast.success(`Solicitud de firma enviada a ${clienteEmail}`);
    } else {
      toast.error("El cliente no tiene un correo electrónico registrado");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[var(--bg-card)] border border-[var(--border)] rounded-[20px] w-full max-w-xl p-6 shadow-2xl flex flex-col relative">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg flex items-center justify-center text-indigo-500 shrink-0">
              <Edit2 size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Firma del cliente
              </h3>
              <p className="text-xs text-slate-400">
                Ingreso {numeroIngreso}
              </p>
            </div>
          </div>
          
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Canvas Area */}
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl w-full h-[260px] bg-slate-50/30 dark:bg-slate-900/10 flex items-center justify-center relative overflow-hidden">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair touch-none z-10"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          
          {isEmpty && (
            <div className="flex flex-col items-center justify-center text-center pointer-events-none select-none z-0 px-4">
              <div className="text-slate-300 dark:text-slate-600 mb-2">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                </svg>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">
                Indica al cliente que firme aquí
              </p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                Utiliza tu dedo o un lápiz óptico
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons for Canvas */}
        <div className="flex gap-4 justify-center mt-5">
          <button
            type="button"
            onClick={clearCanvas}
            className="px-6 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-semibold rounded-xl transition-colors text-sm shadow-sm"
          >
            Resetear Firma
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isEmpty || saving}
            className="px-6 py-2.5 bg-[#818cf8] hover:bg-[#6366f1] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm shadow-sm flex items-center justify-center"
          >
            Guardar Firma
          </button>
        </div>

        {/* Separator Line */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
          </div>
          <div className="relative px-3 bg-white dark:bg-[var(--bg-card)] text-xs font-semibold text-slate-400">
            o
          </div>
        </div>

        {/* Request Signature Button */}
        <button
          type="button"
          onClick={handleSolicitarFirma}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-xl transition-colors shadow-sm text-sm"
        >
          <Mail className="w-4 h-4 text-blue-500" />
          Solicitar firma a {clienteEmail || "cliente"}
        </button>

        {/* Footer closing block */}
        <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-lg text-sm shadow-sm"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
