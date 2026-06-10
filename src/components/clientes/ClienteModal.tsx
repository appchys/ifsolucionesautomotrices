"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Cliente } from "@/types";
import { createCliente, updateCliente } from "@/lib/services";
import { toast } from "react-hot-toast";
import { X, Loader2 } from "lucide-react";

interface Props {
  cliente: Cliente | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ClienteModal({ cliente, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Omit<Cliente, "id">>({
    defaultValues: cliente ?? {},
  });

  const onSubmit = async (data: Omit<Cliente, "id">) => {
    setSaving(true);
    try {
      if (cliente?.id) {
        await updateCliente(cliente.id, data);
        toast.success("Cliente actualizado");
      } else {
        await createCliente(data);
        toast.success("Cliente creado");
      }
      onSaved();
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

  const fields: {
    name: keyof Omit<Cliente, "id">;
    label: string;
    placeholder: string;
    required: boolean;
    col2?: boolean;
  }[] = [
    { name: "nombre", label: "Nombre *", placeholder: "Juan", required: true },
    { name: "apellido", label: "Apellido *", placeholder: "Pérez", required: true },
    { name: "identificacion", label: "Cédula / RUC *", placeholder: "1234567890", required: true },
    { name: "telefono", label: "Teléfono *", placeholder: "+593 99 123 4567", required: true },
    { name: "email", label: "Email", placeholder: "juan@email.com", required: false, col2: true },
    { name: "direccion", label: "Dirección", placeholder: "Calle Principal 123", required: false, col2: true },
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-box max-w-lg w-full">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            {cliente ? "Editar Cliente" : "Nuevo Cliente"}
          </h2>
          <button onClick={onClose} className="btn-ghost btn-icon"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.name} className={`form-group ${f.col2 ? "sm:col-span-2" : ""}`}>
              <label className="label">{f.label}</label>
              <input
                className="input"
                placeholder={f.placeholder}
                {...register(f.name, { required: f.required ? `${f.label} es requerido` : false })}
              />
              {errors[f.name as keyof typeof errors] && (
                <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>
                  {errors[f.name as keyof typeof errors]?.message as string}
                </p>
              )}
            </div>
          ))}

          <div className="sm:col-span-2 flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancelar
            </button>
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
