"use client";
import { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Wrench, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store";
import { getDatosTaller } from "@/lib/services";
import type { DatosTaller } from "@/types";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [datosTaller, setDatosTaller] = useState<DatosTaller | null>(null);
  const { user, loading: authLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    getDatosTaller().then(setDatosTaller).catch(console.error);
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("¡Bienvenido!");
      router.replace("/dashboard");
    } catch (err: any) {
      const msg =
        err.code === "auth/invalid-credential"
          ? "Credenciales incorrectas"
          : "Error al iniciar sesión";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "radial-gradient(ellipse at 60% 0%, rgba(37,99,235,0.15) 0%, var(--bg-primary) 60%)",
      }}
    >
      {/* Decorative blobs */}
      <div
        className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle, #2563eb, transparent)" }}
      />
      <div
        className="absolute bottom-[-80px] left-[-80px] w-[300px] h-[300px] rounded-full opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle, #7c3aed, transparent)" }}
      />

      <div className="w-full max-w-md animate-fade-in">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse-glow overflow-hidden"
            style={{ 
              background: datosTaller?.logoUrl ? "transparent" : "var(--accent)",
              boxShadow: datosTaller?.logoUrl ? "none" : "0 0 12px var(--accent-alpha)"
            }}
          >
            {datosTaller?.logoUrl ? (
              <img src={datosTaller.logoUrl} alt="Logo Taller" className="w-full h-full object-contain" />
            ) : (
              <Wrench size={40} className="text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {datosTaller?.razonSocial || "I.F. Soluciones Automotrices"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Sistema de gestión de taller
          </p>
        </div>

        {/* Card */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-5" style={{ color: "var(--text-primary)" }}>
            Iniciar Sesión
          </h2>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="form-group">
              <label className="label">Correo electrónico</label>
              <input
                type="email"
                className="input"
                placeholder="usuario@taller.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="label">Contraseña</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary btn-lg w-full justify-center mt-2"
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : null}
              {loading ? "Iniciando sesión..." : "Ingresar al sistema"}
            </button>
          </form>
        </div>


      </div>
    </div>
  );
}
