"use client";
import { useState } from "react";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { useCajaStore, useAuthStore } from "@/store";
import { createMovimientoManual } from "@/lib/services";
import { MetodoPago } from "@/types";
import { METODO_PAGO_LABELS } from "@/lib/orderPayments";
import { BANCOS_TRANSFERENCIA } from "@/lib/paymentBanks";
import { toast } from "react-hot-toast";

interface ModalMovimientoProps {
  tipo: "ingreso" | "egreso";
  onClose: () => void;
}

const CATEGORIAS_INGRESO = [
  "Cobro orden",
  "Venta directa",
  "Anticipo",
  "Ajuste de caja",
  "Otro ingreso",
];

const CATEGORIAS_EGRESO = [
  "Gasto variable",
  "Gasto fijo",
  "Pago proveedor",
  "Pago técnico",
  "Reembolso cliente",
  "Ajuste de caja",
  "Otro egreso",
];

const METODOS: MetodoPago[] = ["efectivo", "transferencia", "tarjeta_credito", "tarjeta_debito", "otro"];

export default function ModalMovimiento({ tipo, onClose }: ModalMovimientoProps) {
  const { caja } = useCajaStore();
  const { user } = useAuthStore();

  const [concepto, setConcepto] = useState("");
  const [categoria, setCategoria] = useState(
    tipo === "ingreso" ? CATEGORIAS_INGRESO[0] : CATEGORIAS_EGRESO[0]
  );
  const [monto, setMonto] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [banco, setBanco] = useState("");
  const [referencia, setReferencia] = useState("");
  const [saving, setSaving] = useState(false);

  const categorias = tipo === "ingreso" ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;
  const needsBanco = metodoPago === "transferencia";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caja?.id || !user) return;
    const montoNum = parseFloat(monto.replace(",", "."));
    if (!concepto.trim()) return toast.error("Ingresa un concepto");
    if (!montoNum || montoNum <= 0) return toast.error("El monto debe ser mayor a 0");
    if (needsBanco && !banco.trim()) return toast.error("Selecciona un banco");

    setSaving(true);
    try {
      await createMovimientoManual(caja.id, {
        tipo,
        concepto: concepto.trim(),
        categoria,
        monto: montoNum,
        metodoPago,
        banco: needsBanco ? banco : undefined,
        referencia: referencia.trim() || undefined,
        registradoPor: { uid: user.uid, displayName: user.displayName },
      });
      toast.success(tipo === "ingreso" ? "Ingreso registrado" : "Egreso registrado");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Error al registrar");
    } finally {
      setSaving(false);
    }
  };

  const colorAccent = tipo === "ingreso" ? "#10b981" : "#ef4444";
  const Icon = tipo === "ingreso" ? TrendingUp : TrendingDown;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl shadow-2xl"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 rounded-t-2xl"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: colorAccent + "22" }}
          >
            <Icon size={18} style={{ color: colorAccent }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {tipo === "ingreso" ? "Registrar ingreso" : "Registrar egreso"}
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Movimiento manual de caja
            </p>
          </div>
          <button onClick={onClose} className="ml-auto btn-ghost btn-icon">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
          {/* Concepto */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>
              Concepto
            </label>
            <input
              className="input w-full"
              placeholder="Ej: Combustible, Repuesto urgente..."
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              required
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>
              Categoría
            </label>
            <select
              className="input w-full"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              {categorias.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Monto y método */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>
                Monto ($)
              </label>
              <input
                className="input w-full"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>
                Método
              </label>
              <select
                className="input w-full"
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
              >
                {METODOS.map((m) => (
                  <option key={m} value={m}>{METODO_PAGO_LABELS[m]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Banco (si es transferencia) */}
          {needsBanco && (
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>
                Banco
              </label>
              <select
                className="input w-full"
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                required
              >
                <option value="">Seleccionar banco</option>
                {BANCOS_TRANSFERENCIA.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
                <option value="Cooperativa JEP">Cooperativa JEP</option>
              </select>
            </div>
          )}

          {/* Referencia */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>
              Referencia <span style={{ color: "var(--text-muted)" }}>(opcional)</span>
            </label>
            <input
              className="input w-full"
              placeholder="N° de comprobante, factura..."
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn flex-1 font-semibold"
              disabled={saving}
              style={{ background: colorAccent, color: "#fff" }}
            >
              {saving ? "Guardando..." : tipo === "ingreso" ? "Registrar ingreso" : "Registrar egreso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
