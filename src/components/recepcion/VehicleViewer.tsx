"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { VehiculoVista, VehicleViewImagesConfig } from "@/types";
import { getVehicleViewImages } from "@/lib/services";

interface VehicleViewerProps {
  tipoVehiculo?: "suv" | "camioneta" | "sedan" | "pickup";
  onImageUrlChange?: (imageUrl: string, vista: VehiculoVista) => void;
  showImage?: boolean;
}

const VISTA_LABELS: Record<VehiculoVista, string> = {
  superior: "Superior",
  izquierda: "Izquierda",
  derecha: "Derecha",
  delantera: "Delantera",
  trasera: "Trasera",
};

const VISTA_ORDER: VehiculoVista[] = ["superior", "izquierda", "derecha", "delantera", "trasera"];

export default function VehicleViewer({ tipoVehiculo = "suv", onImageUrlChange, showImage = true }: VehicleViewerProps) {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<VehicleViewImagesConfig | null>(null);
  const [selectedVista, setSelectedVista] = useState<VehiculoVista>("superior");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getVehicleViewImages(tipoVehiculo);
        if (!cancelled) {
          if (data) {
            setConfig(data);
            setSelectedVista((currentVista) => {
              const vistaExiste = data.imagenes.some((img) => img.vista === currentVista);
              return !vistaExiste && data.imagenes.length > 0 ? data.imagenes[0].vista : currentVista;
            });
          } else {
            setConfig(null);
            setError("No hay imágenes configuradas para este tipo de vehículo");
          }
        }
      } catch {
        if (!cancelled) {
          setConfig(null);
          setError("Error al cargar las imágenes del vehículo");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tipoVehiculo]);

  const currentImage = config?.imagenes.find((img) => img.vista === selectedVista);

  useEffect(() => {
    if (onImageUrlChange) {
      onImageUrlChange(currentImage?.imageUrl ?? "", selectedVista);
    }
  }, [currentImage?.imageUrl, selectedVista, onImageUrlChange]);

  if (loading) {
    return (
      <div className="w-full aspect-square rounded-lg border border-dashed flex items-center justify-center" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <div className="flex flex-col items-center gap-2">
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)" }} />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Cargando imágenes...</p>
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="w-full aspect-square rounded-lg border border-dashed flex items-center justify-center" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
          {error || "No hay imágenes disponibles"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Vista selector */}
      <div className="flex flex-wrap gap-2">
        {VISTA_ORDER.map((vista) => {
          const imagen = config.imagenes.find((img) => img.vista === vista);
          const hasImage = !!imagen?.imageUrl;
          
          return (
            <button
              key={vista}
              type="button"
              onClick={() => setSelectedVista(vista)}
              disabled={!hasImage}
              className="btn btn-sm transition-all"
              style={{
                background: selectedVista === vista ? "var(--accent)" : "var(--bg-secondary)",
                color: selectedVista === vista ? "white" : hasImage ? "var(--text-primary)" : "var(--text-muted)",
                borderColor: selectedVista === vista ? "var(--accent)" : "var(--border)",
                opacity: !hasImage ? 0.5 : 1,
                cursor: hasImage ? "pointer" : "not-allowed",
              }}
            >
              {VISTA_LABELS[vista]}
            </button>
          );
        })}
      </div>

      {showImage && (
        <div className="relative w-full aspect-square rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          {currentImage?.imageUrl ? (
            <img
              src={currentImage.imageUrl}
              alt={`Vista ${VISTA_LABELS[selectedVista]}`}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Imagen no disponible
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
