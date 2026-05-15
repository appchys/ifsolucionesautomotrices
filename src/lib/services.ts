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
  Timestamp,
  serverTimestamp,
  onSnapshot,
  QueryConstraint,
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
  Servicio,
} from "@/types";

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
    configVistas: data.configVistas || [],
    updatedAt: serverTimestamp(),
  };
  if (!snap.exists()) payload.createdAt = serverTimestamp();
  await setDoc(ref, payload, { merge: true });
}

export async function getConfiguracionVistas(): Promise<any[]> {
  const taller = await getDatosTaller();
  return taller.configVistas || [];
}

export async function saveConfiguracionVistas(config: any[]): Promise<void> {
  const taller = await getDatosTaller();
  await saveDatosTaller({
    ...taller,
    configVistas: config,
  });
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

export async function createCliente(data: Omit<Cliente, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "clientes"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCliente(id: string, data: Partial<Cliente>): Promise<void> {
  await updateDoc(doc(db, "clientes", id), { ...data, updatedAt: serverTimestamp() });
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

// ─── IMÁGENES DE VISTAS DE VEHÍCULOS ───────────────────────────────────────────
const VISTA_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const VISTA_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function extensionForVistaImage(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  const m = /\.([a-zA-Z0-9]+)$/.exec(file.name);
  return (m?.[1] ?? "png").toLowerCase().slice(0, 8);
}

export async function uploadVistaImage(
  vehiculoId: string,
  vista: string,
  file: File,
  previousUrl?: string | null
): Promise<string> {
  if (!VISTA_IMAGE_TYPES.has(file.type)) {
    throw new Error("INVALID_IMAGE_TYPE");
  }
  if (file.size > VISTA_IMAGE_MAX_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }
  const ext = extensionForVistaImage(file);
  const path = `vehiculos/${vehiculoId}/vistas/${vista}_${Date.now()}.${ext}`;
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

export async function deleteVistaImageFile(url: string): Promise<void> {
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

// ─── ÓRDENES DE TRABAJO ───────────────────────────────────────────────────────
export async function getOrdenes(filters?: { estado?: EstadoOrden }): Promise<OrdenTrabajo[]> {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];
  if (filters?.estado) constraints.push(where("estado", "==", filters.estado));
  const snap = await getDocs(query(collection(db, "ordenesTrabajo"), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrdenTrabajo));
}

export async function getOrdenById(id: string): Promise<OrdenTrabajo | null> {
  const snap = await getDoc(doc(db, "ordenesTrabajo", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as OrdenTrabajo) : null;
}

export function subscribeOrdenes(
  callback: (ordenes: OrdenTrabajo[]) => void
): () => void {
  const q = query(collection(db, "ordenesTrabajo"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrdenTrabajo)));
  });
}

export async function createOrden(data: Omit<OrdenTrabajo, "id">): Promise<string> {
  // Generar número de orden
  const countSnap = await getDocs(collection(db, "ordenesTrabajo"));
  const numero = countSnap.size + 1;
  const ref = await addDoc(collection(db, "ordenesTrabajo"), {
    ...data,
    numero,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getProximoNumeroOrden(): Promise<number> {
  const snap = await getDocs(collection(db, "ordenesTrabajo"));
  return snap.size + 1;
}

export async function updateOrden(id: string, data: Partial<OrdenTrabajo>): Promise<void> {
  await updateDoc(doc(db, "ordenesTrabajo", id), { ...data, updatedAt: serverTimestamp() });
}

export async function updateEstadoOrden(id: string, estado: EstadoOrden): Promise<void> {
  const update: Record<string, unknown> = { estado, updatedAt: serverTimestamp() };
  if (estado === "Entregado") update.fechaEntrega = serverTimestamp();
  await updateDoc(doc(db, "ordenesTrabajo", id), update);
}

// ─── ITEMS DE ORDEN ───────────────────────────────────────────────────────────
export async function getItemsOrden(ordenId: string): Promise<ItemOrden[]> {
  const snap = await getDocs(
    collection(db, "ordenesTrabajo", ordenId, "itemsOrden")
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ItemOrden));
}

export async function addItemOrden(ordenId: string, item: Omit<ItemOrden, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "ordenesTrabajo", ordenId, "itemsOrden"), {
    ...item,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateItemOrden(ordenId: string, itemId: string, data: Partial<ItemOrden>): Promise<void> {
  await updateDoc(doc(db, "ordenesTrabajo", ordenId, "itemsOrden", itemId), data);
}

export async function deleteItemOrden(ordenId: string, itemId: string): Promise<void> {
  await deleteDoc(doc(db, "ordenesTrabajo", ordenId, "itemsOrden", itemId));
}

// ─── PAGOS ────────────────────────────────────────────────────────────────────
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

export async function createPago(pago: Omit<Pago, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "pagos"), {
    ...pago,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deletePago(id: string): Promise<void> {
  await deleteDoc(doc(db, "pagos", id));
}

// ─── USUARIOS ────────────────────────────────────────────────────────────────
export async function getUsuarios(): Promise<AppUser[]> {
  const snap = await getDocs(collection(db, "usuarios"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser));
}

export async function createUsuarioDB(uid: string, data: Omit<AppUser, "uid">): Promise<void> {
  await addDoc(collection(db, "usuarios"), { uid, ...data, createdAt: serverTimestamp() });
}

export async function getUsuarioByUid(uid: string): Promise<AppUser | null> {
  const snap = await getDocs(query(collection(db, "usuarios"), where("uid", "==", uid)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.data().uid, ...d.data() } as AppUser;
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

export async function createProducto(data: Omit<Producto, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "productos"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProducto(id: string, data: Partial<Producto>): Promise<void> {
  await updateDoc(doc(db, "productos", id), { ...data, updatedAt: serverTimestamp() });
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
