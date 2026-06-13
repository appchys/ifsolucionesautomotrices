import { useState, useRef } from "react";
import { X, Save, Eye, AlertCircle, Camera, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import DamageSelector, { TIPO_CONFIG, VISTAS } from "./DamageSelector";
import { DanoVehiculo, Vehiculo, VehiculoVista, FotoDiagnostico } from "@/types";
import { useUIStore } from "@/store";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  vehiculo: Vehiculo;
  danos: DanoVehiculo[];
  onChangeDanos: (danos: DanoVehiculo[]) => void;
  onSave: () => void;
  fotos: FotoDiagnostico[];
  onUploadFoto: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onUpdateFoto: (url: string, descripcion: string) => void;
  onRemoveFoto: (index: number) => void;
  observaciones: string;
  onChangeObservaciones: (val: string) => void;
}

export default function ModalInspeccion({
  isOpen,
  onClose,
  vehiculo,
  danos,
  onChangeDanos,
  onSave,
  fotos,
  onUploadFoto,
  onUpdateFoto,
  onRemoveFoto,
  observaciones,
  onChangeObservaciones,
}: Props) {
  const { sidebarOpen } = useUIStore();
  const fotosRef = useRef<HTMLInputElement>(null);
  const [fotoEditandoUrl, setFotoEditandoUrl] = useState<string | null>(null);
  const [descripcionDraft, setDescripcionDraft] = useState("");
  const [fotoModalIndex, setFotoModalIndex] = useState<number>(-1);

  const editarDescripcionFoto = (url: string, descripcionActual: string) => {
    setDescripcionDraft(descripcionActual || "");
    setFotoEditandoUrl(url);
  };

  const guardarDescripcionFoto = (url: string) => {
    onUpdateFoto(url, descripcionDraft.trim());
    setFotoEditandoUrl(null);
  };

  if (!isOpen) return null;

  const handleGuardar = () => {
    onSave();
    onClose();
  };

  const removeDano = (id: string) => {
    onChangeDanos(danos.filter((d) => d.id !== id));
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 pt-[calc(var(--header-height)+1rem)] transition-all duration-300 ${
          sidebarOpen ? "lg:pl-[calc(var(--sidebar-width)+1rem)]" : ""
        }`}
      >
      <div className="bg-white dark:bg-[var(--bg-card)] rounded-2xl w-full max-w-5xl shadow-xl flex flex-col max-h-[90vh] lg:max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
              <Eye size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Inspección de ingreso</h2>
              <p className="text-xs text-[var(--text-muted)]">
                {danos.length} marcas · Toca el esquema para agregar
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleGuardar} className="btn-primary flex items-center gap-2">
              <Save size={16} /> Guardar
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          
          {/* Left Column: Damage Selector */}
          <div className="flex-1 p-4 lg:p-6 overflow-y-auto custom-scrollbar border-b lg:border-b-0 lg:border-r border-[var(--border)] bg-slate-50/50 dark:bg-transparent">
            <DamageSelector 
              danos={danos} 
              onChange={onChangeDanos} 
              tipoVehiculo={vehiculo.tipoVehiculo} 
            />
          </div>

          {/* Right Column: Information */}
          <div className="w-full lg:w-[320px] p-4 lg:p-6 bg-slate-50 dark:bg-[var(--bg-secondary)] overflow-y-auto custom-scrollbar flex flex-col gap-6 shrink-0">
            <div>
              <h3 className="font-bold text-sm flex items-center justify-between mb-3">
                <span>Daños registrados ({danos.length})</span>
              </h3>
              {danos.length === 0 ? (
                <div className="border border-dashed border-[var(--border)] rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2 bg-white dark:bg-[var(--bg-card)]">
                  <span className="font-semibold text-sm">Sin marcas aún</span>
                  <span className="text-xs text-[var(--text-muted)]">Toca el esquema del vehículo para agregar</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const grouped = new Map<VehiculoVista, DanoVehiculo[]>();
                    for (const d of danos) {
                      const v = d.vista ?? "superior";
                      if (!grouped.has(v)) grouped.set(v, []);
                      grouped.get(v)!.push(d);
                    }
                    return VISTAS.filter((v) => grouped.has(v.value)).map((vista) => {
                      const items = grouped.get(vista.value)!;
                      return (
                        <div key={vista.value}>
                          <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                            {vista.label}
                          </p>
                          <div className="space-y-1">
                            {items.map((d) => {
                              const cfg = TIPO_CONFIG[d.tipo as keyof typeof TIPO_CONFIG];
                              return (
                                <div
                                  key={d.id}
                                  className="flex items-center justify-between px-3 py-2 rounded-lg"
                                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full" style={{ background: cfg?.color || "#ccc" }} />
                                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                                      {cfg?.label || "Otro"}{d.descripcion ? `: ${d.descripcion}` : ""}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeDano(d.id)}
                                    className="btn-ghost btn-icon p-1"
                                    style={{ color: "var(--danger)" }}
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">Fotos</h3>
                <button 
                  type="button" 
                  className="btn btn-sm bg-white border border-[var(--border)] text-[var(--text-primary)]"
                  onClick={() => fotosRef.current?.click()}
                >
                  <Camera size={14} className="mr-1" /> Agregar
                </button>
              </div>
              <input
                ref={fotosRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={onUploadFoto}
              />
              {fotos.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                  {fotos.map((foto, index) => (
                    <div key={foto.url} className="relative w-32 h-32 shrink-0 rounded-lg overflow-hidden group border border-[var(--border)] shadow-sm">
                      <button
                        type="button"
                        className="w-full h-full"
                        onClick={() => setFotoModalIndex(index)}
                      >
                        <img src={foto.url} alt={foto.descripcion || "Foto del diagnostico"} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      </button>
                      
                      {foto.descripcion ? (
                        <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[10px] p-1.5 text-center truncate pointer-events-none" title={foto.descripcion}>
                          {foto.descripcion}
                        </div>
                      ) : null}

                      <button
                        type="button"
                        className="absolute top-1.5 left-1.5 bg-black/50 hover:bg-black/80 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Editar descripcion"
                        onClick={() => editarDescripcionFoto(foto.url, foto.descripcion || "")}
                      >
                        <Pencil size={13} />
                      </button>

                      <button
                        type="button"
                        className="absolute top-1.5 right-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Quitar foto"
                        onClick={() => onRemoveFoto(index)}
                      >
                        <X size={13} />
                      </button>

                      {fotoEditandoUrl === foto.url ? (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-2 z-10">
                          <input
                            className="input text-xs w-full mb-2 bg-white text-black"
                            value={descripcionDraft}
                            onChange={(event) => setDescripcionDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                guardarDescripcionFoto(foto.url);
                              }
                            }}
                            autoFocus
                            placeholder="Descripción"
                          />
                          <div className="flex gap-2 w-full">
                            <button
                              type="button"
                              className="btn-secondary btn-icon flex-1 bg-white"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => setFotoEditandoUrl(null)}
                            >
                              <X size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn-primary btn-icon flex-1"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => guardarDescripcionFoto(foto.url)}
                            >
                              <Save size={13} />
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-[var(--border)] rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2 bg-white dark:bg-[var(--bg-card)]">
                  <span className="text-xs text-[var(--text-muted)]">Añade fotos desde aquí</span>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-bold text-sm mb-3">Observaciones</h3>
              <textarea 
                className="input w-full min-h-[100px] bg-white text-sm" 
                placeholder="Observaciones generales de la inspección..."
                value={observaciones}
                onChange={(e) => onChangeObservaciones(e.target.value)}
              />
            </div>
          </div>
          
        </div>
        
        {/* Footer */}
        <div className="p-3 border-t border-[var(--border)] bg-white dark:bg-[var(--bg-card)] text-center shrink-0">
          <p className="text-xs text-[var(--text-muted)]">
            Haz click en el esquema para marcar un detalle · Click en una marca para seleccionarla
          </p>
        </div>

      </div>
    </div>

      {fotoModalIndex >= 0 && fotos[fotoModalIndex] ? (
        <div className="fixed inset-0 bg-black/80 z-[1050] flex items-center justify-center" onClick={() => setFotoModalIndex(-1)}>
          <div className="relative w-full max-w-5xl p-4 flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-4 right-4 bg-black/50 text-white rounded-full p-2 hover:bg-black/70" onClick={() => setFotoModalIndex(-1)}>
              <X size={24} />
            </button>
            
            <div className="flex items-center gap-4">
              <button 
                className="bg-black/50 text-white rounded-full p-2 hover:bg-black/70 disabled:opacity-30" 
                onClick={() => setFotoModalIndex(prev => Math.max(0, prev - 1))}
                disabled={fotoModalIndex === 0}
              >
                <ChevronLeft size={32} />
              </button>
              <img src={fotos[fotoModalIndex].url} alt={fotos[fotoModalIndex].descripcion || "Foto ampliada"} className="max-h-[85vh] max-w-[80vw] object-contain rounded-lg" />
              <button 
                className="bg-black/50 text-white rounded-full p-2 hover:bg-black/70 disabled:opacity-30" 
                onClick={() => setFotoModalIndex(prev => Math.min(fotos.length - 1, prev + 1))}
                disabled={fotoModalIndex === fotos.length - 1}
              >
                <ChevronRight size={32} />
              </button>
            </div>
            {fotos[fotoModalIndex].descripcion ? (
              <div className="mt-4 bg-black/60 text-white px-4 py-2 rounded-lg text-sm max-w-3xl text-center">
                {fotos[fotoModalIndex].descripcion}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
