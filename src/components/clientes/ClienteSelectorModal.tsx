"use client";
import React, { useEffect, useState, useMemo } from "react";
import { Search, X, Loader2, Plus, User, Check, ArrowLeft, Phone, CreditCard } from "lucide-react";
import { getClientes, createCliente } from "@/lib/services";
import { Cliente } from "@/types";
import { toast } from "react-hot-toast";

interface Props {
  onClose: () => void;
  onSelect: (cliente: Cliente | null) => void | Promise<void>;
  selectedClienteId?: string;
  allowConsumidorFinal?: boolean;
  title?: string;
}

export default function ClienteSelectorModal({
  onClose,
  onSelect,
  selectedClienteId,
  allowConsumidorFinal = false,
  title = "Seleccionar Cliente",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Formulario de nuevo cliente
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
        toast.error("Error al cargar lista de clientes");
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
        (c.identificacion && c.identificacion.toLowerCase().includes(term)) ||
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
      await onSelect(newCliente);
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
    onSelect(null);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-[var(--border)] animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            {isCreating && (
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="p-1 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-secondary)] transition-colors"
                title="Volver a la lista"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {isCreating ? "Registrar Nuevo Cliente" : title}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {isCreating
                  ? "Ingresa los datos del nuevo cliente"
                  : "Selecciona un cliente de la lista o crea uno nuevo"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {isCreating ? (
            <form onSubmit={handleCreateCliente} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block text-[var(--text-secondary)]">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    className="input w-full text-sm"
                    placeholder="Ej: Juan"
                    required
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block text-[var(--text-secondary)]">
                    Apellido
                  </label>
                  <input
                    type="text"
                    className="input w-full text-sm"
                    placeholder="Ej: Pérez"
                    value={form.apellido}
                    onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block text-[var(--text-secondary)]">
                    Cédula / RUC *
                  </label>
                  <input
                    type="text"
                    className="input w-full text-sm"
                    placeholder="Ej: 1712345678"
                    required
                    value={form.identificacion}
                    onChange={(e) => setForm({ ...form, identificacion: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block text-[var(--text-secondary)]">
                    Teléfono *
                  </label>
                  <input
                    type="text"
                    className="input w-full text-sm"
                    placeholder="Ej: 0991234567"
                    required
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block text-[var(--text-secondary)]">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  className="input w-full text-sm"
                  placeholder="ejemplo@correo.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block text-[var(--text-secondary)]">
                  Dirección
                </label>
                <input
                  type="text"
                  className="input w-full text-sm"
                  placeholder="Dirección domiciliaria"
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="btn btn-secondary text-xs h-9"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs h-9 px-4 flex items-center gap-1.5"
                  disabled={submitting}
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  Guardar y Asignar
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {/* Search and Action Buttons */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  />
                  <input
                    type="text"
                    className="input pl-9 h-9 text-xs w-full"
                    placeholder="Buscar por nombre, CI / RUC, teléfono..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="btn btn-primary text-xs h-9 px-3 flex items-center gap-1 shrink-0"
                  title="Nuevo Cliente"
                >
                  <Plus size={14} /> Nuevo
                </button>
              </div>

              {/* Quick Select Generic Client (optional for sales) */}
              {allowConsumidorFinal && (
                <button
                  type="button"
                  onClick={handleSelectConsumidorFinal}
                  className="w-full p-2.5 rounded-xl border border-dashed border-[var(--border)] text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-xs text-[var(--accent)]">Consumidor Final</p>
                    <p className="text-[10px] text-[var(--text-muted)]">CI/RUC: 9999999999999 • Cliente Genérico</p>
                  </div>
                  {!selectedClienteId && <Check size={16} className="text-[var(--accent)]" />}
                </button>
              )}

              {/* List */}
              <div className="space-y-1 max-h-[50vh] overflow-y-auto custom-scrollbar">
                {loading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 size={24} className="animate-spin text-blue-500" />
                  </div>
                ) : filteredClientes.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[var(--text-muted)]">
                    <p>No se encontraron clientes</p>
                    <button
                      type="button"
                      onClick={() => setIsCreating(true)}
                      className="btn btn-secondary text-xs h-8 mt-2 inline-flex items-center gap-1"
                    >
                      <Plus size={13} /> Registrar &ldquo;{search}&rdquo;
                    </button>
                  </div>
                ) : (
                  filteredClientes.map((c) => {
                    const isSelected = selectedClienteId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={async () => {
                          await onSelect(c);
                          onClose();
                        }}
                        className={`w-full p-2.5 rounded-xl text-left border transition-all flex items-center justify-between group ${
                          isSelected
                            ? "border-[var(--accent)] bg-blue-50/50 dark:bg-blue-950/30"
                            : "border-[var(--border)] hover:border-blue-300 hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[var(--text-secondary)] font-bold text-xs shrink-0 uppercase border border-slate-200">
                            {c.nombre?.[0] || ""}{c.apellido?.[0] || ""}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs text-[var(--text-primary)] truncate">
                              {c.nombre} {c.apellido || ""}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] mt-0.5">
                              {c.identificacion && (
                                <span className="font-mono flex items-center gap-0.5">
                                  <CreditCard size={10} /> {c.identificacion}
                                </span>
                              )}
                              {c.telefono && (
                                <span className="flex items-center gap-0.5">
                                  <Phone size={10} /> {c.telefono}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
                            <Check size={12} />
                          </div>
                        )}
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
