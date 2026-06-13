import VistaIngreso from "@/components/recepcion/VistaIngreso";

export default async function IngresoPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <VistaIngreso ingresoId={resolvedParams.id} />;
}
