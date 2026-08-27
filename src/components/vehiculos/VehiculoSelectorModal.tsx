"use client";
import React, { useEffect, useState, useMemo } from "react";
import { Search, X, Loader2, Plus, Car, Check, ArrowLeft, User, Shield } from "lucide-react";
import { getVehiculos, createVehiculo, getClienteById, getMarcasVehiculo, detectarTipoVehiculo } from "@/lib/services";
import { Vehiculo, Cliente, TipoVehiculo } from "@/types";
import { toast } from "react-hot-toast";
import MarcaAutocompleteSelect from "./MarcaAutocompleteSelect";
import ModeloAutocompleteSelect from "./ModeloAutocompleteSelect";

interface Props {
  onClose: () => void;
  onSelect: (vehiculo: Vehiculo, clienteAsociado?: Cliente | null) => void | Promise<void>;
  selectedVehiculoId?: string;
  clienteId?: string;
  clienteNombre?: string;
  title?: string;
}

export default function VehiculoSelectorModal({
  onClose,
  onSelect,
  selectedVehiculoId,
  clienteId,
  clienteNombre,
  title = "Seleccionar Vehículo",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Formulario de nuevo vehículo
  const [formPlaca, setFormPlaca] = useState("");
  const [formMarca, setFormMarca] = useState("");
  const [formModelo, setFormModelo] = useState("");
  const [formAnio, setFormAnio] = useState<number>(new Date().getFullYear());
  const [formColor, setFormColor] = useState("");
  const [formVin, setFormVin] = useState("");
  const [formTipo, setFormTipo] = useState<TipoVehiculo>("sedan");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    getVehiculos()
      .then(setVehiculos)
      .catch((err) => {
        console.error("Error al obtener vehículos:", err);
        toast.error("Error al cargar lista de vehículos");
      })
      .finally(() => setLoading(false));
  }, []);

  // Autodetectar Tipo de Vehículo al cambiar marca/modelo
  useEffect(() => {
    if (!formModelo || !formMarca) return;
    const tipo = detectarTipoVehiculo(formMarca, formModelo);
    if (tipo) setFormTipo(tipo);
  }, [formMarca, formModelo]);

  const filteredVehiculos = useMemo(() => {
    let list = vehiculos;
    if (search.trim()) {
      const term = search.toLowerCase().trim();
      list = list.filter(
        (v) =>
          v.placa.toLowerCase().includes(term) ||
          v.marca.toLowerCase().includes(term) ||
          v.modelo.toLowerCase().includes(term) ||
          (v.color && v.color.toLowerCase().includes(term)) ||
          (v.vin && v.vin.toLowerCase().includes(term))
      );
    }
    // Si hay clienteId, ordenar primero los del cliente
    if (clienteId) {
      list = [...list].sort((a, b) => {
        if (a.clienteId === clienteId && b.clienteId !== clienteId) return -1;
        if (a.clienteId !== clienteId && b.clienteId === clienteId) return 1;
        return 0;
      });
    }
    return list;
  }, [search, vehiculos, clienteId]);

  const handleCreateVehiculo = async (e: React.FormEvent) => {
    e.preventDefault();
    const placaClean = formPlaca.trim().toUpperCase();
    if (!placaClean || !formMarca.trim() || !formModelo.trim() || !formColor.trim()) {
      toast.error("Por favor completa los campos obligatorios (*)");
      return;
    }

    setSubmitting(true);
    try {
        const vehiculoData: Omit<Vehiculo, "id"> = {
        placa: placaClean,
        marca: formMarca.trim(),
        modelo: formModelo.trim(),
        anio: Number(formAnio) || new Date().getFullYear(),
        color: formColor.trim(),
        vin: formVin.trim() || undefined,
        tipoVehiculo: formTipo,
        clienteId: clienteId || "",
      };

      const newId = await createVehiculo(vehiculoData);
      const newVehiculo: Vehiculo = {
        ...vehiculoData,
        id: newId,
      };

      toast.success("Vehículo registrado correctamente");
      let clienteAsociado: Cliente | null = null;
      if (clienteId) {
        clienteAsociado = await getClienteById(clienteId);
      }
      await onSelect(newVehiculo, clienteAsociado);
      onClose();
    } catch (err: any) {
      console.error("Error al crear vehículo:", err);
      toast.error("Error al registrar vehículo");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectVehiculo = async (v: Vehiculo) => {
    let clienteAsociado: Cliente | null = null;
    if (v.clienteId) {
      try {
        clienteAsociado = await getClienteById(v.clienteId);
      } catch (err) {
        console.error("Error al cargar cliente asociado:", err);
      }
    }
    await onSelect(v, clienteAsociado);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-[var(--border)] animate-fade-in">
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
                {isCreating ? "Registrar Nuevo Vehículo" : title}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {isCreating
                  ? clienteNombre
                    ? `Se asociará automáticamente a ${clienteNombre}`
                    : "Ingresa los datos del vehículo"
                  : "Busca por placa, marca o modelo"}
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
            <form onSubmit={handleCreateVehiculo} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block text-[var(--text-secondary)]">
                    Placa *
                  </label>
                  <input
                    type="text"
                    className="input w-full text-sm font-mono uppercase font-bold"
                    placeholder="ABC-1234"
                    required
                    value={formPlaca}
                    onChange={(e) => setFormPlaca(e.target.value.toUpperCase())}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block text-[var(--text-secondary)]">
                    Año *
                  </label>
                  <input
                    type="number"
                    className="input w-full text-sm font-semibold"
                    placeholder="2022"
                    required
                    value={formAnio}
                    onChange={(e) => setFormAnio(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block text-[var(--text-secondary)]">
                    Marca *
                  </label>
                  <MarcaAutocompleteSelect
                    value={formMarca}
                    onChange={(m) => setFormMarca(m)}
                    placeholder="Seleccionar marca"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block text-[var(--text-secondary)]">
                    Modelo *
                  </label>
                  <ModeloAutocompleteSelect
                    marcaNombre={formMarca}
                    value={formModelo}
                    onChange={(m) => setFormModelo(m)}
                    placeholder="Seleccionar modelo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block text-[var(--text-secondary)]">
                    Color *
                  </label>
                  <input
                    type="text"
                    className="input w-full text-sm"
                    placeholder="Blanco, Negro, etc."
                    required
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block text-[var(--text-secondary)]">
                    Tipo de Vehículo
                  </label>
                  <select
                    className="select w-full text-sm capitalize"
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value as TipoVehiculo)}
                  >
                    <option value="sedan">Sedán</option>
                    <option value="suv">SUV</option>
                    <option value="pickup">Pickup</option>
                    <option value="camioneta">Camioneta</option>
                    <option value="moto">Moto</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block text-[var(--text-secondary)]">
                  Chasis / VIN (Opcional)
                </label>
                <input
                  type="text"
                  className="input w-full text-sm font-mono uppercase"
                  placeholder="Número de chasis"
                  value={formVin}
                  onChange={(e) => setFormVin(e.target.value.toUpperCase())}
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
                    className="input pl-9 h-9 text-xs w-full uppercase"
                    placeholder="Buscar por placa, marca o modelo..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFormPlaca(search.trim().toUpperCase());
                    setIsCreating(true);
                  }}
                  className="btn btn-primary text-xs h-9 px-3 flex items-center gap-1 shrink-0"
                  title="Nuevo Vehículo"
                >
                  <Plus size={14} /> Nuevo
                </button>
              </div>

              {/* List */}
              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto custom-scrollbar">
                {loading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 size={24} className="animate-spin text-blue-500" />
                  </div>
                ) : filteredVehiculos.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[var(--text-muted)]">
                    <p>No se encontraron vehículos</p>
                    <button
                      type="button"
                      onClick={() => {
                        setFormPlaca(search.trim().toUpperCase());
                        setIsCreating(true);
                      }}
                      className="btn btn-secondary text-xs h-8 mt-2 inline-flex items-center gap-1"
                    >
                      <Plus size={13} /> Registrar placa &ldquo;{search.toUpperCase()}&rdquo;
                    </button>
                  </div>
                ) : (
                  filteredVehiculos.map((v) => {
                    const isSelected = selectedVehiculoId === v.id;
                    const isClientVehicle = clienteId && v.clienteId === clienteId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleSelectVehiculo(v)}
                        className={`w-full p-2.5 rounded-xl text-left border transition-all flex items-center justify-between group ${
                          isSelected
                            ? "border-[var(--accent)] bg-blue-50/50 dark:bg-blue-950/30"
                            : isClientVehicle
                            ? "border-blue-200 bg-blue-50/20 hover:bg-blue-50/40"
                            : "border-[var(--border)] hover:border-blue-300 hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold shrink-0 border border-slate-200">
                            <Car size={18} className="text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-extrabold text-xs text-[var(--text-primary)] uppercase bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {v.placa}
                              </span>
                              {isClientVehicle && (
                                <span className="badge badge-sm bg-blue-100 text-blue-700 text-[10px] font-bold py-0 px-1.5 rounded">
                                  Este cliente
                                </span>
                              )}
                            </div>
                            <p className="font-bold text-xs text-[var(--text-primary)] mt-1 truncate">
                              {v.marca} {v.modelo} {v.anio ? `(${v.anio})` : ""}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] mt-0.5">
                              {v.color && <span>Color: {v.color}</span>}
                              {v.tipoVehiculo && <span className="capitalize">• {v.tipoVehiculo}</span>}
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
