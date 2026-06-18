"use client";

import React, { useRef, useState, useEffect } from "react";
import { X, Edit2, Loader2, Check } from "lucide-react";
import { toast } from "react-hot-toast";

interface ModalFirmasProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (firmaClienteUrl: string, firmaTecnicoUrl: string) => Promise<void>;
  clienteNombre: string;
  tecnicoNombre: string;
  numeroOrden: string;
  initialFirmaClienteUrl?: string;
  initialFirmaTecnicoUrl?: string;
}

export default function ModalFirmas({
  isOpen,
  onClose,
  onSave,
  clienteNombre,
  tecnicoNombre,
  numeroOrden,
  initialFirmaClienteUrl,
  initialFirmaTecnicoUrl,
}: ModalFirmasProps) {
  const canvasClienteRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingCliente, setIsDrawingCliente] = useState(false);
  const [isEmptyCliente, setIsEmptyCliente] = useState(true);

  const canvasTecnicoRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingTecnico, setIsDrawingTecnico] = useState(false);
  const [isEmptyTecnico, setIsEmptyTecnico] = useState(true);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const initCanvas = (
      canvas: HTMLCanvasElement | null,
      setIsEmpty: (val: boolean) => void,
      initialUrl?: string
    ) => {
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

        if (initialUrl) {
          const img = new Image();
          img.src = initialUrl;
          img.crossOrigin = "anonymous";
          img.onload = () => {
            ctx.drawImage(img, 0, 0, rect.width, rect.height);
            setIsEmpty(false);
          };
        }
      };

      resizeCanvas();
      const timer = setTimeout(resizeCanvas, 100);
      return () => clearTimeout(timer);
    };

    const cleanupCliente = initCanvas(canvasClienteRef.current, setIsEmptyCliente, initialFirmaClienteUrl);
    const cleanupTecnico = initCanvas(canvasTecnicoRef.current, setIsEmptyTecnico, initialFirmaTecnicoUrl);

    return () => {
      if (cleanupCliente) cleanupCliente();
      if (cleanupTecnico) cleanupTecnico();
    };
  }, [isOpen, initialFirmaClienteUrl, initialFirmaTecnicoUrl]);

  if (!isOpen) return null;

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement | null) => {
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

  // Drawing Cliente
  const startDrawingCliente = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e.cancelable) e.preventDefault();
    const coords = getCoordinates(e, canvasClienteRef.current);
    if (!coords) return;
    const ctx = canvasClienteRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawingCliente(true);
    setIsEmptyCliente(false);
  };

  const drawCliente = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingCliente) return;
    if (e.cancelable) e.preventDefault();
    const coords = getCoordinates(e, canvasClienteRef.current);
    if (!coords) return;
    const ctx = canvasClienteRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawingCliente = () => setIsDrawingCliente(false);

  const clearCanvasCliente = () => {
    const canvas = canvasClienteRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setIsEmptyCliente(true);
  };

  // Drawing Técnico
  const startDrawingTecnico = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e.cancelable) e.preventDefault();
    const coords = getCoordinates(e, canvasTecnicoRef.current);
    if (!coords) return;
    const ctx = canvasTecnicoRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawingTecnico(true);
    setIsEmptyTecnico(false);
  };

  const drawTecnico = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingTecnico) return;
    if (e.cancelable) e.preventDefault();
    const coords = getCoordinates(e, canvasTecnicoRef.current);
    if (!coords) return;
    const ctx = canvasTecnicoRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawingTecnico = () => setIsDrawingTecnico(false);

  const clearCanvasTecnico = () => {
    const canvas = canvasTecnicoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setIsEmptyTecnico(true);
  };

  const handleSave = async () => {
    let clientUrl = initialFirmaClienteUrl || "";
    let tecnicoUrl = initialFirmaTecnicoUrl || "";

    if (!isEmptyCliente) {
      const canvas = canvasClienteRef.current;
      if (canvas) clientUrl = canvas.toDataURL("image/png");
    } else if (!initialFirmaClienteUrl) {
      clientUrl = "";
    }

    if (!isEmptyTecnico) {
      const canvas = canvasTecnicoRef.current;
      if (canvas) tecnicoUrl = canvas.toDataURL("image/png");
    } else if (!initialFirmaTecnicoUrl) {
      tecnicoUrl = "";
    }

    setSaving(true);
    try {
      await onSave(clientUrl, tecnicoUrl);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden border border-slate-100 dark:border-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Edit2 size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">Firmas</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Orden OT-{numeroOrden}</p>
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

        {/* Canvases Section */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Cliente Signature */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                Firma del cliente
              </span>
              <button
                type="button"
                onClick={clearCanvasCliente}
                className="text-xs font-bold text-slate-400 hover:text-blue-600 bg-transparent border-0 cursor-pointer"
              >
                Limpiar
              </button>
            </div>
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl w-full h-[220px] bg-slate-50/30 dark:bg-slate-900/10 flex items-center justify-center relative overflow-hidden">
              <canvas
                ref={canvasClienteRef}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none z-10"
                onMouseDown={startDrawingCliente}
                onMouseMove={drawCliente}
                onMouseUp={stopDrawingCliente}
                onMouseLeave={stopDrawingCliente}
                onTouchStart={startDrawingCliente}
                onTouchMove={drawCliente}
                onTouchEnd={stopDrawingCliente}
              />
              {isEmptyCliente && (
                <div className="flex flex-col items-center justify-center text-center pointer-events-none select-none z-0 px-4">
                  <p className="text-slate-400 dark:text-slate-500 font-semibold text-[11px]">
                    Indica al cliente que firme aquí
                  </p>
                </div>
              )}
            </div>
            <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-3">
              {clienteNombre}
            </p>
          </div>

          {/* Técnico Signature */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                Firma del técnico
              </span>
              <button
                type="button"
                onClick={clearCanvasTecnico}
                className="text-xs font-bold text-slate-400 hover:text-blue-600 bg-transparent border-0 cursor-pointer"
              >
                Limpiar
              </button>
            </div>
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl w-full h-[220px] bg-slate-50/30 dark:bg-slate-900/10 flex items-center justify-center relative overflow-hidden">
              <canvas
                ref={canvasTecnicoRef}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none z-10"
                onMouseDown={startDrawingTecnico}
                onMouseMove={drawTecnico}
                onMouseUp={stopDrawingTecnico}
                onMouseLeave={stopDrawingTecnico}
                onTouchStart={startDrawingTecnico}
                onTouchMove={drawTecnico}
                onTouchEnd={stopDrawingTecnico}
              />
              {isEmptyTecnico && (
                <div className="flex flex-col items-center justify-center text-center pointer-events-none select-none z-0 px-4">
                  <p className="text-slate-400 dark:text-slate-500 font-semibold text-[11px]">
                    Firma del técnico responsable
                  </p>
                </div>
              )}
            </div>
            <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-3">
              {tecnicoNombre}
            </p>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl shadow-sm cursor-pointer disabled:opacity-50 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary px-5 py-2.5 text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check size={14} />
                Guardar firmas
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
