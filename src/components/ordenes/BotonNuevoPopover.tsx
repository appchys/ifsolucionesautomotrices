"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, ChevronDown, FileDown, Calculator, Wrench } from "lucide-react";

interface BotonNuevoPopoverProps {
  onSelect: (tipo: "ingreso" | "presupuesto" | "orden") => void;
}

export default function BotonNuevoPopover({ onSelect }: BotonNuevoPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleOptionClick = (tipo: "ingreso" | "presupuesto" | "orden") => {
    onSelect(tipo);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all duration-200"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Plus size={16} />
        <span>Nuevo</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-1.5 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150"
          role="menu"
        >
          <button
            onClick={() => handleOptionClick("ingreso")}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors duration-150 text-left"
            role="menuitem"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400 shrink-0">
              <FileDown size={16} />
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-xs">Nuevo Ingreso</span>
            </div>
          </button>

          <button
            onClick={() => handleOptionClick("presupuesto")}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors duration-150 text-left"
            role="menuitem"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 shrink-0">
              <Calculator size={16} />
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-xs">Nuevo Presupuesto</span>
            </div>
          </button>

          <button
            onClick={() => handleOptionClick("orden")}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors duration-150 text-left"
            role="menuitem"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 shrink-0">
              <Wrench size={16} />
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-xs">Nueva Orden</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
