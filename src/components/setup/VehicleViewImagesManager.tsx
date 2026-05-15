"use client";
import { useState } from "react";
import { VistaVehiculo, ImagenVista } from "@/types";
import { uploadVistaImage, deleteVistaImageFile, getVehiculos, updateVehiculo } from "@/lib/services";
import { Upload, Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";

const VISTAS: { id: VistaVehiculo; label: string; description: string }[] = [
  { id: "superior", label: "Vista Superior", description: "Vista aérea/cenital del vehículo" },
  { id: "frontal", label: "Vista Frontal", description: "Frente del vehículo" },
  { id: "lateral_derecha", label: "Lateral Derecha", description: "Costado derecho" },
  { id: "lateral_izquierda", label: "Lateral Izquierda", description: "Costado izquierdo" },
  { id: "trasera", label: "Vista Trasera", description: "Parte trasera del vehículo" },
  { id: "interior", label: "Interior", description: "Interior del vehículo" },
];

export default function VehicleViewImagesManager() {
  const [loading, setLoading] = useState(false);
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [loadedVehiculos, setLoadedVehiculos] = useState(false);
  const [selectedVehiculo, setSelectedVehiculo] = useState<string | null>(null);
  const [uploadingVista, setUploadingVista] = useState<VistaVehiculo | null>(null);

  // Cargar vehículos disponibles
  const loadVehiculos = async () => {
    try {
      const v = await getVehiculos();
      setVehiculos(v);
      setLoadedVehiculos(true);
    } catch (error) {
      toast.error("Error al cargar vehículos");
    }
  };

  const selectedVehiculoData = vehiculos.find((v) => v.id === selectedVehiculo);

  const handleImageUpload = async (vista: VistaVehiculo, file: File) => {
    if (!selectedVehiculo) {
      toast.error("Selecciona un vehículo");
      return;
    }

    setUploadingVista(vista);
    try {
      const previousUrl = selectedVehiculoData?.imagenesVistas?.find(
        (img: ImagenVista) => img.vista === vista
      )?.url;

      const newUrl = await uploadVistaImage(selectedVehiculo, vista, file, previousUrl);

      // Actualizar el vehículo
      const currentImages = selectedVehiculoData?.imagenesVistas || [];
      const updatedImages = currentImages.filter((img: ImagenVista) => img.vista !== vista);
      updatedImages.push({
        vista,
        url: newUrl,
        uploadedAt: new Date(),
      });

      await updateVehiculo(selectedVehiculo, {
        imagenesVistas: updatedImages,
      });

      // Actualizar el estado local
      setVehiculos((prev) =>
        prev.map((v) =>
          v.id === selectedVehiculo
            ? { ...v, imagenesVistas: updatedImages }
            : v
        )
      );

      toast.success(`Imagen de ${VISTAS.find((v) => v.id === vista)?.label} subida`);
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

  const handleImageDelete = async (vista: VistaVehiculo) => {
    if (!selectedVehiculo || !selectedVehiculoData) return;

    try {
      const image = selectedVehiculoData.imagenesVistas?.find(
        (img: ImagenVista) => img.vista === vista
      );
      if (!image) return;

      await deleteVistaImageFile(image.url);

      const updatedImages = selectedVehiculoData.imagenesVistas.filter(
        (img: ImagenVista) => img.vista !== vista
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
          Carga imágenes para cada vista del vehículo que se usarán en inspecciones visuales
        </p>
      </div>

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
            No hay vehículos cargados. Crea vehículos desde la recepción.
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
                {v.placa} - {v.marca} {v.modelo} ({v.anio})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Grid de Vistas */}
      {selectedVehiculoData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {VISTAS.map((vista) => {
            const imagen = selectedVehiculoData.imagenesVistas?.find(
              (img: ImagenVista) => img.vista === vista.id
            );
            const isUploading = uploadingVista === vista.id;

            return (
              <div
                key={vista.id}
                className="card p-4 border-2"
                style={{
                  borderColor: imagen ? "var(--success)" : "var(--border)",
                }}
              >
                {/* Encabezado */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h5 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                      {vista.label}
                    </h5>
                    <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                      {vista.description}
                    </p>
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
                      alt={vista.label}
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
                          handleImageUpload(vista.id, file);
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
                      onClick={() => handleImageDelete(vista.id)}
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
      {selectedVehiculoData && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{
            background: "var(--bg-secondary)",
            borderLeft: "3px solid var(--accent)",
            color: "var(--text-primary)",
          }}
        >
          Vehículo: <strong>{selectedVehiculoData.placa}</strong> |
          Imágenes cargadas: <strong>{selectedVehiculoData.imagenesVistas?.length || 0} / 6</strong>
        </div>
      )}
    </div>
  );
}
