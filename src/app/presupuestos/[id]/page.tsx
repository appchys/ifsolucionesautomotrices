import VistaPresupuesto from "@/components/recepcion/VistaPresupuesto";

export default async function PresupuestoPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <VistaPresupuesto presupuestoId={resolvedParams.id} />;
}
