"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthStore } from "@/store";
import { getUsuarioByUid } from "@/lib/services";
import toast from "react-hot-toast";

function promiseWithTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let authStateResolved = false;
    const authInitTimeout = setTimeout(() => {
      if (authStateResolved) return;

      const msg =
        "Tiempo de espera agotado al inicializar Firebase Auth. Si estas entrando desde la IP local, agrega 192.168.10.60 a los dominios autorizados de Firebase Authentication.";
      console.error("Timeout en onAuthStateChanged:", msg);
      setInitError(msg);
      toast.error("No se pudo inicializar autenticacion.");
      setUser(null);
      setLoading(false);
    }, 8000);

    const unsub = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        authStateResolved = true;
        clearTimeout(authInitTimeout);

        try {
          if (firebaseUser) {
            const appUser = await promiseWithTimeout(
              getUsuarioByUid(firebaseUser.uid),
              6000,
              "Tiempo de espera agotado al consultar base de datos (Firestore). Verifica tu conexion a Internet en el celular."
            );

            if (appUser?.activo) {
              setUser(appUser);
            } else {
              setUser(null);
              await signOut(auth);
            }
          } else {
            setUser(null);
          }
        } catch (error: unknown) {
          const msg = getErrorMessage(error);
          console.error("Error en AuthProvider:", error);
          setInitError(msg);
          toast.error("Error al iniciar sesion: " + msg);
          setUser(null);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        authStateResolved = true;
        clearTimeout(authInitTimeout);

        const msg = getErrorMessage(error);
        console.error("Error en onAuthStateChanged:", error);
        setInitError(msg);
        toast.error("Error de autenticacion: " + msg);
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(authInitTimeout);
      unsub();
    };
  }, [setUser, setLoading]);

  return (
    <>
      {initError && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            left: "20px",
            right: "20px",
            background: "#fee2e2",
            color: "#991b1b",
            border: "1px solid #fca5a5",
            padding: "16px",
            borderRadius: "12px",
            zIndex: 99999,
            fontSize: "14px",
            textAlign: "left",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
            Error de conexion / inicializacion
          </div>
          <div style={{ opacity: 0.9, wordBreak: "break-word" }}>
            {initError}
          </div>
          <div style={{ fontSize: "11px", marginTop: "8px", opacity: 0.7 }}>
            Asegurate de que tu celular tiene conexion a internet y puede comunicarse con Firebase.
          </div>
        </div>
      )}
      {children}
    </>
  );
}
