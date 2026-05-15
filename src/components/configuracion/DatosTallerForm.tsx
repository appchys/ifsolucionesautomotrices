"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Wrench, Loader2, Save, ImageIcon, Upload, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import type { DatosTaller } from "@/types";
import {
  getDatosTaller,
  saveDatosTaller,
  DATOS_TALLER_DEFAULT,
  uploadTallerLogo,
  deleteTallerLogoFile,
} from "@/lib/services";

const LOGO_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

export default function DatosTallerForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<DatosTaller>({ defaultValues: DATOS_TALLER_DEFAULT });

  const logoUrl = useWatch({ control, name: "logoUrl" }) ?? "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await getDatosTaller();
        if (!cancelled) reset(d);
      } catch {
        if (!cancelled) toast.error("No se pudieron cargar los datos del taller");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reset]);

  const onSubmit = async (values: DatosTaller) => {
    setSaving(true);
    try {
      await saveDatosTaller(values);
      toast.success("Datos del taller guardados");
      reset(values);
    } catch {
      toast.error("Error al guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setLogoBusy(true);
    try {
      const prev = getValues("logoUrl");
      const url = await uploadTallerLogo(file, prev || undefined);
      setValue("logoUrl", url, { shouldDirty: true });
      await saveDatosTaller({ ...getValues(), logoUrl: url });
      toast.success("Logo subido correctamente");
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : "";
      if (code === "INVALID_LOGO_TYPE") {
        toast.error("Formato no válido. Usa PNG, JPG, WebP o SVG.");
      } else if (code === "LOGO_TOO_LARGE") {
        toast.error("El archivo supera 2 MB.");
      } else {
        toast.error("No se pudo subir el logo. Revisa permisos de Storage.");
      }
    } finally {
      setLogoBusy(false);
    }
  };

  const handleRemoveLogo = async () => {
    const url = getValues("logoUrl").trim();
    if (!url) return;
    setLogoBusy(true);
    try {
      await deleteTallerLogoFile(url);
      setValue("logoUrl", "", { shouldDirty: true });
      await saveDatosTaller({ ...getValues(), logoUrl: "" });
      toast.success("Logo eliminado");
    } catch {
      toast.error("No se pudo eliminar el logo.");
    } finally {
      setLogoBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="stat-icon flex-shrink-0" style={{ background: "rgba(37,99,235,0.12)" }}>
            <Wrench size={22} style={{ color: "#2563eb" }} />
          </div>
          <div>
            <h2 className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
              Datos del Taller
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Razón social, identificación, contacto y logo. Podrás reutilizarlos en documentos y mensajes al cliente.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-14">
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5">
          <input type="hidden" {...register("logoUrl")} />

          <div className="form-group sm:col-span-2">
            <span className="label">Logo del taller</span>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              PNG, JPG, WebP o SVG. Tamaño máximo 2 MB. Se guarda en Firebase Storage al elegir el archivo.
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <div
                className="w-[120px] h-[120px] rounded-xl border flex items-center justify-center overflow-hidden flex-shrink-0"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg-secondary)",
                }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo del taller" className="max-w-full max-h-full object-contain p-2" />
                ) : (
                  <ImageIcon size={40} style={{ color: "var(--text-muted)", opacity: 0.35 }} />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept={LOGO_ACCEPT}
                  className="sr-only"
                  onChange={handleLogoPick}
                  disabled={logoBusy}
                />
                <button
                  type="button"
                  className="btn-secondary btn-sm inline-flex items-center gap-2 w-fit"
                  disabled={logoBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  {logoBusy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  {logoUrl ? "Cambiar logo" : "Subir logo"}
                </button>
                {logoUrl ? (
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-left w-fit inline-flex items-center gap-2"
                    style={{ color: "var(--danger)" }}
                    disabled={logoBusy}
                    onClick={handleRemoveLogo}
                  >
                    <Trash2 size={16} />
                    Quitar logo
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="form-group sm:col-span-2">
            <label className="label" htmlFor="razonSocial">
              Razón social o nombre comercial
            </label>
            <input
              id="razonSocial"
              className="input"
              placeholder="Ej. I.F. Soluciones Automotrices Cía. Ltda."
              {...register("razonSocial", { required: "Indica la razón social" })}
            />
            {errors.razonSocial && (
              <span className="text-xs text-red-500">{errors.razonSocial.message}</span>
            )}
          </div>

          <div className="form-group">
            <label className="label" htmlFor="ruc">
              RUC / Cédula / Identificación
            </label>
            <input
              id="ruc"
              className="input font-mono"
              placeholder="Ej. 1792345678001"
              {...register("ruc", { required: "Indica el RUC o identificación" })}
            />
            {errors.ruc && <span className="text-xs text-red-500">{errors.ruc.message}</span>}
          </div>

          <div className="form-group">
            <label className="label" htmlFor="telefono">
              Teléfono de contacto
            </label>
            <input
              id="telefono"
              className="input"
              placeholder="Ej. +593 99 123 4567"
              {...register("telefono", { required: "Indica un teléfono" })}
            />
            {errors.telefono && (
              <span className="text-xs text-red-500">{errors.telefono.message}</span>
            )}
          </div>

          <div className="form-group sm:col-span-2">
            <label className="label" htmlFor="email">
              Correo del taller <span className="font-normal" style={{ color: "var(--text-muted)" }}>(opcional)</span>
            </label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="contacto@taller.com"
              {...register("email")}
            />
          </div>

          <div className="form-group sm:col-span-2">
            <label className="label" htmlFor="direccion">
              Dirección
            </label>
            <textarea
              id="direccion"
              className="input min-h-[100px]"
              placeholder="Calle, número, ciudad, referencia..."
              rows={4}
              {...register("direccion", { required: "Indica la dirección del taller" })}
            />
            {errors.direccion && (
              <span className="text-xs text-red-500">{errors.direccion.message}</span>
            )}
          </div>

          <div className="sm:col-span-2 flex flex-wrap gap-3 justify-end pt-1">
            <button type="submit" className="btn-primary" disabled={saving || logoBusy}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
