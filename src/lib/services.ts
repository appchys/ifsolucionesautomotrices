import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  increment,
  runTransaction,
  serverTimestamp,
  onSnapshot,
  QueryConstraint,
  type Transaction,
  Timestamp,
  collectionGroup,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./firebase";
import {
  Cliente,
  Vehiculo,
  OrdenTrabajo,
  AdjuntoOrden,
  Cita,
  ItemOrden,
  Pago,
  AppUser,
  EstadoOrden,
  DatosTaller,
  Producto,
  MovimientoStock,
  Servicio,
  VehicleViewImagesConfig,
  VehiculoVista,
  TipoVehiculo,
  Compra,
  CompraPago,
  CompraInventarioSyncResult,
  GmailXmlDraft,
  GmailXmlDraftStatus,
  Devolucion,
  AccionInventarioDevolucion,
  DevolucionProveedor,
  Venta,
  VentaItem,
  MensajeOrden,
  Caja,
  CajaMovimientoManual,
  MovimientoCajaUnificado,
  Herramienta,
  MarcaVehiculo,
  ModeloVehiculo,
} from "@/types";

export function normalizarMargenGanancia(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 25;
}

const IVA_RATE = 15;

export function calcularPrecioVenta(costoBase: number, margenGanancia: number, aplicaIva = false): number {
  const precioConMargen = Number(costoBase || 0) * (1 + margenGanancia / 100);
  const precioFinal = aplicaIva ? precioConMargen * (1 + IVA_RATE / 100) : precioConMargen;
  return Number(precioFinal.toFixed(2));
}

export function resolverMargenProducto(producto?: Producto | null): number {
  if (!producto) return 25;
  if (typeof producto.margenGanancia === "number") return producto.margenGanancia;
  const costoBase = Number(producto.costoBase ?? 0);
  if (costoBase <= 0) return 25;
  return Number(((Number(producto.precioBase ?? 0) / costoBase - 1) * 100).toFixed(2));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  if (value.constructor && value.constructor.name !== "Object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function removeUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedFields(item)) as T;
  }

  if (!isPlainObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, fieldValue]) => fieldValue !== undefined)
      .map(([key, fieldValue]) => [key, removeUndefinedFields(fieldValue)])
  ) as T;
}

function getCantidadStock(value: unknown): number {
  const cantidad = Math.floor(Number(value ?? 0));
  return Number.isFinite(cantidad) ? cantidad : 0;
}

function itemDescuentaStock<T extends Partial<ItemOrden>>(item: T): item is T & { productoId: string } {
  return item.tipo === "producto" && Boolean(item.productoId);
}

function calcularSubtotalItem(cantidad: number, precioUnitario: number, impuestoAplicable: number): number {
  return Number((cantidad * precioUnitario * (1 + impuestoAplicable / 100)).toFixed(2));
}

export const DATOS_TALLER_DEFAULT: DatosTaller = {
  razonSocial: "",
  ruc: "",
  direccion: "",
  telefono: "",
  email: "",
  logoUrl: "",
  terminosPredeterminados: "Los trabajos realizados tienen una garantía de 3 meses. El cliente debe retirar el vehículo dentro de los 5 días hábiles posteriores a la notificación de término.",
};

const TALLER_DOC = () => doc(db, "configuracion", "taller");

/** Path en Storage a partir de la URL de descarga de Firebase (`.../o/ENCODED_PATH?...`). */
function storagePathFromDownloadUrl(downloadUrl: string): string | null {
  try {
    const i = downloadUrl.indexOf("/o/");
    if (i === -1) return null;
    const start = i + 3;
    const q = downloadUrl.indexOf("?", start);
    const encoded = q === -1 ? downloadUrl.slice(start) : downloadUrl.slice(start, q);
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

// ─── CONFIGURACIÓN TALLER ─────────────────────────────────────────────────────
export async function getDatosTaller(): Promise<DatosTaller> {
  const snap = await getDoc(TALLER_DOC());
  if (!snap.exists()) return { ...DATOS_TALLER_DEFAULT };
  const d = snap.data();
  return {
    ...DATOS_TALLER_DEFAULT,
    razonSocial: String(d.razonSocial ?? ""),
    ruc: String(d.ruc ?? ""),
    direccion: String(d.direccion ?? ""),
    telefono: String(d.telefono ?? ""),
    email: String(d.email ?? ""),
    logoUrl: String(d.logoUrl ?? ""),
    terminosPredeterminados: String(d.terminosPredeterminados ?? DATOS_TALLER_DEFAULT.terminosPredeterminados),
  };
}

export async function saveDatosTaller(data: DatosTaller): Promise<void> {
  const ref = TALLER_DOC();
  const snap = await getDoc(ref);
  const payload: Record<string, unknown> = {
    razonSocial: data.razonSocial.trim(),
    ruc: data.ruc.trim(),
    direccion: data.direccion.trim(),
    telefono: data.telefono.trim(),
    email: data.email.trim(),
    logoUrl: data.logoUrl.trim(),
    terminosPredeterminados: (data.terminosPredeterminados ?? "").trim(),
    updatedAt: serverTimestamp(),
  };
  if (!snap.exists()) payload.createdAt = serverTimestamp();
  await setDoc(ref, payload, { merge: true });
}

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

function extensionForLogo(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/svg+xml") return "svg";
  const m = /\.([a-zA-Z0-9]+)$/.exec(file.name);
  return (m?.[1] ?? "png").toLowerCase().slice(0, 8);
}

/** Sube el logo del taller a Storage y devuelve la URL pública. Si había un logo anterior, lo borra tras subir el nuevo. */
export async function uploadTallerLogo(file: File, previousUrl?: string | null): Promise<string> {
  if (!LOGO_TYPES.has(file.type)) {
    throw new Error("INVALID_LOGO_TYPE");
  }
  if (file.size > LOGO_MAX_BYTES) {
    throw new Error("LOGO_TOO_LARGE");
  }
  const ext = extensionForLogo(file);
  const path = `configuracion/logo/${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  const prev = previousUrl?.trim();
  if (prev) {
    const prevPath = storagePathFromDownloadUrl(prev);
    if (prevPath) {
      try {
        await deleteObject(ref(storage, prevPath));
      } catch {
        /* archivo ya borrado o URL antigua */
      }
    }
  }
  return url;
}

/** Elimina el archivo del logo en Storage a partir de su URL de descarga. */
export async function deleteTallerLogoFile(url: string): Promise<void> {
  const u = url.trim();
  if (!u) return;
  const path = storagePathFromDownloadUrl(u);
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    /* ignorar */
  }
}

/**
 * Convierte un archivo de imagen (File) a una Data URI base64 en formato PNG
 * optimizada para logos (máximo 300px de dimensión).
 */
export function convertFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (typeof window === "undefined") {
        resolve(result);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 300;
        let width = img.width || 250;
        let height = img.height || 250;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/png"));
        } else {
          resolve(result);
        }
      };
      img.onerror = () => resolve(result);
      img.src = result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function convertSvgDataUriToPngBase64(svgDataUri: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, 200, 200);
          ctx.drawImage(img, 0, 0, 200, 200);
          resolve(canvas.toDataURL("image/png"));
          return;
        }
      } catch (e) {
        console.error("Error al convertir SVG a PNG:", e);
      }
      resolve(null);
    };
    img.onerror = () => resolve(null);
    if (svgDataUri.includes("utf8,")) {
      const parts = svgDataUri.split("utf8,");
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(parts[1]);
    } else {
      img.src = svgDataUri;
    }
  });
}

/**
 * Convierte cualquier URL de logo (PNG, JPG, WebP, SVG, Firebase Storage URL)
 * a una Data URI base64 en formato PNG compatible 100% con @react-pdf/renderer.
 */
export async function getLogoAsBase64Png(url: string): Promise<string> {
  if (!url || !url.trim()) return "";
  const trimmedUrl = url.trim();

  if (typeof window === "undefined") return trimmedUrl;

  // Si ya es un PNG o JPEG Data URI listo, retornarlo directamente
  if (trimmedUrl.startsWith("data:image/png") || trimmedUrl.startsWith("data:image/jpeg")) {
    return trimmedUrl;
  }

  // Si es un SVG Data URI (ej: logos precargados), convertirlo a PNG Base64 para react-pdf
  if (trimmedUrl.startsWith("data:image/svg+xml")) {
    const pngConverted = await convertSvgDataUriToPngBase64(trimmedUrl);
    if (pngConverted) return pngConverted;
  }

  // Si es una URL HTTP / Firebase Storage, intentar fetch + FileReader para obtener Base64 puro
  if (trimmedUrl.startsWith("http")) {
    try {
      const res = await fetch(trimmedUrl);
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string || "");
        reader.onerror = () => resolve("");
        reader.readAsDataURL(blob);
      });

      if (base64) {
        if (base64.startsWith("data:image/svg+xml")) {
          const pngConverted = await convertSvgDataUriToPngBase64(base64);
          if (pngConverted) return pngConverted;
        }
        return base64;
      }
    } catch {
      /* fetch directo con fallbacks de canvas */
    }
  }

  const tryLoadBase64 = (srcUrl: string, useCrossOrigin = true): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      if (useCrossOrigin) {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width || 250;
          canvas.height = img.naturalHeight || img.height || 250;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
            return;
          }
        } catch {
          /* canvas tainteado por CORS */
        }
        resolve(null);
      };
      img.onerror = () => resolve(null);
      img.src = srcUrl;
    });
  };

  // 1. Intentar cargar directo con CORS
  let result = await tryLoadBase64(trimmedUrl, true);
  if (result) return result;

  // 2. Si falla por CORS de Firebase Storage, intentar a través de proxy de CORS público
  if (trimmedUrl.startsWith("http")) {
    result = await tryLoadBase64(`https://api.allorigins.win/raw?url=${encodeURIComponent(trimmedUrl)}`, true);
    if (result) return result;

    result = await tryLoadBase64(`https://corsproxy.io/?${encodeURIComponent(trimmedUrl)}`, true);
    if (result) return result;
  }

  return trimmedUrl;
}

// ─── CONFIGURACIÓN DE TIPOS DE VEHÍCULO ──────────────────────────────────────────
export async function getTiposVehiculo(): Promise<string[]> {
  const snap = await getDoc(doc(db, "configuracion", "tiposVehiculo"));
  if (!snap.exists()) return ["sedan", "suv", "pickup", "camioneta", "moto", "otro"];
  const data = snap.data();
  return Array.isArray(data.tipos) ? data.tipos : ["sedan", "suv", "pickup", "camioneta", "moto", "otro"];
}

export async function saveTiposVehiculo(tipos: string[]): Promise<void> {
  const ref = doc(db, "configuracion", "tiposVehiculo");
  await setDoc(ref, { tipos, updatedAt: serverTimestamp() }, { merge: true });
}

// ─── CLIENTES ─────────────────────────────────────────────────────────────────
export async function getClientes(): Promise<Cliente[]> {
  const snap = await getDocs(query(collection(db, "clientes"), orderBy("apellido")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Cliente));
}

export async function getClienteById(id?: string | null): Promise<Cliente | null> {
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, "clientes", id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Cliente) : null;
  } catch (error) {
    console.error("Error al obtener cliente por ID:", id, error);
    return null;
  }
}

function normalizeIdentificacion(value?: string): string {
  return (value ?? "").trim().replace(/[\s.-]/g, "").toUpperCase();
}

async function assertIdentificacionDisponible(identificacion: string, currentClienteId?: string): Promise<void> {
  const normalized = normalizeIdentificacion(identificacion);
  if (!normalized) return;

  const snap = await getDocs(collection(db, "clientes"));
  const exists = snap.docs.some((d) => {
    if (currentClienteId && d.id === currentClienteId) return false;

    const cliente = d.data() as Cliente & { identificacionNormalizada?: string };
    return normalizeIdentificacion(cliente.identificacionNormalizada || cliente.identificacion) === normalized;
  });

  if (exists) throw new Error("CLIENTE_IDENTIFICACION_DUPLICADA");
}

export async function createCliente(data: Omit<Cliente, "id">): Promise<string> {
  await assertIdentificacionDisponible(data.identificacion);
  const identificacion = data.identificacion.trim();
  const ref = await addDoc(collection(db, "clientes"), {
    ...data,
    identificacion,
    identificacionNormalizada: normalizeIdentificacion(identificacion),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCliente(id: string, data: Partial<Cliente>): Promise<void> {
  const payload = { ...data } as Partial<Cliente> & { identificacionNormalizada?: string };
  if (payload.identificacion !== undefined) {
    await assertIdentificacionDisponible(payload.identificacion, id);
    payload.identificacion = payload.identificacion.trim();
    payload.identificacionNormalizada = normalizeIdentificacion(payload.identificacion);
  }

  await updateDoc(doc(db, "clientes", id), { ...payload, updatedAt: serverTimestamp() });
  delete cacheClientes[id];
}

export async function deleteCliente(id: string): Promise<void> {
  await deleteDoc(doc(db, "clientes", id));
}

// ─── VEHÍCULOS ────────────────────────────────────────────────────────────────
export async function getVehiculos(): Promise<Vehiculo[]> {
  const snap = await getDocs(query(collection(db, "vehiculos"), orderBy("placa")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vehiculo));
}

async function getCollectionCount(...constraints: QueryConstraint[]): Promise<number> {
  const q = constraints.length
    ? query(collection(db, "ordenesTrabajo"), ...constraints)
    : collection(db, "ordenesTrabajo");
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

async function getTopLevelCollectionCount(collectionName: string): Promise<number> {
  const snap = await getCountFromServer(collection(db, collectionName));
  return snap.data().count;
}

export interface DashboardStats {
  ingresos: number;
  ingresosPendientes: number;
  ordenesActivas: number;
  ordenesFinalizadas: number;
  clientes: number;
  vehiculos: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const activeStates: EstadoOrden[] = [
    "Esperando Repuestos",
    "Esperando Aprobación",
    "En Reparación",
    "Completada",
    "Listo para Entrega",
  ];

  const [ingresos, pendientesDiagnostico, pendientesBorrador, ordenesActivas, ordenesFinalizadas, clientes, vehiculos] =
    await Promise.all([
      getCollectionCount(where("esCotizacion", "==", false)),
      getCollectionCount(where("esCotizacion", "==", false), where("estado", "==", "En Diagnóstico")),
      getCollectionCount(where("esCotizacion", "==", false), where("estado", "==", "Borrador")),
      getCollectionCount(where("numeroOrden", ">", 0), where("estado", "in", activeStates)),
      getCollectionCount(where("estado", "==", "Entregada")),
      getTopLevelCollectionCount("clientes"),
      getTopLevelCollectionCount("vehiculos"),
    ]);

  return {
    ingresos,
    ingresosPendientes: pendientesDiagnostico + pendientesBorrador,
    ordenesActivas,
    ordenesFinalizadas,
    clientes,
    vehiculos,
  };
}

const cacheClientes: { [id: string]: Cliente } = {};
const cacheVehiculos: { [id: string]: Vehiculo } = {};

export async function getClienteByIdCached(id?: string | null): Promise<Cliente | null> {
  if (!id) return null;
  if (cacheClientes[id]) return cacheClientes[id];
  const c = await getClienteById(id);
  if (c) cacheClientes[id] = c;
  return c;
}

export async function getVehiculoByIdCached(id?: string | null): Promise<Vehiculo | null> {
  if (!id) return null;
  if (cacheVehiculos[id]) return cacheVehiculos[id];
  const v = await getVehiculoById(id);
  if (v) cacheVehiculos[id] = v;
  return v;
}

export function subscribeIngresosRecientes(
  callback: (ordenes: OrdenTrabajo[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(
    collection(db, "ordenesTrabajo"),
    where("esCotizacion", "==", false),
    orderBy("createdAt", "desc"),
    limit(12)
  );
  return onSnapshot(
    q,
    async (snap) => {
      const ordenesRaw = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as OrdenTrabajo))
        .filter((orden) => !orden.archivado)
        .slice(0, 8);

      const ordenesHidratadas = await Promise.all(
        ordenesRaw.map(async (orden) => {
          const [cliente, vehiculo] = await Promise.all([
            orden.clienteId ? getClienteByIdCached(orden.clienteId) : Promise.resolve(null),
            orden.vehiculoId ? getVehiculoByIdCached(orden.vehiculoId) : Promise.resolve(null),
          ]);
          return {
            ...orden,
            cliente: cliente ?? undefined,
            vehiculo: vehiculo ?? undefined,
          };
        })
      );

      callback(ordenesHidratadas);
    },
    onError
  );
}

export async function getVehiculosByCliente(clienteId: string): Promise<Vehiculo[]> {
  if (!clienteId) return [];
  const snap = await getDocs(
    query(collection(db, "vehiculos"), where("clienteId", "==", clienteId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vehiculo));
}

export async function getVehiculoById(id?: string | null): Promise<Vehiculo | null> {
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, "vehiculos", id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Vehiculo) : null;
  } catch (error) {
    console.error("Error al obtener vehiculo por ID:", id, error);
    return null;
  }
}

export async function getVehiculoByPlaca(placa: string): Promise<Vehiculo | null> {
  const snap = await getDocs(
    query(collection(db, "vehiculos"), where("placa", "==", placa.toUpperCase()))
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Vehiculo;
}

export async function searchVehiculosByPlacaPrefix(prefix: string): Promise<Vehiculo[]> {
  if (!prefix) return [];
  const p = prefix.toUpperCase();
  const snap = await getDocs(
    query(
      collection(db, "vehiculos"),
      where("placa", ">=", p),
      where("placa", "<=", p + "\uf8ff"),
      orderBy("placa")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vehiculo));
}

export async function createVehiculo(data: Omit<Vehiculo, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "vehiculos"), {
    ...data,
    placa: data.placa.toUpperCase(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateVehiculo(id: string, data: Partial<Vehiculo>): Promise<void> {
  await updateDoc(doc(db, "vehiculos", id), { ...data, updatedAt: serverTimestamp() });
  delete cacheVehiculos[id];
}

// ─── ÓRDENES DE TRABAJO ───────────────────────────────────────────────────────
export async function getOrdenes(filters?: { estado?: EstadoOrden }): Promise<OrdenTrabajo[]> {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];
  if (filters?.estado) constraints.push(where("estado", "==", filters.estado));
  const snap = await getDocs(query(collection(db, "ordenesTrabajo"), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrdenTrabajo));
}

export async function getOrdenesByVehiculoId(vehiculoId: string): Promise<OrdenTrabajo[]> {
  const snap = await getDocs(
    query(collection(db, "ordenesTrabajo"), where("vehiculoId", "==", vehiculoId))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as OrdenTrabajo))
    .sort((a, b) => {
      const aTime = a.createdAt?.toDate?.().getTime() ?? 0;
      const bTime = b.createdAt?.toDate?.().getTime() ?? 0;
      return bTime - aTime;
    });
}

export async function getOrdenById(id: string): Promise<OrdenTrabajo | null> {
  const snap = await getDoc(doc(db, "ordenesTrabajo", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as OrdenTrabajo) : null;
}

export function subscribeOrdenes(
  callback: (ordenes: OrdenTrabajo[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(collection(db, "ordenesTrabajo"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrdenTrabajo)));
    },
    onError
  );
}



export interface InfoItemsOrden {
  subtotal: number;
  subtotalGravado: number;
  totalSinDescuento: number;
}

export function subscribeTotalesItemsDetalladosMap(
  callback: (totalesMap: Record<string, InfoItemsOrden>) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    collectionGroup(db, "itemsOrden"),
    (snap) => {
      const map: Record<string, InfoItemsOrden> = {};
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const parentId = docSnap.ref.parent.parent?.id || data.ordenId;
        if (!parentId) return;
        
        const cant = Number(data.cantidad) || 0;
        const prec = Number(data.precioUnitario) || 0;
        const imp = Number(data.impuestoAplicable) || 0;
        const sub = cant * prec;
        const subGrav = imp > 0 ? sub : 0;
        const totalItem = sub * (1 + imp / 100);

        if (!map[parentId]) {
          map[parentId] = { subtotal: 0, subtotalGravado: 0, totalSinDescuento: 0 };
        }
        map[parentId].subtotal += sub;
        map[parentId].subtotalGravado += subGrav;
        map[parentId].totalSinDescuento += totalItem;
      });
      callback(map);
    },
    onError
  );
}

export function calcularTotalConDescuento(
  info?: InfoItemsOrden,
  descuento: number = 0
): number {
  if (!info) return 0;
  if (!descuento || descuento <= 0) return info.totalSinDescuento;
  
  const subtotal = info.subtotal || 0;
  const subtotalGravado = info.subtotalGravado || 0;
  if (subtotal <= 0) return 0;
  
  const proporcionGravada = subtotalGravado / subtotal;
  const baseImponibleIva = Math.max(0, subtotalGravado - (descuento * proporcionGravada));
  const iva = baseImponibleIva * 0.15;
  const base = Math.max(0, subtotal - descuento);
  return base + iva;
}

export function subscribeTotalesItemsMap(
  callback: (totalesMap: Record<string, number>) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    collectionGroup(db, "itemsOrden"),
    (snap) => {
      const map: Record<string, number> = {};
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const parentId = docSnap.ref.parent.parent?.id || data.ordenId;
        if (!parentId) return;
        const totalItem =
          (Number(data.precioUnitario) || 0) *
          (Number(data.cantidad) || 0) *
          (1 + (Number(data.impuestoAplicable) || 0) / 100);
        map[parentId] = (map[parentId] || 0) + totalItem;
      });
      callback(map);
    },
    onError
  );
}

export function subscribeTotalesPagosMap(
  callback: (pagosMap: Record<string, number>) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    collection(db, "pagos"),
    (snap) => {
      const map: Record<string, number> = {};
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.ordenId) return;
        const monto = Number(data.montoBase ?? data.monto) || 0;
        map[data.ordenId] = (map[data.ordenId] || 0) + monto;
      });
      callback(map);
    },
    onError
  );
}

type TipoNumeroDocumento = "ingreso" | "orden" | "cotizacion";

async function getProximoNumeroDocumento(tipo: TipoNumeroDocumento): Promise<number> {
  const countSnap = await getDocs(collection(db, "ordenesTrabajo"));
  const allDocs = countSnap.docs.map((ordenDoc) => ordenDoc.data() as OrdenTrabajo);

  let numeros: number[];
  if (tipo === "cotizacion") {
    numeros = allDocs
      .filter((o) => o.esCotizacion === true)
      .map((o) => o.numeroCotizacion ?? o.numero)
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  } else if (tipo === "orden") {
    numeros = allDocs
      .map((o) => o.numeroOrden)
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  } else {
    // ingreso
    numeros = allDocs
      .filter((o) => o.esCotizacion !== true)
      .map((o) => o.numeroIngreso ?? o.numero)
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  }

  return Math.max(0, ...numeros) + 1;
}

export async function createOrden(data: Omit<OrdenTrabajo, "id">): Promise<string> {
  const esCotizacion = data.esCotizacion === true;
  const numero = await getProximoNumeroDocumento(esCotizacion ? "cotizacion" : "ingreso");
  const ref = await addDoc(collection(db, "ordenesTrabajo"), {
    ...removeUndefinedFields(data),
    ...(esCotizacion ? { numeroCotizacion: numero } : { numero, numeroIngreso: numero }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function createOrdenConItems(
  data: Omit<OrdenTrabajo, "id">,
  items: Omit<ItemOrden, "id" | "ordenId">[]
): Promise<string> {
  const esCotizacion = data.esCotizacion === true;
  const numero = await getProximoNumeroDocumento(esCotizacion ? "cotizacion" : "ingreso");
  const ordenRef = doc(collection(db, "ordenesTrabajo"));

  await runTransaction(db, async (transaction) => {
    if (!esCotizacion) {
      await aplicarMovimientosStockOrden(
        transaction,
        items
          .filter(itemDescuentaStock)
          .map((item) => ({
            item,
            cantidadDelta: -getCantidadStock(item.cantidad),
            nota: `Salida por orden #OT ${String(numero).padStart(4, "0")}`,
          }))
      );
    }

    transaction.set(ordenRef, {
      ...removeUndefinedFields(data),
      ...(esCotizacion ? { numeroCotizacion: numero } : { numero, numeroIngreso: numero }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    items.forEach((item) => {
      transaction.set(doc(collection(db, "ordenesTrabajo", ordenRef.id, "itemsOrden")), {
        ...removeUndefinedFields(item),
        ordenId: ordenRef.id,
        createdAt: serverTimestamp(),
      });
    });
  });

  return ordenRef.id;
}

export async function getProximoNumeroOrden(tipo: TipoNumeroDocumento = "orden"): Promise<number> {
  return getProximoNumeroDocumento(tipo);
}

/** Busca si existe un presupuesto (esCotizacion) derivado de un cierto ingreso. */
export async function getPresupuestoPorIngreso(numeroIngreso: number, vehiculoId: string): Promise<OrdenTrabajo | null> {
  const snap = await getDocs(
    query(
      collection(db, "ordenesTrabajo"),
      where("esCotizacion", "==", true),
      where("vehiculoId", "==", vehiculoId)
    )
  );
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrdenTrabajo));
  const numStr = String(numeroIngreso);
  const found = docs.find((o) => String(o.motivo || "").includes(numStr));
  return found || null;
}

/** Busca el ingreso que dio origen a este presupuesto. */
export async function getIngresoOrigenDePresupuesto(presupuesto: OrdenTrabajo): Promise<OrdenTrabajo | null> {
  if (!presupuesto.esCotizacion || !presupuesto.motivo) return null;
  const match = presupuesto.motivo.match(/\d+/);
  if (!match) return null;
  const numIngreso = parseInt(match[0], 10);
  const snap = await getDocs(
    query(
      collection(db, "ordenesTrabajo"),
      where("esCotizacion", "==", false),
      where("vehiculoId", "==", presupuesto.vehiculoId),
      where("numeroIngreso", "==", numIngreso)
    )
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as OrdenTrabajo;
}

/** Convierte un ingreso existente en orden de trabajo asignándole un `numeroOrden` y copiando ítems de su presupuesto asociado. */
export async function convertirIngresoAOrden(ingresoId: string): Promise<number> {
  const numeroOrden = await getProximoNumeroDocumento("orden");
  const ingresoRef = doc(db, "ordenesTrabajo", ingresoId);
  const ingresoSnap = await getDoc(ingresoRef);
  
  if (!ingresoSnap.exists()) {
    throw new Error("INGRESO_NO_ENCONTRADO");
  }
  
  const ingreso = ingresoSnap.data() as OrdenTrabajo;

  // Actualizar el documento de ingreso para que sea orden
  await updateDoc(ingresoRef, {
    numeroOrden,
    estado: "En Reparación",
    updatedAt: serverTimestamp(),
  });

  try {
    // Buscar si hay un presupuesto vinculado
    const numeroIngresoParaBuscar = ingreso.numeroIngreso ?? ingreso.numero ?? 0;
    const presupuesto = await getPresupuestoPorIngreso(numeroIngresoParaBuscar, ingreso.vehiculoId);
    
    if (presupuesto?.id) {
      // Obtener ítems del presupuesto
      const itemsPresupuesto = await getItemsOrden(presupuesto.id);
      if (itemsPresupuesto.length > 0) {
        // Copiar ítems al orden
        const batch = writeBatch(db);
        itemsPresupuesto.forEach((item) => {
          const newItemRef = doc(collection(db, "ordenesTrabajo", ingresoId, "itemsOrden"));
          const { id, ...itemData } = item;
          batch.set(newItemRef, {
            ...itemData,
            ordenId: ingresoId,
            createdAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
    }
  } catch (error) {
    console.error("Error al copiar ítems del presupuesto al convertir ingreso a orden:", error);
  }

  return numeroOrden;
}

/** Convierte un presupuesto en orden de trabajo, o procesa el ingreso de origen si existía uno. Devuelve el ID de la orden resultante. */
export async function convertirPresupuestoAOrden(presupuestoId: string): Promise<string> {
  const presupuestoRef = doc(db, "ordenesTrabajo", presupuestoId);
  const presupuestoSnap = await getDoc(presupuestoRef);

  if (!presupuestoSnap.exists()) {
    throw new Error("PRESUPUESTO_NO_ENCONTRADO");
  }

  const presupuesto = { id: presupuestoSnap.id, ...presupuestoSnap.data() } as OrdenTrabajo;

  // 1. Si este presupuesto fue creado a partir de un ingreso previo
  const ingresoOrigen = await getIngresoOrigenDePresupuesto(presupuesto);
  if (ingresoOrigen?.id) {
    await convertirIngresoAOrden(ingresoOrigen.id);
    await updateDoc(presupuestoRef, {
      presupuestoConfirmadoPorCliente: true,
      updatedAt: serverTimestamp(),
    });
    return ingresoOrigen.id;
  }

  // 2. Si el presupuesto fue creado directamente:
  // Marcar el presupuesto como aprobado (mantiene esCotizacion: true para seguir en /presupuestos)
  await updateDoc(presupuestoRef, {
    presupuestoConfirmadoPorCliente: true,
    updatedAt: serverTimestamp(),
  });

  // Si ya existía una orden de trabajo vinculada anteriormente, devolver esa orden
  const ordenExistente = await getOrdenVinculadaAPresupuesto(presupuesto);
  if (ordenExistente?.id && ordenExistente.id !== presupuestoId) {
    return ordenExistente.id;
  }

  // Crear un nuevo documento de Orden de Trabajo en ordenesTrabajo
  const numeroOrden = await getProximoNumeroDocumento("orden");
  const nuevaOrdenData: Omit<OrdenTrabajo, "id"> = {
    vehiculoId: presupuesto.vehiculoId,
    clienteId: presupuesto.clienteId,
    numero: numeroOrden,
    numeroOrden: numeroOrden,
    numeroCotizacion: presupuesto.numeroCotizacion || presupuesto.numero,
    presupuestoId: presupuestoId,
    estado: "En Reparación",
    tipoServicio: presupuesto.tipoServicio || "Mantenimiento",
    motivo: presupuesto.motivo || `Presupuesto #PRE-${String(presupuesto.numeroCotizacion || presupuesto.numero || 0).padStart(4, "0")} aprobado`,
    kilometrajeIngreso: presupuesto.kilometrajeIngreso || 0,
    nivelCombustible: presupuesto.nivelCombustible || "1/4",
    checklistInventario: presupuesto.checklistInventario || [],
    inspeccionVisual: presupuesto.inspeccionVisual || { abolladuras: [], rayones: [], roturas: [], notas: "" },
    descuento: presupuesto.descuento || 0,
    presupuestoConfirmadoPorCliente: true,
    esCotizacion: false,
    createdAt: serverTimestamp() as unknown as Timestamp,
    updatedAt: serverTimestamp() as unknown as Timestamp,
  };

  const nuevaOrdenRef = await addDoc(collection(db, "ordenesTrabajo"), removeUndefinedFields(nuevaOrdenData));
  const nuevaOrdenId = nuevaOrdenRef.id;

  // Copiar ítems del presupuesto a la nueva orden de trabajo
  const itemsPresupuesto = await getItemsOrden(presupuestoId);
  if (itemsPresupuesto.length > 0) {
    const batch = writeBatch(db);
    itemsPresupuesto.forEach((item) => {
      const newItemRef = doc(collection(db, "ordenesTrabajo", nuevaOrdenId, "itemsOrden"));
      const { id, ...itemData } = item;
      batch.set(newItemRef, {
        ...itemData,
        ordenId: nuevaOrdenId,
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();

    // Descontar stock para productos del presupuesto
    try {
      await runTransaction(db, async (transaction) => {
        await aplicarMovimientosStockOrden(
          transaction,
          itemsPresupuesto
            .filter(itemDescuentaStock)
            .map((item) => ({
              item,
              cantidadDelta: -getCantidadStock(item.cantidad),
              nota: `Aprobación de cotización #PRE-${String(presupuesto.numeroCotizacion || presupuesto.numero || 0).padStart(4, "0")} a orden #OT-${String(numeroOrden).padStart(4, "0")}`,
            }))
        );
      });
    } catch (stockErr) {
      console.error("Error al descontar stock al aprobar presupuesto:", stockErr);
    }
  }

  return nuevaOrdenId;
}

/** Busca presupuestos activos (cotización) para un vehículo específico. */
export async function getPresupuestosPendientesByVehiculo(vehiculoId: string): Promise<OrdenTrabajo[]> {
  if (!vehiculoId) return [];
  const snap = await getDocs(
    query(
      collection(db, "ordenesTrabajo"),
      where("esCotizacion", "==", true),
      where("vehiculoId", "==", vehiculoId)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrdenTrabajo));
}

/** Busca la Orden de Trabajo vinculada a un Presupuesto (si existe). */
export async function getOrdenVinculadaAPresupuesto(presupuesto: OrdenTrabajo): Promise<OrdenTrabajo | null> {
  if (!presupuesto.id) return null;

  // 1. Si el presupuesto mismo fue convertido a orden en esquema previo (esCotizacion === false)
  if (presupuesto.esCotizacion === false) {
    return presupuesto;
  }

  // 2. Si proviene de un ingreso que fue convertido a orden
  const ingresoOrigen = await getIngresoOrigenDePresupuesto(presupuesto);
  if (ingresoOrigen && (ingresoOrigen.numeroOrden || (ingresoOrigen.esCotizacion === false && ingresoOrigen.numero))) {
    return ingresoOrigen;
  }

  // 3. Buscar si existe alguna orden de trabajo vinculada por presupuestoId o por vehículo
  if (presupuesto.vehiculoId || presupuesto.id) {
    const numCotizacion = presupuesto.numeroCotizacion || presupuesto.numero;
    const snap = await getDocs(
      query(
        collection(db, "ordenesTrabajo"),
        where("esCotizacion", "==", false),
        where("vehiculoId", "==", presupuesto.vehiculoId)
      )
    );
    const ordenes = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrdenTrabajo));
    const numStr = numCotizacion ? String(numCotizacion) : null;
    const found = ordenes.find((o) => 
      (presupuesto.id && o.presupuestoId === presupuesto.id) ||
      (numStr && String(o.motivo || "").includes(numStr)) ||
      (o.numeroIngreso && String(presupuesto.motivo || "").includes(String(o.numeroIngreso))) ||
      (presupuesto.presupuestoConfirmadoPorCliente && o.estado !== "Borrador")
    );
    if (found) return found;
  }

  return null;
}

export async function updateOrden(id: string, data: Partial<OrdenTrabajo>): Promise<void> {
  const numeroOrdenConversion =
    data.esCotizacion === false && data.numero === undefined
      ? await getProximoNumeroDocumento("orden")
      : undefined;

  if (data.esCotizacion === false) {
    const items = await getItemsOrden(id);
    const ordenRef = doc(db, "ordenesTrabajo", id);

    await runTransaction(db, async (transaction) => {
      const ordenSnap = await transaction.get(ordenRef);
      if (!ordenSnap.exists()) throw new Error("ORDEN_NO_ENCONTRADA");
      const ordenActual = ordenSnap.data() as OrdenTrabajo;

      if (ordenActual.esCotizacion) {
        await aplicarMovimientosStockOrden(
          transaction,
          items
            .filter(itemDescuentaStock)
            .map((item) => ({
              item,
              cantidadDelta: -getCantidadStock(item.cantidad),
              nota: `Conversión de cotización a orden #OT ${String(numeroOrdenConversion ?? ordenActual.numero ?? id).padStart(4, "0")}`,
            }))
        );
      }

      transaction.update(ordenRef, {
        ...removeUndefinedFields(data),
        ...(ordenActual.esCotizacion && numeroOrdenConversion !== undefined
          ? { numero: numeroOrdenConversion }
          : {}),
        updatedAt: serverTimestamp(),
      });
    });
    return;
  }

  await updateDoc(doc(db, "ordenesTrabajo", id), {
    ...removeUndefinedFields(data),
    updatedAt: serverTimestamp(),
  });
}

export async function updateEstadoOrden(id: string, estado: EstadoOrden): Promise<void> {
  const update: Record<string, unknown> = { estado, updatedAt: serverTimestamp() };
  if (estado === "Entregada") update.fechaEntrega = serverTimestamp();
  await updateDoc(doc(db, "ordenesTrabajo", id), update);
}

type MovimientoStockOrden = {
  item: Partial<ItemOrden> & { productoId: string };
  cantidadDelta: number;
  nota: string;
};

type AplicarMovimientosStockOrdenOptions = {
  omitirProductosEliminados?: boolean;
};

async function aplicarMovimientosStockOrden(
  transaction: Transaction,
  movimientos: MovimientoStockOrden[],
  options: AplicarMovimientosStockOrdenOptions = {}
): Promise<void> {
  const movimientosAgrupados = Array.from(
    movimientos.reduce((acc, movimiento) => {
      const cantidadDelta = getCantidadStock(Math.abs(movimiento.cantidadDelta)) * Math.sign(movimiento.cantidadDelta);
      if (cantidadDelta === 0) return acc;

      const current = acc.get(movimiento.item.productoId);
      if (current) {
        current.cantidadDelta += cantidadDelta;
        current.nota = `${current.nota}; ${movimiento.nota}`;
      } else {
        acc.set(movimiento.item.productoId, { ...movimiento, cantidadDelta });
      }
      return acc;
    }, new Map<string, MovimientoStockOrden>()).values()
  );

  const productoSnaps = await Promise.all(
    movimientosAgrupados.map((movimiento) => transaction.get(doc(db, "productos", movimiento.item.productoId)))
  );

  movimientosAgrupados.forEach((movimiento, index) => {
    const productoSnap = productoSnaps[index];
    if (!productoSnap.exists()) {
      if (options.omitirProductosEliminados && movimiento.cantidadDelta > 0) return;
      throw new Error("PRODUCTO_NO_ENCONTRADO");
    }

    const cantidad = getCantidadStock(Math.abs(movimiento.cantidadDelta));
    const producto = { id: productoSnap.id, ...productoSnap.data() } as Producto;
    const stockAnterior = getCantidadStock(producto.stockActual);
    const stockNuevo = stockAnterior + movimiento.cantidadDelta;
    if (stockNuevo < 0) throw new Error("STOCK_INSUFICIENTE");

    transaction.update(productoSnap.ref, {
      stockActual: stockNuevo,
      updatedAt: serverTimestamp(),
    });
    transaction.set(doc(collection(db, "movimientosStock")), {
      productoId: productoSnap.id,
      productoNombre: producto.nombre,
      sku: producto.sku,
      tipo: movimiento.cantidadDelta < 0 ? "salida" : "entrada",
      cantidad,
      stockAnterior,
      stockNuevo,
      nota: movimiento.nota,
      unidadMedida: producto.unidadMedida ?? "",
      createdAt: serverTimestamp(),
    } satisfies Omit<MovimientoStock, "id" | "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> });
  });
}

async function aplicarMovimientoStockOrden(
  transaction: Transaction,
  item: Partial<ItemOrden> & { productoId: string },
  cantidadDelta: number,
  nota: string,
  options?: AplicarMovimientosStockOrdenOptions
): Promise<void> {
  await aplicarMovimientosStockOrden(transaction, [{ item, cantidadDelta, nota }], options);
}

export async function deleteOrden(id: string): Promise<void> {
  const items = await getItemsOrden(id);
  const orden = await getOrdenById(id);
  const pagos = await getPagos(id);

  await runTransaction(db, async (transaction) => {
    const ordenRef = doc(db, "ordenesTrabajo", id);
    const ordenSnap = await transaction.get(ordenRef);
    if (!ordenSnap.exists()) return;
    const ordenActual = ordenSnap.data() as OrdenTrabajo;

    if (!ordenActual.esCotizacion) {
      await aplicarMovimientosStockOrden(
        transaction,
        items
          .filter(itemDescuentaStock)
          .map((item) => ({
            item,
            cantidadDelta: getCantidadStock(item.cantidad),
            nota: `Reversa por eliminar orden #OT ${String(orden?.numeroOrden ?? orden?.numero ?? id).padStart(4, "0")}`,
          })),
        { omitirProductosEliminados: true }
      );
    }

    items.forEach((item) => {
      if (item.id) transaction.delete(doc(db, "ordenesTrabajo", id, "itemsOrden", item.id));
    });
    pagos.forEach((p) => {
      if (p.id) transaction.delete(doc(db, "pagos", p.id));
    });
    transaction.delete(ordenRef);
  });

  if (orden?.fotoUrls?.length) {
    await Promise.allSettled(orden.fotoUrls.map((url) => deleteOrdenFoto(url)));
  }
}

// ─── ITEMS DE ORDEN ───────────────────────────────────────────────────────────
export async function getItemsOrden(ordenId: string): Promise<ItemOrden[]> {
  const snap = await getDocs(
    collection(db, "ordenesTrabajo", ordenId, "itemsOrden")
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ItemOrden));
}

export async function addItemOrden(ordenId: string, item: Omit<ItemOrden, "id">): Promise<string> {
  const itemRef = doc(collection(db, "ordenesTrabajo", ordenId, "itemsOrden"));
  const ordenRef = doc(db, "ordenesTrabajo", ordenId);

  await runTransaction(db, async (transaction) => {
    const ordenSnap = await transaction.get(ordenRef);
    if (!ordenSnap.exists()) throw new Error("ORDEN_NO_ENCONTRADA");
    const orden = ordenSnap.data() as OrdenTrabajo;

    if (!orden.esCotizacion && itemDescuentaStock(item)) {
      await aplicarMovimientoStockOrden(
        transaction,
        item,
        -getCantidadStock(item.cantidad),
        `Salida por orden #OT ${String(orden.numeroOrden ?? orden.numero ?? ordenId).padStart(4, "0")}`
      );
    }

    transaction.set(itemRef, {
      ...removeUndefinedFields(item),
      createdAt: serverTimestamp(),
    });
  });
  return itemRef.id;
}

export async function updateItemOrden(ordenId: string, itemId: string, data: Partial<ItemOrden>): Promise<void> {
  const ordenRef = doc(db, "ordenesTrabajo", ordenId);
  const itemRef = doc(db, "ordenesTrabajo", ordenId, "itemsOrden", itemId);

  await runTransaction(db, async (transaction) => {
    const [ordenSnap, itemSnap] = await Promise.all([
      transaction.get(ordenRef),
      transaction.get(itemRef),
    ]);
    if (!ordenSnap.exists()) throw new Error("ORDEN_NO_ENCONTRADA");
    if (!itemSnap.exists()) throw new Error("ITEM_NO_ENCONTRADO");

    const orden = ordenSnap.data() as OrdenTrabajo;
    const itemActual = { id: itemSnap.id, ...itemSnap.data() } as ItemOrden;
    const itemSiguiente = { ...itemActual, ...data };

    if (!orden.esCotizacion && itemDescuentaStock(itemSiguiente) && data.cantidad !== undefined) {
      const diferencia = getCantidadStock(data.cantidad) - getCantidadStock(itemActual.cantidad);
      if (diferencia !== 0) {
        await aplicarMovimientoStockOrden(
          transaction,
          itemSiguiente,
          -diferencia,
          `Ajuste de cantidad en orden #OT ${String(orden.numeroOrden ?? orden.numero ?? ordenId).padStart(4, "0")}`
        );
      }
    }

    transaction.update(itemRef, removeUndefinedFields(data));
  });
}

export async function deleteItemOrden(ordenId: string, itemId: string): Promise<void> {
  const ordenRef = doc(db, "ordenesTrabajo", ordenId);
  const itemRef = doc(db, "ordenesTrabajo", ordenId, "itemsOrden", itemId);

  await runTransaction(db, async (transaction) => {
    const [ordenSnap, itemSnap] = await Promise.all([
      transaction.get(ordenRef),
      transaction.get(itemRef),
    ]);
    if (!ordenSnap.exists()) throw new Error("ORDEN_NO_ENCONTRADA");
    if (!itemSnap.exists()) return;

    const orden = ordenSnap.data() as OrdenTrabajo;
    const item = { id: itemSnap.id, ...itemSnap.data() } as ItemOrden;

    if (!orden.esCotizacion && itemDescuentaStock(item)) {
      await aplicarMovimientoStockOrden(
        transaction,
        item,
        getCantidadStock(item.cantidad),
        `Reversa por eliminar ítem de orden #OT ${String(orden.numeroOrden ?? orden.numero ?? ordenId).padStart(4, "0")}`,
        { omitirProductosEliminados: true }
      );
    }

    transaction.delete(itemRef);
  });
}

// ─── PAGOS ────────────────────────────────────────────────────────────────────
// ─── DEVOLUCIONES ────────────────────────────────────────────────────────────
export async function getDevoluciones(): Promise<Devolucion[]> {
  const snap = await getDocs(query(collection(db, "devoluciones"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Devolucion));
}

export async function getDevolucionesByOrden(ordenId: string): Promise<Devolucion[]> {
  const snap = await getDocs(
    query(collection(db, "devoluciones"), where("ordenId", "==", ordenId))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Devolucion))
    .sort((a, b) => {
      const aTime = a.createdAt?.toDate?.().getTime() ?? 0;
      const bTime = b.createdAt?.toDate?.().getTime() ?? 0;
      return bTime - aTime;
    });
}

export async function createDevolucion(data: {
  ordenId: string;
  itemOrdenId: string;
  cantidad: number;
  motivo: string;
  accionInventario: AccionInventarioDevolucion;
  montoDevuelto?: number;
  metodoDevolucion?: Devolucion["metodoDevolucion"];
  clienteNombre?: string;
  vehiculoPlaca?: string;
  notas?: string;
}): Promise<string> {
  const cantidad = getCantidadStock(data.cantidad);
  if (cantidad <= 0) throw new Error("CANTIDAD_INVALIDA");
  if (!data.motivo.trim()) throw new Error("MOTIVO_REQUERIDO");

  const devolucionesExistentes = await getDevolucionesByOrden(data.ordenId);
  const cantidadDevuelta = devolucionesExistentes
    .filter((devolucion) => devolucion.itemOrdenId === data.itemOrdenId)
    .reduce((sum, devolucion) => sum + getCantidadStock(devolucion.cantidad), 0);

  const devolucionRef = doc(collection(db, "devoluciones"));
  const ordenRef = doc(db, "ordenesTrabajo", data.ordenId);
  const itemRef = doc(db, "ordenesTrabajo", data.ordenId, "itemsOrden", data.itemOrdenId);

  await runTransaction(db, async (transaction) => {
    const [ordenSnap, itemSnap] = await Promise.all([
      transaction.get(ordenRef),
      transaction.get(itemRef),
    ]);
    if (!ordenSnap.exists()) throw new Error("ORDEN_NO_ENCONTRADA");
    if (!itemSnap.exists()) throw new Error("ITEM_NO_ENCONTRADO");

    const orden = { id: ordenSnap.id, ...ordenSnap.data() } as OrdenTrabajo;
    const item = { id: itemSnap.id, ...itemSnap.data() } as ItemOrden;
    if (!itemDescuentaStock(item)) throw new Error("ITEM_NO_DEVOLVIBLE");
    if (cantidadDevuelta + cantidad > getCantidadStock(item.cantidad)) {
      throw new Error("DEVOLUCION_EXCEDE_CANTIDAD");
    }

    const subtotalDevuelto = calcularSubtotalItem(cantidad, item.precioUnitario, item.impuestoAplicable);
    const payload: Omit<Devolucion, "id" | "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> } = {
      ordenId: data.ordenId,
      numeroOrden: orden.numero,
      clienteId: orden.clienteId,
      clienteNombre: data.clienteNombre ?? [orden.cliente?.nombre, orden.cliente?.apellido].filter(Boolean).join(" "),
      vehiculoId: orden.vehiculoId,
      vehiculoPlaca: data.vehiculoPlaca ?? orden.vehiculo?.placa,
      itemOrdenId: data.itemOrdenId,
      productoId: item.productoId,
      productoSku: item.productoSku ?? "",
      productoNombre: item.productoNombre ?? item.descripcion,
      cantidad,
      precioUnitario: item.precioUnitario,
      impuestoAplicable: item.impuestoAplicable,
      subtotalDevuelto,
      motivo: data.motivo.trim(),
      accionInventario: data.accionInventario,
      estado: "registrada",
      montoDevuelto: Number(data.montoDevuelto ?? subtotalDevuelto),
      metodoDevolucion: data.metodoDevolucion,
      notas: data.notas?.trim() || undefined,
      createdAt: serverTimestamp(),
    };

    if (data.accionInventario === "reingresar_stock") {
      await aplicarMovimientoStockOrden(
        transaction,
        item,
        cantidad,
        `Devolución de cliente - orden #OT ${String(orden.numeroOrden ?? orden.numero ?? data.ordenId).padStart(4, "0")}: ${data.motivo.trim()}`
      );
    }

    transaction.set(devolucionRef, removeUndefinedFields(payload));
  });

  return devolucionRef.id;
}

export async function getPagos(ordenId: string): Promise<Pago[]> {
  const snap = await getDocs(
    query(
      collection(db, "pagos"),
      where("ordenId", "==", ordenId),
      orderBy("createdAt", "asc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pago));
}

export async function getTodosPagos(): Promise<Pago[]> {
  const snap = await getDocs(query(collection(db, "pagos"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pago));
}

export async function createPago(pago: Omit<Pago, "id">): Promise<string> {
  const data = Object.fromEntries(
    Object.entries(pago).filter(([, value]) => value !== undefined)
  );
  const ref = await addDoc(collection(db, "pagos"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deletePago(id: string): Promise<void> {
  await deleteDoc(doc(db, "pagos", id));
}

// ─── USUARIOS ────────────────────────────────────────────────────────────────
export async function getUsuarios(): Promise<AppUser[]> {
  const snap = await getDocs(query(collection(db, "usuarios"), orderBy("displayName")));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      uid: String(data.uid ?? d.id),
      email: String(data.email ?? ""),
      displayName: String(data.displayName ?? ""),
      role: data.role,
      photoURL: data.photoURL,
      activo: Boolean(data.activo),
      createdAt: data.createdAt,
    } as AppUser;
  });
}

export async function createUsuarioDB(uid: string, data: Omit<AppUser, "id" | "uid" | "createdAt">): Promise<void> {
  await setDoc(doc(db, "usuarios", uid), { uid, ...data, createdAt: serverTimestamp() });
}

export async function getUsuarioByUid(uid: string): Promise<AppUser | null> {
  const snap = await getDocs(query(collection(db, "usuarios"), where("uid", "==", uid)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, uid: d.data().uid, ...d.data() } as AppUser;
}

export async function updateUsuario(id: string, data: Partial<Omit<AppUser, "id" | "uid" | "createdAt">>): Promise<void> {
  await updateDoc(doc(db, "usuarios", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteUsuario(id: string): Promise<void> {
  await deleteDoc(doc(db, "usuarios", id));
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────
export async function uploadOrdenFoto(ordenId: string, file: File): Promise<string> {
  const path = `ordenes/${ordenId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadDanoFoto(file: File): Promise<string> {
  const path = `danos_fotos/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function deleteOrdenFoto(url: string): Promise<void> {
  const storageRef = ref(storage, url);
  await deleteObject(storageRef);
}

// ─── INVENTARIO (PRODUCTOS Y SERVICIOS) ───────────────────────────────────────
export async function getProductos(): Promise<Producto[]> {
  const snap = await getDocs(query(collection(db, "productos"), orderBy("nombre")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Producto));
}

export async function getProductoBySku(sku: string): Promise<Producto | null> {
  const value = sku.trim().toUpperCase();
  if (!value) return null;
  const snap = await getDocs(query(collection(db, "productos"), where("sku", "==", value)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Producto;
}

export async function createProducto(data: Omit<Producto, "id">): Promise<string> {
  const margenGanancia = normalizarMargenGanancia(data.margenGanancia);
  const ref = await addDoc(
    collection(db, "productos"),
    removeUndefinedFields({
      ...data,
      margenGanancia,
      precioBase: calcularPrecioVenta(data.costoBase, margenGanancia, data.aplicaIva),
      sku: data.sku.trim().toUpperCase(),
      stockActual: Math.floor(Number(data.stockActual ?? 0)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return ref.id;
}

export async function updateProducto(id: string, data: Partial<Producto>): Promise<void> {
  const payload: Partial<Producto> = { ...data };
  if (typeof payload.sku === "string") payload.sku = payload.sku.trim().toUpperCase();
  if (payload.costoBase !== undefined || payload.margenGanancia !== undefined || payload.aplicaIva !== undefined) {
    let current: Producto | null = null;
    if (payload.costoBase === undefined || payload.margenGanancia === undefined || payload.aplicaIva === undefined) {
      const snap = await getDoc(doc(db, "productos", id));
      current = snap.exists() ? ({ id: snap.id, ...snap.data() } as Producto) : null;
    }
    const margenGanancia =
      payload.margenGanancia !== undefined
        ? normalizarMargenGanancia(payload.margenGanancia)
        : resolverMargenProducto(current);
    const costoBase = Number(payload.costoBase ?? current?.costoBase ?? 0);
    const aplicaIva = Boolean(payload.aplicaIva ?? current?.aplicaIva ?? false);
    payload.margenGanancia = margenGanancia;
    payload.precioBase = calcularPrecioVenta(costoBase, margenGanancia, aplicaIva);
  }
  await updateDoc(
    doc(db, "productos", id),
    removeUndefinedFields({ ...payload, updatedAt: serverTimestamp() })
  );
}

export async function registrarMovimientoStockManual(
  producto: Producto,
  tipo: MovimientoStock["tipo"],
  cantidad: number,
  nota?: string
): Promise<number> {
  if (!producto.id) throw new Error("PRODUCTO_SIN_ID");
  const stockAnterior = Math.floor(Number(producto.stockActual ?? 0));
  const stockNuevo = tipo === "entrada" ? stockAnterior + cantidad : stockAnterior - cantidad;
  if (stockNuevo < 0) throw new Error("STOCK_INSUFICIENTE");

  const batch = writeBatch(db);
  batch.update(doc(db, "productos", producto.id), {
    stockActual: stockNuevo,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(db, "movimientosStock")), {
    productoId: producto.id,
    productoNombre: producto.nombre,
    sku: producto.sku,
    tipo,
    cantidad,
    stockAnterior,
    stockNuevo,
    nota: nota?.trim() ?? "",
    unidadMedida: producto.unidadMedida ?? "",
    createdAt: serverTimestamp(),
  } satisfies Omit<MovimientoStock, "id" | "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> });
  await batch.commit();

  return stockNuevo;
}

export async function deleteProducto(id: string): Promise<void> {
  await deleteDoc(doc(db, "productos", id));
}

export async function getMovimientosStockByProducto(productoId: string): Promise<MovimientoStock[]> {
  const snap = await getDocs(
    query(
      collection(db, "movimientosStock"),
      where("productoId", "==", productoId)
    )
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as MovimientoStock))
    .sort((a, b) => {
      const aTime = a.createdAt && typeof a.createdAt === "object" && "seconds" in a.createdAt
        ? Number((a.createdAt as { seconds?: number }).seconds ?? 0)
        : 0;
      const bTime = b.createdAt && typeof b.createdAt === "object" && "seconds" in b.createdAt
        ? Number((b.createdAt as { seconds?: number }).seconds ?? 0)
        : 0;
      return bTime - aTime;
    });
}

export async function getHistorialPrecios(productoId: string): Promise<Array<{ id: string; createdAt?: unknown; costoBase?: number; margenGanancia?: number; precioBase?: number }>> {
  const snap = await getDocs(
    query(
      collection(db, "historialPrecios"),
      where("productoId", "==", productoId)
    )
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .sort((a, b) => {
      const aTime = a.createdAt && typeof a.createdAt === "object" && "seconds" in a.createdAt
        ? Number((a.createdAt as { seconds?: number }).seconds ?? 0)
        : 0;
      const bTime = b.createdAt && typeof b.createdAt === "object" && "seconds" in b.createdAt
        ? Number((b.createdAt as { seconds?: number }).seconds ?? 0)
        : 0;
      return bTime - aTime;
    });
}

export async function getServicios(): Promise<Servicio[]> {
  const snap = await getDocs(query(collection(db, "servicios"), orderBy("nombre")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Servicio));
}

export async function createServicio(data: Omit<Servicio, "id">): Promise<string> {
  const ref = await addDoc(
    collection(db, "servicios"),
    removeUndefinedFields({
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return ref.id;
}

export async function updateServicio(id: string, data: Partial<Servicio>): Promise<void> {
  await updateDoc(
    doc(db, "servicios", id),
    removeUndefinedFields({ ...data, updatedAt: serverTimestamp() })
  );
}

export async function deleteServicio(id: string): Promise<void> {
  await deleteDoc(doc(db, "servicios", id));
}

export async function uploadInventarioImagen(id: string, file: File, tipo: "producto" | "servicio"): Promise<string> {
  const path = `inventario/${tipo}/${id}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ─── IMÁGENES DE VISTAS DE VEHÍCULOS ───────────────────────────────────────
export async function getCompras(): Promise<Compra[]> {
  const snap = await getDocs(query(collection(db, "compras"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Compra));
}

export async function getCompraByClaveAcceso(claveAcceso: string): Promise<Compra | null> {
  const value = claveAcceso.trim();
  if (!value) return null;
  const snap = await getDocs(query(collection(db, "compras"), where("claveAcceso", "==", value)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Compra;
}

export async function createCompra(data: Omit<Compra, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "compras"), {
    ...sanitizeCompraPayload(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

function calcularEstadoPagoCompra(total: number, pagado: number, devuelto = 0): Compra["estadoPagoProveedor"] {
  const saldo = Math.max(total - pagado - devuelto, 0);
  if (saldo <= 0.01) return "pagado";
  if (pagado > 0.01) return "parcial";
  return "pendiente";
}

function sanitizeCompraPago(pago: CompraPago): CompraPago {
  const data: CompraPago = {
    monto: Number(pago.monto || 0),
    metodoPago: pago.metodoPago,
  };
  const banco = pago.banco?.trim();
  const referencia = pago.referencia?.trim();
  const notas = pago.notas?.trim();
  if (banco) data.banco = banco;
  if (referencia) data.referencia = referencia;
  if (notas) data.notas = notas;
  if (pago.fecha) data.fecha = pago.fecha;
  if (pago.createdAt) data.createdAt = pago.createdAt;
  return data;
}

function sanitizeCompraPayload<T extends Omit<Compra, "id">>(data: T): T {
  return {
    ...data,
    pagosProveedor: data.pagosProveedor?.map(sanitizeCompraPago),
  };
}

function sanitizeGmailXmlDraftPayload(
  data: Omit<GmailXmlDraft, "id" | "createdAt" | "updatedAt">
): Omit<GmailXmlDraft, "id" | "createdAt" | "updatedAt"> {
  const payload: Omit<GmailXmlDraft, "id" | "createdAt" | "updatedAt"> = {
    compra: sanitizeCompraPayload(data.compra),
    pagos: data.pagos.map(sanitizeCompraPago),
    estado: data.estado,
  };
  if (data.gmailMessageId) payload.gmailMessageId = data.gmailMessageId;
  if (data.compraId) payload.compraId = data.compraId;
  return payload;
}

export async function getGmailXmlDrafts(): Promise<GmailXmlDraft[]> {
  const snap = await getDocs(query(collection(db, "gmailXmlDrafts"), orderBy("updatedAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GmailXmlDraft));
}

export async function upsertGmailXmlDraft(
  data: Omit<GmailXmlDraft, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const id = data.compra.claveAcceso.trim();
  if (!id) throw new Error("GMAIL_XML_SIN_CLAVE_ACCESO");

  const ref = doc(db, "gmailXmlDrafts", id);
  const snap = await getDoc(ref);
  const payload: Record<string, unknown> = {
    ...sanitizeGmailXmlDraftPayload(data),
    updatedAt: serverTimestamp(),
  };
  if (!snap.exists()) payload.createdAt = serverTimestamp();
  await setDoc(ref, payload, { merge: true });
  return id;
}

export async function updateGmailXmlDraftStatus(
  id: string,
  estado: GmailXmlDraftStatus,
  compraId?: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    estado,
    updatedAt: serverTimestamp(),
  };
  if (compraId) payload.compraId = compraId;
  await updateDoc(doc(db, "gmailXmlDrafts", id), payload);
}

export async function updateCompraPagos(
  compraId: string,
  pagosProveedor: CompraPago[],
  importeTotal: number,
  totalDevueltoProveedor = 0
): Promise<void> {
  const pagosLimpios = pagosProveedor.map(sanitizeCompraPago);
  const totalPagadoProveedor = Number(
    pagosLimpios.reduce((sum, pago) => sum + Number(pago.monto || 0), 0).toFixed(2)
  );
  const saldoProveedor = Number(Math.max(importeTotal - totalPagadoProveedor - totalDevueltoProveedor, 0).toFixed(2));
  await updateDoc(doc(db, "compras", compraId), {
    pagosProveedor: pagosLimpios,
    totalPagadoProveedor,
    totalDevueltoProveedor,
    saldoProveedor,
    estadoPagoProveedor: calcularEstadoPagoCompra(importeTotal, totalPagadoProveedor, totalDevueltoProveedor),
    updatedAt: serverTimestamp(),
  });
}

export async function getDevolucionesProveedor(): Promise<DevolucionProveedor[]> {
  const snap = await getDocs(query(collection(db, "devolucionesProveedor"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DevolucionProveedor));
}

export async function getDevolucionesProveedorByCompra(compraId: string): Promise<DevolucionProveedor[]> {
  const snap = await getDocs(
    query(collection(db, "devolucionesProveedor"), where("compraId", "==", compraId))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as DevolucionProveedor))
    .sort((a, b) => {
      const aTime = a.createdAt?.toDate?.().getTime() ?? 0;
      const bTime = b.createdAt?.toDate?.().getTime() ?? 0;
      return bTime - aTime;
    });
}

export async function createDevolucionProveedor(data: {
  compraId: string;
  itemIndex: number;
  cantidad: number;
  motivo: string;
  metodoDevolucion: DevolucionProveedor["metodoDevolucion"];
  banco?: string;
  referencia?: string;
  notas?: string;
}): Promise<string> {
  const cantidad = Number(data.cantidad || 0);
  if (!data.compraId) throw new Error("COMPRA_SIN_ID");
  if (!Number.isFinite(cantidad) || cantidad <= 0) throw new Error("CANTIDAD_INVALIDA");
  if (!data.motivo.trim()) throw new Error("MOTIVO_REQUERIDO");
  if (data.metodoDevolucion === "transferencia" && !data.banco?.trim()) throw new Error("BANCO_REQUERIDO");

  const compraRef = doc(db, "compras", data.compraId);
  const compraSnap = await getDoc(compraRef);
  if (!compraSnap.exists()) throw new Error("COMPRA_NO_ENCONTRADA");

  const compra = { id: compraSnap.id, ...compraSnap.data() } as Compra;
  if (!compra.inventarioSincronizado) throw new Error("COMPRA_NO_SINCRONIZADA");

  const item = compra.items[data.itemIndex];
  if (!item) throw new Error("ITEM_NO_ENCONTRADO");
  const sku = item.codigo.trim().toUpperCase();
  if (!sku) throw new Error("ITEM_SIN_CODIGO");

  const devolucionesExistentes = await getDevolucionesProveedorByCompra(data.compraId);
  const cantidadDevuelta = devolucionesExistentes
    .filter((devolucion) => devolucion.itemIndex === data.itemIndex)
    .reduce((sum, devolucion) => sum + Number(devolucion.cantidad || 0), 0);
  if (cantidadDevuelta + cantidad > Number(item.cantidad || 0) + 0.0001) {
    throw new Error("DEVOLUCION_EXCEDE_CANTIDAD");
  }

  const producto = await getProductoBySku(sku);
  if (!producto?.id) throw new Error("PRODUCTO_NO_ENCONTRADO");

  const productoRef = doc(db, "productos", producto.id);
  const devolucionRef = doc(collection(db, "devolucionesProveedor"));
  const impuestoUnitario = Number(item.impuesto || 0) / Math.max(Number(item.cantidad || 0), 1);
  const subtotalDevuelto = Number(((Number(item.precioUnitario || 0) + impuestoUnitario) * cantidad).toFixed(2));

  await runTransaction(db, async (transaction) => {
    const [freshCompraSnap, freshProductoSnap] = await Promise.all([
      transaction.get(compraRef),
      transaction.get(productoRef),
    ]);
    if (!freshCompraSnap.exists()) throw new Error("COMPRA_NO_ENCONTRADA");
    if (!freshProductoSnap.exists()) throw new Error("PRODUCTO_NO_ENCONTRADO");

    const freshCompra = { id: freshCompraSnap.id, ...freshCompraSnap.data() } as Compra;
    const freshProducto = { id: freshProductoSnap.id, ...freshProductoSnap.data() } as Producto;
    const stockAnterior = Number(freshProducto.stockActual ?? 0);
    const stockNuevo = stockAnterior - cantidad;
    if (stockNuevo < -0.0001) throw new Error("STOCK_INSUFICIENTE");

    const payload: Omit<DevolucionProveedor, "id" | "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> } = {
      compraId: data.compraId,
      numeroFactura: freshCompra.numeroFactura,
      proveedorRazonSocial: freshCompra.proveedorRazonSocial,
      proveedorRuc: freshCompra.proveedorRuc,
      itemIndex: data.itemIndex,
      productoSku: sku,
      productoNombre: item.descripcion,
      cantidad,
      precioUnitario: Number(item.precioUnitario || 0),
      impuestoUnitario: Number(impuestoUnitario.toFixed(4)),
      subtotalDevuelto,
      motivo: data.motivo.trim(),
      metodoDevolucion: data.metodoDevolucion,
      banco: data.banco?.trim() || undefined,
      referencia: data.referencia?.trim() || undefined,
      notas: data.notas?.trim() || undefined,
      ajustoInventario: true,
      createdAt: serverTimestamp(),
    };

    const totalPagadoProveedor = Number(freshCompra.totalPagadoProveedor ?? 0);
    const totalDevueltoProveedor = Number(((freshCompra.totalDevueltoProveedor ?? 0) + subtotalDevuelto).toFixed(2));
    const saldoProveedor = Number(
      Math.max(Number(freshCompra.importeTotal || 0) - totalPagadoProveedor - totalDevueltoProveedor, 0).toFixed(2)
    );

    transaction.update(productoRef, {
      stockActual: stockNuevo,
      updatedAt: serverTimestamp(),
    });
    transaction.set(doc(collection(db, "movimientosStock")), {
      productoId: freshProducto.id,
      productoNombre: freshProducto.nombre,
      sku,
      tipo: "salida",
      cantidad,
      stockAnterior,
      stockNuevo,
      nota: `Devolucion a proveedor - factura ${freshCompra.numeroFactura}: ${data.motivo.trim()}`,
      unidadMedida: freshProducto.unidadMedida ?? "",
      createdAt: serverTimestamp(),
    });
    transaction.update(compraRef, {
      totalDevueltoProveedor,
      saldoProveedor,
      estadoPagoProveedor: calcularEstadoPagoCompra(freshCompra.importeTotal, totalPagadoProveedor, totalDevueltoProveedor),
      updatedAt: serverTimestamp(),
    });
    transaction.set(devolucionRef, removeUndefinedFields(payload));
  });

  return devolucionRef.id;
}

function nombreProductoDesdeDescripcion(descripcion: string, codigo: string): string {
  const withoutCode = descripcion.replace(new RegExp(`^\\[${codigo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\s*`, "i"), "");
  return (withoutCode || descripcion || codigo).trim();
}

async function agregarInventarioCompraABatch(
  batch: ReturnType<typeof writeBatch>,
  compraId: string,
  data: Omit<Compra, "id">
): Promise<Omit<CompraInventarioSyncResult, "compraId">> {
  let productosCreados = 0;
  let productosActualizados = 0;
  const itemsBySku = new Map<string, Compra["items"][number]>();

  for (const item of data.items) {
    const sku = item.codigo.trim().toUpperCase();
    if (!sku) continue;
    const current = itemsBySku.get(sku);
    if (current) {
      itemsBySku.set(sku, {
        ...item,
        codigo: sku,
        cantidad: current.cantidad + item.cantidad,
        descuento: current.descuento + item.descuento,
        subtotalSinImpuesto: current.subtotalSinImpuesto + item.subtotalSinImpuesto,
        impuesto: current.impuesto + item.impuesto,
        total: current.total + item.total,
      });
    } else {
      itemsBySku.set(sku, { ...item, codigo: sku });
    }
  }

  for (const item of itemsBySku.values()) {
    const sku = item.codigo;
    const existing = await getProductoBySku(sku);
    const margenGanancia = resolverMargenProducto(existing);
    const commonUpdate = {
      costoBase: item.precioUnitario,
      margenGanancia,
      aplicaIva: item.impuesto > 0,
      precioBase: calcularPrecioVenta(item.precioUnitario, margenGanancia, item.impuesto > 0),
      ultimaCompraId: compraId,
      ultimaCompraFactura: data.numeroFactura,
      ultimaCompraFecha: data.fechaEmision,
      ultimoProveedorRuc: data.proveedorRuc,
      ultimoProveedorNombre: data.proveedorRazonSocial,
      updatedAt: serverTimestamp(),
    };

    if (existing?.id) {
      batch.update(doc(db, "productos", existing.id), {
        ...commonUpdate,
        stockActual: increment(item.cantidad),
      });
      productosActualizados += 1;
    } else {
      batch.set(doc(collection(db, "productos")), {
        nombre: nombreProductoDesdeDescripcion(item.descripcion, sku),
        descripcion: item.descripcion,
        precioBase: calcularPrecioVenta(item.precioUnitario, margenGanancia, item.impuesto > 0),
        costoBase: item.precioUnitario,
        margenGanancia,
        aplicaIva: item.impuesto > 0,
        sku,
        stockActual: item.cantidad,
        ultimaCompraId: compraId,
        ultimaCompraFactura: data.numeroFactura,
        ultimaCompraFecha: data.fechaEmision,
        ultimoProveedorRuc: data.proveedorRuc,
        ultimoProveedorNombre: data.proveedorRazonSocial,
        imagenUrl: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      productosCreados += 1;
    }
  }

  return { productosCreados, productosActualizados };
}

export async function createCompraConInventario(data: Omit<Compra, "id">): Promise<CompraInventarioSyncResult> {
  const compraData = sanitizeCompraPayload(data);
  const compraRef = doc(collection(db, "compras"));
  const batch = writeBatch(db);
  const result = await agregarInventarioCompraABatch(batch, compraRef.id, compraData);

  batch.set(compraRef, {
    ...compraData,
    inventarioSincronizado: true,
    productosCreados: result.productosCreados,
    productosActualizados: result.productosActualizados,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return { compraId: compraRef.id, ...result };
}

export async function syncCompraInventario(compra: Compra): Promise<CompraInventarioSyncResult> {
  if (!compra.id) throw new Error("COMPRA_SIN_ID");
  if (compra.inventarioSincronizado) {
    return {
      compraId: compra.id,
      productosCreados: compra.productosCreados ?? 0,
      productosActualizados: compra.productosActualizados ?? 0,
    };
  }

  const batch = writeBatch(db);
  const result = await agregarInventarioCompraABatch(batch, compra.id, compra);
  batch.update(doc(db, "compras", compra.id), {
    inventarioSincronizado: true,
    productosCreados: result.productosCreados,
    productosActualizados: result.productosActualizados,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return { compraId: compra.id, ...result };
}

export async function deleteCompra(compra: Compra): Promise<void> {
  if (!compra.id) throw new Error("COMPRA_SIN_ID");

  const batch = writeBatch(db);
  if (compra.inventarioSincronizado) {
    const devoluciones = await getDevolucionesProveedorByCompra(compra.id);
    const devueltoByItemIndex = new Map<number, number>();
    for (const devolucion of devoluciones) {
      devueltoByItemIndex.set(
        devolucion.itemIndex,
        (devueltoByItemIndex.get(devolucion.itemIndex) ?? 0) + Number(devolucion.cantidad || 0)
      );
    }

    const itemsBySku = new Map<string, number>();
    compra.items.forEach((item, itemIndex) => {
      const sku = item.codigo.trim().toUpperCase();
      if (!sku) return;
      const cantidadDevuelta = devueltoByItemIndex.get(itemIndex) ?? 0;
      const cantidadNeta = Math.max(Number(item.cantidad || 0) - cantidadDevuelta, 0);
      itemsBySku.set(sku, (itemsBySku.get(sku) ?? 0) + cantidadNeta);
    });

    for (const [sku, cantidad] of itemsBySku.entries()) {
      const existing = await getProductoBySku(sku);
      if (existing?.id) {
        batch.update(doc(db, "productos", existing.id), {
          stockActual: increment(-cantidad),
          updatedAt: serverTimestamp(),
        });
      }
    }
  }

  batch.delete(doc(db, "compras", compra.id));
  await batch.commit();
}

const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function extensionForVehicleViewImage(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  const m = /\.([a-zA-Z0-9]+)$/.exec(file.name);
  return (m?.[1] ?? "png").toLowerCase().slice(0, 8);
}

export async function getVehicleViewImages(tipoVehiculo: TipoVehiculo): Promise<VehicleViewImagesConfig | null> {
  const snap = await getDoc(
    doc(db, "configuracion", `vehicleViewImages_${tipoVehiculo}`)
  );
  return snap.exists() ? (snap.data() as VehicleViewImagesConfig) : null;
}

export async function getAllVehicleViewImages(): Promise<VehicleViewImagesConfig[]> {
  const vehicleTypes: TipoVehiculo[] = ["sedan", "suv", "pickup", "camioneta", "moto", "otro"];
  const configs: VehicleViewImagesConfig[] = [];
  
  for (const tipo of vehicleTypes) {
    const config = await getVehicleViewImages(tipo);
    if (config) configs.push(config);
  }
  
  return configs;
}

export async function uploadVehicleViewImage(
  tipoVehiculo: TipoVehiculo,
  vista: VehiculoVista,
  file: File,
  previousUrl?: string | null
): Promise<string> {
  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error("INVALID_IMAGE_TYPE");
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  const ext = extensionForVehicleViewImage(file);
  const path = `configuracion/vehicleViews/${tipoVehiculo}/${vista}/${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  // Eliminar imagen anterior si existe
  const prev = previousUrl?.trim();
  if (prev) {
    const prevPath = storagePathFromDownloadUrl(prev);
    if (prevPath) {
      try {
        await deleteObject(ref(storage, prevPath));
      } catch {
        /* archivo ya borrado o URL antigua */
      }
    }
  }

  return url;
}

export async function deleteVehicleViewImage(url: string): Promise<void> {
  const u = url.trim();
  if (!u) return;
  const path = storagePathFromDownloadUrl(u);
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    /* ignorar */
  }
}
export async function saveVehicleViewImagesConfig(config: VehicleViewImagesConfig): Promise<void> {
  const ref = doc(db, "configuracion", `vehicleViewImages_${config.tipoVehiculo}`);
  const payload: Record<string, unknown> = {
    ...config,
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload, { merge: true });
}

// ─── VENTAS (POS) ────────────────────────────────────────────────────────────
export async function getVentas(): Promise<Venta[]> {
  const snap = await getDocs(query(collection(db, "ventas"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Venta));
}

export async function getProximoNumeroVenta(): Promise<string> {
  const q = query(collection(db, "ventas"), orderBy("numeroVenta", "desc"), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return "VEN-00001";
  const lastVenta = snap.docs[0].data() as Venta;
  const numStr = lastVenta.numeroVenta.replace("VEN-", "");
  const lastNum = parseInt(numStr, 10);
  return `VEN-${String(Number.isNaN(lastNum) ? 1 : lastNum + 1).padStart(5, "0")}`;
}

export async function createVenta(venta: Omit<Venta, "id" | "numeroVenta" | "estado">): Promise<string> {
  const numeroVenta = await getProximoNumeroVenta();
  const ventaRef = doc(collection(db, "ventas"));
  
  await runTransaction(db, async (transaction) => {
    // Read all products first
    const productRefs = venta.items.map((item) => doc(db, "productos", item.productoId));
    const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)));
    
    // Validate stock for all products
    const stockUpdates: { ref: ReturnType<typeof doc>; newStock: number; oldStock: number; product: Producto; item: VentaItem }[] = [];
    
    venta.items.forEach((item, index) => {
      const snap = productSnaps[index];
      if (!snap.exists()) {
        throw new Error(`PRODUCTO_NO_ENCONTRADO:${item.nombre}`);
      }
      const product = { id: snap.id, ...snap.data() } as Producto;
      const oldStock = getCantidadStock(product.stockActual);
      const newStock = oldStock - item.cantidad;
      
      if (newStock < 0) {
        throw new Error(`STOCK_INSUFICIENTE:${product.nombre}`);
      }
      
      stockUpdates.push({
        ref: snap.ref,
        newStock,
        oldStock,
        product,
        item
      });
    });
    
    // Apply updates and write movements
    stockUpdates.forEach(({ ref, newStock, oldStock, product, item }) => {
      // 1. Update product stock
      transaction.update(ref, {
        stockActual: newStock,
        updatedAt: serverTimestamp(),
      });
      
      // 2. Create stock movement
      const movementRef = doc(collection(db, "movimientosStock"));
      transaction.set(movementRef, {
        productoId: product.id!,
        productoNombre: product.nombre,
        sku: product.sku,
        tipo: "salida",
        cantidad: item.cantidad,
        stockAnterior: oldStock,
        stockNuevo: newStock,
        nota: `Salida por venta ${numeroVenta}`,
        unidadMedida: product.unidadMedida ?? "",
        createdAt: serverTimestamp(),
      });
    });
    
    // 3. Write sale document
    const { pagos, ...ventaWithoutPagos } = venta;
    const cleanVenta = removeUndefinedFields(ventaWithoutPagos);
    const finalVenta: Venta = {
      ...cleanVenta,
      numeroVenta,
      estado: "completada",
      createdAt: serverTimestamp() as unknown as Timestamp,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    };
    
    transaction.set(ventaRef, finalVenta);

    // 4. Save payments in 'pagos' collection
    if (pagos && pagos.length > 0) {
      pagos.forEach((pago) => {
        const pagoRef = doc(collection(db, "pagos"));
        const cleanPago = removeUndefinedFields(pago);
        transaction.set(pagoRef, {
          ...cleanPago,
          ordenId: "", // empty placeholder to satisfy Pago type
          ventaId: ventaRef.id,
          createdAt: serverTimestamp(),
        });
      });
    }
  });
  
  return ventaRef.id;
}

export async function anularVenta(ventaId: string): Promise<void> {
  const ventaRef = doc(db, "ventas", ventaId);
  const pagosSnap = await getDocs(
    query(collection(db, "pagos"), where("ventaId", "==", ventaId))
  );
  
  await runTransaction(db, async (transaction) => {
    const ventaSnap = await transaction.get(ventaRef);
    if (!ventaSnap.exists()) {
      throw new Error("VENTA_NO_ENCONTRADA");
    }
    const venta = { id: ventaSnap.id, ...ventaSnap.data() } as Venta;
    if (venta.estado === "anulada") {
      throw new Error("VENTA_YA_ANULADA");
    }
    
    // Read all products first
    const productRefs = venta.items.map((item) => doc(db, "productos", item.productoId));
    const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)));
    
    // Apply stock updates and write movements
    venta.items.forEach((item, index) => {
      const snap = productSnaps[index];
      if (!snap.exists()) {
        return;
      }
      
      const product = { id: snap.id, ...snap.data() } as Producto;
      const oldStock = getCantidadStock(product.stockActual);
      const newStock = oldStock + item.cantidad;
      
      // Update stock
      transaction.update(snap.ref, {
        stockActual: newStock,
        updatedAt: serverTimestamp(),
      });
      
      // Create stock movement
      const movementRef = doc(collection(db, "movimientosStock"));
      transaction.set(movementRef, {
        productoId: product.id!,
        productoNombre: product.nombre,
        sku: product.sku,
        tipo: "entrada",
        cantidad: item.cantidad,
        stockAnterior: oldStock,
        stockNuevo: newStock,
        nota: `Reversa por anulación de venta ${venta.numeroVenta}`,
        unidadMedida: product.unidadMedida ?? "",
        createdAt: serverTimestamp(),
      });
    });
    
    // Delete payments associated with this venta
    pagosSnap.docs.forEach((pagoDoc) => {
      transaction.delete(pagoDoc.ref);
    });
    
    // Update sale status
    transaction.update(ventaRef, {
      estado: "anulada",
      updatedAt: serverTimestamp(),
    });
  });
}

export async function updateVenta(ventaId: string, data: Partial<Venta>): Promise<void> {
  const ref = doc(db, "ventas", ventaId);
  const cleanData = removeUndefinedFields({
    ...data,
    updatedAt: serverTimestamp(),
  });
  await updateDoc(ref, cleanData);
}

// ─── CHAT DE ORDEN ────────────────────────────────────────────────────────────
export async function sendMensajeOrden(
  ordenId: string,
  mensaje: Omit<MensajeOrden, "id" | "ordenId" | "createdAt">
): Promise<string> {
  const docRef = await addDoc(
    collection(db, "ordenesTrabajo", ordenId, "mensajes"),
    {
      ...mensaje,
      ordenId,
      createdAt: serverTimestamp(),
    }
  );
  return docRef.id;
}

export function subscribeMensajesOrden(
  ordenId: string,
  callback: (mensajes: MensajeOrden[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(
    collection(db, "ordenesTrabajo", ordenId, "mensajes"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as MensajeOrden))
      );
    },
    onError
  );
}

export function subscribeAllMensajes(
  callback: (mensajes: MensajeOrden[]) => void,
  onError?: (error: Error) => void
): () => void {
  // Realizar query sin orderBy para evitar la necesidad de crear un índice composite en Firestore
  const q = query(collectionGroup(db, "mensajes"));
  return onSnapshot(
    q,
    (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MensajeOrden));
      // Ordenar descendente en memoria
      msgs.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });
      callback(msgs);
    },
    onError
  );
}

export function subscribeClientes(
  callback: (clientes: Cliente[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(collection(db, "clientes"));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Cliente)));
    },
    onError
  );
}

export function subscribeVehiculos(
  callback: (vehiculos: Vehiculo[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(collection(db, "vehiculos"));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vehiculo)));
    },
    onError
  );
}

// ─── CAJA ────────────────────────────────────────────────────────────────────

/** Devuelve la fecha de hoy en Ecuador (UTC-5) como "YYYY-MM-DD" */
export function getFechaHoyEcuador(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
}

function inicioDiaEcuador(fecha: string): Date {
  return new Date(`${fecha}T00:00:00-05:00`);
}

function finDiaEcuador(fecha: string): Date {
  return new Date(`${fecha}T23:59:59-05:00`);
}

export async function getCajaDeHoy(): Promise<Caja | null> {
  const fecha = getFechaHoyEcuador();
  const snap = await getDocs(
    query(
      collection(db, "cajas"),
      where("fecha", "==", fecha),
      where("estado", "==", "abierta"),
      limit(1)
    )
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Caja;
}

export function onCajaDeHoySnapshot(callback: (caja: Caja | null) => void): () => void {
  const fecha = getFechaHoyEcuador();
  const q = query(
    collection(db, "cajas"),
    where("fecha", "==", fecha),
    where("estado", "==", "abierta"),
    limit(1)
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      callback(null);
    } else {
      const d = snap.docs[0];
      callback({ id: d.id, ...d.data() } as Caja);
    }
  });
}

export async function abrirCaja(
  montoApertura: number,
  usuario: { uid: string; displayName: string }
): Promise<string> {
  const fecha = getFechaHoyEcuador();
  const existente = await getCajaDeHoy();
  if (existente?.id) return existente.id;

  const cajaRef = await addDoc(collection(db, "cajas"), {
    fecha,
    montoApertura: Number(montoApertura),
    estado: "abierta",
    abiertaPor: usuario,
    aperturaAt: serverTimestamp(),
  });
  return cajaRef.id;
}

export async function cerrarCaja(
  cajaId: string,
  usuario: { uid: string; displayName: string },
  notas?: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    estado: "cerrada",
    cerradaPor: usuario,
    cierreAt: serverTimestamp(),
  };
  if (notas?.trim()) payload.notas = notas.trim();
  await updateDoc(doc(db, "cajas", cajaId), payload);
}

export async function getMovimientosManuales(cajaId: string): Promise<CajaMovimientoManual[]> {
  const snap = await getDocs(
    query(collection(db, "cajas", cajaId, "movimientos"), orderBy("createdAt", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CajaMovimientoManual));
}

export function onMovimientosManualesSnapshot(
  cajaId: string,
  callback: (movimientos: CajaMovimientoManual[]) => void
): () => void {
  const q = query(
    collection(db, "cajas", cajaId, "movimientos"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CajaMovimientoManual)));
  });
}

export async function createMovimientoManual(
  cajaId: string,
  data: Omit<CajaMovimientoManual, "id" | "createdAt">
): Promise<string> {
  const payload = removeUndefinedFields(data);
  const movRef = await addDoc(collection(db, "cajas", cajaId, "movimientos"), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return movRef.id;
}

export async function deleteMovimientoManual(cajaId: string, movimientoId: string): Promise<void> {
  await deleteDoc(doc(db, "cajas", cajaId, "movimientos", movimientoId));
}

/** Listener en tiempo real de cobros del día (órdenes + ventas) */
export function onCobrosDelDiaSnapshot(
  fecha: string,
  callback: (pagos: Pago[]) => void
): () => void {
  const desde = Timestamp.fromDate(inicioDiaEcuador(fecha));
  const hasta = Timestamp.fromDate(finDiaEcuador(fecha));
  const q = query(
    collection(db, "pagos"),
    where("createdAt", ">=", desde),
    where("createdAt", "<=", hasta)
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Pago))
        .sort((a, b) => {
          const aT = (a.createdAt as Timestamp)?.toMillis?.() ?? 0;
          const bT = (b.createdAt as Timestamp)?.toMillis?.() ?? 0;
          return aT - bT;
        })
    );
  });
}

export type PagoProveedorDelDia = CompraPago & {
  compraId: string;
  proveedorNombre: string;
  itemIndex: number;
};

export async function getPagosProveedorDelDia(fecha: string): Promise<PagoProveedorDelDia[]> {
  const snap = await getDocs(query(collection(db, "compras"), orderBy("updatedAt", "desc")));
  const result: PagoProveedorDelDia[] = [];
  for (const d of snap.docs) {
    const compra = { id: d.id, ...d.data() } as Compra;
    const pagos = compra.pagosProveedor ?? [];
    pagos.forEach((pago, idx) => {
      const pagoFecha = pago.fecha ?? "";
      if (pagoFecha === fecha) {
        result.push({
          ...pago,
          compraId: d.id,
          proveedorNombre: compra.proveedorRazonSocial,
          itemIndex: idx,
        });
      }
    });
  }
  return result;
}

/** Combina las 3 fuentes en un array normalizado de MovimientoCajaUnificado */
export function normalizarMovimientosCaja({
  movimientosManuales,
  cobros,
  pagosProveedor,
}: {
  movimientosManuales: CajaMovimientoManual[];
  cobros: Pago[];
  pagosProveedor: PagoProveedorDelDia[];
}): MovimientoCajaUnificado[] {
  const lista: MovimientoCajaUnificado[] = [];

  for (const pago of cobros) {
    const ts = pago.createdAt as Timestamp | undefined;
    const hora = ts?.toDate?.() ?? new Date();
    const esTarjeta =
      pago.metodoPago === "tarjeta_credito" ||
      pago.metodoPago === "tarjeta_debito" ||
      pago.metodoPago === "tarjeta";
    const pendiente =
      esTarjeta &&
      (pago.estadoAcreditacion === "pendiente" ||
        (pago.fechaAcreditacion ? getFechaHoyEcuador() < pago.fechaAcreditacion : true));

    lista.push({
      id: pago.id!,
      hora,
      concepto: pago.ventaId ? "Cobro venta" : "Cobro orden",
      categoria: pago.ventaId ? "Venta directa" : "Cobro orden",
      tipo: "ingreso",
      metodoPago: pago.metodoPago,
      banco: pago.banco,
      monto: pago.monto,
      usuario: pago.registradoPor ?? "",
      fuente: pago.ventaId ? "cobro_venta" : "cobro_orden",
      pendienteAcreditacion: pendiente,
      referencia: pago.referencia,
    });
  }

  for (const pago of pagosProveedor) {
    lista.push({
      id: `proveedor-${pago.compraId}-${pago.itemIndex}`,
      hora: pago.createdAt?.toDate?.() ?? new Date(),
      concepto: `Pago a proveedor (${pago.proveedorNombre})`,
      categoria: "Pago proveedor",
      tipo: "egreso",
      metodoPago: (pago.metodoPago as unknown) as import("@/types").MetodoPago,
      banco: pago.banco,
      monto: pago.monto,
      usuario: "",
      fuente: "pago_proveedor",
      referencia: pago.referencia,
    });
  }

  for (const m of movimientosManuales) {
    lista.push({
      id: m.id!,
      hora: (m.createdAt as Timestamp)?.toDate?.() ?? new Date(),
      concepto: m.concepto,
      categoria: m.categoria,
      tipo: m.tipo,
      metodoPago: m.metodoPago,
      banco: m.banco,
      monto: m.monto,
      usuario: m.registradoPor.displayName,
      fuente: "manual",
      referencia: m.referencia,
    });
  }

  lista.sort((a, b) => a.hora.getTime() - b.hora.getTime());
  return lista;
}

export function calcularResumenCaja(
  montoApertura: number,
  movimientos: MovimientoCajaUnificado[]
): {
  efectivoEnCaja: number;
  totalIngresos: number;
  totalEgresos: number;
  saldoEsperado: number;
  desglosePorMetodo: Record<string, { ingresos: number; egresos: number }>;
} {
  let efectivoExtra = 0;
  let totalIngresos = 0;
  let totalEgresos = 0;
  const desglose: Record<string, { ingresos: number; egresos: number }> = {};

  for (const m of movimientos) {
    const metodo = m.metodoPago;
    if (!desglose[metodo]) desglose[metodo] = { ingresos: 0, egresos: 0 };

    if (m.tipo === "ingreso") {
      totalIngresos += m.monto;
      desglose[metodo].ingresos += m.monto;
      if (metodo === "efectivo" && !m.pendienteAcreditacion) efectivoExtra += m.monto;
    } else {
      totalEgresos += m.monto;
      desglose[metodo].egresos += m.monto;
      if (metodo === "efectivo") efectivoExtra -= m.monto;
    }
  }

  return {
    efectivoEnCaja: Number((montoApertura + efectivoExtra).toFixed(2)),
    totalIngresos: Number(totalIngresos.toFixed(2)),
    totalEgresos: Number(totalEgresos.toFixed(2)),
    saldoEsperado: Number((montoApertura + totalIngresos - totalEgresos).toFixed(2)),
    desglosePorMetodo: desglose,
  };
}

/* ==========================================================================
   HERRAMIENTAS SERVICES (INVENTARIO DE HERRAMIENTAS DEL TALLER)
   ========================================================================== */

export function subscribeHerramientas(callback: (herramientas: Herramienta[]) => void) {
  const q = query(collection(db, "herramientas"), orderBy("nombre", "asc"));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Herramienta[];
    callback(list);
  }, (error) => {
    console.error("Error subscribing to herramientas:", error);
  });
}

export async function getHerramientas(): Promise<Herramienta[]> {
  const q = query(collection(db, "herramientas"), orderBy("nombre", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Herramienta);
}

export async function createHerramienta(data: Omit<Herramienta, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const cleaned: Record<string, unknown> = {};
  Object.entries(data).forEach(([k, v]) => {
    if (v !== undefined) cleaned[k] = v;
  });

  const docRef = await addDoc(collection(db, "herramientas"), {
    ...cleaned,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateHerramienta(id: string, updates: Partial<Herramienta>): Promise<void> {
  const cleaned: Record<string, unknown> = {};
  Object.entries(updates).forEach(([k, v]) => {
    if (v !== undefined) cleaned[k] = v;
  });

  await updateDoc(doc(db, "herramientas", id), {
    ...cleaned,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteHerramienta(id: string): Promise<void> {
  await deleteDoc(doc(db, "herramientas", id));
}

export async function uploadAdjuntoPresupuesto(
  presupuestoId: string,
  file: File
): Promise<AdjuntoOrden> {
  const sanitizeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `ordenes/${presupuestoId}/adjuntos/${Date.now()}_${sanitizeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  let tipo = "archivo";
  if (file.type.startsWith("image/")) tipo = "imagen";
  else if (file.type.includes("pdf")) tipo = "pdf";

  return {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
    nombre: file.name,
    url,
    tipo,
    tamano: file.size,
    createdAt: new Date().toISOString(),
  };
}

export async function createCita(data: Omit<Cita, "id">): Promise<string> {
  const cleaned = removeUndefinedFields(data);
  const docRef = await addDoc(collection(db, "citas"), {
    ...cleaned,
    estado: data.estado || "Agendada",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getCitas(): Promise<Cita[]> {
  const snap = await getDocs(collection(db, "citas"));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Cita);
  return list.sort((a, b) => (a.fecha > b.fecha ? 1 : -1));
}

export function subscribeCitas(callback: (citas: Cita[]) => void): () => void {
  const q = query(collection(db, "citas"), orderBy("fecha", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Cita);
      callback(list);
    },
    (err) => {
      console.error("Error en subscribeCitas:", err);
      // Fallback sin orderBy por si falta un índice
      onSnapshot(collection(db, "citas"), (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Cita);
        list.sort((a, b) => (a.fecha > b.fecha ? 1 : -1));
        callback(list);
      });
    }
  );
}

export async function getCitasByPresupuesto(presupuestoId: string): Promise<Cita[]> {
  const q = query(
    collection(db, "citas"),
    where("presupuestoId", "==", presupuestoId)
  );
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Cita);
  return list.sort((a, b) => (a.fecha > b.fecha ? 1 : -1));
}

export async function updateCita(id: string, data: Partial<Cita>): Promise<void> {
  const cleaned = removeUndefinedFields(data);
  await updateDoc(doc(db, "citas", id), {
    ...cleaned,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCita(id: string): Promise<void> {
  await deleteDoc(doc(db, "citas", id));
}

// ─── MARCAS Y MODELOS DE VEHÍCULOS (ECUADOR) ─────────────────────────

let cacheMarcasVehiculo: MarcaVehiculo[] | null = null;

export const MARCAS_ECUADOR_POPULARES: Omit<MarcaVehiculo, "id">[] = [
  {
    nombre: "Chevrolet",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><path fill='%23D4AF37' d='M20 22h14l8-10h16l-8 10h30v16H66l-8 10H42l8-10H20V22z'/><path fill='%23B8860B' d='M22 24h12l7-8h14l-7 8h30v12H64l-7 8H44l7-8H22V24z'/></svg>",
    modelos: [
      { nombre: "D-Max" },
      { nombre: "Aveo" },
      { nombre: "Sail" },
      { nombre: "Spark" },
      { nombre: "Tracker" },
      { nombre: "Captiva" },
      { nombre: "Onix" },
      { nombre: "Trailblazer" },
      { nombre: "N400" },
      { nombre: "Equinox" },
      { nombre: "Cavalier" },
      { nombre: "Blazer" },
    ],
  },
  {
    nombre: "Toyota",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><ellipse cx='50' cy='30' rx='42' ry='24' fill='none' stroke='%23CC0000' stroke-width='6'/><ellipse cx='50' cy='30' rx='28' ry='12' fill='none' stroke='%23CC0000' stroke-width='5'/><ellipse cx='50' cy='30' rx='10' ry='22' fill='none' stroke='%23CC0000' stroke-width='5'/></svg>",
    modelos: [
      { nombre: "Hilux" },
      { nombre: "Fortuner" },
      { nombre: "RAV4" },
      { nombre: "Yaris" },
      { nombre: "Corolla" },
      { nombre: "Land Cruiser" },
      { nombre: "Prado" },
      { nombre: "Rush" },
      { nombre: "Raize" },
      { nombre: "Avanza" },
      { nombre: "Yaris Cross" },
      { nombre: "Hilux Stout" },
    ],
  },
  {
    nombre: "Hyundai",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><ellipse cx='50' cy='30' rx='42' ry='25' fill='none' stroke='%23002C6C' stroke-width='5'/><path fill='%23002C6C' d='M35 15h8v13c4-2 10-3 14 0V15h8v30h-8V31c-4 2-10 3-14 0v14h-8V15z' transform='rotate(-10 50 30)'/></svg>",
    modelos: [
      { nombre: "Tucson" },
      { nombre: "Accent" },
      { nombre: "Creta" },
      { nombre: "Santa Fe" },
      { nombre: "Grand i10" },
      { nombre: "H-1" },
      { nombre: "Elantra" },
      { nombre: "Venue" },
      { nombre: "Kona" },
      { nombre: "Palisade" },
      { nombre: "Staria" },
    ],
  },
  {
    nombre: "Kia",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><ellipse cx='50' cy='30' rx='44' ry='22' fill='none' stroke='%23BB162B' stroke-width='5'/><text x='50' y='38' font-family='Arial,sans-serif' font-weight='900' font-size='24' fill='%23BB162B' text-anchor='middle'>KIA</text></svg>",
    modelos: [
      { nombre: "Sportage" },
      { nombre: "Rio" },
      { nombre: "Picanto" },
      { nombre: "Seltos" },
      { nombre: "Soluto" },
      { nombre: "Sorento" },
      { nombre: "Sonet" },
      { nombre: "Cerato" },
      { nombre: "Stonic" },
      { nombre: "Carnival" },
      { nombre: "K3" },
    ],
  },
  {
    nombre: "Nissan",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><circle cx='50' cy='30' r='24' fill='none' stroke='%23C0C0C0' stroke-width='6'/><rect x='10' y='22' width='80' height='16' rx='3' fill='%23222222'/><text x='50' y='34' font-family='Arial,sans-serif' font-weight='bold' font-size='11' fill='%23FFFFFF' text-anchor='middle'>NISSAN</text></svg>",
    modelos: [
      { nombre: "Frontier" },
      { nombre: "Kicks" },
      { nombre: "Versa" },
      { nombre: "Sentra" },
      { nombre: "X-Trail" },
      { nombre: "Qashqai" },
      { nombre: "Pathfinder" },
      { nombre: "Urvan" },
      { nombre: "March" },
    ],
  },
  {
    nombre: "Suzuki",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><path fill='%23E31B23' d='M30 12h40l-25 18h25l-40 18h25'/></svg>",
    modelos: [
      { nombre: "Grand Vitara" },
      { nombre: "Swift" },
      { nombre: "Jimny" },
      { nombre: "S-Cross" },
      { nombre: "Vitara" },
      { nombre: "Alto" },
      { nombre: "XL7" },
      { nombre: "Spresso" },
      { nombre: "Baleno" },
      { nombre: "Ertiga" },
    ],
  },
  {
    nombre: "Great Wall",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><path fill='%23C0C0C0' stroke='%23333' stroke-width='2' d='M50 10 L80 22 L80 45 L50 54 L20 45 L20 22 Z'/><path fill='%23CC0000' d='M44 20 h12 v20 h-12 z'/></svg>",
    modelos: [
      { nombre: "Poer" },
      { nombre: "Wingle 5" },
      { nombre: "Wingle 7" },
      { nombre: "Haval H6" },
      { nombre: "Haval Jolion" },
      { nombre: "Haval H2" },
      { nombre: "M4" },
      { nombre: "Tank 300" },
    ],
  },
  {
    nombre: "Chery",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><ellipse cx='50' cy='30' rx='36' ry='20' fill='none' stroke='%23AA0000' stroke-width='5'/><path fill='none' stroke='%23AA0000' stroke-width='4' d='M30 30 L50 15 L70 30 L50 45 Z'/></svg>",
    modelos: [
      { nombre: "Tiggo 2" },
      { nombre: "Tiggo 4" },
      { nombre: "Tiggo 7 Pro" },
      { nombre: "Tiggo 8 Pro" },
      { nombre: "Arrizo 5" },
      { nombre: "Tiggo 2 Pro" },
      { nombre: "Arrizo 6 Pro" },
    ],
  },
  {
    nombre: "Ford",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><ellipse cx='50' cy='30' rx='44' ry='22' fill='%23002B66' stroke='%23C0C0C0' stroke-width='4'/><text x='50' y='37' font-family='Georgia,serif' font-style='italic' font-weight='bold' font-size='22' fill='%23FFFFFF' text-anchor='middle'>Ford</text></svg>",
    modelos: [
      { nombre: "F-150" },
      { nombre: "Ranger" },
      { nombre: "Explorer" },
      { nombre: "Escape" },
      { nombre: "Edge" },
      { nombre: "Bronco" },
      { nombre: "Expedition" },
      { nombre: "Territory" },
      { nombre: "Mustang" },
    ],
  },
  {
    nombre: "Mazda",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><ellipse cx='50' cy='30' rx='40' ry='24' fill='none' stroke='%23111' stroke-width='4'/><path fill='none' stroke='%23111' stroke-width='4' d='M25 32 Q50 12 75 32 Q50 24 25 32 Z'/></svg>",
    modelos: [
      { nombre: "CX-5" },
      { nombre: "Mazda 3" },
      { nombre: "CX-30" },
      { nombre: "BT-50" },
      { nombre: "Mazda 2" },
      { nombre: "CX-9" },
      { nombre: "CX-50" },
      { nombre: "CX-90" },
    ],
  },
  {
    nombre: "Volkswagen",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><circle cx='50' cy='30' r='24' fill='%23001E50'/><circle cx='50' cy='30' r='21' fill='none' stroke='%23FFFFFF' stroke-width='2'/><path fill='none' stroke='%23FFFFFF' stroke-width='3' d='M36 18 L50 36 L64 18 M38 42 L50 26 L62 42'/></svg>",
    modelos: [
      { nombre: "Amarok" },
      { nombre: "Gol" },
      { nombre: "Polo" },
      { nombre: "Virtus" },
      { nombre: "Tiguan" },
      { nombre: "T-Cross" },
      { nombre: "Saveiro" },
      { nombre: "Nivus" },
      { nombre: "Taos" },
      { nombre: "Jetta" },
    ],
  },
  {
    nombre: "Renault",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><path fill='%23FFCC00' stroke='%23333' stroke-width='3' d='M50 8 L78 30 L50 52 L22 30 Z M50 18 L66 30 L50 42 L34 30 Z'/></svg>",
    modelos: [
      { nombre: "Duster" },
      { nombre: "Stepway" },
      { nombre: "Logan" },
      { nombre: "Sandero" },
      { nombre: "Kwid" },
      { nombre: "Oroch" },
      { nombre: "Koleos" },
      { nombre: "Master" },
      { nombre: "Kangoo" },
    ],
  },
  {
    nombre: "Honda",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><rect x='20' y='10' width='60' height='40' rx='8' fill='none' stroke='%23CC0000' stroke-width='4'/><path fill='%23CC0000' d='M32 18 h10 v10 h16 v-10 h10 v24 h-10 v-9 h-16 v9 h-10 z'/></svg>",
    modelos: [
      { nombre: "CR-V" },
      { nombre: "Civic" },
      { nombre: "HR-V" },
      { nombre: "Pilot" },
      { nombre: "City" },
      { nombre: "Fit" },
      { nombre: "Accord" },
      { nombre: "ZR-V" },
    ],
  },
  {
    nombre: "JAC",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><polygon points='50,10 59,27 78,28 64,41 68,59 50,49 32,59 36,41 22,28 41,27' fill='%23CC0000'/></svg>",
    modelos: [
      { nombre: "JS4" },
      { nombre: "T8" },
      { nombre: "JS2" },
      { nombre: "Sunray" },
      { nombre: "T6" },
      { nombre: "JS3" },
      { nombre: "JS8" },
    ],
  },
  {
    nombre: "Soueast",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><circle cx='50' cy='30' r='22' fill='%230055AA'/><path fill='%23FFFFFF' d='M38 30 L62 18 L54 30 L62 42 Z'/></svg>",
    modelos: [
      { nombre: "DX3" },
      { nombre: "DX7" },
      { nombre: "DX5" },
    ],
  },
  {
    nombre: "Mitsubishi",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><polygon points='50,10 37,30 63,30' fill='%23E60012'/><polygon points='37,30 11,30 24,50' fill='%23E60012'/><polygon points='63,30 89,30 76,50' fill='%23E60012'/></svg>",
    modelos: [
      { nombre: "L200" },
      { nombre: "Montero" },
      { nombre: "Outlander" },
      { nombre: "ASX" },
      { nombre: "Eclipse Cross" },
      { nombre: "Xpander" },
    ],
  },
  {
    nombre: "Peugeot",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><path fill='%23001F5B' stroke='%23FFF' stroke-width='2' d='M30 10 L70 10 L80 50 L50 56 L20 50 Z'/><path fill='%23FFFFFF' d='M42 20 L58 20 L54 32 L62 32 L56 44 L44 44 Z'/></svg>",
    modelos: [
      { nombre: "208" },
      { nombre: "3008" },
      { nombre: "2008" },
      { nombre: "5008" },
      { nombre: "Partner" },
      { nombre: "Landtrek" },
      { nombre: "308" },
    ],
  },
  {
    nombre: "BMW",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><circle cx='50' cy='30' r='24' fill='%23000'/><circle cx='50' cy='30' r='18' fill='%23FFF'/><path d='M50 30 L50 12 A18 18 0 0 1 68 30 Z' fill='%230066B1'/><path d='M50 30 L32 30 A18 18 0 0 1 50 48 Z' fill='%230066B1'/></svg>",
    modelos: [
      { nombre: "Serie 3" },
      { nombre: "X1" },
      { nombre: "X3" },
      { nombre: "X5" },
      { nombre: "Serie 1" },
      { nombre: "Serie 5" },
      { nombre: "X4" },
      { nombre: "X6" },
    ],
  },
  {
    nombre: "Mercedes-Benz",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><circle cx='50' cy='30' r='24' fill='none' stroke='%23333' stroke-width='4'/><polygon points='50,10 44,28 50,30' fill='%23333'/><polygon points='50,10 56,28 50,30' fill='%23666'/><polygon points='67,40 52,34 50,30' fill='%23333'/><polygon points='67,40 50,42 50,30' fill='%23666'/><polygon points='33,40 48,34 50,30' fill='%23666'/><polygon points='33,40 50,42 50,30' fill='%23333'/></svg>",
    modelos: [
      { nombre: "Clase C" },
      { nombre: "GLC" },
      { nombre: "GLA" },
      { nombre: "Clase E" },
      { nombre: "Sprinter" },
      { nombre: "Clase A" },
      { nombre: "GLE" },
      { nombre: "Vito" },
    ],
  },
  {
    nombre: "Audi",
    popularidadEcuador: true,
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><circle cx='32' cy='30' r='10' fill='none' stroke='%23111' stroke-width='3'/><circle cx='44' cy='30' r='10' fill='none' stroke='%23111' stroke-width='3'/><circle cx='56' cy='30' r='10' fill='none' stroke='%23111' stroke-width='3'/><circle cx='68' cy='30' r='10' fill='none' stroke='%23111' stroke-width='3'/></svg>",
    modelos: [
      { nombre: "A3" },
      { nombre: "A4" },
      { nombre: "Q3" },
      { nombre: "Q5" },
      { nombre: "Q7" },
      { nombre: "A5" },
      { nombre: "Q8" },
    ],
  },
];

let sembradoMarcasEnProgreso: Promise<void> | null = null;

export async function getMarcasVehiculo(): Promise<MarcaVehiculo[]> {
  if (cacheMarcasVehiculo) return cacheMarcasVehiculo;

  if (sembradoMarcasEnProgreso) {
    await sembradoMarcasEnProgreso;
  }

  const snap = await getDocs(query(collection(db, "marcas_vehiculo"), orderBy("nombre", "asc")));
  let docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MarcaVehiculo));

  if (docs.length === 0) {
    if (!sembradoMarcasEnProgreso) {
      sembradoMarcasEnProgreso = sembrarMarcasEcuador();
    }
    await sembradoMarcasEnProgreso;
    sembradoMarcasEnProgreso = null;
    const newSnap = await getDocs(query(collection(db, "marcas_vehiculo"), orderBy("nombre", "asc")));
    docs = newSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MarcaVehiculo));
  }

  // Deduplicar en memoria por nombre para evitar duplicados en la interfaz
  const mapUnico = new Map<string, MarcaVehiculo>();
  for (const m of docs) {
    const key = (m.nombre || "").trim().toLowerCase();
    if (!key) continue;
    if (!mapUnico.has(key)) {
      mapUnico.set(key, m);
    } else {
      const existing = mapUnico.get(key)!;
      // Conservar el registro que tenga más información/modelos/logo
      if ((m.modelos?.length || 0) > (existing.modelos?.length || 0) || (m.logoUrl && !existing.logoUrl)) {
        mapUnico.set(key, m);
      }
    }
  }

  const result = Array.from(mapUnico.values()).sort((a, b) =>
    a.nombre.localeCompare(b.nombre)
  );

  cacheMarcasVehiculo = result;
  return result;
}

export async function createMarcaVehiculo(data: Omit<MarcaVehiculo, "id">): Promise<string> {
  const cleanData = removeUndefinedFields({
    ...data,
    nombre: data.nombre.trim(),
    modelos: data.modelos || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const docRef = await addDoc(collection(db, "marcas_vehiculo"), cleanData);
  cacheMarcasVehiculo = null;
  return docRef.id;
}

export async function updateMarcaVehiculo(id: string, data: Partial<MarcaVehiculo>): Promise<void> {
  const cleanData = removeUndefinedFields({
    ...data,
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "marcas_vehiculo", id), cleanData);
  cacheMarcasVehiculo = null;
}

export async function deleteMarcaVehiculo(id: string): Promise<void> {
  await deleteDoc(doc(db, "marcas_vehiculo", id));
  cacheMarcasVehiculo = null;
}

export async function agregarModeloAMarca(marcaId: string, modelo: ModeloVehiculo): Promise<void> {
  const marcaRef = doc(db, "marcas_vehiculo", marcaId);
  const snap = await getDoc(marcaRef);
  if (!snap.exists()) return;

  const marca = snap.data() as MarcaVehiculo;
  const modelos = marca.modelos || [];

  if (modelos.some((m) => m.nombre.toLowerCase() === modelo.nombre.toLowerCase())) {
    return;
  }

  modelos.push({ ...modelo, nombre: modelo.nombre.trim() });
  const cleanModelos = removeUndefinedFields(modelos);
  await updateDoc(marcaRef, { modelos: cleanModelos, updatedAt: serverTimestamp() });
  cacheMarcasVehiculo = null;
}

export async function eliminarModeloDeMarca(marcaId: string, modeloNombre: string): Promise<void> {
  const marcaRef = doc(db, "marcas_vehiculo", marcaId);
  const snap = await getDoc(marcaRef);
  if (!snap.exists()) return;

  const marca = snap.data() as MarcaVehiculo;
  const modelos = (marca.modelos || []).filter((m) => m.nombre.toLowerCase() !== modeloNombre.toLowerCase());
  await updateDoc(marcaRef, { modelos: cleanModelos(modelos), updatedAt: serverTimestamp() });
  cacheMarcasVehiculo = null;
}

function cleanModelos(modelos: ModeloVehiculo[]) {
  return modelos.map((m) => removeUndefinedFields(m));
}

export async function subirLogoMarca(file: File, pathSuffix: string): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `marcas/logos/${Date.now()}_${pathSuffix}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function sembrarMarcasEcuador(overwrite = false): Promise<void> {
  const colRef = collection(db, "marcas_vehiculo");
  const snap = await getDocs(colRef);

  if (!snap.empty && !overwrite) {
    // Limpieza automática de duplicados existentes en Firestore
    const agrupados = new Map<string, typeof snap.docs>();
    snap.docs.forEach((doc) => {
      const data = doc.data() as MarcaVehiculo;
      const key = (data.nombre || "").trim().toLowerCase();
      if (!key) return;
      if (!agrupados.has(key)) agrupados.set(key, []);
      agrupados.get(key)!.push(doc);
    });

    let huboDuplicados = false;
    const batch = writeBatch(db);
    agrupados.forEach((docs) => {
      if (docs.length > 1) {
        huboDuplicados = true;
        // Conservar solo el primer documento y eliminar los duplicados restantes
        for (let i = 1; i < docs.length; i++) {
          batch.delete(docs[i].ref);
        }
      }
    });

    if (huboDuplicados) {
      await batch.commit();
      cacheMarcasVehiculo = null;
    }
    return;
  }

  if (overwrite) {
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  for (const item of MARCAS_ECUADOR_POPULARES) {
    const cleaned = removeUndefinedFields({
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await addDoc(colRef, cleaned);
  }

  cacheMarcasVehiculo = null;
}

export function detectarTipoVehiculo(marcaNombre?: string, modeloNombre?: string, marcasData?: MarcaVehiculo[]): TipoVehiculo | null {
  if (!modeloNombre?.trim()) return null;
  const modLower = modeloNombre.trim().toLowerCase();
  const marcaLower = (marcaNombre || "").trim().toLowerCase();

  // 1. Buscar en los datos registrados de la marca en Firestore/Catálogo si la marca/modelo coinciden exactamente
  if (marcasData && marcasData.length > 0) {
    const marcaFound = marcasData.find((m) => m.nombre.trim().toLowerCase() === marcaLower);
    if (marcaFound?.modelos) {
      const modFound = marcaFound.modelos.find((m) => m.nombre.trim().toLowerCase() === modLower);
      if (modFound?.tipoVehiculo) {
        return modFound.tipoVehiculo;
      }
    }
  }

  // 2. Reglas de inferencia inteligente según palabras clave populares en Ecuador
  const pickupKeywords = ["hilux", "d-max", "frontier", "poer", "wingle", "ranger", "f-150", "amarok", "bt-50", "l200", "saveiro", "oroch", "landtrek", "t8", "t6", "pickup"];
  if (pickupKeywords.some((k) => modLower.includes(k))) return "pickup";

  const suvKeywords = [
    "tucson", "sportage", "rav4", "fortuner", "tracker", "captiva", "trailblazer", "equinox", "blazer",
    "vitara", "jimny", "s-cross", "creta", "santa fe", "kicks", "x-trail", "qashqai", "pathfinder",
    "haval", "jolion", "tiggo", "explorer", "escape", "bronco", "expedition", "territory",
    "cx-", "suv", "t-cross", "nivus", "taos", "tiguan", "duster", "stepway", "koleos",
    "cr-v", "hr-v", "pilot", "wr-v", "zr-v", "js4", "js2", "js3", "js8", "dx3", "dx7", "dx5",
    "montero", "outlander", "asx", "eclipse", "pajero", "3008", "2008", "5008",
    "x1", "x3", "x4", "x5", "x6", "x7", "glc", "gla", "gle", "gls", "q3", "q5", "q7", "q8"
  ];
  if (suvKeywords.some((k) => modLower.includes(k))) return "suv";

  const camionetaKeywords = ["n400", "urvan", "h-1", "staria", "transporter", "master", "kangoo", "partner", "sunray", "sprinter", "vito", "van"];
  if (camionetaKeywords.some((k) => modLower.includes(k))) return "camioneta";

  const motoKeywords = ["moto", "pulsar", "yamaha", "cbr", "gsx", "shineray", "ducati", "vespa", "ktm", "bmw gs", "tvs", "bajaj", "hero", "haojue"];
  if (motoKeywords.some((k) => modLower.includes(k))) return "moto";

  const sedanKeywords = [
    "spark", "aveo", "sail", "onix", "cavalier", "yaris", "corolla", "raize", "avanza",
    "accent", "grand i10", "elantra", "sonata", "rio", "picanto", "soluto", "cerato", "k3",
    "versa", "sentra", "march", "note", "swift", "alto", "spresso", "baleno", "ertiga",
    "arrizo", "mustang", "mazda 3", "mazda 2", "gol", "polo", "virtus", "jetta",
    "logan", "sandero", "kwid", "civic", "city", "fit", "accord", "mirage", "xpander",
    "208", "308", "408", "serie 3", "serie 1", "serie 5", "clase c", "clase e", "clase a", "a3", "a4", "a5"
  ];
  if (sedanKeywords.some((k) => modLower.includes(k))) return "sedan";

  return null;
}

export async function obtenerLogoMarcaBase64(marcaNombre?: string): Promise<string | undefined> {
  if (!marcaNombre?.trim()) return undefined;
  const target = marcaNombre.trim().toLowerCase();
  try {
    const marcas = await getMarcasVehiculo();
    let foundUrl = marcas.find(
      (m) => m.nombre.trim().toLowerCase() === target
    )?.logoUrl;

    if (!foundUrl) {
      foundUrl = MARCAS_ECUADOR_POPULARES.find(
        (m) => m.nombre.trim().toLowerCase() === target
      )?.logoUrl;
    }

    if (!foundUrl) return undefined;
    const base64 = await getLogoAsBase64Png(foundUrl);
    return base64 || foundUrl;
  } catch (err) {
    console.error("Error al obtener logo base64 de marca:", err);
    return undefined;
  }
}

