"use client";
import { useState, useEffect } from "react";
import { DanoVehiculo, ImagenVista } from "@/types";
import { X, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { getConfiguracionVistas } from "@/lib/services";

interface Props {
  danos: DanoVehiculo[];
  onChange: (danos: DanoVehiculo[]) => void;
  tipoVehiculo?: string;
  imagenesVistas?: ImagenVista[];
}

const TIPO_CONFIG = {
  abolladura: { label: "Abolladura", color: "#ef4444" },
  rayón: { label: "Rayón", color: "#f59e0b" },
  rotura: { label: "Rotura", color: "#7c3aed" },
  otro: { label: "Otro", color: "#06b6d4" },
};

export default function DamageSelector({ danos, onChange, tipoVehiculo, imagenesVistas }: Props) {
  const [tipoSeleccionado, setTipoSeleccionado] = useState<DanoVehiculo["tipo"]>("abolladura");
  const [currentVistaIndex, setCurrentVistaIndex] = useState(0);
  const [config, setConfig] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const cfg = await getConfiguracionVistas();
      setConfig(cfg);
    } catch (error) {
      console.error("Error loading config", error);
    } finally {
      setLoading(false);
    }
  };

  // Obtener vistas configuradas para el tipo de vehículo
  const vistaConfig = tipoVehiculo ? config.find((c) => c.tipoVehiculo === tipoVehiculo) : null;
  const vistasDisponibles = vistaConfig?.vistas || [];

  // Obtener imagen actual
  const vistaActual = vistasDisponibles[currentVistaIndex];
  const imagenActual = imagenesVistas?.find((img) => img.vista === vistaActual);

  const handleClick = (e: React.MouseEvent<any>) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const nuevo: DanoVehiculo = {
      id: Date.now().toString(),
      x,
      y,
      tipo: tipoSeleccionado,
      vista: vistaActual,
    };
    onChange([...danos, nuevo]);
  };

  const removeDano = (id: string) => {
    onChange(danos.filter((d) => d.id !== id));
  };

  const danosPorVista = vistaActual 
    ? danos.filter((d) => d.vista === vistaActual)
    : danos;

  const irVistaSiguiente = () => {
    setCurrentVistaIndex((prev) => (prev + 1) % vistasDisponibles.length);
  };

  const irVistaAnterior = () => {
    setCurrentVistaIndex((prev) => (prev - 1 + vistasDisponibles.length) % vistasDisponibles.length);
  };

  if (loading) {
    return <div className="text-center py-4" style={{ color: "var(--text-muted)" }}>Cargando configuración...</div>;
  }

  // Si no hay tipo de vehículo definido, mostrar diagrama SVG genérico
  if (!tipoVehiculo || vistasDisponibles.length === 0) {
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
          {!tipoVehiculo ? "Selecciona un tipo de vehículo para ver las vistas" : "No hay vistas configuradas para este tipo de vehículo"}
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
            <rect x="80" y="60" width="240" height="130" rx="20" fill="#1e2d47" stroke="#2563eb" strokeWidth="2"/>
            <rect x="95" y="30" width="210" height="50" rx="12" fill="#162032" stroke="#2563eb" strokeWidth="1.5"/>
            <rect x="95" y="170" width="210" height="40" rx="12" fill="#162032" stroke="#2563eb" strokeWidth="1.5"/>
            <rect x="110" y="58" width="180" height="35" rx="8" fill="#0d1b2e" stroke="#3b82f6" strokeWidth="1" opacity="0.8"/>
            <rect x="110" y="157" width="180" height="28" rx="8" fill="#0d1b2e" stroke="#3b82f6" strokeWidth="1" opacity="0.8"/>
            <line x1="200" y1="65" x2="200" y2="185" stroke="#2563eb" strokeWidth="1" strokeDasharray="4 3"/>
            <rect x="82" y="85" width="40" height="80" rx="6" fill="none" stroke="#1e3a5f" strokeWidth="1"/>
            <rect x="278" y="85" width="40" height="80" rx="6" fill="none" stroke="#1e3a5f" strokeWidth="1"/>
            <ellipse cx="78" cy="72" rx="8" ry="5" fill="#1e3a5f" stroke="#2563eb" strokeWidth="1"/>
            <ellipse cx="322" cy="72" rx="8" ry="5" fill="#1e3a5f" stroke="#2563eb" strokeWidth="1"/>
            <rect x="65" y="55" width="28" height="40" rx="8" fill="#0d1b2e" stroke="#3b82f6" strokeWidth="1.5"/>
            <rect x="307" y="55" width="28" height="40" rx="8" fill="#0d1b2e" stroke="#3b82f6" strokeWidth="1.5"/>
            <rect x="65" y="155" width="28" height="40" rx="8" fill="#0d1b2e" stroke="#3b82f6" strokeWidth="1.5"/>
            <rect x="307" y="155" width="28" height="40" rx="8" fill="#0d1b2e" stroke="#3b82f6" strokeWidth="1.5"/>
            <rect x="100" y="32" width="40" height="14" rx="4" fill="#fbbf24" opacity="0.4"/>
            <rect x="260" y="32" width="40" height="14" rx="4" fill="#fbbf24" opacity="0.4"/>
            <rect x="100" y="204" width="40" height="12" rx="4" fill="#ef4444" opacity="0.5"/>
            <rect x="260" y="204" width="40" height="12" rx="4" fill="#ef4444" opacity="0.5"/>

            <text x="200" y="18" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="Inter">FRENTE</text>
            <text x="200" y="238" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="Inter">TRASERO</text>
            <text x="18" y="130" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="Inter" transform="rotate(-90,18,130)">IZQUIERDA</text>
            <text x="382" y="130" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="Inter" transform="rotate(90,382,130)">DERECHA</text>

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

  // Con imágenes configuradas
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
        Haz clic en la imagen para marcar daños
      </p>

      {/* Vista selector */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={irVistaAnterior}
          disabled={vistasDisponibles.length <= 1}
          className="btn-ghost btn-sm"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-center flex-1">
          <h4 className="font-semibold capitalize" style={{ color: "var(--text-primary)" }}>
            Vista {vistaActual}
          </h4>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {currentVistaIndex + 1} / {vistasDisponibles.length}
          </p>
        </div>
        <button
          type="button"
          onClick={irVistaSiguiente}
          disabled={vistasDisponibles.length <= 1}
          className="btn-ghost btn-sm"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Image o diagrama */}
      <div className="relative w-full max-w-2xl mx-auto rounded-xl overflow-hidden border border-[var(--border)]">
        {imagenActual ? (
          <div className="relative w-full cursor-crosshair bg-gray-100" onClick={handleClick}>
            <img
              src={imagenActual.url}
              alt={`Vista ${vistaActual}`}
              className="w-full h-auto block"
            />
            {/* Damage dots on image */}
            <svg
              className="absolute inset-0 w-full h-full cursor-crosshair"
              style={{ pointerEvents: "all" }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              onClick={handleClick}
            >
              {danosPorVista.map((d) => {
                const cfg = TIPO_CONFIG[d.tipo];
                return (
                  <g key={d.id}>
                    <circle cx={d.x} cy={d.y} r="3" fill={cfg.color} opacity="0.25"/>
                    <circle cx={d.x} cy={d.y} r="1.5" fill={cfg.color} opacity="0.9"/>
                    <circle cx={d.x} cy={d.y} r="0.8" fill="white"/>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div
            className="w-full aspect-video flex items-center justify-center"
            style={{ background: "var(--bg-secondary)" }}
          >
            <div className="text-center">
              <AlertCircle size={32} style={{ color: "var(--text-muted)", margin: "0 auto 8px" }} />
              <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                Sin imagen para esta vista
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Damage list for current vista */}
      {danosPorVista.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Daños en esta vista ({danosPorVista.length})
          </p>
          {danosPorVista.map((d) => {
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

      {danos.length > 0 && danosPorVista.length === 0 && vistasDisponibles.length > 1 && (
        <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <AlertCircle size={14} />
          No hay daños en esta vista
        </div>
      )}
    </div>
  );
}
