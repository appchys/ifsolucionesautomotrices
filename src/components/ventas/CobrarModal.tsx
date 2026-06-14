"use client";
import React, { useState, useMemo } from "react";
import { X, Loader2, DollarSign, Trash2 } from "lucide-react";
import { Pago, MetodoPago } from "@/types";
import { toast } from "react-hot-toast";

interface Props {
  total: number;
  onClose: () => void;
  onConfirm: (pagos: Omit<Pago, "id" | "ordenId">[]) => Promise<void>;
}

export default function CobrarModal({ total, onClose, onConfirm }: Props) {
  // Local payments list
  const [pagos, setPagos] = useState<Omit<Pago, "id" | "ordenId">[]>([]);
  
  // Form fields
  const [montoPago, setMontoPago] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [bancoPago, setBancoPago] = useState("");
  const [referenciaPago, setReferenciaPago] = useState("");
  const [notasPago, setNotasPago] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Financial calculations
  const totalAbonado = useMemo(() => {
    return Number(pagos.reduce((acc, p) => acc + (p.montoBase ?? p.monto), 0).toFixed(2));
  }, [pagos]);

  const saldoPendiente = Math.max(0, total - totalAbonado);

  // Auto-fill pending balance
  useMemo(() => {
    if (!montoPago && saldoPendiente > 0) {
      setMontoPago(saldoPendiente.toFixed(2));
    }
  }, [saldoPendiente]);

  const handleAddPago = () => {
    if (!montoPago || isNaN(Number(montoPago)) || Number(montoPago) <= 0) {
      toast.error("Monto inválido");
      return;
    }
    const baseMonto = Number(montoPago);
    if (baseMonto > saldoPendiente + 0.01) {
      toast.error(`El abono no puede superar el saldo de $${saldoPendiente.toFixed(2)}`);
      return;
    }

    let porcentajeRecargo = 0;
    if (metodoPago === "tarjeta_credito") porcentajeRecargo = 8;
    else if (metodoPago === "tarjeta_debito") porcentajeRecargo = 2;

    const recargo = baseMonto * (porcentajeRecargo / 100);
    const montoTotal = baseMonto + recargo;

    const nuevoPago: Omit<Pago, "id" | "ordenId"> = {
      monto: montoTotal,
      montoBase: baseMonto,
      recargo: recargo > 0 ? recargo : undefined,
      porcentajeRecargo: porcentajeRecargo > 0 ? porcentajeRecargo : undefined,
      metodoPago,
      banco: metodoPago === "transferencia" || metodoPago.includes("tarjeta") ? bancoPago.trim() || undefined : undefined,
      referencia: referenciaPago.trim() || undefined,
      notas: notasPago.trim() || undefined,
    };

    setPagos([...pagos, nuevoPago]);
    setMontoPago("");
    setBancoPago("");
    setReferenciaPago("");
    setNotasPago("");
    toast.success("Pago agregado al recibo");
  };

  const handleDeletePago = (index: number) => {
    setPagos(pagos.filter((_, i) => i !== index));
    toast.success("Pago eliminado del recibo");
  };

  const handleConfirm = async () => {
    if (pagos.length === 0) {
      toast.error("Debe agregar al menos un pago");
      return;
    }

    if (saldoPendiente > 0.01) {
      if (!window.confirm(`Queda un saldo pendiente de $${saldoPendiente.toFixed(2)}. ¿Deseas registrar la venta con este saldo pendiente?`)) {
        return;
      }
    }

    setSubmitting(true);
    try {
      await onConfirm(pagos);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--bg-card)] w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-[var(--border)]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
            💵 Registrar Abonos / Pagos
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Totals info */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 dark:bg-slate-900/10 p-2.5 rounded-lg border border-[var(--border)] text-xs">
              <p className="text-[var(--text-muted)] font-semibold uppercase">Total</p>
              <p className="font-extrabold text-[var(--text-primary)] mt-0.5">${total.toFixed(2)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/10 p-2.5 rounded-lg border border-[var(--border)] text-xs">
              <p className="text-[var(--text-muted)] font-semibold uppercase">Cobrado</p>
              <p className="font-extrabold text-emerald-600 mt-0.5">${totalAbonado.toFixed(2)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/10 p-2.5 rounded-lg border border-[var(--border)] text-xs">
              <p className="text-[var(--text-muted)] font-semibold uppercase">Saldo</p>
              <p className="font-extrabold text-amber-600 mt-0.5">${saldoPendiente.toFixed(2)}</p>
            </div>
          </div>

          {/* Form fields */}
          <div className="form-group">
            <label className="label">Monto ($)</label>
            <input
              type="number"
              className="input text-sm"
              placeholder="0.00"
              value={montoPago}
              onChange={(e) => setMontoPago(e.target.value)}
              disabled={saldoPendiente <= 0.01}
            />
          </div>

          <div className="form-group">
            <label className="label">Método de pago</label>
            <select
              className="input text-sm"
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
              disabled={saldoPendiente <= 0.01}
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="tarjeta_credito">Tarjeta de Crédito</option>
              <option value="tarjeta_debito">Tarjeta de Débito</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          {(metodoPago === "tarjeta_credito" || metodoPago === "tarjeta_debito") && montoPago && !isNaN(Number(montoPago)) ? (
            <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-400">
              <p className="font-bold flex justify-between">
                <span>Recargo por tarjeta ({metodoPago === "tarjeta_credito" ? "8%" : "2%"}):</span>
                <span>${(Number(montoPago) * (metodoPago === "tarjeta_credito" ? 0.08 : 0.02)).toFixed(2)}</span>
              </p>
              <p className="font-extrabold flex justify-between mt-1 text-sm text-[var(--text-primary)]">
                <span>Total a cobrar al cliente:</span>
                <span>${(Number(montoPago) * (metodoPago === "tarjeta_credito" ? 1.08 : 1.02)).toFixed(2)}</span>
              </p>
            </div>
          ) : null}

          {(metodoPago === "transferencia" || metodoPago.includes("tarjeta")) && (
            <div className="form-group">
              <label className="label">Banco</label>
              <input
                type="text"
                className="input text-sm"
                placeholder="Escriba o seleccione banco"
                value={bancoPago}
                onChange={(e) => setBancoPago(e.target.value)}
                list="bancos-list-pos"
                disabled={saldoPendiente <= 0.01}
              />
              <datalist id="bancos-list-pos">
                <option value="Banco Pichincha" />
                <option value="Banco Guayaquil" />
                <option value="Banco del Pacífico" />
                <option value="Produbanco" />
                <option value="Banco Bolivariano" />
                <option value="Banco Internacional" />
                <option value="Banco del Austro" />
                <option value="Cooperativa JEP" />
              </datalist>
            </div>
          )}

          <div className="form-group">
            <label className="label">Referencia / Comprobante</label>
            <input
              type="text"
              className="input text-sm"
              placeholder="Ej: #123456"
              value={referenciaPago}
              onChange={(e) => setReferenciaPago(e.target.value)}
              disabled={saldoPendiente <= 0.01}
            />
          </div>

          <div className="form-group">
            <label className="label">Notas (Opcional)</label>
            <input
              type="text"
              className="input text-sm"
              placeholder="Detalles sobre el pago..."
              value={notasPago}
              onChange={(e) => setNotasPago(e.target.value)}
              disabled={saldoPendiente <= 0.01}
            />
          </div>

          <button
            type="button"
            onClick={handleAddPago}
            disabled={saldoPendiente <= 0.01}
            className="btn-primary w-full justify-center py-2"
          >
            Registrar Pago
          </button>

          {/* Payments log */}
          <div className="border-t border-[var(--border)] pt-4">
            <label className="label uppercase text-[10px] tracking-wider mb-2 block font-bold">
              Historial de Pagos ({pagos.length})
            </label>
            <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
              {pagos.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/10 border border-[var(--border)] text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      ${(p.montoBase ?? p.monto).toFixed(2)}
                      {p.recargo ? <span className="text-amber-600 dark:text-amber-400 font-semibold text-[10px] ml-1">(+${p.recargo.toFixed(2)} recargo)</span> : null}
                    </p>
                    <p className="text-[10px] text-slate-500 capitalize">
                      {p.metodoPago} {p.banco ? `· Banco: ${p.banco}` : ""} {p.referencia ? `· Ref: ${p.referencia}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeletePago(idx)}
                    className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-1.5 rounded transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {pagos.length === 0 && (
                <p className="text-center text-xs text-[var(--text-muted)] italic py-2">
                  Sin abonos registrados.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-slate-50 dark:bg-[var(--bg-secondary)] flex justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary text-xs px-4 py-2"
          >
            Cerrar
          </button>
          
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || pagos.length === 0}
            className="btn btn-primary text-xs px-5 py-2 font-bold"
          >
            {submitting && <Loader2 size={12} className="animate-spin mr-1.5" />}
            Finalizar Venta
          </button>
        </div>
      </div>
    </div>
  );
}
