"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  ShoppingCart,
  X,
  Plus,
  Search,
  Trash2,
  DollarSign,
  Package,
  Check,
  Building,
  FileText,
  Loader2,
  Calendar,
  CreditCard,
  AlertCircle,
  Percent,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { getProductos, createCompraConInventario } from "@/lib/services";
import { BANCOS_TRANSFERENCIA, BANCO_TRANSFERENCIA_LIST_ID } from "@/lib/paymentBanks";
import type { Compra, CompraItem, CompraPago, CompraMetodoPago, EstadoPago, Producto } from "@/types";

interface NuevaCompraManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompraCreada: (nuevaCompra: Compra) => void;
}

interface ItemFormState {
  productoId?: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  aplicaIva: boolean;
}

export default function NuevaCompraManualModal({
  isOpen,
  onClose,
  onCompraCreada,
}: NuevaCompraManualModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Catálogo de productos
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [searchCatalog, setSearchCatalog] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Formulario General
  const [proveedorRazonSocial, setProveedorRazonSocial] = useState("");
  const [proveedorRuc, setProveedorRuc] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [fechaEmision, setFechaEmision] = useState(() => new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  // Ítems de la compra
  const [items, setItems] = useState<ItemFormState[]>([]);

  // Pago Inicial
  const [registrarPago, setRegistrarPago] = useState(true);
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoMetodo, setPagoMetodo] = useState<CompraMetodoPago>("efectivo");
  const [pagoBanco, setPagoBanco] = useState("");
  const [pagoReferencia, setPagoReferencia] = useState("");
  const [pagoNotas, setPagoNotas] = useState("");

  // Cargar catálogo de productos al abrir el modal
  useEffect(() => {
    if (isOpen) {
      setLoadingProductos(true);
      getProductos()
        .then((list) => setProductos(list))
        .catch((err) => {
          console.error("Error al cargar productos:", err);
          toast.error("No se pudo cargar el catálogo de productos");
        })
        .finally(() => setLoadingProductos(false));
    }
  }, [isOpen]);

  // Cerrar al clicar fuera
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (backdropRef.current && e.target === backdropRef.current) {
      onClose();
    }
  };

  if (!mounted || !isOpen) return null;

  // Filtrar catálogo por búsqueda
  const productosFiltrados = searchCatalog.trim()
    ? productos.filter(
        (p) =>
          p.nombre.toLowerCase().includes(searchCatalog.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchCatalog.toLowerCase())
      )
    : productos.slice(0, 10);

  // Agregar producto desde el catálogo
  const handleSelectProducto = (p: Producto) => {
    // Verificar si ya está en los ítems
    const idx = items.findIndex((it) => it.productoId === p.id || it.codigo === p.sku);
    if (idx !== -1) {
      const newItems = [...items];
      newItems[idx].cantidad += 1;
      setItems(newItems);
      toast.success(`Incrementada cantidad de "${p.nombre}"`);
    } else {
      const nuevoItem: ItemFormState = {
        productoId: p.id,
        codigo: p.sku || "PROD",
        descripcion: p.nombre,
        cantidad: 1,
        precioUnitario: p.costoBase || p.precioBase || 0,
        aplicaIva: p.aplicaIva ?? true,
      };
      setItems((prev) => [...prev, nuevoItem]);
    }
    setSearchCatalog("");
    setIsSearchOpen(false);
  };

  // Agregar ítem manual (no existente en catálogo)
  const handleAddManualItem = () => {
    const itemManual: ItemFormState = {
      codigo: `ITEM-${Date.now().toString().slice(-4)}`,
      descripcion: "Nuevo ítem manual",
      cantidad: 1,
      precioUnitario: 0,
      aplicaIva: true,
    };
    setItems((prev) => [...prev, itemManual]);
  };

  // Actualizar campo de un ítem
  const handleUpdateItem = (index: number, field: keyof ItemFormState, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  // Eliminar ítem
  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Cálculos de Totales
  const totalSinImpuestos = items.reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0);
  const totalIva = items.reduce(
    (acc, it) => acc + (it.aplicaIva ? it.cantidad * it.precioUnitario * 0.15 : 0),
    0
  );
  const importeTotal = totalSinImpuestos + totalIva;

  // Actualizar monto inicial de pago si no ha sido editado manualmente por el usuario
  const montoActualPago = pagoMonto ? Number(pagoMonto) : importeTotal;

  // Enviar formulario y guardar compra
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      toast.error("Debe agregar al menos un producto a la compra");
      return;
    }

    const itemsInvalidos = items.filter((it) => !it.descripcion.trim() || it.cantidad <= 0);
    if (itemsInvalidos.length > 0) {
      toast.error("Todos los productos deben tener descripción y cantidad mayor a 0");
      return;
    }

    setSaving(true);
    const toastId = toast.loading("Registrando compra e incrementando inventario...");

    try {
      // Formatear items para el esquema de CompraItem
      const itemsProcesados: CompraItem[] = items.map((it) => {
        const subtotalSinImpuesto = Number((it.cantidad * it.precioUnitario).toFixed(2));
        const impuesto = Number((it.aplicaIva ? subtotalSinImpuesto * 0.15 : 0).toFixed(2));
        const total = Number((subtotalSinImpuesto + impuesto).toFixed(2));

        return {
          codigo: it.codigo.trim() || "SKU-MANUAL",
          descripcion: it.descripcion.trim(),
          cantidad: Number(it.cantidad),
          precioUnitario: Number(it.precioUnitario),
          descuento: 0,
          subtotalSinImpuesto,
          impuesto,
          tarifaIva: it.aplicaIva ? 15 : 0,
          baseImponibleIva: it.aplicaIva ? subtotalSinImpuesto : 0,
          total,
        };
      });

      // Procesar pago inicial si está activo
      const pagosIniciales: CompraPago[] = [];
      let totalPagado = 0;

      if (registrarPago && montoActualPago > 0) {
        const montoValidado = Number(Math.min(montoActualPago, importeTotal).toFixed(2));
        pagosIniciales.push({
          monto: montoValidado,
          metodoPago: pagoMetodo,
          banco: pagoMetodo === "transferencia" && pagoBanco.trim() ? pagoBanco.trim() : undefined,
          referencia: pagoReferencia.trim() || undefined,
          notas: pagoNotas.trim() || undefined,
          fecha: new Date().toISOString(),
        });
        totalPagado = montoValidado;
      }

      const saldoProveedor = Number(Math.max(importeTotal - totalPagado, 0).toFixed(2));
      let estadoPago: EstadoPago = "pendiente";
      if (saldoProveedor <= 0.01) {
        estadoPago = "pagado";
      } else if (totalPagado > 0) {
        estadoPago = "parcial";
      }

      const razonSocialFinal = proveedorRazonSocial.trim() || "PROVEEDOR LOCAL / MANUAL";
      const rucFinal = proveedorRuc.trim() || "9999999999999";

      // Formatear o autogenerar número de factura
      let factNum = numeroFactura.trim();
      if (!factNum) {
        const fechaCompacta = fechaEmision.replace(/-/g, "");
        const randomSec = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
        factNum = `MANUAL-${fechaCompacta}-${randomSec}`;
      }

      const nuevaCompraData: Omit<Compra, "id"> = {
        estadoAutorizacion: "MANUAL",
        numeroAutorizacion: "MAN-AUTH-" + Date.now(),
        fechaAutorizacion: new Date().toISOString(),
        proveedorRazonSocial: razonSocialFinal,
        proveedorRuc: rucFinal,
        claveAcceso: `MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        establecimiento: "001",
        puntoEmision: "001",
        secuencial: String(Math.floor(Math.random() * 1000000)).padStart(9, "0"),
        numeroFactura: factNum,
        fechaEmision: fechaEmision || new Date().toISOString().split("T")[0],
        compradorRazonSocial: "I.F. SOLUCIONES AUTOMOTRICES",
        compradorIdentificacion: "0927405092001",
        totalSinImpuestos: Number(totalSinImpuestos.toFixed(2)),
        totalDescuento: 0,
        importeTotal: Number(importeTotal.toFixed(2)),
        moneda: "USD",
        items: itemsProcesados,
        pagosProveedor: pagosIniciales,
        totalPagadoProveedor: Number(totalPagado.toFixed(2)),
        totalDevueltoProveedor: 0,
        saldoProveedor,
        estadoPagoProveedor: estadoPago,
        inventarioSincronizado: true,
        archivoNombre: "COMPRA_MANUAL",
      };

      const syncResult = await createCompraConInventario(nuevaCompraData);

      const compraCreadaCompleta: Compra = {
        id: syncResult.compraId,
        ...nuevaCompraData,
        productosCreados: syncResult.productosCreados,
        productosActualizados: syncResult.productosActualizados,
      };

      toast.success(
        `Compra manual creada exitosamente (${syncResult.productosActualizados + syncResult.productosCreados} ítems actualizados en stock)`,
        { id: toastId }
      );

      onCompraCreada(compraCreadaCompleta);
      onClose();
    } catch (error) {
      console.error("Error al registrar compra manual:", error);
      toast.error("No se pudo registrar la compra manual", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[2000] flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-hidden animate-fade-in"
    >
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] my-auto">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <ShoppingCart size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base leading-tight">
                Registrar Compra Manual
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">
                Ingresa productos al catálogo y actualiza las existencias de inventario
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-0 bg-transparent cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
          {/* Fila 1: Datos de la Compra & Proveedor */}
          <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Building size={14} className="text-blue-600" /> Datos del Proveedor y Comprobante
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Razón Social / Proveedor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Distribuidora Automotriz"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  value={proveedorRazonSocial}
                  onChange={(e) => setProveedorRazonSocial(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  RUC / Identificación
                </label>
                <input
                  type="text"
                  placeholder="Ej: 0927405092001"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  value={proveedorRuc}
                  onChange={(e) => setProveedorRuc(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Nº Factura / Comprobante
                </label>
                <input
                  type="text"
                  placeholder="Ej: 001-001-00000123"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  value={numeroFactura}
                  onChange={(e) => setNumeroFactura(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Fecha Emisión
                </label>
                <input
                  type="date"
                  required
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  value={fechaEmision}
                  onChange={(e) => setFechaEmision(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Fila 2: Buscador & Selección de Productos del Catálogo */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Package size={14} className="text-blue-600" /> Productos a Ingresar ({items.length})
              </h4>
              <button
                type="button"
                onClick={handleAddManualItem}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 bg-transparent border-0 cursor-pointer"
              >
                <Plus size={13} /> Agregar ítem libre
              </button>
            </div>

            {/* Buscador Autocomplete del Catálogo */}
            <div className="relative">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
                <input
                  type="text"
                  className="w-full bg-blue-50/40 dark:bg-slate-800/60 border border-blue-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Buscar producto por nombre, SKU o código en el catálogo..."
                  value={searchCatalog}
                  onChange={(e) => {
                    setSearchCatalog(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                />
              </div>

              {/* Dropdown de Resultados del Catálogo */}
              {isSearchOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsSearchOpen(false)}></div>
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 custom-scrollbar">
                    {loadingProductos ? (
                      <div className="p-3 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                        <Loader2 size={14} className="animate-spin text-blue-500" /> Cargando catálogo...
                      </div>
                    ) : productosFiltrados.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">
                        No se encontraron productos coincidentes. Puedes presionar "+ Agregar ítem libre".
                      </div>
                    ) : (
                      productosFiltrados.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => handleSelectProducto(p)}
                          className="p-2.5 hover:bg-blue-50 dark:hover:bg-slate-700/50 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div>
                            <p className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase">{p.nombre}</p>
                            <p className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>SKU: {p.sku || "N/A"}</span>
                              <span>• Stock Actual: {p.stockActual ?? 0}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                              ${(p.costoBase || p.precioBase || 0).toFixed(2)}
                            </span>
                            <span className="block text-[9px] text-slate-400 uppercase">Costo ref</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Tabla de ítems a ingresar */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
              {items.length === 0 ? (
                <div className="py-8 px-4 text-center text-slate-400 text-xs">
                  Sin productos agregados. Usa la barra de búsqueda de arriba para seleccionar ítems del catálogo.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Código / SKU</th>
                        <th className="py-2.5 px-3">Descripción Producto</th>
                        <th className="py-2.5 px-3 text-center">Cant. Ingresada</th>
                        <th className="py-2.5 px-3 text-right">Costo Unit. ($)</th>
                        <th className="py-2.5 px-3 text-center">IVA (15%)</th>
                        <th className="py-2.5 px-3 text-right">Subtotal ($)</th>
                        <th className="py-2.5 px-2 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {items.map((it, idx) => {
                        const itemSubtotal = it.cantidad * it.precioUnitario;
                        return (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-2 px-3 w-32">
                              <input
                                type="text"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono uppercase"
                                value={it.codigo}
                                onChange={(e) => handleUpdateItem(idx, "codigo", e.target.value)}
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                required
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-semibold"
                                value={it.descripcion}
                                onChange={(e) => handleUpdateItem(idx, "descripcion", e.target.value)}
                              />
                            </td>
                            <td className="py-2 px-3 w-28 text-center">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                required
                                className="w-20 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-bold text-blue-600 dark:text-blue-400"
                                value={it.cantidad || ""}
                                onChange={(e) => handleUpdateItem(idx, "cantidad", Number(e.target.value))}
                              />
                            </td>
                            <td className="py-2 px-3 w-28 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                className="w-24 text-right bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono"
                                value={it.precioUnitario || ""}
                                onChange={(e) => handleUpdateItem(idx, "precioUnitario", Number(e.target.value))}
                              />
                            </td>
                            <td className="py-2 px-3 text-center w-24">
                              <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={it.aplicaIva}
                                  onChange={(e) => handleUpdateItem(idx, "aplicaIva", e.target.checked)}
                                  className="w-4 h-4 text-blue-600 rounded border-slate-300 accent-blue-600 cursor-pointer"
                                />
                                <span className="text-[10px] text-slate-500 font-semibold">15%</span>
                              </label>
                            </td>
                            <td className="py-2 px-3 text-right font-bold font-mono text-xs">
                              ${itemSubtotal.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors border-0 bg-transparent cursor-pointer"
                                title="Eliminar ítem"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Totales Resumen */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  * El stock ingresado se sumará automáticamente a las existencias del inventario.
                </p>
              </div>

              <div className="w-full sm:w-64 space-y-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 shrink-0">
                <div className="flex justify-between">
                  <span>Subtotal Sin IVA:</span>
                  <span className="font-bold font-mono">${totalSinImpuestos.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA (15%):</span>
                  <span className="font-bold font-mono">${totalIva.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-slate-100 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                  <span>Total Compra:</span>
                  <span className="text-blue-600 dark:text-blue-400 font-mono">${importeTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Fila 3: Opción de Registro de Pago Inicial */}
          <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={registrarPago}
                  onChange={(e) => setRegistrarPago(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 accent-blue-600 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Registrar Abono / Pago Inicial al Proveedor
                </span>
              </label>
              <span className="text-[11px] font-bold text-slate-500">
                Estado: {registrarPago && (pagoMonto ? Number(pagoMonto) : importeTotal) >= importeTotal ? "PAGADO" : "PENDIENTE / PARCIAL"}
              </span>
            </div>

            {registrarPago && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700 animate-fade-in">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Monto Abonado ($)
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs outline-none font-bold text-emerald-600 dark:text-emerald-400"
                    placeholder={importeTotal.toFixed(2)}
                    value={pagoMonto}
                    onChange={(e) => setPagoMonto(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Método de Pago
                  </label>
                  <select
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs outline-none cursor-pointer"
                    value={pagoMetodo}
                    onChange={(e) => setPagoMetodo(e.target.value as CompraMetodoPago)}
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta_credito">Tarjeta de Crédito</option>
                    <option value="tarjeta_debito">Tarjeta de Débito</option>
                  </select>
                </div>

                {pagoMetodo === "transferencia" ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Banco Origen / Destino
                    </label>
                    <input
                      type="text"
                      list={`${BANCO_TRANSFERENCIA_LIST_ID}-compra-manual`}
                      placeholder="Seleccionar banco..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs outline-none"
                      value={pagoBanco}
                      onChange={(e) => setPagoBanco(e.target.value)}
                    />
                    <datalist id={`${BANCO_TRANSFERENCIA_LIST_ID}-compra-manual`}>
                      {BANCOS_TRANSFERENCIA.map((b) => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Referencia / Nº Comprobante
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Ref #987654"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs outline-none"
                      value={pagoReferencia}
                      onChange={(e) => setPagoReferencia(e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Notas de Pago
                  </label>
                  <input
                    type="text"
                    placeholder="Observaciones opcionales..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs outline-none"
                    value={pagoNotas}
                    onChange={(e) => setPagoNotas(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Form Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving || items.length === 0}
              className="btn-primary bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              <span>Registrar Compra e Incrementar Stock</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
