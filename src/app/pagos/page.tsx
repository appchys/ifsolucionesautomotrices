"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  getOrdenes,
  getItemsOrden,
  getPagos,
  createPago,
  deletePago,
  getClienteById,
  getVehiculoById,
  getDevolucionesByOrden,
} from "@/lib/services";
import { OrdenTrabajo, Pago, MetodoPago } from "@/types";
import { format } from "date-fns";
import { CreditCard, Plus, Trash2, Loader2, DollarSign, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import { BANCOS_TRANSFERENCIA, BANCO_TRANSFERENCIA_LIST_ID } from "@/lib/paymentBanks";
import {
  calcularPagoConRecargo,
  getPagoMetodoLabel,
  getPagoMontoBase,
  getPagoRecargo,
  METODOS_PAGO_ORDEN,
} from "@/lib/orderPayments";

interface OrdenConSaldo {
  orden: OrdenTrabajo;
  total: number;
  totalBruto: number;
  devuelto: number;
  recargos: number;
  pagado: number;
  abonadoBase: number;
  cobradoNeto: number;
  saldo: number;
  saldoAFavor: number;
  pagos: Pago[];
}

const isPagada = (orden: OrdenConSaldo) => orden.saldo <= 0.01;

const getClienteLabel = (orden: OrdenTrabajo) => {
  const nombre = [orden.cliente?.nombre, orden.cliente?.apellido].filter(Boolean).join(" ");
  return nombre || "Cliente sin datos";
};

const getVehiculoLabel = (orden: OrdenTrabajo) => {
  const vehiculo = orden.vehiculo;
  if (!vehiculo) return "Vehículo sin datos";
  return [vehiculo.marca, vehiculo.modelo, vehiculo.anio, vehiculo.placa ? `· ${vehiculo.placa}` : ""]
    .filter(Boolean)
    .join(" ");
};

export default function PagosPage() {
  const [data, setData] = useState<OrdenConSaldo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrdenConSaldo | null>(null);
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [banco, setBanco] = useState("");
  const [referencia, setReferencia] = useState("");
  const [savingPago, setSavingPago] = useState(false);

  const load = async () => {
    setLoading(true);
    const ordenes = await getOrdenes();
    const result: OrdenConSaldo[] = [];
    for (const o of ordenes) {
      if (!o.id || o.estado === "Entregado") continue;
      const [items, pagos, cliente, vehiculo, devoluciones] = await Promise.all([
        getItemsOrden(o.id),
        getPagos(o.id),
        getClienteById(o.clienteId),
        getVehiculoById(o.vehiculoId),
        getDevolucionesByOrden(o.id),
      ]);
      const totalBruto = items.reduce((s, i) => s + i.subtotal, 0);
      const devuelto = devoluciones.reduce((s, devolucion) => s + devolucion.subtotalDevuelto, 0);
      const montoDevuelto = devoluciones.reduce((s, devolucion) => s + devolucion.montoDevuelto, 0);
      const total = Math.max(0, totalBruto - devuelto);
      const pagado = pagos.reduce((s, p) => s + p.monto, 0);
      const abonadoBase = pagos.reduce((s, p) => s + getPagoMontoBase(p), 0);
      const recargos = pagos.reduce((s, p) => s + getPagoRecargo(p), 0);
      const abonoBaseNeto = Math.max(0, abonadoBase - montoDevuelto);
      const cobradoNeto = Math.max(0, pagado - montoDevuelto);
      result.push({
        orden: { ...o, cliente: cliente ?? undefined, vehiculo: vehiculo ?? undefined },
        total,
        totalBruto,
        devuelto,
        recargos,
        pagado,
        abonadoBase,
        cobradoNeto,
        saldo: Math.max(0, total - abonoBaseNeto),
        saldoAFavor: Math.max(0, abonoBaseNeto - total),
        pagos,
      });
    }
    setData(result);
    setLoading(false);
    return result;
  };

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const handlePago = async () => {
    if (!selected || !monto || isNaN(Number(monto)) || Number(monto) <= 0) {
      toast.error("Ingrese un monto válido");
      return;
    }
    if (Number(monto) > selected.saldo + 0.01) {
      toast.error(`El monto no puede superar el saldo pendiente ($${selected.saldo.toFixed(2)})`);
      return;
    }
    const pagoCalculado = calcularPagoConRecargo(Number(monto), metodo);
    setSavingPago(true);
    try {
      await createPago({
        ordenId: selected.orden.id!,
        monto: pagoCalculado.montoCobrado,
        montoBase: pagoCalculado.montoBase,
        recargo: pagoCalculado.recargo,
        porcentajeRecargo: pagoCalculado.porcentajeRecargo,
        metodoPago: metodo,
        banco: metodo === "transferencia" ? banco.trim() || undefined : undefined,
        referencia,
      });
      toast.success("Pago registrado");
      setMonto("");
      setBanco("");
      setReferencia("");
      const updatedData = await load();
      // refresh selected with the newly loaded data
      const updated = updatedData.find((d) => d.orden.id === selected.orden.id);
      if (updated) setSelected(updated);
    } finally {
      setSavingPago(false);
    }
  };

  const handleDeletePago = async (pagoId: string) => {
    if (!confirm("¿Eliminar este pago?")) return;
    await deletePago(pagoId);
    toast.success("Pago eliminado");
    load();
  };

  const pendientes = data.filter((d) => !isPagada(d));
  const pagadas = data.filter(isPagada);
  const totalSaldo = pendientes.reduce((s, d) => s + Math.max(d.saldo, 0), 0);
  const totalCobrado = data.reduce((s, d) => s + d.cobradoNeto, 0);
  const pagoPreview = calcularPagoConRecargo(Number(monto || 0), metodo);

  const renderOrdenCard = (d: OrdenConSaldo) => {
    const pct = d.total > 0 ? Math.min(((d.total - d.saldo) / d.total) * 100, 100) : 0;
    const isSelected = selected?.orden.id === d.orden.id;
    const pagada = isPagada(d);
    return (
      <div
        key={d.orden.id}
        className="p-4 rounded-xl cursor-pointer transition-all"
        style={{
          background: isSelected ? "rgba(37,99,235,0.08)" : "var(--bg-secondary)",
          border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
        }}
        onClick={() => setSelected(d)}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-sm font-bold" style={{ color: "var(--accent-light)" }}>
                #{String(d.orden.numero ?? 0).padStart(4, "0")}
              </span>
              <span className={`badge ${pagada ? "badge-green" : "badge-yellow"}`}>
                {pagada ? "Pagada" : "Pago pendiente"}
              </span>
            </div>
            <p className="text-sm mt-2 font-medium" style={{ color: "var(--text-primary)" }}>
              {getClienteLabel(d.orden)}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {getVehiculoLabel(d.orden)}
            </p>
            {(d.orden.cliente?.telefono || d.orden.cliente?.identificacion) && (
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {[d.orden.cliente?.telefono, d.orden.cliente?.identificacion].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold" style={{ color: pagada ? "var(--success)" : "var(--warning)" }}>
              ${(d.saldoAFavor > 0.01 ? d.saldoAFavor : Math.max(d.saldo, 0)).toFixed(2)}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {d.saldoAFavor > 0.01 ? "a favor" : `de $${d.total.toFixed(2)}`}
            </p>
          </div>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {Math.round(pct)}% pagado
        </p>
      </div>
    );
  };

  return (
    <AppShell>
      <div className="page-header">
        <h1 className="page-title">Cobros y Pagos</h1>
        <p className="page-subtitle">Gestión de abonos y saldos pendientes</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { label: "Órdenes Activas", value: data.length, icon: Clock, color: "#2563eb", bg: "rgba(37,99,235,0.12)" },
          { label: "Cobro Neto", value: `$${totalCobrado.toFixed(2)}`, icon: CheckCircle2, color: "#10b981", bg: "rgba(16,185,129,0.12)" },
          { label: "Saldo Pendiente", value: `$${totalSaldo.toFixed(2)}`, icon: AlertCircle, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg }}>
              <s.icon size={22} style={{ color: s.color }} />
            </div>
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Ordenes con saldo */}
        <div className="card">
          <h2 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
            Órdenes Pendientes
          </h2>
          {loading ? (
            <div className="flex justify-center py-8"><div className="spinner" /></div>
          ) : data.length === 0 ? (
            <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
              <CheckCircle2 size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin saldos pendientes</p>
            </div>
          ) : (
            <div className="space-y-6">
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Pagos pendientes
                  </h3>
                  <span className="badge badge-yellow">{pendientes.length}</span>
                </div>
                {pendientes.length === 0 ? (
                  <p className="text-sm rounded-lg p-3" style={{ color: "var(--text-muted)", background: "var(--bg-secondary)" }}>
                    No hay órdenes con saldo pendiente.
                  </p>
                ) : (
                  <div className="space-y-3">{pendientes.map(renderOrdenCard)}</div>
                )}
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Pagadas
                  </h3>
                  <span className="badge badge-green">{pagadas.length}</span>
                </div>
                {pagadas.length === 0 ? (
                  <p className="text-sm rounded-lg p-3" style={{ color: "var(--text-muted)", background: "var(--bg-secondary)" }}>
                    Aún no hay órdenes totalmente pagadas.
                  </p>
                ) : (
                  <div className="space-y-3">{pagadas.map(renderOrdenCard)}</div>
                )}
              </section>
            </div>
          )}
        </div>

        {/* Panel de pago */}
        <div>
          {selected ? (
            <div className="space-y-4">
              <div className="card">
                <h3 className="font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                  Registrar Abono — #{String(selected.orden.numero ?? 0).padStart(4, "0")}
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: "Venta Bruta", value: `$${selected.totalBruto.toFixed(2)}`, color: "var(--text-primary)" },
                    { label: "Devuelto", value: `-$${selected.devuelto.toFixed(2)}`, color: "var(--danger)" },
                    { label: "Venta Neta", value: `$${selected.total.toFixed(2)}`, color: "var(--text-primary)" },
                    { label: "Abonado", value: `$${selected.abonadoBase.toFixed(2)}`, color: "var(--success)" },
                    { label: "Recargos", value: `$${selected.recargos.toFixed(2)}`, color: "var(--accent)" },
                    { label: selected.saldoAFavor > 0.01 ? "A Favor" : "Saldo", value: `$${(selected.saldoAFavor > 0.01 ? selected.saldoAFavor : selected.saldo).toFixed(2)}`, color: selected.saldo > 0 ? "var(--warning)" : "var(--success)" },
                    { label: "Estado", value: selected.saldo <= 0 ? "Pagado" : "Pendiente", color: selected.saldo <= 0 ? "var(--success)" : "var(--warning)" },
                  ].map((s) => (
                    <div key={s.label} className="p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                      <p className="font-bold" style={{ color: s.color }}>{s.value}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="form-group">
                    <label className="label">Monto del abono</label>
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                      <input
                        type="number"
                        className="input pl-8"
                        placeholder="0.00"
                        value={monto}
                        onChange={(e) => setMonto(e.target.value)}
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="label">Método de pago</label>
                    <select className="input" value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
                      {METODOS_PAGO_ORDEN.map((m) => (
                        <option key={m} value={m}>{getPagoMetodoLabel(m)}</option>
                      ))}
                    </select>
                  </div>
                  {pagoPreview.recargo > 0 && (
                    <div className="rounded-lg p-3 text-sm" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                      <div className="flex items-center justify-between">
                        <span style={{ color: "var(--text-secondary)" }}>Recargo tarjeta ({pagoPreview.porcentajeRecargo}%)</span>
                        <strong>${pagoPreview.recargo.toFixed(2)}</strong>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span style={{ color: "var(--text-secondary)" }}>Total a cobrar</span>
                        <strong style={{ color: "var(--success)" }}>${pagoPreview.montoCobrado.toFixed(2)}</strong>
                      </div>
                    </div>
                  )}
                  {metodo === "transferencia" && (
                    <div className="form-group">
                      <label className="label">Banco</label>
                      <input
                        className="input"
                        list={BANCO_TRANSFERENCIA_LIST_ID}
                        placeholder="Selecciona o escribe el banco"
                        value={banco}
                        onChange={(e) => setBanco(e.target.value)}
                      />
                      <datalist id={BANCO_TRANSFERENCIA_LIST_ID}>
                        {BANCOS_TRANSFERENCIA.map((b) => (
                          <option key={b} value={b} />
                        ))}
                      </datalist>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="label">Referencia (opcional)</label>
                    <input
                      className="input"
                      placeholder="# transferencia, comprobante..."
                      value={referencia}
                      onChange={(e) => setReferencia(e.target.value)}
                    />
                  </div>
                  <button onClick={handlePago} disabled={savingPago} className="btn-primary w-full justify-center">
                    {savingPago ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                    Registrar Pago
                  </button>
                </div>
              </div>

              {/* Historial */}
              <div className="card">
                <h3 className="font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                  Historial de Pagos
                </h3>
                {selected.pagos.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>
                    Sin pagos registrados
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selected.pagos.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 rounded-lg"
                        style={{ background: "var(--bg-secondary)" }}
                      >
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--success)" }}>
                            ${getPagoMontoBase(p).toFixed(2)}
                          </p>
                          <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                            {getPagoMetodoLabel(p.metodoPago)}
                            {p.banco ? ` · ${p.banco}` : ""}
                            {p.referencia ? ` · ${p.referencia}` : ""}
                          </p>
                          {getPagoRecargo(p) > 0 && (
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                              Recargo: ${getPagoRecargo(p).toFixed(2)} - Cobrado: ${p.monto.toFixed(2)}
                            </p>
                          )}
                          {p.createdAt && (
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {format(p.createdAt.toDate(), "dd/MM/yyyy HH:mm")}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeletePago(p.id!)}
                          className="btn-ghost btn-icon"
                          style={{ color: "var(--danger)" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center py-16" style={{ color: "var(--text-muted)" }}>
              <CreditCard size={48} className="mb-3 opacity-20" />
              <p className="text-sm">Selecciona una orden para gestionar pagos</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
