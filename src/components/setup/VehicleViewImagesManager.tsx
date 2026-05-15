"use client";
import { useState, useEffect } from "react";
import { VistaConfigurable, ConfiguracionVista } from "@/types";
import { uploadVistaImage, deleteVistaImageFile, getVehiculos, updateVehiculo, getConfiguracionVistas, saveConfiguracionVistas } from "@/lib/services";
import { Upload, Trash2, Loader2, CheckCircle2, AlertCircle, Edit2, Check, X, Plus } from "lucide-react";
import { toast } from "react-hot-toast";

const VISTAS_DISPONIBLES: { id: VistaConfigurable; label: string }[] = [
  { id: "superior", label: "Superior" },
  { id: "izquierda", label: "Izquierda" },
  { id: "derecha", label: "Derecha" },
  { id: "trasera", label: "Trasera" },
];

const TIPOS_VEHICULO_PRESETS = [
  { tipo: "suv", label: "SUV" },
  { tipo: "camioneta", label: "Camioneta" },
  { tipo: "sedan", label: "Sedán" },
  { tipo: "pickup", label: "Compacto" },
];

export default function VehicleViewImagesManager() {
  const [activeTab, setActiveTab] = useState<"config" | "imagenes">("config");
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [config, setConfig] = useState<ConfiguracionVista[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [tempVistasList, setTempVistasList] = useState<VistaConfigurable[]>([]);

  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [loadedVehiculos, setLoadedVehiculos] = useState(false);
  const [selectedVehiculo, setSelectedVehiculo] = useState<string | null>(null);
  const [uploadingVista, setUploadingVista] = useState<VistaConfigurable | null>(null);

  // Cargar configuración de vistas
  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoadingConfig(true);
      const cfg = await getConfiguracionVistas();
      if (cfg && cfg.length > 0) {
        setConfig(cfg);
      }
    } catch (error) {
      toast.error("Error al cargar configuración");
    } finally {
      setLoadingConfig(false);
    }
  };

  const loadVehiculos = async () => {
    try {
      const v = await getVehiculos();
      setVehiculos(v);
      setLoadedVehiculos(true);
    } catch (error) {
      toast.error("Error al cargar vehículos");
    }
  };

  const saveConfiguration = async () => {
    try {
      await saveConfiguracionVistas(config);
      toast.success("Configuración guardada");
      setEditingIndex(null);
    } catch (error) {
      toast.error("Error al guardar configuración");
    }
  };

  const startEditView = (index: number) => {
    setEditingIndex(index);
    setTempVistasList([...config[index].vistas]);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setTempVistasList([]);
  };

  const toggleVista = (vista: VistaConfigurable) => {
    setTempVistasList((prev) =>
      prev.includes(vista) ? prev.filter((v) => v !== vista) : [...prev, vista]
    );
  };

  const saveEdit = () => {
    if (editingIndex !== null && tempVistasList.length > 0) {
      const updatedConfig = [...config];
      updatedConfig[editingIndex] = {
        ...updatedConfig[editingIndex],
        vistas: tempVistasList,
      };
      setConfig(updatedConfig);
      setEditingIndex(null);
      setTempVistasList([]);
    }
  };

  const addNewConfig = (tipoVehiculo: string) => {
    const exists = config.find((c) => c.tipoVehiculo === tipoVehiculo);
    if (exists) {
      toast.error(`${tipoVehiculo} ya está configurado`);
      return;
    }
    const newConfig: ConfiguracionVista = {
      tipoVehiculo: tipoVehiculo as any,
      vistas: ["superior", "izquierda", "derecha", "trasera"],
      descripcion: `Configuración para ${tipoVehiculo}`,
    };
    setConfig([...config, newConfig]);
  };

  const deleteConfig = (index: number) => {
    setConfig((prev) => prev.filter((_, i) => i !== index));
  };

  const selectedVehiculoData = vehiculos.find((v) => v.id === selectedVehiculo);
  const selectedVehiculoType = selectedVehiculoData?.tipoVehiculo;
  const vistasPorTipo = config.find((c) => c.tipoVehiculo === selectedVehiculoType)?.vistas || [];

  const handleImageUpload = async (vista: VistaConfigurable, file: File) => {
    if (!selectedVehiculo) {
      toast.error("Selecciona un vehículo");
      return;
    }

    setUploadingVista(vista);
    try {
      const previousUrl = selectedVehiculoData?.imagenesVistas?.find(
        (img: any) => img.vista === vista
      )?.url;

      const newUrl = await uploadVistaImage(selectedVehiculo, vista, file, previousUrl);

      const currentImages = selectedVehiculoData?.imagenesVistas || [];
      const updatedImages = currentImages.filter((img: any) => img.vista !== vista);
      updatedImages.push({
        vista,
        url: newUrl,
        uploadedAt: new Date(),
      });

      await updateVehiculo(selectedVehiculo, {
        imagenesVistas: updatedImages,
      });

      setVehiculos((prev) =>
        prev.map((v) =>
          v.id === selectedVehiculo
            ? { ...v, imagenesVistas: updatedImages }
            : v
        )
      );

      toast.success(`Imagen de vista ${vista} subida`);
    } catch (error: any) {
      if (error.message === "INVALID_IMAGE_TYPE") {
        toast.error("Formato de imagen inválido. Usa PNG, JPEG o WebP");
      } else if (error.message === "IMAGE_TOO_LARGE") {
        toast.error("Imagen demasiado grande (máx 5 MB)");
      } else {
        toast.error("Error al subir imagen");
      }
    } finally {
      setUploadingVista(null);
    }
  };

  const handleImageDelete = async (vista: VistaConfigurable) => {
    if (!selectedVehiculo || !selectedVehiculoData) return;

    try {
      const image = selectedVehiculoData.imagenesVistas?.find(
        (img: any) => img.vista === vista
      );
      if (!image) return;

      await deleteVistaImageFile(image.url);

      const updatedImages = selectedVehiculoData.imagenesVistas.filter(
        (img: any) => img.vista !== vista
      );
      await updateVehiculo(selectedVehiculo, {
        imagenesVistas: updatedImages,
      });

      setVehiculos((prev) =>
        prev.map((v) =>
          v.id === selectedVehiculo
            ? { ...v, imagenesVistas: updatedImages }
            : v
        )
      );

      toast.success("Imagen eliminada");
    } catch (error) {
      toast.error("Error al eliminar imagen");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
          Administrador de Imágenes de Vistas
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
          Configura tipos de vehículos y carga imágenes para inspecciones visuales
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => setActiveTab("config")}
          className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 ${
            activeTab === "config"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          Configuración de Vistas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("imagenes")}
          className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 ${
            activeTab === "imagenes"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          Subir Imágenes
        </button>
      </div>

      {/* TAB 1: Configuración */}
      {activeTab === "config" && (
        <div className="space-y-4">
          {loadingConfig ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            <>
              {/* Configuraciones existentes */}
              {config.length > 0 && (
                <div className="space-y-3">
                  {config.map((cfg, idx) => (
                    <div key={idx} className="card p-4 border-l-4" style={{ borderLeftColor: "var(--accent)" }}>
                      {editingIndex === idx ? (
                        <div className="space-y-3">
                          <h4 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                            {cfg.tipoVehiculo.toUpperCase()}
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {VISTAS_DISPONIBLES.map((vista) => (
                              <label key={vista.id} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={tempVistasList.includes(vista.id)}
                                  onChange={() => toggleVista(vista.id)}
                                  className="w-4 h-4"
                                />
                                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                                  {vista.label}
                                </span>
                              </label>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={saveEdit}
                              className="btn-primary btn-sm flex items-center gap-2"
                            >
                              <Check size={14} /> Guardar
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="btn-secondary btn-sm flex items-center gap-2"
                            >
                              <X size={14} /> Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                              {cfg.tipoVehiculo.toUpperCase()}
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {cfg.vistas.map((vista) => (
                                <span
                                  key={vista}
                                  className="px-2 py-1 text-xs rounded-md"
                                  style={{
                                    background: "var(--bg-secondary)",
                                    color: "var(--text-secondary)",
                                  }}
                                >
                                  {vista}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditView(idx)}
                              className="btn-ghost btn-sm"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteConfig(idx)}
                              className="btn-ghost btn-sm text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Agregar nuevas configuraciones */}
              <div className="card">
                <h4 className="font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                  Agregar Tipo de Vehículo
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {TIPOS_VEHICULO_PRESETS.map((tipo) => {
                    const exists = config.find((c) => c.tipoVehiculo === tipo.tipo);
                    return (
                      <button
                        key={tipo.tipo}
                        type="button"
                        onClick={() => addNewConfig(tipo.tipo)}
                        disabled={!!exists}
                        className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                          exists
                            ? "opacity-50 cursor-not-allowed"
                            : "btn-secondary hover:btn-primary"
                        }`}
                      >
                        <Plus size={14} className="inline mr-1" />
                        {tipo.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Guardar cambios */}
              {config.length > 0 && (
                <button
                  type="button"
                  onClick={saveConfiguration}
                  className="btn-primary w-full justify-center"
                >
                  <Check size={16} className="mr-2" />
                  Guardar Configuración
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: Subir Imágenes */}
      {activeTab === "imagenes" && (
        <div className="space-y-4">
          {/* Selector de Vehículo */}
          <div className="card">
            <h4 className="font-semibold text-sm mb-3" style={{ color: "var(--text-primary)" }}>
              Seleccionar Vehículo
            </h4>
            {!loadedVehiculos ? (
              <button
                type="button"
                onClick={loadVehiculos}
                className="btn-primary btn-sm"
              >
                Cargar Vehículos
              </button>
            ) : vehiculos.length === 0 ? (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "8px",
                  background: "rgba(59, 130, 246, 0.1)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  fontSize: "13px",
                  color: "var(--accent)",
                  textAlign: "center",
                }}
              >
                <AlertCircle size={16} className="inline mr-2" />
                No hay vehículos cargados.
              </div>
            ) : (
              <select
                value={selectedVehiculo || ""}
                onChange={(e) => setSelectedVehiculo(e.target.value || null)}
                className="input text-sm"
              >
                <option value="">-- Selecciona un vehículo --</option>
                {vehiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.placa} - {v.marca} {v.modelo} ({v.tipoVehiculo.toUpperCase()})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Grid de Vistas */}
          {selectedVehiculoData && vistasPorTipo.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vistasPorTipo.map((vista) => {
                const imagen = selectedVehiculoData.imagenesVistas?.find(
                  (img: any) => img.vista === vista
                );
                const isUploading = uploadingVista === vista;

                return (
                  <div
                    key={vista}
                    className="card p-4 border-2"
                    style={{
                      borderColor: imagen ? "var(--success)" : "var(--border)",
                    }}
                  >
                    {/* Encabezado */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h5 className="font-semibold text-sm capitalize" style={{ color: "var(--text-primary)" }}>
                          Vista {vista}
                        </h5>
                      </div>
                      {imagen && (
                        <CheckCircle2
                          size={20}
                          style={{ color: "var(--success)" }}
                        />
                      )}
                    </div>

                    {/* Imagen o Placeholder */}
                    {imagen ? (
                      <div className="mb-3 relative group">
                        <img
                          src={imagen.url}
                          alt={`Vista ${vista}`}
                          className="w-full h-40 object-cover rounded-lg border border-[var(--border)]"
                        />
                        <div
                          className="absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                          onClick={() => window.open(imagen.url, "_blank")}
                        >
                          <span style={{ color: "white", fontSize: "12px" }}>Ver en grande</span>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="w-full h-40 rounded-lg border-2 border-dashed flex items-center justify-center mb-3"
                        style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
                      >
                        <div className="text-center">
                          <Upload size={24} style={{ color: "var(--text-muted)", margin: "0 auto 4px" }} />
                          <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                            Sin imagen
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Botones */}
                    <div className="flex gap-2">
                      <label className="flex-1 cursor-pointer">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleImageUpload(vista, file);
                            }
                          }}
                          className="hidden"
                          disabled={isUploading}
                        />
                        <div className="btn-primary btn-sm flex items-center justify-center">
                          {isUploading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <>
                              <Upload size={14} />
                              {imagen ? "Cambiar" : "Subir"}
                            </>
                          )}
                        </div>
                      </label>
                      {imagen && (
                        <button
                          type="button"
                          onClick={() => handleImageDelete(vista)}
                          className="btn-secondary btn-sm flex items-center justify-center"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Estado */}
          {selectedVehiculoData && vistasPorTipo.length > 0 && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{
                background: "var(--bg-secondary)",
                borderLeft: "3px solid var(--accent)",
                color: "var(--text-primary)",
              }}
            >
              Vehículo: <strong>{selectedVehiculoData.placa}</strong> ({selectedVehiculoData.tipoVehiculo.toUpperCase()}) |
              Imágenes cargadas: <strong>{selectedVehiculoData.imagenesVistas?.filter((img: any) => vistasPorTipo.includes(img.vista)).length || 0} / {vistasPorTipo.length}</strong>
            </div>
          )}

          {selectedVehiculoData && vistasPorTipo.length === 0 && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                fontSize: "13px",
                color: "#f87171",
                textAlign: "center",
              }}
            >
              <AlertCircle size={16} className="inline mr-2" />
              No hay vistas configuradas para este tipo de vehículo ({selectedVehiculoData.tipoVehiculo.toUpperCase()})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
