"use client";
import { X, Printer } from "lucide-react";
import { useCajaStore } from "@/store";
import { calcularResumenCaja } from "@/lib/services";
import { METODO_PAGO_LABELS } from "@/lib/orderPayments";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";

interface ModalCorteParcialProps {
  onClose: () => void;
}

const METODO_COLORES: Record<string, string> = {
  efectivo: "#10b981",
  transferencia: "#3b82f6",
  tarjeta_credito: "#f59e0b",
  tarjeta_debito: "#8b5cf6",
  otro: "#94a3b8",
};

function money(v: number) {
  return `$${Number(v || 0).toFixed(2)}`;
}

export default function ModalCorteParcial({ onClose }: ModalCorteParcialProps) {
  const { caja, movimientosUnificados } = useCajaStore();
  if (!caja) return null;

  const resumen = calcularResumenCaja(caja.montoApertura, movimientosUnificados);

  const apertura = (caja.aperturaAt as Timestamp)?.toDate?.();
  const aperturaStr = apertura ? format(apertura, "dd/MM/yyyy HH:mm") : "--";

  const metodosConMovimiento = Object.entries(resumen.desglosePorMetodo).filter(
    ([, v]) => v.ingresos > 0 || v.egresos > 0
  );

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl shadow-2xl"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Corte parcial
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Desde {aperturaStr}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost btn-icon" title="Imprimir">
              <Printer size={15} />
            </button>
            <button onClick={onClose} className="btn-ghost btn-icon">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-5 flex flex-col gap-4">
          {/* Resumen principal */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Apertura", value: money(caja.montoApertura), color: "var(--text-primary)" },
              { label: "Ingresos", value: money(resumen.totalIngresos), color: "#10b981" },
              { label: "Egresos", value: money(resumen.totalEgresos), color: "#ef4444" },
              { label: "Saldo esperado", value: money(resumen.saldoEsperado), color: "var(--accent)" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl p-3"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
              >
                <p className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>{item.label}</p>
                <p className="text-base font-bold" style={{ color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Efectivo en caja */}
          <div
            className="rounded-xl p-3 flex items-center justify-between"
            style={{ background: "#10b98115", border: "1px solid #10b98133" }}
          >
            <p className="text-sm font-medium" style={{ color: "#10b981" }}>Efectivo en caja</p>
            <p className="text-lg font-bold" style={{ color: "#10b981" }}>{money(resumen.efectivoEnCaja)}</p>
          </div>

          {/* Desglose por método */}
          {metodosConMovimiento.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
                DESGLOSE POR MÉTODO
              </p>
              <div className="flex flex-col gap-1.5">
                {metodosConMovimiento.map(([metodo, vals]) => (
                  <div
                    key={metodo}
                    className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ background: "var(--bg-secondary)" }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: METODO_COLORES[metodo] ?? "#94a3b8" }}
                      />
                      <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                        {(METODO_PAGO_LABELS as Record<string, string>)[metodo] ?? metodo}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {vals.ingresos > 0 && (
                        <span className="text-xs font-semibold" style={{ color: "#10b981" }}>
                          +{money(vals.ingresos)}
                        </span>
                      )}
                      {vals.egresos > 0 && (
                        <span className="text-xs font-semibold" style={{ color: "#ef4444" }}>
                          -{money(vals.egresos)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-secondary flex-1 text-sm">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
