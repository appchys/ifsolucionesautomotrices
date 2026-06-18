"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { createPortal } from "react-dom";
import AppShell from "@/components/layout/AppShell";
import GmailXmlSidebar from "@/components/compras/GmailXmlSidebar";
import type { PendingCompraDraft } from "@/components/compras/GmailXmlSidebar";
import { useUIStore } from "@/store";
import {
  createDevolucionProveedor,
  createCompraConInventario,
  deleteCompra,
  getCompraByClaveAcceso,
  getCompras,
  getDevolucionesProveedorByCompra,
  getGmailXmlDrafts,
  syncCompraInventario,
  updateCompraPagos,
  updateGmailXmlDraftStatus,
  upsertGmailXmlDraft,
  getProductoBySku,
  updateProducto,
  calcularPrecioVenta,
  resolverMargenProducto,
} from "@/lib/services";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { BANCOS_TRANSFERENCIA, BANCO_TRANSFERENCIA_LIST_ID } from "@/lib/paymentBanks";
import type { Compra, CompraItem, CompraMetodoPago, CompraPago, DevolucionProveedor, EstadoPago, GmailXmlDraft, MetodoDevolucionProveedor, Producto } from "@/types";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Building,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  ExternalLink,
  FileText,
  Hash,
  Info,
  Loader2,
  Mail,
  Package,
  Plus,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";

function childText(parent: Element | Document, name: string): string {
  const root = parent instanceof Document ? parent.documentElement : parent;
  const child = Array.from(root.children).find((el) => el.localName === name);
  return child?.textContent?.trim() ?? "";
}

function parseMoney(value: string): number {
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseXmlDocument(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const error = doc.getElementsByTagName("parsererror")[0];
  if (error) throw new Error("XML_INVALIDO");
  return doc;
}

function getDescendantsByLocalName(parent: Element, name: string): Element[] {
  return Array.from(parent.getElementsByTagName("*")).filter((el) => el.localName === name);
}

function parseIvaDetalle(detalle: Element): { valor: number; tarifa: number; baseImponible: number } {
  const impuestos = getDescendantsByLocalName(detalle, "impuesto");
  const ivaImpuestos = impuestos.filter((impuesto) => childText(impuesto, "codigo") === "2");
  const impuestosParaIva = ivaImpuestos.length > 0 ? ivaImpuestos : impuestos;

  if (impuestosParaIva.length === 0) return { valor: 0, tarifa: 0, baseImponible: 0 };

  return impuestosParaIva.reduce(
    (total, impuesto) => {
      const valor = parseMoney(childText(impuesto, "valor"));
      const baseImponible = parseMoney(childText(impuesto, "baseImponible"));
      const tarifa = parseMoney(childText(impuesto, "tarifa"));

      return {
        valor: total.valor + valor,
        baseImponible: total.baseImponible + baseImponible,
        tarifa: tarifa > total.tarifa ? tarifa : total.tarifa,
      };
    },
    { valor: 0, baseImponible: 0, tarifa: 0 }
  );
}

function parseCompraXml(xml: string, archivoNombre: string): Omit<Compra, "id"> {
  const outerDoc = parseXmlDocument(xml);
  const comprobante = childText(outerDoc, "comprobante");
  const facturaDoc = comprobante ? parseXmlDocument(comprobante) : outerDoc;
  const factura = Array.from(facturaDoc.getElementsByTagName("*")).find(
    (el) => el.localName === "factura"
  );

  if (!factura) throw new Error("FACTURA_NO_ENCONTRADA");

  const infoTributaria = Array.from(factura.children).find((el) => el.localName === "infoTributaria");
  const infoFactura = Array.from(factura.children).find((el) => el.localName === "infoFactura");
  const detalles = Array.from(factura.children).find((el) => el.localName === "detalles");

  if (!infoTributaria || !infoFactura || !detalles) throw new Error("FACTURA_INCOMPLETA");

  const establecimiento = childText(infoTributaria, "estab");
  const puntoEmision = childText(infoTributaria, "ptoEmi");
  const secuencial = childText(infoTributaria, "secuencial");

  const items: CompraItem[] = Array.from(detalles.children)
    .filter((el) => el.localName === "detalle")
    .map((detalle) => {
      const subtotalSinImpuesto = parseMoney(childText(detalle, "precioTotalSinImpuesto"));
      const iva = parseIvaDetalle(detalle);

      return {
        codigo: childText(detalle, "codigoPrincipal"),
        descripcion: childText(detalle, "descripcion"),
        cantidad: parseMoney(childText(detalle, "cantidad")),
        precioUnitario: parseMoney(childText(detalle, "precioUnitario")),
        descuento: parseMoney(childText(detalle, "descuento")),
        subtotalSinImpuesto,
        impuesto: iva.valor,
        tarifaIva: iva.tarifa,
        baseImponibleIva: iva.baseImponible,
        total: subtotalSinImpuesto + iva.valor,
      };
    });

  if (items.length === 0) throw new Error("SIN_PRODUCTOS");

  return {
    estadoAutorizacion: childText(outerDoc, "estado"),
    numeroAutorizacion: childText(outerDoc, "numeroAutorizacion"),
    fechaAutorizacion: childText(outerDoc, "fechaAutorizacion"),
    proveedorRazonSocial: childText(infoTributaria, "razonSocial"),
    proveedorRuc: childText(infoTributaria, "ruc"),
    claveAcceso: childText(infoTributaria, "claveAcceso"),
    establecimiento,
    puntoEmision,
    secuencial,
    numeroFactura: [establecimiento, puntoEmision, secuencial].filter(Boolean).join("-"),
    fechaEmision: childText(infoFactura, "fechaEmision"),
    compradorRazonSocial: childText(infoFactura, "razonSocialComprador"),
    compradorIdentificacion: childText(infoFactura, "identificacionComprador"),
    totalSinImpuestos: parseMoney(childText(infoFactura, "totalSinImpuestos")),
    totalDescuento: parseMoney(childText(infoFactura, "totalDescuento")),
    importeTotal: parseMoney(childText(infoFactura, "importeTotal")),
    moneda: childText(infoFactura, "moneda") || "DOLAR",
    items,
    archivoNombre,
  };
}

type XmlFileContent = {
  name: string;
  text: string;
};

type GmailStatus = {
  connected: boolean;
  email?: string;
};

type GmailAttachment = {
  messageId: string;
  filename: string;
  mimeType: string;
  size: number;
  dataBase64: string;
  messageSubject: string;
  messageDate: string;
};

type GmailInvoiceLabel = "Pendiente" | "Procesado" | "Guardado" | "Descartado";
type GmailLabelResult = { ok: true } | { ok: false; reconnect: boolean };

function isZipFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed";
}

function isXmlFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".xml") || file.type === "text/xml" || file.type === "application/xml";
}

function findEndOfCentralDirectory(view: DataView): number {
  const minOffset = Math.max(0, view.byteLength - 0xffff - 22);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error("ZIP_INVALIDO");
}

async function inflateRawZipEntry(data: Uint8Array): Promise<string> {
  const DecompressionStreamCtor = globalThis.DecompressionStream as
    | (new (format: string) => DecompressionStream)
    | undefined;

  if (!DecompressionStreamCtor) throw new Error("ZIP_NO_SOPORTADO");

  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStreamCtor("deflate-raw"));
  return await new Response(stream).text();
}

async function extractXmlFilesFromZip(file: File): Promise<XmlFileContent[]> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  const eocdOffset = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  let centralOffset = view.getUint32(eocdOffset + 16, true);
  const xmlFiles: XmlFileContent[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(centralOffset, true) !== 0x02014b50) throw new Error("ZIP_INVALIDO");

    const flags = view.getUint16(centralOffset + 8, true);
    const method = view.getUint16(centralOffset + 10, true);
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const fileNameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localHeaderOffset = view.getUint32(centralOffset + 42, true);
    const fileName = decoder.decode(bytes.slice(centralOffset + 46, centralOffset + 46 + fileNameLength));

    centralOffset += 46 + fileNameLength + extraLength + commentLength;

    if (!fileName.toLowerCase().endsWith(".xml") || fileName.endsWith("/")) continue;
    if ((flags & 0x1) === 0x1) throw new Error("ZIP_ENCRIPTADO");
    if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) throw new Error("ZIP_INVALIDO");

    const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressedData = bytes.slice(dataOffset, dataOffset + compressedSize);

    if (method === 0) {
      xmlFiles.push({ name: `${file.name}/${fileName}`, text: decoder.decode(compressedData) });
    } else if (method === 8) {
      xmlFiles.push({ name: `${file.name}/${fileName}`, text: await inflateRawZipEntry(compressedData) });
    } else {
      throw new Error("ZIP_COMPRESION_NO_SOPORTADA");
    }
  }

  return xmlFiles;
}

async function readXmlCandidates(file: File): Promise<XmlFileContent[]> {
  if (isXmlFile(file)) return [{ name: file.name, text: await file.text() }];
  if (isZipFile(file)) return extractXmlFilesFromZip(file);
  throw new Error("ARCHIVO_NO_SOPORTADO");
}

function fileFromBase64(dataBase64: string, filename: string, mimeType: string): File {
  const bytes = Uint8Array.from(atob(dataBase64), (char) => char.charCodeAt(0));
  return new File([bytes], filename, { type: mimeType || "application/octet-stream" });
}

function waitForFirebaseUser(timeoutMs = 5000): Promise<User | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe = () => {};
    const finish = (user: User | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe();
      resolve(user);
    };
    const timeout = window.setTimeout(() => finish(auth.currentUser), timeoutMs);
    unsubscribe = onAuthStateChanged(auth, finish, () => finish(null));
  });
}

async function getGmailAuthHeaders(): Promise<Record<string, string>> {
  const user = await waitForFirebaseUser();
  const token = await user?.getIdToken();
  if (!token) throw new Error("AUTH_REQUIRED");
  return { Authorization: `Bearer ${token}` };
}

async function labelGmailMessages(messageIds: (string | undefined)[], label: GmailInvoiceLabel): Promise<GmailLabelResult> {
  const uniqueMessageIds = Array.from(new Set(messageIds.filter((id): id is string => Boolean(id))));
  if (uniqueMessageIds.length === 0) return { ok: true };

  const response = await fetch("/api/gmail/labels", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getGmailAuthHeaders()) },
    credentials: "same-origin",
    body: JSON.stringify({ messageIds: uniqueMessageIds, label }),
  });
  if (response.ok) return { ok: true };

  const data = (await response.json().catch(() => ({}))) as { detail?: string };
  return {
    ok: false,
    reconnect: response.status === 401 || response.status === 403 || data.detail?.includes("insufficient") === true,
  };
}

function formatMoney(value: number): string {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getDevolucionProveedorValorUnitario(devolucion: DevolucionProveedor): number {
  const precioUnitario = Number(devolucion.precioUnitario || 0);
  const impuestoUnitario = Number(devolucion.impuestoUnitario || 0);
  const valorUnitario = precioUnitario + impuestoUnitario;
  if (valorUnitario > 0) return valorUnitario;

  const cantidad = Number(devolucion.cantidad || 0);
  return cantidad > 0 ? Number(devolucion.subtotalDevuelto || 0) / cantidad : 0;
}

const COMPRA_METODOS_PAGO: { value: CompraMetodoPago; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta_debito", label: "Tarjeta de debito" },
  { value: "nota_credito", label: "Nota de credito" },
  { value: "otro", label: "Otro" },
];

const ESTADO_PAGO_LABELS: Record<EstadoPago, string> = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  pagado: "Pagado",
};

const DEVOLUCION_PROVEEDOR_METODOS: { value: MetodoDevolucionProveedor; label: string }[] = [
  { value: "nota_credito", label: "Nota de credito" },
  { value: "transferencia", label: "Transferencia" },
  { value: "descuento_pendiente", label: "Descuento pendiente" },
  { value: "sin_credito", label: "Sin credito" },
];

function getCompraPagos(compra?: Compra | Omit<Compra, "id"> | null): CompraPago[] {
  return compra?.pagosProveedor ?? [];
}

function getCompraTotalPagado(compra?: Compra | Omit<Compra, "id"> | null): number {
  if (!compra) return 0;
  if (typeof compra.totalPagadoProveedor === "number") return compra.totalPagadoProveedor;
  return getCompraPagos(compra).reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
}

function getCompraSaldo(compra?: Compra | Omit<Compra, "id"> | null): number {
  if (!compra) return 0;
  if (typeof compra.saldoProveedor === "number") return compra.saldoProveedor;
  return Math.max(compra.importeTotal - getCompraTotalPagado(compra) - Number(compra.totalDevueltoProveedor ?? 0), 0);
}

function getCompraEstadoPago(compra?: Compra | Omit<Compra, "id"> | null): EstadoPago {
  if (!compra) return "pendiente";
  if (compra.estadoPagoProveedor) return compra.estadoPagoProveedor;
  const pagado = getCompraTotalPagado(compra);
  if (pagado >= compra.importeTotal - 0.01) return "pagado";
  if (pagado > 0.01) return "parcial";
  return "pendiente";
}

function withCompraPaymentSummary<T extends Omit<Compra, "id"> | Compra>(compra: T, pagosProveedor: CompraPago[]): T {
  const totalPagadoProveedor = Number(
    pagosProveedor.reduce((sum, pago) => sum + Number(pago.monto || 0), 0).toFixed(2)
  );
  const totalDevueltoProveedor = Number(compra.totalDevueltoProveedor ?? 0);
  const saldoProveedor = Number(Math.max(compra.importeTotal - totalPagadoProveedor - totalDevueltoProveedor, 0).toFixed(2));
  const estadoPagoProveedor: EstadoPago =
    totalPagadoProveedor >= compra.importeTotal - 0.01
      ? "pagado"
      : totalPagadoProveedor > 0.01
        ? "parcial"
        : "pendiente";

  return {
    ...compra,
    pagosProveedor,
    totalPagadoProveedor,
    saldoProveedor,
    estadoPagoProveedor,
  };
}

function getEstadoPagoBadgeClass(estado: EstadoPago): string {
  if (estado === "pagado") return "badge-green";
  if (estado === "parcial") return "badge-blue";
  return "badge-yellow";
}

function getMetodoPagoLabel(metodo: CompraMetodoPago): string {
  return COMPRA_METODOS_PAGO.find((item) => item.value === metodo)?.label ?? metodo;
}

function getMetodoDevolucionProveedorLabel(metodo: MetodoDevolucionProveedor): string {
  return DEVOLUCION_PROVEEDOR_METODOS.find((item) => item.value === metodo)?.label ?? metodo;
}

function buildDefaultCompraPago(compra: Omit<Compra, "id">): CompraPago[] {
  if (compra.importeTotal <= 0) return [];

  return [
    {
      monto: Number(compra.importeTotal.toFixed(2)),
      metodoPago: "efectivo",
      fecha: new Date().toISOString(),
    },
  ];
}

function mapPersistedGmailDraft(draft: GmailXmlDraft): PendingCompraDraft & { estado: GmailXmlDraft["estado"] } {
  const pagos = draft.pagos ?? [];
  return {
    id: draft.id ?? draft.compra.claveAcceso,
    compra: withCompraPaymentSummary(draft.compra, pagos),
    pagos,
    gmailMessageId: draft.gmailMessageId,
    estado: draft.estado,
  };
}

function getDraftPersistenceId(draft?: PendingCompraDraft | null): string | undefined {
  return draft?.id;
}

export default function ComprasPage() {
  const { sidebarOpen } = useUIStore();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [selected, setSelected] = useState<Compra | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [draggingUpload, setDraggingUpload] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus>({ connected: false });
  const [gmailLoading, setGmailLoading] = useState(true);
  const [gmailImporting, setGmailImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingCompra, setSavingCompra] = useState(false);
  const [savingPago, setSavingPago] = useState(false);
  const [savingDevolucion, setSavingDevolucion] = useState(false);
  const [search, setSearch] = useState("");
  const [proveedoresSidebarOpen, setProveedoresSidebarOpen] = useState(false);
  const [pendingCompra, setPendingCompra] = useState<Omit<Compra, "id"> | null>(null);
  const [pendingCompras, setPendingCompras] = useState<PendingCompraDraft[]>([]);
  const [gmailXmlPanelOpen, setGmailXmlPanelOpen] = useState(false);
  const [savedGmailDrafts, setSavedGmailDrafts] = useState<PendingCompraDraft[]>([]);
  const [discardedGmailDrafts, setDiscardedGmailDrafts] = useState<PendingCompraDraft[]>([]);
  const [activePendingIndex, setActivePendingIndex] = useState(0);
  const [draftPagos, setDraftPagos] = useState<CompraPago[]>([]);
  const [pagoModalContext, setPagoModalContext] = useState<"draft" | "selected" | null>(null);
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoMetodo, setPagoMetodo] = useState<CompraMetodoPago>("efectivo");
  const [pagoBanco, setPagoBanco] = useState("");
  const [pagoReferencia, setPagoReferencia] = useState("");
  const [pagoNotas, setPagoNotas] = useState("");
  const [selectedDevoluciones, setSelectedDevoluciones] = useState<DevolucionProveedor[]>([]);
  const [devolucionItemIndex, setDevolucionItemIndex] = useState(0);
  const [devolucionCantidad, setDevolucionCantidad] = useState("");
  const [devolucionMotivo, setDevolucionMotivo] = useState("");
  const [devolucionMetodo, setDevolucionMetodo] = useState<MetodoDevolucionProveedor>("nota_credito");
  const [devolucionBanco, setDevolucionBanco] = useState("");
  const [devolucionReferencia, setDevolucionReferencia] = useState("");
  const [devolucionNotas, setDevolucionNotas] = useState("");
  const [devolucionMotivoError, setDevolucionMotivoError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const devolucionMotivoRef = useRef<HTMLInputElement>(null);
  const autoGmailImportStartedRef = useRef(false);
  const gmailStatusRequestRef = useRef(0);
  const modalRoot = typeof document === "undefined" ? null : document.body;

  const [activeTab, setActiveTab] = useState<"resumen" | "pagos" | "productos" | "devoluciones">("resumen");
  const [copiedAcceso, setCopiedAcceso] = useState(false);
  const [copiedAutorizacion, setCopiedAutorizacion] = useState(false);
  const [expandedTributaria, setExpandedTributaria] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductForSidebar, setSelectedProductForSidebar] = useState<CompraItem | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"factura" | "inventario" | "historial">("factura");
  const [inventoryProduct, setInventoryProduct] = useState<Producto | null>(null);
  const [loadingInventoryProduct, setLoadingInventoryProduct] = useState(false);
  const [savingInventoryChanges, setSavingInventoryChanges] = useState(false);
  const [adjustedCosto, setAdjustedCosto] = useState("");
  const [adjustedMargen, setAdjustedMargen] = useState("");
  const [adjustedAplicaIva, setAdjustedAplicaIva] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setCopiedAcceso(false);
      setCopiedAutorizacion(false);
      setExpandedTributaria(false);
      setProductSearch("");
      setSelectedProductForSidebar(null);
      setSelectedDevoluciones([]);
      setDevolucionItemIndex(0);
      setDevolucionCantidad("");
      setDevolucionMotivo("");
      setDevolucionMetodo("nota_credito");
      setDevolucionBanco("");
      setDevolucionReferencia("");
      setDevolucionNotas("");
      setDevolucionMotivoError(false);
    }, 0);

    return () => window.clearTimeout(id);
  }, [selected]);

  useEffect(() => {
    if (!selectedProductForSidebar) {
      setInventoryProduct(null);
      setSidebarTab("factura");
      return;
    }

    let active = true;
    const loadInventoryProduct = async () => {
      setLoadingInventoryProduct(true);
      try {
        const sku = selectedProductForSidebar.codigo.trim().toUpperCase();
        if (sku) {
          const prod = await getProductoBySku(sku);
          if (active) {
            setInventoryProduct(prod);
            if (prod) {
              setAdjustedCosto(String(prod.costoBase ?? ""));
              setAdjustedMargen(String(prod.margenGanancia ?? ""));
              setAdjustedAplicaIva(prod.aplicaIva ?? false);
            } else {
              setAdjustedCosto("");
              setAdjustedMargen("");
              setAdjustedAplicaIva(false);
            }
          }
        }
      } catch (err) {
        console.error("Error al cargar producto del inventario:", err);
      } finally {
        if (active) setLoadingInventoryProduct(false);
      }
    };

    setSidebarTab("factura");
    void loadInventoryProduct();

    return () => {
      active = false;
    };
  }, [selectedProductForSidebar]);

  useEffect(() => {
    let active = true;
    if (!selected?.id) {
      const id = window.setTimeout(() => {
        if (active) setSelectedDevoluciones([]);
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(id);
      };
    }

    getDevolucionesProveedorByCompra(selected.id)
      .then((data) => {
        if (active) setSelectedDevoluciones(data);
      })
      .catch((error) => {
        console.error(error);
        if (active) toast.error("No se pudieron cargar las devoluciones al proveedor");
      });

    return () => {
      active = false;
    };
  }, [selected?.id]);

  const copyToClipboard = (text: string, type: "acceso" | "autorizacion") => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      if (type === "acceso") {
        setCopiedAcceso(true);
        setTimeout(() => setCopiedAcceso(false), 1500);
      } else {
        setCopiedAutorizacion(true);
        setTimeout(() => setCopiedAutorizacion(false), 1500);
      }
      toast.success("Copiado al portapapeles");
    }).catch((err) => {
      console.error("Error al copiar: ", err);
      toast.error("No se pudo copiar");
    });
  };

  const refreshGmailStatus = useCallback(async () => {
    const requestId = ++gmailStatusRequestRef.current;
    setGmailLoading(true);
    try {
      const response = await fetch("/api/gmail/status", {
        headers: await getGmailAuthHeaders(),
        credentials: "same-origin",
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          if (gmailStatusRequestRef.current === requestId) {
            setGmailStatus({ connected: false });
          }
          return { connected: false };
        }
        throw new Error("GMAIL_STATUS_FAILED");
      }
      const status = (await response.json()) as GmailStatus;
      if (requestId !== gmailStatusRequestRef.current) return status;
      setGmailStatus(status);
      return status;
    } catch (error) {
      console.error(error);
      if (gmailStatusRequestRef.current === requestId) {
        setGmailStatus({ connected: false });
      }
      return { connected: false };
    } finally {
      if (gmailStatusRequestRef.current === requestId) {
        setGmailLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([getCompras(), getGmailXmlDrafts()])
      .then(([data, gmailDrafts]) => {
        if (!active) return;
        setCompras(data);
        setSelected((current) => current ?? data[0] ?? null);
        const drafts = gmailDrafts.map(mapPersistedGmailDraft);
        const toSessionDraft = (draft: PendingCompraDraft & { estado: GmailXmlDraft["estado"] }): PendingCompraDraft => ({
          id: draft.id,
          compra: draft.compra,
          pagos: draft.pagos,
          gmailMessageId: draft.gmailMessageId,
        });
        const pendingDrafts = drafts.filter((draft) => draft.estado === "pendiente").map(toSessionDraft);
        const savedDrafts = drafts.filter((draft) => draft.estado === "guardado").map(toSessionDraft);
        const discardedDrafts = drafts.filter((draft) => draft.estado === "descartado").map(toSessionDraft);

        setPendingCompras(pendingDrafts);
        setSavedGmailDrafts(savedDrafts);
        setDiscardedGmailDrafts(discardedDrafts);
        if (pendingDrafts.length > 0) {
          activatePendingDraft(pendingDrafts[0], 0);
        }
      })
      .catch((error) => {
        console.error(error);
        toast.error("Error al cargar compras");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let retryCount = 0;
    const params = new URLSearchParams(window.location.search);
    const gmailResult = params.get("gmail");
    const gmailReason = params.get("reason");

    if (gmailResult === "connected") {
      toast.success("Gmail conectado");
      window.history.replaceState(null, "", window.location.pathname);
    } else if (gmailResult === "invalid-redirect") {
      toast.error("Abre la app en localhost o configura un dominio HTTPS para conectar Gmail");
      window.history.replaceState(null, "", window.location.pathname);
    } else if (gmailResult === "error") {
      const gmailErrorMessages: Record<string, string> = {
        access_denied: "Google no autorizo el acceso a Gmail",
        auth: "Inicia sesion antes de conectar Gmail",
        client: "Falta configurar GOOGLE_GMAIL_CLIENT_ID en el servidor",
        grant: "Google rechazo el codigo de autorizacion; intenta conectar Gmail otra vez",
        "invalid-redirect": "Abre la app en localhost o configura un dominio HTTPS para conectar Gmail",
        redirect: "El callback de Gmail no coincide con el autorizado en Google Cloud",
        secret: "Falta configurar GOOGLE_GMAIL_CLIENT_SECRET en el servidor",
        state: "La sesion de vinculacion vencio; intenta conectar Gmail otra vez",
        token: "Google no entrego los tokens de Gmail",
      };
      toast.error(gmailErrorMessages[gmailReason ?? ""] ?? "No se pudo conectar Gmail");
      window.history.replaceState(null, "", window.location.pathname);
    }

    const checkGmailStatus = async () => {
      const requestId = ++gmailStatusRequestRef.current;
      setGmailLoading(true);
      
      try {
        // Si viene del redirect de Gmail, esperar un poco para asegurar que la sesión está establecida
        if (gmailResult === "connected") {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (!active || requestId !== gmailStatusRequestRef.current) return;
        
        // Obtener headers con reintentos si la autenticación aún no está disponible
        let headers: Record<string, string> | null = null;
        let headerRetries = 0;
        while (headerRetries < 3) {
          try {
            headers = await getGmailAuthHeaders();
            break;
          } catch (error) {
            if (headerRetries < 2) {
              await new Promise(resolve => setTimeout(resolve, 200));
              headerRetries++;
            } else {
              throw error;
            }
          }
        }
        
        if (!active || requestId !== gmailStatusRequestRef.current || !headers) return;
        
        const response = await fetch("/api/gmail/status", {
          headers,
          credentials: "same-origin",
        });
        
        if (!response.ok) {
          throw new Error(`GMAIL_STATUS_ERROR: ${response.status}`);
        }
        
        const status = (await response.json()) as GmailStatus;
        if (!active || requestId !== gmailStatusRequestRef.current) return;
        
        // Si conectamos Gmail pero el estado dice que no está conectado, reintentar
        if (gmailResult === "connected" && !status.connected && retryCount < 2) {
          retryCount++;
          console.info(`[gmail:retry] Retentando verificación de estado (intento ${retryCount})`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return checkGmailStatus();
        }
        
        setGmailStatus(status);
      } catch (error) {
        console.error("Error al verificar estado de Gmail:", error);
        if (active && requestId === gmailStatusRequestRef.current) {
          setGmailStatus({ connected: false });
        }
      } finally {
        if (active && requestId === gmailStatusRequestRef.current) {
          setGmailLoading(false);
        }
      }
    };

    void checkGmailStatus();

    return () => {
      active = false;
      gmailStatusRequestRef.current += 1;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return compras;
    return compras.filter((compra) =>
      [
        compra.numeroFactura,
        compra.proveedorRazonSocial,
        compra.proveedorRuc,
        compra.claveAcceso,
        compra.fechaEmision,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [compras, search]);

  const selectedProductPriceHistory = useMemo(() => {
    if (!selectedProductForSidebar) return [];
    const sku = selectedProductForSidebar.codigo.trim().toUpperCase();
    if (!sku) return [];

    const history: {
      fecha: string;
      proveedor: string;
      factura: string;
      cantidad: number;
      precioUnitario: number;
      descuento: number;
      total: number;
    }[] = [];

    compras.forEach((compra) => {
      compra.items.forEach((item) => {
        if (item.codigo.trim().toUpperCase() === sku) {
          history.push({
            fecha: compra.fechaEmision || compra.fechaAutorizacion || "",
            proveedor: compra.proveedorRazonSocial,
            factura: compra.numeroFactura,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            descuento: item.descuento,
            total: item.total,
          });
        }
      });
    });

    return history;
  }, [selectedProductForSidebar, compras]);

  const handleSaveInventoryProductChanges = async () => {
    if (!inventoryProduct?.id) return;
    const costValue = Number(adjustedCosto);
    const marginValue = Number(adjustedMargen);
    if (!Number.isFinite(costValue) || costValue < 0) {
      toast.error("Por favor ingresa un costo de compra válido.");
      return;
    }
    if (!Number.isFinite(marginValue) || marginValue < 0) {
      toast.error("Por favor ingresa un margen de ganancia válido.");
      return;
    }

    setSavingInventoryChanges(true);
    try {
      const payload: Partial<Producto> = {
        costoBase: costValue,
        margenGanancia: marginValue,
        aplicaIva: adjustedAplicaIva,
        precioBase: calcularPrecioVenta(costValue, marginValue, adjustedAplicaIva),
      };
      await updateProducto(inventoryProduct.id, payload);
      setInventoryProduct((prev: Producto | null) => prev ? { ...prev, ...payload } : null);
      toast.success("Producto de inventario actualizado correctamente");
    } catch (err) {
      console.error("Error al actualizar producto de inventario:", err);
      toast.error("No se pudo guardar la información del producto");
    } finally {
      setSavingInventoryChanges(false);
    }
  };

  const totalComprado = compras.reduce((sum, compra) => sum + compra.importeTotal, 0);
  const totalItems = compras.reduce((sum, compra) => sum + compra.items.length, 0);
  const totalIvaPagado = compras.reduce(
    (sum, compra) => sum + compra.items.reduce((itemsSum, item) => itemsSum + item.impuesto, 0),
    0
  );
  const totalPagadoProveedores = compras.reduce((sum, compra) => sum + getCompraTotalPagado(compra), 0);
  const totalPendienteProveedores = compras.reduce((sum, compra) => sum + getCompraSaldo(compra), 0);
  const proveedoresPendientes = useMemo(() => {
    const grouped = new Map<
      string,
      {
        proveedorRazonSocial: string;
        proveedorRuc: string;
        totalFacturado: number;
        totalPagado: number;
        totalPendiente: number;
        compras: Compra[];
      }
    >();

    for (const compra of compras) {
      const pendiente = getCompraSaldo(compra);
      if (pendiente <= 0.01) continue;

      const key = compra.proveedorRuc || compra.proveedorRazonSocial || "proveedor-sin-datos";
      const current =
        grouped.get(key) ??
        {
          proveedorRazonSocial: compra.proveedorRazonSocial || "Proveedor sin nombre",
          proveedorRuc: compra.proveedorRuc || "Sin RUC",
          totalFacturado: 0,
          totalPagado: 0,
          totalPendiente: 0,
          compras: [],
        };

      current.totalFacturado += compra.importeTotal;
      current.totalPagado += getCompraTotalPagado(compra);
      current.totalPendiente += pendiente;
      current.compras.push(compra);
      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .map((proveedor) => ({
        ...proveedor,
        totalFacturado: Number(proveedor.totalFacturado.toFixed(2)),
        totalPagado: Number(proveedor.totalPagado.toFixed(2)),
        totalPendiente: Number(proveedor.totalPendiente.toFixed(2)),
        compras: proveedor.compras.sort((a, b) => getCompraSaldo(b) - getCompraSaldo(a)),
      }))
      .sort((a, b) => b.totalPendiente - a.totalPendiente);
  }, [compras]);
  const selectedIvaPagado =
    selected?.items.reduce((sum, item) => sum + item.impuesto, 0) ?? 0;
  const selectedPagosProveedor = getCompraPagos(selected);
  const selectedTotalPagadoProveedor = getCompraTotalPagado(selected);
  const selectedSaldoProveedor = getCompraSaldo(selected);
  const selectedEstadoPagoProveedor = getCompraEstadoPago(selected);
  const selectedTotalDevueltoProveedor = Number(selected?.totalDevueltoProveedor ?? 0);
  const devolucionesByItemIndex = useMemo(() => {
    const grouped = new Map<number, number>();
    for (const devolucion of selectedDevoluciones) {
      grouped.set(devolucion.itemIndex, (grouped.get(devolucion.itemIndex) ?? 0) + Number(devolucion.cantidad || 0));
    }
    return grouped;
  }, [selectedDevoluciones]);
  const selectedDevolucionItem = selected?.items[devolucionItemIndex] ?? null;
  const selectedDevolucionCantidadDisponible = selectedDevolucionItem
    ? Math.max(Number(selectedDevolucionItem.cantidad || 0) - (devolucionesByItemIndex.get(devolucionItemIndex) ?? 0), 0)
    : 0;
  const selectedDevolucionValorUnitario = selectedDevolucionItem
    ? Number(selectedDevolucionItem.precioUnitario || 0) + Number(selectedDevolucionItem.impuesto || 0) / Math.max(Number(selectedDevolucionItem.cantidad || 0), 1)
    : 0;
  const selectedDevolucionSubtotalEstimado = Number(
    (selectedDevolucionValorUnitario * Math.max(Number(devolucionCantidad || 0), 0)).toFixed(2)
  );
  const filteredSelectedItems = useMemo(() => {
    const term = productSearch.toLowerCase().trim();
    const items = selected?.items ?? [];
    if (!term) return items;
    return items.filter((item) => item.descripcion.toLowerCase().includes(term) || item.codigo.toLowerCase().includes(term));
  }, [productSearch, selected?.items]);

  const parseCompraFromCandidates = (
    candidates: XmlFileContent[],
    sourceIsZip: boolean,
    showToast = true
  ): Omit<Compra, "id"> | null => {
    if (candidates.length === 0) {
      if (showToast) toast.error("El ZIP no contiene archivos XML");
      return null;
    }

    let compra: Omit<Compra, "id"> | null = null;
    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        compra = parseCompraXml(candidate.text, candidate.name);
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!compra) {
      console.error(lastError);
      if (showToast) {
        toast.error(sourceIsZip ? "No se encontro una factura XML valida dentro del ZIP" : "No se pudo leer la compra del XML");
      }
      return null;
    }

    if (!compra.claveAcceso) {
      if (showToast) toast.error("El XML no tiene clave de acceso");
      return null;
    }

    return compra;
  };

  const syncOrCheckExistingCompra = async (
    compra: Omit<Compra, "id">,
    options: { notifyDuplicate?: boolean } = {}
  ): Promise<"new" | "synced" | "duplicate"> => {
    const notifyDuplicate = options.notifyDuplicate ?? true;
    const existing = await getCompraByClaveAcceso(compra.claveAcceso);
    if (existing) {
      if (existing.inventarioSincronizado) {
        setSelected(existing);
        if (notifyDuplicate) toast("Esta compra ya estaba registrada y sincronizada");
        return "duplicate";
      }

      const sync = await syncCompraInventario(existing);
      const synced = {
        ...existing,
        inventarioSincronizado: true,
        productosCreados: sync.productosCreados,
        productosActualizados: sync.productosActualizados,
      };
      setCompras((prev) => prev.map((item) => (item.id === synced.id ? synced : item)));
      setSelected(synced);
      toast.success(
        `Compra existente sincronizada: ${sync.productosCreados} nuevos, ${sync.productosActualizados} actualizados`
      );
      return "synced";
    }

    return "new";
  };

  function activatePendingDraft(draft: PendingCompraDraft, index: number) {
    const compra = withCompraPaymentSummary(draft.compra, draft.pagos);
    const firstPago = draft.pagos[0];

    setActivePendingIndex(index);
    setPendingCompra(compra);
    setDraftPagos(draft.pagos);
    setPagoMonto(firstPago ? firstPago.monto.toFixed(2) : "");
    setPagoMetodo(firstPago?.metodoPago ?? "efectivo");
    setPagoBanco(firstPago?.banco ?? "");
    setPagoReferencia(firstPago?.referencia ?? "");
    setPagoNotas(firstPago?.notas ?? "");
  }

  const createPendingDraft = (compra: Omit<Compra, "id">, gmailMessageId?: string): PendingCompraDraft => {
    const defaultPagos = buildDefaultCompraPago(compra);
    return {
      compra: withCompraPaymentSummary(compra, defaultPagos),
      pagos: defaultPagos,
      gmailMessageId,
    };
  };

  const processXmlCandidates = async (
    candidates: XmlFileContent[],
    sourceIsZip: boolean
  ): Promise<"pending" | "synced" | "duplicate" | "invalid" | "empty"> => {
    const compra = parseCompraFromCandidates(candidates, sourceIsZip);
    if (!compra) return candidates.length === 0 ? "empty" : "invalid";

    const status = await syncOrCheckExistingCompra(compra);
    if (status !== "new") return status;

    const draft = createPendingDraft(compra);
    setPendingCompras([draft]);
    setGmailXmlPanelOpen(true);
    activatePendingDraft(draft, 0);
    return "pending";
  };

  const processInvoiceFile = async (file: File) => {
    if (!file) return;

    setUploading(true);
    const sourceIsZip = isZipFile(file);
    try {
      await processXmlCandidates(await readXmlCandidates(file), sourceIsZip);
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "ARCHIVO_NO_SOPORTADO") {
        toast.error("Carga un archivo XML o ZIP");
      } else if (error instanceof Error && error.message === "ZIP_ENCRIPTADO") {
        toast.error("No se puede leer un ZIP protegido con contrasena");
      } else if (error instanceof Error && error.message === "ZIP_COMPRESION_NO_SOPORTADA") {
        toast.error("El ZIP usa un metodo de compresion no soportado");
      } else if (error instanceof Error && error.message === "ZIP_NO_SOPORTADO") {
        toast.error("Tu navegador no puede descomprimir este ZIP");
      } else {
        toast.error(sourceIsZip ? "No se pudo leer el ZIP" : "No se pudo leer la compra del XML");
      }
    } finally {
      setUploading(false);
      setDraggingUpload(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processInvoiceFile(file);
  };

  const handleUploadDrop = async (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDraggingUpload(false);
    const file = event.dataTransfer.files?.[0];
    if (!file || uploading) return;
    await processInvoiceFile(file);
  };

  const handleConnectGmail = async () => {
    setGmailLoading(true);
    try {
      const response = await fetch("/api/gmail/auth", {
        method: "POST",
        headers: await getGmailAuthHeaders(),
        credentials: "same-origin",
      });
      const data = (await response.json()) as { url?: string; redirect?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      throw new Error("GMAIL_AUTH_URL_FAILED");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo iniciar la conexion con Gmail");
      setGmailLoading(false);
    }
  };

  const handleDisconnectGmail = async () => {
    gmailStatusRequestRef.current += 1;
    setGmailLoading(true);
    try {
      await fetch("/api/gmail/status", {
        method: "DELETE",
        headers: await getGmailAuthHeaders(),
        credentials: "same-origin",
      });
      setGmailStatus({ connected: false });
      toast.success("Gmail desconectado");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo desconectar Gmail");
    } finally {
      setGmailLoading(false);
    }
  };

  const handleImportFromGmail = async (options: { silentNoResults?: boolean } = {}) => {
    if (gmailImporting) return;

    const currentDraftPagos = pendingCompra ? buildInitialPagosFromForm() : null;
    if (pendingCompra && !currentDraftPagos) return;

    setGmailImporting(true);
    try {
      const status = gmailStatus.connected ? gmailStatus : await refreshGmailStatus();
      if (!status.connected) {
        toast.error("Conecta Gmail para buscar adjuntos");
        return;
      }

      const response = await fetch("/api/gmail/attachments?maxResults=10", {
        headers: await getGmailAuthHeaders(),
        credentials: "same-origin",
      });
      if (response.status === 401) {
        setGmailStatus({ connected: false });
        toast.error("Vuelve a conectar Gmail");
        return;
      }
      if (!response.ok) throw new Error("GMAIL_ATTACHMENTS_FAILED");

      const data = (await response.json()) as { attachments?: GmailAttachment[] };
      const attachments = data.attachments ?? [];
      if (attachments.length === 0) {
        if (!options.silentNoResults) toast("No encontre adjuntos XML o ZIP recientes en Gmail");
        return;
      }

      let processed = 0;
      const drafts: PendingCompraDraft[] = [];
      const seenClaveAcceso = new Set<string>([
        ...pendingCompras.map((draft) => draft.compra.claveAcceso),
        ...savedGmailDrafts.map((draft) => draft.compra.claveAcceso),
        ...discardedGmailDrafts.map((draft) => draft.compra.claveAcceso),
      ]);

      for (const attachment of attachments) {
        const file = fileFromBase64(attachment.dataBase64, attachment.filename, attachment.mimeType);
        try {
          const candidates = await readXmlCandidates(file);
          for (const candidate of candidates) {
            const compra = parseCompraFromCandidates([candidate], isZipFile(file), false);
            if (!compra) continue;
            if (seenClaveAcceso.has(compra.claveAcceso)) {
              processed += 1;
              continue;
            }
            seenClaveAcceso.add(compra.claveAcceso);

            const result = await syncOrCheckExistingCompra(compra, { notifyDuplicate: false });
            if (result === "new") {
              const draft = createPendingDraft(compra, attachment.messageId);
              const id = await upsertGmailXmlDraft({
                compra: draft.compra,
                pagos: draft.pagos,
                gmailMessageId: draft.gmailMessageId,
                estado: "pendiente",
              });
              drafts.push({ ...draft, id });
            } else {
              processed += 1;
            }
          }
        } catch (error) {
          console.error(error);
        }
      }

      if (drafts.length > 0) {
        const hadPendingDrafts = pendingCompras.length > 0;
        setPendingCompras((prev) => {
          const syncedPrev = prev.map((draft, draftIndex) =>
            draftIndex === activePendingIndex && pendingCompra && currentDraftPagos
              ? { ...draft, compra: withCompraPaymentSummary(pendingCompra, currentDraftPagos), pagos: currentDraftPagos }
              : draft
          );
          return [...syncedPrev, ...drafts];
        });
        setGmailXmlPanelOpen(true);
        if (!hadPendingDrafts) activatePendingDraft(drafts[0], 0);
        toast.success(`${drafts.length} factura${drafts.length === 1 ? "" : "s"} XML encontrada${drafts.length === 1 ? "" : "s"} en Gmail`);
        void labelGmailMessages(drafts.map((draft) => draft.gmailMessageId), "Pendiente")
          .then((labelResult) => {
            if (!labelResult.ok && labelResult.reconnect) {
              toast("Reconecta Gmail para permitir etiquetas automaticas");
            }
          })
          .catch((error) => {
            console.error(error);
            toast("XML pendientes guardados, pero no se pudo etiquetar Gmail");
          });
        return;
      }

      if (!options.silentNoResults) {
        toast(processed > 0 ? "Revise los adjuntos encontrados; no hay compras nuevas pendientes" : "No se pudo leer una factura valida en los adjuntos recientes");
      }
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron leer los adjuntos de Gmail");
    } finally {
      setGmailImporting(false);
    }
  };

  const handleOpenGmailPanelAndRefresh = async () => {
    setGmailXmlPanelOpen(true);
    await handleImportFromGmail();
  };

  useEffect(() => {
    if (autoGmailImportStartedRef.current || loading || gmailLoading || !gmailStatus.connected) return;
    autoGmailImportStartedRef.current = true;
    void handleImportFromGmail({ silentNoResults: true });
  }, [gmailLoading, gmailStatus.connected, handleImportFromGmail, loading]);

  const resetPagoForm = (nextMonto = "") => {
    setPagoMonto(nextMonto);
    setPagoMetodo("efectivo");
    setPagoBanco("");
    setPagoReferencia("");
    setPagoNotas("");
  };

  const buildPagoFromForm = (saldoDisponible: number): CompraPago | null => {
    const monto = Number(pagoMonto);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error("Ingrese un monto valido");
      return null;
    }
    if (monto > saldoDisponible + 0.01) {
      toast.error(`El pago no puede superar el monto disponible (${formatMoney(saldoDisponible)})`);
      return null;
    }
    if (pagoMetodo === "transferencia" && !pagoBanco.trim()) {
      toast.error("Indique el banco de la transferencia");
      return null;
    }

    return {
      monto: Number(monto.toFixed(2)),
      metodoPago: pagoMetodo,
      banco: pagoMetodo === "transferencia" ? pagoBanco.trim() : undefined,
      referencia: pagoReferencia.trim() || undefined,
      notas: pagoNotas.trim() || undefined,
      fecha: new Date().toISOString(),
    };
  };

  function buildInitialPagosFromForm(): CompraPago[] | null {
    if (!pendingCompra) return null;

    const rawMonto = pagoMonto.trim();
    if (!rawMonto) return [];

    const monto = Number(rawMonto);
    if (!Number.isFinite(monto) || monto < 0) {
      toast.error("Ingrese un monto valido");
      return null;
    }
    if (monto <= 0.01) return [];
    if (monto > pendingCompra.importeTotal + 0.01) {
      toast.error(`El abono inicial no puede superar el total de la factura (${formatMoney(pendingCompra.importeTotal)})`);
      return null;
    }
    if (pagoMetodo === "transferencia" && !pagoBanco.trim()) {
      toast.error("Indique el banco de la transferencia");
      return null;
    }

    return [
      {
        monto: Number(monto.toFixed(2)),
        metodoPago: pagoMetodo,
        banco: pagoMetodo === "transferencia" ? pagoBanco.trim() : undefined,
        referencia: pagoReferencia.trim() || undefined,
        notas: pagoNotas.trim() || undefined,
        fecha: draftPagos[0]?.fecha ?? new Date().toISOString(),
      },
    ];
  }

  const getInitialPagoPreview = () => {
    const monto = Number(pagoMonto);
    return Number.isFinite(monto) && monto > 0 ? Math.min(monto, pendingCompra?.importeTotal ?? monto) : 0;
  };

  const openPagoModal = (context: "draft" | "selected", saldo: number) => {
    resetPagoForm(saldo > 0 ? saldo.toFixed(2) : "");
    setPagoModalContext(context);
  };

  const openPagoModalForCompra = (compra: Compra) => {
    setSelected(compra);
    openPagoModal("selected", getCompraSaldo(compra));
  };

  const closePagoModal = () => {
    if (savingPago) return;
    setPagoModalContext(null);
    resetPagoForm("");
  };

  const handleAddDraftPago = (): boolean => {
    if (!pendingCompra) return false;
    const current = withCompraPaymentSummary(pendingCompra, draftPagos);
    const pago = buildPagoFromForm(getCompraSaldo(current));
    if (!pago) return false;
    const next = [...draftPagos, pago];
    setDraftPagos(next);
    setPendingCompra(withCompraPaymentSummary(pendingCompra, next));
    resetPagoForm("");
    return true;
  };

  const handleTogglePendingPagoEstado = () => {
    if (!pendingCompra || savingCompra) return;

    const initialPagoPreview = getInitialPagoPreview();
    const isPaid = pendingCompra.importeTotal - initialPagoPreview <= 0.01;
    const next = isPaid ? [] : buildDefaultCompraPago(pendingCompra);
    setDraftPagos(next);
    setPendingCompra(withCompraPaymentSummary(pendingCompra, next));
    if (isPaid) {
      resetPagoForm("");
    } else {
      const defaultPago = next[0];
      setPagoMonto(pendingCompra.importeTotal > 0 ? pendingCompra.importeTotal.toFixed(2) : "");
      setPagoMetodo(defaultPago?.metodoPago ?? "efectivo");
      setPagoBanco(defaultPago?.banco ?? "");
      setPagoReferencia(defaultPago?.referencia ?? "");
      setPagoNotas(defaultPago?.notas ?? "");
    }
  };

  const handleCancelPendingCompra = async () => {
    await Promise.all(
      pendingCompras
        .map(getDraftPersistenceId)
        .filter((id): id is string => Boolean(id))
        .map((id) => updateGmailXmlDraftStatus(id, "descartado"))
    );
    void labelGmailMessages(pendingCompras.map((draft) => draft.gmailMessageId), "Descartado")
      .then((labelResult) => {
        if (!labelResult.ok && labelResult.reconnect) {
          toast("No pude etiquetar en Gmail. Reconecta la cuenta para autorizar etiquetas.");
        }
      })
      .catch((error) => {
        console.error(error);
        toast("XML descartados, pero no se pudo etiquetar Gmail");
      });
    setDiscardedGmailDrafts((prev) => [...pendingCompras, ...prev]);
    setPendingCompra(null);
    setPendingCompras([]);
    setActivePendingIndex(0);
    setPagoModalContext(null);
    setDraftPagos([]);
    resetPagoForm("");
  };

  const handleDiscardActivePendingCompra = async () => {
    const activeDraft = pendingCompras[activePendingIndex];
    if (!activeDraft || savingCompra) return;

    const activeDraftId = getDraftPersistenceId(activeDraft);
    void labelGmailMessages([activeDraft.gmailMessageId], "Descartado")
      .then((labelResult) => {
        if (!labelResult.ok && labelResult.reconnect) {
          toast("No pude etiquetar en Gmail. Reconecta la cuenta para autorizar etiquetas.");
        }
      })
      .catch((error) => {
        console.error(error);
        toast("XML descartado, pero no se pudo etiquetar Gmail");
      });

    const currentPagos = buildInitialPagosFromForm();
    const discardedDraft = currentPagos && pendingCompra
      ? { ...activeDraft, compra: withCompraPaymentSummary(pendingCompra, currentPagos), pagos: currentPagos }
      : activeDraft;
    if (activeDraftId) {
      await upsertGmailXmlDraft({
        compra: discardedDraft.compra,
        pagos: discardedDraft.pagos,
        gmailMessageId: discardedDraft.gmailMessageId,
        estado: "descartado",
      });
    }

    setDiscardedGmailDrafts((prev) => [discardedDraft, ...prev]);
    const remaining = pendingCompras.filter((_, index) => index !== activePendingIndex);
    setPendingCompras(remaining);

    if (remaining.length > 0) {
      const nextIndex = Math.min(activePendingIndex, remaining.length - 1);
      activatePendingDraft(remaining[nextIndex], nextIndex);
    } else {
      setPendingCompra(null);
      setActivePendingIndex(0);
      setDraftPagos([]);
      resetPagoForm("");
    }

    toast.success("XML descartado");
  };

  const handleSelectPendingCompra = (index: number) => {
    if (savingCompra || index === activePendingIndex) return;
    const nextDraft = pendingCompras[index];
    if (!nextDraft) return;

    const currentPagos = buildInitialPagosFromForm();
    if (!currentPagos) return;

    setPendingCompras((prev) =>
      prev.map((draft, draftIndex) =>
        draftIndex === activePendingIndex && pendingCompra
          ? { ...draft, compra: withCompraPaymentSummary(pendingCompra, currentPagos), pagos: currentPagos }
          : draft
      )
    );
    activatePendingDraft(nextDraft, index);
  };

  const handleConfirmPendingCompra = async () => {
    if (!pendingCompra) return;
    const initialPagos = buildInitialPagosFromForm();
    if (!initialPagos) return;

    setSavingCompra(true);
    try {
      const activeDraft = pendingCompras[activePendingIndex];
      const compraConPagos = withCompraPaymentSummary(pendingCompra, initialPagos);
      const sync = await createCompraConInventario(compraConPagos);
      const saved = {
        id: sync.compraId,
        ...compraConPagos,
        inventarioSincronizado: true,
        productosCreados: sync.productosCreados,
        productosActualizados: sync.productosActualizados,
      };
      setCompras((prev) => [saved, ...prev]);
      setSelected(saved);
      const activeDraftId = getDraftPersistenceId(activeDraft);
      if (activeDraftId) {
        await upsertGmailXmlDraft({
          compra: compraConPagos,
          pagos: initialPagos,
          gmailMessageId: activeDraft?.gmailMessageId,
          estado: "guardado",
          compraId: sync.compraId,
        });
      }
      void labelGmailMessages([activeDraft?.gmailMessageId], "Guardado")
        .then((labelResult) => {
          if (!labelResult.ok && labelResult.reconnect) {
            toast("Compra guardada, pero Gmail necesita reconexion para etiquetar el correo");
          }
        })
        .catch((error) => {
          console.error(error);
          toast("Compra guardada, pero no se pudo etiquetar el correo en Gmail");
        });
      if (activeDraft) {
        setSavedGmailDrafts((prev) => [
          { ...activeDraft, compra: compraConPagos, pagos: initialPagos },
          ...prev,
        ]);
      }
      const remaining = pendingCompras.filter((_, index) => index !== activePendingIndex);
      setPendingCompras(remaining);
      if (remaining.length > 0) {
        const nextIndex = Math.min(activePendingIndex, remaining.length - 1);
        activatePendingDraft(remaining[nextIndex], nextIndex);
      } else {
        setPendingCompra(null);
        setActivePendingIndex(0);
        setDraftPagos([]);
        resetPagoForm("");
      }
      toast.success(
        `Compra cargada: ${sync.productosCreados} productos nuevos, ${sync.productosActualizados} con stock actualizado`
      );
    } catch (error) {
      console.error(error);
      toast.error("No se pudo guardar la compra");
    } finally {
      setSavingCompra(false);
    }
  };

  const handleConfirmAllPendingCompras = async () => {
    if (pendingCompras.length === 0 || savingCompra) return;

    const activePagos = pendingCompra ? buildInitialPagosFromForm() : null;
    if (pendingCompra && !activePagos) return;

    const draftsToSave = pendingCompras.map((draft, index) => {
      if (index === activePendingIndex && pendingCompra && activePagos) {
        return {
          ...draft,
          compra: withCompraPaymentSummary(pendingCompra, activePagos),
          pagos: activePagos,
        };
      }
      return {
        ...draft,
        compra: withCompraPaymentSummary(draft.compra, draft.pagos),
      };
    });

    setSavingCompra(true);
    try {
      const savedCompras: Compra[] = [];
      const savedDrafts: PendingCompraDraft[] = [];
      let productosCreados = 0;
      let productosActualizados = 0;

      for (const draft of draftsToSave) {
        const compraConPagos = withCompraPaymentSummary(draft.compra, draft.pagos);
        const sync = await createCompraConInventario(compraConPagos);
        const saved = {
          id: sync.compraId,
          ...compraConPagos,
          inventarioSincronizado: true,
          productosCreados: sync.productosCreados,
          productosActualizados: sync.productosActualizados,
        };
        savedCompras.push(saved);
        savedDrafts.push({ ...draft, compra: compraConPagos, pagos: draft.pagos });
        productosCreados += sync.productosCreados;
        productosActualizados += sync.productosActualizados;

        const draftId = getDraftPersistenceId(draft);
        if (draftId) {
          await upsertGmailXmlDraft({
            compra: compraConPagos,
            pagos: draft.pagos,
            gmailMessageId: draft.gmailMessageId,
            estado: "guardado",
            compraId: sync.compraId,
          });
        }
      }

      setCompras((prev) => [...savedCompras, ...prev]);
      setSelected(savedCompras[0] ?? null);
      setSavedGmailDrafts((prev) => [...savedDrafts, ...prev]);
      void labelGmailMessages(draftsToSave.map((draft) => draft.gmailMessageId), "Guardado")
        .then((labelResult) => {
          if (!labelResult.ok && labelResult.reconnect) {
            toast("Compras guardadas, pero Gmail necesita reconexion para etiquetar los correos");
          }
        })
        .catch((error) => {
          console.error(error);
          toast("Compras guardadas, pero no se pudieron etiquetar los correos en Gmail");
        });
      setPendingCompra(null);
      setPendingCompras([]);
      setActivePendingIndex(0);
      setDraftPagos([]);
      resetPagoForm("");
      toast.success(
        `${savedCompras.length} compras cargadas: ${productosCreados} productos nuevos, ${productosActualizados} con stock actualizado`
      );
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron guardar todas las compras");
    } finally {
      setSavingCompra(false);
    }
  };

  const handleAddSelectedPago = async (): Promise<boolean> => {
    if (!selected?.id) return false;
    const pago = buildPagoFromForm(selectedSaldoProveedor);
    if (!pago) return false;
    setSavingPago(true);
    try {
      const nextPagos = [...selectedPagosProveedor, pago];
      const nextSelected = withCompraPaymentSummary(selected, nextPagos);
      await updateCompraPagos(selected.id, nextPagos, selected.importeTotal, selectedTotalDevueltoProveedor);
      setCompras((prev) => prev.map((item) => (item.id === selected.id ? nextSelected : item)));
      setSelected(nextSelected);
      resetPagoForm("");
      toast.success("Pago al proveedor registrado");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("No se pudo registrar el pago");
      return false;
    } finally {
      setSavingPago(false);
    }
  };

  const handleSubmitPagoModal = async () => {
    if (pagoModalContext === "draft") {
      if (handleAddDraftPago()) setPagoModalContext(null);
      return;
    }

    if (pagoModalContext === "selected") {
      const saved = await handleAddSelectedPago();
      if (saved) setPagoModalContext(null);
    }
  };

  const handleRemoveSelectedPago = async (index: number) => {
    if (!selected?.id) return;
    const nextPagos = selectedPagosProveedor.filter((_, itemIndex) => itemIndex !== index);
    setSavingPago(true);
    try {
      const nextSelected = withCompraPaymentSummary(selected, nextPagos);
      await updateCompraPagos(selected.id, nextPagos, selected.importeTotal, selectedTotalDevueltoProveedor);
      setCompras((prev) => prev.map((item) => (item.id === selected.id ? nextSelected : item)));
      setSelected(nextSelected);
      toast.success("Pago eliminado");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo eliminar el pago");
    } finally {
      setSavingPago(false);
    }
  };

  const resetDevolucionForm = () => {
    setDevolucionCantidad("");
    setDevolucionMotivo("");
    setDevolucionMetodo("nota_credito");
    setDevolucionBanco("");
    setDevolucionReferencia("");
    setDevolucionNotas("");
    setDevolucionMotivoError(false);
  };

  const handleCreateDevolucionProveedor = async () => {
    if (!selected?.id || !selectedDevolucionItem) return;
    if (!selected.inventarioSincronizado) {
      toast.error("Primero sincroniza esta compra con inventario");
      return;
    }

    const cantidad = Number(devolucionCantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      toast.error("Ingrese una cantidad valida");
      return;
    }
    if (cantidad > selectedDevolucionCantidadDisponible + 0.0001) {
      toast.error(`Solo quedan ${selectedDevolucionCantidadDisponible} unidad(es) disponibles para devolver`);
      return;
    }
    if (!devolucionMotivo.trim()) {
      setDevolucionMotivoError(true);
      devolucionMotivoRef.current?.focus();
      toast.error("Completa el motivo de la devolucion");
      return;
    }
    if (devolucionMetodo === "transferencia" && !devolucionBanco.trim()) {
      toast.error("Indique el banco donde recibiste la transferencia");
      return;
    }

    setSavingDevolucion(true);
    try {
      await createDevolucionProveedor({
        compraId: selected.id,
        itemIndex: devolucionItemIndex,
        cantidad,
        motivo: devolucionMotivo,
        metodoDevolucion: devolucionMetodo,
        banco: devolucionBanco,
        referencia: devolucionReferencia,
        notas: devolucionNotas,
      });

      const refreshedDevoluciones = await getDevolucionesProveedorByCompra(selected.id);
      const totalDevueltoProveedor = Number(
        refreshedDevoluciones.reduce((sum, devolucion) => sum + Number(devolucion.subtotalDevuelto || 0), 0).toFixed(2)
      );
      const estadoPagoProveedor: EstadoPago =
        selected.importeTotal - selectedTotalPagadoProveedor - totalDevueltoProveedor <= 0.01
          ? "pagado"
          : selectedTotalPagadoProveedor > 0.01
            ? "parcial"
            : "pendiente";
      const nextSelected = {
        ...selected,
        totalDevueltoProveedor,
        saldoProveedor: Number(
          Math.max(selected.importeTotal - selectedTotalPagadoProveedor - totalDevueltoProveedor, 0).toFixed(2)
        ),
        estadoPagoProveedor,
      };

      setSelectedDevoluciones(refreshedDevoluciones);
      setCompras((prev) => prev.map((item) => (item.id === selected.id ? nextSelected : item)));
      setSelected(nextSelected);
      resetDevolucionForm();
      toast.success("Devolucion a proveedor registrada");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "";
      if (message === "STOCK_INSUFICIENTE") toast.error("No hay stock suficiente para devolver");
      else if (message === "DEVOLUCION_EXCEDE_CANTIDAD") toast.error("La devolucion supera la cantidad comprada");
      else if (message === "BANCO_REQUERIDO") toast.error("Indique el banco de la transferencia");
      else if (message === "MOTIVO_REQUERIDO") {
        setDevolucionMotivoError(true);
        devolucionMotivoRef.current?.focus();
        toast.error("Completa el motivo de la devolucion");
      }
      else toast.error("No se pudo registrar la devolucion");
    } finally {
      setSavingDevolucion(false);
    }
  };

  const handleSyncSelected = async () => {
    if (!selected || selected.inventarioSincronizado) return;
    setSyncing(true);
    try {
      const sync = await syncCompraInventario(selected);
      const synced = {
        ...selected,
        inventarioSincronizado: true,
        productosCreados: sync.productosCreados,
        productosActualizados: sync.productosActualizados,
      };
      setCompras((prev) => prev.map((item) => (item.id === synced.id ? synced : item)));
      setSelected(synced);
      toast.success(
        `Inventario sincronizado: ${sync.productosCreados} nuevos, ${sync.productosActualizados} actualizados`
      );
    } catch (error) {
      console.error(error);
      toast.error("No se pudo sincronizar el inventario");
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selected) return;
    const message = selected.inventarioSincronizado
      ? "Esta compra ya sincronizo stock. Al eliminarla se restaran sus cantidades del inventario. Deseas continuar?"
      : "Deseas eliminar esta compra?";
    if (!confirm(message)) return;

    setDeleting(true);
    try {
      await deleteCompra(selected);
      const next = compras.filter((item) => item.id !== selected.id);
      setCompras(next);
      setSelected(next[0] ?? null);
      toast.success("Compra eliminada");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo eliminar la compra");
    } finally {
      setDeleting(false);
    }
  };

  const renderPagoForm = (saldo: number, onAdd: () => void, disabled = false) => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="form-group">
          <label className="label">Monto</label>
          <div className="relative">
            <DollarSign
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              type="number"
              className="input pl-8"
              placeholder="0.00"
              value={pagoMonto}
              onChange={(event) => setPagoMonto(event.target.value)}
              step="0.01"
              disabled={disabled || saldo <= 0.01}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="label">Metodo</label>
          <select
            className="input"
            value={pagoMetodo}
            onChange={(event) => setPagoMetodo(event.target.value as CompraMetodoPago)}
            disabled={disabled || saldo <= 0.01}
          >
            {COMPRA_METODOS_PAGO.map((metodo) => (
              <option key={metodo.value} value={metodo.value}>
                {metodo.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {pagoMetodo === "transferencia" && (
        <div className="form-group">
          <label className="label">Banco</label>
          <input
            className="input"
            list={`${BANCO_TRANSFERENCIA_LIST_ID}-compras-modal`}
            placeholder="Selecciona o escribe el banco"
            value={pagoBanco}
            onChange={(event) => setPagoBanco(event.target.value)}
            disabled={disabled || saldo <= 0.01}
          />
          <datalist id={`${BANCO_TRANSFERENCIA_LIST_ID}-compras-modal`}>
            {BANCOS_TRANSFERENCIA.map((banco) => (
              <option key={banco} value={banco} />
            ))}
          </datalist>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="form-group">
          <label className="label">Referencia</label>
          <input
            className="input"
            placeholder="Comprobante, cheque, NC..."
            value={pagoReferencia}
            onChange={(event) => setPagoReferencia(event.target.value)}
            disabled={disabled || saldo <= 0.01}
          />
        </div>
        <div className="form-group">
          <label className="label">Notas</label>
          <input
            className="input"
            placeholder="Detalle opcional"
            value={pagoNotas}
            onChange={(event) => setPagoNotas(event.target.value)}
            disabled={disabled || saldo <= 0.01}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onAdd}
        disabled={disabled || saldo <= 0.01}
        className="btn-primary w-full justify-center"
      >
        {disabled ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
        Registrar pago
      </button>
    </div>
  );

  const renderPagoList = (pagos: CompraPago[], onRemove: (index: number) => void, disabled = false) => (
    <div className="space-y-2">
      {pagos.length === 0 ? (
        <p className="text-sm text-center py-4 rounded-lg" style={{ color: "var(--text-muted)", background: "var(--bg-secondary)" }}>
          Sin pagos registrados.
        </p>
      ) : (
        pagos.map((pago, index) => (
          <div
            key={`${pago.metodoPago}-${pago.monto}-${index}`}
            className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[var(--border)]"
          >
            <div className="min-w-0">
              <p className="font-mono font-bold text-sm text-[var(--success)]">{formatMoney(pago.monto)}</p>
              <p className="text-xs mt-1 text-[var(--text-secondary)]">
                {getMetodoPagoLabel(pago.metodoPago)}
                {pago.banco ? ` - ${pago.banco}` : ""}
                {pago.referencia ? ` - ${pago.referencia}` : ""}
              </p>
              {pago.notas && <p className="text-xs mt-1 text-[var(--text-muted)]">{pago.notas}</p>}
            </div>
            <button
              type="button"
              onClick={() => onRemove(index)}
              disabled={disabled}
              className="btn-ghost btn-icon"
              style={{ color: "var(--danger)" }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))
      )}
    </div>
  );

  const pagoModalSaldo =
    pagoModalContext === "draft" ? getCompraSaldo(pendingCompra) : selectedSaldoProveedor;
  const pagoModalProveedor =
    pagoModalContext === "draft" ? pendingCompra?.proveedorRazonSocial : selected?.proveedorRazonSocial;
  const pendingInitialPagoPreview = pendingCompra ? getInitialPagoPreview() : 0;
  const pendingSaldoPreview = pendingCompra
    ? Math.max(pendingCompra.importeTotal - pendingInitialPagoPreview - Number(pendingCompra.totalDevueltoProveedor ?? 0), 0)
    : 0;
  const pendingIsPaidPreview = pendingCompra ? pendingSaldoPreview <= 0.01 : false;
  const pendingXmlCount = pendingCompras.length || (pendingCompra ? 1 : 0);
  const savedXmlCount = savedGmailDrafts.length;
  const discardedXmlCount = discardedGmailDrafts.length;
  const gmailXmlTotalCount = pendingCompras.length + savedXmlCount + discardedXmlCount;

  return (
    <AppShell>
      {modalRoot && gmailXmlPanelOpen && createPortal(
        <GmailXmlSidebar
          sidebarOpen={sidebarOpen}
          pendingCompra={pendingCompra}
          pendingCompras={pendingCompras}
          savedGmailDrafts={savedGmailDrafts}
          discardedGmailDrafts={discardedGmailDrafts}
          activePendingIndex={activePendingIndex}
          draftPagos={draftPagos}
          gmailImporting={gmailImporting}
          savingCompra={savingCompra}
          pendingInitialPagoPreview={pendingInitialPagoPreview}
          pendingSaldoPreview={pendingSaldoPreview}
          pendingIsPaidPreview={pendingIsPaidPreview}
          pendingXmlCount={pendingXmlCount}
          savedXmlCount={savedXmlCount}
          discardedXmlCount={discardedXmlCount}
          gmailXmlTotalCount={gmailXmlTotalCount}
          pagoMonto={pagoMonto}
          pagoMetodo={pagoMetodo}
          pagoBanco={pagoBanco}
          pagoReferencia={pagoReferencia}
          pagoNotas={pagoNotas}
          setPagoMonto={setPagoMonto}
          setPagoMetodo={setPagoMetodo}
          setPagoBanco={setPagoBanco}
          setPagoReferencia={setPagoReferencia}
          setPagoNotas={setPagoNotas}
          onRefreshGmail={handleImportFromGmail}
          onClose={() => setGmailXmlPanelOpen(false)}
          onTogglePendingPagoEstado={handleTogglePendingPagoEstado}
          onSelectPendingCompra={handleSelectPendingCompra}
          onCancelPendingCompra={handleCancelPendingCompra}
          onDiscardActivePendingCompra={handleDiscardActivePendingCompra}
          onConfirmPendingCompra={handleConfirmPendingCompra}
          onConfirmAllPendingCompras={handleConfirmAllPendingCompras}
        />,
        modalRoot
      )}

      {modalRoot && pagoModalContext && createPortal(
        <div className="fixed inset-0 z-[1050] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-lg bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl p-6 md:p-8 animate-fade-in space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--border)]">
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400">
                  Transacción de Pago
                </span>
                <h2 className="text-xl font-extrabold text-[var(--text-primary)] mt-1">
                  Registrar Abono
                </h2>
                {pagoModalProveedor && (
                  <p className="text-xs font-semibold text-[var(--text-secondary)] mt-1">
                    Proveedor: {pagoModalProveedor}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closePagoModal}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all duration-200 border border-slate-200 dark:border-slate-800 cursor-pointer"
                disabled={savingPago}
              >
                <X size={18} />
              </button>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Saldo Disponible</p>
                <p className={`font-extrabold text-sm mt-1 font-mono ${pagoModalSaldo <= 0.01 ? "text-emerald-500" : "text-amber-500"}`}>
                  {formatMoney(pagoModalSaldo)}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Método Seleccionado</p>
                <p className="font-bold text-sm text-[var(--text-primary)] mt-1">{getMetodoPagoLabel(pagoMetodo)}</p>
              </div>
            </div>

            {/* Form */}
            {renderPagoForm(pagoModalSaldo, handleSubmitPagoModal, savingPago)}

            {/* Close */}
            <div className="flex justify-end pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={closePagoModal}
                className="px-5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all duration-200 cursor-pointer"
                disabled={savingPago}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        modalRoot
      )}

      {modalRoot && proveedoresSidebarOpen && createPortal(
        <div
          className="fixed inset-0 z-[900] flex justify-end bg-slate-950/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setProveedoresSidebarOpen(false)}
        >
          <aside
            className="h-full w-full max-w-2xl bg-[var(--bg-card)] shadow-2xl border-l border-[var(--border)] flex flex-col animate-slide-in"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-6 border-b border-[var(--border)] flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
                  <AlertCircle size={10} className="animate-pulse" />
                  Saldos con Proveedores
                </span>
                <h2 className="text-xl font-extrabold mt-3 text-[var(--text-primary)]">
                  Cuentas por Pagar
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Tienes <span className="font-bold text-amber-600 dark:text-amber-400">{proveedoresPendientes.length}</span> proveedores con saldos pendientes de pago.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProveedoresSidebarOpen(false)}
                className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all duration-200 border border-slate-200 dark:border-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 p-6 bg-slate-50 dark:bg-slate-900/30 border-b border-[var(--border)]">
              <div className="p-4 rounded-xl bg-white dark:bg-[var(--bg-card)] border border-[var(--border)] shadow-sm">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Pendiente Total</p>
                <p className="font-extrabold text-lg text-amber-600 dark:text-amber-400 mt-1 font-mono">
                  {formatMoney(totalPendienteProveedores)}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-[var(--bg-card)] border border-[var(--border)] shadow-sm">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Pagado Total</p>
                <p className="font-extrabold text-lg text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {formatMoney(totalPagadoProveedores)}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {proveedoresPendientes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 mb-4">
                    <CheckCircle2 size={32} />
                  </div>
                  <p className="font-semibold text-sm text-[var(--text-primary)]">¡Todo al día!</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">No hay facturas pendientes con tus proveedores.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {proveedoresPendientes.map((proveedor) => (
                    <section
                      key={`${proveedor.proveedorRuc}-${proveedor.proveedorRazonSocial}`}
                      className="rounded-xl border border-[var(--border)] bg-slate-50/30 dark:bg-slate-900/5 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
                    >
                      {/* Provider Row Card Header */}
                      <div className="p-5 bg-slate-50 dark:bg-slate-900/20 border-b border-[var(--border)]">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-[var(--text-primary)] tracking-tight truncate">
                              {proveedor.proveedorRazonSocial}
                            </h3>
                            <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">RUC: {proveedor.proveedorRuc}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-mono text-sm font-extrabold text-amber-600 dark:text-amber-400">
                              {formatMoney(proveedor.totalPendiente)}
                            </p>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] mt-1">
                              {proveedor.compras.length} factura{proveedor.compras.length === 1 ? "" : "s"} pendiente{proveedor.compras.length === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                        
                        {/* Breakdown bar totals */}
                        <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-[10px]">
                          <div>
                            <span className="block text-[8px] uppercase tracking-wider text-[var(--text-muted)]">Facturado Total</span>
                            <span className="font-bold font-mono text-slate-800 dark:text-slate-200 mt-0.5 block">{formatMoney(proveedor.totalFacturado)}</span>
                          </div>
                          <div>
                            <span className="block text-[8px] uppercase tracking-wider text-[var(--text-muted)]">Pagado Total</span>
                            <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">{formatMoney(proveedor.totalPagado)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Provider Invoices list */}
                      <div className="divide-y divide-[var(--border)] bg-white dark:bg-[var(--bg-card)]">
                        {proveedor.compras.map((compra) => (
                          <div
                            key={compra.id ?? compra.claveAcceso}
                            className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/10 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelected(compra);
                                  setProveedoresSidebarOpen(false);
                                }}
                                className="min-w-0 text-left cursor-pointer group/item flex-1"
                                title="Ver compra seleccionada"
                              >
                                <p className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 group-hover/item:underline flex items-center gap-1">
                                  {compra.numeroFactura}
                                  <ArrowRight size={10} className="opacity-0 group-hover/item:opacity-100 transition-opacity duration-200" />
                                </p>
                                <p className="text-[10px] text-[var(--text-muted)] mt-1">Emisión: {compra.fechaEmision}</p>
                              </button>
                              
                              <div className="text-right flex-shrink-0">
                                <p className="font-mono text-xs font-extrabold text-amber-600 dark:text-amber-400">
                                  {formatMoney(getCompraSaldo(compra))}
                                </p>
                                <p className="text-[9px] text-[var(--text-muted)] mt-0.5">
                                  de {formatMoney(compra.importeTotal)}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => openPagoModalForCompra(compra)}
                              disabled={savingPago || getCompraSaldo(compra) <= 0.01}
                              className="w-full mt-3 py-1.5 bg-slate-50 hover:bg-blue-50 dark:bg-slate-900/40 dark:hover:bg-blue-950/20 text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900/30 rounded-lg text-[10px] font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <CreditCard size={11} />
                              Registrar Abono
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>,
        modalRoot
      )}

      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4 p-4.5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-xl relative overflow-hidden">
        {/* Decorative subtle abstract elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-600/10 rounded-full blur-2xl pointer-events-none -ml-8 -mb-8"></div>
        
        <div className="relative z-10">
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent flex items-center gap-2.5">
            <ShoppingCart className="text-blue-400" size={24} />
            Gestión de Compras
          </h1>
          <p className="text-slate-400 text-xs mt-1.5 max-w-xl">
            Sube tus facturas electrónicas XML de forma instantánea para registrar proveedores, controlar pagos pendientes y sincronizar existencias de inventario en segundos.
          </p>
        </div>
        
        <div className="relative z-10 flex flex-col sm:flex-row gap-2 flex-shrink-0">
          <input
            ref={inputRef}
            type="file"
            accept=".xml,.zip,text/xml,application/xml,application/zip,application/x-zip-compressed"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!uploading) setDraggingUpload(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDraggingUpload(false);
            }}
            onDrop={handleUploadDrop}
            disabled={uploading}
            className={`relative px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition-all duration-300 shadow-[0_4px_20px_rgba(37,99,235,0.25)] hover:shadow-[0_4px_25px_rgba(37,99,235,0.45)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 overflow-hidden group cursor-pointer ${draggingUpload ? "ring-4 ring-blue-300/60 scale-[1.02]" : ""}`}
          >
            {uploading ? (
              <Loader2 size={15} className="animate-spin text-white" />
            ) : (
              <Upload size={15} className="text-white group-hover:scale-110 transition-transform duration-300" />
            )}
            <span>{uploading ? "Procesando archivo..." : "Cargar factura"}</span>
          </button>
          <div className="flex flex-col sm:flex-row gap-2">
            {gmailStatus.connected ? (
              <>
                <button
                  type="button"
                  onClick={() => setGmailXmlPanelOpen(true)}
                  disabled={uploading}
                  className="px-4 py-2.5 rounded-xl font-semibold text-white transition-all duration-300 shadow-[0_4px_20px_rgba(220,38,38,0.25)] hover:shadow-[0_4px_25px_rgba(220,38,38,0.45)] active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
                  style={{ backgroundColor: '#DC2626' }}
                  title={gmailStatus.email ? `Conectado como ${gmailStatus.email}` : "Ver bandeja de XML de Gmail"}
                >
                  <Mail size={15} className="flex-shrink-0" />
                  <span>Bandeja XML</span>
                  {pendingXmlCount > 0 && (
                    <span 
                      className="ml-2 px-2 py-0.5 rounded-full text-xs font-black bg-white shadow-sm flex items-center justify-center min-w-5 h-5 animate-pulse"
                      style={{ color: '#DC2626' }}
                    >
                      {pendingXmlCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectGmail}
                  disabled={gmailLoading || gmailImporting}
                  className="px-3 py-2.5 rounded-xl font-semibold text-slate-200 bg-white/10 hover:bg-white/15 border border-white/15 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
                  title={gmailStatus.email ? `Desconectar ${gmailStatus.email}` : "Desconectar Gmail"}
                >
                  {gmailLoading ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleConnectGmail}
                disabled={gmailLoading}
                className="px-4 py-2.5 rounded-xl font-semibold text-white transition-all duration-300 shadow-[0_4px_20px_rgba(220,38,38,0.25)] hover:shadow-[0_4px_25px_rgba(220,38,38,0.45)] active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
                style={{ backgroundColor: '#DC2626' }}
              >
                {gmailLoading ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                <span>{gmailLoading ? "Revisando Gmail..." : "Conectar Gmail"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Compras registradas */}
        <div className="group bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none"></div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300">
            <ShoppingCart size={20} />
          </div>
          <div>
            <div className="text-xl font-bold text-[var(--text-primary)]">{compras.length}</div>
            <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mt-0.5">Facturas</div>
          </div>
        </div>

        {/* Total comprado */}
        <div className="group bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none"></div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300">
            <DollarSign size={20} />
          </div>
          <div>
            <div className="text-xl font-bold text-[var(--text-primary)] font-mono">{formatMoney(totalComprado)}</div>
            <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mt-0.5">Total Invertido</div>
          </div>
        </div>

        {/* Productos importados */}
        <div className="group bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none"></div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-300">
            <Package size={20} />
          </div>
          <div>
            <div className="text-xl font-bold text-[var(--text-primary)]">{totalItems}</div>
            <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mt-0.5">Items creados</div>
          </div>
        </div>

        {/* IVA pagado */}
        <div className="group bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none"></div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-cyan-50 text-cyan-600 dark:bg-cyan-950/30 dark:text-cyan-400 group-hover:scale-110 transition-transform duration-300">
            <FileText size={20} />
          </div>
          <div>
            <div className="text-xl font-bold text-[var(--text-primary)] font-mono">{formatMoney(totalIvaPagado)}</div>
            <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mt-0.5">IVA pagado</div>
          </div>
        </div>

        {/* Facturas pendientes (Interactivo) */}
        <button
          type="button"
          onClick={() => setGmailXmlPanelOpen(true)}
          className="group text-left bg-[var(--bg-card)] border border-blue-200 dark:border-blue-900/30 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-3 relative overflow-hidden hover:border-blue-400 cursor-pointer w-full focus:outline-none"
          aria-label="Ver facturas XML pendientes"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none group-hover:bg-blue-500/20 transition-all duration-300"></div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300">
            <Clock size={20} className={pendingXmlCount > 0 ? "animate-pulse" : ""} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{pendingXmlCount}</div>
            <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1">
              Pendientes XML
              <ArrowUpRight size={12} className="text-blue-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
            </div>
          </div>
        </button>

        {/* Pendiente proveedores (Interactivo) */}
        <button
          type="button"
          onClick={() => setProveedoresSidebarOpen(true)}
          className="group text-left bg-[var(--bg-card)] border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-3 relative overflow-hidden hover:border-amber-400 cursor-pointer w-full focus:outline-none"
          aria-label="Ver detalle de valores pendientes por proveedor"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/20 transition-all duration-300"></div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 group-hover:scale-110 transition-transform duration-300">
            <AlertCircle size={20} className="animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono">{formatMoney(totalPendienteProveedores)}</div>
            <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1">
              Pendiente Prov.
              <ArrowUpRight size={12} className="text-amber-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
            </div>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4">
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
              Historial de compras
            </h2>
            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                className="input pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar proveedor, RUC o factura"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
              <FileText size={42} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay compras para mostrar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-sm">
                    <th className="pb-2.5 px-3 font-semibold">Factura</th>
                    <th className="pb-2.5 px-3 font-semibold">Fecha</th>
                    <th className="pb-2.5 px-3 font-semibold">Proveedor</th>
                    <th className="pb-2.5 px-3 font-semibold">Productos</th>
                    <th className="pb-2.5 px-3 font-semibold">Pago</th>
                    <th className="pb-2.5 px-3 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((compra) => {
                    const active = selected?.id === compra.id;
                    const estadoPago = getCompraEstadoPago(compra);
                    const saldo = getCompraSaldo(compra);
                    return (
                      <tr
                        key={compra.id}
                        onClick={() => setSelected(compra)}
                        className={`border-b border-[var(--border)] last:border-0 transition-all duration-200 cursor-pointer ${
                          active
                            ? "bg-blue-50/40 dark:bg-blue-950/10 font-medium"
                            : "hover:bg-slate-50 dark:hover:bg-slate-900/30"
                        }`}
                      >
                        <td className={`py-2.5 px-3 relative ${active ? "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-blue-600" : ""}`}>
                          <p className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">{compra.numeroFactura}</p>
                          <p className="text-[10px] font-semibold text-[var(--text-muted)] mt-0.5">{compra.estadoAutorizacion || "Sin estado"}</p>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-[var(--text-secondary)] font-medium">{compra.fechaEmision}</td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-sm text-[var(--text-primary)]">{compra.proveedorRazonSocial}</p>
                          <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{compra.proveedorRuc}</p>
                        </td>
                        <td className="py-2.5 px-3 text-xs font-semibold text-[var(--text-secondary)]">{compra.items.length} items</td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col gap-1">
                            {estadoPago === "pagado" && (
                              <span className="inline-flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Pagado
                              </span>
                            )}
                            {estadoPago === "parcial" && (
                              <span className="inline-flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                Parcial
                              </span>
                            )}
                            {estadoPago === "pendiente" && (
                              <span className="inline-flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                Pendiente
                              </span>
                            )}
                            {saldo > 0.01 && (
                              <p className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                                Saldo: {formatMoney(saldo)}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-sm text-[var(--text-primary)]">
                          {formatMoney(compra.importeTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm">
          {selected ? (
            <div className="space-y-4">
              {/* Header de Detalle */}
              <div className="pb-4 border-b border-[var(--border)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400">
                      Compra Seleccionada
                    </span>
                    <h2 className="text-lg font-bold text-[var(--text-primary)] mt-0.5 truncate flex items-center gap-1.5">
                      <FileText size={18} className="text-blue-500" />
                      {selected.numeroFactura}
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 font-semibold truncate">
                      {selected.proveedorRazonSocial}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    disabled={deleting}
                    className="p-2.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200 border border-slate-200 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-950/30 flex-shrink-0 cursor-pointer"
                    title="Eliminar compra"
                  >
                    {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                </div>
              </div>

              {/* Pestañas Interactivas */}
              <div className="flex gap-2 overflow-x-auto border-b border-[var(--border)] px-1 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("resumen")}
                  className={`flex-none sm:flex-1 min-h-10 px-3 py-2 text-xs font-bold transition-all duration-200 border-b-2 rounded-t-lg flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeTab === "resumen"
                      ? "border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400"
                      : "border-transparent text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-slate-900/30 hover:text-[var(--text-primary)]"
                  }`}
                >
                  <FileText size={14} className="flex-shrink-0" />
                  <span>Resumen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("pagos")}
                  className={`flex-none sm:flex-1 min-h-10 px-3 py-2 text-xs font-bold transition-all duration-200 border-b-2 rounded-t-lg flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeTab === "pagos"
                      ? "border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400"
                      : "border-transparent text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-slate-900/30 hover:text-[var(--text-primary)]"
                  }`}
                >
                  <CreditCard size={14} className="flex-shrink-0" />
                  <span>Pagos</span>
                  {selectedSaldoProveedor > 0.01 && (
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500 animate-pulse"></span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("productos")}
                  className={`flex-none sm:flex-1 min-h-10 px-3 py-2 text-xs font-bold transition-all duration-200 border-b-2 rounded-t-lg flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeTab === "productos"
                      ? "border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400"
                      : "border-transparent text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-slate-900/30 hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Package size={14} className="flex-shrink-0" />
                  <span>Productos</span>
                  <span className="flex-shrink-0 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-[9px] font-bold text-[var(--text-muted)]">
                    {selected.items.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("devoluciones")}
                  className={`flex-none sm:flex-1 min-h-10 px-3 py-2 text-xs font-bold transition-all duration-200 border-b-2 rounded-t-lg flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeTab === "devoluciones"
                      ? "border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400"
                      : "border-transparent text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-slate-900/30 hover:text-[var(--text-primary)]"
                  }`}
                >
                  <RotateCcw size={14} className="flex-shrink-0" />
                  <span>Devoluciones</span>
                  {selectedDevoluciones.length > 0 && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-[9px] font-bold text-[var(--text-muted)]">
                      {selectedDevoluciones.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Contenido de Pestañas */}
              {activeTab === "resumen" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Fecha de Emisión</p>
                      <p className="font-semibold text-sm text-[var(--text-primary)] mt-1">{selected.fechaEmision}</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Total Facturado</p>
                      <p className="font-bold text-sm text-[var(--text-primary)] mt-1">{formatMoney(selected.importeTotal)}</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 col-span-2">
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Total IVA Pagado</p>
                      <p className="font-semibold text-sm text-[var(--text-primary)] mt-1">{formatMoney(selectedIvaPagado)}</p>
                    </div>
                  </div>

                  {/* Estado de Inventario */}
                  <div className={`p-4 rounded-xl border ${
                    selected.inventarioSincronizado
                      ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/10 dark:border-emerald-900/30"
                      : "bg-amber-50/50 border-amber-200 dark:bg-amber-950/10 dark:border-amber-900/30"
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        selected.inventarioSincronizado ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                      }`}>
                        <Package size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[var(--text-primary)]">Existencias en Inventario</p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          {selected.inventarioSincronizado
                            ? `Sincronizado: se crearon ${selected.productosCreados ?? 0} productos nuevos y se actualizaron ${selected.productosActualizados ?? 0} en stock.`
                            : "Esta factura no ha sincronizado su stock al inventario general aún."}
                        </p>
                        {!selected.inventarioSincronizado && (
                          <button
                            type="button"
                            onClick={handleSyncSelected}
                            disabled={syncing}
                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-all duration-200 shadow-sm cursor-pointer disabled:opacity-50"
                          >
                            {syncing ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
                            {syncing ? "Sincronizando..." : "Sincronizar Stock"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acordeón de Datos Tributarios (Ver más) */}
                  <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedTributaria(!expandedTributaria)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/20 hover:bg-slate-100/60 dark:hover:bg-slate-900/40 flex items-center justify-between text-xs font-bold text-[var(--text-primary)] cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Building size={14} className="text-blue-500" />
                        Información Tributaria y Autorizaciones
                      </span>
                      {expandedTributaria ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {expandedTributaria && (
                      <div className="p-4 bg-white dark:bg-[var(--bg-card)] border-t border-[var(--border)] space-y-3.5 text-xs animate-fade-in">
                        {/* Clave de Acceso */}
                        <div>
                          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Clave de Acceso (49 dígitos)</p>
                          <div className="flex items-center gap-2 mt-1.5 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                            <code className="font-mono text-[10px] text-[var(--text-primary)] break-all flex-1 select-all">
                              {selected.claveAcceso}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(selected.claveAcceso, "acceso")}
                              className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-[var(--text-secondary)] hover:text-blue-600 cursor-pointer"
                              title="Copiar clave de acceso"
                            >
                              {copiedAcceso ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>

                        {/* Número de Autorización */}
                        {selected.numeroAutorizacion && (
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Número de Autorización</p>
                            <div className="flex items-center gap-2 mt-1.5 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                              <code className="font-mono text-[10px] text-[var(--text-primary)] break-all flex-1 select-all">
                                {selected.numeroAutorizacion}
                              </code>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(selected.numeroAutorizacion, "autorizacion")}
                                className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-[var(--text-secondary)] hover:text-blue-600 cursor-pointer"
                                title="Copiar número de autorización"
                              >
                                {copiedAutorizacion ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Establ. / Pto. Emi.</p>
                            <p className="font-semibold mt-0.5 text-[var(--text-primary)]">{selected.establecimiento}-{selected.puntoEmision}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Secuencial</p>
                            <p className="font-semibold mt-0.5 text-[var(--text-primary)]">{selected.secuencial}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Fecha Autorización</p>
                            <p className="font-semibold mt-0.5 text-[var(--text-primary)]">{selected.fechaAutorizacion || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Moneda</p>
                            <p className="font-semibold mt-0.5 text-[var(--text-primary)]">{selected.moneda}</p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Comprador</p>
                          <p className="font-semibold mt-0.5 text-[var(--text-primary)]">{selected.compradorRazonSocial || "N/A"}</p>
                          <p className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">{selected.compradorIdentificacion}</p>
                        </div>

                        {selected.archivoNombre && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                            <FileText size={12} className="text-slate-400" />
                            <span>Archivo: <span className="font-semibold">{selected.archivoNombre}</span></span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "pagos" && (
                <div className="space-y-4 animate-fade-in">
                  {/* Tarjeta Resumen de Saldos (Billing Card) */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Saldo del Proveedor</span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        selectedSaldoProveedor <= 0.01
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedSaldoProveedor <= 0.01 ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}></span>
                        {selectedSaldoProveedor <= 0.01 ? "Liquidado" : "Pendiente"}
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="text-3xl font-extrabold tracking-tight font-mono text-white">
                        {formatMoney(selectedSaldoProveedor)}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium mt-1">Saldo pendiente por liquidar</p>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-700/50 text-xs">
                      <div>
                        <p className="text-slate-400 text-[10px]">Total Pagado</p>
                        <p className="font-bold font-mono text-emerald-400 text-sm mt-0.5">{formatMoney(selectedTotalPagadoProveedor)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[10px]">Devuelto</p>
                        <p className="font-bold font-mono text-rose-300 text-sm mt-0.5">{formatMoney(selectedTotalDevueltoProveedor)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[10px]">Importe Factura</p>
                        <p className="font-bold font-mono text-slate-200 text-sm mt-0.5">{formatMoney(selected.importeTotal)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Historial de Pagos */}
                  <div>
                    <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Clock size={13} className="text-slate-400" />
                      Historial de Transacciones
                    </h3>
                    {renderPagoList(selectedPagosProveedor, handleRemoveSelectedPago, savingPago)}
                  </div>

                  {/* Registrar Pago Button */}
                  {selectedSaldoProveedor > 0.01 && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => openPagoModal("selected", selectedSaldoProveedor)}
                        disabled={savingPago}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Plus size={15} />
                        Registrar Nuevo Pago
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "devoluciones" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30">
                      <p className="text-[10px] font-bold text-rose-600 dark:text-rose-300 uppercase">Total devuelto</p>
                      <p className="font-mono font-bold text-lg text-rose-700 dark:text-rose-300 mt-1">
                        {formatMoney(selectedTotalDevueltoProveedor)}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Registros</p>
                      <p className="font-mono font-bold text-lg text-[var(--text-primary)] mt-1">{selectedDevoluciones.length}</p>
                    </div>
                  </div>

                  {!selected.inventarioSincronizado ? (
                    <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50/60 dark:bg-amber-950/10">
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Sincroniza el inventario antes de registrar devoluciones.</p>
                      <p className="text-xs mt-1 text-amber-700/80 dark:text-amber-300/80">Asi el sistema puede descontar existencias correctamente.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 p-4 rounded-xl border border-[var(--border)]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="form-group">
                          <label className="label">Producto</label>
                          <select
                            className="input"
                            value={devolucionItemIndex}
                            onChange={(event) => {
                              setDevolucionItemIndex(Number(event.target.value));
                              setDevolucionCantidad("");
                            }}
                            disabled={savingDevolucion}
                          >
                            {selected.items.map((item, index) => {
                              const disponible = Math.max(Number(item.cantidad || 0) - (devolucionesByItemIndex.get(index) ?? 0), 0);
                              return (
                                <option key={`${item.codigo}-${index}`} value={index} disabled={disponible <= 0}>
                                  {item.descripcion || "Producto sin nombre"} - {disponible} disp.
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="label">Cantidad</label>
                          <input
                            type="number"
                            className="input"
                            placeholder={`Max. ${selectedDevolucionCantidadDisponible}`}
                            value={devolucionCantidad}
                            onChange={(event) => setDevolucionCantidad(event.target.value)}
                            min="0"
                            max={selectedDevolucionCantidadDisponible}
                            step="0.01"
                            disabled={savingDevolucion || selectedDevolucionCantidadDisponible <= 0}
                          />
                        </div>
                      </div>

                      {selectedDevolucionItem && (
                        <div className="text-xs rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 p-3">
                          <p className="font-semibold text-[var(--text-primary)]">{selectedDevolucionItem.descripcion}</p>
                          <p className="mt-1 text-[var(--text-muted)]">
                            Codigo: {selectedDevolucionItem.codigo || "SIN_CODIGO"} | Comprado: {selectedDevolucionItem.cantidad} | Disponible para devolver: {selectedDevolucionCantidadDisponible}
                          </p>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Valor unitario</p>
                              <p className="font-mono font-semibold text-[var(--text-primary)]">
                                {formatMoney(selectedDevolucionValorUnitario)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Valor a devolver</p>
                              <p className="font-mono font-semibold text-rose-600 dark:text-rose-300">
                                {formatMoney(selectedDevolucionSubtotalEstimado)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="form-group">
                          <label className="label">Reconocimiento</label>
                          <select
                            className="input"
                            value={devolucionMetodo}
                            onChange={(event) => {
                              const next = event.target.value as MetodoDevolucionProveedor;
                              setDevolucionMetodo(next);
                              if (next !== "transferencia") setDevolucionBanco("");
                            }}
                            disabled={savingDevolucion}
                          >
                            {DEVOLUCION_PROVEEDOR_METODOS.map((metodo) => (
                              <option key={metodo.value} value={metodo.value}>
                                {metodo.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="label">Referencia</label>
                          <input
                            className="input"
                            placeholder="NC, comprobante..."
                            value={devolucionReferencia}
                            onChange={(event) => setDevolucionReferencia(event.target.value)}
                            disabled={savingDevolucion}
                          />
                        </div>
                      </div>

                      {devolucionMetodo === "transferencia" && (
                        <div className="form-group">
                          <label className="label">Banco recibido</label>
                          <input
                            className="input"
                            list={`${BANCO_TRANSFERENCIA_LIST_ID}-compras-devolucion`}
                            placeholder="Selecciona o escribe el banco"
                            value={devolucionBanco}
                            onChange={(event) => setDevolucionBanco(event.target.value)}
                            disabled={savingDevolucion}
                          />
                          <datalist id={`${BANCO_TRANSFERENCIA_LIST_ID}-compras-devolucion`}>
                            {BANCOS_TRANSFERENCIA.map((banco) => (
                              <option key={banco} value={banco} />
                            ))}
                          </datalist>
                        </div>
                      )}

                      <div className="form-group">
                        <label className="label">Motivo</label>
                        <input
                          ref={devolucionMotivoRef}
                          className={`input ${devolucionMotivoError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}`}
                          placeholder="Producto defectuoso, error de despacho..."
                          value={devolucionMotivo}
                          onChange={(event) => {
                            setDevolucionMotivo(event.target.value);
                            if (event.target.value.trim()) setDevolucionMotivoError(false);
                          }}
                          aria-invalid={devolucionMotivoError}
                          aria-describedby={devolucionMotivoError ? "devolucion-motivo-error" : undefined}
                          disabled={savingDevolucion}
                        />
                        {devolucionMotivoError && (
                          <p id="devolucion-motivo-error" className="text-xs font-medium text-red-500">
                            Ingresa el motivo para registrar la devolucion.
                          </p>
                        )}
                      </div>

                      <div className="form-group">
                        <label className="label">Notas</label>
                        <input
                          className="input"
                          placeholder="Detalle opcional"
                          value={devolucionNotas}
                          onChange={(event) => setDevolucionNotas(event.target.value)}
                          disabled={savingDevolucion}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleCreateDevolucionProveedor}
                        disabled={savingDevolucion || selectedDevolucionCantidadDisponible <= 0}
                        className="btn-primary w-full justify-center"
                      >
                        {savingDevolucion ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                        Registrar devolucion
                      </button>
                    </div>
                  )}

                  <div>
                    <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Clock size={13} className="text-slate-400" />
                      Historial de devoluciones
                    </h3>
                    {selectedDevoluciones.length === 0 ? (
                      <p className="text-sm text-center py-4 rounded-lg" style={{ color: "var(--text-muted)", background: "var(--bg-secondary)" }}>
                        Sin devoluciones registradas.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedDevoluciones.map((devolucion) => {
                          const valorUnitarioDevuelto = getDevolucionProveedorValorUnitario(devolucion);

                          return (
                            <div
                              key={devolucion.id}
                              className="p-3 rounded-lg border border-[var(--border)]"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-semibold text-xs text-[var(--text-primary)]">{devolucion.productoNombre}</p>
                                  <p className="text-[10px] mt-1 text-[var(--text-muted)]">
                                    {devolucion.cantidad} und. | {getMetodoDevolucionProveedorLabel(devolucion.metodoDevolucion)}
                                    {devolucion.banco ? ` - ${devolucion.banco}` : ""}
                                    {devolucion.referencia ? ` - ${devolucion.referencia}` : ""}
                                  </p>
                                </div>
                                <p className="font-mono font-bold text-sm text-rose-600 dark:text-rose-300">
                                  {formatMoney(devolucion.subtotalDevuelto)}
                                </p>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 dark:bg-slate-900/30 p-2">
                                <div>
                                  <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Valor unitario</p>
                                  <p className="font-mono font-semibold text-[var(--text-primary)]">
                                    {formatMoney(valorUnitarioDevuelto)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Valor producto devuelto</p>
                                  <p className="font-mono font-semibold text-rose-600 dark:text-rose-300">
                                    {formatMoney(devolucion.subtotalDevuelto)}
                                  </p>
                                </div>
                              </div>
                              <p className="text-xs mt-2 text-[var(--text-secondary)]">{devolucion.motivo}</p>
                              {devolucion.notas && <p className="text-xs mt-1 text-[var(--text-muted)]">{devolucion.notas}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "productos" && (
                <div className="space-y-4 animate-fade-in">
                  {/* Buscador de Productos */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100/40 dark:hover:bg-slate-900/70 focus:bg-white dark:focus:bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-xs outline-none transition-all duration-200 placeholder-slate-400"
                      placeholder="Buscar por código o descripción..."
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                    />
                    {productSearch && (
                      <button
                        type="button"
                        onClick={() => setProductSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Listado de Productos */}
                  <div className="max-h-[480px] overflow-auto rounded-xl border border-[var(--border)]">
                    {filteredSelectedItems.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <Package size={28} className="mx-auto mb-2 opacity-30" />
                        <p className="text-xs">No hay productos que coincidan</p>
                      </div>
                    ) : (
                      <table className="min-w-[900px] w-full text-left text-xs">
                        <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900/80 border-b border-[var(--border)] text-[10px] uppercase text-[var(--text-muted)]">
                          <tr>
                            <th className="px-3 py-3 font-bold w-[34%]">Producto</th>
                            <th className="px-3 py-3 font-bold">Codigo</th>
                            <th className="px-3 py-3 font-bold text-right">Cantidad</th>
                            <th className="px-3 py-3 font-bold text-right">Precio unit.</th>
                            <th className="px-3 py-3 font-bold text-right">Descuento</th>
                            <th className="px-3 py-3 font-bold text-right">Subtotal</th>
                            <th className="px-3 py-3 font-bold text-right">IVA</th>
                            <th className="px-3 py-3 font-bold text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] bg-white dark:bg-[var(--bg-card)]">
                          {filteredSelectedItems.map((item, index) => (
                            <tr
                              key={`${item.codigo}-${index}`}
                              className="hover:bg-slate-50 dark:hover:bg-slate-900/20 active:bg-slate-100 dark:active:bg-slate-900/40 transition-colors cursor-pointer"
                              onClick={() => setSelectedProductForSidebar(item)}
                            >
                              <td className="px-3 py-3 align-top">
                                <p className="font-semibold text-[var(--text-primary)] leading-relaxed break-words">
                                  {item.descripcion}
                                </p>
                              </td>
                              <td className="px-3 py-3 align-top">
                                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--text-muted)]">
                                  <Hash size={10} />
                                  {item.codigo || "SIN_CODIGO"}
                                </span>
                              </td>
                              <td className="px-3 py-3 align-top text-right font-mono font-semibold text-[var(--text-primary)]">
                                {item.cantidad}
                              </td>
                              <td className="px-3 py-3 align-top text-right font-mono font-semibold text-[var(--text-primary)]">
                                {formatMoney(item.precioUnitario)}
                              </td>
                              <td className="px-3 py-3 align-top text-right font-mono font-semibold text-red-500">
                                {formatMoney(item.descuento)}
                              </td>
                              <td className="px-3 py-3 align-top text-right font-mono font-semibold text-[var(--text-primary)]">
                                {formatMoney(item.subtotalSinImpuesto)}
                              </td>
                              <td className="px-3 py-3 align-top text-right">
                                <p className="font-mono font-semibold text-[var(--text-primary)]">{formatMoney(item.impuesto)}</p>
                                {typeof item.tarifaIva === "number" && (
                                  <p className="mt-0.5 text-[9px] font-bold text-[var(--text-muted)]">{item.tarifaIva}%</p>
                                )}
                              </td>
                              <td className="px-3 py-3 align-top text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                                {formatMoney(item.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in" style={{ color: "var(--text-muted)" }}>
              <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center border border-slate-100 dark:border-slate-800 mb-4 text-slate-300 dark:text-slate-700">
                <ShoppingCart size={28} />
              </div>
              <p className="font-semibold text-sm text-[var(--text-primary)]">Sin Selección</p>
              <p className="text-xs text-[var(--text-muted)] mt-1.5 max-w-xs">Selecciona una compra en el historial de la izquierda para examinar sus detalles, pagos y productos.</p>
            </div>
          )}
        </div>
      </div>

      {modalRoot && selectedProductForSidebar && createPortal(
        <div
          className="fixed inset-0 z-[900] flex justify-end bg-slate-950/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedProductForSidebar(null)}
        >
          <aside
            className="h-full w-full max-w-lg bg-[var(--bg-card)] shadow-2xl border-l border-[var(--border)] flex flex-col animate-slide-in"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-[var(--border)] flex items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30">
                  <Package size={10} />
                  Información del Producto
                </span>
                <h2 className="text-base font-bold mt-2.5 text-[var(--text-primary)] break-words leading-snug">
                  {selectedProductForSidebar.descripcion}
                </h2>
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[var(--text-muted)] font-mono">
                  <Hash size={12} />
                  <span>Código: {selectedProductForSidebar.codigo || "SIN_CODIGO"}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProductForSidebar(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all duration-200 border border-slate-200 dark:border-slate-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tabs Navigation */}
            <div className="flex border-b border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/10 px-6">
              <button
                type="button"
                onClick={() => setSidebarTab("factura")}
                className={`flex-1 py-3 text-xs font-semibold border-b-2 text-center transition-all ${
                  sidebarTab === "factura"
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Compra Actual
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab("inventario")}
                className={`flex-1 py-3 text-xs font-semibold border-b-2 text-center transition-all ${
                  sidebarTab === "inventario"
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Inventario & Ajustes
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab("historial")}
                className={`flex-1 py-3 text-xs font-semibold border-b-2 text-center transition-all ${
                  sidebarTab === "historial"
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Historial de Costos
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {sidebarTab === "factura" && (
                <div className="space-y-6 animate-fade-in">
                  {/* Resumen de Valores de Compra */}
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Valores de la Transacción</h3>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-[var(--border)]">
                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Cantidad</span>
                        <p className="font-mono font-bold text-base text-[var(--text-primary)] mt-1">
                          {selectedProductForSidebar.cantidad}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-[var(--border)]">
                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Precio Unit.</span>
                        <p className="font-mono font-bold text-base text-[var(--text-primary)] mt-1">
                          {formatMoney(selectedProductForSidebar.precioUnitario)}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-[var(--border)]">
                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Descuento</span>
                        <p className={`font-mono font-bold text-base mt-1 ${selectedProductForSidebar.descuento > 0 ? "text-red-500" : "text-[var(--text-muted)]"}`}>
                          {formatMoney(selectedProductForSidebar.descuento)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* desglose de totales */}
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/10 space-y-3">
                    <h4 className="text-xs font-bold text-[var(--text-primary)]">Desglose Financiero</h4>
                    
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center text-[var(--text-secondary)]">
                        <span>Subtotal Neto</span>
                        <span className="font-mono font-semibold">{formatMoney(selectedProductForSidebar.subtotalSinImpuesto)}</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-[var(--text-secondary)]">
                        <span>IVA {typeof selectedProductForSidebar.tarifaIva === "number" ? `(${selectedProductForSidebar.tarifaIva}%)` : ""}</span>
                        <span className="font-mono font-semibold">{formatMoney(selectedProductForSidebar.impuesto)}</span>
                      </div>

                      {selectedProductForSidebar.baseImponibleIva !== undefined && selectedProductForSidebar.baseImponibleIva > 0 && (
                        <div className="flex justify-between items-center text-[var(--text-muted)] text-[11px]">
                          <span>Base Imponible IVA</span>
                          <span className="font-mono">{formatMoney(selectedProductForSidebar.baseImponibleIva)}</span>
                        </div>
                      )}

                      <hr className="border-[var(--border)] my-1" />

                      <div className="flex justify-between items-center text-sm font-bold text-[var(--text-primary)] pt-1">
                        <span>Total Facturado</span>
                        <span className="font-mono text-blue-600 dark:text-blue-400">{formatMoney(selectedProductForSidebar.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Origen (Información de la factura de compra) */}
                  {selected && (
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Factura de Compra Relacionada</h3>
                      
                      <div className="p-4 rounded-xl border border-[var(--border)] space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Proveedor</span>
                            <p className="font-semibold text-[var(--text-primary)] mt-0.5 break-words">
                              {selected.proveedorRazonSocial}
                            </p>
                            <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                              RUC: {selected.proveedorRuc}
                            </p>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Nº de Factura</span>
                            <p className="font-semibold text-[var(--text-primary)] mt-0.5 font-mono">
                              {selected.numeroFactura}
                            </p>
                            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                              Fecha: {selected.fechaEmision}
                            </p>
                          </div>
                        </div>

                        <hr className="border-[var(--border)]" />

                        <div>
                          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase flex items-center justify-between">
                            Clave de Acceso SRI
                            <button
                              type="button"
                              onClick={() => copyToClipboard(selected.claveAcceso, "acceso")}
                              className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              {copiedAcceso ? (
                                <>
                                  <Check size={10} /> Copiado
                                </>
                              ) : (
                                <>
                                  <Copy size={10} /> Copiar
                                </>
                              )}
                            </button>
                          </span>
                          <p className="font-mono text-[10px] text-[var(--text-secondary)] mt-1 select-all break-all bg-slate-50 dark:bg-slate-900/40 p-2 rounded border border-[var(--border)]">
                            {selected.claveAcceso}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {sidebarTab === "inventario" && (
                <div className="space-y-6 animate-fade-in">
                  {loadingInventoryProduct ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 size={24} className="animate-spin text-blue-600 mb-2" />
                      <span className="text-xs text-[var(--text-muted)]">Cargando producto de inventario...</span>
                    </div>
                  ) : !inventoryProduct ? (
                    <div className="text-center py-12 rounded-xl border border-dashed border-[var(--border)] bg-slate-50 dark:bg-slate-900/10 p-6">
                      <Package size={28} className="mx-auto mb-3 text-slate-400 opacity-60" />
                      <p className="font-semibold text-xs text-[var(--text-primary)]">Producto no Sincronizado</p>
                      <p className="text-[11px] text-[var(--text-muted)] mt-1.5 max-w-xs mx-auto">
                        Este producto no se encuentra registrado en el inventario global. Asegúrate de sincronizar la compra para agregarlo.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="p-4 rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/10 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Stock en Bodega</p>
                          <p className="text-sm font-semibold text-[var(--text-primary)] mt-1 flex items-center gap-1.5">
                            <Boxes size={14} className="text-slate-400" />
                            {Math.floor(Number(inventoryProduct.stockActual ?? 0))} {inventoryProduct.unidadMedida || "Unidad(es)"}
                          </p>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300 border border-[var(--border)]">
                          Inventario Activo
                        </span>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide border-b border-[var(--border)] pb-1.5">Ajustes Financieros</h4>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="form-group">
                            <label className="label">Costo de Compra ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="input font-mono font-semibold"
                              placeholder="0.00"
                              value={adjustedCosto}
                              onChange={(e) => setAdjustedCosto(e.target.value)}
                            />
                          </div>

                          <div className="form-group">
                            <label className="label">Margen de Ganancia (%)</label>
                            <input
                              type="number"
                              step="0.1"
                              className="input font-mono font-semibold"
                              placeholder="25"
                              value={adjustedMargen}
                              onChange={(e) => setAdjustedMargen(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                          <div className="min-w-0 pr-3">
                            <label className="text-xs font-bold text-[var(--text-primary)] block">Aplica IVA (15%)</label>
                            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">Determina si se agrega el impuesto al precio de venta final</span>
                          </div>
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-800 transition-colors cursor-pointer"
                            checked={adjustedAplicaIva}
                            onChange={(e) => setAdjustedAplicaIva(e.target.checked)}
                          />
                        </div>

                        {/* Caja de previsualización reactiva */}
                        <div className="p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-950/10 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[var(--text-secondary)]">Precio de Venta Base (Público)</span>
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">
                              {formatMoney(calcularPrecioVenta(Number(adjustedCosto || 0), Number(adjustedMargen || 0), adjustedAplicaIva))}
                            </span>
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                            Fórmula: <code className="font-mono bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded">Costo * (1 + Margen/100) {adjustedAplicaIva ? "* 1.15 (IVA)" : ""}</code>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleSaveInventoryProductChanges}
                          disabled={savingInventoryChanges}
                          className="btn-primary w-full justify-center py-2.5 text-xs font-bold shadow-md cursor-pointer"
                        >
                          {savingInventoryChanges ? (
                            <>
                              <Loader2 size={14} className="animate-spin mr-1.5" />
                              Guardando cambios...
                            </>
                          ) : (
                            <>
                              <Check size={14} className="mr-1.5" />
                              Guardar Ajustes de Inventario
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {sidebarTab === "historial" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                    <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">Compras Registradas del Artículo</h4>
                    <span className="text-[10px] font-bold text-[var(--text-muted)]">{selectedProductPriceHistory.length} transacciones</span>
                  </div>

                  {selectedProductPriceHistory.length === 0 ? (
                    <div className="text-center py-8 text-[var(--text-muted)] text-xs">
                      No se encontraron registros de compra para este artículo.
                    </div>
                  ) : (
                    <div className="max-h-[480px] overflow-auto rounded-xl border border-[var(--border)]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/80 border-b border-[var(--border)] text-[10px] uppercase text-[var(--text-muted)] font-bold">
                          <tr>
                            <th className="px-3 py-2.5">Fecha</th>
                            <th className="px-3 py-2.5">Factura / Proveedor</th>
                            <th className="px-3 py-2.5 text-right">Cant.</th>
                            <th className="px-3 py-2.5 text-right">Costo Unit.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] bg-white dark:bg-[var(--bg-card)]">
                          {selectedProductPriceHistory.map((hist, idx) => (
                            <tr key={`${hist.factura}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                              <td className="px-3 py-2.5 text-[10px] font-mono text-[var(--text-secondary)] whitespace-nowrap align-top">
                                {hist.fecha}
                              </td>
                              <td className="px-3 py-2.5 align-top">
                                <p className="font-semibold text-[var(--text-primary)] leading-tight">{hist.factura}</p>
                                <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate max-w-[180px]">{hist.proveedor}</p>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-medium text-[var(--text-secondary)] align-top">
                                {hist.cantidad}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400 align-top">
                                {formatMoney(hist.precioUnitario)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[var(--border)] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedProductForSidebar(null)}
                className="px-5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all duration-200 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </aside>
        </div>,
        modalRoot
      )}
    </AppShell>
  );
}
