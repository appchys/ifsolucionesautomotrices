"use client";
import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Search, User, Car, Loader2, Check, FileText, X, Edit2, Plus, Trash2, Calculator } from "lucide-react";
import {
  getVehiculoByPlaca, getClienteById, createCliente, createVehiculo, createOrden, searchVehiculosByPlacaPrefix, updateCliente, updateVehiculo, addItemOrden, getProximoNumeroOrden
} from "@/lib/services";
import { Cliente, Vehiculo, NivelCombustible, ChecklistItem, DanoVehiculo, ItemOrden } from "@/types";
import DamageSelector from "@/components/recepcion/DamageSelector";
import ChecklistInventario from "@/components/recepcion/ChecklistInventario";
import FuelSelector from "@/components/recepcion/FuelSelector";
import AgregarItemModal from "@/components/ordenes/AgregarItemModal";
import VehiculoModal from "@/components/vehiculos/VehiculoModal";
import { toast } from "react-hot-toast";


const CHECKLIST_DEFAULT: ChecklistItem[] = [
  { label: "Gata", checked: false },
  { label: "Llanta de repuesto", checked: false },
  { label: "Herramientas (llaves)", checked: false },
  { label: "Extintor", checked: false },
  { label: "Triángulos de emergencia", checked: false },
  { label: "Documentos del vehículo", checked: false },
];


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


interface Props {
  onClose: () => void;
  onSuccess?: (orderId: string) => void;
}


export default function NuevaOrdenSidebar({ onClose, onSuccess }: Props) {
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [busquedaRealizada, setBusquedaRealizada] = useState(false);
  const [clienteData, setClienteData] = useState<Cliente | null>(null);
  const [vehiculoData, setVehiculoData] = useState<Vehiculo | null>(null);
  
  const [editandoCliente, setEditandoCliente] = useState(false);
  const [editandoVehiculo, setEditandoVehiculo] = useState(false);
  
  const [danos, setDanos] = useState<DanoVehiculo[]>([]);
  const [numeroOrden, setNumeroOrden] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"orden" | "inspeccion">("orden");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(CHECKLIST_DEFAULT);
  const [nivelCombustible, setNivelCombustible] = useState<NivelCombustible>("1/2");
  const [tipoServicio, setTipoServicio] = useState<"Mantenimiento" | "Reparación" | "Garantía">("Mantenimiento");
  const [motivo, setMotivo] = useState("");
  const [km, setKm] = useState("");
  const [notasInternas, setNotasInternas] = useState("");

  const [items, setItems] = useState<Omit<ItemOrden, "id" | "ordenId">[]>([]);
  const [activeModal, setActiveModal] = useState<"producto" | "servicio" | null>(null);
  const [showVehiculoModal, setShowVehiculoModal] = useState(false);


  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: { tipoVehiculo: "sedan" }
  });
  const placaValue = watch("placa") || "";


  const [sugerencias, setSugerencias] = useState<Vehiculo[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    // Bloquear scroll del body
    document.body.style.overflow = "hidden";
    
    // Obtener próximo número de orden
    getProximoNumeroOrden().then(setNumeroOrden);

    return () => { document.body.style.overflow = "auto"; };
  }, []);


  useEffect(() => {
    const fetchSugerencias = async () => {
      if (placaValue.trim().length < 2) {
        setSugerencias([]);
        return;
      }
      try {
        const vehiculos = await searchVehiculosByPlacaPrefix(placaValue);
        setSugerencias(vehiculos);

        // Si hay una coincidencia exacta, seleccionarla automáticamente
        const coincidenciaExacta = vehiculos.find(v => v.placa.toUpperCase() === placaValue.toUpperCase());
        if (coincidenciaExacta && !buscando) {
          ejecutarBusqueda(coincidenciaExacta.placa);
          setMostrarSugerencias(false);
        }
      } catch (e) {
        console.error(e);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchSugerencias();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [placaValue]);


  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setMostrarSugerencias(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  const ejecutarBusqueda = async (p: string) => {
    if (!p.trim()) return;
    setValue("placa", p.toUpperCase());
    setBuscando(true);
    // setBusquedaRealizada se moverá al final para evitar parpadeo
    try {
      const vehiculo = await getVehiculoByPlaca(p);
      if (vehiculo) {
        const cliente = await getClienteById(vehiculo.clienteId);
        setVehiculoData(vehiculo);
        setClienteData(cliente);
        reset({
          nombre: cliente?.nombre || "",
          apellido: cliente?.apellido || "",
          identificacion: cliente?.identificacion || "",
          telefono: cliente?.telefono || "",
          email: cliente?.email || "",
          direccion: cliente?.direccion || "",
          placa: vehiculo.placa,
          marca: vehiculo.marca || "",
          modelo: vehiculo.modelo || "",
          anio: vehiculo.anio || new Date().getFullYear(),
          color: vehiculo.color || "",
          vin: vehiculo.vin || "",
          tipoVehiculo: vehiculo.tipoVehiculo || "sedan",
        });
        toast.success(`Vehículo ${vehiculo.placa} cargado`);
      } else {
        toast("Vehículo no encontrado. Ingrese los datos.", { icon: "ℹ️" });
        setVehiculoData(null);
        setClienteData(null);
        reset({
          placa: p.toUpperCase(),
          nombre: "", apellido: "", identificacion: "", telefono: "", email: "", direccion: "",
          marca: "", modelo: "", anio: new Date().getFullYear(), color: "", vin: "", tipoVehiculo: "sedan",
        });
      }
    } finally {
      setBuscando(false);
      setBusquedaRealizada(true);
    }
  };


  const handleAddItem = async (item: Omit<ItemOrden, "id" | "ordenId" | "subtotal">) => {
    const subtotal = item.cantidad * item.precioUnitario * (1 + item.impuestoAplicable / 100);
    setItems((prev) => [...prev, { ...item, subtotal }]);
    toast.success("Ítem agregado");
  };


  const eliminarItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    toast.success("Ítem eliminado");
  };


  const total = items.reduce((s, i) => s + i.subtotal, 0);


  const buscarPlacaBtn = (e?: React.MouseEvent) => {
    e?.preventDefault();
    ejecutarBusqueda(placaValue);
  };


  const onSubmit = async (data: FormData, esCotizacion: boolean = false) => {
    if (!data.placa.trim()) { toast.error("La placa es obligatoria"); return; }
    if (!motivo.trim()) { toast.error("Ingrese el motivo de la visita"); return; }
    if (!km || isNaN(Number(km))) { toast.error("Ingrese el kilometraje"); return; }
    
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

      // 3. Crear Orden
      const orderId = await createOrden({
        vehiculoId: vId,
        clienteId: cId,
        estado: "Ingreso",
        tipoServicio,
        motivo,
        kilometrajeIngreso: Number(km),
        nivelCombustible,
        checklistInventario: checklist,
        inspeccionVisual: { danos, fotoUrls: [] },
        notasInternas,
        informeTecnico: "",
        fotoUrls: [],
        esCotizacion,
      });

      // 4. Guardar Items
      if (items.length > 0) {
        await Promise.all(items.map(item => addItemOrden(orderId, { ...item, ordenId: orderId })));
      }
      
      toast.success(esCotizacion ? "¡Cotización guardada exitosamente!" : "¡Orden de trabajo creada exitosamente!");
      if (onSuccess) {
        onSuccess(orderId);
      } else {
        onClose();
      }
    } catch (error) {
      console.error(error);
      toast.error("Error al crear la recepción");
    } finally {
      setGuardando(false);
    }
  };


  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* Sidebar Content */}
      <div className="relative w-full bg-[var(--bg-primary)] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-card)] sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="btn-ghost btn-icon -ml-2">
              <X size={20} />
            </button>
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                Orden #{numeroOrden ? String(numeroOrden).padStart(4, "0") : "..."}
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Registro de ingreso de vehículo
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              type="button" 
              className="btn-sm flex items-center justify-center p-2 rounded-lg transition-all hover:bg-slate-50" 
              style={{ background: "#ffffff", border: "1px solid var(--accent)", color: "var(--accent)" }}
              title="Guardar como Cotización"
              disabled={guardando}
              onClick={handleSubmit((data) => onSubmit(data, true))}
            >
              <Calculator size={18} />
            </button>
            <button 
              form="nueva-orden-form" 
              type="submit" 
              disabled={guardando} 
              className="btn-primary btn-sm"
            >
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Crear Orden
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="nueva-orden-form" onSubmit={handleSubmit((data) => onSubmit(data, false))} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* ── COLUMNA IZQUIERDA: Búsqueda, Vehículo y Cliente ── */}
              <div className="lg:col-span-4 space-y-6">
                {/* ── BÚSQUEDA Y PLACA ── */}
            <div className="card">
              <div className="flex items-center gap-3 mb-4">
                <Search size={18} className="text-[var(--accent)]" />
                <h3 className="font-semibold text-sm">Buscar Vehículo</h3>
              </div>
              
              <div className="flex gap-2" ref={wrapperRef}>
                <div className="relative flex-1">
                  <input
                    type="text"
                    className={`input uppercase font-mono text-lg tracking-widest w-full ${errors.placa ? "border-red-500" : ""}`}
                    placeholder="ABC-1234"
                    {...register("placa", { required: true })}
                    onChange={(e) => {
                      setValue("placa", e.target.value.toUpperCase());
                      setMostrarSugerencias(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        buscarPlacaBtn();
                      }
                    }}
                    onFocus={() => setMostrarSugerencias(true)}
                  />
                  {mostrarSugerencias && sugerencias.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {sugerencias.map((vehiculo) => (
                        <div
                          key={vehiculo.id}
                          className="px-3 py-2 cursor-pointer hover:bg-[var(--bg-secondary)] flex flex-col gap-1 border-b border-[var(--border)] last:border-0"
                          onClick={() => {
                            setMostrarSugerencias(false);
                            ejecutarBusqueda(vehiculo.placa);
                          }}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-bold text-sm">{vehiculo.placa}</span>
                            <span className="text-[10px] text-[var(--text-muted)]">{vehiculo.marca} {vehiculo.modelo}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={buscarPlacaBtn}
                  disabled={buscando}
                  className="btn-primary btn-sm"
                >
                  {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </button>
                {!vehiculoData && !buscando && placaValue.length >= 3 && (
                  <button 
                    type="button"
                    onClick={() => setShowVehiculoModal(true)}
                    className="btn-secondary btn-sm"
                    title="Nuevo Vehículo"
                  >
                    <Plus size={14} /> Crear
                  </button>
                )}
              </div>
            </div>

                <div className="h-4"></div>

                {busquedaRealizada && !vehiculoData && !buscando && (
                  <div className="grid grid-cols-1 gap-6">
                {/* ── VEHÍCULO ── */}
                <div className="card relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Car size={18} className="text-[var(--warning)]" />
                      <h3 className="font-semibold text-sm">Datos del Vehículo</h3>
                    </div>
                    {vehiculoData && (
                      <button type="button" onClick={() => setEditandoVehiculo(!editandoVehiculo)} className="btn-ghost btn-sm text-[var(--accent)]">
                        {editandoVehiculo ? "Ver Datos" : "Editar"}
                      </button>
                    )}
                  </div>

                  {!editandoVehiculo && vehiculoData ? (
                    <div className="grid grid-cols-2 gap-3 bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border)] text-xs">
                      <div><p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Marca / Modelo</p><p>{watch("marca")} {watch("modelo")}</p></div>
                      <div><p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Año / Color</p><p>{watch("anio")} - {watch("color")}</p></div>
                      <div><p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Tipo</p><p className="uppercase">{watch("tipoVehiculo")}</p></div>
                      <div><p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">VIN</p><p className="truncate">{watch("vin") || "-"}</p></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="form-group"><label className="label">Marca *</label><input className="input text-sm" {...register("marca", { required: true })} /></div>
                        <div className="form-group"><label className="label">Modelo *</label><input className="input text-sm" {...register("modelo", { required: true })} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="form-group"><label className="label">Año *</label><input type="number" className="input text-sm" {...register("anio", { required: true, valueAsNumber: true })} /></div>
                        <div className="form-group"><label className="label">Color *</label><input className="input text-sm" {...register("color", { required: true })} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="form-group"><label className="label">VIN</label><input className="input text-sm" {...register("vin")} /></div>
                        <div className="form-group">
                          <label className="label">Tipo *</label>
                          <select className="input text-sm" {...register("tipoVehiculo", { required: true })}>
                            {["sedan", "suv", "pickup", "camioneta", "moto", "otro"].map((t) => (
                              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {vehiculoData && <button type="button" onClick={() => setEditandoVehiculo(false)} className="btn-primary btn-sm w-full justify-center">Listo</button>}
                    </div>
                  )}
                </div>

                {/* ── CLIENTE ── */}
                <div className="card relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <User size={18} className="text-[var(--success)]" />
                      <h3 className="font-semibold text-sm">Datos del Cliente</h3>
                    </div>
                    {clienteData && (
                      <button type="button" onClick={() => setEditandoCliente(!editandoCliente)} className="btn-ghost btn-sm text-[var(--accent)]">
                        {editandoCliente ? "Ver Datos" : "Editar"}
                      </button>
                    )}
                  </div>

                  {!editandoCliente && clienteData ? (
                    <div className="grid grid-cols-2 gap-3 bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border)] text-xs">
                      <div><p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Nombre</p><p>{watch("nombre")} {watch("apellido")}</p></div>
                      <div><p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Identificación</p><p>{watch("identificacion")}</p></div>
                      <div><p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Teléfono</p><p>{watch("telefono")}</p></div>
                      <div><p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Email</p><p className="truncate">{watch("email") || "-"}</p></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="form-group"><label className="label">Nombre *</label><input className="input text-sm" {...register("nombre", { required: true })} /></div>
                        <div className="form-group"><label className="label">Apellido *</label><input className="input text-sm" {...register("apellido", { required: true })} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="form-group"><label className="label">Identificación *</label><input className="input text-sm" {...register("identificacion", { required: true })} /></div>
                        <div className="form-group"><label className="label">Teléfono *</label><input className="input text-sm" {...register("telefono", { required: true })} /></div>
                      </div>
                      <div className="form-group"><label className="label">Email</label><input className="input text-sm" {...register("email")} /></div>
                      <div className="form-group"><label className="label">Dirección</label><input className="input text-sm" {...register("direccion")} /></div>
                      {clienteData && <button type="button" onClick={() => setEditandoCliente(false)} className="btn-primary btn-sm w-full justify-center">Listo</button>}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="h-4"></div>

            {vehiculoData && (
              <div className="grid grid-cols-1 gap-6">
                {/* ── VEHÍCULO ── */}
                <div className="card relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Car size={18} className="text-[var(--warning)]" />
                      <h3 className="font-semibold text-sm">Datos del Vehículo</h3>
                    </div>
                    <button type="button" onClick={() => setEditandoVehiculo(!editandoVehiculo)} className="btn-ghost btn-sm text-[var(--accent)]">
                      {editandoVehiculo ? "Ver Datos" : "Editar"}
                    </button>
                  </div>

                  {!editandoVehiculo ? (
                    <div className="grid grid-cols-2 gap-3 bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border)] text-xs">
                      <div><p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Marca / Modelo</p><p>{watch("marca")} {watch("modelo")}</p></div>
                      <div><p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Año / Color</p><p>{watch("anio")} - {watch("color")}</p></div>
                      <div><p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Tipo</p><p className="uppercase">{watch("tipoVehiculo")}</p></div>
                      <div><p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">VIN</p><p className="truncate">{watch("vin") || "-"}</p></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="form-group"><label className="label">Marca *</label><input className="input text-sm" {...register("marca", { required: true })} /></div>
                        <div className="form-group"><label className="label">Modelo *</label><input className="input text-sm" {...register("modelo", { required: true })} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="form-group"><label className="label">Año *</label><input type="number" className="input text-sm" {...register("anio", { required: true, valueAsNumber: true })} /></div>
                        <div className="form-group"><label className="label">Color *</label><input className="input text-sm" {...register("color", { required: true })} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="form-group"><label className="label">VIN</label><input className="input text-sm" {...register("vin")} /></div>
                        <div className="form-group">
                          <label className="label">Tipo *</label>
                          <select className="input text-sm" {...register("tipoVehiculo", { required: true })}>
                            {["sedan", "suv", "pickup", "camioneta", "moto", "otro"].map((t) => (
                              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button type="button" onClick={() => setEditandoVehiculo(false)} className="btn-primary btn-sm w-full justify-center">Listo</button>
                    </div>
                  )}
                </div>

                {/* ── CLIENTE ── */}
                <div className="card relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <User size={18} className="text-[var(--success)]" />
                      <h3 className="font-semibold text-sm">Datos del Cliente</h3>
                    </div>
                    <button type="button" onClick={() => setEditandoCliente(!editandoCliente)} className="btn-ghost btn-sm text-[var(--accent)]">
                      {editandoCliente ? "Ver Datos" : "Editar"}
                    </button>
                  </div>

                  {!editandoCliente ? (
                    <div className="grid grid-cols-2 gap-3 bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border)] text-xs">
                      <div><p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Nombre</p><p>{watch("nombre")} {watch("apellido")}</p></div>
                      <div><p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Identificación</p><p>{watch("identificacion")}</p></div>
                      <div><p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Teléfono</p><p>{watch("telefono")}</p></div>
                      <div><p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Email</p><p className="truncate">{watch("email") || "-"}</p></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="form-group"><label className="label">Nombre *</label><input className="input text-sm" {...register("nombre", { required: true })} /></div>
                        <div className="form-group"><label className="label">Apellido *</label><input className="input text-sm" {...register("apellido", { required: true })} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="form-group"><label className="label">Identificación *</label><input className="input text-sm" {...register("identificacion", { required: true })} /></div>
                        <div className="form-group"><label className="label">Teléfono *</label><input className="input text-sm" {...register("telefono", { required: true })} /></div>
                      </div>
                      <div className="form-group"><label className="label">Email</label><input className="input text-sm" {...register("email")} /></div>
                      <div className="form-group"><label className="label">Dirección</label><input className="input text-sm" {...register("direccion")} /></div>
                      <button type="button" onClick={() => setEditandoCliente(false)} className="btn-primary btn-sm w-full justify-center">Listo</button>
                    </div>
                  )}
                </div>
                  </div>
                )}
              </div>

              {/* ── COLUMNA DERECHA: Detalles, Items y Estado ── */}
              <div className="lg:col-span-8 flex flex-col">
                {/* Tabs */}
                <div className="flex gap-4 border-b border-[var(--border)] mb-6 sticky top-[-24px] bg-[var(--bg-primary)] z-10 py-2">
                  <button 
                    type="button" 
                    onClick={() => setActiveTab("orden")}
                    className={`pb-2 px-1 text-sm font-semibold transition-all border-b-2 ${
                      activeTab === "orden" 
                        ? "border-[var(--accent)] text-[var(--accent)]" 
                        : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Detalles y Items
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setActiveTab("inspeccion")}
                    className={`pb-2 px-1 text-sm font-semibold transition-all border-b-2 ${
                      activeTab === "inspeccion" 
                        ? "border-[var(--accent)] text-[var(--accent)]" 
                        : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Inspección de ingreso
                  </button>
                </div>

                <div className="space-y-8">
                  {activeTab === "orden" ? (
                    <>
                      {/* ── ORDEN ── */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={18} className="text-[#8b5cf6]" />
                <h3 className="font-semibold text-sm">Detalles de la Orden</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div className="form-group">
                  <label className="label">Tipo de Servicio</label>
                  <select className="input text-sm" value={tipoServicio} onChange={(e) => setTipoServicio(e.target.value as any)}>
                    <option>Mantenimiento</option><option>Reparación</option><option>Garantía</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Motivo de la visita *</label>
                  <input className="input text-sm" placeholder="Motivo..." value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="label">Notas Internas</label>
                  <textarea className="input text-sm resize-none" rows={2} placeholder="Notas..." value={notasInternas} onChange={(e) => setNotasInternas(e.target.value)} />
                </div>
              </div>
            </div>

            {/* ── PRODUCTOS Y SERVICIOS ── */}
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Productos y Servicios</h3>
                <span className="font-bold text-sm text-[var(--success)]">${total.toFixed(2)}</span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setActiveModal("producto")} className="btn-secondary btn-sm flex-1 justify-center"><Plus size={14} /> Producto</button>
                <button type="button" onClick={() => setActiveModal("servicio")} className="btn-secondary btn-sm flex-1 justify-center"><Plus size={14} /> Servicio</button>
              </div>
              {items.length > 0 && (
                <div className="table-container border border-[var(--border)] rounded-lg">
                  <table className="table">
                    <thead className="bg-[var(--bg-secondary)]">
                      <tr><th className="text-[10px]">Desc.</th><th className="text-[10px]">Total</th><th></th></tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={index} className="text-xs">
                          <td>{item.descripcion}</td>
                          <td className="font-semibold">${item.subtotal.toFixed(2)}</td>
                          <td className="text-right">
                            <button type="button" onClick={() => eliminarItem(index)} className="text-red-500 p-1"><Trash2 size={14} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
                    </>
                  ) : (
                    <>
                      {/* ── ESTADO DEL VEHÍCULO ── */}
                      <div className="space-y-8">
                        <div className="card">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                            <div className="form-group">
                              <label className="label">Kilometraje de Ingreso *</label>
                              <input type="number" className="input text-sm" placeholder="45000" value={km} onChange={(e) => setKm(e.target.value)} />
                            </div>
                            <div>
                              <h3 className="font-semibold text-sm mb-4">Nivel de Combustible</h3>
                              <FuelSelector value={nivelCombustible} onChange={setNivelCombustible} />
                            </div>
                          </div>
                        </div>
                        <div className="card">
                          <h3 className="font-semibold text-sm mb-3">Checklist de Inventario</h3>
                          <ChecklistInventario items={checklist} onChange={setChecklist} />
                        </div>
                        <div className="card">
                          <h3 className="font-semibold text-sm mb-3">Inspección Visual</h3>
                          <DamageSelector danos={danos} onChange={setDanos} />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

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
          onSuccess={(v) => ejecutarBusqueda(v.placa)}
        />
      )}
    </div>
  );
}
