"use client";

import { useEffect, useState } from "react";
import { X, Calendar, Clock, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { createCita, getUsuarios } from "@/lib/services";
import { Cliente, Vehiculo, AppUser, Cita } from "@/types";

interface ModalAgendarCitaProps {
  isOpen: boolean;
  onClose: () => void;
  presupuestoId: string;
  numeroPresupuesto: number | string;
  cliente: Cliente;
  vehiculo: Vehiculo;
  motivoInicial?: string;
  onCitaCreada: (cita: Cita) => void;
}

export default function ModalAgendarCita({
  isOpen,
  onClose,
  presupuestoId,
  numeroPresupuesto,
  cliente,
  vehiculo,
  motivoInicial = "",
  onCitaCreada,
}: ModalAgendarCitaProps) {
  const nombreCliente = `${cliente.nombre || ""} ${cliente.apellido || ""}`.trim();
  const numPreStr = String(numeroPresupuesto || 0).padStart(4, "0");

  // Obtener la fecha formateada YYYY-MM-DD para mañana por defecto
  const getFechaManana = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };

  const [titulo, setTitulo] = useState(`Presupuesto ${numPreStr} — ${nombreCliente}`);
  const [fecha, setFecha] = useState(getFechaManana());
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFin, setHoraFin] = useState("10:00");
  const [agenda, setAgenda] = useState("Sin agenda");
  const [asignadoAId, setAsignadoAId] = useState("");
  const [descripcion, setDescripcion] = useState(motivoInicial);

  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    (async () => {
      try {
        setLoadingUsers(true);
        const users = await getUsuarios();
        if (active) {
          setUsuarios(users.filter((u) => u.activo));
        }
      } catch (err) {
        console.error("Error al cargar usuarios para agendar cita", err);
      } finally {
        if (active) setLoadingUsers(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error("Indica un título para la cita");
      return;
    }
    if (!fecha) {
      toast.error("Selecciona una fecha");
      return;
    }

    setSaving(true);
    try {
      const usuarioAsignado = usuarios.find((u) => u.uid === asignadoAId || u.id === asignadoAId);
      const asignadoANombre = usuarioAsignado?.displayName || undefined;

      const nuevaCitaPayload: Omit<Cita, "id"> = {
        presupuestoId,
        clienteId: cliente.id,
        clienteNombre: nombreCliente,
        vehiculoId: vehiculo.id,
        vehiculoPlaca: vehiculo.placa,
        titulo: titulo.trim(),
        fecha,
        horaInicio,
        horaFin,
        agenda: agenda !== "Sin agenda" ? agenda : undefined,
        asignadoAId: asignadoAId || undefined,
        asignadoANombre,
        descripcion: descripcion.trim() || undefined,
        estado: "Agendada",
      };

      const citaId = await createCita(nuevaCitaPayload);
      const citaCreada: Cita = {
        ...nuevaCitaPayload,
        id: citaId,
      };

      toast.success("Cita agendada con éxito");
      onCitaCreada(citaCreada);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Error al agendar la cita");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 bg-white">
          <div className="flex items-center gap-2.5">
            <Calendar size={20} className="text-blue-600" />
            <h3 className="text-base font-bold text-slate-800">Agendar cita</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors border-0 bg-transparent cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Título */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Título</label>
            <input
              type="text"
              className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Fecha</label>
            <div className="relative">
              <input
                type="date"
                className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Hora inicio / Hora fin */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Hora inicio</label>
              <div className="relative flex items-center">
                <input
                  type="time"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Hora fin</label>
              <div className="relative flex items-center">
                <input
                  type="time"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Agenda / Asignar a */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Agenda</label>
              <select
                className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
              >
                <option value="Sin agenda">Sin agenda</option>
                <option value="Recepción">Recepción</option>
                <option value="Taller">Taller</option>
                <option value="Mantenimiento">Mantenimiento</option>
                <option value="Diagnóstico">Diagnóstico</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Asignar a</label>
              <select
                className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
                value={asignadoAId}
                onChange={(e) => setAsignadoAId(e.target.value)}
                disabled={loadingUsers}
              >
                <option value="">Sin asignar</option>
                {usuarios.map((u) => (
                  <option key={u.uid || u.id} value={u.uid || u.id}>
                    {u.displayName} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Descripción</label>
            <textarea
              className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[80px] resize-y"
              placeholder="Detalle o notas adicionales de la cita..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          {/* Banner azul informativo */}
          <div className="p-3 bg-blue-50/80 border border-blue-100 rounded-xl text-[11px] text-blue-600 font-medium">
            La cita se vinculará automáticamente a este presupuesto y al cliente {nombreCliente}.
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors border-0 cursor-pointer text-center"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow transition-colors border-0 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Calendar size={14} />
              )}
              Agendar cita
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
