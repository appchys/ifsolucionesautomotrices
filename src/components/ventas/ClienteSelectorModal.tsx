"use client";
import React, { useEffect, useState, useMemo } from "react";
import { Search, X, Loader2, Plus, User, Check, ArrowLeft } from "lucide-react";
import { getClientes, createCliente } from "@/lib/services";
import { Cliente } from "@/types";
import { toast } from "react-hot-toast";

interface Props {
  onClose: () => void;
  onSelect: (cliente: Cliente | null) => void;
  selectedClienteId?: string;
}

export default function ClienteSelectorModal({ onClose, onSelect, selectedClienteId }: Props) {
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  // New Client Form
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    identificacion: "",
    telefono: "",
    email: "",
    direccion: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    getClientes()
      .then(setClientes)
      .catch((err) => {
        console.error("Error al obtener clientes:", err);
        toast.error("Error al cargar clientes");
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredClientes = useMemo(() => {
    if (!search.trim()) return clientes;
    const term = search.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(term) ||
        (c.apellido && c.apellido.toLowerCase().includes(term)) ||
        c.identificacion.includes(term) ||
        (c.telefono && c.telefono.includes(term))
    );
  }, [search, clientes]);

  const handleCreateCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.identificacion.trim() || !form.telefono.trim()) {
      toast.error("Por favor completa los campos requeridos (*)");
      return;
    }

    setSubmitting(true);
    try {
      const newId = await createCliente({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        identificacion: form.identificacion.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim(),
        direccion: form.direccion.trim(),
      });

      const newCliente: Cliente = {
        id: newId,
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        identificacion: form.identificacion.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim(),
        direccion: form.direccion.trim(),
      };

      toast.success("Cliente creado correctamente");
      onSelect(newCliente);
      onClose();
    } catch (err: any) {
      console.error("Error al crear cliente:", err);
      if (err?.message === "CLIENTE_IDENTIFICACION_DUPLICADA") {
        toast.error("La identificación ya se encuentra registrada");
      } else {
        toast.error("Error al registrar el cliente");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectConsumidorFinal = () => {
    onSelect(null); // null indicates "Consumidor Final"
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[var(--bg-card)] rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[85vh] overflow-hidden border border-[var(--border)]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            {isCreating && (
              <button 
                onClick={() => setIsCreating(false)} 
                className="p-1 hover:bg-[var(--bg-hover)] rounded-full text-[var(--text-secondary)] mr-1"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className="text-lg font-bold">
              {isCreating ? "Registrar Nuevo Cliente" : "Seleccionar Cliente"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {isCreating ? (
            <form onSubmit={handleCreateCliente} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Nombre *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ej: Juan"
                    required
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="label">Apellido</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ej: Pérez"
                    value={form.apellido}
                    onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Identificación (Cédula/RUC) *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ej: 1712345678"
                    required
                    value={form.identificacion}
                    onChange={(e) => setForm({ ...form, identificacion: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="label">Teléfono *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ej: 0991234567"
                    required
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Correo Electrónico</label>
                <input
                  type="email"
                  className="input"
                  placeholder="ejemplo@correo.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="label">Dirección</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Dirección del domicilio"
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="btn btn-secondary h-10"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary h-10 px-5"
                  disabled={submitting}
                >
                  {submitting && <Loader2 size={16} className="animate-spin mr-1" />}
                  Registrar y Seleccionar
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Search and Action Buttons */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    className="input pl-9 h-10 w-full"
                    placeholder="Buscar por nombre, CI / RUC..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => setIsCreating(true)} 
                  className="btn btn-primary h-10 flex-shrink-0"
                  title="Nuevo Cliente"
                >
                  <Plus size={16} /> Nuevo
                </button>
              </div>

              {/* Quick Select Generic Client */}
              <button
                onClick={handleSelectConsumidorFinal}
                className="w-full p-3 rounded-xl border border-dashed border-[var(--border)] text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-sm text-[var(--accent)]">Consumidor Final</p>
                  <p className="text-xs text-[var(--text-muted)]">CI/RUC: 9999999999999 • Cliente Genérico</p>
                </div>
                {!selectedClienteId && <Check size={16} className="text-[var(--accent)]" />}
              </button>

              {/* List */}
              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-[var(--accent)]" />
                  </div>
                ) : filteredClientes.length === 0 ? (
                  <p className="text-center py-8 text-sm text-[var(--text-muted)]">
                    No se encontraron clientes
                  </p>
                ) : (
                  filteredClientes.map((c) => {
                    const isSelected = selectedClienteId === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          onSelect(c);
                          onClose();
                        }}
                        className={`w-full p-3 rounded-xl border text-left transition-colors flex items-center justify-between ${
                          isSelected 
                            ? "border-[var(--accent)] bg-blue-50/50 dark:bg-blue-900/10" 
                            : "border-[var(--border)] hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-sm text-[var(--text-primary)]">
                            {c.nombre} {c.apellido}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            CI: {c.identificacion} {c.telefono ? `• Tel: ${c.telefono}` : ""}
                          </p>
                        </div>
                        {isSelected && <Check size={16} className="text-[var(--accent)]" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
