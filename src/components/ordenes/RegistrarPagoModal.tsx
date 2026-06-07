"use client";
import { useState } from "react";
import { X, Plus, Trash2, DollarSign } from "lucide-react";
import { Pago, MetodoPago } from "@/types";
import { toast } from "react-hot-toast";
import { BANCOS_TRANSFERENCIA, BANCO_TRANSFERENCIA_LIST_ID } from "@/lib/paymentBanks";
import {
  calcularPagoConRecargo,
  getPagoMetodoLabel,
  getPagoMontoBase,
  getPagoRecargo,
  METODOS_PAGO_ORDEN,
} from "@/lib/orderPayments";

interface RegistrarPagoModalProps {
  totalOrden: number;
  pagos: Omit<Pago, "id" | "ordenId">[];
  onClose: () => void;
  onChangePagos: (pagos: Omit<Pago, "id" | "ordenId">[]) => void;
}

function getMetodoOptionLabel(metodo: MetodoPago) {
  if (metodo === "tarjeta_credito") return "Tarjeta de credito (+8%)";
  if (metodo === "tarjeta_debito") return "Tarjeta de debito (+2%)";
  return getPagoMetodoLabel(metodo);
}

export default function RegistrarPagoModal({
  totalOrden,
  pagos,
  onClose,
  onChangePagos,
}: RegistrarPagoModalProps) {
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [banco, setBanco] = useState("");
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");

  const totalPagado = pagos.reduce((s, p) => s + getPagoMontoBase(p), 0);
  const totalRecargos = pagos.reduce((s, p) => s + getPagoRecargo(p), 0);
  const totalCobrado = pagos.reduce((s, p) => s + p.monto, 0);
  const saldo = Math.max(0, totalOrden - totalPagado);
  const pagoPreview = calcularPagoConRecargo(Number(monto || 0), metodo);

  const handleAddPago = () => {
    if (!monto || isNaN(Number(monto)) || Number(monto) <= 0) {
      toast.error("Ingrese un monto válido");
      return;
    }
    const montoNum = Number(monto);
    if (montoNum > saldo + 0.01) {
      toast.error(`El monto no puede superar el saldo pendiente ($${saldo.toFixed(2)})`);
      return;
    }

    const pagoCalculado = calcularPagoConRecargo(montoNum, metodo);

    const nuevoPago: Omit<Pago, "id" | "ordenId"> = {
      monto: pagoCalculado.montoCobrado,
      montoBase: pagoCalculado.montoBase,
      recargo: pagoCalculado.recargo,
      porcentajeRecargo: pagoCalculado.porcentajeRecargo,
      metodoPago: metodo,
      banco: metodo === "transferencia" ? banco.trim() || undefined : undefined,
      referencia: referencia.trim() || undefined,
      notas: notas.trim() || undefined,
    };

    onChangePagos([...pagos, nuevoPago]);
    setMonto("");
    setBanco("");
    setReferencia("");
    setNotas("");
    toast.success("Pago agregado temporalmente");
  };

  const handleRemovePago = (index: number) => {
    const nuevosPagos = pagos.filter((_, i) => i !== index);
    onChangePagos(nuevosPagos);
    toast.success("Pago eliminado");
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--bg-card)] w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--bg-card)]">
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <DollarSign className="text-[var(--success)]" size={20} />
            Registrar Abonos / Pagos
          </h2>
          <button onClick={onClose} className="btn-ghost btn-icon">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Métricas de Cobro */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border)]">
              <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">Total Orden</p>
              <p className="font-bold text-sm sm:text-base" style={{ color: "var(--text-primary)" }}>
                ${totalOrden.toFixed(2)}
              </p>
            </div>
            <div className="bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border)]">
              <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">Abonado</p>
              <p className="font-bold text-sm sm:text-base text-[var(--success)]">
                ${totalPagado.toFixed(2)}
              </p>
              {totalRecargos > 0 && (
                <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  <p>Recargo: ${totalRecargos.toFixed(2)}</p>
                  <p>Cobrado: ${totalCobrado.toFixed(2)}</p>
                </div>
              )}
            </div>
            <div className="bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border)]">
              <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">Saldo</p>
              <p
                className="font-bold text-sm sm:text-base"
                style={{
                  color: saldo <= 0.01 ? "var(--text-muted)" : "var(--warning)",
                }}
              >
                ${saldo.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Formulario */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Nuevo Abono</h3>
              
              <div className="form-group">
                <label className="label">Monto ($)</label>
                <div className="relative">
                  <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="number"
                    className="input pl-8 text-sm"
                    placeholder="0.00"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    step="0.01"
                    disabled={saldo <= 0.01}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Método de Pago</label>
                <select
                  className="input text-sm capitalize"
                  value={metodo}
                  onChange={(e) => setMetodo(e.target.value as MetodoPago)}
                  disabled={saldo <= 0.01}
                >
                  {METODOS_PAGO_ORDEN.map((m) => (
                    <option key={m} value={m}>
                      {getMetodoOptionLabel(m)}
                    </option>
                  ))}
                </select>
              </div>

              {pagoPreview.porcentajeRecargo > 0 && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ color: "var(--text-secondary)" }}>Abono base</span>
                    <strong>${pagoPreview.montoBase.toFixed(2)}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text-secondary)" }}>Recargo tarjeta ({pagoPreview.porcentajeRecargo}%)</span>
                    <strong>${pagoPreview.recargo.toFixed(2)}</strong>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span style={{ color: "var(--text-secondary)" }}>Total a cobrar</span>
                    <strong className="text-[var(--success)]">${pagoPreview.montoCobrado.toFixed(2)}</strong>
                  </div>
                </div>
              )}

              {metodo === "transferencia" && (
                <div className="form-group">
                  <label className="label">Banco</label>
                  <input
                    type="text"
                    className="input text-sm"
                    list={`${BANCO_TRANSFERENCIA_LIST_ID}-modal`}
                    placeholder="Selecciona o escribe el banco"
                    value={banco}
                    onChange={(e) => setBanco(e.target.value)}
                    disabled={saldo <= 0.01}
                  />
                  <datalist id={`${BANCO_TRANSFERENCIA_LIST_ID}-modal`}>
                    {BANCOS_TRANSFERENCIA.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>
              )}

              <div className="form-group">
                <label className="label">Referencia / Comprobante</label>
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="Ej: #12345"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  disabled={saldo <= 0.01}
                />
              </div>

              <div className="form-group">
                <label className="label">Notas (Opcional)</label>
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="Notas adicionales..."
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  disabled={saldo <= 0.01}
                />
              </div>

              <button
                type="button"
                onClick={handleAddPago}
                disabled={saldo <= 0.01}
                className="btn-primary w-full justify-center text-sm py-2"
              >
                <Plus size={16} />
                Agregar Abono
              </button>
            </div>

            {/* Listado temporal */}
            <div className="space-y-4 flex flex-col h-full">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Abonos Registrados ({pagos.length})</h3>
              
              <div className="flex-1 min-h-[200px] border border-[var(--border)] rounded-xl p-3 bg-[var(--bg-secondary)] overflow-y-auto max-h-[300px]">
                {pagos.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <p className="text-xs text-[var(--text-muted)]">No hay abonos registrados para esta nueva orden.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pagos.map((p, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-xs transition-all hover:border-[var(--accent-alpha)]"
                      >
                        <div>
                          <p className="font-bold text-[var(--success)]">${getPagoMontoBase(p).toFixed(2)}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] capitalize font-medium">
                            {p.metodoPago} {p.banco ? `· ${p.banco}` : ""} {p.referencia ? `· Ref: ${p.referencia}` : ""}
                          </p>
                          {getPagoRecargo(p) > 0 && (
                            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                              {getPagoMetodoLabel(p.metodoPago)} - Recargo: ${getPagoRecargo(p).toFixed(2)} - Cobrado: ${p.monto.toFixed(2)}
                            </p>
                          )}
                          {p.notas && (
                            <p className="text-[10px] text-[var(--text-muted)] italic mt-0.5">
                              &quot;{p.notas}&quot;
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePago(index)}
                          className="text-red-500 hover:bg-red-500/10 p-1.5 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-secondary)] flex justify-end">
          <button type="button" onClick={onClose} className="btn-secondary text-sm px-4 py-2">
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
