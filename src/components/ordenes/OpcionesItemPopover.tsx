"use client";

import { useState } from "react";
import { ItemOrden } from "@/types";
import { Save, X } from "lucide-react";

interface OpcionesItemPopoverProps {
  item: ItemOrden;
  onClose: () => void;
  onUpdateFields: (updates: Partial<ItemOrden>) => Promise<void> | void;
  onLocalUpdate?: (updates: Partial<ItemOrden>) => void;
}

function hasChanges(a: ItemOrden, b: ItemOrden): boolean {
  return (
    a.tipo !== b.tipo ||
    a.impuestoAplicable !== b.impuestoAplicable ||
    (a.proveedorExterno || "") !== (b.proveedorExterno || "") ||
    Number(a.costoExterno || 0) !== Number(b.costoExterno || 0) ||
    !!a.pagadoExterno !== !!b.pagadoExterno ||
    (a.metodoPagoExterno || "") !== (b.metodoPagoExterno || "") ||
    (a.fechaPagoExterno || "") !== (b.fechaPagoExterno || "") ||
    (a.bancoExterno || "") !== (b.bancoExterno || "") ||
    (a.fechaAcreditacionExterno || "") !== (b.fechaAcreditacionExterno || "") ||
    (a.estadoAcreditacionExterno || "") !== (b.estadoAcreditacionExterno || "") ||
    (a.referenciaExterno || "") !== (b.referenciaExterno || "") ||
    (a.notasPagoExterno || "") !== (b.notasPagoExterno || "")
  );
}

export default function OpcionesItemPopover({
  item,
  onClose,
  onUpdateFields,
}: OpcionesItemPopoverProps) {
  const [draft, setDraft] = useState<ItemOrden>({ ...item });

  const updateDraft = (updates: Partial<ItemOrden>) => {
    setDraft((prev) => {
      const next = { ...prev, ...updates };
      // Cascading update validation rules
      if (updates.tipo === "externo" && !next.metodoPagoExterno && next.pagadoExterno) {
        next.metodoPagoExterno = "efectivo";
      }
      if (updates.pagadoExterno === true && !next.metodoPagoExterno) {
        next.metodoPagoExterno = "efectivo";
      }
      if (updates.metodoPagoExterno) {
        const isCard = updates.metodoPagoExterno === "tarjeta_credito" || updates.metodoPagoExterno === "tarjeta_debito";
        if (isCard) {
          next.bancoExterno = "Banco Guayaquil";
          next.estadoAcreditacionExterno = next.estadoAcreditacionExterno || "pendiente";
        }
      }
      return next;
    });
  };

  const changed = hasChanges(draft, item);

  return (
    <>
      <div className="fixed inset-0 z-[120]" onClick={onClose}></div>
      <div className="absolute right-10 top-0 z-[130] w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-4 text-left">
        
        {/* TIPO DE ITEM */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">TIPO DE ITEM</span>
            {changed && (
              <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Con cambios
              </span>
            )}
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
            {(["servicio", "producto", "externo"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`flex-1 text-center py-1 text-xs font-bold rounded-md transition-all capitalize border-0 cursor-pointer ${
                  (draft.tipo === t || (t === "servicio" && !draft.tipo))
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 bg-transparent hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                }`}
                onClick={() => {
                  updateDraft({ tipo: t });
                }}
              >
                {t === "externo" ? "Externo" : t === "servicio" ? "Servicio" : "Producto"}
              </button>
            ))}
          </div>
        </div>

        {/* Exento de Impuesto */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 mb-3">
          <div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Exento de impuesto</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">IVA 15%</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draft.impuestoAplicable === 0}
              onChange={(e) => {
                const isExent = e.target.checked;
                updateDraft({ impuestoAplicable: isExent ? 0 : 15 });
              }}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* % IVA */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 mb-3">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">% IVA</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              className="w-16 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-[var(--text-primary)]"
              value={draft.impuestoAplicable}
              disabled={draft.impuestoAplicable === 0}
              onChange={(e) => {
                const val = Number(e.target.value);
                updateDraft({ impuestoAplicable: val });
              }}
            />
            <span className="text-xs text-slate-500">%</span>
          </div>
        </div>

        {/* OPCIONES DE ITEM EXTERNO (CONDICIONAL) */}
        {draft.tipo === "externo" && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
            <div>
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">Taller / Proveedor Externo</label>
              <input
                type="text"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-[var(--text-primary)]"
                placeholder="Ej: Rectificadora Guayaquil"
                value={draft.proveedorExterno || ""}
                onChange={(e) => {
                  updateDraft({ proveedorExterno: e.target.value });
                }}
              />
            </div>
            
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">Costo ($)</label>
                <input
                  type="number"
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-[var(--text-primary)]"
                  placeholder="0.00"
                  value={draft.costoExterno || ""}
                  onChange={(e) => {
                    updateDraft({ costoExterno: Number(e.target.value) });
                  }}
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">Estado Pago</label>
                <select
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-[var(--text-primary)]"
                  value={draft.pagadoExterno ? "pagado" : "pendiente"}
                  onChange={(e) => {
                    const isPaid = e.target.value === "pagado";
                    updateDraft({ 
                      pagadoExterno: isPaid,
                      ...(isPaid && !draft.metodoPagoExterno ? { metodoPagoExterno: "efectivo" } : {})
                    });
                  }}
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="pagado">Pagado</option>
                </select>
              </div>
            </div>

            {draft.pagadoExterno && (
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">Método</label>
                    <select
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-[var(--text-primary)]"
                      value={draft.metodoPagoExterno || "efectivo"}
                      onChange={(e) => {
                        const val = e.target.value;
                        const isCard = val === "tarjeta_credito" || val === "tarjeta_debito";
                        updateDraft({ 
                          metodoPagoExterno: val,
                          ...(isCard ? { bancoExterno: "Banco Guayaquil", estadoAcreditacionExterno: "pendiente" } : {})
                        });
                      }}
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="tarjeta_credito">T. Crédito</option>
                      <option value="tarjeta_debito">T. Débito</option>
                    </select>
                  </div>
                  
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">Fecha Pago</label>
                    <input
                      type="date"
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-[var(--text-primary)]"
                      value={draft.fechaPagoExterno || new Date().toISOString().split("T")[0]}
                      onChange={(e) => {
                        updateDraft({ fechaPagoExterno: e.target.value });
                      }}
                    />
                  </div>
                </div>

                {draft.metodoPagoExterno === "transferencia" && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">Banco de Transferencia</label>
                    <select
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-[var(--text-primary)]"
                      value={draft.bancoExterno || ""}
                      onChange={(e) => {
                        updateDraft({ bancoExterno: e.target.value });
                      }}
                    >
                      <option value="">Seleccione banco...</option>
                      <option value="Banco Guayaquil">Banco Guayaquil</option>
                      <option value="Banco Pichincha">Banco Pichincha</option>
                      <option value="Cooperativa JEP">Cooperativa JEP</option>
                    </select>
                  </div>
                )}

                {(draft.metodoPagoExterno === "tarjeta_credito" || draft.metodoPagoExterno === "tarjeta_debito") && (
                  <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-100 dark:border-slate-800/80">
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Acreditación (Banco Guayaquil)</p>
                    
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-0.5">Fecha Acred.</label>
                        <input
                          type="date"
                          className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-[var(--text-primary)]"
                          value={draft.fechaAcreditacionExterno || ""}
                          onChange={(e) => {
                            updateDraft({ fechaAcreditacionExterno: e.target.value });
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-0.5">Estado Acred.</label>
                        <select
                          className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-[var(--text-primary)]"
                          value={draft.estadoAcreditacionExterno || "pendiente"}
                          onChange={(e) => {
                            updateDraft({ estadoAcreditacionExterno: e.target.value as "pendiente" | "acreditado" });
                          }}
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="acreditado">Acreditado</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">Referencia</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-[var(--text-primary)]"
                      placeholder="Ej: #1234"
                      value={draft.referenciaExterno || ""}
                      onChange={(e) => {
                        updateDraft({ referenciaExterno: e.target.value });
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">Notas Pago</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-[var(--text-primary)]"
                      placeholder="Ej: Pago directo"
                      value={draft.notasPagoExterno || ""}
                      onChange={(e) => {
                        updateDraft({ notasPagoExterno: e.target.value });
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BOTONES ACCION */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-2 mt-3 flex justify-end gap-2">
          {changed ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 bg-slate-150 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold border-none cursor-pointer flex items-center gap-1 transition-colors"
              >
                <X size={12} />
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const updates: Partial<ItemOrden> = {
                    tipo: draft.tipo,
                    impuestoAplicable: draft.impuestoAplicable,
                    proveedorExterno: draft.proveedorExterno || "",
                    costoExterno: draft.costoExterno || 0,
                    pagadoExterno: draft.pagadoExterno || false,
                    metodoPagoExterno: draft.metodoPagoExterno || "",
                    fechaPagoExterno: draft.fechaPagoExterno || "",
                    bancoExterno: draft.bancoExterno || "",
                    fechaAcreditacionExterno: draft.fechaAcreditacionExterno || "",
                    estadoAcreditacionExterno: draft.estadoAcreditacionExterno || undefined,
                    referenciaExterno: draft.referenciaExterno || "",
                    notasPagoExterno: draft.notasPagoExterno || "",
                  };
                  await onUpdateFields(updates);
                  onClose();
                }}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold border-none cursor-pointer flex items-center gap-1 transition-colors"
              >
                <Save size={12} />
                Guardar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold border-none cursor-pointer flex items-center gap-1 transition-colors"
            >
              <X size={12} />
              Cerrar
            </button>
          )}
        </div>
      </div>
    </>
  );
}
