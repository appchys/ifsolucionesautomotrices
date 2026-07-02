"use client";
import { useState } from "react";
import { X, Lock } from "lucide-react";
import { useCajaStore, useAuthStore } from "@/store";
import { cerrarCaja, calcularResumenCaja } from "@/lib/services";
import { toast } from "react-hot-toast";

interface ModalCerrarCajaProps {
  onClose: () => void;
}

function money(v: number) {
  return `$${Number(v || 0).toFixed(2)}`;
}

export default function ModalCerrarCaja({ onClose }: ModalCerrarCajaProps) {
  const { caja, movimientosUnificados, closeCajaModal } = useCajaStore();
  const { user } = useAuthStore();
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  if (!caja) return null;

  const resumen = calcularResumenCaja(caja.montoApertura, movimientosUnificados);

  const handleCerrar = async () => {
    if (!caja.id || !user) return;
    setSaving(true);
    try {
      await cerrarCaja(caja.id, { uid: user.uid, displayName: user.displayName }, notas);
      toast.success("Caja cerrada exitosamente");
      closeCajaModal();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Error al cerrar la caja");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl shadow-2xl"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#ef444420" }}
          >
            <Lock size={16} style={{ color: "#ef4444" }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Cerrar caja
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Esta acción cerrará la sesión del día
            </p>
          </div>
          <button onClick={onClose} className="ml-auto btn-ghost btn-icon">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Resumen final */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Apertura", value: money(caja.montoApertura), color: "var(--text-primary)" },
              { label: "Efectivo en caja", value: money(resumen.efectivoEnCaja), color: "#10b981" },
              { label: "Total ingresos", value: money(resumen.totalIngresos), color: "#10b981" },
              { label: "Total egresos", value: money(resumen.totalEgresos), color: "#ef4444" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl p-3"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
              >
                <p className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>{item.label}</p>
                <p className="text-sm font-bold" style={{ color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Saldo esperado destacado */}
          <div
            className="rounded-xl p-4 flex items-center justify-between"
            style={{ background: "var(--accent)18", border: "1px solid var(--accent)40" }}
          >
            <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>Saldo esperado</p>
            <p className="text-xl font-bold" style={{ color: "var(--accent)" }}>{money(resumen.saldoEsperado)}</p>
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>
              Notas del cierre <span style={{ color: "var(--text-muted)" }}>(opcional)</span>
            </label>
            <textarea
              className="input w-full resize-none"
              rows={2}
              placeholder="Diferencias, observaciones..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>

          {/* Advertencia */}
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Una vez cerrada la caja, no se podrá registrar nuevos movimientos en esta sesión.
          </p>

          {/* Acciones */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="btn btn-secondary flex-1 text-sm"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              onClick={handleCerrar}
              className="btn flex-1 text-sm font-semibold"
              disabled={saving}
              style={{ background: "#ef4444", color: "#fff" }}
            >
              {saving ? "Cerrando..." : "Cerrar caja"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
