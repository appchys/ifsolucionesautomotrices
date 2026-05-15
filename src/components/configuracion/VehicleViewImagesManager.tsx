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
} from "@/lib/services";

const VISTAS: { label: string; value: VehiculoVista }[] = [
  { label: "Superior", value: "superior" },
  { label: "Izquierda", value: "izquierda" },
  { label: "Derecha", value: "derecha" },
  { label: "Delantera", value: "delantera" },
  { label: "Trasera", value: "trasera" },
];

const TIPOS_VEHICULO: { label: string; value: TipoVehiculo }[] = [
  { label: "SUV", value: "suv" },
  { label: "Camioneta", value: "camioneta" },
  { label: "Sedán", value: "sedan" },
  { label: "Compacto", value: "pickup" },
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
  const [selectedVehicleType, setSelectedVehicleType] = useState<TipoVehiculo>("suv");
  const [config, setConfig] = useState<LocalConfig>({
    tipoVehiculo: "suv",
    imagenes: [],
  });
  const fileRefs = useRef<Record<VehiculoVista, HTMLInputElement | null>>({
    superior: null,
    izquierda: null,
    derecha: null,
    delantera: null,
    trasera: null,
  });

  // Cargar configuración al cambiar el tipo de vehículo
  useEffect(() => {
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

      <div className="mb-6">
        <label className="label" htmlFor="vehicleType">
          Tipo de vehículo
        </label>
        <select
          id="vehicleType"
          className="input"
          value={selectedVehicleType}
          onChange={(e) => setSelectedVehicleType(e.target.value as TipoVehiculo)}
        >
          {TIPOS_VEHICULO.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          PNG, JPG o WebP. Tamaño máximo 5 MB. Se guardan en Firebase Storage.
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
