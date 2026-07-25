"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Save, FileText } from "lucide-react";
import { toast } from "react-hot-toast";
import { getDatosTaller, saveDatosTaller } from "@/lib/services";
import { DatosTaller } from "@/types";

interface ConfigurarTerminosModalProps {
  onClose: () => void;
  onSaved?: (nuevosTerminos: string) => void;
}

export default function ConfigurarTerminosModal({
  onClose,
  onSaved,
}: ConfigurarTerminosModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tallerData, setTallerData] = useState<DatosTaller | null>(null);
  const [terminos, setTerminos] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const d = await getDatosTaller();
        if (active) {
          setTallerData(d);
          setTerminos(
            d.terminosPredeterminados ||
              "Los trabajos realizados tienen una garantía de 3 meses. El cliente debe retirar el vehículo dentro de los 5 días hábiles posteriores a la notificación de término."
          );
        }
      } catch (err) {
        console.error(err);
        if (active) toast.error("Error al cargar la configuración del taller");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    if (!tallerData) return;
    setSaving(true);
    try {
      const updatedData: DatosTaller = {
        ...tallerData,
        terminosPredeterminados: terminos.trim(),
      };
      await saveDatosTaller(updatedData);
      toast.success("Términos predeterminados guardados");
      onSaved?.(terminos.trim());
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar los términos");
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
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Configurar Términos y Condiciones
              </h3>
              <p className="text-xs text-slate-500">
                Términos generales por defecto para la empresa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors border-0 bg-transparent cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-blue-600" />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Texto de términos y condiciones por defecto
              </label>
              <textarea
                className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[160px] text-slate-800 resize-y"
                placeholder="Escribe la política de garantía, términos de pago y condiciones del taller..."
                value={terminos}
                onChange={(e) => setTerminos(e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-2">
                Este texto aparecerá en todos los presupuestos nuevos o cuando se marque la casilla &quot;Usar términos predeterminados&quot;.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors border-0 bg-transparent cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow transition-colors border-0 cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Guardar términos
          </button>
        </div>
      </div>
    </div>
  );
}
