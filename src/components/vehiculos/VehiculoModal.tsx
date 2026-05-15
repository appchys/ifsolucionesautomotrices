"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { X, Loader2 } from "lucide-react";
import { Vehiculo, Cliente, TipoVehiculo } from "@/types";
import { getClientes, createVehiculo, updateVehiculo } from "@/lib/services";
import { toast } from "react-hot-toast";

const TIPOS: TipoVehiculo[] = ["sedan", "suv", "pickup", "camioneta", "moto", "otro"];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editingVehiculo?: Vehiculo | null;
  onSuccess?: (vehiculo: Vehiculo) => void;
}

export default function VehiculoModal({ isOpen, onClose, editingVehiculo, onSuccess }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset, setValue } = useForm<Omit<Vehiculo, "id">>();

  useEffect(() => {
    if (isOpen) {
      getClientes().then(setClientes).catch(console.error);
      if (editingVehiculo) {
        Object.entries(editingVehiculo).forEach(([k, val]) => setValue(k as any, val));
      } else {
        reset();
      }
    }
  }, [isOpen, editingVehiculo, setValue, reset]);

  const onSubmit = async (data: Omit<Vehiculo, "id">) => {
    setSaving(true);
    try {
      let result: Vehiculo;
      if (editingVehiculo?.id) {
        await updateVehiculo(editingVehiculo.id, data);
        result = { ...editingVehiculo, ...data };
        toast.success("Vehículo actualizado");
      } else {
        const id = await createVehiculo({ ...data, placa: data.placa.toUpperCase() });
        result = { ...data, id, placa: data.placa.toUpperCase() };
        toast.success("Vehículo registrado");
      }
      if (onSuccess) onSuccess(result);
      onClose();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box max-w-lg w-full">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            {editingVehiculo ? "Editar Vehículo" : "Nuevo Vehículo"}
          </h2>
          <button onClick={onClose} className="btn-ghost btn-icon"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group sm:col-span-2">
            <label className="label">Propietario *</label>
            <select className="input" {...register("clienteId", { required: true })}>
              <option value="">Seleccionar cliente...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre} {c.apellido} — {c.identificacion}</option>
              ))}
            </select>
          </div>
          {[
            { name: "placa", label: "Placa *", placeholder: "ABC-1234", upper: true },
            { name: "marca", label: "Marca *", placeholder: "Toyota" },
            { name: "modelo", label: "Modelo *", placeholder: "Corolla" },
            { name: "anio", label: "Año *", placeholder: "2020", type: "number" },
            { name: "color", label: "Color *", placeholder: "Blanco" },
            { name: "vin", label: "VIN", placeholder: "Opcional" },
          ].map((f) => (
            <div key={f.name} className="form-group">
              <label className="label">{f.label}</label>
              <input
                className={`input ${f.upper ? "uppercase" : ""}`}
                type={f.type ?? "text"}
                placeholder={f.placeholder}
                {...register(f.name as any, { required: f.name !== "vin" })}
              />
            </div>
          ))}
          <div className="form-group">
            <label className="label">Tipo *</label>
            <select className="input" {...register("tipoVehiculo", { required: true })}>
              {TIPOS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
