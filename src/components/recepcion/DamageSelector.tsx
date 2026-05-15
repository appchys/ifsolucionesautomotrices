"use client";
import { useState } from "react";
import { DanoVehiculo, VehiculoVista } from "@/types";
import { X, AlertCircle } from "lucide-react";
import VehicleViewer from "./VehicleViewer";

interface Props {
  danos: DanoVehiculo[];
  onChange: (danos: DanoVehiculo[]) => void;
  tipoVehiculo?: "suv" | "camioneta" | "sedan" | "pickup";
}

const TIPO_CONFIG = {
  abolladura: { label: "Abolladura", color: "#ef4444" },
  rayón: { label: "Rayón", color: "#f59e0b" },
  rotura: { label: "Rotura", color: "#7c3aed" },
  otro: { label: "Otro", color: "#06b6d4" },
};

export default function DamageSelector({ danos, onChange, tipoVehiculo = "suv" }: Props) {
  const [tipoSeleccionado, setTipoSeleccionado] = useState<DanoVehiculo["tipo"]>("abolladura");
  const [currentImageUrl, setCurrentImageUrl] = useState<string>("");
  const [currentVista, setCurrentVista] = useState<VehiculoVista>("superior");

  const handleImageChange = (imageUrl: string, vista: VehiculoVista) => {
    setCurrentImageUrl(imageUrl);
    setCurrentVista(vista);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentImageUrl) return; // No permitir clicks sin imagen

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const nuevo: DanoVehiculo = {
      id: Date.now().toString(),
      x,
      y,
      tipo: tipoSeleccionado,
    };
    onChange([...danos, nuevo]);
  };

  const removeDano = (id: string) => {
    onChange(danos.filter((d) => d.id !== id));
  };

  return (
    <div>
      {/* Tipo selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.keys(TIPO_CONFIG) as DanoVehiculo["tipo"][]).map((tipo) => {
          const cfg = TIPO_CONFIG[tipo];
          return (
            <button
              key={tipo}
              type="button"
              onClick={() => setTipoSeleccionado(tipo)}
              className="btn btn-sm flex items-center gap-1.5"
              style={{
                background: tipoSeleccionado === tipo
                  ? `${cfg.color}22`
                  : "var(--bg-secondary)",
                border: `1px solid ${tipoSeleccionado === tipo ? cfg.color : "var(--border)"}`,
                color: tipoSeleccionado === tipo ? cfg.color : "var(--text-muted)",
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: cfg.color }}
              />
              {cfg.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Selecciona una vista y haz clic en la imagen para marcar daños
      </p>

      {/* Vehicle Viewer con imágenes */}
      <div className="mb-4">
        <VehicleViewer tipoVehiculo={tipoVehiculo} onImageUrlChange={handleImageChange} />
      </div>

      {/* Overlay con puntos de daño */}
      <div
        className="relative w-full max-w-md mx-auto cursor-crosshair rounded-lg overflow-hidden"
        style={{
          background: "var(--bg-secondary)",
          border: "2px solid var(--border)",
          aspectRatio: "1",
        }}
        onClick={handleClick}
      >
        {/* Imagen de fondo */}
        {currentImageUrl ? (
          <img
            src={currentImageUrl}
            alt="Vehículo"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Cargando imagen...
            </p>
          </div>
        )}

        {/* SVG overlay para puntos de daño */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: "none" }}
        >
          {/* Damage dots */}
          {danos
            .filter((d) => currentVista) // Mostrar solo daños (puedes agregar filtro por vista si lo deseas)
            .map((d) => {
              const cfg = TIPO_CONFIG[d.tipo];
              return (
                <g key={d.id}>
                  <circle cx={d.x} cy={d.y} r="3" fill={cfg.color} opacity="0.25" />
                  <circle cx={d.x} cy={d.y} r="2" fill={cfg.color} opacity="0.9" />
                  <circle cx={d.x} cy={d.y} r="0.8" fill="white" />
                </g>
              );
            })}
        </svg>
      </div>

      {/* Damage list */}
      {danos.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Daños registrados ({danos.length})
          </p>
          {danos.map((d) => {
            const cfg = TIPO_CONFIG[d.tipo];
            return (
              <div
                key={d.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {cfg.label} — ({Math.round(d.x)}%, {Math.round(d.y)}%)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeDano(d.id)}
                  className="btn-ghost btn-icon p-1"
                  style={{ color: "var(--danger)" }}
                >
                  <X size={14} />
                </button>
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
