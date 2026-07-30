"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { getMarcasVehiculo, createMarcaVehiculo } from "@/lib/services";
import { MarcaVehiculo } from "@/types";
import { Car, Plus, ChevronDown, Check, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

interface Props {
  value: string;
  onChange: (marca: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export default function MarcaAutocompleteSelect({
  value,
  onChange,
  placeholder = "Seleccionar o escribir marca...",
  required = false,
  className = "",
  disabled = false,
}: Props) {
  const [marcas, setMarcas] = useState<MarcaVehiculo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  const fetchMarcas = async () => {
    setLoading(true);
    try {
      const data = await getMarcasVehiculo();
      setMarcas(data);
    } catch (error) {
      console.error("Error al cargar marcas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarcas();
  }, []);

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

  // Deduplicar marcas por nombre
  const uniqueMarcas = useMemo(() => {
    const seen = new Set<string>();
    return marcas.filter((m) => {
      const key = (m.nombre || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [marcas]);

  const filtered = uniqueMarcas.filter((m) =>
    m.nombre.toLowerCase().includes(query.trim().toLowerCase())
  );

  const exactMatch = uniqueMarcas.some(
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
    setCreating(true);
    try {
      await createMarcaVehiculo({
        nombre: trimmed,
        modelos: [],
        popularidadEcuador: false,
      });
      toast.success(`Marca "${trimmed}" registrada`);
      await fetchMarcas();
      onChange(trimmed);
      setIsOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Error al crear la marca");
    } finally {
      setCreating(false);
    }
  };

  const selectedMarca = marcas.find(
    (m) => m.nombre.toLowerCase() === (value || "").toLowerCase()
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        {selectedMarca?.logoUrl ? (
          <div className="absolute left-2.5 w-6 h-6 flex items-center justify-center rounded overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedMarca.logoUrl}
              alt={selectedMarca.nombre}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ) : (
          <Car size={16} className="absolute left-3 text-[var(--text-muted)] pointer-events-none" />
        )}

        <input
          type="text"
          value={query}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          className={`input w-full ${selectedMarca?.logoUrl || true ? "pl-9" : "pl-9"} pr-8 text-sm ${className}`}
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
                  <div className="flex items-center gap-2.5 truncate">
                    {m.logoUrl ? (
                      <div className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.logoUrl} alt={m.nombre} className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)] shrink-0">
                        <Car size={13} />
                      </div>
                    )}
                    <span className="truncate">{m.nombre}</span>
                  </div>
                  {isSelected && <Check size={14} className="text-[var(--accent-primary)] shrink-0" />}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-xs text-[var(--text-muted)] text-center">
              Sin coincidencias exactas
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
                <span>Crear nueva marca &quot;<strong>{query.trim()}</strong>&quot;</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
