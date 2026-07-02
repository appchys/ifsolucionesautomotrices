import { create } from "zustand";
import { AppUser, Caja, CajaMovimientoManual, Cliente, MovimientoCajaUnificado, OrdenTrabajo, Pago, Vehiculo } from "@/types";
import type { PagoProveedorDelDia } from "@/lib/services";

interface AuthStore {
  user: AppUser | null;
  loading: boolean;
  setUser: (user: AppUser | null) => void;
  setLoading: (loading: boolean) => void;
}

interface UIStore {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  activeModule: string;
  setActiveModule: (module: string) => void;
  isIngresoSidebarOpen: boolean;
  ingresoSidebarId: string | null;
  setIngresoSidebarOpen: (open: boolean, id?: string | null) => void;
  isPresupuestoSidebarOpen: boolean;
  presupuestoSidebarId: string | null;
  setPresupuestoSidebarOpen: (open: boolean, id?: string | null) => void;
  isOrdenSidebarOpen: boolean;
  ordenSidebarId: string | null;
  setOrdenSidebarOpen: (open: boolean, id?: string | null) => void;
}

interface RecepcionStore {
  clienteEncontrado: Cliente | null;
  vehiculoEncontrado: Vehiculo | null;
  setClienteEncontrado: (c: Cliente | null) => void;
  setVehiculoEncontrado: (v: Vehiculo | null) => void;
  reset: () => void;
}

interface OrdenesStore {
  ordenes: OrdenTrabajo[];
  selectedOrden: OrdenTrabajo | null;
  setOrdenes: (ordenes: OrdenTrabajo[]) => void;
  setSelectedOrden: (orden: OrdenTrabajo | null) => void;
}

interface CajaStore {
  caja: Caja | null;
  movimientosManuales: CajaMovimientoManual[];
  cobrosDelDia: Pago[];
  pagosProveedorDelDia: PagoProveedorDelDia[];
  movimientosUnificados: MovimientoCajaUnificado[];
  isCajaModalOpen: boolean;
  setCaja: (caja: Caja | null) => void;
  setMovimientosManuales: (m: CajaMovimientoManual[]) => void;
  setCobrosDelDia: (p: Pago[]) => void;
  setPagosProveedorDelDia: (p: PagoProveedorDelDia[]) => void;
  setMovimientosUnificados: (m: MovimientoCajaUnificado[]) => void;
  toggleCajaModal: () => void;
  openCajaModal: () => void;
  closeCajaModal: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
}));

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  activeModule: "dashboard",
  setActiveModule: (module) => set({ activeModule: module }),
  isIngresoSidebarOpen: false,
  ingresoSidebarId: null,
  setIngresoSidebarOpen: (open, id = null) => set({ isIngresoSidebarOpen: open, ingresoSidebarId: id }),
  isPresupuestoSidebarOpen: false,
  presupuestoSidebarId: null,
  setPresupuestoSidebarOpen: (open, id = null) => set({ isPresupuestoSidebarOpen: open, presupuestoSidebarId: id }),
  isOrdenSidebarOpen: false,
  ordenSidebarId: null,
  setOrdenSidebarOpen: (open, id = null) => set({ isOrdenSidebarOpen: open, ordenSidebarId: id }),
}));

export const useRecepcionStore = create<RecepcionStore>((set) => ({
  clienteEncontrado: null,
  vehiculoEncontrado: null,
  setClienteEncontrado: (c) => set({ clienteEncontrado: c }),
  setVehiculoEncontrado: (v) => set({ vehiculoEncontrado: v }),
  reset: () => set({ clienteEncontrado: null, vehiculoEncontrado: null }),
}));

export const useOrdenesStore = create<OrdenesStore>((set) => ({
  ordenes: [],
  selectedOrden: null,
  setOrdenes: (ordenes) => set({ ordenes }),
  setSelectedOrden: (orden) => set({ selectedOrden: orden }),
}));

export const useCajaStore = create<CajaStore>((set) => ({
  caja: null,
  movimientosManuales: [],
  cobrosDelDia: [],
  pagosProveedorDelDia: [],
  movimientosUnificados: [],
  isCajaModalOpen: false,
  setCaja: (caja) => set({ caja }),
  setMovimientosManuales: (m) => set({ movimientosManuales: m }),
  setCobrosDelDia: (p) => set({ cobrosDelDia: p }),
  setPagosProveedorDelDia: (p) => set({ pagosProveedorDelDia: p }),
  setMovimientosUnificados: (m) => set({ movimientosUnificados: m }),
  toggleCajaModal: () => set((s) => ({ isCajaModalOpen: !s.isCajaModalOpen })),
  openCajaModal: () => set({ isCajaModalOpen: true }),
  closeCajaModal: () => set({ isCajaModalOpen: false }),
}));

export * from "./chatStore";
