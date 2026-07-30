"use client";
import { useState, useEffect, useRef } from "react";
import {
  getMarcasVehiculo,
  createMarcaVehiculo,
  updateMarcaVehiculo,
  deleteMarcaVehiculo,
  agregarModeloAMarca,
  eliminarModeloDeMarca,
  subirLogoMarca,
  sembrarMarcasEcuador,
  detectarTipoVehiculo,
} from "@/lib/services";
import { MarcaVehiculo } from "@/types";
import {
  X,
  Plus,
  Search,
  Pencil,
  Trash2,
  Upload,
  Car,
  Tag,
  RefreshCw,
  Loader2,
  Check,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "react-hot-toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function GestionMarcasModal({ isOpen, onClose, onUpdated }: Props) {
  const [marcas, setMarcas] = useState<MarcaVehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [seeding, setSeeding] = useState(false);

  // Modal de edición/creación de Marca
  const [editingMarca, setEditingMarca] = useState<MarcaVehiculo | null>(null);
  const [isEditingOpen, setIsEditingOpen] = useState(false);
  const [nombreForm, setNombreForm] = useState("");
  const [logoUrlForm, setLogoUrlForm] = useState("");
  const [popularidadForm, setPopularidadForm] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingMarca, setSavingMarca] = useState(false);

  // Modal/Panel de gestión de Modelos para una Marca
  const [selectedMarcaForModels, setSelectedMarcaForModels] = useState<MarcaVehiculo | null>(null);
  const [nuevoModeloInput, setNuevoModeloInput] = useState("");
  const [addingModelo, setAddingModelo] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  const loadMarcas = async () => {
    setLoading(true);
    try {
      const data = await getMarcasVehiculo();
      setMarcas(data);

      // Si tenemos una marca seleccionada para modelos, actualizarla
      if (selectedMarcaForModels) {
        const updatedSelected = data.find((m) => m.id === selectedMarcaForModels.id);
        if (updatedSelected) setSelectedMarcaForModels(updatedSelected);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar marcas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMarcas();
    }
  }, [isOpen]);

  // Clic fuera para cerrar el modal principal
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const handleSeedEcuador = async () => {
    if (!window.confirm("¿Deseas restaurar/cargar las marcas más populares de Ecuador en el sistema?")) return;
    setSeeding(true);
    try {
      await sembrarMarcasEcuador(true);
      toast.success("Marcas populares de Ecuador cargadas exitosamente");
      await loadMarcas();
      onUpdated?.();
    } catch (err) {
      console.error(err);
      toast.error("Error al sembrar marcas");
    } finally {
      setSeeding(false);
    }
  };

  const handleOpenCreateMarca = () => {
    setEditingMarca(null);
    setNombreForm("");
    setLogoUrlForm("");
    setPopularidadForm(true);
    setIsEditingOpen(true);
  };

  const handleOpenEditMarca = (marca: MarcaVehiculo) => {
    setEditingMarca(marca);
    setNombreForm(marca.nombre);
    setLogoUrlForm(marca.logoUrl || "");
    setPopularidadForm(marca.popularidadEcuador ?? false);
    setIsEditingOpen(true);
  };

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const pathSuffix = (nombreForm || "logo").toLowerCase().replace(/[^a-z0-9]/g, "_");
      const url = await subirLogoMarca(file, pathSuffix);
      setLogoUrlForm(url);
      toast.success("Logo subido correctamente");
    } catch (err) {
      console.error(err);
      toast.error("Error al subir el logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveMarca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreForm.trim()) {
      toast.error("El nombre de la marca es requerido");
      return;
    }

    setSavingMarca(true);
    try {
      if (editingMarca?.id) {
        await updateMarcaVehiculo(editingMarca.id, {
          nombre: nombreForm.trim(),
          logoUrl: logoUrlForm || undefined,
          popularidadEcuador: popularidadForm,
        });
        toast.success("Marca actualizada");
      } else {
        await createMarcaVehiculo({
          nombre: nombreForm.trim(),
          logoUrl: logoUrlForm || undefined,
          popularidadEcuador: popularidadForm,
          modelos: [],
        });
        toast.success("Marca registrada");
      }
      setIsEditingOpen(false);
      await loadMarcas();
      onUpdated?.();
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar la marca");
    } finally {
      setSavingMarca(false);
    }
  };

  const handleDeleteMarca = async (marca: MarcaVehiculo) => {
    if (!marca.id) return;
    if (!window.confirm(`¿Estás seguro de eliminar la marca "${marca.nombre}"?`)) return;

    try {
      await deleteMarcaVehiculo(marca.id);
      toast.success("Marca eliminada");
      if (selectedMarcaForModels?.id === marca.id) {
        setSelectedMarcaForModels(null);
      }
      await loadMarcas();
      onUpdated?.();
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar la marca");
    }
  };

  const handleAgregarModelo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMarcaForModels?.id || !nuevoModeloInput.trim()) return;

    setAddingModelo(true);
    try {
      const tipoAuto = detectarTipoVehiculo(selectedMarcaForModels.nombre, nuevoModeloInput.trim()) || undefined;
      await agregarModeloAMarca(selectedMarcaForModels.id, {
        nombre: nuevoModeloInput.trim(),
        tipoVehiculo: tipoAuto,
      });
      toast.success(`Modelo "${nuevoModeloInput.trim()}" agregado`);
      setNuevoModeloInput("");
      await loadMarcas();
      onUpdated?.();
    } catch (err) {
      console.error(err);
      toast.error("Error al agregar el modelo");
    } finally {
      setAddingModelo(false);
    }
  };

  const handleEliminarModelo = async (modeloNombre: string) => {
    if (!selectedMarcaForModels?.id) return;
    try {
      await eliminarModeloDeMarca(selectedMarcaForModels.id, modeloNombre);
      toast.success(`Modelo "${modeloNombre}" eliminado`);
      await loadMarcas();
      onUpdated?.();
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar el modelo");
    }
  };

  if (!isOpen) return null;

  const uniqueMarcas = marcas.filter((m, idx, self) =>
    idx === self.findIndex((t) => t.nombre.trim().toLowerCase() === m.nombre.trim().toLowerCase())
  );

  const filteredMarcas = uniqueMarcas.filter((m) =>
    m.nombre.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity"
    >
      <div
        ref={modalRef}
        className="modal-box max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl"
      >
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--accent-light-10)] text-[var(--accent-primary)]">
              <Car size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Gestión de Marcas y Modelos
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Administra los logos de marcas y sus modelos asociados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSeedEcuador}
              disabled={seeding}
              className="btn-secondary btn-sm flex items-center gap-1.5 text-xs"
              title="Cargar catálogo estándar de marcas populares en Ecuador"
            >
              <RefreshCw size={14} className={seeding ? "animate-spin" : ""} />
              <span>Cargar Marcas Ecuador</span>
            </button>

            <button onClick={onClose} className="btn-ghost btn-icon p-1.5">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Cuerpo principal con división responsiva para laptops de 13-14 pulgadas */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden min-h-0">
          {/* Panel Izquierdo: Lista de Marcas */}
          <div className="md:col-span-7 flex flex-col border-r border-[var(--border-color)] overflow-hidden p-4">
            <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Buscar marca..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input pl-8 py-1.5 text-xs w-full"
                />
              </div>
              <button
                type="button"
                onClick={handleOpenCreateMarca}
                className="btn-primary btn-sm flex items-center gap-1 shrink-0 text-xs py-1.5"
              >
                <Plus size={14} /> Nueva Marca
              </button>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-[var(--accent-primary)]" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredMarcas.map((marca) => {
                  const isSelected = selectedMarcaForModels?.id === marca.id;
                  const modelCount = marca.modelos?.length || 0;
                  return (
                    <div
                      key={marca.id || marca.nombre}
                      onClick={() => setSelectedMarcaForModels(marca)}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? "border-[var(--accent-primary)] bg-[var(--accent-light-10)] shadow-xs"
                          : "border-[var(--border-color)] hover:border-slate-400 dark:hover:border-slate-600 bg-[var(--bg-card)]"
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        {marca.logoUrl ? (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={marca.logoUrl}
                              alt={marca.nombre}
                              className="max-w-full max-h-full object-contain p-1"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)] shrink-0 border border-slate-200 dark:border-slate-700">
                            <Car size={20} />
                          </div>
                        )}

                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm text-[var(--text-primary)]">
                              {marca.nombre}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                            <Tag size={11} /> {modelCount} {modelCount === 1 ? "modelo" : "modelos"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditMarca(marca)}
                          className="btn-ghost btn-icon p-1.5 text-slate-500 hover:text-[var(--accent-primary)]"
                          title="Editar marca y logo"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMarca(marca)}
                          className="btn-ghost btn-icon p-1.5 text-slate-500 hover:text-red-500"
                          title="Eliminar marca"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredMarcas.length === 0 && (
                  <div className="text-center py-12 text-[var(--text-muted)]">
                    <Car size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No se encontraron marcas</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Panel Derecho: Modelos de la Marca Seleccionada */}
          <div className="md:col-span-5 flex flex-col overflow-hidden p-4 bg-[var(--bg-card)]/50">
            {selectedMarcaForModels ? (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--border-color)] shrink-0">
                  <div className="flex items-center gap-2">
                    {selectedMarcaForModels.logoUrl && (
                      <div className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedMarcaForModels.logoUrl}
                          alt={selectedMarcaForModels.nombre}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    )}
                    <h3 className="font-bold text-sm text-[var(--text-primary)]">
                      Modelos de {selectedMarcaForModels.nombre}
                    </h3>
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">
                    {selectedMarcaForModels.modelos?.length || 0} registrados
                  </span>
                </div>

                {/* Formulario para agregar modelo */}
                <form onSubmit={handleAgregarModelo} className="flex gap-2 mb-3 shrink-0">
                  <input
                    type="text"
                    placeholder="Nuevo modelo..."
                    value={nuevoModeloInput}
                    onChange={(e) => setNuevoModeloInput(e.target.value)}
                    className="input text-xs py-1.5 flex-1"
                  />
                  <button
                    type="submit"
                    disabled={addingModelo || !nuevoModeloInput.trim()}
                    className="btn-primary btn-sm py-1.5 px-3 text-xs flex items-center gap-1"
                  >
                    {addingModelo ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Plus size={14} />
                    )}
                    Agregar
                  </button>
                </form>

                {/* Lista de Modelos */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {(selectedMarcaForModels.modelos || []).map((modelo) => (
                    <div
                      key={modelo.id || modelo.nombre}
                      className="flex items-center justify-between p-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-xs text-[var(--text-primary)]"
                    >
                      <span className="font-medium truncate">{modelo.nombre}</span>
                      <button
                        type="button"
                        onClick={() => handleEliminarModelo(modelo.nombre)}
                        className="btn-ghost btn-icon p-1 text-slate-400 hover:text-red-500"
                        title="Eliminar modelo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}

                  {(!selectedMarcaForModels.modelos || selectedMarcaForModels.modelos.length === 0) && (
                    <div className="text-center py-10 text-[var(--text-muted)] text-xs">
                      No hay modelos agregados para esta marca.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[var(--text-muted)]">
                <Tag size={36} className="mb-2 opacity-25" />
                <p className="text-sm font-medium">Selecciona una marca</p>
                <p className="text-xs opacity-75 mt-1">
                  Haz clic en cualquier marca de la lista para ver y gestionar sus modelos.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-modal: Crear / Editar Marca */}
      {isEditingOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        >
          <div className="modal-box max-w-md w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border-color)]">
              <h3 className="font-bold text-base text-[var(--text-primary)]">
                {editingMarca ? "Editar Marca y Logo" : "Nueva Marca de Vehículo"}
              </h3>
              <button
                onClick={() => setIsEditingOpen(false)}
                className="btn-ghost btn-icon p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveMarca} className="space-y-4 text-xs">
              <div>
                <label className="label mb-1 block">Nombre de la Marca *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Chevrolet, Toyota..."
                  value={nombreForm}
                  onChange={(e) => setNombreForm(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>

              <div>
                <label className="label mb-1 block">Logo de la Marca</label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                    {logoUrlForm ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrlForm}
                        alt="Preview logo"
                        className="max-w-full max-h-full object-contain p-1"
                      />
                    ) : (
                      <ImageIcon size={24} className="text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <label className="btn-secondary btn-sm flex items-center justify-center gap-1.5 cursor-pointer text-xs w-full">
                      {uploadingLogo ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      <span>{logoUrlForm ? "Cambiar Imagen..." : "Subir Imagen..."}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoFileUpload}
                        disabled={uploadingLogo}
                        className="hidden"
                      />
                    </label>

                    {logoUrlForm && (
                      <button
                        type="button"
                        onClick={() => setLogoUrlForm("")}
                        className="text-[11px] text-red-500 hover:underline block w-full text-center"
                      >
                        Quitar logo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="popEcuador"
                  checked={popularidadForm}
                  onChange={(e) => setPopularidadForm(e.target.checked)}
                  className="rounded border-[var(--border-color)] text-[var(--accent-primary)]"
                />
                <label htmlFor="popEcuador" className="text-xs text-[var(--text-primary)] cursor-pointer">
                  Marca de popularidad alta en Ecuador
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setIsEditingOpen(false)}
                  className="btn-ghost btn-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingMarca || uploadingLogo}
                  className="btn-primary btn-sm flex items-center gap-1"
                >
                  {savingMarca ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
