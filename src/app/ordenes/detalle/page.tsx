"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import VistaOrdenDetalle from "@/components/ordenes/VistaOrdenDetalle";

function OrdenDetalleContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");

  useEffect(() => {
    if (!id) router.replace("/ordenes");
  }, [id, router]);

  if (!id) return null;

  return (
    <AppShell hideHeader>
      <VistaOrdenDetalle ordenId={id} />
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
