"use client";
import { useState } from "react";
import { DanoVehiculo } from "@/types";
import { X, AlertCircle } from "lucide-react";

interface Props {
  danos: DanoVehiculo[];
  onChange: (danos: DanoVehiculo[]) => void;
}

const TIPO_CONFIG = {
  abolladura: { label: "Abolladura", color: "#ef4444" },
  rayón: { label: "Rayón", color: "#f59e0b" },
  rotura: { label: "Rotura", color: "#7c3aed" },
  otro: { label: "Otro", color: "#06b6d4" },
};

export default function DamageSelector({ danos, onChange }: Props) {
  const [tipoSeleccionado, setTipoSeleccionado] = useState<DanoVehiculo["tipo"]>("abolladura");

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
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
        Haz clic en el vehículo para marcar daños
      </p>

      {/* SVG Car Diagram */}
      <div className="relative w-full max-w-md mx-auto">
        <svg
          viewBox="0 0 400 250"
          className="w-full cursor-crosshair rounded-xl"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          onClick={handleClick}
        >
          {/* Car body - top view */}
          {/* Main body */}
          <rect x="80" y="60" width="240" height="130" rx="20" fill="#1e2d47" stroke="#2563eb" strokeWidth="2"/>
          {/* Hood */}
          <rect x="95" y="30" width="210" height="50" rx="12" fill="#162032" stroke="#2563eb" strokeWidth="1.5"/>
          {/* Trunk */}
          <rect x="95" y="170" width="210" height="40" rx="12" fill="#162032" stroke="#2563eb" strokeWidth="1.5"/>
          {/* Windshield front */}
          <rect x="110" y="58" width="180" height="35" rx="8" fill="#0d1b2e" stroke="#3b82f6" strokeWidth="1" opacity="0.8"/>
          {/* Windshield rear */}
          <rect x="110" y="157" width="180" height="28" rx="8" fill="#0d1b2e" stroke="#3b82f6" strokeWidth="1" opacity="0.8"/>
          {/* Doors */}
          <line x1="200" y1="65" x2="200" y2="185" stroke="#2563eb" strokeWidth="1" strokeDasharray="4 3"/>
          <rect x="82" y="85" width="40" height="80" rx="6" fill="none" stroke="#1e3a5f" strokeWidth="1"/>
          <rect x="278" y="85" width="40" height="80" rx="6" fill="none" stroke="#1e3a5f" strokeWidth="1"/>
          {/* Mirrors */}
          <ellipse cx="78" cy="72" rx="8" ry="5" fill="#1e3a5f" stroke="#2563eb" strokeWidth="1"/>
          <ellipse cx="322" cy="72" rx="8" ry="5" fill="#1e3a5f" stroke="#2563eb" strokeWidth="1"/>
          {/* Wheels */}
          <rect x="65" y="55" width="28" height="40" rx="8" fill="#0d1b2e" stroke="#3b82f6" strokeWidth="1.5"/>
          <rect x="307" y="55" width="28" height="40" rx="8" fill="#0d1b2e" stroke="#3b82f6" strokeWidth="1.5"/>
          <rect x="65" y="155" width="28" height="40" rx="8" fill="#0d1b2e" stroke="#3b82f6" strokeWidth="1.5"/>
          <rect x="307" y="155" width="28" height="40" rx="8" fill="#0d1b2e" stroke="#3b82f6" strokeWidth="1.5"/>
          {/* Headlights */}
          <rect x="100" y="32" width="40" height="14" rx="4" fill="#fbbf24" opacity="0.4"/>
          <rect x="260" y="32" width="40" height="14" rx="4" fill="#fbbf24" opacity="0.4"/>
          {/* Taillights */}
          <rect x="100" y="204" width="40" height="12" rx="4" fill="#ef4444" opacity="0.5"/>
          <rect x="260" y="204" width="40" height="12" rx="4" fill="#ef4444" opacity="0.5"/>

          {/* Labels */}
          <text x="200" y="18" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="Inter">FRENTE</text>
          <text x="200" y="238" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="Inter">TRASERO</text>
          <text x="18" y="130" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="Inter" transform="rotate(-90,18,130)">IZQUIERDA</text>
          <text x="382" y="130" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="Inter" transform="rotate(90,382,130)">DERECHA</text>

          {/* Damage dots */}
          {danos.map((d) => {
            const cfg = TIPO_CONFIG[d.tipo];
            const cx = (d.x / 100) * 400;
            const cy = (d.y / 100) * 250;
            return (
              <g key={d.id}>
                <circle cx={cx} cy={cy} r="9" fill={cfg.color} opacity="0.25"/>
                <circle cx={cx} cy={cy} r="5" fill={cfg.color} opacity="0.9"/>
                <circle cx={cx} cy={cy} r="2" fill="white"/>
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
