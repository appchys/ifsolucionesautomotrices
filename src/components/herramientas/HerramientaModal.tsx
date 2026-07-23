"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Wrench } from "lucide-react";
import { Herramienta, EstadoHerramienta, AppUser } from "@/types";
import { createHerramienta, updateHerramienta, getUsuarios } from "@/lib/services";
import { toast } from "react-hot-toast";

interface HerramientaModalProps {
  herramienta?: Herramienta | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const CATEGORIAS_PREDEFINIDAS = [
  "Diagnóstico",
  "Neumática",
  "Manual",
  "Eléctrica",
  "Elevación",
  "Medición",
  "Especializada",
  "General",
];

const ESTADOS_OPCIONES: { value: EstadoHerramienta; label: string; color: string }[] = [
  { value: "excelente", label: "Excelente", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "bueno", label: "Bueno", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "regular", label: "Regular", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "mantenimiento", label: "En Mantenimiento", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "dañado", label: "Dañado", color: "bg-red-50 text-red-700 border-red-200" },
  { value: "perdido", label: "Perdido", color: "bg-slate-100 text-slate-600 border-slate-300" },
];

export default function HerramientaModal({ herramienta, onClose, onSuccess }: HerramientaModalProps) {
  const isEditing = Boolean(herramienta?.id);
  const [submitting, setSubmitting] = useState(false);
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);

  const [form, setForm] = useState({
    codigo: herramienta?.codigo || "",
    nombre: herramienta?.nombre || "",
    categoria: herramienta?.categoria || "General",
    marca: herramienta?.marca || "",
    modelo: herramienta?.modelo || "",
    numeroSerie: herramienta?.numeroSerie || "",
    cantidad: herramienta?.cantidad ?? 1,
    ubicacion: herramienta?.ubicacion || "",
    estado: herramienta?.estado || ("bueno" as EstadoHerramienta),
    responsableId: herramienta?.responsableId || "",
    responsableNombre: herramienta?.responsableNombre || "",
    fechaAdquisicion: herramienta?.fechaAdquisicion || new Date().toISOString().split("T")[0],
    costoCompra: herramienta?.costoCompra ? String(herramienta.costoCompra) : "",
    notas: herramienta?.notas || "",
  });

  useEffect(() => {
    getUsuarios()
      .then((data) => setUsuarios(data.filter((u) => u.activo)))
      .catch(console.error);
  }, []);

  const handleResponsableChange = (userId: string) => {
    if (!userId) {
      setForm((prev) => ({ ...prev, responsableId: "", responsableNombre: "" }));
      return;
    }
    const found = usuarios.find((u) => u.uid === userId || u.id === userId);
    setForm((prev) => ({
      ...prev,
      responsableId: userId,
      responsableNombre: found?.displayName || "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.error("El nombre de la herramienta es obligatorio");
      return;
    }

    setSubmitting(true);
    try {
      const codigoFinal = form.codigo.trim() || `HER-${Math.floor(1000 + Math.random() * 9000)}`;

      const dataToSave = {
        codigo: codigoFinal,
        nombre: form.nombre.trim(),
        categoria: form.categoria.trim() || "General",
        marca: form.marca.trim() || undefined,
        modelo: form.modelo.trim() || undefined,
        numeroSerie: form.numeroSerie.trim() || undefined,
        cantidad: Number(form.cantidad) > 0 ? Number(form.cantidad) : 1,
        ubicacion: form.ubicacion.trim() || undefined,
        estado: form.estado,
        responsableId: form.responsableId || undefined,
        responsableNombre: form.responsableNombre || undefined,
        fechaAdquisicion: form.fechaAdquisicion || undefined,
        costoCompra: form.costoCompra && !isNaN(Number(form.costoCompra)) ? Number(form.costoCompra) : undefined,
        notas: form.notas.trim() || undefined,
      };

      if (isEditing && herramienta?.id) {
        await updateHerramienta(herramienta.id, dataToSave);
        toast.success("Herramienta actualizada con éxito");
      } else {
        await createHerramienta(dataToSave);
        toast.success("Herramienta registrada con éxito");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar la herramienta");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-[var(--border)] animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)] bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">
              <Wrench size={18} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
                {isEditing ? "Editar Herramienta" : "Nueva Herramienta"}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {isEditing ? "Actualiza los datos del equipo del taller" : "Registra un nuevo equipo o herramienta del taller"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Código (Opcional)
              </label>
              <input
                type="text"
                className="input w-full text-xs uppercase font-mono"
                placeholder="Ej: HER-01"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Nombre de la herramienta *
              </label>
              <input
                type="text"
                className="input w-full text-xs font-medium"
                placeholder="Ej: Pistola Neumática 1/2"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Categoría
              </label>
              <input
                type="text"
                list="categorias-list"
                className="input w-full text-xs"
                placeholder="Seleccione o escriba"
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              />
              <datalist id="categorias-list">
                {CATEGORIAS_PREDEFINIDAS.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Marca
              </label>
              <input
                type="text"
                className="input w-full text-xs"
                placeholder="Ej: Bosch / Dewalt"
                value={form.marca}
                onChange={(e) => setForm({ ...form, marca: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Modelo
              </label>
              <input
                type="text"
                className="input w-full text-xs"
                placeholder="Ej: GSB 18V"
                value={form.modelo}
                onChange={(e) => setForm({ ...form, modelo: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                N° Serie
              </label>
              <input
                type="text"
                className="input w-full text-xs font-mono"
                placeholder="Ej: SN-987654"
                value={form.numeroSerie}
                onChange={(e) => setForm({ ...form, numeroSerie: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Cantidad
              </label>
              <input
                type="number"
                min={1}
                className="input w-full text-xs font-bold text-center"
                value={form.cantidad}
                onChange={(e) => setForm({ ...form, cantidad: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Estado Actual
              </label>
              <select
                className="input w-full text-xs capitalize font-semibold"
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoHerramienta })}
              >
                {ESTADOS_OPCIONES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Ubicación / Estante
              </label>
              <input
                type="text"
                className="input w-full text-xs"
                placeholder="Ej: Carrito Diagnóstico / Estante B3"
                value={form.ubicacion}
                onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Responsable / Técnico Asignado
              </label>
              <select
                className="input w-full text-xs"
                value={form.responsableId}
                onChange={(e) => handleResponsableChange(e.target.value)}
              >
                <option value="">Sin asignación fija (General)</option>
                {usuarios.map((u) => (
                  <option key={u.uid || u.id} value={u.uid || u.id}>
                    {u.displayName} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Fecha Adquisición
              </label>
              <input
                type="date"
                className="input w-full text-xs"
                value={form.fechaAdquisicion}
                onChange={(e) => setForm({ ...form, fechaAdquisicion: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Costo Compra ($ USD)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                className="input w-full text-xs font-mono font-bold"
                value={form.costoCompra}
                onChange={(e) => setForm({ ...form, costoCompra: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
              Notas / Observaciones
            </label>
            <textarea
              rows={2}
              className="input w-full text-xs py-2 resize-none"
              placeholder="Detalles sobre accesorios, calibración o estado..."
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
            />
          </div>

          {/* Footer actions inside form */}
          <div className="pt-4 border-t border-[var(--border)] flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary text-xs px-4 py-2"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary text-xs px-6 py-2 flex items-center gap-2"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {isEditing ? "Guardar Cambios" : "Registrar Herramienta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
