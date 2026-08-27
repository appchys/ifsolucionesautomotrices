"use client";
import ClienteSelectorModal from "@/components/clientes/ClienteSelectorModal";
import { Cliente } from "@/types";

interface Props {
  onClose: () => void;
  onSelect: (cliente: Cliente | null) => void;
  selectedClienteId?: string;
}

export default function VentasClienteSelectorModal({ onClose, onSelect, selectedClienteId }: Props) {
  return (
    <ClienteSelectorModal
      onClose={onClose}
      onSelect={onSelect}
      selectedClienteId={selectedClienteId}
      allowConsumidorFinal={true}
      title="Seleccionar Cliente"
    />
  );
}
