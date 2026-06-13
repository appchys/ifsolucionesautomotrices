"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DanoVehiculo, VehicleViewImage, VehiculoVista } from "@/types";
import { getVehicleViewImages } from "@/lib/services";
import { X, AlertCircle, ImageOff, Loader2, Check } from "lucide-react";

interface Props {
  danos: DanoVehiculo[];
  onChange: (danos: DanoVehiculo[]) => void;
  tipoVehiculo?: string;
}

export const TIPO_CONFIG = {
  abolladura: { label: "Abolladura", color: "#ef4444" },
  rayón: { label: "Rayón", color: "#f59e0b" },
  rotura: { label: "Rotura", color: "#7c3aed" },
  otro: { label: "Otro", color: "#06b6d4" },
};

export const VISTAS: { label: string; value: VehiculoVista }[] = [
  { label: "Superior", value: "superior" },
  { label: "Izquierda", value: "izquierda" },
  { label: "Derecha", value: "derecha" },
  { label: "Delantera", value: "delantera" },
  { label: "Trasera", value: "trasera" },
];

export default function DamageSelector({ danos, onChange, tipoVehiculo = "sedan" }: Props) {
  const [vistaSeleccionada, setVistaSeleccionada] = useState<VehiculoVista>("superior");
  const [imagenes, setImagenes] = useState<VehicleViewImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [loadedImageUrl, setLoadedImageUrl] = useState("");
  const nextIdRef = useRef(0);

  const [menuPos, setMenuPos] = useState<{
    x: number; y: number; left: number; top: number;
  } | null>(null);
  const [menuStep, setMenuStep] = useState<"tipo" | "otro">("tipo");
  const [otroTexto, setOtroTexto] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingImages(true);
        const config = await getVehicleViewImages(tipoVehiculo.toLowerCase());
        if (!cancelled) setImagenes(config?.imagenes ?? []);
      } catch (error) {
        console.error(`Error cargando imagenes ${tipoVehiculo} para inspeccion visual`, error);
        if (!cancelled) setImagenes([]);
      } finally {
        if (!cancelled) setLoadingImages(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tipoVehiculo]);

  const imagenActual = useMemo(
    () => imagenes.find((img) => img.vista === vistaSeleccionada && img.imageUrl.trim()),
    [imagenes, vistaSeleccionada]
  );

  const imageReady = loadedImageUrl === imagenActual?.imageUrl;
  const danosVistaActual = danos.filter((d) => (d.vista ?? "superior") === vistaSeleccionada);
  const viewerHeight = "clamp(220px, 45vh, 360px)";

  const handleClickDiagram = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imagenActual || !imageReady) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const x = (localX / rect.width) * 100;
    const y = (localY / rect.height) * 100;

    let left = e.clientX;
    let top = e.clientY;
    const menuW = 190;
    const menuH = 200;
    if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
    if (top + menuH > window.innerHeight - 8) top = window.innerHeight - menuH - 8;

    setMenuPos({ x, y, left, top });
    setMenuStep("tipo");
    setOtroTexto("");
  };

  const addDano = (tipo: DanoVehiculo["tipo"], descripcion?: string) => {
    if (!menuPos) return;
    const nuevo: DanoVehiculo = {
      id: `dano-${vistaSeleccionada}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      x: menuPos.x,
      y: menuPos.y,
      vista: vistaSeleccionada,
      tipo,
      ...(descripcion ? { descripcion } : {}),
    };
    onChange([...danos, nuevo]);
    setMenuPos(null);
  };

  const removeDano = (id: string) => {
    onChange(danos.filter((d) => d.id !== id));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {VISTAS.map((vista) => {
          const hasImage = imagenes.some((img) => img.vista === vista.value && img.imageUrl.trim());
          const isActive = vistaSeleccionada === vista.value;
          return (
            <button
              key={vista.value}
              type="button"
              onClick={() => setVistaSeleccionada(vista.value)}
              className="btn btn-sm"
              style={{
                background: isActive ? "rgba(59,130,246,0.12)" : "var(--bg-secondary)",
                border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                color: isActive ? "var(--accent)" : "var(--text-muted)",
                opacity: hasImage ? 1 : 0.72,
              }}
            >
              {vista.label}
            </button>
          );
        })}
      </div>

      <div className="relative w-full max-w-3xl mx-auto">
        <div
          className="relative w-full rounded-lg overflow-hidden"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            height: viewerHeight,
          }}
        >
          {loadingImages ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
            </div>
          ) : imagenActual ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                role="button"
                tabIndex={0}
                aria-label={`Marcar daño en vista ${vistaSeleccionada}`}
                className="relative cursor-crosshair"
                onClick={handleClickDiagram}
              >
                <img
                  src={imagenActual.imageUrl}
                  alt={`Vista ${vistaSeleccionada} SUV`}
                  className="block max-w-full select-none"
                  style={{ maxHeight: viewerHeight }}
                  draggable={false}
                  onLoad={() => setLoadedImageUrl(imagenActual.imageUrl)}
                />
                {imageReady &&
                  danosVistaActual.map((d) => {
                    const cfg = TIPO_CONFIG[d.tipo];
                    return (
                      <span
                        key={d.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ left: `${d.x}%`, top: `${d.y}%` }}
                      >
                        <span
                          className="absolute -left-[9px] -top-[9px] h-[18px] w-[18px] rounded-full"
                          style={{ background: cfg.color, opacity: 0.25 }}
                        />
                        <span
                          className="absolute -left-[5px] -top-[5px] h-[10px] w-[10px] rounded-full"
                          style={{ background: cfg.color, opacity: 0.9 }}
                        />
                        <span className="absolute -left-[2px] -top-[2px] h-1 w-1 rounded-full bg-white" />
                      </span>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <ImageOff size={34} style={{ color: "var(--text-muted)", opacity: 0.45 }} />
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                No hay imagen SUV para esta vista
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Sube la imagen en Configuración para usarla en la inspección visual.
              </p>
            </div>
          )}
        </div>
      </div>

      {menuPos && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9998,
            }}
            onClick={() => setMenuPos(null)}
          />
          <div
            style={{
              position: "fixed",
              left: menuPos.left,
              top: menuPos.top,
              zIndex: 9999,
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
              padding: "8px",
              minWidth: "180px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {menuStep === "tipo" ? (
              <div className="flex flex-col gap-1">
                {(Object.keys(TIPO_CONFIG) as DanoVehiculo["tipo"][]).map((tipo) => {
                  const cfg = TIPO_CONFIG[tipo];
                  return (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => {
                        if (tipo === "otro") {
                          setMenuStep("otro");
                        } else {
                          addDano(tipo);
                        }
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left"
                      style={{ color: "var(--text-primary)", background: "transparent" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-secondary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: cfg.color }}
                      />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: TIPO_CONFIG.otro.color }} />
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Otro</span>
                </div>
                <input
                  type="text"
                  value={otroTexto}
                  onChange={(e) => setOtroTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && otroTexto.trim()) {
                      addDano("otro", otroTexto.trim());
                    }
                  }}
                  placeholder="Describe el daño..."
                  className="w-full px-3 py-2 text-sm rounded-lg"
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                  autoFocus
                />
                <div className="flex gap-2 justify-end mt-1">
                  <button
                    type="button"
                    onClick={() => setMenuStep("tipo")}
                    className="btn btn-sm"
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (otroTexto.trim()) {
                        addDano("otro", otroTexto.trim());
                      }
                    }}
                    className="btn btn-sm"
                    style={{
                      background: TIPO_CONFIG.otro.color,
                      color: "#fff",
                      opacity: otroTexto.trim() ? 1 : 0.5,
                    }}
                    disabled={!otroTexto.trim()}
                  >
                    <Check size={14} />
                    Agregar
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}


    </div>
  );
}
