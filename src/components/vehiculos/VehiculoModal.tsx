"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { X, Loader2, UserPlus } from "lucide-react";
import { Vehiculo, Cliente, TipoVehiculo } from "@/types";
import { getClientes, createCliente, createVehiculo, updateVehiculo, getTiposVehiculo, detectarTipoVehiculo } from "@/lib/services";
import { toast } from "react-hot-toast";
import MarcaAutocompleteSelect from "./MarcaAutocompleteSelect";
import ModeloAutocompleteSelect from "./ModeloAutocompleteSelect";

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
  const [tiposVehiculo, setTiposVehiculo] = useState<string[]>([
    "sedan", "suv", "pickup", "camioneta", "moto", "otro"
  ]);
  const [ownerMode, setOwnerMode] = useState<"existente" | "nuevo">("existente");
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset, setValue, watch } = useForm<VehiculoFormValues>();
  const selectedMarcaVal = watch("marca");
  const selectedModeloVal = watch("modelo");

  // Autodetectar Tipo de Vehículo al seleccionar marca / modelo
  useEffect(() => {
    if (!selectedModeloVal || editingVehiculo) return;
    const tipoDetectado = detectarTipoVehiculo(selectedMarcaVal, selectedModeloVal);
    if (tipoDetectado) {
      setValue("tipoVehiculo", tipoDetectado, { shouldValidate: true });
    }
  }, [selectedMarcaVal, selectedModeloVal, setValue, editingVehiculo]);

  useEffect(() => {
    if (!isOpen) return;

    const targetClienteId = editingVehiculo?.clienteId || editingVehiculo?.cliente?.id || "";
    const initialClientes: Cliente[] = [];
    if (editingVehiculo?.cliente && editingVehiculo.cliente.id) {
      initialClientes.push(editingVehiculo.cliente);
    }
    setClientes(initialClientes);

    // 1. Poblar formulario de forma síncrona e instantánea
    if (editingVehiculo) {
      reset({
        clienteId: targetClienteId,
        placa: editingVehiculo.placa || "",
        marca: editingVehiculo.marca || "",
        modelo: editingVehiculo.modelo || "",
        anio: editingVehiculo.anio || new Date().getFullYear(),
        color: editingVehiculo.color || "",
        vin: editingVehiculo.vin || "",
        tipoVehiculo: editingVehiculo.tipoVehiculo || "sedan",
      });
      setOwnerMode(targetClienteId ? "existente" : "nuevo");
    } else {
      reset({
        clienteId: "",
        nuevoClienteNombre: "",
        nuevoClienteApellido: "",
        nuevoClienteIdentificacion: "",
        nuevoClienteTelefono: "",
        nuevoClienteEmail: "",
        nuevoClienteDireccion: "",
        placa: "",
        marca: "",
        modelo: "",
        anio: new Date().getFullYear(),
        color: "",
        vin: "",
        tipoVehiculo: "sedan",
      });
      setOwnerMode("existente");
    }

    // 2. Cargar datos remotos (clientes y tipos de vehículo) en segundo plano
    Promise.all([getClientes(), getTiposVehiculo()])
      .then(([cls, tipos]) => {
        setClientes(cls);
        if (targetClienteId) {
          setValue("clienteId", targetClienteId, { shouldValidate: true });
        }
        if (Array.isArray(tipos) && tipos.length > 0) {
          setTiposVehiculo(tipos);
        }
      })
      .catch(console.error);
  }, [isOpen, editingVehiculo, reset, setValue]);

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
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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

          <div className="form-group">
            <label className="label">Placa *</label>
            <input
              className="input uppercase"
              placeholder="ABC-1234"
              {...register("placa", { required: true })}
            />
          </div>

          <div className="form-group">
            <label className="label">Marca *</label>
            <MarcaAutocompleteSelect
              value={selectedMarcaVal || ""}
              onChange={(val) => setValue("marca", val, { shouldValidate: true })}
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Modelo *</label>
            <ModeloAutocompleteSelect
              marcaNombre={selectedMarcaVal || ""}
              value={selectedModeloVal || ""}
              onChange={(val) => setValue("modelo", val, { shouldValidate: true })}
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Año *</label>
            <input
              className="input"
              type="number"
              placeholder="2020"
              {...register("anio", { required: true })}
            />
          </div>

          <div className="form-group">
            <label className="label">Color *</label>
            <input
              className="input"
              placeholder="Blanco"
              {...register("color", { required: true })}
            />
          </div>

          <div className="form-group">
            <label className="label">Chasis / VIN</label>
            <input
              className="input"
              placeholder="Opcional"
              {...register("vin")}
            />
          </div>
          <div className="form-group">
            <label className="label">Tipo *</label>
            <select className="input capitalize" {...register("tipoVehiculo", { required: true })}>
              {tiposVehiculo.map((t) => <option key={t} value={t}>{t}</option>)}
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
