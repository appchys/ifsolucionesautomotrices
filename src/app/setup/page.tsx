"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Wrench, Loader2, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import VehicleViewImagesManager from "@/components/setup/VehicleViewImagesManager";

export default function SetupPage() {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"usuario" | "imagenes">("usuario");
  const [form, setForm] = useState({
    displayName: "Administrador IF",
    email: "admin@ifsolucionesautomotrices.com",
    password: "Admin2024!",
    role: "admin" as const,
  });
  const router = useRouter();

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await addDoc(collection(db, "usuarios"), {
        uid: cred.user.uid,
        email: form.email,
        displayName: form.displayName,
        role: form.role,
        activo: true,
        createdAt: serverTimestamp(),
      });
      setDone(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err: any) {
      setError(err.message ?? "Error al crear usuario");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="text-center">
          <CheckCircle2 size={64} className="mx-auto mb-4" style={{ color: "var(--success)" }} />
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            ¡Sistema configurado!
          </h1>
          <p style={{ color: "var(--text-muted)" }}>Redirigiendo al dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "radial-gradient(ellipse at 60% 0%, rgba(37,99,235,0.15) 0%, var(--bg-primary) 60%)" }}
    >
      <div style={{ width: "100%", maxWidth: "600px" }} className="animate-fade-in">
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse-glow"
            style={{ background: "var(--accent)", width: "64px", height: "64px", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Wrench size={30} className="text-white" />
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)" }}>
            Configuración Inicial
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "6px" }}>
            Configura tu sistema de gestión automotriz
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[var(--border)]">
          <button
            type="button"
            onClick={() => setActiveTab("usuario")}
            className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 ${
              activeTab === "usuario"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Wrench size={16} className="inline mr-2" />
            Usuario Admin
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
            <ImageIcon size={16} className="inline mr-2" />
            Imágenes de Vistas
          </button>
        </div>

        {/* Contenido */}
        {activeTab === "usuario" ? (
          <div className="card">
            <form onSubmit={handleSetup} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="label">Nombre completo</label>
                <input
                  className="input"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="label">Email de administrador</label>
                <input
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="label">Contraseña</label>
                <input
                  type="password"
                  className="input"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  minLength={6}
                  required
                />
              </div>
              <div className="form-group">
                <label className="label">Rol</label>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })}>
                  <option value="admin">Administrador</option>
                  <option value="recepcion">Recepción</option>
                  <option value="tecnico">Técnico</option>
                  <option value="contador">Contador</option>
                </select>
              </div>

              {error && (
                <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", fontSize: "13px", color: "#f87171" }}>
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary btn-lg" disabled={loading}
                style={{ justifyContent: "center", marginTop: "4px" }}>
                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                {loading ? "Creando usuario..." : "Crear Administrador"}
              </button>
            </form>

            <p style={{ textAlign: "center", fontSize: "11px", color: "var(--text-muted)", marginTop: "16px" }}>
              ⚠️ Esta página solo debe usarse una vez. Elimina o protege <code>/setup</code> después de configurar el sistema.
            </p>
          </div>
        ) : (
          <div className="card">
            <VehicleViewImagesManager />
          </div>
        )}
      </div>
    </div>
  );
}
