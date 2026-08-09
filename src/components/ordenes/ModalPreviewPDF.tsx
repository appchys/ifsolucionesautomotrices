"use client";

import React, { useState, useEffect, useRef } from "react";
import { FileDown, Printer, X, Loader2, User, PenTool, Eye } from "lucide-react";
import { toast } from "react-hot-toast";
import { OrdenTrabajo, Cliente, Vehiculo, ItemOrden, Pago, DatosTaller } from "@/types";
import { getLogoAsBase64Png, obtenerLogoMarcaBase64 } from "@/lib/services";

interface ModalPreviewPDFProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: "cliente" | "tecnico";
  orden: OrdenTrabajo;
  cliente: Cliente;
  vehiculo: Vehiculo;
  items: ItemOrden[];
  pagos: Pago[];
  taller: DatosTaller | null;
}

export default function ModalPreviewPDF({
  isOpen,
  onClose,
  initialType = "cliente",
  orden,
  cliente,
  vehiculo,
  items,
  pagos,
  taller,
}: ModalPreviewPDFProps) {
  const [activeType, setActiveType] = useState<"cliente" | "tecnico">(initialType);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Synchronize initialType when modal opens
  useEffect(() => {
    if (isOpen && initialType) {
      setActiveType(initialType);
    }
  }, [isOpen, initialType]);

  // Generate PDF blob whenever activeType or modal state changes
  useEffect(() => {
    if (!isOpen || !orden || !cliente || !vehiculo) return;

    let isMounted = true;
    let currentObjectUrl: string | null = null;

    const generatePdf = async () => {
      setLoading(true);
      setPdfUrl(null);

      try {
        const { pdf } = await import("@react-pdf/renderer");

        let tallerConLogo = taller;
        if (taller?.logoUrl) {
          const logoBase64 = await getLogoAsBase64Png(taller.logoUrl);
          if (logoBase64) tallerConLogo = { ...taller, logoUrl: logoBase64 };
        }

        const marcaLogoUrl = await obtenerLogoMarcaBase64(vehiculo.marca);

        let blob: Blob;
        if (activeType === "cliente") {
          const OrdenClientePDF = (await import("@/components/recepcion/OrdenClientePDF")).default;
          blob = await pdf(
            <OrdenClientePDF
              orden={orden}
              cliente={cliente}
              vehiculo={vehiculo}
              items={items}
              pagos={pagos}
              taller={tallerConLogo}
              marcaLogoUrl={marcaLogoUrl}
            />
          ).toBlob();
        } else {
          const OrdenTecnicoPDF = (await import("@/components/recepcion/OrdenTecnicoPDF")).default;
          blob = await pdf(
            <OrdenTecnicoPDF
              orden={orden}
              cliente={cliente}
              vehiculo={vehiculo}
              items={items}
              taller={tallerConLogo}
              marcaLogoUrl={marcaLogoUrl}
            />
          ).toBlob();
        }

        if (isMounted) {
          const url = URL.createObjectURL(blob);
          currentObjectUrl = url;
          setPdfUrl(url);
        }
      } catch (error) {
        console.error("Error al generar la vista previa del PDF:", error);
        if (isMounted) {
          toast.error("Error al generar la vista previa del PDF");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    generatePdf();

    return () => {
      isMounted = false;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [isOpen, activeType, orden, cliente, vehiculo, items, pagos, taller]);

  if (!isOpen) return null;

  const numOt = String(orden.numeroOrden ?? orden.numero ?? 0).padStart(4, "0");

  const handleDownload = () => {
    if (!pdfUrl) return;
    setDownloading(true);
    try {
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = `orden_trabajo_${activeType}_${numOt}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("PDF descargado con éxito");
    } catch (err) {
      console.error(err);
      toast.error("Error al descargar el PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    if (!iframeRef.current || !pdfUrl) return;
    try {
      iframeRef.current.contentWindow?.focus();
      iframeRef.current.contentWindow?.print();
    } catch (err) {
      console.error(err);
      toast.error("Error al iniciar impresión");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-800 gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Eye size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                Vista Previa de Orden #{numOt}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                {cliente.nombre} {cliente.apellido} • {vehiculo.marca} {vehiculo.modelo} ({vehiculo.placa})
              </p>
            </div>
          </div>

          {/* Type Toggle Tabs & Actions */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Toggle Switch */}
            <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setActiveType("cliente")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border-0 cursor-pointer ${
                  activeType === "cliente"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-transparent"
                }`}
              >
                <User size={13} />
                Cliente
              </button>
              <button
                type="button"
                onClick={() => setActiveType("tecnico")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border-0 cursor-pointer ${
                  activeType === "tecnico"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-transparent"
                }`}
              >
                <PenTool size={13} />
                Técnico
              </button>
            </div>

            <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !pdfUrl}
              className="p-2 sm:px-3 sm:py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors border-0 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              title="Imprimir documento"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={loading || !pdfUrl || downloading}
              className="btn-primary px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <FileDown size={15} />
              )}
              <span>Descargar PDF</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-0 bg-transparent cursor-pointer flex items-center justify-center ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 sm:p-4 flex items-center justify-center overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 size={32} className="animate-spin text-blue-600 dark:text-blue-400" />
              <p className="text-xs font-semibold">Generando vista previa del documento...</p>
            </div>
          ) : pdfUrl ? (
            <iframe
              ref={iframeRef}
              src={pdfUrl}
              className="w-full h-full border-0 rounded-xl bg-white shadow-xs"
              title={`Vista previa Orden ${activeType}`}
            />
          ) : (
            <div className="text-slate-400 text-xs font-medium">
              No se pudo generar la vista previa del PDF.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
