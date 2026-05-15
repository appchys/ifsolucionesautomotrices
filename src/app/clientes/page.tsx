"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { getClientes, deleteCliente } from "@/lib/services";
import { Cliente } from "@/types";
import { Users, Plus, Search, Trash2, Pencil, Phone, Mail } from "lucide-react";
import { toast } from "react-hot-toast";
import ClienteModal from "@/components/clientes/ClienteModal";

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await getClientes();
    setClientes(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este cliente?")) return;
    await deleteCliente(id);
    toast.success("Cliente eliminado");
    load();
  };

  const filtered = clientes.filter((c) => {
    const term = search.toLowerCase();
    return !search || 
      c.nombre.toLowerCase().includes(term) ||
      c.apellido.toLowerCase().includes(term) ||
      c.identificacion.includes(term) ||
      c.telefono.includes(term);
  });

  return (
    <AppShell>
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">{clientes.length} clientes registrados</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus size={16} /> Nuevo Cliente
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
        <input
          className="input pl-9"
          placeholder="Buscar por nombre, cédula, teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((c) => (
            <div key={c.id} className="card-hover">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    {c.nombre.charAt(0)}{c.apellido.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                      {c.nombre} {c.apellido}
                    </p>
                    <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                      {c.identificacion}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditing(c); setModalOpen(true); }}
                    className="btn-ghost btn-icon p-1.5"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id!)}
                    className="btn-ghost btn-icon p-1.5"
                    style={{ color: "var(--danger)" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {c.telefono && (
                  <a href={`tel:${c.telefono}`} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <Phone size={12} style={{ color: "var(--success)" }} />
                    {c.telefono}
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <Mail size={12} style={{ color: "var(--accent-light)" }} />
                    {c.email}
                  </a>
                )}
                {c.direccion && (
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{c.direccion}</p>
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16" style={{ color: "var(--text-muted)" }}>
              <Users size={40} className="mx-auto mb-3 opacity-20" />
              <p>No se encontraron clientes</p>
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <ClienteModal
          cliente={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load(); }}
        />
      )}
    </AppShell>
  );
}
