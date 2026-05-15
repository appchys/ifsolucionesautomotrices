"use client";
import { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import { Plus, Package, Wrench, Edit2, Trash2, Loader2, Image as ImageIcon, X, Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import {
  getProductos, getServicios, createProducto, updateProducto, deleteProducto,
  createServicio, updateServicio, deleteServicio, uploadInventarioImagen
} from "@/lib/services";
import { Producto, Servicio } from "@/types";

type Tab = "productos" | "servicios";

function Modal({ isOpen, onClose, title, children }: any) {
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-all duration-200 ${isOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"}`}>
      <div className={`bg-[var(--bg-card)] rounded-xl shadow-2xl max-w-lg w-full p-6 relative transition-transform duration-200 ${isOpen ? "scale-100" : "scale-95"} max-h-[90vh] overflow-y-auto`}>
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <X size={20} />
        </button>
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function InventarioPage() {
  const [tab, setTab] = useState<Tab>("productos");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [cargando, setCargando] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [itemEditando, setItemEditando] = useState<Producto | Servicio | null>(null);
  const [guardando, setGuardando] = useState(false);
  
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [archivoImagen, setArchivoImagen] = useState<File | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [prods, servs] = await Promise.all([getProductos(), getServicios()]);
      setProductos(prods);
      setServicios(servs);
    } catch (error) {
      toast.error("Error al cargar datos");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const abrirModalNuevo = () => {
    setItemEditando(null);
    setImagenPreview(null);
    setArchivoImagen(null);
    reset({
      nombre: "", descripcion: "", precioBase: 0, costoBase: 0, aplicaIva: true, sku: ""
    });
    setModalOpen(true);
  };

  const abrirModalEditar = (item: Producto | Servicio) => {
    setItemEditando(item);
    setImagenPreview(item.imagenUrl || null);
    setArchivoImagen(null);
    reset({
      ...item
    });
    setModalOpen(true);
  };

  const handleImagenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setArchivoImagen(file);
      setImagenPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: any) => {
    setGuardando(true);
    try {
      let finalImageUrl = itemEditando?.imagenUrl || "";

      const payload: any = {
        nombre: data.nombre,
        descripcion: data.descripcion,
        precioBase: Number(data.precioBase),
        costoBase: Number(data.costoBase),
        aplicaIva: Boolean(data.aplicaIva),
        imagenUrl: finalImageUrl,
      };

      if (tab === "productos") {
        payload.sku = data.sku;
        
        let savedId = itemEditando?.id;
        if (savedId) {
          await updateProducto(savedId, payload);
        } else {
          savedId = await createProducto(payload);
        }

        if (archivoImagen && savedId) {
          finalImageUrl = await uploadInventarioImagen(savedId, archivoImagen, "producto");
          await updateProducto(savedId, { imagenUrl: finalImageUrl });
        }
      } else {
        let savedId = itemEditando?.id;
        if (savedId) {
          await updateServicio(savedId, payload);
        } else {
          savedId = await createServicio(payload);
        }

        if (archivoImagen && savedId) {
          finalImageUrl = await uploadInventarioImagen(savedId, archivoImagen, "servicio");
          await updateServicio(savedId, { imagenUrl: finalImageUrl });
        }
      }

      toast.success(`${tab === "productos" ? "Producto" : "Servicio"} guardado`);
      setModalOpen(false);
      cargarDatos();
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarItem = async (id: string, isProduct: boolean) => {
    if (!confirm(`¿Estás seguro de eliminar este ${isProduct ? "producto" : "servicio"}?`)) return;
    try {
      if (isProduct) await deleteProducto(id);
      else await deleteServicio(id);
      toast.success("Eliminado correctamente");
      cargarDatos();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  return (
    <AppShell>
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Productos y Servicios</h1>
          <p className="page-subtitle">Gestiona tu inventario y catálogo de servicios</p>
        </div>
        <button onClick={abrirModalNuevo} className="btn-primary">
          <Plus size={18} /> Nuevo {tab === "productos" ? "Producto" : "Servicio"}
        </button>
      </div>

      <div className="flex border-b border-[var(--border)] mb-6">
        <button
          className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
            tab === "productos" ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
          onClick={() => setTab("productos")}
        >
          <div className="flex items-center gap-2">
            <Package size={16} /> Productos
          </div>
        </button>
        <button
          className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
            tab === "servicios" ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
          onClick={() => setTab("servicios")}
        >
          <div className="flex items-center gap-2">
            <Wrench size={16} /> Servicios
          </div>
        </button>
      </div>

      <div className="card">
        {cargando ? (
          <div className="flex justify-center p-8">
            <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-sm">
                  <th className="pb-3 px-4 font-semibold">Imagen</th>
                  {tab === "productos" && <th className="pb-3 px-4 font-semibold">SKU</th>}
                  <th className="pb-3 px-4 font-semibold">Nombre</th>
                  <th className="pb-3 px-4 font-semibold">Costo Base</th>
                  <th className="pb-3 px-4 font-semibold">Precio Base</th>
                  <th className="pb-3 px-4 font-semibold">IVA</th>
                  <th className="pb-3 px-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(tab === "productos" ? productos : servicios).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[var(--text-muted)]">
                      No hay {tab} registrados.
                    </td>
                  </tr>
                ) : (
                  (tab === "productos" ? productos : servicios).map((item: any) => (
                    <tr key={item.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-body)] transition-colors">
                      <td className="py-3 px-4">
                        {item.imagenUrl ? (
                          <img src={item.imagenUrl} alt={item.nombre} className="w-10 h-10 object-cover rounded-md bg-[var(--bg-card)] border border-[var(--border)]" />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-[var(--bg-body)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)]">
                            <ImageIcon size={16} />
                          </div>
                        )}
                      </td>
                      {tab === "productos" && <td className="py-3 px-4 font-mono text-sm">{item.sku}</td>}
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[var(--text-primary)]">{item.nombre}</p>
                        <p className="text-xs text-[var(--text-muted)] line-clamp-1">{item.descripcion}</p>
                      </td>
                      <td className="py-3 px-4 font-mono">${Number(item.costoBase).toFixed(2)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[var(--text-primary)]">${Number(item.precioBase).toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${item.aplicaIva ? 'bg-[rgba(16,185,129,0.1)] text-emerald-500' : 'bg-[var(--bg-body)] text-[var(--text-muted)]'}`}>
                          {item.aplicaIva ? 'Con IVA' : 'Sin IVA'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => abrirModalEditar(item)} className="p-2 rounded-lg bg-[var(--bg-body)] hover:bg-[var(--bg-hover)] text-[var(--accent)] transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => eliminarItem(item.id, tab === "productos")} className="p-2 rounded-lg bg-[var(--bg-body)] hover:bg-red-500 hover:text-white text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={itemEditando ? `Editar ${tab === "productos" ? "Producto" : "Servicio"}` : `Nuevo ${tab === "productos" ? "Producto" : "Servicio"}`}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-20 h-20 rounded-xl bg-[var(--bg-body)] border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center text-[var(--text-muted)] overflow-hidden flex-shrink-0 relative">
              {imagenPreview ? (
                <img src={imagenPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={24} />
              )}
              <input type="file" accept="image/*" onChange={handleImagenChange} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            <div className="text-sm text-[var(--text-muted)]">
              <p className="font-semibold text-[var(--text-primary)]">Imagen del {tab === "productos" ? "producto" : "servicio"}</p>
              <p>Haz clic para subir una imagen (opcional)</p>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Nombre *</label>
            <input className={`input ${errors.nombre ? "border-red-500" : ""}`} {...register("nombre", { required: true })} />
          </div>
          
          <div className="form-group">
            <label className="label">Descripción</label>
            <textarea className="input resize-none" rows={2} {...register("descripcion")} />
          </div>

          {tab === "productos" && (
            <div className="form-group">
              <label className="label">SKU *</label>
              <input className={`input uppercase font-mono ${errors.sku ? "border-red-500" : ""}`} {...register("sku", { required: tab === "productos" })} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label">Costo Base *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">$</span>
                <input type="number" step="0.01" className={`input pl-8 ${errors.costoBase ? "border-red-500" : ""}`} {...register("costoBase", { required: true, min: 0 })} />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Precio Base *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">$</span>
                <input type="number" step="0.01" className={`input pl-8 ${errors.precioBase ? "border-red-500" : ""}`} {...register("precioBase", { required: true, min: 0 })} />
              </div>
            </div>
          </div>

          <div className="form-group mt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)]" {...register("aplicaIva")} />
              <span className="text-sm font-medium text-[var(--text-primary)]">Aplica IVA (15%)</span>
            </label>
          </div>

          <button type="submit" disabled={guardando} className="btn-primary w-full mt-6 justify-center">
            {guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </Modal>
    </AppShell>
  );
}
