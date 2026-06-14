"use client";
import { useEffect, useState, useMemo } from "react";
import { Car, Search, X, Loader2, ArrowLeft, Edit, User, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  getClientes,
  getClienteById,
  getVehiculosByCliente,
  getVehiculoByPlaca,
  createCliente,
  createVehiculo,
  createOrdenConItems,
  getTiposVehiculo,
} from "@/lib/services";
import ClienteModal from "@/components/clientes/ClienteModal";
import { Cliente, Vehiculo, TipoVehiculo } from "@/types";

interface Props {
  onClose: () => void;
  tipoMode?: "ingreso" | "presupuesto";
}

type SearchMode = "placa" | "cliente";

export default function ModalNuevoIngreso({ onClose, tipoMode = "ingreso" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>("placa");

  // Data
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tiposVehiculo, setTiposVehiculo] = useState<string[]>([]);

  // Client state
  const [searchCliente, setSearchCliente] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteForm, setClienteForm] = useState({
    tipo: "Persona" as "Persona" | "Empresa",
    nombre: "",
    apellido: "",
    cedula: "",
    telefono: "",
    email: "",
  });

  // Vehicle state
  const [searchPlaca, setSearchPlaca] = useState("");
  const [selectedVehiculo, setSelectedVehiculo] = useState<Vehiculo | null>(null);
  const [vehiculoForm, setVehiculoForm] = useState({
    marca: "",
    modelo: "",
    anio: new Date().getFullYear(),
    tipoVehiculo: "sedan" as TipoVehiculo,
  });
  const [buscandoPlaca, setBuscandoPlaca] = useState(false);
  const [placaNoEncontrada, setPlacaNoEncontrada] = useState(false);
  const [vehiculosCliente, setVehiculosCliente] = useState<Vehiculo[]>([]);
  const [isCreatingNewVehicle, setIsCreatingNewVehicle] = useState(false);

  // Edit modal
  const [isEditingCliente, setIsEditingCliente] = useState(false);

  // Load clients and vehicle types on mount
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([getClientes(), getTiposVehiculo()])
      .then(([clientesData, tiposData]) => {
        if (mounted) {
          setClientes(clientesData);
          setTiposVehiculo(tiposData);
          if (tiposData.length > 0) {
            setVehiculoForm(prev => ({ ...prev, tipoVehiculo: tiposData[0] }));
          }
        }
      })
      .catch(console.error)
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Filter clients for autocomplete
  const filteredClientes = useMemo(() => {
    if (searchMode !== "cliente" || !searchCliente.trim()) return [];
    const term = searchCliente.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nombre?.toLowerCase().includes(term) ||
        c.apellido?.toLowerCase().includes(term) ||
        c.identificacion?.toLowerCase().includes(term) ||
        c.telefono?.includes(term) ||
        c.email?.toLowerCase().includes(term)
    ).slice(0, 5);
  }, [searchCliente, clientes, searchMode]);

  const isClienteNew = searchMode === "cliente" && searchCliente.trim().length > 2 && filteredClientes.length === 0 && !selectedCliente;

  // Search vehicle by placa (works in both modes)
  useEffect(() => {
    const placa = searchPlaca.trim().toUpperCase();
    setPlacaNoEncontrada(false); // Reset on every change
    if (placa.length >= 6) {
      const timer = setTimeout(async () => {
        setBuscandoPlaca(true);
        try {
          const vehiculo = await getVehiculoByPlaca(placa);
          if (vehiculo) {
            setSelectedVehiculo(vehiculo);
            setIsCreatingNewVehicle(false); // Auto-close form if vehicle exists
            // Auto-load client from vehicle
            if (vehiculo.clienteId) {
              const cliente = await getClienteById(vehiculo.clienteId);
              if (cliente) {
                setSelectedCliente(cliente);
              }
            }
          } else {
            setSelectedVehiculo(null);
            setPlacaNoEncontrada(true);
            // Don't clear client if in client search mode
            if (searchMode === "placa") {
              setSelectedCliente(null);
            }
          }
        } catch (error) {
          console.error(error);
        } finally {
          setBuscandoPlaca(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else if (searchMode === "placa") {
      setSelectedVehiculo(null);
      setSelectedCliente(null);
    }
  }, [searchPlaca, searchMode]);

  // Load vehicles for client when in client mode and client selected
  useEffect(() => {
    if (searchMode === "cliente" && selectedCliente?.id) {
      getVehiculosByCliente(selectedCliente.id)
        .then(setVehiculosCliente)
        .catch(console.error);
    }
  }, [searchMode, selectedCliente]);

  const handleSelectCliente = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setSearchCliente(`${cliente.nombre} ${cliente.apellido || ""}`.trim());
  };

  const clearSelectedCliente = () => {
    setSelectedCliente(null);
    setClienteForm({
      tipo: "Persona",
      nombre: "",
      apellido: "",
      cedula: "",
      telefono: "",
      email: "",
    });
  };

  const handleSwitchMode = (mode: SearchMode) => {
    setSearchMode(mode);
    setSelectedCliente(null);
    setSelectedVehiculo(null);
    setSearchPlaca("");
    setSearchCliente("");
    setVehiculosCliente([]);
    setIsCreatingNewVehicle(false);
    clearSelectedCliente();
  };

  const handleClienteEditSaved = async () => {
    setIsEditingCliente(false);
    if (!selectedCliente?.id) return;
    const updated = await getClienteById(selectedCliente.id);
    if (updated) {
      setSelectedCliente(updated);
      setSearchCliente(`${updated.nombre} ${updated.apellido || ""}`.trim());
    }
  };



  const handleFinalSubmit = async () => {
    if (!selectedCliente?.id) {
      toast.error("Selecciona un cliente");
      return;
    }
    
    setIsSubmitting(true);
    try {
      let vehiculoId = selectedVehiculo?.id;

      if (!vehiculoId) {
        if (!searchPlaca.trim() || !vehiculoForm.marca || !vehiculoForm.modelo) {
          toast.error("Por favor ingresa la placa, marca y modelo del vehículo");
          setIsSubmitting(false);
          return;
        }
        vehiculoId = await createVehiculo({
          clienteId: selectedCliente.id,
          placa: searchPlaca.trim().toUpperCase(),
          marca: vehiculoForm.marca,
          modelo: vehiculoForm.modelo,
          anio: vehiculoForm.anio,
          color: "Por definir",
          tipoVehiculo: vehiculoForm.tipoVehiculo,
        });
      }

      const ordenId = await createOrdenConItems({
        vehiculoId,
        clienteId: selectedCliente.id,
        estado: tipoMode === "ingreso" ? "Ingreso" : "Proceso",
        tipoServicio: "Mantenimiento",
        motivo: tipoMode === "ingreso" ? "Ingreso inicial" : "Presupuesto inicial",
        kilometrajeIngreso: 0,
        nivelCombustible: "1/2",
        checklistInventario: [],
        inspeccionVisual: { danos: [] },
        esCotizacion: tipoMode === "presupuesto",
      }, []);

      toast.success(tipoMode === "ingreso" ? "Ingreso registrado" : "Presupuesto creado");
      onClose();
      router.push(`/${tipoMode === "ingreso" ? "ingresos" : "presupuestos"}/${ordenId}`);
    } catch (error) {
      console.error(error);
      toast.error("Error al crear el ingreso");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine if we can submit
  const canSubmit = selectedCliente && (selectedVehiculo || searchPlaca.trim().length >= 6);

  // Render client card (reusable)
  const renderClienteCard = () => {
    if (!selectedCliente) return null;
    return (
      <div className="card p-3 border-green-200 dark:border-green-700/50 bg-green-50/50 dark:bg-green-900/10">
        <div className="flex items-start justify-between">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold shrink-0 uppercase text-sm">
              {selectedCliente.nombre?.[0] || ""}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm">{selectedCliente.nombre} {selectedCliente.apellido}</p>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5 space-y-0.5">
                {selectedCliente.telefono && <span>Tel: {selectedCliente.telefono}</span>}
                {selectedCliente.identificacion && <span className="ml-3">CI/RUC: {selectedCliente.identificacion}</span>}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsEditingCliente(true)}
            className="p-1.5 hover:bg-green-100 rounded text-green-700 transition-colors shrink-0"
            title="Editar cliente"
          >
            <Edit size={14} />
          </button>
        </div>
      </div>
    );
  };

  // Render vehicle card
  const renderVehiculoCard = () => {
    if (!selectedVehiculo) return null;
    return (
      <div className="card p-3 border-green-200 dark:border-green-700/50 bg-green-50/50 dark:bg-green-900/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <Car size={18} className="text-green-600" />
          </div>
          <div>
            <p className="font-bold text-sm">{selectedVehiculo.marca} {selectedVehiculo.modelo} {selectedVehiculo.anio}</p>
            <p className="text-xs text-[var(--text-muted)] uppercase font-mono">{selectedVehiculo.placa}</p>
          </div>
        </div>
      </div>
    );
  };

  // New vehicle form
  const renderNewVehicleForm = () => {
    if (searchMode === "placa" && (selectedVehiculo || searchPlaca.trim().length < 6 || !placaNoEncontrada || buscandoPlaca)) return null;
    if (searchMode === "cliente" && !isCreatingNewVehicle) return null;

    return (
      <div className="bg-slate-50 dark:bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-blue-600">Vehículo nuevo — completa sus datos</p>
          {searchMode === "cliente" && (
            <button type="button" onClick={() => setIsCreatingNewVehicle(false)} className="text-xs text-red-500 hover:underline">
              Cancelar
            </button>
          )}
        </div>

        {searchMode === "cliente" && (
          <div>
            <label className="text-xs font-semibold mb-1 block text-[var(--text-muted)]">Placa *</label>
            <div className="relative">
              <Car size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input type="text" className="input pl-8 w-full text-sm uppercase" placeholder="EJ: ABCD-12"
                value={searchPlaca} onChange={(e) => setSearchPlaca(e.target.value)} />
            </div>
            {buscandoPlaca && <p className="text-xs text-blue-500 mt-1 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Verificando placa...</p>}
            {selectedVehiculo && <p className="text-xs text-red-500 mt-1">Este vehículo ya existe. Selecciona cancelar para volver.</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold mb-1 block text-[var(--text-muted)]">Marca</label>
            <input type="text" className="input w-full text-sm" placeholder="Ej: Chevrolet"
              value={vehiculoForm.marca} onChange={(e) => setVehiculoForm({ ...vehiculoForm, marca: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block text-[var(--text-muted)]">Modelo</label>
            <input type="text" className="input w-full text-sm" placeholder="Ej: Spark"
              value={vehiculoForm.modelo} onChange={(e) => setVehiculoForm({ ...vehiculoForm, modelo: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block text-[var(--text-muted)]">Año</label>
            <input type="number" className="input w-full text-sm"
              value={vehiculoForm.anio} onChange={(e) => setVehiculoForm({ ...vehiculoForm, anio: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block text-[var(--text-muted)]">Tipo</label>
            <select className="input w-full text-sm capitalize"
              value={vehiculoForm.tipoVehiculo} onChange={(e) => setVehiculoForm({ ...vehiculoForm, tipoVehiculo: e.target.value as TipoVehiculo })}>
              {tiposVehiculo.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>
    );
  };

  // ─── PLACA MODE: single-page flow ───
  const renderPlacaMode = () => (
    <div className="space-y-4">
      {/* Placa search */}
      <div>
        <label className="text-sm font-semibold mb-1 block">Placa del vehículo</label>
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Car size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              className="input pl-9 w-full uppercase"
              placeholder="EJ: ABCD-12"
              value={searchPlaca}
              onChange={(e) => setSearchPlaca(e.target.value)}
              autoFocus
            />
          </div>
          <button className="btn-primary w-12 flex items-center justify-center rounded-xl p-0 shrink-0 bg-blue-400 hover:bg-blue-500 border-none">
            {buscandoPlaca ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          </button>
        </div>
      </div>

      {/* Results */}
      {selectedVehiculo && renderVehiculoCard()}
      {renderNewVehicleForm()}

      {/* Auto-loaded or manual client */}
      {selectedCliente && (
        <div>
          <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Cliente del vehículo</label>
          {renderClienteCard()}
        </div>
      )}

      {/* If vehicle is new, need client info */}
      {!selectedVehiculo && searchPlaca.trim().length >= 6 && !selectedCliente && placaNoEncontrada && !buscandoPlaca && (
        <div>
          <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Cliente</label>
          {renderClienteSearchInline()}
        </div>
      )}
    </div>
  );

  // Inline client search (used in placa mode for new vehicles)
  const renderClienteSearchInline = () => (
    <div className="space-y-3">
      <div className="relative">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            className="input pl-9 w-full"
            placeholder="Buscar cliente por nombre, CI / RUC..."
            value={searchCliente}
            onChange={(e) => {
              setSearchCliente(e.target.value);
              if (selectedCliente) clearSelectedCliente();
            }}
          />
        </div>
        {filteredClientesInline.length > 0 && !selectedCliente && (
          <div className="absolute z-50 top-full mt-1 w-full bg-white dark:bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden">
            {filteredClientesInline.map((c) => (
              <button key={c.id} className="w-full text-left p-3 hover:bg-[var(--bg-hover)] border-b border-[var(--border)] last:border-0"
                onClick={() => handleSelectCliente(c)}>
                <p className="font-semibold text-sm">{c.nombre} {c.apellido}</p>
                <p className="text-xs text-[var(--text-muted)]">{c.identificacion} • {c.telefono}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      {selectedCliente && renderClienteCard()}
      {isClienteNewInline && renderNewClienteForm()}
    </div>
  );

  // Filter for inline client search (placa mode)
  const filteredClientesInline = useMemo(() => {
    if (searchMode !== "placa" || !searchCliente.trim()) return [];
    const term = searchCliente.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nombre?.toLowerCase().includes(term) ||
        c.apellido?.toLowerCase().includes(term) ||
        c.identificacion?.toLowerCase().includes(term) ||
        c.telefono?.includes(term)
    ).slice(0, 5);
  }, [searchCliente, clientes, searchMode]);

  const isClienteNewInline = searchMode === "placa" && searchCliente.trim().length > 2 && filteredClientesInline.length === 0 && !selectedCliente;

  // ─── CLIENT MODE: single view ───
  const renderClienteMode = () => {
    return (
      <div className="space-y-4">
        {/* Client search */}
        <div className="relative">
          <label className="text-sm font-semibold mb-1 block">Cliente</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              className={`input pl-9 w-full ${selectedCliente ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10" : ""}`}
              placeholder="Buscar por nombre, CI / RUC, teléfono o email..."
              value={searchCliente}
              onChange={(e) => {
                setSearchCliente(e.target.value);
                if (selectedCliente) {
                  clearSelectedCliente();
                  setSelectedVehiculo(null);
                  setSearchPlaca("");
                  setVehiculosCliente([]);
                }
              }}
              autoFocus
            />
          </div>
          {filteredClientes.length > 0 && !selectedCliente && (
            <div className="absolute z-50 top-full mt-1 w-full bg-white dark:bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden">
              {filteredClientes.map((c) => (
                <button key={c.id} className="w-full text-left p-3 hover:bg-[var(--bg-hover)] border-b border-[var(--border)] last:border-0"
                  onClick={() => handleSelectCliente(c)}>
                  <p className="font-semibold">{c.nombre} {c.apellido}</p>
                  <p className="text-xs text-[var(--text-muted)]">{c.identificacion} • {c.telefono}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {isClienteNew && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-xl p-3 text-sm text-yellow-800 dark:text-yellow-500">
            No encontramos un cliente con «<strong>{searchCliente}</strong>» — se registrará como nuevo.
          </div>
        )}

        {selectedCliente && renderClienteCard()}
        {isClienteNew && renderNewClienteForm()}

        {/* Vehicle section — shown when client is selected */}
        {selectedCliente && (
          <>
            {/* Client's existing vehicles */}
            {vehiculosCliente.length > 0 && !searchPlaca && !selectedVehiculo && (
              <div>
                <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                  Vehículos del cliente
                </h3>
                <div className="space-y-2">
                  {vehiculosCliente.map((v) => (
                    <div key={v.id} className="card p-3 flex items-center justify-between hover:border-blue-500 transition-colors cursor-pointer"
                      onClick={() => { 
                        setSelectedVehiculo(v); 
                        setSearchPlaca(v.placa); 
                        setIsCreatingNewVehicle(false); 
                      }}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                          <Car size={20} className="text-slate-500" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{v.marca} {v.modelo} {v.anio}</p>
                          <p className="text-xs text-[var(--text-muted)] uppercase">{v.placa}</p>
                        </div>
                      </div>
                      <span className="text-blue-600 text-sm font-semibold">Seleccionar</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedVehiculo && renderVehiculoCard()}

            {/* Placa search for new vehicle */}
            {!selectedVehiculo && !isCreatingNewVehicle && (
              <button 
                className="w-full py-2.5 border-2 border-dashed border-[var(--border)] rounded-xl text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors flex items-center justify-center gap-2"
                onClick={() => {
                  setIsCreatingNewVehicle(true);
                  setSelectedVehiculo(null);
                  setSearchPlaca("");
                }}
              >
                <Plus size={16} /> Nuevo vehículo
              </button>
            )}

            {renderNewVehicleForm()}
          </>
        )}
      </div>
    );
  };

  // New client form (shared)
  const renderNewClienteForm = () => (
    <div className="space-y-4 pt-1">
      <div className="flex items-center gap-4 mb-1">
        <span className="text-sm text-[var(--text-muted)] font-semibold">Tipo:</span>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="radio" name="tipoCliente" className="w-4 h-4 text-blue-600"
            checked={clienteForm.tipo === "Persona"} onChange={() => setClienteForm({ ...clienteForm, tipo: "Persona" })} />
          Persona
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="radio" name="tipoCliente" className="w-4 h-4 text-blue-600"
            checked={clienteForm.tipo === "Empresa"} onChange={() => setClienteForm({ ...clienteForm, tipo: "Empresa" })} />
          Empresa
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold mb-1 block">{clienteForm.tipo === "Empresa" ? "Razón social *" : "Nombre *"}</label>
          <input type="text" className="input w-full" placeholder={clienteForm.tipo === "Empresa" ? "Ej: ABC Corp" : "Ej: Juan"}
            value={clienteForm.nombre} onChange={(e) => setClienteForm({ ...clienteForm, nombre: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-semibold mb-1 block">{clienteForm.tipo === "Empresa" ? "Nombre comercial" : "Apellido *"}</label>
          <input type="text" className="input w-full" placeholder={clienteForm.tipo === "Empresa" ? "Opcional" : "Ej: Pérez"}
            value={clienteForm.apellido} onChange={(e) => setClienteForm({ ...clienteForm, apellido: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold mb-1 block">Cédula / RUC *</label>
          <input type="text" className="input w-full" placeholder="Ej: 1712345678"
            value={clienteForm.cedula} onChange={(e) => setClienteForm({ ...clienteForm, cedula: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-semibold mb-1 block">Teléfono *</label>
          <input type="text" className="input w-full" placeholder="+593 9 1234 5678"
            value={clienteForm.telefono} onChange={(e) => setClienteForm({ ...clienteForm, telefono: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="text-sm font-semibold mb-1 block">Email</label>
        <input type="email" className="input w-full" placeholder="correo@ejemplo.cl"
          value={clienteForm.email} onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })} />
      </div>
    </div>
  );

  // For placa mode with new vehicle + new client, we need to create client first
  const handleSubmitPlacaMode = async () => {
    // If we have both, submit directly
    if (selectedCliente && (selectedVehiculo || searchPlaca.trim().length >= 6)) {
      await handleFinalSubmit();
      return;
    }

    // Need to create client from form
    if (!selectedCliente && (isClienteNewInline || isClienteNew)) {
      if (!clienteForm.nombre || !clienteForm.cedula || !clienteForm.telefono) {
        toast.error("Por favor completa los datos del cliente");
        return;
      }
      setIsSubmitting(true);
      try {
        const nuevoClienteId = await createCliente({
          nombre: clienteForm.nombre,
          apellido: clienteForm.apellido,
          identificacion: clienteForm.cedula,
          telefono: clienteForm.telefono,
          email: clienteForm.email,
          direccion: "",
        });
        setSelectedCliente({
          id: nuevoClienteId,
          nombre: clienteForm.nombre,
          apellido: clienteForm.apellido,
          identificacion: clienteForm.cedula,
          telefono: clienteForm.telefono,
          email: clienteForm.email,
          direccion: "",
        });
        // Will re-render, user clicks submit again — or we call directly:
        // Actually let's just proceed
      } catch (error) {
        console.error(error);
        toast.error("Error al crear el cliente");
        setIsSubmitting(false);
        return;
      }
      // selectedCliente is set via setState, but won't be available synchronously.
      // We need to wait for re-render. Better: call handleFinalSubmit in a useEffect or just let user click again.
      setIsSubmitting(false);
      return;
    }

    toast.error("Selecciona o crea un cliente");
  };

  // Determine footer action based on mode
  const getFooterAction = () => {
    if (searchMode === "placa") {
      return {
        label: tipoMode === "ingreso" ? "📋 Ingresar a taller" : "Crear presupuesto",
        disabled: isSubmitting || !canSubmit,
        onClick: handleFinalSubmit,
        className: tipoMode === "ingreso" ? "bg-green-500 hover:bg-green-600" : "",
      };
    }
    // Client mode — if new client, create first then submit
    if (isClienteNew) {
      return {
        label: tipoMode === "ingreso" ? "📋 Ingresar a taller" : "Crear presupuesto",
        disabled: isSubmitting || !clienteForm.nombre || !clienteForm.cedula || !clienteForm.telefono,
        onClick: handleSubmitPlacaMode,
        className: tipoMode === "ingreso" ? "bg-green-500 hover:bg-green-600" : "",
      };
    }
    return {
      label: tipoMode === "ingreso" ? "📋 Ingresar a taller" : "Crear presupuesto",
      disabled: isSubmitting || !selectedCliente || (!selectedVehiculo && searchPlaca.length < 6),
      onClick: handleFinalSubmit,
      className: tipoMode === "ingreso" ? "bg-green-500 hover:bg-green-600" : "",
    };
  };

  const footer = getFooterAction();

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[var(--bg-card)] rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h2 className="text-xl font-bold">
              {tipoMode === "ingreso" ? "Nuevo Ingreso a Taller" : "Crear Nuevo Presupuesto"}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
            <X size={20} />
          </button>
        </div>

        {/* Search mode toggle */}
        <div className="px-5 pb-4">
          <div className="flex rounded-lg overflow-hidden border border-[var(--border)] h-9 bg-slate-100 dark:bg-slate-800">
            <button
              className={`flex-1 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${searchMode === "placa" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"}`}
              onClick={() => handleSwitchMode("placa")}
            >
              <Car size={14} /> Buscar por placa
            </button>
            <button
              className={`flex-1 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${searchMode === "cliente" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"}`}
              onClick={() => handleSwitchMode("cliente")}
            >
              <User size={14} /> Buscar por cliente
            </button>
          </div>
        </div>
        
        {/* Body */}
        <div className="p-5 pt-0 flex-1 overflow-y-auto custom-scrollbar min-h-[300px]">
          {searchMode === "placa" ? renderPlacaMode() : renderClienteMode()}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] flex justify-between items-center bg-slate-50 dark:bg-[var(--bg-secondary)] shrink-0">
          <button onClick={onClose} className="btn bg-white shadow-sm border border-[var(--border)]">
              Cancelar
            </button>
          <button 
            onClick={footer.onClick} 
            className={`btn-primary shadow flex items-center gap-2 px-6 border-none ${footer.className}`}
            disabled={footer.disabled}
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
            {footer.label}
          </button>
        </div>

      </div>

      {isEditingCliente && selectedCliente && (
        <ClienteModal
          cliente={selectedCliente}
          onClose={() => setIsEditingCliente(false)}
          onSaved={handleClienteEditSaved}
        />
      )}
    </div>
  );
}
