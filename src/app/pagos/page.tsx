"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { getOrdenes, getItemsOrden, getPagos, createPago, deletePago } from "@/lib/services";
import { OrdenTrabajo, ItemOrden, Pago, MetodoPago } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CreditCard, Plus, Trash2, Loader2, DollarSign, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";

interface OrdenConSaldo {
  orden: OrdenTrabajo;
  total: number;
  pagado: number;
  saldo: number;
  pagos: Pago[];
}

const METODOS: MetodoPago[] = ["efectivo", "transferencia", "tarjeta", "otro"];

export default function PagosPage() {
  const [data, setData] = useState<OrdenConSaldo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrdenConSaldo | null>(null);
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [referencia, setReferencia] = useState("");
  const [savingPago, setSavingPago] = useState(false);

  const load = async () => {
    setLoading(true);
    const ordenes = await getOrdenes();
    const result: OrdenConSaldo[] = [];
    for (const o of ordenes) {
      if (o.estado === "Entregado") continue;
      const items = await getItemsOrden(o.id!);
      const pagos = await getPagos(o.id!);
      const total = items.reduce((s, i) => s + i.subtotal, 0);
      const pagado = pagos.reduce((s, p) => s + p.monto, 0);
      result.push({ orden: o, total, pagado, saldo: total - pagado, pagos });
    }
    setData(result);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handlePago = async () => {
    if (!selected || !monto || isNaN(Number(monto)) || Number(monto) <= 0) {
      toast.error("Ingrese un monto válido");
      return;
    }
    setSavingPago(true);
    try {
      await createPago({
        ordenId: selected.orden.id!,
        monto: Number(monto),
        metodoPago: metodo,
        referencia,
      });
      toast.success("Pago registrado");
      setMonto("");
      setReferencia("");
      await load();
      // refresh selected
      const updated = data.find((d) => d.orden.id === selected.orden.id);
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

  const totalSaldo = data.reduce((s, d) => s + d.saldo, 0);
  const totalCobrado = data.reduce((s, d) => s + d.pagado, 0);

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
          { label: "Total Cobrado", value: `$${totalCobrado.toFixed(2)}`, icon: CheckCircle2, color: "#10b981", bg: "rgba(16,185,129,0.12)" },
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
            <div className="space-y-3">
              {data.map((d) => {
                const pct = d.total > 0 ? (d.pagado / d.total) * 100 : 0;
                const isSelected = selected?.orden.id === d.orden.id;
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
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-mono text-sm font-bold" style={{ color: "var(--accent-light)" }}>
                          #{String(d.orden.numero ?? 0).padStart(4, "0")}
                        </span>
                        <span className="text-sm ml-2" style={{ color: "var(--text-secondary)" }}>
                          {d.orden.cliente?.nombre} {d.orden.cliente?.apellido}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color: d.saldo > 0 ? "var(--warning)" : "var(--success)" }}>
                          ${d.saldo.toFixed(2)}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>de ${d.total.toFixed(2)}</p>
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
              })}
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
                    { label: "Total Orden", value: `$${selected.total.toFixed(2)}`, color: "var(--text-primary)" },
                    { label: "Pagado", value: `$${selected.pagado.toFixed(2)}`, color: "var(--success)" },
                    { label: "Saldo", value: `$${selected.saldo.toFixed(2)}`, color: selected.saldo > 0 ? "var(--warning)" : "var(--success)" },
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
                      {METODOS.map((m) => (
                        <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                      ))}
                    </select>
                  </div>
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
                            ${p.monto.toFixed(2)}
                          </p>
                          <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                            {p.metodoPago}
                            {p.referencia ? ` · ${p.referencia}` : ""}
                          </p>
                          {p.createdAt && (
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {format((p.createdAt as any).toDate(), "dd/MM/yyyy HH:mm")}
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
