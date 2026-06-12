"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import NuevaOrdenSidebar from "@/components/recepcion/NuevaOrdenSidebar";

function OrdenDetalleContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");

  useEffect(() => {
    if (!id) router.replace("/ordenes");
  }, [id, router]);

  if (!id) return null;

  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[60vh] opacity-20">
        <div className="spinner mb-4" />
        <p>Cargando orden...</p>
      </div>
      
      <NuevaOrdenSidebar
        ordenId={id} 
        onClose={() => router.replace("/ordenes")} 
        onSuccess={() => router.replace("/ordenes")}
      />
    </AppShell>
  );
}

export default function OrdenDetallePage() {
  return (
    <Suspense fallback={<div className="flex justify-center pt-20"><div className="spinner" /></div>}>
      <OrdenDetalleContent />
    </Suspense>
  );
}
