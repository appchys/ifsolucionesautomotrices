"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  Calculator,
  Camera,
  Car,
  Check,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import AgregarItemModal from "@/components/ordenes/AgregarItemModal";
import ChecklistInventario from "@/components/recepcion/ChecklistInventario";
import DamageSelector from "@/components/recepcion/DamageSelector";
import FuelSelector from "@/components/recepcion/FuelSelector";
import {
  addItemOrden,
  createCliente,
  createOrden,
  createVehiculo,
  getClienteById,
  getProximoNumeroOrden,
  getUsuarios,
  getVehiculoByPlaca,
  getVehiculosByCliente,
  searchVehiculosByPlacaPrefix,
  updateCliente,
  updateOrden,
  updateVehiculo,
  uploadOrdenFoto,
} from "@/lib/services";
import {
  ChecklistItem,
  AppUser,
  Cliente,
  DanoVehiculo,
  FlujoTrabajo,
  ItemOrden,
  NivelCombustible,
  TipoServicio,
  TipoVehiculo,
  Vehiculo,
} from "@/types";

const CHECKLIST_DEFAULT: ChecklistItem[] = [
  { label: "Gata", checked: false },
  { label: "Llanta de repuesto", checked: false },
  { label: "Herramientas (llaves)", checked: false },
  { label: "Extintor", checked: false },
  { label: "Triángulos de emergencia", checked: false },
  { label: "Documentos del vehículo", checked: false },
];

const TIPOS_VEHICULO: TipoVehiculo[] = ["sedan", "suv", "pickup", "camioneta", "moto", "otro"];
const TIPOS_SERVICIO: TipoServicio[] = ["Mantenimiento", "Reparación", "Garantía"];
type PasoOrden = "inspeccion" | "orden" | "ejecucion" | "reparacion" | "entrega";

const FLUJO_DEFAULT: FlujoTrabajo = {
  ejecucionRepuestos: {
    compraProveedorAutorizada: false,
    logisticaRetiraRepuestos: false,
    tecnicosInicianDespiece: false,
    compraRepuestosRegistrada: false,
    notas: "",
  },
  ordenReparacion: {
    presupuestoConvertidoOrden: false,
    tecnicoConfirmaCargado: false,
    reparacionFinalizada: false,
    pruebaRutaRealizada: false,
    notas: "",
  },
  entregaCierre: {
    controlCalidadCompletado: false,
    lavadoRealizado: false,
    lavadoNoAplica: false,
    clienteNotificado: false,
    ordenEnviadaWhatsApp: false,
    pagoEfectivo: false,
    pagoTransferencia: false,
    pagoTarjeta: false,
    vehiculoEntregado: false,
    pendientesInformados: false,
    facturaElectronicaEmitida: false,
    ordenCerradaSistema: false,
    notas: "",
  },
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
  tipoVehiculo: TipoVehiculo;
};

type ClienteDraft = Pick<Cliente, "nombre" | "apellido" | "identificacion" | "telefono" | "email" | "direccion">;

interface Props {
  onClose: () => void;
  onSuccess?: (orderId: string) => void;
  ordenId?: string;
}

const emptyForm = (placa = ""): FormData => ({
  nombre: "",
  apellido: "",
  identificacion: "",
  telefono: "",
  email: "",
  direccion: "",
  placa,
  marca: "",
  modelo: "",
  anio: new Date().getFullYear(),
  color: "",
  vin: "",
  tipoVehiculo: "sedan",
});

function currency(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

export default function NuevaOrdenSidebar({ onClose, onSuccess }: Props) {
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [busquedaRealizada, setBusquedaRealizada] = useState(false);
  const [clienteData, setClienteData] = useState<Cliente | null>(null);
  const [vehiculoData, setVehiculoData] = useState<Vehiculo | null>(null);
  const [editandoVehiculo, setEditandoVehiculo] = useState(true);
  const [mostrarClienteModal, setMostrarClienteModal] = useState(false);
  const [editandoClienteModal, setEditandoClienteModal] = useState(false);
  const [guardandoClienteModal, setGuardandoClienteModal] = useState(false);
  const [vehiculosCliente, setVehiculosCliente] = useState<Vehiculo[]>([]);
  const [cargandoVehiculosCliente, setCargandoVehiculosCliente] = useState(false);
  const [clienteDraft, setClienteDraft] = useState<ClienteDraft>({
    nombre: "",
    apellido: "",
    identificacion: "",
    telefono: "",
    email: "",
    direccion: "",
  });
  const [numeroOrden, setNumeroOrden] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<PasoOrden>("inspeccion");
  const [sugerencias, setSugerencias] = useState<Vehiculo[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [tecnicos, setTecnicos] = useState<AppUser[]>([]);
  const [cargandoTecnicos, setCargandoTecnicos] = useState(false);

  const [tipoServicio, setTipoServicio] = useState<TipoServicio>("Mantenimiento");
  const [motivo, setMotivo] = useState("");
  const [notasInternas, setNotasInternas] = useState("");
  const [mostrarNotasInternas, setMostrarNotasInternas] = useState(false);
  const [tecnicoId, setTecnicoId] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [presupuestoConfirmado, setPresupuestoConfirmado] = useState(false);
  const [km, setKm] = useState("");
  const [nivelCombustible, setNivelCombustible] = useState<NivelCombustible>("1/2");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(CHECKLIST_DEFAULT);
  const [danos, setDanos] = useState<DanoVehiculo[]>([]);
  const [flujoTrabajo, setFlujoTrabajo] = useState<FlujoTrabajo>(FLUJO_DEFAULT);
  const [fotosDiagnostico, setFotosDiagnostico] = useState<{ id: string; file: File; previewUrl: string; descripcion: string }[]>([]);
  const [fotoEditandoId, setFotoEditandoId] = useState<string | null>(null);
  const [descripcionFotoDraft, setDescripcionFotoDraft] = useState("");
  const [items, setItems] = useState<Omit<ItemOrden, "id" | "ordenId">[]>([]);
  const [activeModal, setActiveModal] = useState<"producto" | "servicio" | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const fotosDiagnosticoRef = useRef<HTMLInputElement>(null);
  const fotosDiagnosticoActualesRef = useRef<typeof fotosDiagnostico>([]);
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ defaultValues: emptyForm() });

  const formValues = useWatch({ control });
  const placaValue = formValues.placa || "";
  const clienteNombre = [formValues.nombre, formValues.apellido].filter(Boolean).join(" ") || "Cliente sin nombre";
  const total = useMemo(() => items.reduce((sum, item) => sum + item.subtotal, 0), [items]);

  const getClienteDraft = (cliente: Cliente): ClienteDraft => ({
    nombre: cliente.nombre ?? "",
    apellido: cliente.apellido ?? "",
    identificacion: cliente.identificacion ?? "",
    telefono: cliente.telefono ?? "",
    email: cliente.email ?? "",
    direccion: cliente.direccion ?? "",
  });

  const cargarVehiculosCliente = async (clienteId: string) => {
    setCargandoVehiculosCliente(true);
    try {
      const vehiculos = await getVehiculosByCliente(clienteId);
      setVehiculosCliente(vehiculos.sort((a, b) => a.placa.localeCompare(b.placa)));
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron cargar los vehiculos del cliente");
      setVehiculosCliente([]);
    } finally {
      setCargandoVehiculosCliente(false);
    }
  };

  const abrirClienteModal = () => {
    if (!clienteData) return;
    setClienteDraft(getClienteDraft(clienteData));
    setEditandoClienteModal(false);
    setMostrarClienteModal(true);
    if (clienteData.id) {
      setVehiculosCliente([]);
      void cargarVehiculosCliente(clienteData.id);
    }
  };

  const cerrarClienteModal = () => {
    setMostrarClienteModal(false);
    setEditandoClienteModal(false);
    setVehiculosCliente([]);
  };

  const cancelarEdicionClienteModal = () => {
    if (clienteData) setClienteDraft(getClienteDraft(clienteData));
    setEditandoClienteModal(false);
  };

  const guardarClienteModal = async () => {
    if (!clienteData?.id) {
      toast.error("No se encontro el cliente");
      return;
    }

    const clientePayload = {
      nombre: clienteDraft.nombre.trim(),
      apellido: clienteDraft.apellido.trim(),
      identificacion: clienteDraft.identificacion.trim(),
      telefono: clienteDraft.telefono.trim(),
      email: clienteDraft.email.trim(),
      direccion: clienteDraft.direccion.trim(),
    };

    if (!clientePayload.nombre || !clientePayload.apellido || !clientePayload.identificacion || !clientePayload.telefono) {
      toast.error("Completa los datos obligatorios del cliente");
      return;
    }

    setGuardandoClienteModal(true);
    try {
      await updateCliente(clienteData.id, clientePayload);
      const clienteActualizado = { ...clienteData, ...clientePayload };
      setClienteData(clienteActualizado);
      setValue("nombre", clientePayload.nombre, { shouldDirty: true });
      setValue("apellido", clientePayload.apellido, { shouldDirty: true });
      setValue("identificacion", clientePayload.identificacion, { shouldDirty: true });
      setValue("telefono", clientePayload.telefono, { shouldDirty: true });
      setValue("email", clientePayload.email, { shouldDirty: true });
      setValue("direccion", clientePayload.direccion, { shouldDirty: true });
      setEditandoClienteModal(false);
      toast.success("Cliente actualizado");
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar el cliente");
    } finally {
      setGuardandoClienteModal(false);
    }
  };

  const ejecutarBusqueda = useCallback(
    async (placa: string) => {
      const placaLimpia = placa.trim().toUpperCase();
      if (!placaLimpia) return;

      setValue("placa", placaLimpia, { shouldValidate: true });
      setBuscando(true);
      setMostrarSugerencias(false);

      try {
        const vehiculo = await getVehiculoByPlaca(placaLimpia);
        if (!vehiculo) {
          setVehiculoData(null);
          setClienteData(null);
          setEditandoVehiculo(true);
          reset(emptyForm(placaLimpia));
          toast("Vehiculo no encontrado. Registra sus datos.", { icon: "i" });
          return;
        }

        const cliente = await getClienteById(vehiculo.clienteId);
        setVehiculoData(vehiculo);
        setClienteData(cliente);
        setEditandoVehiculo(false);
        reset({
          nombre: cliente?.nombre ?? "",
          apellido: cliente?.apellido ?? "",
          identificacion: cliente?.identificacion ?? "",
          telefono: cliente?.telefono ?? "",
          email: cliente?.email ?? "",
          direccion: cliente?.direccion ?? "",
          placa: vehiculo.placa,
          marca: vehiculo.marca ?? "",
          modelo: vehiculo.modelo ?? "",
          anio: vehiculo.anio ?? new Date().getFullYear(),
          color: vehiculo.color ?? "",
          vin: vehiculo.vin ?? "",
          tipoVehiculo: vehiculo.tipoVehiculo ?? "sedan",
        });
        toast.success(`Vehiculo ${vehiculo.placa} cargado`);
      } catch (error) {
        console.error(error);
        toast.error("Error al buscar la placa");
      } finally {
        setBuscando(false);
        setBusquedaRealizada(true);
      }
    },
    [reset, setValue]
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    getProximoNumeroOrden().then(setNumeroOrden).catch(console.error);
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const placa = placaValue.trim().toUpperCase();
    if (placa.length < 2) {
      const timer = window.setTimeout(() => setSugerencias([]), 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(async () => {
      try {
        const vehiculos = await searchVehiculosByPlacaPrefix(placa);
        setSugerencias(vehiculos.slice(0, 6));
      } catch (error) {
        console.error(error);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [placaValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setMostrarSugerencias(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fotosDiagnosticoActualesRef.current = fotosDiagnostico;
  }, [fotosDiagnostico]);

  useEffect(() => {
    return () => {
      fotosDiagnosticoActualesRef.current.forEach((foto) => URL.revokeObjectURL(foto.previewUrl));
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const cargarTecnicos = async () => {
      setCargandoTecnicos(true);
      try {
        const usuarios = await getUsuarios();
        if (cancelled) return;
        setTecnicos(usuarios.filter((usuario) => usuario.role === "tecnico" && usuario.activo));
      } catch (error) {
        console.error(error);
        if (!cancelled) toast.error("No se pudieron cargar los tecnicos");
      } finally {
        if (!cancelled) setCargandoTecnicos(false);
      }
    };

    cargarTecnicos();

    return () => {
      cancelled = true;
    };
  }, []);

  const onPlateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue("placa", event.target.value.toUpperCase(), { shouldDirty: true, shouldValidate: true });
    setMostrarSugerencias(true);
  };

  const addItem = async (item: Omit<ItemOrden, "id" | "ordenId" | "subtotal">) => {
    const subtotal = item.cantidad * item.precioUnitario * (1 + item.impuestoAplicable / 100);
    setItems((current) => [...current, { ...item, subtotal }]);
    toast.success("Item agregado");
  };

  const eliminarItem = (index: number) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const agregarFotosDiagnostico = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const nuevasFotos = files
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        descripcion: "",
      }));

    if (nuevasFotos.length === 0) {
      toast.error("Selecciona imagenes validas");
      return;
    }

    setFotosDiagnostico((current) => [...current, ...nuevasFotos]);
    event.target.value = "";
  };

  const eliminarFotoDiagnostico = (id: string) => {
    setFotosDiagnostico((current) => {
      const foto = current.find((item) => item.id === id);
      if (foto) URL.revokeObjectURL(foto.previewUrl);
      return current.filter((item) => item.id !== id);
    });
    if (fotoEditandoId === id) {
      setFotoEditandoId(null);
      setDescripcionFotoDraft("");
    }
  };

  const editarDescripcionFoto = (id: string) => {
    const foto = fotosDiagnostico.find((item) => item.id === id);
    setFotoEditandoId(id);
    setDescripcionFotoDraft(foto?.descripcion ?? "");
  };

  const guardarDescripcionFoto = (id: string) => {
    const descripcion = descripcionFotoDraft.trim();
    setFotosDiagnostico((current) =>
      current.map((foto) => (foto.id === id ? { ...foto, descripcion } : foto))
    );
    setFotoEditandoId(null);
    setDescripcionFotoDraft("");
  };

  const cancelarDescripcionVacia = () => {
    if (!descripcionFotoDraft.trim()) {
      setFotoEditandoId(null);
      setDescripcionFotoDraft("");
    }
  };

  const updateFlujo = <T extends keyof FlujoTrabajo>(
    seccion: T,
    campo: keyof FlujoTrabajo[T],
    value: FlujoTrabajo[T][keyof FlujoTrabajo[T]]
  ) => {
    setFlujoTrabajo((current) => ({
      ...current,
      [seccion]: {
        ...current[seccion],
        [campo]: value,
      },
    }));
  };

  const renderProcesoCheck = (
    checked: boolean,
    onChange: (checked: boolean) => void,
    label: string,
    detalle?: string
  ) => (
    <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-3 cursor-pointer">
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 rounded border-[var(--border)]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {detalle ? (
          <span className="block text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {detalle}
          </span>
        ) : null}
      </span>
    </label>
  );

  const onSubmit = async (data: FormData, esCotizacion = false) => {
    if (!data.placa.trim()) {
      toast.error("La placa es obligatoria");
      return;
    }
    if (!tecnicoId) {
      toast.error("Selecciona un tecnico");
      setActiveTab("inspeccion");
      return;
    }
    if (!motivo.trim()) {
      toast.error("Ingresa el motivo de la visita");
      setActiveTab("inspeccion");
      return;
    }
    if (!km.trim() || Number.isNaN(Number(km))) {
      toast.error("Ingresa el kilometraje");
      setActiveTab("inspeccion");
      return;
    }
    if (!esCotizacion && !presupuestoConfirmado) {
      toast.error("El cliente debe confirmar el presupuesto");
      setActiveTab("orden");
      return;
    }

    setGuardando(true);
    try {
      const guardarComoCotizacion = esCotizacion && !presupuestoConfirmado;

      const clientePayload = {
        nombre: data.nombre.trim(),
        apellido: data.apellido.trim(),
        identificacion: data.identificacion.trim(),
        telefono: data.telefono.trim(),
        email: data.email.trim(),
        direccion: data.direccion.trim(),
      };

      let clienteId = clienteData?.id;
      if (clienteId) {
        await updateCliente(clienteId, clientePayload);
      } else {
        clienteId = await createCliente(clientePayload);
      }

      const vehiculoPayload = {
        clienteId,
        placa: data.placa.trim().toUpperCase(),
        marca: data.marca.trim(),
        modelo: data.modelo.trim(),
        anio: Number(data.anio),
        color: data.color.trim(),
        vin: data.vin.trim(),
        tipoVehiculo: data.tipoVehiculo,
      };

      let vehiculoId = vehiculoData?.id;
      if (vehiculoId) {
        await updateVehiculo(vehiculoId, vehiculoPayload);
      } else {
        vehiculoId = await createVehiculo(vehiculoPayload);
      }

      const orderId = await createOrden({
        vehiculoId,
        clienteId,
        estado: "Ingreso",
        tipoServicio,
        motivo: motivo.trim(),
        kilometrajeIngreso: Number(km),
        nivelCombustible,
        checklistInventario: checklist,
        inspeccionVisual: { danos, fotoUrls: [] },
        notasInternas: notasInternas.trim(),
        informeTecnico: diagnostico.trim(),
        tecnicoId,
        presupuestoConfirmadoPorCliente: presupuestoConfirmado,
        flujoTrabajo,
        fotoUrls: [],
        esCotizacion: guardarComoCotizacion,
      });

      if (items.length > 0) {
        await Promise.all(items.map((item) => addItemOrden(orderId, { ...item, ordenId: orderId })));
      }

      if (fotosDiagnostico.length > 0) {
        const fotoUrls = await Promise.all(
          fotosDiagnostico.map((foto) => uploadOrdenFoto(orderId, foto.file))
        );
        await updateOrden(orderId, {
          fotoUrls,
          fotosDiagnostico: fotoUrls.map((url, index) => ({
            url,
            descripcion: fotosDiagnostico[index]?.descripcion.trim() || "",
          })),
        });
      }

      toast.success(guardarComoCotizacion ? "Cotizacion guardada" : "Orden creada");
      onSuccess?.(orderId);
      if (!onSuccess) onClose();
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar la orden");
    } finally {
      setGuardando(false);
    }
  };

  const renderVehicleFields = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="form-group">
          <label className="label">Marca *</label>
          <input className="input text-sm" {...register("marca", { required: true })} />
        </div>
        <div className="form-group">
          <label className="label">Modelo *</label>
          <input className="input text-sm" {...register("modelo", { required: true })} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="form-group">
          <label className="label">Ano *</label>
          <input type="number" className="input text-sm" {...register("anio", { required: true, valueAsNumber: true })} />
        </div>
        <div className="form-group">
          <label className="label">Color *</label>
          <input className="input text-sm" {...register("color", { required: true })} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="form-group">
          <label className="label">Chasis</label>
          <input className="input text-sm" {...register("vin")} />
        </div>
        <div className="form-group">
          <label className="label">Tipo *</label>
          <select className="input text-sm" {...register("tipoVehiculo", { required: true })}>
            {TIPOS_VEHICULO.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const renderCustomerFields = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="form-group">
          <label className="label">Nombre *</label>
          <input className="input text-sm" {...register("nombre", { required: true })} />
        </div>
        <div className="form-group">
          <label className="label">Apellido *</label>
          <input className="input text-sm" {...register("apellido", { required: true })} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="form-group">
          <label className="label">Identificacion *</label>
          <input className="input text-sm" {...register("identificacion", { required: true })} />
        </div>
        <div className="form-group">
          <label className="label">Telefono *</label>
          <input className="input text-sm" {...register("telefono", { required: true })} />
        </div>
      </div>
      <div className="form-group">
        <label className="label">Email</label>
        <input type="email" className="input text-sm" {...register("email")} />
      </div>
      <div className="form-group">
        <label className="label">Direccion</label>
        <input className="input text-sm" {...register("direccion")} />
      </div>
    </div>
  );

  const renderClienteVehiculo = () => (
    <div className="sm:col-span-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-[var(--text-muted)]">
        <User size={12} />
        <span>Cliente</span>
      </div>
      <button
        type="button"
        className="text-left font-semibold underline-offset-2 hover:underline disabled:no-underline disabled:cursor-default"
        style={{ color: clienteData ? "var(--accent)" : "var(--text-muted)" }}
        onClick={abrirClienteModal}
        disabled={!clienteData}
      >
        {clienteNombre}
      </button>
    </div>
  );

  const renderClienteDetalleModal = () => {
    if (!mostrarClienteModal || !clienteData) return null;

    const detalles = [
      { name: "nombre", label: "Nombre *", value: clienteData.nombre || "-", required: true },
      { name: "apellido", label: "Apellido *", value: clienteData.apellido || "-", required: true },
      { name: "identificacion", label: "Identificacion *", value: clienteData.identificacion || "-", required: true },
      { name: "telefono", label: "Telefono *", value: clienteData.telefono || "-", required: true },
      { name: "email", label: "Email", value: clienteData.email || "-", col2: true },
      { name: "direccion", label: "Direccion", value: clienteData.direccion || "-", col2: true },
    ];

    return (
      <div className="modal-overlay z-[120]">
        <div className="modal-box max-w-lg w-full">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2 min-w-0">
              <User size={18} className="text-[var(--success)]" />
              <h2 className="text-lg font-bold truncate" style={{ color: "var(--text-primary)" }}>
                Datos del cliente
              </h2>
            </div>
            <button type="button" onClick={cerrarClienteModal} className="btn-ghost btn-icon">
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {detalles.map((detalle) => (
              <div key={detalle.name} className={detalle.col2 ? "sm:col-span-2" : ""}>
                <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">{detalle.label}</p>
                {editandoClienteModal ? (
                  <input
                    className="input text-sm mt-1"
                    value={clienteDraft[detalle.name as keyof ClienteDraft]}
                    required={detalle.required}
                    onChange={(event) =>
                      setClienteDraft((current) => ({
                        ...current,
                        [detalle.name]: event.target.value,
                      }))
                    }
                  />
                ) : (
                  <p className="break-words" style={{ color: "var(--text-primary)" }}>
                    {detalle.value}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Car size={16} className="text-[var(--warning)]" />
                <h3 className="font-semibold text-sm">Vehiculos del cliente</h3>
              </div>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {cargandoVehiculosCliente ? "Cargando..." : vehiculosCliente.length}
              </span>
            </div>

            {cargandoVehiculosCliente ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                <Loader2 size={14} className="animate-spin" />
                Cargando vehiculos...
              </div>
            ) : vehiculosCliente.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {vehiculosCliente.map((vehiculo) => (
                  <div
                    key={vehiculo.id ?? vehiculo.placa}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold">{vehiculo.placa}</p>
                        <p className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
                          {vehiculo.marca} {vehiculo.modelo}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {vehiculo.anio || "-"} - {vehiculo.color || "-"}
                        </p>
                      </div>
                      {vehiculo.id === vehiculoData?.id ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-1 rounded border border-[var(--border)] text-[var(--accent)]">
                          Actual
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No hay vehiculos registrados para este cliente.
              </p>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            {editandoClienteModal ? (
              <>
                <button
                  type="button"
                  className="btn-secondary flex-1 justify-center"
                  onClick={cancelarEdicionClienteModal}
                  disabled={guardandoClienteModal}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary flex-1 justify-center"
                  onClick={guardarClienteModal}
                  disabled={guardandoClienteModal}
                >
                  {guardandoClienteModal ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {guardandoClienteModal ? "Guardando..." : "Guardar"}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-ghost btn-sm ml-auto"
                onClick={() => setEditandoClienteModal(true)}
              >
                <Pencil size={15} />
                Editar
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAsignacionTecnica = () => (
    <section className="card">
      <h3 className="font-semibold text-sm mb-3">Asignacion tecnica</h3>
      <div className="form-group">
        <label className="label">Tecnico asignado *</label>
        <select
          className="input text-sm"
          value={tecnicoId}
          onChange={(event) => setTecnicoId(event.target.value)}
          disabled={cargandoTecnicos}
        >
          <option value="">
            {cargandoTecnicos ? "Cargando tecnicos..." : "Seleccionar tecnico"}
          </option>
          {tecnicos.map((tecnico) => (
            <option key={tecnico.uid} value={tecnico.uid}>
              {tecnico.displayName || tecnico.email}
            </option>
          ))}
        </select>
        {!cargandoTecnicos && tecnicos.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            No hay usuarios activos con rol tecnico.
          </p>
        ) : null}
      </div>
    </section>
  );

  const renderBusquedaVehiculo = () => (
    <section className="card">
      <div className="flex items-center gap-2 mb-4">
        <Search size={18} className="text-[var(--accent)]" />
        <h3 className="font-semibold text-sm">Buscar vehiculo</h3>
      </div>
      <div className="flex gap-2" ref={wrapperRef}>
        <div className="relative flex-1">
          <input
            type="text"
            className={`input uppercase font-mono text-lg tracking-widest ${errors.placa ? "border-red-500" : ""}`}
            placeholder="ABC-1234"
            {...register("placa", { required: true })}
            onChange={onPlateChange}
            onFocus={() => setMostrarSugerencias(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                ejecutarBusqueda(placaValue);
              }
            }}
          />
          {mostrarSugerencias && sugerencias.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {sugerencias.map((vehiculo) => (
                <button
                  key={vehiculo.id}
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-[var(--bg-secondary)] border-b border-[var(--border)] last:border-0"
                  onClick={() => ejecutarBusqueda(vehiculo.placa)}
                >
                  <span className="block font-mono font-bold text-sm">{vehiculo.placa}</span>
                  <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                    {vehiculo.marca} {vehiculo.modelo}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={() => ejecutarBusqueda(placaValue)} disabled={buscando} className="btn-primary btn-icon">
          {buscando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </button>
      </div>
    </section>
  );

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="nueva-orden-sidebar relative h-full w-full bg-[var(--bg-primary)] shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        <header className="px-4 sm:px-6 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3 bg-[var(--bg-card)]">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={onClose} className="btn-ghost btn-icon -ml-2" title="Cerrar">
              <X size={20} />
            </button>
            <div className="min-w-0">
              <h2 className="text-lg font-bold truncate" style={{ color: "var(--text-primary)" }}>
                Orden #{numeroOrden ? String(numeroOrden).padStart(4, "0") : "..."}
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Registro de ingreso de vehículo
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary btn-sm"
              title="Guardar como cotizacion"
              disabled={guardando || presupuestoConfirmado}
              onClick={handleSubmit((data) => onSubmit(data, true))}
            >
              <Calculator size={15} />
              <span className="hidden sm:inline">Cotizacion</span>
            </button>
            <button form="nueva-orden-form" type="submit" disabled={guardando} className="btn-primary btn-sm">
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Crear Orden
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <form id="nueva-orden-form" onSubmit={handleSubmit((data) => onSubmit(data, false))}>
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
              <aside className={`${busquedaRealizada || vehiculoData ? "xl:col-span-4" : "hidden"} space-y-3`}>
                <section className="hidden">
                  <div className="flex items-center gap-2 mb-4">
                    <Search size={18} className="text-[var(--accent)]" />
                    <h3 className="font-semibold text-sm">Buscar vehículo</h3>
                  </div>
                  <div className="flex gap-2" ref={wrapperRef}>
                    <div className="relative flex-1">
                      <input
                        type="text"
                        className={`input uppercase font-mono text-lg tracking-widest ${errors.placa ? "border-red-500" : ""}`}
                        placeholder="ABC-1234"
                        {...register("placa", { required: true })}
                        onChange={onPlateChange}
                        onFocus={() => setMostrarSugerencias(true)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            ejecutarBusqueda(placaValue);
                          }
                        }}
                      />
                      {mostrarSugerencias && sugerencias.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-lg max-h-56 overflow-y-auto">
                          {sugerencias.map((vehiculo) => (
                            <button
                              key={vehiculo.id}
                              type="button"
                              className="w-full px-3 py-2 text-left hover:bg-[var(--bg-secondary)] border-b border-[var(--border)] last:border-0"
                              onClick={() => ejecutarBusqueda(vehiculo.placa)}
                            >
                              <span className="block font-mono font-bold text-sm">{vehiculo.placa}</span>
                              <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                                {vehiculo.marca} {vehiculo.modelo}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => ejecutarBusqueda(placaValue)} disabled={buscando} className="btn-primary btn-icon">
                      {buscando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    </button>
                  </div>
                </section>

                {(busquedaRealizada || vehiculoData) && (
                  <>
                    <section className="card">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                          <Car size={18} className="text-[var(--warning)]" />
                          <h3 className="font-semibold text-sm">Datos del vehículo</h3>
                        </div>
                        {vehiculoData && (
                          <button type="button" className="btn-ghost btn-sm" onClick={() => setEditandoVehiculo((value) => !value)}>
                            {editandoVehiculo ? "Ver" : "Editar"}
                          </button>
                        )}
                      </div>
                      {!editandoVehiculo && vehiculoData ? (
                        <div className="grid grid-cols-2 gap-3 bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border)] text-xs">
                          {renderClienteVehiculo()}
                          <div>
                            <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Marca / Modelo</p>
                            <p>{formValues.marca} {formValues.modelo}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Ano / Color</p>
                            <p>{formValues.anio} - {formValues.color}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Tipo</p>
                            <p className="uppercase">{formValues.tipoVehiculo}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Chasis</p>
                            <p className="truncate">{formValues.vin || "-"}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {vehiculoData ? (
                            <div className="bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border)] text-xs">
                              {renderClienteVehiculo()}
                            </div>
                          ) : null}
                          {renderVehicleFields()}
                        </div>
                      )}
                    </section>

                    {!vehiculoData ? (
                      <section className="card">
                        <div className="flex items-center gap-2 mb-4">
                          <User size={18} className="text-[var(--success)]" />
                          <h3 className="font-semibold text-sm">Datos del cliente</h3>
                        </div>
                        {renderCustomerFields()}
                      </section>
                    ) : null}
                  </>
                )}
              </aside>

              <main className={busquedaRealizada || vehiculoData ? "xl:col-span-8" : "xl:col-span-12"}>
                <div className="nueva-orden-tabs flex gap-3 border-b border-[var(--border)] bg-[var(--bg-primary)] sticky top-[-24px] z-10 py-2">
                  {[
                    ["inspeccion", "1", "Inspeccion de ingreso"],
                    ["orden", "2", "Diagnostico y presupuesto"],
                    ["ejecucion", "3", "Ejecucion y repuestos"],
                    ["reparacion", "4", "Orden y reparacion"],
                    ["entrega", "5", "Entrega y cierre"],
                  ].map(([tab, step, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab as PasoOrden)}
                      className={`nueva-orden-step-button ${
                        activeTab === tab
                          ? "nueva-orden-step-button-active"
                          : "nueva-orden-step-button-idle"
                      }`}
                    >
                      <span className="nueva-orden-step-number">{step}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                {activeTab === "orden" ? (
                  <div className="nueva-orden-section-stack">
                    <section className="card">
                      <h3 className="font-semibold text-sm mb-3">Diagnostico</h3>
                      <div className="form-group">
                        <label className="label">Diagnostico del tecnico</label>
                        <textarea
                          className="input text-sm"
                          rows={4}
                          value={diagnostico}
                          onChange={(event) => setDiagnostico(event.target.value)}
                          placeholder="Describe el diagnostico, hallazgos y trabajo recomendado."
                        />
                      </div>
                    </section>

                    <section className="card space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-sm">Fotografias del diagnostico</h3>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => fotosDiagnosticoRef.current?.click()}
                        >
                          <Camera size={14} />
                          Adjuntar fotos
                        </button>
                      </div>
                      <input
                        ref={fotosDiagnosticoRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={agregarFotosDiagnostico}
                      />
                      {fotosDiagnostico.length > 0 ? (
                        <div className="nueva-orden-photo-carousel">
                          {fotosDiagnostico.map((foto) => (
                            <div key={foto.id} className="nueva-orden-photo-item">
                              <button
                                type="button"
                                className="nueva-orden-photo-thumb"
                                onClick={() => editarDescripcionFoto(foto.id)}
                              >
                                <img src={foto.previewUrl} alt={foto.file.name} className="h-full w-full object-cover" />
                                {foto.descripcion ? (
                                  <span className="nueva-orden-photo-has-description" title={foto.descripcion}>
                                    i
                                  </span>
                                ) : null}
                              </button>
                              <button
                                type="button"
                                className="nueva-orden-photo-remove"
                                title="Quitar foto"
                                onClick={() => eliminarFotoDiagnostico(foto.id)}
                              >
                                <X size={13} />
                              </button>
                              {fotoEditandoId === foto.id ? (
                                <div className="nueva-orden-photo-description">
                                  <input
                                    className="input text-xs"
                                    value={descripcionFotoDraft}
                                    onChange={(event) => setDescripcionFotoDraft(event.target.value)}
                                    onBlur={cancelarDescripcionVacia}
                                    placeholder="Descripcion"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    className="btn-primary btn-icon"
                                    title="Guardar descripcion"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => guardarDescripcionFoto(foto.id)}
                                  >
                                    <Save size={13} />
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                          Sin fotografias adjuntas.
                        </p>
                      )}
                    </section>

                    <section className="card space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-sm">Productos y servicios</h3>
                        <span className="font-bold text-sm text-[var(--success)]">{currency(total)}</span>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setActiveModal("producto")} className="btn-secondary btn-sm flex-1 justify-center">
                          <Plus size={14} /> Producto
                        </button>
                        <button type="button" onClick={() => setActiveModal("servicio")} className="btn-secondary btn-sm flex-1 justify-center">
                          <Plus size={14} /> Servicio
                        </button>
                      </div>
                      {items.length > 0 ? (
                        <div className="table-container border border-[var(--border)] rounded-lg">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Descripcion</th>
                                <th>Cant.</th>
                                <th>Total</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item, index) => (
                                <tr key={`${item.descripcion}-${index}`} className="text-xs">
                                  <td>{item.descripcion}</td>
                                  <td>{item.cantidad}</td>
                                  <td className="font-semibold">{currency(item.subtotal)}</td>
                                  <td className="text-right">
                                    <button type="button" onClick={() => eliminarItem(index)} className="btn-ghost btn-icon" title="Eliminar item">
                                      <Trash2 size={14} className="text-red-500" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                          Sin productos ni servicios agregados.
                        </p>
                      )}
                    </section>

                    <section className="card">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5 rounded border-[var(--border)]"
                          checked={presupuestoConfirmado}
                          onChange={(event) => setPresupuestoConfirmado(event.target.checked)}
                        />
                        <span className="min-w-0">
                          <span className="block font-semibold text-sm">Cliente confirma diagnostico y presupuesto</span>
                          <span className="block text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                            Al confirmar, esta cotizacion se crea como orden de trabajo.
                          </span>
                        </span>
                      </label>
                    </section>
                  </div>
                ) : activeTab === "ejecucion" ? (
                  <div className="nueva-orden-section-stack">
                    <section className="card space-y-4">
                      <div>
                        <h3 className="font-semibold text-sm">Ejecucion y repuestos</h3>
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                          Controla aprobacion, compra, logistica y registro de repuestos.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {renderProcesoCheck(
                          flujoTrabajo.ejecucionRepuestos.compraProveedorAutorizada,
                          (checked) => updateFlujo("ejecucionRepuestos", "compraProveedorAutorizada", checked),
                          "Compra con proveedor autorizada",
                          "La asesora o responsable procede con la compra."
                        )}
                        {renderProcesoCheck(
                          flujoTrabajo.ejecucionRepuestos.logisticaRetiraRepuestos,
                          (checked) => updateFlujo("ejecucionRepuestos", "logisticaRetiraRepuestos", checked),
                          "Logistica retira repuestos",
                          "El encargado de logistica retira los repuestos."
                        )}
                        {renderProcesoCheck(
                          flujoTrabajo.ejecucionRepuestos.tecnicosInicianDespiece,
                          (checked) => updateFlujo("ejecucionRepuestos", "tecnicosInicianDespiece", checked),
                          "Tecnicos inician despiece",
                          "El trabajo tecnico puede avanzar mientras llega el repuesto."
                        )}
                        {renderProcesoCheck(
                          flujoTrabajo.ejecucionRepuestos.compraRepuestosRegistrada,
                          (checked) => updateFlujo("ejecucionRepuestos", "compraRepuestosRegistrada", checked),
                          "Compra registrada en sistema",
                          "Registrar la compra al llegar los repuestos al local."
                        )}
                      </div>
                      <div className="form-group">
                        <label className="label">Notas de repuestos y logistica</label>
                        <textarea
                          className="input text-sm"
                          rows={3}
                          value={flujoTrabajo.ejecucionRepuestos.notas ?? ""}
                          onChange={(event) => updateFlujo("ejecucionRepuestos", "notas", event.target.value)}
                        />
                      </div>
                    </section>
                  </div>
                ) : activeTab === "reparacion" ? (
                  <div className="nueva-orden-section-stack">
                    <section className="card space-y-4">
                      <div>
                        <h3 className="font-semibold text-sm">Orden de trabajo y reparacion</h3>
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                          Seguimiento de conversion, control tecnico, reparacion y prueba de ruta.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {renderProcesoCheck(
                          flujoTrabajo.ordenReparacion.presupuestoConvertidoOrden,
                          (checked) => updateFlujo("ordenReparacion", "presupuestoConvertidoOrden", checked),
                          "Presupuesto convertido en orden",
                          "La asesora de servicio confirma la creacion de la orden de trabajo."
                        )}
                        {renderProcesoCheck(
                          flujoTrabajo.ordenReparacion.tecnicoConfirmaCargado,
                          (checked) => updateFlujo("ordenReparacion", "tecnicoConfirmaCargado", checked),
                          "Tecnico confirma orden cargada",
                          "Se valida que diagnostico, repuestos y servicios esten en la orden."
                        )}
                        {renderProcesoCheck(
                          flujoTrabajo.ordenReparacion.reparacionFinalizada,
                          (checked) => updateFlujo("ordenReparacion", "reparacionFinalizada", checked),
                          "Reparacion finalizada",
                          "El tecnico marca el trabajo como terminado."
                        )}
                        {renderProcesoCheck(
                          flujoTrabajo.ordenReparacion.pruebaRutaRealizada,
                          (checked) => updateFlujo("ordenReparacion", "pruebaRutaRealizada", checked),
                          "Prueba de ruta realizada",
                          "Se verifica que el vehiculo funcione correctamente."
                        )}
                      </div>
                      <div className="form-group">
                        <label className="label">Notas de reparacion</label>
                        <textarea
                          className="input text-sm"
                          rows={3}
                          value={flujoTrabajo.ordenReparacion.notas ?? ""}
                          onChange={(event) => updateFlujo("ordenReparacion", "notas", event.target.value)}
                        />
                      </div>
                    </section>
                  </div>
                ) : activeTab === "entrega" ? (
                  <div className="nueva-orden-section-stack">
                    <section className="card space-y-4">
                      <div>
                        <h3 className="font-semibold text-sm">Entrega y cierre</h3>
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                          Control final, limpieza, pago, entrega y cierre administrativo.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {renderProcesoCheck(
                          flujoTrabajo.entregaCierre.controlCalidadCompletado,
                          (checked) => updateFlujo("entregaCierre", "controlCalidadCompletado", checked),
                          "Control de calidad completado",
                          "Hoja de salida/inspeccion y registro de lo realizado."
                        )}
                        {renderProcesoCheck(
                          flujoTrabajo.entregaCierre.lavadoRealizado,
                          (checked) => updateFlujo("entregaCierre", "lavadoRealizado", checked),
                          "Lavado realizado",
                          "Opcional segun el caso."
                        )}
                        {renderProcesoCheck(
                          flujoTrabajo.entregaCierre.lavadoNoAplica,
                          (checked) => updateFlujo("entregaCierre", "lavadoNoAplica", checked),
                          "Lavado no aplica",
                          "Usar cuando no corresponde realizar lavado."
                        )}
                        {renderProcesoCheck(
                          flujoTrabajo.entregaCierre.clienteNotificado,
                          (checked) => updateFlujo("entregaCierre", "clienteNotificado", checked),
                          "Cliente notificado",
                          "Se informa que el vehiculo esta listo."
                        )}
                        {renderProcesoCheck(
                          flujoTrabajo.entregaCierre.ordenEnviadaWhatsApp,
                          (checked) => updateFlujo("entregaCierre", "ordenEnviadaWhatsApp", checked),
                          "Orden enviada por WhatsApp",
                          "Solo si el cliente lo solicita."
                        )}
                        {renderProcesoCheck(
                          flujoTrabajo.entregaCierre.vehiculoEntregado,
                          (checked) => updateFlujo("entregaCierre", "vehiculoEntregado", checked),
                          "Vehiculo entregado",
                          "El cliente retira el vehiculo y recibe la hoja impresa."
                        )}
                        {renderProcesoCheck(
                          flujoTrabajo.entregaCierre.pendientesInformados,
                          (checked) => updateFlujo("entregaCierre", "pendientesInformados", checked),
                          "Pendientes informados",
                          "Servicios pendientes a corto o mediano plazo."
                        )}
                        {renderProcesoCheck(
                          flujoTrabajo.entregaCierre.ordenCerradaSistema,
                          (checked) => updateFlujo("entregaCierre", "ordenCerradaSistema", checked),
                          "Orden cerrada en sistema",
                          "Finalizacion administrativa de la orden."
                        )}
                        {renderProcesoCheck(
                          flujoTrabajo.entregaCierre.facturaElectronicaEmitida,
                          (checked) => updateFlujo("entregaCierre", "facturaElectronicaEmitida", checked),
                          "Factura electronica emitida",
                          "Emision final de la factura electronica."
                        )}
                      </div>
                    </section>

                    <section className="card space-y-4">
                      <h3 className="font-semibold text-sm">Metodos de pago</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {renderProcesoCheck(
                          flujoTrabajo.entregaCierre.pagoEfectivo,
                          (checked) => updateFlujo("entregaCierre", "pagoEfectivo", checked),
                          "Efectivo"
                        )}
                        {renderProcesoCheck(
                          flujoTrabajo.entregaCierre.pagoTransferencia,
                          (checked) => updateFlujo("entregaCierre", "pagoTransferencia", checked),
                          "Transferencia"
                        )}
                        {renderProcesoCheck(
                          flujoTrabajo.entregaCierre.pagoTarjeta,
                          (checked) => updateFlujo("entregaCierre", "pagoTarjeta", checked),
                          "Tarjeta"
                        )}
                      </div>
                      <div className="form-group">
                        <label className="label">Notas de entrega y cierre</label>
                        <textarea
                          className="input text-sm"
                          rows={3}
                          value={flujoTrabajo.entregaCierre.notas ?? ""}
                          onChange={(event) => updateFlujo("entregaCierre", "notas", event.target.value)}
                        />
                      </div>
                    </section>
                  </div>
                ) : (
                  <div className="nueva-orden-section-stack">
                    {renderBusquedaVehiculo()}

                    <section className="card">
                      <div className="flex items-center gap-2 mb-4">
                        <FileText size={18} className="text-[#8b5cf6]" />
                        <h3 className="font-semibold text-sm">Detalles de la orden</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="form-group">
                          <label className="label">Tipo de servicio</label>
                          <select className="input text-sm" value={tipoServicio} onChange={(event) => setTipoServicio(event.target.value as TipoServicio)}>
                            {TIPOS_SERVICIO.map((tipo) => (
                              <option key={tipo} value={tipo}>{tipo}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="label">Motivo de la visita *</label>
                          <input className="input text-sm" value={motivo} onChange={(event) => setMotivo(event.target.value)} />
                        </div>
                        {mostrarNotasInternas ? (
                          <div className="form-group md:col-span-2">
                            <div className="flex items-center gap-2">
                              <label className="label">Notas</label>
                              <button
                                type="button"
                                className="btn-ghost btn-icon"
                                title="Ocultar notas"
                                onClick={() => setMostrarNotasInternas(false)}
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <textarea className="input text-sm" rows={3} value={notasInternas} onChange={(event) => setNotasInternas(event.target.value)} />
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn-ghost btn-sm justify-start md:col-span-2 w-fit"
                            onClick={() => setMostrarNotasInternas(true)}
                          >
                            <Plus size={14} />
                            Agregar notas
                          </button>
                        )}
                      </div>
                    </section>

                    <section className="card">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        <div className="form-group">
                          <label className="label">Kilometraje de ingreso *</label>
                          <input type="number" min="0" className="input text-sm" value={km} onChange={(event) => setKm(event.target.value)} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm mb-4">Nivel de combustible</h3>
                          <FuelSelector value={nivelCombustible} onChange={setNivelCombustible} />
                        </div>
                      </div>
                    </section>
                    <section className="card">
                      <h3 className="font-semibold text-sm mb-3">Checklist de inventario</h3>
                      <ChecklistInventario items={checklist} onChange={setChecklist} />
                    </section>
                    <section className="card">
                      <h3 className="font-semibold text-sm mb-3">Inspeccion visual</h3>
                      <DamageSelector
                        danos={danos}
                        onChange={setDanos}
                      />
                    </section>

                    {renderAsignacionTecnica()}
                  </div>
                )}
              </main>
            </div>
          </form>
        </div>
      </div>

      {activeModal && (
        <AgregarItemModal tipo={activeModal} onClose={() => setActiveModal(null)} onAdd={addItem} />
      )}
      {renderClienteDetalleModal()}
    </div>
  );
}
