"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  Calculator,
  Car,
  Check,
  FileText,
  Loader2,
  Plus,
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
  searchVehiculosByPlacaPrefix,
  updateCliente,
  updateVehiculo,
} from "@/lib/services";
import {
  ChecklistItem,
  AppUser,
  Cliente,
  DanoVehiculo,
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

interface Props {
  onClose: () => void;
  onSuccess?: (orderId: string) => void;
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
  const [editandoCliente, setEditandoCliente] = useState(true);
  const [editandoVehiculo, setEditandoVehiculo] = useState(true);
  const [numeroOrden, setNumeroOrden] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"orden" | "inspeccion">("inspeccion");
  const [sugerencias, setSugerencias] = useState<Vehiculo[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [tecnicos, setTecnicos] = useState<AppUser[]>([]);
  const [cargandoTecnicos, setCargandoTecnicos] = useState(false);

  const [tipoServicio, setTipoServicio] = useState<TipoServicio>("Mantenimiento");
  const [motivo, setMotivo] = useState("");
  const [notasInternas, setNotasInternas] = useState("");
  const [mostrarNotasInternas, setMostrarNotasInternas] = useState(false);
  const [tecnicoId, setTecnicoId] = useState("");
  const [km, setKm] = useState("");
  const [nivelCombustible, setNivelCombustible] = useState<NivelCombustible>("1/2");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(CHECKLIST_DEFAULT);
  const [danos, setDanos] = useState<DanoVehiculo[]>([]);
  const [items, setItems] = useState<Omit<ItemOrden, "id" | "ordenId">[]>([]);
  const [activeModal, setActiveModal] = useState<"producto" | "servicio" | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
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
  const total = useMemo(() => items.reduce((sum, item) => sum + item.subtotal, 0), [items]);

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
          setEditandoCliente(true);
          setEditandoVehiculo(true);
          reset(emptyForm(placaLimpia));
          toast("Vehiculo no encontrado. Registra sus datos.", { icon: "i" });
          return;
        }

        const cliente = await getClienteById(vehiculo.clienteId);
        setVehiculoData(vehiculo);
        setClienteData(cliente);
        setEditandoCliente(false);
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

  const onSubmit = async (data: FormData, esCotizacion = false) => {
    if (!data.placa.trim()) {
      toast.error("La placa es obligatoria");
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

    setGuardando(true);
    try {
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
        informeTecnico: "",
        ...(tecnicoId ? { tecnicoId } : {}),
        fotoUrls: [],
        esCotizacion,
      });

      if (items.length > 0) {
        await Promise.all(items.map((item) => addItemOrden(orderId, { ...item, ordenId: orderId })));
      }

      toast.success(esCotizacion ? "Cotizacion guardada" : "Orden creada");
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
          <label className="label">VIN</label>
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
              disabled={guardando}
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
              <aside className="xl:col-span-4 space-y-3">
                <section className="card">
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
                            <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">VIN</p>
                            <p className="truncate">{formValues.vin || "-"}</p>
                          </div>
                        </div>
                      ) : (
                        renderVehicleFields()
                      )}
                    </section>

                    <section className="card">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                          <User size={18} className="text-[var(--success)]" />
                          <h3 className="font-semibold text-sm">Datos del cliente</h3>
                        </div>
                        {clienteData && (
                          <button type="button" className="btn-ghost btn-sm" onClick={() => setEditandoCliente((value) => !value)}>
                            {editandoCliente ? "Ver" : "Editar"}
                          </button>
                        )}
                      </div>
                      {!editandoCliente && clienteData ? (
                        <div className="grid grid-cols-2 gap-3 bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border)] text-xs">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Nombre</p>
                            <p>{formValues.nombre} {formValues.apellido}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Identificacion</p>
                            <p>{formValues.identificacion}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Telefono</p>
                            <p>{formValues.telefono}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Email</p>
                            <p className="truncate">{formValues.email || "-"}</p>
                          </div>
                        </div>
                      ) : (
                        renderCustomerFields()
                      )}
                    </section>
                  </>
                )}
              </aside>

              <main className="xl:col-span-8">
                <div className="nueva-orden-tabs flex gap-4 border-b border-[var(--border)] bg-[var(--bg-primary)] sticky top-[-24px] z-10 py-2">
                  {[
                    ["inspeccion", "Inspeccion de ingreso"],
                    ["orden", "Presupuesto"],
                  ].map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab as "orden" | "inspeccion")}
                      className={`pb-2 px-1 text-sm font-semibold border-b-2 transition-all ${
                        activeTab === tab
                          ? "border-[var(--accent)] text-[var(--accent)]"
                          : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {activeTab === "orden" ? (
                  <div className="nueva-orden-section-stack">
                    <section className="card">
                      <h3 className="font-semibold text-sm mb-3">Asignacion tecnica</h3>
                      <div className="form-group">
                        <label className="label">Tecnico asignado</label>
                        <select
                          className="input text-sm"
                          value={tecnicoId}
                          onChange={(event) => setTecnicoId(event.target.value)}
                          disabled={cargandoTecnicos}
                        >
                          <option value="">
                            {cargandoTecnicos ? "Cargando tecnicos..." : "Sin asignar"}
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
                  </div>
                ) : (
                  <div className="nueva-orden-section-stack">
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
                        tipoVehiculo="suv"
                      />
                    </section>
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
    </div>
  );
}
