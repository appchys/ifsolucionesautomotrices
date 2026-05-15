"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { getVehiculos, getClientes, createVehiculo, updateVehiculo } from "@/lib/services";
import { Vehiculo, Cliente, TipoVehiculo } from "@/types";
import { Car, Plus, Search, Pencil, Calendar, Palette } from "lucide-react";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import { X, Loader2 } from "lucide-react";
import VehiculoModal from "@/components/vehiculos/VehiculoModal";

const TIPOS: TipoVehiculo[] = ["sedan", "suv", "pickup", "camioneta", "moto", "otro"];

export default function VehiculosPage() {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vehiculo | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, setValue } = useForm<Omit<Vehiculo, "id">>();

  const load = async () => {
    setLoading(true);
    const [v, c] = await Promise.all([getVehiculos(), getClientes()]);
    setVehiculos(v);
    setClientes(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openModal = (v?: Vehiculo) => {
    setEditing(v ?? null);
    if (v) {
      Object.entries(v).forEach(([k, val]) => setValue(k as any, val));
    } else {
      reset();
    }
    setModalOpen(true);
  };

  const onSubmit = async (data: Omit<Vehiculo, "id">) => {
    setSaving(true);
    try {
      if (editing?.id) {
        await updateVehiculo(editing.id, data);
        toast.success("Vehículo actualizado");
      } else {
        await createVehiculo({ ...data, placa: data.placa.toUpperCase() });
        toast.success("Vehículo registrado");
      }
      setModalOpen(false);
      load();
    } catch { toast.error("Error al guardar"); }
    finally { setSaving(false); }
  };

  const getClienteNombre = (clienteId: string) => {
    const c = clientes.find((c) => c.id === clienteId);
    return c ? `${c.nombre} ${c.apellido}` : "—";
  };

  const filtered = vehiculos.filter((v) => {
    const term = search.toLowerCase();
    return !search ||
      v.placa.toLowerCase().includes(term) ||
      v.marca.toLowerCase().includes(term) ||
      v.modelo.toLowerCase().includes(term);
  });

  return (
    <AppShell>
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Vehículos</h1>
          <p className="page-subtitle">{vehiculos.length} vehículos registrados</p>
        </div>
        <button className="btn-primary" onClick={() => openModal()}>
          <Plus size={16} /> Nuevo Vehículo
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
        <input className="input pl-9" placeholder="Buscar por placa, marca, modelo..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((v) => (
            <div key={v.id} className="card-hover">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.12)" }}>
                    <Car size={20} style={{ color: "var(--warning)" }} />
                  </div>
                  <div>
                    <p className="font-mono font-bold text-lg" style={{ color: "var(--text-primary)" }}>{v.placa}</p>
                    <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>{v.tipoVehiculo}</p>
                  </div>
                </div>
                <button onClick={() => openModal(v)} className="btn-ghost btn-icon p-1.5">
                  <Pencil size={14} />
                </button>
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                  {v.marca} {v.modelo}
                </p>
                <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="flex items-center gap-1"><Calendar size={11} />{v.anio}</span>
                  <span className="flex items-center gap-1"><Palette size={11} />{v.color}</span>
                </div>
                <p className="text-xs" style={{ color: "var(--accent-light)" }}>
                  👤 {getClienteNombre(v.clienteId)}
                </p>
                {v.vin && <p className="text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>VIN: {v.vin}</p>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16" style={{ color: "var(--text-muted)" }}>
              <Car size={40} className="mx-auto mb-3 opacity-20" />
              <p>No se encontraron vehículos</p>
            </div>
          )}
        </div>
      )}

      <VehiculoModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        editingVehiculo={editing} 
        onSuccess={load} 
      />
    </AppShell>
  );
}
