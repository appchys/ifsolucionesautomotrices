import { Timestamp } from "firebase/firestore";

export type UserRole = "admin" | "gerente" | "tecnico" | "recepcion" | "contador" | "asesor_servicio" | "logistica";

export interface AppUser {
  id?: string;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
  createdAt: Timestamp;
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

export type TipoVehiculo = string;
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

export type EstadoOrden =
  | "Borrador"
  | "En Diagnóstico"
  | "Esperando Repuestos"
  | "Esperando Aprobación"
  | "En Reparación"
  | "Completada"
  | "Listo para Entrega"
  | "Entregada"
  | "Cancelada";
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
  vista?: VehiculoVista;
  tipo: "abolladura" | "rayón" | "rotura" | "otro";
  descripcion?: string;
  fotoUrl?: string;
}

export interface InspeccionVisual {
  danos: DanoVehiculo[];
  notasGenerales?: string;
  fotoUrls?: string[];
}

export interface FlujoTrabajo {
  ejecucionRepuestos: {
    compraProveedorAutorizada: boolean;
    logisticaRetiraRepuestos: boolean;
    tecnicosInicianDespiece: boolean;
    compraRepuestosRegistrada: boolean;
    notas?: string;
  };
  ordenReparacion: {
    presupuestoConvertidoOrden: boolean;
    tecnicoConfirmaCargado: boolean;
    reparacionFinalizada: boolean;
    pruebaRutaRealizada: boolean;
    notas?: string;
  };
  entregaCierre: {
    controlCalidadCompletado: boolean;
    lavadoRealizado: boolean;
    lavadoNoAplica: boolean;
    clienteNotificado: boolean;
    ordenEnviadaWhatsApp: boolean;
    pagoEfectivo: boolean;
    pagoTransferencia: boolean;
    pagoTarjeta: boolean;
    vehiculoEntregado: boolean;
    pendientesInformados: boolean;
    facturaElectronicaEmitida: boolean;
    ordenCerradaSistema: boolean;
    notas?: string;
  };
}

export interface FotoDiagnostico {
  url: string;
  descripcion?: string;
}

export interface OrdenTrabajo {
  id?: string;
  vehiculoId: string;
  clienteId: string;
  vehiculo?: Vehiculo;
  cliente?: Cliente;
  numero?: number;
  numeroIngreso?: number;
  numeroOrden?: number;
  numeroCotizacion?: number;
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
  presupuestoConfirmadoPorCliente?: boolean;
  flujoTrabajo?: FlujoTrabajo;
  personalAsignado?: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
  }[];
  fotoUrls?: string[];
  fotosDiagnostico?: FotoDiagnostico[];
  esCotizacion?: boolean;
  archivado?: boolean;
  firmaClienteUrl?: string;
  firmaTecnicoUrl?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  fechaEntrega?: Timestamp;
  facturaManual?: string;
}

export interface ItemOrden {
  id?: string;
  ordenId: string;
  tipo: "producto" | "servicio" | "externo";
  productoId?: string;
  productoSku?: string;
  productoNombre?: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  impuestoAplicable: number;
  subtotal: number;
  createdAt?: Timestamp;
  proveedorExterno?: string;
  costoExterno?: number;
  compraId?: string;
  pagadoExterno?: boolean;
  metodoPagoExterno?: string;
  bancoExterno?: string;
  referenciaExterno?: string;
  notasPagoExterno?: string;
  fechaPagoExterno?: string;
  fechaAcreditacionExterno?: string;
  estadoAcreditacionExterno?: "pendiente" | "acreditado";
}

export type AccionInventarioDevolucion = "reingresar_stock" | "merma" | "garantia_proveedor" | "sin_reingreso";
export type EstadoDevolucion = "registrada";
export type MetodoDevolucion = "efectivo" | "transferencia" | "credito_cliente" | "nota_credito" | "otro";

export interface Devolucion {
  id?: string;
  ordenId: string;
  numeroOrden?: number;
  clienteId: string;
  clienteNombre?: string;
  vehiculoId?: string;
  vehiculoPlaca?: string;
  itemOrdenId: string;
  productoId: string;
  productoSku: string;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
  impuestoAplicable: number;
  subtotalDevuelto: number;
  motivo: string;
  accionInventario: AccionInventarioDevolucion;
  estado: EstadoDevolucion;
  montoDevuelto: number;
  metodoDevolucion?: MetodoDevolucion;
  notas?: string;
  createdAt?: Timestamp;
}

export type EstadoPago = "pendiente" | "parcial" | "pagado";
export type MetodoPago = "efectivo" | "transferencia" | "tarjeta" | "tarjeta_credito" | "tarjeta_debito" | "otro";

export interface Pago {
  id?: string;
  ordenId: string;
  ventaId?: string;
  monto: number;
  montoBase?: number;
  recargo?: number;
  porcentajeRecargo?: number;
  metodoPago: MetodoPago;
  banco?: string;
  referencia?: string;
  notas?: string;
  createdAt?: Timestamp;
  registradoPor?: string;
  fechaAcreditacion?: string;
  estadoAcreditacion?: "pendiente" | "acreditado";
}

export interface ResumenPago {
  totalOrden: number;
  totalPagado: number;
  saldoPendiente: number;
  estado: EstadoPago;
  pagos: Pago[];
}

export type CompraMetodoPago = "efectivo" | "transferencia" | "tarjeta_debito" | "tarjeta_credito" | "nota_credito" | "otro";

export interface CompraPago {
  monto: number;
  metodoPago: CompraMetodoPago;
  banco?: string;
  referencia?: string;
  notas?: string;
  fecha?: string;
  fechaAcreditacion?: string;
  estadoAcreditacion?: "pendiente" | "acreditado";
  createdAt?: Timestamp;
}

export type MetodoDevolucionProveedor = "nota_credito" | "transferencia" | "reembolso" | "descuento_pendiente" | "sin_credito";

export interface DevolucionProveedor {
  id?: string;
  compraId: string;
  numeroFactura: string;
  proveedorRazonSocial: string;
  proveedorRuc: string;
  itemIndex: number;
  productoSku: string;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
  impuestoUnitario: number;
  subtotalDevuelto: number;
  motivo: string;
  metodoDevolucion: MetodoDevolucionProveedor;
  banco?: string;
  referencia?: string;
  notas?: string;
  ajustoInventario: boolean;
  createdAt?: Timestamp;
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
  categoria?: string;
  fabricante?: string;
  unidadMedida?: string;
  precioBase: number;
  costoBase: number;
  margenGanancia?: number;
  aplicaIva: boolean;
  sku: string;
  stockActual?: number;
  ultimaCompraId?: string;
  ultimaCompraFactura?: string;
  ultimaCompraFecha?: string;
  ultimoProveedorRuc?: string;
  ultimoProveedorNombre?: string;
  imagenUrl?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface MovimientoStock {
  id?: string;
  productoId: string;
  productoNombre: string;
  sku: string;
  tipo: "entrada" | "salida";
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
  nota?: string;
  unidadMedida?: string;
  createdAt?: Timestamp;
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

export interface CompraItem {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  subtotalSinImpuesto: number;
  impuesto: number;
  tarifaIva?: number;
  baseImponibleIva?: number;
  total: number;
}

export interface Compra {
  id?: string;
  estadoAutorizacion: string;
  numeroAutorizacion: string;
  fechaAutorizacion: string;
  proveedorRazonSocial: string;
  proveedorRuc: string;
  claveAcceso: string;
  establecimiento: string;
  puntoEmision: string;
  secuencial: string;
  numeroFactura: string;
  fechaEmision: string;
  compradorRazonSocial: string;
  compradorIdentificacion: string;
  totalSinImpuestos: number;
  totalDescuento: number;
  importeTotal: number;
  moneda: string;
  items: CompraItem[];
  pagosProveedor?: CompraPago[];
  totalPagadoProveedor?: number;
  totalDevueltoProveedor?: number;
  saldoProveedor?: number;
  estadoPagoProveedor?: EstadoPago;
  inventarioSincronizado?: boolean;
  productosCreados?: number;
  productosActualizados?: number;
  archivoNombre?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type GmailXmlDraftStatus = "pendiente" | "guardado" | "descartado";

export interface GmailXmlDraft {
  id?: string;
  compra: Omit<Compra, "id">;
  pagos: CompraPago[];
  gmailMessageId?: string;
  estado: GmailXmlDraftStatus;
  compraId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CompraInventarioSyncResult {
  compraId: string;
  productosCreados: number;
  productosActualizados: number;
}

export interface VentaItem {
  productoId: string;
  sku: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  costoUnitario: number;
  aplicaIva: boolean;
  impuestoAplicable: number;
  subtotal: number;
}

export interface Venta {
  id?: string;
  numeroVenta: string;
  clienteId?: string;
  clienteNombre: string;
  clienteIdentificacion?: string;
  vendedorId?: string;
  vendedorNombre: string;
  items: VentaItem[];
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
  notas?: string;
  metodoPago: MetodoPago;
  estado: "completada" | "anulada";
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  pagos?: Omit<Pago, "id" | "ordenId">[];
}

export interface MensajeOrden {
  id?: string;
  ordenId: string;
  autorId: string;
  autorNombre: string;
  autorRole: UserRole;
  autorPhotoURL?: string;
  texto: string;
  sistema?: boolean;
  tecnicoAfectadoId?: string;
  tecnicoAfectadoNombre?: string;
  accionSistema?: "asignar" | "remover" | "inspeccion" | "presupuesto" | "orden";
  presupuestoId?: string;
  createdAt?: Timestamp;
}

// ─── CAJA ─────────────────────────────────────────────────────────────────────

export interface CajaMovimientoManual {
  id?: string;
  tipo: "ingreso" | "egreso";
  concepto: string;
  categoria: string;
  monto: number;
  metodoPago: MetodoPago;
  banco?: string;
  referencia?: string;
  registradoPor: { uid: string; displayName: string };
  createdAt?: Timestamp;
}

export interface Caja {
  id?: string;
  fecha: string; // "YYYY-MM-DD" en UTC-5
  aperturaAt: Timestamp;
  cierreAt?: Timestamp;
  montoApertura: number;
  estado: "abierta" | "cerrada";
  abiertaPor: { uid: string; displayName: string };
  cerradaPor?: { uid: string; displayName: string };
  notas?: string;
}

/** Movimiento normalizado que combina las 3 fuentes para la tabla de caja */
export type FuenteMovimientoCaja = "cobro_orden" | "cobro_venta" | "pago_proveedor" | "manual";

export interface MovimientoCajaUnificado {
  id: string;
  hora: Date;
  concepto: string;
  categoria: string;
  tipo: "ingreso" | "egreso";
  metodoPago: MetodoPago;
  banco?: string;
  monto: number;
  usuario: string;
  fuente: FuenteMovimientoCaja;
  pendienteAcreditacion?: boolean;
  referencia?: string;
}

