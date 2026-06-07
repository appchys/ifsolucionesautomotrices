"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  X, Check, Loader2, Search, Plus, Edit2, Car, User, Clock, FileText, RotateCcw,
  ChevronRight, AlertCircle, CheckCircle2, MapPin, Phone, Mail, DollarSign, Wrench, Package
} from "lucide-react";
import { Cliente, Vehiculo, OrdenTrabajo, ItemOrden, AppUser, UserRole, TipoServicio, NivelCombustible, Pago, Devolucion, ChecklistItem, DanoVehiculo } from "@/types";
import {
  getClientes, getClienteById, createCliente, updateCliente,
  getVehiculos, getVehiculosByCliente, getVehiculoById, getVehiculoByPlaca, searchVehiculosByPlacaPrefix, createVehiculo, updateVehiculo,
  getOrdenesByVehiculoId, getOrdenById, createOrdenConItems, updateOrden, getItemsOrden, deleteItemOrden, addItemOrden, updateItemOrden,
  getPagos, createPago,
  getDevolucionesByOrden, createDevolucion,
  getProximoNumeroOrden, getUsuarios,
} from "@/lib/services";
import { getPagoMontoBase } from "@/lib/orderPayments";
import { useUIStore } from "@/store";
import AgregarItemModal from "../ordenes/AgregarItemModal";
import VehiculoModal from "../vehiculos/VehiculoModal";
import RegistrarPagoModal from "../ordenes/RegistrarPagoModal";

type WorkflowPhase = "recepcion" | "diagnostico" | "repuestos" | "orden" | "entrega";

const CHECKLIST_DEFAULT: ChecklistItem[] = [
  { label: "Gata", checked: false },
  { label: "Llanta de repuesto", checked: false },
  { label: "Herramientas (llaves)", checked: false },
  { label: "Extintor", checked: false },
  { label: "Triángulos de emergencia", checked: false },
  { label: "Documentos del vehículo", checked: false },
];

const PHASE_CONFIG: Record<WorkflowPhase, { label: string; description: string; color: string }> = {
  recepcion: { label: "Recepción", description: "Registro inicial", color: "blue" },
  diagnostico: { label: "Diagnóstico", description: "Cotización", color: "purple" },
  repuestos: { label: "Repuestos", description: "Gestión de compra", color: "amber" },
  orden: { label: "Orden de Trabajo", description: "Reparación", color: "green" },
  entrega: { label: "Entrega", description: "Cierre", color: "emerald" },
};

type FormData = {
  nombre: string;
  apellido: string;
  identificacion: string;
  telefono: string;
  email: string;
  direccion: string;
  placa: string;
  marca: string;
  modelo: string;
  anio: number;
  color: string;
  vin: string;
  tipoVehiculo: string;
};

type OrdenFormItem = Omit<ItemOrden, "ordenId"> & { stockDisponible?: number };
type AgregarItemPayload = Omit<ItemOrden, "id" | "ordenId" | "subtotal"> & { stockDisponible?: number };

interface Props {
  onClose: () => void;
  onSuccess?: (orderId: string) => void;
  ordenId?: string;
}

// ════════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════════

export default function NuevaOrdenSidebar({ onClose, onSuccess, ordenId }: Props) {
  const router = useRouter();
  const { sidebarOpen } = useUIStore();
  const [mounted, setMounted] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<WorkflowPhase>("recepcion");
  const [guardando, setGuardando] = useState(false);

  // ──── Datos compartidos
  const [clienteData, setClienteData] = useState<Cliente | null>(null);
  const [vehiculoData, setVehiculoData] = useState<Vehiculo | null>(null);
  const [ordenEditando, setOrdenEditando] = useState<OrdenTrabajo | null>(null);
  const [numeroOrden, setNumeroOrden] = useState<number | null>(null);

  // ──── Búsqueda
  const [modoBusqueda, setModoBusqueda] = useState<"placa" | "cliente">("placa");
  const [buscando, setBuscando] = useState(false);
  const [sugerencias, setSugerencias] = useState<Vehiculo[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargandoClientes, setCargandoClientes] = useState(false);
  const [filtroCliente, setFiltroCliente] = useState("");
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([]);
  const [mostrarSugerenciasClientes, setMostrarSugerenciasClientes] = useState(false);
  const [vehiculosDelCliente, setVehiculosDelCliente] = useState<Vehiculo[]>([]);
  const [cargandoVehiculosCliente, setCargandoVehiculosCliente] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const clienteWrapperRef = useRef<HTMLDivElement>(null);

  // ──── Inspección inicial
  const [checklist, setChecklist] = useState<ChecklistItem[]>(CHECKLIST_DEFAULT);
  const [nivelCombustible, setNivelCombustible] = useState<NivelCombustible>("1/2");
  const [danos, setDanos] = useState<DanoVehiculo[]>([]);

  // ──── Diagnóstico
  const [tipoServicio, setTipoServicio] = useState<TipoServicio>("Mantenimiento");
  const [motivo, setMotivo] = useState("");
  const [km, setKm] = useState("");
  const [notasInternas, setNotasInternas] = useState("");
  const [personalDisponible, setPersonalDisponible] = useState<AppUser[]>([]);
  const [cargandoPersonal, setCargandoPersonal] = useState(true);
  const [personalSeleccionadoIds, setPersonalSeleccionadoIds] = useState<string[]>([]);

  // ──── Items y pagos
  const [items, setItems] = useState<OrdenFormItem[]>([]);
  const [activeModal, setActiveModal] = useState<"producto" | "servicio" | null>(null);
  const [pagos, setPagos] = useState<Omit<Pago, "id" | "ordenId">[]>([]);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);

  // ──── Modal
  const [showVehiculoModal, setShowVehiculoModal] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: { tipoVehiculo: "sedan" }
  });
  const placaValue = watch("placa") || "";

  // ════════════════════════════════════════════════════════════════════════════════
  // EFECTOS INICIALES
  // ════════════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";

    if (!ordenId) {
      getProximoNumeroOrden().then(setNumeroOrden);
    }

    getUsuarios()
      .then((usuarios) => {
        setPersonalDisponible(
          usuarios.filter((usuario) => usuario.activo && usuario.role === "tecnico")
        );
      })
      .catch(() => toast.error("No se pudo cargar el personal activo"))
      .finally(() => setCargandoPersonal(false));

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [ordenId]);

  useEffect(() => {
    if (!ordenId) return;

    let active = true;
    const cargarOrden = async () => {
      try {
        const orden = await getOrdenById(ordenId);
        if (!orden) {
          toast.error("Orden no encontrada");
          onClose();
          return;
        }

        const [cliente, vehiculo, itemsOrden, pagosOrden, devolucionesOrden] = await Promise.all([
          getClienteById(orden.clienteId),
          getVehiculoById(orden.vehiculoId),
          getItemsOrden(ordenId),
          getPagos(ordenId),
          getDevolucionesByOrden(ordenId),
        ]);

        if (!active) return;

        setOrdenEditando(orden);
        setNumeroOrden(orden.numero ?? null);
        setClienteData(cliente);
        setVehiculoData(vehiculo);
        setTipoServicio(orden.tipoServicio);
        setMotivo(orden.motivo ?? "");
        setKm(orden.kilometrajeIngreso ? String(orden.kilometrajeIngreso) : "");
        setNotasInternas(orden.notasInternas ?? "");
        setChecklist(orden.checklistInventario?.length ? orden.checklistInventario : CHECKLIST_DEFAULT);
        setNivelCombustible(orden.nivelCombustible ?? "1/2");
        setDanos(orden.inspeccionVisual?.danos ?? []);
        setItems(itemsOrden.map((item) => ({ ...item })));
        setDevoluciones(devolucionesOrden);
        setPagos(pagosOrden.map((pago) => ({
          monto: pago.monto,
          montoBase: pago.montoBase,
          recargo: pago.recargo,
          porcentajeRecargo: pago.porcentajeRecargo,
          metodoPago: pago.metodoPago,
          banco: pago.banco,
          referencia: pago.referencia,
          notas: pago.notas,
          createdAt: pago.createdAt,
          registradoPor: pago.registradoPor,
        })));
        setPersonalSeleccionadoIds(
          orden.personalAsignado?.map((usuario) => usuario.uid) ??
          (orden.tecnicoId ? [orden.tecnicoId] : [])
        );

        reset({
          nombre: cliente?.nombre || "",
          apellido: cliente?.apellido || "",
          identificacion: cliente?.identificacion || "",
          telefono: cliente?.telefono || "",
          email: cliente?.email || "",
          direccion: cliente?.direccion || "",
          placa: vehiculo?.placa || "",
          marca: vehiculo?.marca || "",
          modelo: vehiculo?.modelo || "",
          anio: vehiculo?.anio || new Date().getFullYear(),
          color: vehiculo?.color || "",
          vin: vehiculo?.vin || "",
          tipoVehiculo: vehiculo?.tipoVehiculo || "sedan",
        });

        setCurrentPhase("diagnostico");
      } catch (error) {
        console.error(error);
        toast.error("No se pudo cargar la orden");
      }
    };

    cargarOrden();
    return () => {
      active = false;
    };
  }, [ordenId, reset, onClose]);

  // ════════════════════════════════════════════════════════════════════════════════
  // BÚSQUEDA Y SELECCIÓN
  // ════════════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!filtroCliente.trim()) {
      setClientesFiltrados([]);
      return;
    }
    const q = filtroCliente.toLowerCase();
    const filtrados = clientes.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      c.apellido.toLowerCase().includes(q) ||
      c.identificacion.toLowerCase().includes(q)
    );
    setClientesFiltrados(filtrados);
  }, [filtroCliente, clientes]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (!placaValue.trim() || placaValue.length < 2) {
        setSugerencias([]);
        return;
      }
      searchVehiculosByPlacaPrefix(placaValue)
        .then(setSugerencias)
        .catch(console.error);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [placaValue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setMostrarSugerencias(false);
      }
      if (clienteWrapperRef.current && !clienteWrapperRef.current.contains(event.target as Node)) {
        setMostrarSugerenciasClientes(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const cargarClientes = async () => {
    if (clientes.length > 0) return;
    setCargandoClientes(true);
    try {
      const data = await getClientes();
      setClientes(data);
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar clientes");
    } finally {
      setCargandoClientes(false);
    }
  };

  const seleccionarCliente = async (cliente: Cliente) => {
    setClienteData(cliente);
    setMostrarSugerenciasClientes(false);
    setFiltroCliente(`${cliente.nombre} ${cliente.apellido}`);

    setCargandoVehiculosCliente(true);
    try {
      if (!cliente.id) return;
      const vehiculos = await getVehiculosByCliente(cliente.id);
      setVehiculosDelCliente(vehiculos);

      if (vehiculos.length === 1) {
        seleccionarVehiculo(vehiculos[0], cliente);
      } else if (vehiculos.length === 0) {
        toast("El cliente no tiene vehículos. Ingrese uno nuevo.", { icon: "ℹ️" });
        setVehiculoData(null);
        reset({
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          identificacion: cliente.identificacion,
          telefono: cliente.telefono,
          email: cliente.email || "",
          direccion: cliente.direccion || "",
          placa: "", marca: "", modelo: "", anio: new Date().getFullYear(), color: "", vin: "", tipoVehiculo: "sedan",
        });
      } else {
        setVehiculoData(null);
        reset({
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          identificacion: cliente.identificacion,
          telefono: cliente.telefono,
          email: cliente.email || "",
          direccion: cliente.direccion || "",
          placa: "", marca: "", modelo: "", anio: new Date().getFullYear(), color: "", vin: "", tipoVehiculo: "sedan",
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al obtener vehículos del cliente");
    } finally {
      setCargandoVehiculosCliente(false);
    }
  };

  const seleccionarVehiculo = async (vehiculo: Vehiculo, cliente: Cliente) => {
    setBuscando(true);
    try {
      setVehiculoData(vehiculo);
      setClienteData(cliente);

      reset({
        nombre: cliente.nombre || "",
        apellido: cliente.apellido || "",
        identificacion: cliente.identificacion || "",
        telefono: cliente.telefono || "",
        email: cliente.email || "",
        direccion: cliente.direccion || "",
        placa: vehiculo.placa,
        marca: vehiculo.marca || "",
        modelo: vehiculo.modelo || "",
        anio: vehiculo.anio || new Date().getFullYear(),
        color: vehiculo.color || "",
        vin: vehiculo.vin || "",
        tipoVehiculo: vehiculo.tipoVehiculo || "sedan",
      });
      toast.success(`Vehículo ${vehiculo.placa} seleccionado`);
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar vehículo");
    } finally {
      setBuscando(false);
    }
  };

  const buscarPlacaBtn = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (!placaValue.trim()) return;

    setBuscando(true);
    try {
      const vehiculo = await getVehiculoByPlaca(placaValue);
      if (vehiculo) {
        const cliente = await getClienteById(vehiculo.clienteId);
        await seleccionarVehiculo(vehiculo, cliente!);
        toast.success(`Vehículo ${vehiculo.placa} cargado`);
      } else {
        toast("Vehículo no encontrado. Ingrese los datos.", { icon: "ℹ️" });
        setVehiculoData(null);
        setClienteData(null);
        reset({
          placa: placaValue.toUpperCase(),
          nombre: "", apellido: "", identificacion: "", telefono: "", email: "", direccion: "",
          marca: "", modelo: "", anio: new Date().getFullYear(), color: "", vin: "", tipoVehiculo: "sedan",
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Error en la búsqueda");
    } finally {
      setBuscando(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════════
  // LÓGICA DE ITEMS
  // ════════════════════════════════════════════════════════════════════════════════

  const getCantidadProductoEnItems = (productoId: string, excludeIndex?: number) =>
    items.reduce((sum, current, index) => {
      if (index === excludeIndex || current.tipo !== "producto" || current.productoId !== productoId) return sum;
      return sum + current.cantidad;
    }, 0);

  const getStockDisponibleParaItem = (item: OrdenFormItem, index: number) => {
    if (item.tipo !== "producto" || !item.productoId || item.stockDisponible === undefined) return Infinity;
    return Math.max(0, item.stockDisponible - getCantidadProductoEnItems(item.productoId, index));
  };

  const handleAddItem = async (item: AgregarItemPayload) => {
    if (item.tipo === "producto" && item.productoId && item.stockDisponible !== undefined) {
      const cantidadYaAgregada = getCantidadProductoEnItems(item.productoId);
      const disponible = Math.max(0, item.stockDisponible - cantidadYaAgregada);
      if (item.cantidad > disponible) {
        toast.error(`Stock insuficiente. Disponible: ${disponible}`);
        return;
      }
    }

    const subtotal = item.cantidad * item.precioUnitario * (1 + item.impuestoAplicable / 100);
    setItems((prev) => [...prev, { ...item, subtotal }]);
    toast.success("Ítem agregado");
  };

  const actualizarCantidad = (index: number, delta: number) => {
    const current = items[index];
    if (!current) return;
    const nuevaCantidad = Math.max(1, current.cantidad + delta);
    const stockDisponible = getStockDisponibleParaItem(current, index);
    if (nuevaCantidad > stockDisponible) {
      toast.error(`Stock insuficiente. Disponible: ${stockDisponible}`);
      return;
    }

    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const subtotal = nuevaCantidad * item.precioUnitario * (1 + item.impuestoAplicable / 100);
        return { ...item, cantidad: nuevaCantidad, subtotal };
      })
    );
  };

  const eliminarItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    toast.success("Ítem eliminado");
  };

  // ════════════════════════════════════════════════════════════════════════════════
  // CÁLCULOS
  // ════════════════════════════════════════════════════════════════════════════════

  const total = items.reduce((s, i) => s + i.subtotal, 0);
  const personalAsignado = personalDisponible.filter((usuario) =>
    personalSeleccionadoIds.includes(usuario.uid)
  );

  // ════════════════════════════════════════════════════════════════════════════════
  // GUARDAR
  // ════════════════════════════════════════════════════════════════════════════════

  const sincronizarItemsOrden = async (orderId: string) => {
    const actuales = await getItemsOrden(orderId);
    const idsEditados = new Set(items.map((item) => item.id).filter(Boolean));

    await Promise.all(
      actuales
        .filter((item) => item.id && !idsEditados.has(item.id))
        .map((item) => deleteItemOrden(orderId, item.id!))
    );

    await Promise.all(
      items.map((item) => {
        const { id, ...data } = item;
        delete (data as any).stockDisponible;
        if (id) {
          return updateItemOrden(orderId, id, data);
        }
        return addItemOrden(orderId, { ...data, ordenId: orderId });
      })
    );
  };

  const onSubmitRecepcion = async (data: FormData) => {
    setGuardando(true);
    try {
      // 1. Guardar/Actualizar Cliente
      let cId = clienteData?.id;
      const cData = {
        nombre: data.nombre,
        apellido: data.apellido,
        identificacion: data.identificacion,
        telefono: data.telefono,
        email: data.email,
        direccion: data.direccion,
      };
      if (cId) {
        await updateCliente(cId, cData);
      } else {
        cId = await createCliente(cData);
      }

      // 2. Guardar/Actualizar Vehículo
      let vId = vehiculoData?.id;
      const vData = {
        clienteId: cId,
        placa: data.placa.toUpperCase(),
        marca: data.marca,
        modelo: data.modelo,
        anio: data.anio,
        color: data.color,
        vin: data.vin,
        tipoVehiculo: data.tipoVehiculo as any,
      };
      if (vId) {
        await updateVehiculo(vId, vData);
      } else {
        vId = await createVehiculo(vData);
      }

      setClienteData(cData as any);
      setVehiculoData({ id: vId, ...vData });

      toast.success("Recepción registrada");
      setCurrentPhase("diagnostico");
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar recepción");
    } finally {
      setGuardando(false);
    }
  };

  const onSubmitDiagnostico = async (data: FormData) => {
    if (!motivo.trim()) { toast.error("Ingrese el motivo de la visita"); return; }
    if (!km || isNaN(Number(km))) { toast.error("Ingrese el kilometraje"); return; }

    setGuardando(true);
    try {
      if (!clienteData?.id || !vehiculoData?.id) {
        toast.error("Cliente o vehículo no seleccionados");
        return;
      }

      // Crear cotización
      const cotizacionId = await createOrdenConItems({
        vehiculoId: vehiculoData.id,
        clienteId: clienteData.id,
        estado: "Ingreso",
        tipoServicio,
        motivo,
        kilometrajeIngreso: Number(km),
        nivelCombustible,
        checklistInventario: checklist,
        inspeccionVisual: { danos, fotoUrls: [] },
        notasInternas,
        informeTecnico: "",
        tecnicoId: personalAsignado[0]?.uid,
        personalAsignado: personalAsignado.map((usuario) => ({
          uid: usuario.uid,
          email: usuario.email,
          displayName: usuario.displayName,
          role: usuario.role,
        })),
        fotoUrls: [],
        esCotizacion: true,
      }, items);

      setOrdenEditando({ id: cotizacionId } as any);
      toast.success("Cotización creada");
      setCurrentPhase("repuestos");
    } catch (error) {
      console.error(error);
      toast.error("Error al crear cotización");
    } finally {
      setGuardando(false);
    }
  };

  const onSubmitOrdenFinal = async (data: FormData) => {
    if (!ordenEditando?.id) {
      toast.error("No hay cotización seleccionada");
      return;
    }

    setGuardando(true);
    try {
      await updateOrden(ordenEditando.id, {
        esCotizacion: false,
        estado: "Proceso",
        tecnicoId: personalAsignado[0]?.uid ?? "",
        personalAsignado: personalAsignado.map((usuario) => ({
          uid: usuario.uid,
          email: usuario.email,
          displayName: usuario.displayName,
          role: usuario.role,
        })),
      });

      await sincronizarItemsOrden(ordenEditando.id);

      // Guardar pagos si existen
      if (pagos.length > 0) {
        await Promise.all(pagos.map(pago => createPago({ ...pago, ordenId: ordenEditando.id! })));
      }

      toast.success("Orden de trabajo convertida");
      setCurrentPhase("entrega");
    } catch (error) {
      console.error(error);
      toast.error("Error al crear orden de trabajo");
    } finally {
      setGuardando(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════════
  // UI FASES
  // ════════════════════════════════════════════════════════════════════════════════

  const renderPhase = () => {
    switch (currentPhase) {
      case "recepcion":
        return <RecepcionPhase {...{
          data: { register, watch, errors, reset, handleSubmit, onSubmit: onSubmitRecepcion },
          clienteData, vehiculoData, placaValue, modoBusqueda,
          buscando, sugerencias, mostrarSugerencias, clientes, cargandoClientes, filtroCliente, clientesFiltrados,
          mostrarSugerenciasClientes, vehiculosDelCliente, cargandoVehiculosCliente,
          wrapperRef, clienteWrapperRef,
          setModoBusqueda, setValue, setMostrarSugerencias, buscarPlacaBtn, cargarClientes,
          seleccionarCliente, seleccionarVehiculo, setShowVehiculoModal, setFiltroCliente, setMostrarSugerenciasClientes,
          setCargandoClientes
        }} />;

      case "diagnostico":
        return <DiagnosticoPhase {...{
          data: { register, watch, errors, reset, handleSubmit, onSubmit: onSubmitDiagnostico },
          clienteData, vehiculoData, tipoServicio, motivo, km, notasInternas,
          checklist, nivelCombustible, danos,
          personalDisponible, personalSeleccionadoIds, cargandoPersonal,
          setTipoServicio, setMotivo, setKm, setNotasInternas,
          setChecklist, setNivelCombustible, setDanos,
          setPersonalSeleccionadoIds,
          items, activeModal, setActiveModal, handleAddItem, actualizarCantidad, eliminarItem,
          total
        }} />;

      case "repuestos":
        return <RepuestosPhase {...{
          items, total, setCurrentPhase
        }} />;

      case "orden":
        return <OrdenPhase {...{
          data: { register, watch, errors, reset, handleSubmit, onSubmit: onSubmitOrdenFinal },
          clienteData, vehiculoData, numeroOrden,
          items, activeModal, setActiveModal, handleAddItem, actualizarCantidad, eliminarItem, total,
          pagos, setPagos, showPagoModal, setShowPagoModal,
          personalDisponible, personalSeleccionadoIds, setPersonalSeleccionadoIds,
          setCurrentPhase
        }} />;

      case "entrega":
        return <EntregaPhase {...{
          clienteData, vehiculoData, numeroOrden,
          items, total, pagos, setPagos, showPagoModal, setShowPagoModal,
          setCurrentPhase, onClose
        }} />;

      default:
        return null;
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className={`fixed inset-y-0 left-0 right-0 z-[100] flex justify-end ${sidebarOpen ? "sidebar-aware-overlay" : ""}`}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="relative w-full bg-[var(--bg-primary)] h-full min-h-0 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-card)] sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="btn-ghost btn-icon -ml-2">
              <X size={20} />
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-bold">{PHASE_CONFIG[currentPhase].label}</h2>
              <p className="text-xs text-[var(--text-muted)]">{PHASE_CONFIG[currentPhase].description}</p>
            </div>
          </div>
          <button
            form={`form-${currentPhase}`}
            type="submit"
            disabled={guardando}
            className="btn-primary btn-sm px-3 py-1.5"
          >
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Siguiente
          </button>
        </div>

        {/* Indicador de fases */}
        <PhaseIndicator currentPhase={currentPhase} setCurrentPhase={setCurrentPhase} />

        {/* Contenido */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {renderPhase()}
        </div>
      </div>

      {/* Modales */}
      {activeModal && (
        <AgregarItemModal
          tipo={activeModal}
          onClose={() => setActiveModal(null)}
          onAdd={handleAddItem}
        />
      )}
      {showVehiculoModal && (
        <VehiculoModal
          isOpen={showVehiculoModal}
          onClose={() => setShowVehiculoModal(false)}
          onSuccess={(v) => buscarPlacaBtn()}
        />
      )}
      {showPagoModal && (
        <RegistrarPagoModal
          totalOrden={total}
          pagos={pagos}
          onClose={() => setShowPagoModal(false)}
          onChangePagos={setPagos}
        />
      )}
    </div>,
    document.body
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// COMPONENTES DE FASES
// ════════════════════════════════════════════════════════════════════════════════

function PhaseIndicator({ currentPhase, setCurrentPhase }: { currentPhase: WorkflowPhase; setCurrentPhase: (p: WorkflowPhase) => void }) {
  const phases: WorkflowPhase[] = ["recepcion", "diagnostico", "repuestos", "orden", "entrega"];
  const currentIndex = phases.indexOf(currentPhase);

  return (
    <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {phases.map((phase, index) => (
          <React.Fragment key={phase}>
            <button
              onClick={() => setCurrentPhase(phase)}
              disabled={index > currentIndex}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap text-xs font-semibold transition-all ${
                index === currentIndex
                  ? "bg-[var(--accent)] text-white"
                  : index < currentIndex
                  ? "bg-[var(--success)] text-white cursor-pointer"
                  : "bg-[var(--border)] text-[var(--text-muted)] cursor-not-allowed"
              }`}
            >
              {index < currentIndex ? <CheckCircle2 size={14} /> : <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">{index + 1}</span>}
              {PHASE_CONFIG[phase].label}
            </button>
            {index < phases.length - 1 && <ChevronRight size={16} className="text-[var(--border)] flex-shrink-0" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// FASE 1: RECEPCIÓN
// ──────────────────────────────────────────────────────────────────────────────

function RecepcionPhase(props: any) {
  const {
    data, clienteData, vehiculoData, placaValue, modoBusqueda,
    buscando, sugerencias, mostrarSugerencias, clientes, cargandoClientes, filtroCliente, clientesFiltrados,
    mostrarSugerenciasClientes, vehiculosDelCliente, cargandoVehiculosCliente,
    wrapperRef, clienteWrapperRef,
    setModoBusqueda, setValue, setMostrarSugerencias, buscarPlacaBtn, cargarClientes,
    seleccionarCliente, seleccionarVehiculo, setShowVehiculoModal, setFiltroCliente, setMostrarSugerenciasClientes,
    setCargandoClientes
  } = props;

  const { register, watch, errors, handleSubmit, onSubmit } = data;

  return (
    <form id="form-recepcion" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Búsqueda ── */}
      <div className="card space-y-4">
        <div className="flex bg-[var(--bg-secondary)] p-1 rounded-lg border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setModoBusqueda("placa")}
            className={`flex-1 px-3 py-2 text-xs font-semibold rounded-md transition-all ${
              modoBusqueda === "placa"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Car size={14} className="inline mr-1" /> Por Placa
          </button>
          <button
            type="button"
            onClick={() => {
              setModoBusqueda("cliente");
              cargarClientes();
            }}
            className={`flex-1 px-3 py-2 text-xs font-semibold rounded-md transition-all ${
              modoBusqueda === "cliente"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <User size={14} className="inline mr-1" /> Por Cliente
          </button>
        </div>

        {modoBusqueda === "placa" ? (
          <div className="flex gap-2" ref={wrapperRef}>
            <div className="relative flex-1">
              <input
                type="text"
                className="input uppercase font-mono text-lg tracking-widest w-full"
                placeholder="ABC-1234"
                {...register("placa", { required: false })}
                onChange={(e) => setValue("placa", e.target.value.toUpperCase())}
                onFocus={() => setMostrarSugerencias(true)}
              />
              {mostrarSugerencias && sugerencias.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {sugerencias.map((v: Vehiculo) => (
                    <div
                      key={v.id}
                      className="px-3 py-2 cursor-pointer hover:bg-[var(--bg-secondary)] border-b border-[var(--border)] last:border-0"
                      onClick={() => {
                        setValue("placa", v.placa);
                        setMostrarSugerencias(false);
                      }}
                    >
                      <p className="font-semibold text-sm">{v.placa}</p>
                      <p className="text-xs text-[var(--text-muted)]">{v.marca} {v.modelo} ({v.anio})</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={buscarPlacaBtn} disabled={buscando} className="btn-primary btn-sm">
              {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            </button>
            {!vehiculoData && placaValue.length >= 3 && (
              <button type="button" onClick={() => setShowVehiculoModal(true)} className="btn-secondary btn-sm">
                <Plus size={14} />
              </button>
            )}
          </div>
        ) : (
          <div className="relative" ref={clienteWrapperRef}>
            <input
              type="text"
              className="input w-full pl-9 text-sm"
              placeholder="Nombre, apellido o ID..."
              value={filtroCliente}
              onChange={(e) => {
                setFiltroCliente(e.target.value);
                setMostrarSugerenciasClientes(true);
              }}
              onFocus={() => {
                cargarClientes();
                setMostrarSugerenciasClientes(true);
              }}
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            {cargandoClientes && (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />
            )}
            {mostrarSugerenciasClientes && clientesFiltrados.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-md shadow-lg max-h-52 overflow-y-auto">
                {clientesFiltrados.map((c: Cliente) => (
                  <div
                    key={c.id}
                    className="px-3 py-2 cursor-pointer hover:bg-[var(--bg-secondary)] border-b border-[var(--border)] last:border-0"
                    onClick={() => seleccionarCliente(c)}
                  >
                    <p className="font-semibold text-sm">{c.nombre} {c.apellido}</p>
                    <p className="text-xs text-[var(--text-muted)]">{c.identificacion}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Vehículos del cliente ── */}
      {clienteData && vehiculosDelCliente.length > 1 && !vehiculoData && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-sm">Vehículos del cliente</h3>
          {cargandoVehiculosCliente ? (
            <div className="flex justify-center py-4">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {vehiculosDelCliente.map((v: Vehiculo) => (
                <div
                  key={v.id}
                  onClick={() => seleccionarVehiculo(v, clienteData)}
                  className="p-3 rounded border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer transition-all"
                >
                  <p className="font-semibold text-sm">{v.placa}</p>
                  <p className="text-xs text-[var(--text-muted)]">{v.marca} {v.modelo} {v.anio}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ──Datos del cliente ── */}
      {vehiculoData && (
        <>
          <div className="card space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2"><User size={16} /> Datos del Cliente</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Nombres *</label>
                <input type="text" className="input" {...register("nombre", { required: true })} />
                {errors.nombre && <p className="text-xs text-red-500">Requerido</p>}
              </div>
              <div className="form-group">
                <label className="label">Apellidos *</label>
                <input type="text" className="input" {...register("apellido", { required: true })} />
                {errors.apellido && <p className="text-xs text-red-500">Requerido</p>}
              </div>
              <div className="form-group">
                <label className="label">Cédula *</label>
                <input type="text" className="input" {...register("identificacion", { required: true })} />
              </div>
              <div className="form-group">
                <label className="label">Teléfono *</label>
                <input type="tel" className="input" {...register("telefono", { required: true })} />
              </div>
              <div className="form-group col-span-2">
                <label className="label">Email</label>
                <input type="email" className="input" {...register("email")} />
              </div>
              <div className="form-group col-span-2">
                <label className="label">Dirección</label>
                <input type="text" className="input" {...register("direccion")} />
              </div>
            </div>
          </div>

          {/* ── Datos del vehículo ── */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Car size={16} /> Datos del Vehículo</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Placa *</label>
                <input type="text" className="input uppercase" {...register("placa", { required: true })} />
              </div>
              <div className="form-group">
                <label className="label">Año *</label>
                <input type="number" className="input" {...register("anio", { required: true })} />
              </div>
              <div className="form-group">
                <label className="label">Marca</label>
                <input type="text" className="input" {...register("marca")} />
              </div>
              <div className="form-group">
                <label className="label">Modelo</label>
                <input type="text" className="input" {...register("modelo")} />
              </div>
              <div className="form-group">
                <label className="label">Color</label>
                <input type="text" className="input" {...register("color")} />
              </div>
              <div className="form-group">
                <label className="label">VIN</label>
                <input type="text" className="input" {...register("vin")} />
              </div>
            </div>
          </div>
        </>
      )}
    </form>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// FASE 2: DIAGNÓSTICO
// ──────────────────────────────────────────────────────────────────────────────

function DiagnosticoPhase(props: any) {
  const {
    data, tipoServicio, motivo, km, notasInternas,
    checklist, nivelCombustible, danos,
    personalDisponible, personalSeleccionadoIds, cargandoPersonal,
    setTipoServicio, setMotivo, setKm, setNotasInternas,
    setChecklist, setNivelCombustible,
    setPersonalSeleccionadoIds,
    items, activeModal, setActiveModal, handleAddItem, actualizarCantidad, eliminarItem,
    total
  } = props;

  const { register, handleSubmit, onSubmit } = data;

  return (
    <form id="form-diagnostico" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Detalles de la orden ── */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Wrench size={16} /> Detalles</h3>
        <div className="grid grid-cols-1 gap-3">
          <div className="form-group">
            <label className="label">Tipo de Servicio *</label>
            <select
              className="input"
              value={tipoServicio}
              onChange={(e) => setTipoServicio(e.target.value as TipoServicio)}
            >
              <option value="Mantenimiento">Mantenimiento</option>
              <option value="Reparación">Reparación</option>
              <option value="Garantía">Garantía</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label">Motivo de la Visita *</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Describa el problema del vehículo..."
            />
          </div>
          <div className="form-group">
            <label className="label">Kilometraje *</label>
            <input
              type="number"
              className="input"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="form-group">
            <label className="label">Notas Internas</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={notasInternas}
              onChange={(e) => setNotasInternas(e.target.value)}
              placeholder="Notas para el técnico..."
            />
          </div>
        </div>
      </div>

      {/* ── Inspección inicial ── */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-sm">Inspección Inicial</h3>
        <div className="form-group">
          <label className="label">Nivel de Combustible</label>
          <select
            className="input"
            value={nivelCombustible}
            onChange={(e) => setNivelCombustible(e.target.value as NivelCombustible)}
          >
            <option value="Vacío">Vacío</option>
            <option value="1/4">1/4</option>
            <option value="1/2">1/2</option>
            <option value="3/4">3/4</option>
            <option value="Lleno">Lleno</option>
          </select>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--text-muted)]">Accesorios del Vehículo</p>
          {checklist.map((item: ChecklistItem, index: number) => (
            <label key={index} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => {
                  const newChecklist = [...checklist];
                  newChecklist[index].checked = e.target.checked;
                  setChecklist(newChecklist);
                }}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ── Asignación de técnico ── */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Wrench size={16} /> Asignación del Técnico</h3>
        {cargandoPersonal ? (
          <div className="flex justify-center py-4">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : personalDisponible.length === 0 ? (
          <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]">
            <p className="text-xs text-[var(--text-muted)]">No hay técnicos disponibles.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {personalDisponible.map((tecnico: AppUser) => (
              <label key={tecnico.uid} className="flex items-center gap-2 p-2 rounded border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={personalSeleccionadoIds.includes(tecnico.uid)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setPersonalSeleccionadoIds([...personalSeleccionadoIds, tecnico.uid]);
                    } else {
                      setPersonalSeleccionadoIds(personalSeleccionadoIds.filter((id: string) => id !== tecnico.uid));
                    }
                  }}
                  className="w-4 h-4 rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{tecnico.displayName}</p>
                  <p className="text-xs text-[var(--text-muted)]">{tecnico.email}</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* ── Presupuesto ── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Presupuesto</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveModal("producto")}
              className="btn-secondary btn-xs"
            >
              <Plus size={12} /> Producto
            </button>
            <button
              type="button"
              onClick={() => setActiveModal("servicio")}
              className="btn-secondary btn-xs"
            >
              <Plus size={12} /> Servicio
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]">
            <p className="text-xs text-[var(--text-muted)]">Sin ítems añadidos aún.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {items.map((item: Omit<ItemOrden, "id" | "ordenId"> & { id?: string }, index: number) => (
              <div key={index} className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{item.descripcion}</p>
                    <p className="text-xs text-[var(--text-muted)]">{item.tipo === "producto" ? item.productoSku : "Servicio"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminarItem(index)}
                    className="btn-ghost btn-sm text-red-500 hover:text-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => actualizarCantidad(index, -1)} className="btn-ghost btn-sm">−</button>
                    <span className="w-8 text-center font-semibold">{item.cantidad}</span>
                    <button type="button" onClick={() => actualizarCantidad(index, 1)} className="btn-ghost btn-sm">+</button>
                  </div>
                  <span className="font-semibold">${item.subtotal.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-3 border-t border-[var(--border)] flex justify-between items-center text-sm font-semibold">
          <span>Total Presupuesto:</span>
          <span className="text-[var(--accent)] text-lg">${total.toFixed(2)}</span>
        </div>
      </div>
    </form>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// FASE 3: REPUESTOS
// ──────────────────────────────────────────────────────────────────────────────

function RepuestosPhase({ items, total, setCurrentPhase }: any) {
  return (
    <div className="space-y-6">
      <div className="card space-y-4 border-2 border-[var(--accent)]/30 bg-[var(--accent)]/5">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-[var(--accent)] text-white">
            <Package size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm">Gestión de Repuestos</h3>
            <p className="text-xs text-[var(--text-muted)]">Registro de compra de repuestos al proveedor</p>
          </div>
        </div>
      </div>

      {/* Resumen de presupuesto */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-sm">Ítems en Presupuesto</h3>
        {items.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">Sin ítems agregados.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-xs py-1 border-b border-[var(--border)] last:border-0">
                <span className="truncate">{item.descripcion}</span>
                <span className="font-semibold">${item.subtotal.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="pt-3 border-t border-[var(--border)] flex justify-between font-bold">
          <span>Total:</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      {/* Instrucciones */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2"><AlertCircle size={16} /> Próximos Pasos</h3>
        <ol className="space-y-2 text-xs">
          <li className="flex gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[10px] font-bold">1</span>
            <span><strong>Contactar al proveedor</strong> con los ítems del presupuesto</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[10px] font-bold">2</span>
            <span><strong>Registrar compra</strong> en el sistema cuando lleguen los repuestos</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[10px] font-bold">3</span>
            <span><strong>Informar al cliente</strong> vía WhatsApp del estado del diagnóstico</span>
          </li>
        </ol>
      </div>

      {/* Botón para continuar */}
      <button
        type="button"
        onClick={() => setCurrentPhase("orden")}
        className="btn-primary w-full justify-center"
      >
        <ChevronRight size={16} /> Ir a Orden de Trabajo
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// FASE 4: ORDEN DE TRABAJO
// ──────────────────────────────────────────────────────────────────────────────

function OrdenPhase(props: any) {
  const {
    data, numeroOrden,
    items, activeModal, setActiveModal, handleAddItem, actualizarCantidad, eliminarItem, total,
    pagos, setPagos, showPagoModal, setShowPagoModal,
    personalDisponible, personalSeleccionadoIds, setPersonalSeleccionadoIds
  } = props;

  const { register, handleSubmit, onSubmit } = data;

  return (
    <form id="form-orden" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Header ── */}
      <div className="card bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent)]/5 border border-[var(--accent)]/30">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">Orden #<span className="text-lg text-[var(--accent)]">{numeroOrden ? String(numeroOrden).padStart(4, "0") : "..."}</span></h3>
          <span className="px-2 py-1 rounded-full text-xs font-bold bg-[var(--accent)]/20 text-[var(--accent)]">En Proceso</span>
        </div>
      </div>

      {/* ── Asignación de personal ── */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Wrench size={16} /> Técnicos Asignados</h3>
        <div className="space-y-2">
          {personalDisponible.map((tecnico: AppUser) => (
            <label key={tecnico.uid} className="flex items-center gap-2 p-2 rounded border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer">
              <input
                type="checkbox"
                checked={personalSeleccionadoIds.includes(tecnico.uid)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setPersonalSeleccionadoIds([...personalSeleccionadoIds, tecnico.uid]);
                  } else {
                    setPersonalSeleccionadoIds(personalSeleccionadoIds.filter((id: string) => id !== tecnico.uid));
                  }
                }}
                className="w-4 h-4 rounded"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{tecnico.displayName}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* ── Ítems de la orden ── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Ítems</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveModal("producto")}
              className="btn-secondary btn-xs"
            >
              <Plus size={12} /> Producto
            </button>
            <button
              type="button"
              onClick={() => setActiveModal("servicio")}
              className="btn-secondary btn-xs"
            >
              <Plus size={12} /> Servicio
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]">
            <p className="text-xs text-[var(--text-muted)]">Sin ítems. Agregue productos o servicios.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {items.map((item: Omit<ItemOrden, "id" | "ordenId"> & { id?: string }, index: number) => (
              <div key={index} className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{item.descripcion}</p>
                    <p className="text-xs text-[var(--text-muted)]">${item.precioUnitario.toFixed(2)} x {item.cantidad}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminarItem(index)}
                    className="btn-ghost btn-sm text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => actualizarCantidad(index, -1)} className="btn-ghost btn-sm">−</button>
                    <span className="w-6 text-center">{item.cantidad}</span>
                    <button type="button" onClick={() => actualizarCantidad(index, 1)} className="btn-ghost btn-sm">+</button>
                  </div>
                  <span className="font-bold">${item.subtotal.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Pago ── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2"><DollarSign size={16} /> Pago</h3>
          <button type="button" onClick={() => setShowPagoModal(true)} className="btn-secondary btn-sm">
            <Plus size={12} /> Registrar Pago
          </button>
        </div>

        {pagos.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">Sin pagos registrados.</p>
        ) : (
          <div className="space-y-2 text-xs">
            {pagos.map((pago: Omit<Pago, "id">, idx: number) => (
              <div key={idx} className="flex justify-between py-1 border-b border-[var(--border)] last:border-0">
                <span>{pago.metodoPago}</span>
                <span className="font-semibold">${pago.monto.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="pt-3 border-t border-[var(--border)] flex justify-between font-bold">
          <span>Total Orden:</span>
          <span className="text-[var(--accent)] text-lg">${total.toFixed(2)}</span>
        </div>
      </div>
    </form>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// FASE 5: ENTREGA
// ──────────────────────────────────────────────────────────────────────────────

function EntregaPhase({ clienteData, vehiculoData, numeroOrden, items, total, pagos, setPagos, showPagoModal, setShowPagoModal, setCurrentPhase, onClose }: any) {
  return (
    <div className="space-y-6">
      {/* ── Control de Calidad ── */}
      <div className="card space-y-4 border-2 border-[var(--success)]/30 bg-[var(--success)]/5">
        <h3 className="font-bold text-sm flex items-center gap-2"><CheckCircle2 size={16} className="text-[var(--success)]" /> Control de Calidad</h3>
        <div className="space-y-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded" />
            <span>Prueba de ruta completada</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded" />
            <span>Vehículo lavado</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded" />
            <span>Documentación completa</span>
          </label>
        </div>
      </div>

      {/* ── Resumen de orden ── */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-sm">Orden #{numeroOrden ? String(numeroOrden).padStart(4, "0") : "..."}</h3>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Cliente:</span> <strong>{clienteData?.nombre} {clienteData?.apellido}</strong></div>
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Vehículo:</span> <strong>{vehiculoData?.placa}</strong></div>
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Ítems:</span> <strong>{items.length}</strong></div>
          <div className="flex justify-between pt-2 border-t border-[var(--border)]"><strong>Total:</strong> <strong className="text-[var(--accent)]">${total.toFixed(2)}</strong></div>
        </div>
      </div>

      {/* ── Pago ── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2"><DollarSign size={16} /> Pago Final</h3>
          <button type="button" onClick={() => setShowPagoModal(true)} className="btn-secondary btn-sm">
            <Plus size={12} /> Agregar
          </button>
        </div>

        {pagos.length > 0 && (
          <div className="space-y-2 text-xs">
            {pagos.map((pago: Omit<Pago, "id">, idx: number) => (
              <div key={idx} className="flex justify-between py-1 border-b border-[var(--border)]">
                <span>{pago.metodoPago}</span>
                <span>${pago.monto.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="pt-3 border-t border-[var(--border)]">
          <div className="flex justify-between font-bold text-sm mb-2">
            <span>Total Abonado:</span>
            <span>${pagos.reduce((s: number, p: Pago) => s + p.monto, 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-sm">
            <span>Saldo:</span>
            <span className={total - pagos.reduce((s: number, p: Pago) => s + p.monto, 0) > 0 ? "text-red-500" : "text-[var(--success)]"}>
              ${Math.max(0, total - pagos.reduce((s: number, p: Pago) => s + p.monto, 0)).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Instrucciones finales ── */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-sm">Próximos Pasos</h3>
        <ol className="space-y-2 text-xs">
          <li className="flex gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--success)] text-white flex items-center justify-center text-[10px] font-bold">1</span>
            <span><strong>Enviar orden</strong> al cliente vía WhatsApp</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--success)] text-white flex items-center justify-center text-[10px] font-bold">2</span>
            <span><strong>Registrar pago</strong> en el sistema</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--success)] text-white flex items-center justify-center text-[10px] font-bold">3</span>
            <span><strong>Imprimir documento</strong> de entrega</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--success)] text-white flex items-center justify-center text-[10px] font-bold">4</span>
            <span><strong>Entregar vehículo</strong> al cliente</span>
          </li>
        </ol>
      </div>

      {/* ── Botón finalizar ── */}
      <button
        type="button"
        onClick={onClose}
        className="btn-success w-full justify-center py-3"
      >
        <CheckCircle2 size={16} /> Finalizar y Cerrar
      </button>
    </div>
  );
}
