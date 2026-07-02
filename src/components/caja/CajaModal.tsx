"use client";
import { useState, useMemo } from "react";
import {
  X, Plus, Minus, Printer, Settings, Lock, TrendingUp, TrendingDown,
  Search, DollarSign, ArrowUpRight, ArrowDownRight, Clock, Banknote,
  CreditCard, Building2, AlertCircle, Trash2,
} from "lucide-react";
import { useCajaStore, useAuthStore } from "@/store";
import { abrirCaja, calcularResumenCaja, deleteMovimientoManual, getFechaHoyEcuador } from "@/lib/services";
import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { METODO_PAGO_LABELS } from "@/lib/orderPayments";
import { toast } from "react-hot-toast";
import ModalMovimiento from "./ModalMovimiento";
import ModalCorteParcial from "./ModalCorteParcial";
import ModalCerrarCaja from "./ModalCerrarCaja";
import type { MovimientoCajaUnificado } from "@/types";

type FiltroMovimiento = "todos" | "ingresos" | "egresos" | "efectivo" | "transferencias";

const METODO_COLORES: Record<string, string> = {
  efectivo: "#10b981",
  transferencia: "#3b82f6",
  tarjeta_credito: "#f59e0b",
  tarjeta_debito: "#8b5cf6",
  tarjeta: "#8b5cf6",
  otro: "#94a3b8",
};

const FUENTE_LABELS: Record<string, string> = {
  cobro_orden: "Cobro OT",
  cobro_venta: "Venta",
  pago_proveedor: "Proveedor",
  manual: "Manual",
};

function money(v: number) {
  return `$${Number(v || 0).toFixed(2)}`;
}

function FuenteBadge({ fuente }: { fuente: MovimientoCajaUnificado["fuente"] }) {
  const colors: Record<string, { bg: string; text: string }> = {
    cobro_orden: { bg: "#3b82f620", text: "#3b82f6" },
    cobro_venta: { bg: "#10b98120", text: "#10b981" },
    pago_proveedor: { bg: "#f59e0b20", text: "#f59e0b" },
    manual: { bg: "#94a3b820", text: "#64748b" },
  };
  const c = colors[fuente] ?? { bg: "#94a3b820", text: "#64748b" };
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
      style={{ background: c.bg, color: c.text }}
    >
      {FUENTE_LABELS[fuente] ?? fuente}
    </span>
  );
}

export default function CajaModal() {
  const { caja, movimientosUnificados, isCajaModalOpen, closeCajaModal } = useCajaStore();
  const { user } = useAuthStore();

  const [montoApertura, setMontoApertura] = useState("");
  const [abriendo, setAbriendo] = useState(false);
  const [filtro, setFiltro] = useState<FiltroMovimiento>("todos");
  const [search, setSearch] = useState("");
  const [modalTipo, setModalTipo] = useState<"ingreso" | "egreso" | null>(null);
  const [showCorte, setShowCorte] = useState(false);
  const [showCerrar, setShowCerrar] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Todos los hooks deben ir antes de cualquier return condicional
  const resumen = useMemo(
    () => calcularResumenCaja(caja?.montoApertura ?? 0, movimientosUnificados),
    [caja?.montoApertura, movimientosUnificados]
  );

  const totalIngresosDesglose = useMemo(
    () => Object.values(resumen.desglosePorMetodo).reduce((s, v) => s + v.ingresos, 0),
    [resumen.desglosePorMetodo]
  );

  const movimientosFiltrados = useMemo(() => {
    let lista = movimientosUnificados;
    if (filtro === "ingresos") lista = lista.filter((m) => m.tipo === "ingreso");
    else if (filtro === "egresos") lista = lista.filter((m) => m.tipo === "egreso");
    else if (filtro === "efectivo") lista = lista.filter((m) => m.metodoPago === "efectivo");
    else if (filtro === "transferencias") lista = lista.filter((m) => m.metodoPago === "transferencia");

    if (search.trim()) {
      const q = search.toLowerCase();
      lista = lista.filter(
        (m) =>
          m.concepto.toLowerCase().includes(q) ||
          m.categoria.toLowerCase().includes(q) ||
          m.usuario.toLowerCase().includes(q) ||
          (m.referencia ?? "").toLowerCase().includes(q)
      );
    }
    return lista;
  }, [movimientosUnificados, filtro, search]);

  if (!isCajaModalOpen) return null;


  const handleAbrirCaja = async () => {
    if (!user) return;
    const monto = parseFloat(montoApertura.replace(",", ".")) || 0;
    if (monto < 0) return toast.error("El monto no puede ser negativo");
    setAbriendo(true);
    try {
      await abrirCaja(monto, { uid: user.uid, displayName: user.displayName });
      toast.success("Caja abierta");
      setMontoApertura("");
    } catch (err) {
      console.error(err);
      toast.error("Error al abrir la caja");
    } finally {
      setAbriendo(false);
    }
  };

  const handleDeleteMovimiento = async (m: MovimientoCajaUnificado) => {
    if (m.fuente !== "manual") return;
    if (!caja?.id) return;
    setDeletingId(m.id);
    try {
      await deleteMovimientoManual(caja.id, m.id);
      toast.success("Movimiento eliminado");
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  const aperturaDt = caja?.aperturaAt ? (caja.aperturaAt as Timestamp).toDate() : null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[150] bg-black/50"
        style={{ backdropFilter: "blur(4px)" }}
        onClick={closeCajaModal}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full z-[160] flex flex-col"
        style={{
          width: "min(680px, 100vw)",
          background: "var(--bg-primary)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.15)",
        }}
      >
        {/* Header del panel */}
        <div
          className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
          style={{
            background: "var(--bg-card)",
            borderBottom: "1px solid var(--border)",
            height: "56px",
          }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--accent)22" }}
          >
            <DollarSign size={16} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none" style={{ color: "var(--text-primary)" }}>
              Caja del día
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {getFechaHoyEcuador()}
            </p>
          </div>
          <button onClick={closeCajaModal} className="ml-auto btn-ghost btn-icon">
            <X size={18} />
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto">
          {!caja ? (
            /* ─── CAJA CERRADA ─── */
            <div className="flex flex-col items-center justify-center h-full gap-6 px-8 py-12">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <Lock size={28} style={{ color: "var(--text-muted)" }} />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                  Caja cerrada
                </h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No hay ninguna sesión de caja abierta hoy. Ingresa el monto inicial para comenzar.
                </p>
              </div>
              <div className="w-full max-w-xs flex flex-col gap-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
                    Efectivo inicial en caja
                  </label>
                  <input
                    className="input w-full text-center text-xl font-bold"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="$0.00"
                    value={montoApertura}
                    onChange={(e) => setMontoApertura(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAbrirCaja()}
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleAbrirCaja}
                  disabled={abriendo}
                  className="btn w-full font-semibold"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  {abriendo ? "Abriendo..." : "Abrir caja"}
                </button>
              </div>
            </div>
          ) : (
            /* ─── CAJA ABIERTA ─── */
            <div className="flex flex-col gap-0">
              {/* Tarjeta principal */}
              <div
                className="mx-4 mt-4 rounded-2xl p-4"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow)",
                }}
              >
                {/* Efectivo en caja + info */}
                <div
                  className="rounded-xl px-4 py-3 mb-3"
                  style={{
                    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  }}
                >
                  <p className="text-xs font-medium text-blue-200 mb-0.5">Efectivo en caja</p>
                  <p className="text-3xl font-extrabold text-white leading-none">
                    {money(resumen.efectivoEnCaja)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock size={12} className="text-blue-200" />
                    <p className="text-xs text-blue-200">
                      Abierta desde{" "}
                      {aperturaDt
                        ? format(aperturaDt, "HH:mm", { locale: es })
                        : "--"}
                      {" · "}
                      {caja.abiertaPor.displayName}
                    </p>
                    <span className="ml-auto w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80]" />
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setModalTipo("ingreso")}
                    className="btn text-xs flex items-center gap-1.5 flex-1"
                    style={{ background: "#10b98118", color: "#10b981", border: "1px solid #10b98140" }}
                  >
                    <Plus size={13} />
                    Registrar ingreso
                  </button>
                  <button
                    onClick={() => setModalTipo("egreso")}
                    className="btn text-xs flex items-center gap-1.5 flex-1"
                    style={{ background: "#ef444418", color: "#ef4444", border: "1px solid #ef444440" }}
                  >
                    <Minus size={13} />
                    Registrar egreso
                  </button>
                  <button
                    onClick={() => setShowCorte(true)}
                    className="btn btn-secondary text-xs flex items-center gap-1.5"
                  >
                    <Printer size={13} />
                    Corte parcial
                  </button>
                  <button
                    onClick={() => setShowCerrar(true)}
                    className="btn btn-secondary text-xs flex items-center gap-1.5"
                    style={{ color: "#ef4444" }}
                  >
                    <Lock size={13} />
                    Cerrar caja
                  </button>
                </div>
              </div>

              {/* Tarjetas resumen */}
              <div className="grid grid-cols-4 gap-2 mx-4 mt-3">
                {[
                  { label: "APERTURA", value: money(caja.montoApertura), color: "var(--text-primary)", icon: <Banknote size={14} /> },
                  { label: "INGRESOS", value: money(resumen.totalIngresos), color: "#10b981", icon: <TrendingUp size={14} /> },
                  { label: "EGRESOS", value: money(resumen.totalEgresos), color: "#ef4444", icon: <TrendingDown size={14} /> },
                  { label: "SALDO ESP.", value: money(resumen.saldoEsperado), color: "var(--accent)", icon: <DollarSign size={14} /> },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl p-3"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center gap-1 mb-1" style={{ color: "var(--text-muted)" }}>
                      {item.icon}
                      <span className="text-[9px] font-bold tracking-wide">{item.label}</span>
                    </div>
                    <p className="text-sm font-bold leading-none" style={{ color: item.color }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Barra de desglose por método */}
              {totalIngresosDesglose > 0 && (
                <div className="mx-4 mt-3 rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="flex h-2">
                    {Object.entries(resumen.desglosePorMetodo)
                      .filter(([, v]) => v.ingresos > 0)
                      .map(([metodo, vals]) => (
                        <div
                          key={metodo}
                          style={{
                            width: `${(vals.ingresos / totalIngresosDesglose) * 100}%`,
                            background: METODO_COLORES[metodo] ?? "#94a3b8",
                            transition: "width 0.3s ease",
                          }}
                        />
                      ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2">
                    {Object.entries(resumen.desglosePorMetodo)
                      .filter(([, v]) => v.ingresos > 0 || v.egresos > 0)
                      .map(([metodo, vals]) => (
                        <div key={metodo} className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: METODO_COLORES[metodo] ?? "#94a3b8" }}
                          />
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {(METODO_PAGO_LABELS as Record<string, string>)[metodo] ?? metodo}
                          </span>
                          {vals.ingresos > 0 && (
                            <span className="text-[11px] font-semibold" style={{ color: "#10b981" }}>
                              {money(vals.ingresos)}
                            </span>
                          )}
                          {vals.egresos > 0 && (
                            <span className="text-[11px] font-semibold" style={{ color: "#ef4444" }}>
                              -{money(vals.egresos)}
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Movimientos */}
              <div className="mx-4 mt-3 mb-4">
                {/* Header movimientos */}
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      Movimientos
                    </span>
                    <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>
                      {movimientosFiltrados.length} registros
                    </span>
                  </div>
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                    <input
                      type="text"
                      placeholder="Buscar..."
                      className="input pl-8 text-xs h-8"
                      style={{ width: "160px" }}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Filtros */}
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {(["todos", "ingresos", "egresos", "efectivo", "transferencias"] as FiltroMovimiento[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFiltro(f)}
                      className="text-xs px-3 py-1 rounded-full font-medium transition-all"
                      style={{
                        background: filtro === f ? "var(--accent)" : "var(--bg-card)",
                        color: filtro === f ? "#fff" : "var(--text-secondary)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Tabla */}
                {movimientosFiltrados.length === 0 ? (
                  <div
                    className="rounded-xl py-10 flex flex-col items-center gap-2"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                  >
                    <DollarSign size={24} style={{ color: "var(--text-muted)" }} />
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sin movimientos</p>
                  </div>
                ) : (
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                  >
                    <div
                      className="grid text-[10px] font-bold tracking-wide px-3 py-2"
                      style={{
                        color: "var(--text-muted)",
                        borderBottom: "1px solid var(--border)",
                        gridTemplateColumns: "50px 1fr 90px 80px 70px 30px",
                      }}
                    >
                      <span>HORA</span>
                      <span>CONCEPTO</span>
                      <span>CATEGORÍA</span>
                      <span>MÉTODO</span>
                      <span className="text-right">MONTO</span>
                      <span></span>
                    </div>

                    <div className="divide-y divide-[var(--border)]">
                      {movimientosFiltrados.map((m) => (
                        <div
                          key={m.id}
                          className="grid items-center px-3 py-2.5 hover:bg-[var(--bg-hover)] transition-colors group"
                          style={{ gridTemplateColumns: "50px 1fr 90px 80px 70px 30px" }}
                        >
                          {/* Hora */}
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {format(m.hora, "HH:mm")}
                          </span>

                          {/* Concepto */}
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              {m.tipo === "ingreso" ? (
                                <ArrowUpRight size={12} style={{ color: "#10b981", flexShrink: 0 }} />
                              ) : (
                                <ArrowDownRight size={12} style={{ color: "#ef4444", flexShrink: 0 }} />
                              )}
                              <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                                {m.concepto}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <FuenteBadge fuente={m.fuente} />
                              {m.pendienteAcreditacion && (
                                <span className="flex items-center gap-0.5 text-[9px] font-semibold" style={{ color: "#f59e0b" }}>
                                  <AlertCircle size={9} />
                                  Pend.
                                </span>
                              )}
                              <span className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                                {m.usuario}
                              </span>
                            </div>
                          </div>

                          {/* Categoría */}
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-md truncate"
                            style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}
                          >
                            {m.categoria}
                          </span>

                          {/* Método */}
                          <div className="flex items-center gap-1">
                            <div
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: METODO_COLORES[m.metodoPago] ?? "#94a3b8" }}
                            />
                            <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                              {(METODO_PAGO_LABELS as Record<string, string>)[m.metodoPago] ?? m.metodoPago}
                            </span>
                          </div>

                          {/* Monto */}
                          <span
                            className="text-sm font-bold text-right"
                            style={{ color: m.tipo === "ingreso" ? "#10b981" : "#ef4444" }}
                          >
                            {m.tipo === "ingreso" ? "+" : "-"}{money(m.monto)}
                          </span>

                          {/* Eliminar (solo manuales) */}
                          <div className="flex justify-end">
                            {m.fuente === "manual" && (
                              <button
                                className="opacity-0 group-hover:opacity-100 btn-ghost btn-icon transition-opacity"
                                style={{ width: 24, height: 24 }}
                                onClick={() => handleDeleteMovimiento(m)}
                                disabled={deletingId === m.id}
                                title="Eliminar"
                              >
                                <Trash2 size={12} style={{ color: "#ef4444" }} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modales secundarios */}
      {modalTipo && (
        <ModalMovimiento tipo={modalTipo} onClose={() => setModalTipo(null)} />
      )}
      {showCorte && <ModalCorteParcial onClose={() => setShowCorte(false)} />}
      {showCerrar && <ModalCerrarCaja onClose={() => setShowCerrar(false)} />}
    </>
  );
}
