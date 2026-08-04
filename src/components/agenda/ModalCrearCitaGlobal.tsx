"use client";

import { useEffect, useState, useRef } from "react";
import { X, Calendar, Clock, Loader2, User, Car, FileText, Check } from "lucide-react";
import { toast } from "react-hot-toast";
import { createCita, getClientes, getVehiculos, getUsuarios, getOrdenes } from "@/lib/services";
import { Cliente, Vehiculo, AppUser, Cita, OrdenTrabajo } from "@/types";

interface ModalCrearCitaGlobalProps {
  isOpen: boolean;
  onClose: () => void;
  fechaInicial?: string;
  onCitaCreada: (cita: Cita) => void;
}

export default function ModalCrearCitaGlobal({
  isOpen,
  onClose,
  fechaInicial,
  onCitaCreada,
}: ModalCrearCitaGlobalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Fecha por defecto: la proporcionada o mañana YYYY-MM-DD
  const getFechaManana = () => {
    if (fechaInicial) return fechaInicial;
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };

  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState(getFechaManana());
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFin, setHoraFin] = useState("10:00");
  const [agenda, setAgenda] = useState("Revisión general");
  const [asignadoAId, setAsignadoAId] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const [clienteId, setClienteId] = useState("");
  const [vehiculoId, setVehiculoId] = useState("");
  const [presupuestoId, setPresupuestoId] = useState("");

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [presupuestos, setPresupuestos] = useState<OrdenTrabajo[]>([]);

  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (fechaInicial) setFecha(fechaInicial);

    let active = true;
    (async () => {
      try {
        setLoadingData(true);
        const [cList, vList, uList, oList] = await Promise.all([
          getClientes(),
          getVehiculos(),
          getUsuarios(),
          getOrdenes(),
        ]);
        if (active) {
          setClientes(cList);
          setVehiculos(vList);
          setUsuarios(uList.filter((u) => u.activo));
          setPresupuestos(oList.filter((o) => o.esCotizacion));
        }
      } catch (err) {
        console.error("Error al cargar datos para agendar cita", err);
      } finally {
        if (active) setLoadingData(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [isOpen, fechaInicial]);

  // Filtrar vehículos por cliente seleccionado
  const vehiculosFiltrados = clienteId
    ? vehiculos.filter((v) => v.clienteId === clienteId)
    : vehiculos;

  // Actualizar título automáticamente si hay cliente/vehículo elegido y el título está vacío
  useEffect(() => {
    if (!titulo && (clienteId || vehiculoId)) {
      const c = clientes.find((item) => item.id === clienteId);
      const v = vehiculos.find((item) => item.id === vehiculoId);
      const nom = c ? `${c.nombre} ${c.apellido || ""}`.trim() : "";
      const pla = v ? ` - ${v.placa}` : "";
      if (nom) setTitulo(`Cita con ${nom}${pla}`);
    }
  }, [clienteId, vehiculoId, clientes, vehiculos, titulo]);

  if (!isOpen) return null;

  // Cerrar al clicar fuera del contenido del modal
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (backdropRef.current && e.target === backdropRef.current) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error("Por favor ingresa un título para la cita");
      return;
    }
    if (!fecha) {
      toast.error("Selecciona una fecha para la cita");
      return;
    }

    setSaving(true);
    try {
      const clienteSel = clientes.find((c) => c.id === clienteId);
      const vehiculoSel = vehiculos.find((v) => v.id === vehiculoId);
      const usuarioSel = usuarios.find((u) => u.uid === asignadoAId || u.id === asignadoAId);

      const nuevaCitaPayload: Omit<Cita, "id"> = {
        titulo: titulo.trim(),
        fecha,
        horaInicio,
        horaFin,
        agenda,
        descripcion: descripcion.trim() || undefined,
        clienteId: clienteId || undefined,
        clienteNombre: clienteSel ? `${clienteSel.nombre} ${clienteSel.apellido || ""}`.trim() : undefined,
        vehiculoId: vehiculoId || undefined,
        vehiculoPlaca: vehiculoSel?.placa || undefined,
        presupuestoId: presupuestoId || undefined,
        asignadoAId: asignadoAId || undefined,
        asignadoANombre: usuarioSel?.displayName || undefined,
        estado: "Agendada",
      };

      const newId = await createCita(nuevaCitaPayload);
      const citaCreada: Cita = { id: newId, ...nuevaCitaPayload };

      toast.success("Cita agendada con éxito");
      onCitaCreada(citaCreada);
      onClose();
    } catch (err) {
      console.error("Error agendando cita", err);
      toast.error("Ocurrió un error al agendar la cita");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Agendar Nueva Cita
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Registra reuniones, revisiones o visitas al taller
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border-0 bg-transparent cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Título de la cita */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Título de la cita <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Revisión de frenos - Juan Pérez"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Fecha y Horarios en 1 fila */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                Hora Inicio
              </label>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                Hora Fin
              </label>
              <input
                type="time"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Cliente y Vehículo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                <User size={12} className="text-blue-500" />
                Cliente (Opcional)
              </label>
              <select
                value={clienteId}
                onChange={(e) => {
                  setClienteId(e.target.value);
                  setVehiculoId("");
                }}
                disabled={loadingData}
                className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">-- Sin asignar / Seleccionar cliente --</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.apellido || ""} {c.identificacion ? `(${c.identificacion})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Car size={12} className="text-blue-500" />
                Vehículo (Opcional)
              </label>
              <select
                value={vehiculoId}
                onChange={(e) => setVehiculoId(e.target.value)}
                disabled={loadingData}
                className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">-- Sin vehículo / Seleccionar --</option>
                {vehiculosFiltrados.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.placa} — {v.marca} {v.modelo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Agenda / Categoría y Encargado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                Tipo / Agenda
              </label>
              <select
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="Revisión general">Revisión general</option>
                <option value="Ingreso de vehículo">Ingreso de vehículo</option>
                <option value="Entrega de vehículo">Entrega de vehículo</option>
                <option value="Reunión cliente">Reunión cliente</option>
                <option value="Mantenimiento periódico">Mantenimiento periódico</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                Asignado a
              </label>
              <select
                value={asignadoAId}
                onChange={(e) => setAsignadoAId(e.target.value)}
                disabled={loadingData}
                className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">-- Sin usuario asignado --</option>
                {usuarios.map((u) => (
                  <option key={u.id || u.uid} value={u.uid || u.id}>
                    {u.displayName || u.email} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Presupuesto vinculado (Opcional) */}
          {presupuestos.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                <FileText size={12} className="text-blue-500" />
                Vincular a Presupuesto (Opcional)
              </label>
              <select
                value={presupuestoId}
                onChange={(e) => setPresupuestoId(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">-- Sin vincular a presupuesto --</option>
                {presupuestos.map((p) => (
                  <option key={p.id} value={p.id}>
                    PRE-{String(p.numeroCotizacion || p.numero || 0).padStart(4, "0")} — {p.motivo || "Cotización"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Descripción / Notas */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Notas adicionales / Descripción
            </label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalles sobre lo que se realizará en la cita..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer border-0 bg-transparent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer border-0 transition-colors disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Agendar Cita
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
