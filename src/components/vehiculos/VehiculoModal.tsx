"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { X, Loader2, UserPlus } from "lucide-react";
import { Vehiculo, Cliente, TipoVehiculo } from "@/types";
import { getClientes, createCliente, createVehiculo, updateVehiculo } from "@/lib/services";
import { toast } from "react-hot-toast";

const TIPOS: TipoVehiculo[] = ["sedan", "suv", "pickup", "camioneta", "moto", "otro"];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editingVehiculo?: Vehiculo | null;
  onSuccess?: (vehiculo: Vehiculo) => void | Promise<void>;
}

type VehiculoFormValues = Omit<Vehiculo, "id" | "cliente"> & {
  nuevoClienteNombre?: string;
  nuevoClienteApellido?: string;
  nuevoClienteIdentificacion?: string;
  nuevoClienteTelefono?: string;
  nuevoClienteEmail?: string;
  nuevoClienteDireccion?: string;
};

const VEHICULO_FIELDS: {
  name: keyof Pick<VehiculoFormValues, "placa" | "marca" | "modelo" | "anio" | "color" | "vin">;
  label: string;
  placeholder: string;
  type?: string;
  upper?: boolean;
}[] = [
  { name: "placa", label: "Placa *", placeholder: "ABC-1234", upper: true },
  { name: "marca", label: "Marca *", placeholder: "Toyota" },
  { name: "modelo", label: "Modelo *", placeholder: "Corolla" },
  { name: "anio", label: "Anio *", placeholder: "2020", type: "number" },
  { name: "color", label: "Color *", placeholder: "Blanco" },
  { name: "vin", label: "Chasis", placeholder: "Opcional" },
];

export default function VehiculoModal({ isOpen, onClose, editingVehiculo, onSuccess }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ownerMode, setOwnerMode] = useState<"existente" | "nuevo">("existente");
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset, setValue } = useForm<VehiculoFormValues>();

  useEffect(() => {
    if (!isOpen) return;

    getClientes().then(setClientes).catch(console.error);
    reset();

    if (editingVehiculo) {
      const timer = window.setTimeout(() => {
        setOwnerMode(editingVehiculo.clienteId ? "existente" : "nuevo");
      }, 0);
      setValue("clienteId", editingVehiculo.clienteId);
      setValue("placa", editingVehiculo.placa);
      setValue("marca", editingVehiculo.marca);
      setValue("modelo", editingVehiculo.modelo);
      setValue("anio", editingVehiculo.anio);
      setValue("color", editingVehiculo.color);
      setValue("vin", editingVehiculo.vin);
      setValue("tipoVehiculo", editingVehiculo.tipoVehiculo);
      return () => window.clearTimeout(timer);
    } else {
      const timer = window.setTimeout(() => {
        setOwnerMode("existente");
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, editingVehiculo, setValue, reset]);

  const onSubmit = async (data: VehiculoFormValues) => {
    setSaving(true);
    try {
      let clienteId = data.clienteId;
      if (ownerMode === "nuevo") {
        clienteId = await createCliente({
          nombre: data.nuevoClienteNombre?.trim() ?? "",
          apellido: data.nuevoClienteApellido?.trim() ?? "",
          identificacion: data.nuevoClienteIdentificacion?.trim() ?? "",
          telefono: data.nuevoClienteTelefono?.trim() ?? "",
          email: data.nuevoClienteEmail?.trim() ?? "",
          direccion: data.nuevoClienteDireccion?.trim() ?? "",
        });
      }

      const vehiculoData: Omit<Vehiculo, "id"> = {
        clienteId,
        placa: data.placa.toUpperCase(),
        marca: data.marca,
        modelo: data.modelo,
        anio: Number(data.anio),
        color: data.color,
        vin: data.vin,
        tipoVehiculo: data.tipoVehiculo,
      };

      let result: Vehiculo;
      if (editingVehiculo?.id) {
        await updateVehiculo(editingVehiculo.id, vehiculoData);
        result = { ...editingVehiculo, ...vehiculoData };
        toast.success("Vehiculo actualizado");
      } else {
        const id = await createVehiculo(vehiculoData);
        result = { ...vehiculoData, id };
        toast.success("Vehiculo registrado");
      }

      await onSuccess?.(result);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message === "CLIENTE_IDENTIFICACION_DUPLICADA"
          ? "La Cedula/RUC ya esta registrada en otro cliente"
          : "Error al guardar"
      );
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
            {editingVehiculo ? "Editar Vehiculo" : "Nuevo Vehiculo"}
          </h2>
          <button onClick={onClose} className="btn-ghost btn-icon"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group sm:col-span-2">
            <label className="label">Propietario *</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => setOwnerMode("existente")}
                className={ownerMode === "existente" ? "btn-primary btn-sm justify-center" : "btn-secondary btn-sm justify-center"}
              >
                Seleccionar
              </button>
              <button
                type="button"
                onClick={() => setOwnerMode("nuevo")}
                className={ownerMode === "nuevo" ? "btn-primary btn-sm justify-center" : "btn-secondary btn-sm justify-center"}
              >
                <UserPlus size={14} /> Crear nuevo
              </button>
            </div>

            {ownerMode === "existente" ? (
              <select className="input" {...register("clienteId", { required: ownerMode === "existente" })}>
                <option value="">Seleccionar cliente...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre} {c.apellido} - {c.identificacion}</option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
                <input className="input" placeholder="Nombre *" {...register("nuevoClienteNombre", { required: ownerMode === "nuevo" })} />
                <input className="input" placeholder="Apellido *" {...register("nuevoClienteApellido", { required: ownerMode === "nuevo" })} />
                <input className="input" placeholder="Cedula / RUC *" {...register("nuevoClienteIdentificacion", { required: ownerMode === "nuevo" })} />
                <input className="input" placeholder="Telefono *" {...register("nuevoClienteTelefono", { required: ownerMode === "nuevo" })} />
                <input className="input sm:col-span-2" placeholder="Email" {...register("nuevoClienteEmail")} />
                <input className="input sm:col-span-2" placeholder="Direccion" {...register("nuevoClienteDireccion")} />
              </div>
            )}
          </div>

          {VEHICULO_FIELDS.map((f) => (
            <div key={f.name} className="form-group">
              <label className="label">{f.label}</label>
              <input
                className={`input ${f.upper ? "uppercase" : ""}`}
                type={f.type ?? "text"}
                placeholder={f.placeholder}
                {...register(f.name, { required: f.name !== "vin" })}
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
