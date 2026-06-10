import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  writeBatch,
  increment,
  runTransaction,
  serverTimestamp,
  onSnapshot,
  QueryConstraint,
  type Transaction,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./firebase";
import {
  Cliente,
  Vehiculo,
  OrdenTrabajo,
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
} from "@/types";

function normalizarMargenGanancia(value: unknown): 25 | 40 {
  return Number(value) === 40 ? 40 : 25;
}

const IVA_RATE = 15;

function calcularPrecioVenta(costoBase: number, margenGanancia: 25 | 40, aplicaIva = false): number {
  const precioConMargen = Number(costoBase || 0) * (1 + margenGanancia / 100);
  const precioFinal = aplicaIva ? precioConMargen * (1 + IVA_RATE / 100) : precioConMargen;
  return Number(precioFinal.toFixed(2));
}

function resolverMargenProducto(producto?: Producto | null): 25 | 40 {
  if (!producto) return 25;
  if (producto.margenGanancia === 25 || producto.margenGanancia === 40) return producto.margenGanancia;
  const costoBase = Number(producto.costoBase ?? 0);
  if (costoBase <= 0) return 25;
  const margenActual = (Number(producto.precioBase ?? 0) / costoBase - 1) * 100;
  return Math.abs(margenActual - 40) < Math.abs(margenActual - 25) ? 40 : 25;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
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

// ─── CLIENTES ─────────────────────────────────────────────────────────────────
export async function getClientes(): Promise<Cliente[]> {
  const snap = await getDocs(query(collection(db, "clientes"), orderBy("apellido")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Cliente));
}

export async function getClienteById(id: string): Promise<Cliente | null> {
  const snap = await getDoc(doc(db, "clientes", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Cliente) : null;
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
}

export async function deleteCliente(id: string): Promise<void> {
  await deleteDoc(doc(db, "clientes", id));
}

// ─── VEHÍCULOS ────────────────────────────────────────────────────────────────
export async function getVehiculos(): Promise<Vehiculo[]> {
  const snap = await getDocs(query(collection(db, "vehiculos"), orderBy("placa")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vehiculo));
}

export async function getVehiculosByCliente(clienteId: string): Promise<Vehiculo[]> {
  const snap = await getDocs(
    query(collection(db, "vehiculos"), where("clienteId", "==", clienteId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vehiculo));
}

export async function getVehiculoById(id: string): Promise<Vehiculo | null> {
  const snap = await getDoc(doc(db, "vehiculos", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Vehiculo) : null;
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

export async function createOrden(data: Omit<OrdenTrabajo, "id">): Promise<string> {
  // Generar número de orden
  const countSnap = await getDocs(collection(db, "ordenesTrabajo"));
  const numero = countSnap.size + 1;
  const ref = await addDoc(collection(db, "ordenesTrabajo"), {
    ...removeUndefinedFields(data),
    numero,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function createOrdenConItems(
  data: Omit<OrdenTrabajo, "id">,
  items: Omit<ItemOrden, "id" | "ordenId">[]
): Promise<string> {
  const countSnap = await getDocs(collection(db, "ordenesTrabajo"));
  const numero = countSnap.size + 1;
  const ordenRef = doc(collection(db, "ordenesTrabajo"));

  await runTransaction(db, async (transaction) => {
    if (!data.esCotizacion) {
      await aplicarMovimientosStockOrden(
        transaction,
        items
          .filter(itemDescuentaStock)
          .map((item) => ({
            item,
            cantidadDelta: -getCantidadStock(item.cantidad),
            nota: `Salida por orden ${ordenRef.id}`,
          }))
      );
    }

    transaction.set(ordenRef, {
      ...removeUndefinedFields(data),
      numero,
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

export async function getProximoNumeroOrden(): Promise<number> {
  const snap = await getDocs(collection(db, "ordenesTrabajo"));
  return snap.size + 1;
}

export async function updateOrden(id: string, data: Partial<OrdenTrabajo>): Promise<void> {
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
              nota: `Conversion de cotizacion a orden ${id}`,
            }))
        );
      }

      transaction.update(ordenRef, {
        ...removeUndefinedFields(data),
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
  if (estado === "Entregado") update.fechaEntrega = serverTimestamp();
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
            nota: `Reversa por eliminar orden ${id}`,
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
        `Salida por orden ${ordenId}`
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
          `Ajuste de cantidad en orden ${ordenId}`
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
        `Reversa por eliminar item de orden ${ordenId}`,
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
        `Devolucion de cliente - orden ${data.ordenId}: ${data.motivo.trim()}`
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
  const ref = await addDoc(collection(db, "productos"), {
    ...data,
    margenGanancia,
    precioBase: calcularPrecioVenta(data.costoBase, margenGanancia, data.aplicaIva),
    sku: data.sku.trim().toUpperCase(),
    stockActual: Math.floor(Number(data.stockActual ?? 0)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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
  await updateDoc(doc(db, "productos", id), { ...payload, updatedAt: serverTimestamp() });
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

export async function getServicios(): Promise<Servicio[]> {
  const snap = await getDocs(query(collection(db, "servicios"), orderBy("nombre")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Servicio));
}

export async function createServicio(data: Omit<Servicio, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "servicios"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateServicio(id: string, data: Partial<Servicio>): Promise<void> {
  await updateDoc(doc(db, "servicios", id), { ...data, updatedAt: serverTimestamp() });
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
