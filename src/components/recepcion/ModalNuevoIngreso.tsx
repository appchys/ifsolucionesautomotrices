"use client";
import { useEffect, useState, useMemo } from "react";
import { Car, Search, X, Loader2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  getClientes,
  getVehiculosByCliente,
  getVehiculoByPlaca,
  createCliente,
  createVehiculo,
  updateCliente,
  createOrdenConItems,
  getTiposVehiculo,
} from "@/lib/services";
import { Cliente, Vehiculo, TipoVehiculo } from "@/types";

interface Props {
  onClose: () => void;
  tipoMode?: "ingreso" | "presupuesto";
}

export default function ModalNuevoIngreso({ onClose, tipoMode = "ingreso" }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data
  const [clientes, setClientes] = useState<Cliente[]>([]);
  
  // Step 1 State
  const [searchCliente, setSearchCliente] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteForm, setClienteForm] = useState({
    tipo: "Persona" as "Persona" | "Empresa",
    nombre: "",
    cedula: "",
    telefono: "",
    email: "",
  });

  // Step 2 State
  const [vehiculosCliente, setVehiculosCliente] = useState<Vehiculo[]>([]);
  const [tiposVehiculo, setTiposVehiculo] = useState<string[]>([]);
  const [searchPlaca, setSearchPlaca] = useState("");
  const [selectedVehiculo, setSelectedVehiculo] = useState<Vehiculo | null>(null);
  const [vehiculoForm, setVehiculoForm] = useState({
    marca: "",
    modelo: "",
    anio: new Date().getFullYear(),
    tipoVehiculo: "sedan" as TipoVehiculo,
  });
  const [buscandoPlaca, setBuscandoPlaca] = useState(false);

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

  // Filter clients
  const filteredClientes = useMemo(() => {
    if (!searchCliente.trim()) return [];
    const term = searchCliente.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nombre?.toLowerCase().includes(term) ||
        c.apellido?.toLowerCase().includes(term) ||
        c.identificacion?.toLowerCase().includes(term) ||
        c.telefono?.includes(term) ||
        c.email?.toLowerCase().includes(term)
    ).slice(0, 5);
  }, [searchCliente, clientes]);

  const isClienteNew = searchCliente.trim().length > 2 && filteredClientes.length === 0 && !selectedCliente;

  const handleSelectCliente = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setSearchCliente(`${cliente.nombre} ${cliente.apellido || ""}`.trim());
    setClienteForm({
      tipo: cliente.identificacion?.length === 13 ? "Empresa" : "Persona",
      nombre: `${cliente.nombre} ${cliente.apellido || ""}`.trim(),
      cedula: cliente.identificacion || "",
      telefono: cliente.telefono || "",
      email: cliente.email || "",
    });
  };

  const clearSelectedCliente = () => {
    setSelectedCliente(null);
    setClienteForm({
      tipo: "Persona",
      nombre: "",
      cedula: "",
      telefono: "",
      email: "",
    });
  };

  // Load vehicles when entering step 2
  useEffect(() => {
    if (step === 2 && selectedCliente?.id) {
      getVehiculosByCliente(selectedCliente.id)
        .then(setVehiculosCliente)
        .catch(console.error);
    }
  }, [step, selectedCliente]);

  // Search vehicle by placa
  useEffect(() => {
    const placa = searchPlaca.trim().toUpperCase();
    if (placa.length >= 6) {
      const timer = setTimeout(async () => {
        setBuscandoPlaca(true);
        try {
          const vehiculo = await getVehiculoByPlaca(placa);
          if (vehiculo) {
            setSelectedVehiculo(vehiculo);
          } else {
            setSelectedVehiculo(null);
          }
        } catch (error) {
          console.error(error);
        } finally {
          setBuscandoPlaca(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setSelectedVehiculo(null);
    }
  }, [searchPlaca]);

  const handleNextToStep2 = async () => {
    if (!selectedCliente && (!clienteForm.nombre || !clienteForm.cedula || !clienteForm.telefono)) {
      toast.error("Por favor completa los campos obligatorios (*)");
      return;
    }

    setIsSubmitting(true);
    try {
      if (!selectedCliente) {
        // Create new client
        const nuevoClienteId = await createCliente({
          nombre: clienteForm.nombre,
          apellido: "", // Lo guardamos todo en nombre por simplicidad del UI
          identificacion: clienteForm.cedula,
          telefono: clienteForm.telefono,
          email: clienteForm.email,
          direccion: "",
        });
        setSelectedCliente({
          id: nuevoClienteId,
          nombre: clienteForm.nombre,
          apellido: "",
          identificacion: clienteForm.cedula,
          telefono: clienteForm.telefono,
          email: clienteForm.email,
          direccion: "",
        });
      } else {
        // Update existing if changed
        await updateCliente(selectedCliente.id!, {
          nombre: clienteForm.nombre,
          identificacion: clienteForm.cedula,
          telefono: clienteForm.telefono,
          email: clienteForm.email,
        });
      }
      setStep(2);
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar el cliente");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!selectedCliente?.id) return;
    
    setIsSubmitting(true);
    try {
      let vehiculoId = selectedVehiculo?.id;

      if (!vehiculoId) {
        if (!searchPlaca.trim() || !vehiculoForm.marca || !vehiculoForm.modelo) {
          toast.error("Por favor ingresa la placa, marca y modelo del vehículo");
          setIsSubmitting(false);
          return;
        }
        // Crear nuevo vehículo
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

      // Crear Orden de Trabajo inicial (Ingreso o Presupuesto)
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

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[var(--bg-card)] rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h2 className="text-xl font-bold">
              {tipoMode === "ingreso" ? "Nuevo Ingreso a Taller" : "Crear Nuevo Presupuesto"}
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              Paso {step} de 2 — {step === 1 ? "Cliente" : "Vehículo"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-5 pb-4 flex gap-2">
          <div className="h-1.5 flex-1 bg-blue-600 rounded-full"></div>
          <div className={`h-1.5 flex-1 rounded-full ${step === 2 ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"}`}></div>
        </div>
        
        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar min-h-[350px]">
          {step === 1 ? (
            <div className="space-y-5">
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
                      if (selectedCliente) clearSelectedCliente();
                    }}
                  />
                </div>
                
                {/* Autocomplete Dropdown */}
                {filteredClientes.length > 0 && !selectedCliente && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-white dark:bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden">
                    {filteredClientes.map((c) => (
                      <button
                        key={c.id}
                        className="w-full text-left p-3 hover:bg-[var(--bg-hover)] border-b border-[var(--border)] last:border-0"
                        onClick={() => handleSelectCliente(c)}
                      >
                        <p className="font-semibold">{c.nombre} {c.apellido}</p>
                        <p className="text-xs text-[var(--text-muted)]">{c.identificacion} • {c.telefono}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isClienteNew && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-xl p-3 text-sm text-yellow-800 dark:text-yellow-500">
                  No encontramos un cliente con «<strong>{searchCliente}</strong>» — se registrará como nuevo. Completa los datos abajo.
                </div>
              )}

              {selectedCliente && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded-xl p-3 text-sm text-green-800 dark:text-green-500 flex items-center gap-2">
                  <span className="font-bold">✓ Cliente seleccionado.</span> Puedes actualizar sus datos si lo deseas.
                </div>
              )}

              {(isClienteNew || selectedCliente) && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-sm text-[var(--text-muted)] font-semibold">Tipo de cliente:</span>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input 
                        type="radio" 
                        name="tipoCliente" 
                        className="w-4 h-4 text-blue-600"
                        checked={clienteForm.tipo === "Persona"}
                        onChange={() => setClienteForm({ ...clienteForm, tipo: "Persona" })}
                      />
                      Persona
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input 
                        type="radio" 
                        name="tipoCliente" 
                        className="w-4 h-4 text-blue-600"
                        checked={clienteForm.tipo === "Empresa"}
                        onChange={() => setClienteForm({ ...clienteForm, tipo: "Empresa" })}
                      />
                      Empresa
                    </label>
                  </div>

                  <div>
                    <label className="text-sm font-semibold mb-1 block">Nombre completo / Razón social *</label>
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="Ej: Juan Perez"
                      value={clienteForm.nombre}
                      onChange={(e) => setClienteForm({ ...clienteForm, nombre: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold mb-1 block">Cédula / RUC *</label>
                      <input
                        type="text"
                        className="input w-full"
                        placeholder="Ej: 1712345678"
                        value={clienteForm.cedula}
                        onChange={(e) => setClienteForm({ ...clienteForm, cedula: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold mb-1 block">Teléfono *</label>
                      <input
                        type="text"
                        className="input w-full"
                        placeholder="+593 9 1234 5678"
                        value={clienteForm.telefono}
                        onChange={(e) => setClienteForm({ ...clienteForm, telefono: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold mb-1 block">Email</label>
                    <input
                      type="email"
                      className="input w-full"
                      placeholder="correo@ejemplo.cl"
                      value={clienteForm.email}
                      onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
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
                    />
                  </div>
                  <button className="btn-primary w-12 flex items-center justify-center rounded-xl p-0 shrink-0 bg-blue-400 hover:bg-blue-500 border-none">
                    {buscandoPlaca ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                  </button>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-2">Buscamos la placa automáticamente al terminar de escribir.</p>
              </div>

              {selectedVehiculo ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded-xl p-4">
                  <h3 className="font-semibold text-green-800 dark:text-green-400 flex items-center gap-2 mb-2">
                    ✓ Vehículo encontrado
                  </h3>
                  <p className="font-bold">{selectedVehiculo.marca} {selectedVehiculo.modelo} {selectedVehiculo.anio}</p>
                  <p className="text-sm text-[var(--text-muted)] uppercase">{selectedVehiculo.placa}</p>
                </div>
              ) : searchPlaca.trim().length >= 6 ? (
                <div className="bg-slate-50 dark:bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 space-y-4">
                  <p className="text-sm font-semibold text-blue-600">Vehículo nuevo - Completa sus datos</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold mb-1 block text-[var(--text-muted)]">Marca</label>
                      <input 
                        type="text" 
                        className="input w-full text-sm" 
                        placeholder="Ej: Chevrolet"
                        value={vehiculoForm.marca}
                        onChange={(e) => setVehiculoForm({ ...vehiculoForm, marca: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1 block text-[var(--text-muted)]">Modelo</label>
                      <input 
                        type="text" 
                        className="input w-full text-sm" 
                        placeholder="Ej: Spark"
                        value={vehiculoForm.modelo}
                        onChange={(e) => setVehiculoForm({ ...vehiculoForm, modelo: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1 block text-[var(--text-muted)]">Año</label>
                      <input 
                        type="number" 
                        className="input w-full text-sm" 
                        value={vehiculoForm.anio}
                        onChange={(e) => setVehiculoForm({ ...vehiculoForm, anio: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1 block text-[var(--text-muted)]">Tipo</label>
                      <select 
                        className="input w-full text-sm capitalize"
                        value={vehiculoForm.tipoVehiculo}
                        onChange={(e) => setVehiculoForm({ ...vehiculoForm, tipoVehiculo: e.target.value as TipoVehiculo })}
                      >
                        {tiposVehiculo.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ) : null}

              {vehiculosCliente.length > 0 && !searchPlaca && (
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                    Vehículos del cliente
                  </h3>
                  <div className="space-y-2">
                    {vehiculosCliente.map((v) => (
                      <div key={v.id} className="card p-3 flex items-center justify-between hover:border-blue-500 transition-colors cursor-pointer" onClick={() => {
                        setSelectedVehiculo(v);
                        setSearchPlaca(v.placa);
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
                        <button className="text-blue-600 text-sm font-semibold hover:underline">
                          Seleccionar
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 my-4">
                    <div className="h-px bg-[var(--border)] flex-1"></div>
                    <span className="text-xs text-[var(--text-muted)]">o buscar por placa</span>
                    <div className="h-px bg-[var(--border)] flex-1"></div>
                  </div>
                  <p className="text-sm text-center text-[var(--text-secondary)]">
                    Escribe la placa arriba para buscar otro vehículo o crear uno nuevo
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] flex justify-between items-center bg-slate-50 dark:bg-[var(--bg-secondary)] shrink-0">
          {step === 1 ? (
            <>
              <button onClick={onClose} className="btn bg-white shadow-sm border border-[var(--border)]">
                Cancelar
              </button>
              <button 
                onClick={handleNextToStep2} 
                className="btn-primary flex items-center gap-2 px-6"
                disabled={isSubmitting || loading}
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                Siguiente →
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="btn bg-white shadow-sm border border-[var(--border)] flex items-center gap-2">
                <ArrowLeft size={16} /> Atrás
              </button>
              <button 
                onClick={handleFinalSubmit} 
                className={`btn-primary shadow flex items-center gap-2 px-6 border-none ${tipoMode === "ingreso" ? "bg-green-500 hover:bg-green-600" : ""}`}
                disabled={isSubmitting || (!selectedVehiculo && searchPlaca.length < 6)}
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                {tipoMode === "ingreso" ? "📋 Ingresar a taller" : "Crear presupuesto"}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
