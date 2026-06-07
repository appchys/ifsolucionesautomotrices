import { Timestamp } from "firebase/firestore";

export type UserRole = "admin" | "recepcion" | "tecnico" | "contador" | "asesor_servicio" | "logistica";

export interface AppUser {
  id?: string;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  activo: boolean;
}

export interface Cliente {
  id?: string;
  nombre: string;
  apellido: string;
  identificacion: string;
  telefono: string;
  email: string;
  direccion: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type TipoVehiculo = "sedan" | "suv" | "pickup" | "camioneta" | "moto" | "otro";
export type VehiculoVista = "superior" | "izquierda" | "derecha" | "delantera" | "trasera";

/** Representa una imagen de vista para un tipo de vehículo */
export interface VehicleViewImage {
  vista: VehiculoVista;
  imageUrl: string;
}

/** Configuración de imágenes de vistas para cada tipo de vehículo */
export interface VehicleViewImagesConfig {
  tipoVehiculo: TipoVehiculo;
  imagenes: VehicleViewImage[];
  updatedAt?: Timestamp;
}

export interface Vehiculo {
  id?: string;
  clienteId: string;
  cliente?: Cliente;
  placa: string;
  marca: string;
  modelo: string;
  anio: number;
  color: string;
  vin?: string;
  tipoVehiculo: TipoVehiculo;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type EstadoOrden = "Ingreso" | "Proceso" | "Finalizado" | "Entregado";
export type TipoServicio = "Mantenimiento" | "Reparación" | "Garantía";
export type NivelCombustible = "Vacío" | "1/4" | "1/2" | "3/4" | "Lleno";

export interface ChecklistItem {
  label: string;
  checked: boolean;
}

export interface DanoVehiculo {
  id: string;
  x: number;
  y: number;
  tipo: "abolladura" | "rayón" | "rotura" | "otro";
  vista?: VehiculoVista;
  descripcion?: string;
}

export interface InspeccionVisual {
  danos: DanoVehiculo[];
  notasGenerales?: string;
  fotoUrls?: string[];
}

export interface OrdenTrabajo {
  id?: string;
  vehiculoId: string;
  clienteId: string;
  vehiculo?: Vehiculo;
  cliente?: Cliente;
  numero?: number;
  estado: EstadoOrden;
  tipoServicio: TipoServicio;
  motivo: string;
  kilometrajeIngreso: number;
  nivelCombustible: NivelCombustible;
  checklistInventario: ChecklistItem[];
  inspeccionVisual: InspeccionVisual;
  notasInternas?: string;
  informeTecnico?: string;
  tecnicoId?: string;
  fotoUrls?: string[];
  esCotizacion?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  fechaEntrega?: Timestamp;
}

export interface ItemOrden {
  id?: string;
  ordenId: string;
  tipo: "producto" | "servicio";
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  impuestoAplicable: number;
  subtotal: number;
  createdAt?: Timestamp;
}

export type EstadoPago = "pendiente" | "parcial" | "pagado";
export type MetodoPago = "efectivo" | "transferencia" | "tarjeta" | "otro";

export interface Pago {
  id?: string;
  ordenId: string;
  monto: number;
  metodoPago: MetodoPago;
  referencia?: string;
  notas?: string;
  createdAt?: Timestamp;
  registradoPor?: string;
}

export interface ResumenPago {
  totalOrden: number;
  totalPagado: number;
  saldoPendiente: number;
  estado: EstadoPago;
  pagos: Pago[];
}

export type FeatureStatus = "Completo" | "En proceso" | "Pendiente";

export interface DevFeature {
  nombre: string;
  descripcion: string;
  estado: FeatureStatus;
  modulo: string;
}

/** Configuración global del taller (documento `configuracion/taller`) */
export interface DatosTaller {
  razonSocial: string;
  ruc: string;
  direccion: string;
  telefono: string;
  email: string;
  /** URL en Firebase Storage (subida desde configuración) */
  logoUrl: string;
}

export interface Producto {
  id?: string;
  nombre: string;
  descripcion?: string;
  precioBase: number;
  costoBase: number;
  aplicaIva: boolean;
  sku: string;
  imagenUrl?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Servicio {
  id?: string;
  nombre: string;
  descripcion?: string;
  precioBase: number;
  costoBase: number;
  aplicaIva: boolean;
  imagenUrl?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
