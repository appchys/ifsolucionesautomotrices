"use client";
import { useState, useEffect, useRef } from "react";
import { getMarcasVehiculo, agregarModeloAMarca } from "@/lib/services";
import { MarcaVehiculo, ModeloVehiculo } from "@/types";
import { Tag, Plus, ChevronDown, Check, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

interface Props {
  marcaNombre: string;
  value: string;
  onChange: (modelo: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export default function ModeloAutocompleteSelect({
  marcaNombre,
  value,
  onChange,
  placeholder = "Seleccionar o escribir modelo...",
  required = false,
  className = "",
  disabled = false,
}: Props) {
  const [marcaObj, setMarcaObj] = useState<MarcaVehiculo | null>(null);
  const [modelos, setModelos] = useState<ModeloVehiculo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  const loadMarcaAndModelos = async () => {
    if (!marcaNombre?.trim()) {
      setMarcaObj(null);
      setModelos([]);
      return;
    }
    setLoading(true);
    try {
      const allMarcas = await getMarcasVehiculo();
      const found = allMarcas.find(
        (m) => m.nombre.toLowerCase() === marcaNombre.trim().toLowerCase()
      );
      if (found) {
        setMarcaObj(found);
        setModelos(found.modelos || []);
      } else {
        setMarcaObj(null);
        setModelos([]);
      }
    } catch (err) {
      console.error("Error al cargar modelos de la marca:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarcaAndModelos();
  }, [marcaNombre]);

  // Clic fuera para cerrar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = modelos.filter((m) =>
    m.nombre.toLowerCase().includes(query.trim().toLowerCase())
  );

  const exactMatch = modelos.some(
    (m) => m.nombre.toLowerCase() === query.trim().toLowerCase()
  );

  const handleSelect = (nombre: string) => {
    setQuery(nombre);
    onChange(nombre);
    setIsOpen(false);
  };

  const handleCreateNew = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    if (!marcaObj?.id) {
      // Si la marca no está guardada formalmente con id aún, solo notificamos y seleccionamos el valor
      onChange(trimmed);
      setIsOpen(false);
      return;
    }

    setCreating(true);
    try {
      await agregarModeloAMarca(marcaObj.id, { nombre: trimmed });
      toast.success(`Modelo "${trimmed}" agregado a ${marcaObj.nombre}`);
      await loadMarcaAndModelos();
      onChange(trimmed);
      setIsOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Error al agregar el modelo");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Tag size={16} className="absolute left-3 text-[var(--text-muted)] pointer-events-none" />

        <input
          type="text"
          value={query}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          className={`input w-full pl-9 pr-8 text-sm ${className}`}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
        />

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded"
        >
          {loading || creating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ChevronDown size={14} />
          )}
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] shadow-lg text-sm py-1">
          {filtered.length > 0 ? (
            filtered.map((m) => {
              const isSelected = m.nombre.toLowerCase() === (value || "").toLowerCase();
              return (
                <button
                  key={m.id || m.nombre}
                  type="button"
                  onClick={() => handleSelect(m.nombre)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors ${
                    isSelected ? "bg-[var(--accent-light-20)] font-semibold text-[var(--accent-primary)]" : ""
                  }`}
                >
                  <span className="truncate">{m.nombre}</span>
                  {isSelected && <Check size={14} className="text-[var(--accent-primary)] shrink-0" />}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-xs text-[var(--text-muted)] text-center">
              {modelos.length === 0
                ? "No hay modelos registrados para esta marca aún."
                : "Sin coincidencias exactas."}
            </div>
          )}

          {query.trim() !== "" && !exactMatch && (
            <div className="border-t border-[var(--border-color)] mt-1 pt-1 px-1">
              <button
                type="button"
                onClick={handleCreateNew}
                disabled={creating}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-xs rounded font-medium text-[var(--accent-primary)] hover:bg-[var(--accent-light-10)] transition-colors text-left"
              >
                <Plus size={14} />
                <span>
                  Crear nuevo modelo &quot;<strong>{query.trim()}</strong>&quot;
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
