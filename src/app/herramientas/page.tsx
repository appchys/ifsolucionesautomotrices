"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Wrench,
  Plus,
  Search,
  Loader2,
  Trash2,
  Edit,
  ShieldCheck,
  AlertTriangle,
  Hammer,
  DollarSign,
  User,
  MapPin,
  Tag,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import HerramientaModal from "@/components/herramientas/HerramientaModal";
import { Herramienta, EstadoHerramienta } from "@/types";
import { subscribeHerramientas, deleteHerramienta, updateHerramienta } from "@/lib/services";
import { toast } from "react-hot-toast";

const ESTADOS_CONFIG: Record<EstadoHerramienta, { label: string; badgeClass: string; icon: typeof CheckCircle2 }> = {
  excelente: { label: "Excelente", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  bueno: { label: "Bueno", badgeClass: "bg-blue-50 text-blue-700 border-blue-200", icon: ShieldCheck },
  regular: { label: "Regular", badgeClass: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle },
  mantenimiento: { label: "En Mantenimiento", badgeClass: "bg-purple-50 text-purple-700 border-purple-200", icon: Wrench },
  dañado: { label: "Dañado", badgeClass: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  perdido: { label: "Perdido", badgeClass: "bg-slate-100 text-slate-600 border-slate-300", icon: HelpCircle },
};

export default function HerramientasPage() {
  const [herramientas, setHerramientas] = useState<Herramienta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState<string>("todas");
  const [selectedEstado, setSelectedEstado] = useState<string>("todos");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHerramienta, setEditingHerramienta] = useState<Herramienta | null>(null);

  // Suscripción en tiempo real a la colección de herramientas
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeHerramientas((data) => {
      setHerramientas(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Lista de categorías únicas
  const categorias = useMemo(() => {
    const setCat = new Set<string>();
    herramientas.forEach((h) => {
      if (h.categoria) setCat.add(h.categoria);
    });
    return Array.from(setCat).sort();
  }, [herramientas]);

  // Filtrado de herramientas
  const filteredHerramientas = useMemo(() => {
    return herramientas.filter((h) => {
      const term = search.toLowerCase().trim();
      const matchesSearch =
        !term ||
        h.nombre.toLowerCase().includes(term) ||
        h.codigo.toLowerCase().includes(term) ||
        (h.marca && h.marca.toLowerCase().includes(term)) ||
        (h.modelo && h.modelo.toLowerCase().includes(term)) ||
        (h.ubicacion && h.ubicacion.toLowerCase().includes(term)) ||
        (h.responsableNombre && h.responsableNombre.toLowerCase().includes(term));

      const matchesCategoria = selectedCategoria === "todas" || h.categoria === selectedCategoria;
      const matchesEstado = selectedEstado === "todos" || h.estado === selectedEstado;

      return matchesSearch && matchesCategoria && matchesEstado;
    });
  }, [herramientas, search, selectedCategoria, selectedEstado]);

  // Métricas rápidas
  const stats = useMemo(() => {
    const totalCantidad = herramientas.reduce((sum, h) => sum + (h.cantidad || 1), 0);
    const buenas = herramientas.filter((h) => h.estado === "excelente" || h.estado === "bueno").reduce((sum, h) => sum + (h.cantidad || 1), 0);
    const mantenimientoODanadas = herramientas.filter((h) => h.estado === "mantenimiento" || h.estado === "dañado" || h.estado === "perdido").reduce((sum, h) => sum + (h.cantidad || 1), 0);
    const valorInvertido = herramientas.reduce((sum, h) => sum + (Number(h.costoCompra || 0) * (h.cantidad || 1)), 0);

    return { totalCantidad, buenas, mantenimientoODanadas, valorInvertido };
  }, [herramientas]);

  const handleEliminar = async (id: string, nombre: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar la herramienta "${nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      await deleteHerramienta(id);
      toast.success("Herramienta eliminada correctamente");
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar la herramienta");
    }
  };

  const handleQuickStatusChange = async (id: string, nuevoEstado: EstadoHerramienta) => {
    try {
      await updateHerramienta(id, { estado: nuevoEstado });
      toast.success("Estado actualizado");
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar estado");
    }
  };

  return (
    <AppShell>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto animate-fade-in">
        
        {/* Header Superior */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              <Hammer className="text-blue-600" size={24} /> Inventario de Herramientas
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Control e inventario de los equipos, maquinaria y herramientas del taller
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingHerramienta(null);
              setIsModalOpen(true);
            }}
            className="btn-primary flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold shrink-0"
          >
            <Plus size={16} /> Nueva Herramienta
          </button>
        </div>

        {/* Tarjetas de Métricas Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Wrench size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Total Herramientas</p>
              <p className="text-lg lg:text-xl font-black text-[var(--text-primary)] mt-0.5">{stats.totalCantidad}</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Operativas / Buenas</p>
              <p className="text-lg lg:text-xl font-black text-emerald-600 mt-0.5">{stats.buenas}</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Atención / Dañadas</p>
              <p className="text-lg lg:text-xl font-black text-amber-600 mt-0.5">{stats.mantenimientoODanadas}</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Valor Invertido ($)</p>
              <p className="text-lg lg:text-xl font-black text-indigo-600 mt-0.5">${stats.valorInvertido.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="card p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Input de Búsqueda */}
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                className="input pl-9 text-xs w-full h-9"
                placeholder="Buscar por código, nombre, marca, ubicación o responsable..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Selectores de Filtro */}
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
              <select
                className="input text-xs h-9 py-1 px-3 w-40 shrink-0"
                value={selectedCategoria}
                onChange={(e) => setSelectedCategoria(e.target.value)}
              >
                <option value="todas">Todas las categorías</option>
                {categorias.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                className="input text-xs h-9 py-1 px-3 w-40 shrink-0"
                value={selectedEstado}
                onChange={(e) => setSelectedEstado(e.target.value)}
              >
                <option value="todos">Todos los estados</option>
                {Object.entries(ESTADOS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabla de Inventario de Herramientas */}
        <div className="card p-0 overflow-hidden border border-[var(--border)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
              <Loader2 size={32} className="animate-spin text-blue-600 mb-2" />
              <p className="text-xs font-semibold">Cargando inventario de herramientas...</p>
            </div>
          ) : filteredHerramientas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center p-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <Wrench size={24} />
              </div>
              <p className="font-bold text-sm text-[var(--text-primary)]">No se encontraron herramientas</p>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm">
                {search || selectedCategoria !== "todas" || selectedEstado !== "todos"
                  ? "Prueba cambiando los filtros o el término de búsqueda."
                  : "Registra la primera herramienta del taller con el botón superior."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Herramienta / Marca / Modelo</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Ubicación</th>
                    <th className="py-3 px-4">Responsable</th>
                    <th className="py-3 px-4 text-center">Cant.</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Costo Unit.</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-xs">
                  {filteredHerramientas.map((h) => {
                    const est = ESTADOS_CONFIG[h.estado] || ESTADOS_CONFIG.bueno;
                    const IconComponent = est.icon;

                    return (
                      <tr key={h.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Código */}
                        <td className="py-3 px-4 font-mono font-bold text-blue-600 align-middle">
                          {h.codigo}
                        </td>

                        {/* Nombre / Marca / Modelo */}
                        <td className="py-3 px-4 align-middle">
                          <p className="font-bold text-[var(--text-primary)] leading-tight">{h.nombre}</p>
                          {(h.marca || h.modelo || h.numeroSerie) && (
                            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                              {h.marca} {h.modelo} {h.numeroSerie ? `· S/N: ${h.numeroSerie}` : ""}
                            </p>
                          )}
                        </td>

                        {/* Categoría */}
                        <td className="py-3 px-4 align-middle">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            <Tag size={10} /> {h.categoria || "General"}
                          </span>
                        </td>

                        {/* Ubicación */}
                        <td className="py-3 px-4 text-[var(--text-secondary)] align-middle">
                          {h.ubicacion ? (
                            <span className="flex items-center gap-1">
                              <MapPin size={12} className="text-slate-400 shrink-0" /> {h.ubicacion}
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)] italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* Responsable */}
                        <td className="py-3 px-4 text-[var(--text-secondary)] align-middle">
                          {h.responsableNombre ? (
                            <span className="flex items-center gap-1 font-semibold text-slate-700">
                              <User size={12} className="text-blue-500 shrink-0" /> {h.responsableNombre}
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)] italic text-[11px]">General / Taller</span>
                          )}
                        </td>

                        {/* Cantidad */}
                        <td className="py-3 px-4 text-center font-bold text-[var(--text-primary)] align-middle">
                          {h.cantidad || 1}
                        </td>

                        {/* Estado */}
                        <td className="py-3 px-4 align-middle">
                          <div className="relative group inline-block">
                            <select
                              value={h.estado}
                              onChange={(e) => handleQuickStatusChange(h.id!, e.target.value as EstadoHerramienta)}
                              className={`text-[10px] font-bold px-2 py-1 rounded-full border cursor-pointer appearance-none pr-4 outline-none ${est.badgeClass}`}
                            >
                              {Object.entries(ESTADOS_CONFIG).map(([key, config]) => (
                                <option key={key} value={key} className="bg-white text-slate-800">
                                  {config.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>

                        {/* Costo Unit. */}
                        <td className="py-3 px-4 text-right font-mono font-semibold text-[var(--text-primary)] align-middle">
                          {h.costoCompra ? `$${Number(h.costoCompra).toFixed(2)}` : "—"}
                        </td>

                        {/* Acciones */}
                        <td className="py-3 px-4 text-center align-middle">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingHerramienta(h);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Editar herramienta"
                            >
                              <Edit size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleEliminar(h.id!, h.nombre)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Eliminar herramienta"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Creación / Edición */}
      {isModalOpen && (
        <HerramientaModal
          herramienta={editingHerramienta}
          onClose={() => {
            setIsModalOpen(false);
            setEditingHerramienta(null);
          }}
        />
      )}
    </AppShell>
  );
}
