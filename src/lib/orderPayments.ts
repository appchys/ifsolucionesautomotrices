import type { MetodoPago, Pago } from "@/types";

export const METODOS_PAGO_ORDEN: MetodoPago[] = [
  "efectivo",
  "transferencia",
  "tarjeta_credito",
  "tarjeta_debito",
  "otro",
];

export const METODO_PAGO_LABELS: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  tarjeta_credito: "Tarjeta de credito",
  tarjeta_debito: "Tarjeta de debito",
  otro: "Otro",
};

const RECARGOS: Partial<Record<MetodoPago, number>> = {
  tarjeta_credito: 0.08,
  tarjeta_debito: 0.02,
};

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export function getPorcentajeRecargoPago(metodoPago: MetodoPago) {
  return RECARGOS[metodoPago] ?? 0;
}

export function calcularPagoConRecargo(montoBase: number, metodoPago: MetodoPago) {
  const base = roundMoney(Number(montoBase || 0));
  const porcentaje = getPorcentajeRecargoPago(metodoPago);
  const recargo = roundMoney(base * porcentaje);

  return {
    montoBase: base,
    recargo,
    porcentajeRecargo: porcentaje * 100,
    montoCobrado: roundMoney(base + recargo),
  };
}

export function getPagoMontoBase(pago: Pick<Pago, "monto" | "montoBase" | "recargo">) {
  if (typeof pago.montoBase === "number") return pago.montoBase;
  if (typeof pago.recargo === "number") return roundMoney(pago.monto - pago.recargo);
  return pago.monto;
}

export function getPagoRecargo(pago: Pick<Pago, "recargo">) {
  return typeof pago.recargo === "number" ? pago.recargo : 0;
}

export function getPagoMetodoLabel(metodoPago: MetodoPago) {
  return METODO_PAGO_LABELS[metodoPago] ?? metodoPago;
}
