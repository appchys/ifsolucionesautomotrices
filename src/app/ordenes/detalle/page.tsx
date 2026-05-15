"use client";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import OrdenDetalleSidebar from "@/components/ordenes/OrdenDetalleSidebar";

function OrdenDetalleContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id") || "";

  if (!id) {
    router.push("/ordenes");
    return null;
  }

  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[60vh] opacity-20">
        <div className="spinner mb-4" />
        <p>Cargando detalles de la orden...</p>
      </div>
      
      <OrdenDetalleSidebar 
        ordenId={id} 
        onClose={() => router.push("/ordenes")} 
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
