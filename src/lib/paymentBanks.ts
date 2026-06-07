export const BANCOS_TRANSFERENCIA = [
  "Banco Pichincha",
  "Banco Guayaquil",
  "Banco Pacífico",
] as const;

export const BANCO_TRANSFERENCIA_LIST_ID = "bancos-transferencia";

export function normalizeBancoTransferencia(banco?: string) {
  const value = banco?.trim();
  return value || "Sin banco especificado";
}
