"use client";

import { useCallback, useRef, useState } from "react";
import { AlertCircle, Check, X } from "lucide-react";
import { DanoVehiculo, VehiculoVista } from "@/types";
import VehicleViewer from "./VehicleViewer";

interface Props {
  danos: DanoVehiculo[];
  onChange: (danos: DanoVehiculo[]) => void;
  tipoVehiculo?: "suv" | "camioneta" | "sedan" | "pickup";
}

const TIPO_CONFIG: Record<DanoVehiculo["tipo"], { label: string; color: string }> = {
  abolladura: { label: "Abolladura", color: "#ef4444" },
  rayón: { label: "Rayón", color: "#f59e0b" },
  rotura: { label: "Rotura", color: "#7c3aed" },
  otro: { label: "Otro", color: "#06b6d4" },
};

const VISTA_LABELS: Record<VehiculoVista, string> = {
  superior: "Superior",
  izquierda: "Izquierda",
  derecha: "Derecha",
  delantera: "Delantera",
  trasera: "Trasera",
};

const VISTA_ORDER: VehiculoVista[] = ["superior", "izquierda", "derecha", "delantera", "trasera"];

export default function DamageSelector({ danos, onChange, tipoVehiculo = "suv" }: Props) {
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const [currentVista, setCurrentVista] = useState<VehiculoVista>("superior");
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null);
  const [customDamage, setCustomDamage] = useState("");
  const [showCustomDamage, setShowCustomDamage] = useState(false);
  const damageIdRef = useRef(0);

  const handleImageChange = useCallback((imageUrl: string, vista: VehiculoVista) => {
    setCurrentImageUrl(imageUrl);
    setCurrentVista(vista);
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!currentImageUrl) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setPendingPoint({ x, y });
    setCustomDamage("");
    setShowCustomDamage(false);
  };

  const addDano = (tipo: DanoVehiculo["tipo"], descripcion?: string) => {
    if (!pendingPoint) return;

    damageIdRef.current += 1;
    onChange([
      ...danos,
      {
        id: `dano-${damageIdRef.current}`,
        x: pendingPoint.x,
        y: pendingPoint.y,
        tipo,
        vista: currentVista,
        descripcion,
      },
    ]);
    setPendingPoint(null);
    setCustomDamage("");
    setShowCustomDamage(false);
  };

  const removeDano = (id: string) => {
    onChange(danos.filter((dano) => dano.id !== id));
  };

  return (
    <div>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Selecciona una vista, haz clic en la imagen y elige el tipo de daño
      </p>

      <div className="mb-4">
        <VehicleViewer tipoVehiculo={tipoVehiculo} onImageUrlChange={handleImageChange} showImage={false} />
      </div>

      <div
        className="relative w-full max-w-md mx-auto cursor-crosshair rounded-lg overflow-hidden"
        style={{
          background: "var(--bg-secondary)",
          border: "2px solid var(--border)",
          aspectRatio: "1",
        }}
        onClick={handleClick}
      >
        {currentImageUrl ? (
          <img
            src={currentImageUrl}
            alt="Vehiculo"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Cargando imagen...
            </p>
          </div>
        )}

        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: "none" }}
        >
          {danos
            .filter((dano) => (dano.vista ?? "superior") === currentVista)
            .map((dano) => {
              const cfg = TIPO_CONFIG[dano.tipo];
              return (
                <g key={dano.id}>
                  <circle cx={dano.x} cy={dano.y} r="3" fill={cfg.color} opacity="0.25" />
                  <circle cx={dano.x} cy={dano.y} r="2" fill={cfg.color} opacity="0.9" />
                  <circle cx={dano.x} cy={dano.y} r="0.8" fill="white" />
                </g>
              );
            })}

          {pendingPoint && (
            <g>
              <circle cx={pendingPoint.x} cy={pendingPoint.y} r="3" fill="var(--accent)" opacity="0.2" />
              <circle cx={pendingPoint.x} cy={pendingPoint.y} r="2" fill="var(--accent)" opacity="0.9" />
              <circle cx={pendingPoint.x} cy={pendingPoint.y} r="0.8" fill="white" />
            </g>
          )}
        </svg>

        {pendingPoint && (
          <div
            className="absolute z-10 min-w-40 rounded-lg border shadow-lg p-2"
            style={{
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              background: "var(--bg-card)",
              borderColor: "var(--border)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid gap-1">
              {(["abolladura", "rayón", "rotura", "otro"] as DanoVehiculo["tipo"][]).map((tipo) => {
                const cfg = TIPO_CONFIG[tipo];
                if (tipo === "otro" && showCustomDamage) {
                  return (
                    <div key={tipo} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.color }} />
                      <input
                        type="text"
                        className="input text-xs min-w-0 flex-1"
                        value={customDamage}
                        onChange={(event) => setCustomDamage(event.target.value)}
                        placeholder="Escribe el daño"
                        onClick={(event) => event.stopPropagation()}
                      />
                      <button
                        type="button"
                        title="Guardar"
                        aria-label="Guardar otro daño"
                        onClick={() => addDano("otro", customDamage.trim())}
                        disabled={!customDamage.trim()}
                        className="btn-secondary btn-icon shrink-0"
                        style={{ opacity: customDamage.trim() ? 1 : 0.5 }}
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  );
                }

                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => {
                      if (tipo === "otro") {
                        setShowCustomDamage(true);
                        return;
                      }
                      addDano(tipo);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left hover:bg-[var(--bg-secondary)]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
                    {cfg.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setPendingPoint(null);
                  setCustomDamage("");
                  setShowCustomDamage(false);
                }}
                className="w-full px-2 py-1.5 rounded-md text-xs text-left hover:bg-[var(--bg-secondary)]"
                style={{ color: "var(--text-muted)" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {danos.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Daños registrados ({danos.length})
          </p>
          {VISTA_ORDER.map((vista) => {
            const danosVista = danos.filter((dano) => (dano.vista ?? "superior") === vista);
            if (danosVista.length === 0) return null;

            return (
              <div key={vista} className="space-y-2">
                <p className="text-[11px] uppercase font-bold" style={{ color: "var(--text-muted)" }}>
                  {VISTA_LABELS[vista]}
                </p>
                {danosVista.map((dano) => {
                  const cfg = TIPO_CONFIG[dano.tipo];
                  return (
                    <div
                      key={dano.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                          {dano.descripcion?.trim() || cfg.label}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDano(dano.id)}
                        className="btn-ghost btn-icon p-1"
                        style={{ color: "var(--danger)" }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {danos.length === 0 && (
        <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <AlertCircle size={14} />
          Sin daños registrados
        </div>
      )}
    </div>
  );
}
