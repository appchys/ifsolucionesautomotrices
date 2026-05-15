"use client";
import { NivelCombustible } from "@/types";
import { Fuel } from "lucide-react";

interface Props {
  value: NivelCombustible;
  onChange: (v: NivelCombustible) => void;
}

const LEVELS: NivelCombustible[] = ["Vacío", "1/4", "1/2", "3/4", "Lleno"];

const LEVEL_COLORS = {
  "Vacío": "#ef4444",
  "1/4": "#f97316",
  "1/2": "#f59e0b",
  "3/4": "#84cc16",
  "Lleno": "#10b981",
};

export default function FuelSelector({ value, onChange }: Props) {
  const selectedIdx = LEVELS.indexOf(value);

  return (
    <div className="flex items-center gap-4">
      <Fuel size={20} style={{ color: LEVEL_COLORS[value] }} />
      <div className="flex gap-1 items-end">
        {LEVELS.map((level, i) => {
          const active = i <= selectedIdx;
          const isSelected = level === value;
          return (
            <button
              key={level}
              type="button"
              onClick={() => onChange(level)}
              className="flex flex-col items-center gap-1 group"
            >
              <div
                className="rounded-sm transition-all duration-200"
                style={{
                  width: "32px",
                  height: `${16 + i * 8}px`,
                  background: active ? LEVEL_COLORS[value] : "var(--border)",
                  opacity: active ? 1 : 0.4,
                  transform: isSelected ? "scaleX(1.15)" : "scaleX(1)",
                  boxShadow: isSelected ? `0 0 8px ${LEVEL_COLORS[value]}80` : "none",
                }}
              />
              <span
                className="text-xs"
                style={{ color: active ? "var(--text-secondary)" : "var(--text-muted)" }}
              >
                {level}
              </span>
            </button>
          );
        })}
      </div>
      <div
        className="px-3 py-1.5 rounded-lg text-sm font-semibold"
        style={{
          background: `${LEVEL_COLORS[value]}22`,
          color: LEVEL_COLORS[value],
          border: `1px solid ${LEVEL_COLORS[value]}44`,
        }}
      >
        {value}
      </div>
    </div>
  );
}
