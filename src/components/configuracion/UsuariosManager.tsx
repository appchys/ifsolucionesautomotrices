"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw, Save, Shield, X, UserCheck, UserX } from "lucide-react";
import { toast } from "react-hot-toast";
import type { AppUser, UserRole } from "@/types";
import { createAuthUser } from "@/lib/firebase";
import { createUsuarioDB, getUsuarios, updateUsuario } from "@/lib/services";

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "recepcion", label: "Recepción" },
  { value: "tecnico", label: "Técnico" },
  { value: "contador", label: "Contador" },
  { value: "asesor_servicio", label: "Asesor de servicio" },
  { value: "logistica", label: "Logística" },
];

type UsuarioForm = {
  displayName: string;
  email: string;
  password: string;
  role: UserRole;
  activo: boolean;
};

const EMPTY_FORM: UsuarioForm = {
  displayName: "",
  email: "",
  password: "",
  role: "tecnico",
  activo: true,
};

function roleLabel(role: UserRole): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

export default function UsuariosManager() {
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<UsuarioForm>(EMPTY_FORM);

  const usuariosOrdenados = useMemo(
    () =>
      [...usuarios].sort((a, b) =>
        (a.displayName || a.email).localeCompare(b.displayName || b.email, "es")
      ),
    [usuarios]
  );

  const loadUsuarios = async () => {
    setLoading(true);
    try {
      setUsuarios(await getUsuarios());
    } catch {
      toast.error("No se pudieron cargar los usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    getUsuarios()
      .then((data) => {
        if (!cancelled) setUsuarios(data);
      })
      .catch(() => {
        if (!cancelled) toast.error("No se pudieron cargar los usuarios");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    const displayName = form.displayName.trim();
    const password = form.password.trim();

    if (!email || !displayName || !password) {
      toast.error("Completa nombre, email y contraseña");
      return;
    }

    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (usuarios.some((usuario) => usuario.email.toLowerCase() === email)) {
      toast.error("Ya existe un usuario con ese email");
      return;
    }

    setCreating(true);
    try {
      const uid = await createAuthUser(email, password);
      await createUsuarioDB(uid, {
        email,
        displayName,
        role: form.role,
        activo: form.activo,
      });
      toast.success("Usuario guardado");
      setForm(EMPTY_FORM);
      setShowCreateModal(false);
      await loadUsuarios();
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : "";
      if (code.includes("auth/email-already-in-use")) {
        toast.error("Ese email ya existe en Firebase Auth");
      } else {
        toast.error("No se pudo crear el usuario");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (usuario: AppUser, data: Partial<Pick<AppUser, "role" | "activo">>) => {
    setSavingUid(usuario.uid);
    try {
      await updateUsuario(usuario.uid, data);
      setUsuarios((current) =>
        current.map((item) => (item.uid === usuario.uid ? { ...item, ...data } : item))
      );
      toast.success("Usuario actualizado");
    } catch {
      toast.error("No se pudo actualizar el usuario");
    } finally {
      setSavingUid(null);
    }
  };

  return (
    <div className="card">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="stat-icon flex-shrink-0" style={{ background: "rgba(16,185,129,0.12)" }}>
            <Shield size={22} style={{ color: "#10b981" }} />
          </div>
          <div>
            <h2 className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
              Gestión de Usuarios
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Perfiles guardados en la colección usuarios, roles y estado de acceso.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            Crear usuario
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={loadUsuarios} disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Actualizar
          </button>
        </div>
      </div>

      {showCreateModal ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crearUsuarioTitle"
          onClick={() => {
            if (!creating) {
              setForm(EMPTY_FORM);
              setShowCreateModal(false);
            }
          }}
        >
          <form
            onSubmit={handleCreate}
            className="modal-box"
            style={{ maxWidth: "720px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3
                  id="crearUsuarioTitle"
                  className="font-semibold text-lg"
                  style={{ color: "var(--text-primary)" }}
                >
                  Crear usuario
                </h3>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                  El acceso se crea en Firebase Auth y el perfil se guarda en usuarios.
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost btn-icon"
                disabled={creating}
                aria-label="Cerrar modal"
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setShowCreateModal(false);
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label" htmlFor="usuarioNombre">
                  Nombre
                </label>
                <input
                  id="usuarioNombre"
                  className="input"
                  value={form.displayName}
                  onChange={(e) => setForm((current) => ({ ...current, displayName: e.target.value }))}
                  placeholder="Juan Pérez"
                  required
                />
              </div>
              <div className="form-group">
                <label className="label" htmlFor="usuarioEmail">
                  Email
                </label>
                <input
                  id="usuarioEmail"
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                  placeholder="juan@gmail.com"
                  required
                />
              </div>
              <div className="form-group">
                <label className="label" htmlFor="usuarioPassword">
                  Contraseña
                </label>
                <input
                  id="usuarioPassword"
                  type="password"
                  className="input"
                  value={form.password}
                  onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                  minLength={6}
                  required
                />
              </div>
              <div className="form-group">
                <label className="label" htmlFor="usuarioRol">
                  Rol
                </label>
                <select
                  id="usuarioRol"
                  className="input"
                  value={form.role}
                  onChange={(e) => setForm((current) => ({ ...current, role: e.target.value as UserRole }))}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <label
                className="flex items-center gap-2 min-h-[42px] text-sm sm:col-span-2"
                style={{ color: "var(--text-secondary)" }}
              >
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((current) => ({ ...current, activo: e.target.checked }))}
                />
                Activo
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-3 mt-6">
              <button
                type="button"
                className="btn-secondary"
                disabled={creating}
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setShowCreateModal(false);
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Guardar usuario
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>
                  <div className="flex justify-center py-8">
                    <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
                  </div>
                </td>
              </tr>
            ) : usuariosOrdenados.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center">
                  No hay usuarios registrados.
                </td>
              </tr>
            ) : (
              usuariosOrdenados.map((usuario) => {
                const saving = savingUid === usuario.uid;
                return (
                  <tr key={usuario.id ?? usuario.uid}>
                    <td>
                      <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {usuario.displayName || "Sin nombre"}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {usuario.email}
                      </div>
                    </td>
                    <td>
                      <select
                        className="input text-sm"
                        value={usuario.role}
                        disabled={saving}
                        onChange={(e) => handleUpdate(usuario, { role: e.target.value as UserRole })}
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={usuario.activo ? "badge badge-green" : "badge badge-gray"}>
                        {usuario.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={saving}
                          onClick={() => handleUpdate(usuario, { activo: !usuario.activo })}
                        >
                          {saving ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : usuario.activo ? (
                            <UserX size={16} />
                          ) : (
                            <UserCheck size={16} />
                          )}
                          {usuario.activo ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          disabled={saving}
                          onClick={() => handleUpdate(usuario, { role: usuario.role })}
                          title={`Guardar rol ${roleLabel(usuario.role)}`}
                        >
                          <Save size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
