"use client";
import { useEffect, useRef } from "react";
import { useAuthStore, useCajaStore } from "@/store";
import {
  onCajaDeHoySnapshot,
  onMovimientosManualesSnapshot,
  onCobrosDelDiaSnapshot,
  getPagosProveedorDelDia,
  normalizarMovimientosCaja,
  calcularResumenCaja,
  getFechaHoyEcuador,
} from "@/lib/services";

/**
 * Monta todos los listeners de Firestore para la caja del día.
 * Se debe renderizar una sola vez dentro de AppShell.
 */
export default function CajaProvider() {
  const { user } = useAuthStore();
  const {
    setCaja,
    setMovimientosManuales,
    setCobrosDelDia,
    setPagosProveedorDelDia,
    setMovimientosUnificados,
    caja,
    movimientosManuales,
    cobrosDelDia,
    pagosProveedorDelDia,
  } = useCajaStore();

  const unsubMovRef = useRef<(() => void) | null>(null);
  const unsubCobrosRef = useRef<(() => void) | null>(null);
  const pagosProveedorRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listener principal: caja de hoy
  useEffect(() => {
    if (!user) return;
    const unsub = onCajaDeHoySnapshot((cajaActiva) => {
      setCaja(cajaActiva);
    });
    return () => unsub();
  }, [user, setCaja]);

  // Cuando hay caja activa, activar listeners de movimientos y cobros
  useEffect(() => {
    // Limpiar listeners anteriores
    unsubMovRef.current?.();
    unsubCobrosRef.current?.();

    if (!caja?.id) {
      setMovimientosManuales([]);
      setCobrosDelDia([]);
      return;
    }

    const fecha = caja.fecha || getFechaHoyEcuador();

    unsubMovRef.current = onMovimientosManualesSnapshot(caja.id, (movs) => {
      setMovimientosManuales(movs);
    });

    unsubCobrosRef.current = onCobrosDelDiaSnapshot(fecha, (cobros) => {
      setCobrosDelDia(cobros);
    });

    // Pagos a proveedor: polling cada 30s (no tienen snapshot nativo por ser embebidos)
    const fetchPagosProveedor = () => {
      getPagosProveedorDelDia(fecha).then(setPagosProveedorDelDia).catch(console.error);
    };
    fetchPagosProveedor();
    pagosProveedorRef.current = setInterval(fetchPagosProveedor, 30_000);

    return () => {
      unsubMovRef.current?.();
      unsubCobrosRef.current?.();
      if (pagosProveedorRef.current) clearInterval(pagosProveedorRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caja?.id]);

  // Recalcular movimientos unificados cuando cambia cualquiera de las fuentes
  useEffect(() => {
    if (!caja) {
      setMovimientosUnificados([]);
      return;
    }
    const unificados = normalizarMovimientosCaja({
      movimientosManuales,
      cobros: cobrosDelDia,
      pagosProveedor: pagosProveedorDelDia,
    });
    setMovimientosUnificados(unificados);
  }, [caja, movimientosManuales, cobrosDelDia, pagosProveedorDelDia, setMovimientosUnificados]);

  return null;
}
