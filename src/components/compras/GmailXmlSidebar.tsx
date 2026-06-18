"use client";

import { useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  FileText,
  Info,
  List,
  Loader2,
  Mail,
  RotateCcw,
  Search,
  Upload,
  X,
} from "lucide-react";
import { BANCOS_TRANSFERENCIA, BANCO_TRANSFERENCIA_LIST_ID } from "@/lib/paymentBanks";
import type { Compra, CompraMetodoPago, CompraPago, EstadoPago } from "@/types";

export type PendingCompraDraft = {
  id?: string;
  compra: Omit<Compra, "id">;
  pagos: CompraPago[];
  gmailMessageId?: string;
};

type XmlTab = "pending" | "saved" | "discarded";

const COMPRA_METODOS_PAGO: { value: CompraMetodoPago; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta_debito", label: "Tarjeta de debito" },
  { value: "nota_credito", label: "Nota de credito" },
  { value: "otro", label: "Otro" },
];

function formatMoney(value: number): string {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getCompraPagos(compra?: Compra | Omit<Compra, "id"> | null): CompraPago[] {
  return compra?.pagosProveedor ?? [];
}

function getCompraTotalPagado(compra?: Compra | Omit<Compra, "id"> | null): number {
  if (!compra) return 0;
  if (typeof compra.totalPagadoProveedor === "number") return compra.totalPagadoProveedor;
  return getCompraPagos(compra).reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
}

function getCompraSaldo(compra?: Compra | Omit<Compra, "id"> | null): number {
  if (!compra) return 0;
  if (typeof compra.saldoProveedor === "number") return compra.saldoProveedor;
  return Math.max(compra.importeTotal - getCompraTotalPagado(compra) - Number(compra.totalDevueltoProveedor ?? 0), 0);
}

function withCompraPaymentSummary<T extends Omit<Compra, "id"> | Compra>(compra: T, pagosProveedor: CompraPago[]): T {
  const totalPagadoProveedor = Number(
    pagosProveedor.reduce((sum, pago) => sum + Number(pago.monto || 0), 0).toFixed(2)
  );
  const totalDevueltoProveedor = Number(compra.totalDevueltoProveedor ?? 0);
  const saldoProveedor = Number(Math.max(compra.importeTotal - totalPagadoProveedor - totalDevueltoProveedor, 0).toFixed(2));
  const estadoPagoProveedor: EstadoPago =
    totalPagadoProveedor >= compra.importeTotal - 0.01
      ? "pagado"
      : totalPagadoProveedor > 0.01
        ? "parcial"
        : "pendiente";

  return {
    ...compra,
    pagosProveedor,
    totalPagadoProveedor,
    saldoProveedor,
    estadoPagoProveedor,
  };
}

function getXmlDateGroupLabel(draft: PendingCompraDraft): string {
  return draft.compra.fechaEmision?.trim() || "Sin fecha";
}

function EmptyXmlState({ icon, children }: { icon?: ReactNode; children: string }) {
  return (
    <div className="h-full min-h-56 flex flex-col items-center justify-center gap-2 text-center text-[var(--text-muted)]">
      <div className="opacity-45">{icon ?? <FileText size={34} />}</div>
      <p className="text-xs">{children}</p>
    </div>
  );
}

type GmailXmlSidebarProps = {
  sidebarOpen: boolean;
  pendingCompra: Omit<Compra, "id"> | null;
  pendingCompras: PendingCompraDraft[];
  savedGmailDrafts: PendingCompraDraft[];
  discardedGmailDrafts: PendingCompraDraft[];
  activePendingIndex: number;
  draftPagos: CompraPago[];
  gmailImporting: boolean;
  savingCompra: boolean;
  pendingInitialPagoPreview: number;
  pendingSaldoPreview: number;
  pendingIsPaidPreview: boolean;
  pendingXmlCount: number;
  savedXmlCount: number;
  discardedXmlCount: number;
  gmailXmlTotalCount: number;
  pagoMonto: string;
  pagoMetodo: CompraMetodoPago;
  pagoBanco: string;
  pagoReferencia: string;
  pagoNotas: string;
  setPagoMonto: Dispatch<SetStateAction<string>>;
  setPagoMetodo: Dispatch<SetStateAction<CompraMetodoPago>>;
  setPagoBanco: Dispatch<SetStateAction<string>>;
  setPagoReferencia: Dispatch<SetStateAction<string>>;
  setPagoNotas: Dispatch<SetStateAction<string>>;
  onRefreshGmail: () => void;
  onClose: () => void;
  onTogglePendingPagoEstado: () => void;
  onSelectPendingCompra: (index: number) => void;
  onCancelPendingCompra: () => void;
  onDiscardActivePendingCompra: () => void;
  onConfirmPendingCompra: () => void;
  onConfirmAllPendingCompras: () => void;
};

export default function GmailXmlSidebar({
  sidebarOpen,
  pendingCompra,
  pendingCompras,
  savedGmailDrafts,
  discardedGmailDrafts,
  activePendingIndex,
  gmailImporting,
  savingCompra,
  pendingInitialPagoPreview,
  pendingSaldoPreview,
  pendingIsPaidPreview,
  pendingXmlCount,
  savedXmlCount,
  discardedXmlCount,
  gmailXmlTotalCount,
  pagoMonto,
  pagoMetodo,
  pagoBanco,
  pagoReferencia,
  pagoNotas,
  setPagoMonto,
  setPagoMetodo,
  setPagoBanco,
  setPagoReferencia,
  setPagoNotas,
  onRefreshGmail,
  onClose,
  onTogglePendingPagoEstado,
  onSelectPendingCompra,
  onCancelPendingCompra,
  onDiscardActivePendingCompra,
  onConfirmPendingCompra,
  onConfirmAllPendingCompras,
}: GmailXmlSidebarProps) {
  const [activeTab, setActiveTab] = useState<XmlTab>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSavedIndex, setSelectedSavedIndex] = useState(0);
  const [selectedDiscardedIndex, setSelectedDiscardedIndex] = useState(0);
  const [itemsExpanded, setItemsExpanded] = useState(true);

  const processedXmlCount = savedXmlCount + discardedXmlCount;
  const progressPercent = gmailXmlTotalCount > 0 ? Math.round((processedXmlCount / gmailXmlTotalCount) * 100) : 0;

  const activePendingDraft = pendingCompras[activePendingIndex] ?? null;
  const activePendingCompra = pendingCompra ?? activePendingDraft?.compra ?? null;

  const currentDrafts = activeTab === "pending" ? pendingCompras : activeTab === "saved" ? savedGmailDrafts : discardedGmailDrafts;
  const selectedReadOnlyIndex = activeTab === "saved" ? selectedSavedIndex : selectedDiscardedIndex;
  const selectedDraft =
    activeTab === "pending"
      ? activePendingDraft
      : currentDrafts[Math.min(selectedReadOnlyIndex, Math.max(currentDrafts.length - 1, 0))] ?? null;
  const detailCompra =
    activeTab === "pending"
      ? activePendingCompra
      : selectedDraft
        ? withCompraPaymentSummary(selectedDraft.compra, selectedDraft.pagos)
        : null;

  const filteredDrafts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return currentDrafts;
    return currentDrafts.filter(({ compra }) =>
      [
        compra.numeroFactura,
        compra.proveedorRazonSocial,
        compra.proveedorRuc,
        compra.claveAcceso,
      ].some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery))
    );
  }, [currentDrafts, searchQuery]);
  const groupedFilteredDrafts = useMemo(() => {
    const groups: { label: string; items: { draft: PendingCompraDraft; index: number }[] }[] = [];

    filteredDrafts.forEach((draft, index) => {
      const label = getXmlDateGroupLabel(draft);
      const existingGroup = groups.find((group) => group.label === label);
      if (existingGroup) {
        existingGroup.items.push({ draft, index });
      } else {
        groups.push({ label, items: [{ draft, index }] });
      }
    });

    return groups;
  }, [filteredDrafts]);

  const headerTitle = detailCompra?.numeroFactura || "Bandeja de XML de Gmail";
  const headerSubtitle = detailCompra
    ? `${detailCompra.proveedorRazonSocial || "Proveedor sin nombre"} - RUC: ${detailCompra.proveedorRuc || "N/D"}`
    : gmailImporting
      ? "Buscando nuevos correos..."
      : "Sin XML seleccionado";

  const detailTotalPagado = activeTab === "pending" ? pendingInitialPagoPreview : getCompraTotalPagado(detailCompra);
  const detailSaldo = activeTab === "pending" ? pendingSaldoPreview : getCompraSaldo(detailCompra);
  const detailIsPaid = activeTab === "pending" ? pendingIsPaidPreview : detailSaldo <= 0.01;
  const isPendingDetail = activeTab === "pending" && Boolean(detailCompra);

  const selectTab = (tab: XmlTab) => {
    setActiveTab(tab);
    setSearchQuery("");
  };

  const selectDraft = (draft: PendingCompraDraft, displayIndex: number) => {
    const realIndex = currentDrafts.findIndex((item) => item.compra.claveAcceso === draft.compra.claveAcceso);
    const index = realIndex >= 0 ? realIndex : displayIndex;
    if (activeTab === "pending") onSelectPendingCompra(index);
    if (activeTab === "saved") setSelectedSavedIndex(index);
    if (activeTab === "discarded") setSelectedDiscardedIndex(index);
    setItemsExpanded(true);
  };

  const isSelectedDraft = (draft: PendingCompraDraft, displayIndex: number) => {
    if (activeTab === "pending") return currentDrafts.findIndex((item) => item.compra.claveAcceso === draft.compra.claveAcceso) === activePendingIndex;
    if (activeTab === "saved") return currentDrafts.findIndex((item) => item.compra.claveAcceso === draft.compra.claveAcceso) === selectedSavedIndex;
    return currentDrafts.findIndex((item) => item.compra.claveAcceso === draft.compra.claveAcceso) === selectedDiscardedIndex || (displayIndex === 0 && !currentDrafts[selectedDiscardedIndex]);
  };

  const metricCards: { id: XmlTab; label: string; count: number; icon: ReactNode; tone: "amber" | "green" | "gray" }[] = [
    { id: "pending", label: "Pendientes", count: pendingXmlCount, icon: <Clock size={16} className="animate-pulse" />, tone: "amber" },
    { id: "saved", label: "Guardados", count: savedXmlCount, icon: <CheckCircle2 size={16} />, tone: "green" },
    { id: "discarded", label: "Descartados", count: discardedXmlCount, icon: <X size={16} />, tone: "gray" },
  ];

  return (
    <div
      className={`fixed inset-0 z-[1000] flex justify-end bg-slate-950/45 backdrop-blur-sm animate-fade-in ${sidebarOpen ? "sidebar-aware-overlay" : "sidebar-aware-overlay-collapsed"}`}
      onClick={onClose}
    >
      <div
        className="w-full min-w-0 h-full p-3 sm:p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <section className="h-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
          <header className="shrink-0 px-5 py-4 border-b border-[var(--border-light)] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full font-medium">
                <Mail size={12} />
                Bandeja XML - Gmail
              </span>
              <h2 className="mt-2 text-base font-semibold text-[var(--text-primary)] truncate">{headerTitle}</h2>
              <p className="text-xs text-[var(--text-secondary)] truncate">{headerSubtitle}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onRefreshGmail}
                disabled={gmailImporting || savingCompra}
                className="h-8 px-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-red-100 disabled:opacity-55 disabled:pointer-events-none"
                title="Buscar nuevos XML en Gmail"
              >
                {gmailImporting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                <span>{gmailImporting ? "Actualizando..." : "Actualizar"}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-md border border-[var(--border)] text-[var(--text-secondary)] flex items-center justify-center hover:bg-[var(--bg-secondary)]"
                title="Cerrar panel"
                aria-label="Cerrar panel"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          <div className="shrink-0 px-5 py-3 border-b border-[var(--border-light)] grid grid-cols-3 gap-2 sm:gap-3">
            {metricCards.map((card) => (
              <MetricCard
                key={card.id}
                icon={card.icon}
                tone={card.tone}
                value={card.count}
                label={card.label}
                active={activeTab === card.id}
                onClick={() => selectTab(card.id)}
              />
            ))}
          </div>

          <div className="shrink-0 px-5 pt-2 pb-3 border-b border-[var(--border-light)]">
            <div className="h-1 rounded-full overflow-hidden bg-[var(--bg-secondary)]">
              <div className="h-full bg-blue-600 transition-[width] duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-[var(--text-secondary)]">
              <span>Progreso de sesion</span>
              <span>{processedXmlCount} de {gmailXmlTotalCount} procesados</span>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col md:flex-row">
            <aside className="w-full md:w-[290px] shrink-0 border-b md:border-b-0 md:border-r border-[var(--border-light)] p-3 flex flex-col gap-2 overflow-hidden">
              <div className="relative shrink-0">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar factura o proveedor..."
                  className="w-full h-9 pl-9 pr-3 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] text-xs text-[var(--text-primary)] outline-none focus:border-blue-500"
                />
              </div>

              <div className="min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-0.5">
                {filteredDrafts.length === 0 ? (
                  <p className="text-xs text-center text-[var(--text-muted)] py-8">Sin registros en esta seccion.</p>
                ) : (
                  groupedFilteredDrafts.map((group) => (
                    <div key={`${activeTab}-${group.label}`} className="flex flex-col gap-1.5">
                      <div className="sticky top-0 z-10 bg-[var(--bg-card)]/95 px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        {group.label}
                      </div>
                      {group.items.map(({ draft, index }) => {
                        const selected = isSelectedDraft(draft, index);
                        const isSaved = activeTab === "saved";
                        const isDiscarded = activeTab === "discarded";

                        return (
                          <button
                            type="button"
                            key={`${activeTab}-${draft.compra.claveAcceso}-${index}`}
                            onClick={() => selectDraft(draft, index)}
                            disabled={savingCompra && activeTab === "pending"}
                            className={`text-left rounded-md border px-3 py-2.5 transition-colors disabled:opacity-60 ${
                              selected
                                ? "border-blue-500 bg-blue-50/70"
                                : isSaved
                                  ? "border-emerald-200 bg-emerald-50/30 hover:border-emerald-300"
                                  : isDiscarded
                                    ? "border-[var(--border)] bg-slate-50/60 opacity-70 hover:opacity-100"
                                    : "border-[var(--border)] bg-[var(--bg-card)] hover:border-slate-400"
                            }`}
                          >
                            <p className="text-[11px] font-mono font-semibold text-blue-700 truncate">
                              {draft.compra.numeroFactura || "Factura sin numero"}
                            </p>
                            <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)] truncate">
                              {draft.compra.proveedorRazonSocial || "Proveedor sin nombre"}
                            </p>
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <span className="text-[10px] font-mono text-[var(--text-secondary)] truncate">{draft.compra.proveedorRuc || "RUC N/D"}</span>
                              <span className="text-xs font-mono font-semibold text-[var(--text-primary)]">{formatMoney(draft.compra.importeTotal)}</span>
                            </div>
                            {activeTab !== "pending" && (
                              <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold ${isSaved ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                                {isSaved ? "Guardado" : "Descartado"}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {activeTab === "pending" && pendingCompras.length > 0 && (
                <div className="shrink-0 pt-3 border-t border-[var(--border-light)] grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onConfirmAllPendingCompras}
                    className="h-9 px-3 rounded-md border border-blue-700 bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-blue-600 disabled:opacity-55"
                    disabled={savingCompra}
                  >
                    {savingCompra ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    Guardar todas
                  </button>
                  <button
                    type="button"
                    onClick={onCancelPendingCompra}
                    className="h-9 px-3 rounded-md border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-red-50 disabled:opacity-55"
                    disabled={savingCompra}
                  >
                    <X size={14} />
                    Descartar todas
                  </button>
                </div>
              )}
            </aside>

            <main className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6">
              {!detailCompra ? (
                <EmptyXmlState icon={<FileText size={36} />}>Selecciona una factura de la lista</EmptyXmlState>
              ) : (
                <div className="gmail-xml-detail-stack">
                  <div className="flex items-start justify-between gap-4 pb-1">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{detailCompra.proveedorRazonSocial}</h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-1.5 truncate">
                        {detailCompra.numeroFactura || "Factura sin numero"} - {detailCompra.proveedorRuc || "RUC N/D"}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col sm:flex-row items-end sm:items-center gap-2">
                      {isPendingDetail && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <button
                            type="button"
                            onClick={onDiscardActivePendingCompra}
                            className="h-9 px-4 rounded-md border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[var(--bg-secondary)] disabled:opacity-55"
                            disabled={savingCompra}
                          >
                            <X size={14} />
                            Descartar este
                          </button>
                          <button
                            type="button"
                            onClick={onConfirmPendingCompra}
                            className="h-9 px-4 rounded-md border border-blue-700 bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-blue-600 disabled:opacity-55"
                            disabled={savingCompra}
                          >
                            {savingCompra ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                            <span>Guardar</span>
                          </button>
                        </div>
                      )}
                      {isPendingDetail ? (
                        <button
                          type="button"
                          onClick={onTogglePendingPagoEstado}
                          disabled={savingCompra}
                          className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-55 ${
                            detailIsPaid ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}
                          title="Cambiar estado de pago"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${detailIsPaid ? "bg-emerald-600" : "bg-amber-600"}`} />
                          {detailIsPaid ? "Pagada" : "Pendiente"}
                        </button>
                      ) : (
                        <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold flex items-center gap-1.5 ${
                          detailIsPaid ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${detailIsPaid ? "bg-emerald-600" : "bg-amber-600"}`} />
                          {detailIsPaid ? "Pagada" : "Pendiente"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="gmail-xml-totals grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <TotalBox label="Total factura" value={formatMoney(detailCompra.importeTotal)} />
                    <TotalBox label="Monto pagado" value={formatMoney(detailTotalPagado)} tone="green" />
                    <TotalBox label="Saldo pendiente" value={formatMoney(detailSaldo)} tone="amber" />
                  </div>

                  {detailCompra.items.length > 0 && (
                    <section className="border border-[var(--border)] rounded-md overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setItemsExpanded((value) => !value)}
                        className="w-full px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] flex items-center justify-between"
                      >
                        <span className="flex items-center gap-1.5">
                          <List size={14} />
                          Detalle de items ({detailCompra.items.length})
                        </span>
                        {itemsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {itemsExpanded && (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-[var(--border)] text-[10px] uppercase text-[var(--text-secondary)]">
                                <th className="px-4 py-3 text-left font-semibold">Descripcion</th>
                                <th className="px-4 py-3 text-left font-semibold">Cant.</th>
                                <th className="px-4 py-3 text-right font-semibold">Precio</th>
                                <th className="px-4 py-3 text-right font-semibold">IVA</th>
                                <th className="px-4 py-3 text-right font-semibold">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailCompra.items.map((item, index) => (
                                <tr key={`${item.descripcion}-${index}`} className="border-b last:border-b-0 border-[var(--border-light)]">
                                  <td className="px-4 py-3 text-[var(--text-primary)] min-w-40">{item.descripcion}</td>
                                  <td className="px-4 py-3 text-[var(--text-secondary)]">{item.cantidad}</td>
                                  <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">{formatMoney(item.precioUnitario)}</td>
                                  <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">{formatMoney(item.impuesto)}</td>
                                  <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">{formatMoney(item.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  )}

                  {isPendingDetail ? (
                    <section className="border border-[var(--border)] rounded-md overflow-hidden">
                      <div className="px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center gap-2">
                        <DollarSign size={15} className="text-blue-600" />
                        <span className="text-xs font-semibold text-[var(--text-primary)]">Registro de abono inicial</span>
                      </div>
                      <div className="p-4 space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="form-group">
                            <label className="label">Monto a abonar</label>
                            <input
                              type="number"
                              className="input text-sm font-mono"
                              placeholder="0.00"
                              value={pagoMonto}
                              onChange={(event) => setPagoMonto(event.target.value)}
                              step="0.01"
                              max={detailCompra.importeTotal}
                              disabled={savingCompra}
                            />
                          </div>
                          <div className="form-group">
                            <label className="label">Metodo de pago</label>
                            <select
                              className="input text-sm"
                              value={pagoMetodo}
                              onChange={(event) => setPagoMetodo(event.target.value as CompraMetodoPago)}
                              disabled={savingCompra}
                            >
                              {COMPRA_METODOS_PAGO.map((metodo) => (
                                <option key={metodo.value} value={metodo.value}>
                                  {metodo.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {pagoMetodo === "transferencia" && (
                          <div className="form-group">
                            <label className="label">Banco destino</label>
                            <input
                              className="input text-sm"
                              list={`${BANCO_TRANSFERENCIA_LIST_ID}-compras-inicial`}
                              placeholder="Seleccione o escriba el banco"
                              value={pagoBanco}
                              onChange={(event) => setPagoBanco(event.target.value)}
                              disabled={savingCompra}
                            />
                            <datalist id={`${BANCO_TRANSFERENCIA_LIST_ID}-compras-inicial`}>
                              {BANCOS_TRANSFERENCIA.map((banco) => (
                                <option key={banco} value={banco} />
                              ))}
                            </datalist>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="form-group">
                            <label className="label">Referencia / Comprobante</label>
                            <input
                              className="input text-sm"
                              placeholder="Nro. transferencia, cheque..."
                              value={pagoReferencia}
                              onChange={(event) => setPagoReferencia(event.target.value)}
                              disabled={savingCompra}
                            />
                          </div>
                          <div className="form-group">
                            <label className="label">Notas internas</label>
                            <input
                              className="input text-sm"
                              placeholder="Detalle opcional..."
                              value={pagoNotas}
                              onChange={(event) => setPagoNotas(event.target.value)}
                              disabled={savingCompra}
                            />
                          </div>
                        </div>

                        <div className="rounded-md bg-blue-50 text-blue-700 px-3.5 py-3 text-[11px] flex items-center gap-2">
                          <Info size={13} className="shrink-0" />
                          <span>Se registrara abono por: <strong className="font-mono">{formatMoney(pendingInitialPagoPreview)}</strong></span>
                        </div>
                      </div>
                    </section>
                  ) : (
                    <p className="text-xs text-center text-[var(--text-muted)] py-6">
                      Factura {activeTab === "saved" ? "guardada" : "descartada"} en esta sesion.
                    </p>
                  )}
                </div>
              )}
            </main>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  tone,
  value,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  tone: "amber" | "green" | "gray";
  value: number;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const toneClass = {
    amber: "bg-amber-100 text-amber-800",
    green: "bg-emerald-100 text-emerald-800",
    gray: "bg-slate-100 text-slate-700",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-w-0 rounded-md border px-3 py-2.5 flex items-center gap-2.5 text-left transition-colors ${
        active
          ? "border-blue-500 bg-blue-50/80 shadow-sm"
          : "border-transparent bg-[var(--bg-secondary)] hover:border-[var(--border)] hover:bg-white"
      }`}
    >
      <div className={`w-8 h-8 rounded-md shrink-0 flex items-center justify-center ${toneClass}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-lg leading-none font-mono font-semibold text-[var(--text-primary)]">{value}</div>
        <div className="mt-1 text-[10px] uppercase tracking-wide text-[var(--text-secondary)] truncate">{label}</div>
      </div>
    </button>
  );
}

function TotalBox({ label, value, tone }: { label: string; value: string; tone?: "green" | "amber" }) {
  const valueClass = tone === "green" ? "text-emerald-700" : tone === "amber" ? "text-amber-800" : "text-[var(--text-primary)]";

  return (
    <div className="rounded-md bg-[var(--bg-secondary)] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">{label}</div>
      <div className={`mt-1 text-base font-mono font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}
