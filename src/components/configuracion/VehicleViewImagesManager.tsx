"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, Trash2, ImageIcon, Car } from "lucide-react";
import { toast } from "react-hot-toast";
import type { TipoVehiculo, VehiculoVista, VehicleViewImagesConfig, VehicleViewImage } from "@/types";
import {
  getVehicleViewImages,
  uploadVehicleViewImage,
  deleteVehicleViewImage,
  saveVehicleViewImagesConfig,
  getTiposVehiculo,
  saveTiposVehiculo
} from "@/lib/services";

const VISTAS: { label: string; value: VehiculoVista }[] = [
  { label: "Superior", value: "superior" },
  { label: "Izquierda", value: "izquierda" },
  { label: "Derecha", value: "derecha" },
  { label: "Delantera", value: "delantera" },
  { label: "Trasera", value: "trasera" },
];



const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

interface VehicleViewImageWithFile extends VehicleViewImage {
  loading?: boolean;
}

interface LocalConfig {
  tipoVehiculo: TipoVehiculo;
  imagenes: VehicleViewImageWithFile[];
}

export default function VehicleViewImagesManager() {
  const [loading, setLoading] = useState(true);
  const [tiposVehiculo, setTiposVehiculo] = useState<string[]>([]);
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>("");
  const [newType, setNewType] = useState("");
  const [config, setConfig] = useState<LocalConfig>({
    tipoVehiculo: "",
    imagenes: [],
  });
  const fileRefs = useRef<Record<VehiculoVista, HTMLInputElement | null>>({
    superior: null,
    izquierda: null,
    derecha: null,
    delantera: null,
    trasera: null,
  });

  useEffect(() => {
    (async () => {
      const tipos = await getTiposVehiculo();
      setTiposVehiculo(tipos);
      if (tipos.length > 0) {
        setSelectedVehicleType(tipos[0]);
      } else {
        setLoading(false);
      }
    })();
  }, []);

  // Cargar configuración al cambiar el tipo de vehículo
  useEffect(() => {
    if (!selectedVehicleType) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getVehicleViewImages(selectedVehicleType);
        if (!cancelled) {
          if (data) {
            setConfig(data as LocalConfig);
          } else {
            // Inicializar con todas las vistas vacías
            const imagenes: VehicleViewImageWithFile[] = VISTAS.map((v) => ({
              vista: v.value,
              imageUrl: "",
            }));
            setConfig({
              tipoVehiculo: selectedVehicleType,
              imagenes,
            });
          }
        }
      } catch {
        if (!cancelled) {
          toast.error("Error al cargar las imágenes");
          // Inicializar con vacías
          const imagenes: VehicleViewImageWithFile[] = VISTAS.map((v) => ({
            vista: v.value,
            imageUrl: "",
          }));
          setConfig({
            tipoVehiculo: selectedVehicleType,
            imagenes,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedVehicleType]);

  const getImageForVista = (vista: VehiculoVista): VehicleViewImageWithFile | undefined => {
    return config.imagenes.find((img) => img.vista === vista);
  };

  const updateImageUrl = (vista: VehiculoVista, imageUrl: string) => {
    setConfig((prev) => ({
      ...prev,
      imagenes: prev.imagenes.map((img) =>
        img.vista === vista ? { ...img, imageUrl } : img
      ),
    }));
  };

  const setImageLoading = (vista: VehiculoVista, loading: boolean) => {
    setConfig((prev) => ({
      ...prev,
      imagenes: prev.imagenes.map((img) =>
        img.vista === vista ? { ...img, loading } : img
      ),
    }));
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>, vista: VehiculoVista) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImageLoading(vista, true);
    try {
      const prev = getImageForVista(vista)?.imageUrl;
      const url = await uploadVehicleViewImage(selectedVehicleType, vista, file, prev || undefined);
      updateImageUrl(vista, url);
      toast.success(`Imagen ${vista} subida correctamente`);

      // Guardar la configuración actualizada
      const updated: VehicleViewImagesConfig = {
        tipoVehiculo: config.tipoVehiculo,
        imagenes: config.imagenes.map((img) =>
          img.vista === vista ? { vista: img.vista, imageUrl: url } : { vista: img.vista, imageUrl: img.imageUrl }
        ),
      };
      await saveVehicleViewImagesConfig(updated);
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : "";
      if (code === "INVALID_IMAGE_TYPE") {
        toast.error("Formato no válido. Usa PNG, JPG o WebP.");
      } else if (code === "IMAGE_TOO_LARGE") {
        toast.error("El archivo supera 5 MB.");
      } else {
        toast.error("No se pudo subir la imagen. Intenta de nuevo.");
      }
    } finally {
      setImageLoading(vista, false);
    }
  };

  const handleRemoveImage = async (vista: VehiculoVista) => {
    const image = getImageForVista(vista);
    if (!image?.imageUrl) return;

    setImageLoading(vista, true);
    try {
      await deleteVehicleViewImage(image.imageUrl);
      updateImageUrl(vista, "");
      toast.success("Imagen eliminada");

      // Guardar la configuración actualizada
      const updated: VehicleViewImagesConfig = {
        tipoVehiculo: config.tipoVehiculo,
        imagenes: config.imagenes.map((img) =>
          img.vista === vista ? { vista: img.vista, imageUrl: "" } : { vista: img.vista, imageUrl: img.imageUrl }
        ),
      };
      await saveVehicleViewImagesConfig(updated);
    } catch {
      toast.error("No se pudo eliminar la imagen.");
    } finally {
      setImageLoading(vista, false);
    }
  };

  const handleAddType = async () => {
    const tipo = newType.trim().toLowerCase();
    if (!tipo) return;
    if (tiposVehiculo.includes(tipo)) {
      toast.error("Este tipo de vehículo ya existe");
      return;
    }
    const nuevosTipos = [...tiposVehiculo, tipo];
    setTiposVehiculo(nuevosTipos);
    setSelectedVehicleType(tipo);
    setNewType("");
    await saveTiposVehiculo(nuevosTipos);
    toast.success("Tipo de vehículo agregado");
  };

  const handleDeleteType = async () => {
    if (!selectedVehicleType) return;
    if (tiposVehiculo.length <= 1) {
      toast.error("Debe existir al menos un tipo de vehículo");
      return;
    }
    const confirmDelete = window.confirm(`¿Estás seguro de que deseas eliminar el tipo "${selectedVehicleType}"?`);
    if (!confirmDelete) return;

    const nuevosTipos = tiposVehiculo.filter(t => t !== selectedVehicleType);
    setTiposVehiculo(nuevosTipos);
    setSelectedVehicleType(nuevosTipos[0]);
    await saveTiposVehiculo(nuevosTipos);
    toast.success("Tipo de vehículo eliminado");
  };

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="stat-icon" style={{ background: "rgba(59,130,246,0.12)" }}>
            <Car size={22} style={{ color: "#3b82f6" }} />
          </div>
          <div>
            <h2 className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
              Imágenes de Vistas de Vehículos
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Administra imágenes para la inspección visual
            </p>
          </div>
        </div>
        <div className="flex justify-center py-14">
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="stat-icon" style={{ background: "rgba(59,130,246,0.12)" }}>
          <Car size={22} style={{ color: "#3b82f6" }} />
        </div>
        <div>
          <h2 className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
            Imágenes de Vistas de Vehículos
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Administra imágenes para la inspección visual de cada tipo de vehículo
          </p>
        </div>
      </div>

      <div className="mb-6 bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border)]">
        <label className="label mb-2 block" htmlFor="vehicleType">
          Administrar Tipos de Vehículo
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            id="vehicleType"
            className="input flex-1 max-w-xs capitalize"
            value={selectedVehicleType}
            onChange={(e) => setSelectedVehicleType(e.target.value)}
          >
            {tiposVehiculo.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button className="btn border border-[var(--border)] bg-white text-red-600 hover:bg-red-50" onClick={handleDeleteType}>
            <Trash2 size={16} className="mr-2" /> Eliminar actual
          </button>
          <div className="flex-1 max-w-xs flex items-center gap-2">
            <input 
              type="text" 
              className="input flex-1" 
              placeholder="Nuevo tipo..." 
              value={newType}
              onChange={e => setNewType(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddType()}
            />
            <button className="btn-primary" onClick={handleAddType}>Agregar</button>
          </div>
        </div>
        <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
          Crea o elimina tipos de vehículos. Cada tipo puede tener sus propias 5 vistas. (PNG, JPG o WebP. Tamaño máximo 5 MB)
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {VISTAS.map((vista) => {
          const image = getImageForVista(vista.value);
          const isBusy = image?.loading ?? false;

          return (
            <div
              key={vista.value}
              className="p-4 rounded-lg border"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-secondary)",
              }}
            >
              <div className="mb-3">
                <h3 className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                  Vista {vista.label}
                </h3>
              </div>

              <div
                className="w-full h-[180px] rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden mb-3"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg-tertiary)",
                }}
              >
                {image?.imageUrl ? (
                  <img
                    src={image.imageUrl}
                    alt={`Vista ${vista.label}`}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <ImageIcon size={40} style={{ color: "var(--text-muted)", opacity: 0.35 }} />
                )}
              </div>

              <div className="flex flex-col gap-2">
                <input
                  ref={(el) => {
                    if (el) fileRefs.current[vista.value] = el;
                  }}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  className="sr-only"
                  onChange={(e) => handleImagePick(e, vista.value)}
                  disabled={isBusy}
                />
                <button
                  type="button"
                  className="btn-secondary btn-sm inline-flex items-center justify-center gap-2 w-full"
                  disabled={isBusy}
                  onClick={() => fileRefs.current[vista.value]?.click()}
                >
                  {isBusy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  {image?.imageUrl ? "Cambiar" : "Subir"}
                </button>
                {image?.imageUrl ? (
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-left w-full inline-flex items-center justify-center gap-2"
                    style={{ color: "var(--danger)" }}
                    disabled={isBusy}
                    onClick={() => handleRemoveImage(vista.value)}
                  >
                    <Trash2 size={16} />
                    Quitar
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
