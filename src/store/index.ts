import { create } from "zustand";
import { AppUser, Cliente, Vehiculo, OrdenTrabajo } from "@/types";

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

export * from "./chatStore";

