import { Document, Page, Text, View, StyleSheet, Image, Svg, Rect, Path } from "@react-pdf/renderer";
import { OrdenTrabajo, Cliente, Vehiculo, DatosTaller } from "@/types";

// Registro de fuentes estándar de react-pdf (Helvetica es por defecto y funciona sin carga externa)
const styles = StyleSheet.create({
  page: {
    paddingTop: 45,
    paddingBottom: 110, // Dejar espacio suficiente para el footer de firmas absoluto
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: "column",
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f172a",
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 10,
    color: "#64748b",
    marginBottom: 1,
  },
  dateText: {
    fontSize: 10,
    color: "#64748b",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    maxWidth: "50%",
  },
  workshopInfo: {
    textAlign: "right",
    marginRight: 8,
  },
  workshopName: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 3,
  },
  workshopDetail: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 1,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    objectFit: "cover",
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
  },
  mainDivider: {
    borderBottomWidth: 2,
    borderBottomColor: "#0f172a",
    marginBottom: 18,
    marginTop: 5,
  },
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    marginTop: 14,
    paddingTop: 8,
  },
  twoColSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  column: {
    width: "48%",
  },
  sectionLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  boldText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 9,
    color: "#334155",
    marginBottom: 2,
  },
  badgeContainer: {
    flexDirection: "row",
    marginTop: 2,
    marginBottom: 4,
  },
  badge: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#1e293b",
    textTransform: "uppercase",
  },
  motivoTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 2,
  },
  bodyText: {
    fontSize: 9,
    color: "#334155",
    lineHeight: 1.3,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 2,
  },
  gridItem: {
    width: "33.33%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  gridItemText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0f172a",
  },
  estadoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  estadoCol: {
    width: "48%",
    flexDirection: "row",
  },
  estadoLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#334155",
  },
  estadoValue: {
    fontSize: 9,
    color: "#334155",
  },
  signatureContainer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureCol: {
    width: "45%",
    alignItems: "center",
  },
  signatureImageContainer: {
    height: 40,
    justifyContent: "flex-end",
    alignItems: "center",
    width: "100%",
  },
  signatureImage: {
    width: 100,
    height: 35,
    objectFit: "contain",
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    width: "100%",
    paddingTop: 5,
    alignItems: "center",
  },
  signatureLabel: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 2,
  },
  signatureName: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0f172a",
    textAlign: "center",
  },
});

const CheckedBox = () => (
  <Svg width="10" height="10" viewBox="0 0 12 12" style={{ marginRight: 6 }}>
    <Rect x="0.5" y="0.5" width="11" height="11" rx="2" ry="2" fill="#eff6ff" stroke="#2563eb" strokeWidth="1" />
    <Path d="M3.5 6L5 7.5L8.5 4" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);

const formatFecha = (timestamp: any) => {
  if (!timestamp) return "";
  let date: Date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (timestamp && typeof timestamp.toDate === "function") {
    date = timestamp.toDate();
  } else if (timestamp && typeof timestamp.seconds === "number") {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }
  
  if (isNaN(date.getTime())) return "";

  const mesesEs = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${date.getDate()} ${mesesEs[date.getMonth()]} ${date.getFullYear()}`;
};

interface ComprobanteIngresoPDFProps {
  orden: OrdenTrabajo;
  cliente: Cliente;
  vehiculo: Vehiculo;
  taller: DatosTaller | null;
  tecnicoName: string;
}

export default function ComprobanteIngresoPDF({
  orden,
  cliente,
  vehiculo,
  taller,
  tecnicoName,
}: ComprobanteIngresoPDFProps) {
  const numIngreso = String(orden.numeroIngreso ?? orden.numero ?? 0).padStart(5, "0");
  const dateFormatted = formatFecha(orden.createdAt);
  
  // Filtrar el checklist para mostrar sólo los elementos marcados (checked)
  const checkedItems = (orden.checklistInventario || []).filter((item) => item.checked);

  const clienteName = `${cliente.nombre} ${cliente.apellido}`.trim();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>COMPROBANTE DE INGRESO</Text>
            <Text style={styles.subtitle}>#ING-{numIngreso}</Text>
            <Text style={styles.dateText}>{dateFormatted}</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.workshopInfo}>
              <Text style={styles.workshopName}>
                {taller?.razonSocial || "I.F. SOLUCIONES AUTOMOTRICES"}
              </Text>
              <Text style={styles.workshopDetail}>
                {taller?.ruc || "593988731879"}
              </Text>
              <Text style={styles.workshopDetail}>
                {taller?.email || "i.f.solucionesautomotrices@outlook.com"}
              </Text>
              <Text style={styles.workshopDetail}>
                {taller?.direccion || "Leonidas Garcia"}
              </Text>
            </View>
            {taller?.logoUrl ? (
              <Image src={taller.logoUrl} style={styles.logo} />
            ) : (
              <View style={styles.logoPlaceholder} />
            )}
          </View>
        </View>

        {/* Divider Principal */}
        <View style={styles.mainDivider} />

        {/* Cliente y Vehículo */}
        <View style={styles.twoColSection}>
          {/* Columna Cliente */}
          <View style={styles.column}>
            <Text style={styles.sectionLabel}>Cliente</Text>
            <Text style={styles.boldText}>{clienteName}</Text>
            <Text style={styles.infoText}>Tel: {cliente.telefono || "—"}</Text>
            <Text style={styles.infoText}>{cliente.email || "—"}</Text>
          </View>

          {/* Columna Vehículo */}
          <View style={styles.column}>
            <Text style={styles.sectionLabel}>Vehículo</Text>
            <Text style={styles.boldText}>
              {vehiculo.marca} {vehiculo.modelo} {vehiculo.anio}
            </Text>
            <View style={styles.badgeContainer}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{vehiculo.placa}</Text>
              </View>
            </View>
            <Text style={styles.infoText}>Color: {vehiculo.color || "—"}</Text>
            <Text style={styles.infoText}>Chasis: {vehiculo.vin || "—"}</Text>
          </View>
        </View>

        {/* Motivo de Ingreso */}
        <View style={styles.sectionDivider}>
          <Text style={styles.sectionLabel}>Motivo de Ingreso</Text>
          <Text style={styles.motivoTitle}>{orden.tipoServicio || "Diagnóstico"}</Text>
          <Text style={styles.bodyText}>{orden.motivo || "Motivo de ingreso al taller"}</Text>
        </View>

        {/* Observaciones */}
        <View style={styles.sectionDivider}>
          <Text style={styles.sectionLabel}>Observaciones</Text>
          <Text style={styles.bodyText}>{orden.notasInternas || "Observaciones adicionales"}</Text>
        </View>

        {/* Inventario */}
        <View style={styles.sectionDivider}>
          <Text style={styles.sectionLabel}>Inventario</Text>
          {checkedItems.length > 0 ? (
            <View style={styles.gridContainer}>
              {checkedItems.map((item, idx) => (
                <View key={idx} style={styles.gridItem}>
                  <CheckedBox />
                  <Text style={styles.gridItemText}>{item.label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.bodyText, { fontStyle: "italic", color: "#64748b" }]}>
              Sin inventario registrado
            </Text>
          )}
        </View>

        {/* Estado del Vehículo */}
        <View style={styles.sectionDivider}>
          <Text style={styles.sectionLabel}>Estado del Vehículo</Text>
          <View style={styles.estadoContainer}>
            <View style={styles.estadoCol}>
              <Text style={styles.estadoLabel}>Combustible: </Text>
              <Text style={styles.estadoValue}>{orden.nivelCombustible || "1/2"}</Text>
            </View>
            <View style={styles.estadoCol}>
              <Text style={styles.estadoLabel}>Kilometraje: </Text>
              <Text style={styles.estadoValue}>
                {orden.kilometrajeIngreso ? Number(orden.kilometrajeIngreso).toLocaleString("es-EC") : "0"} km
              </Text>
            </View>
          </View>
        </View>

        {/* Firmas al pie de la página */}
        <View style={styles.signatureContainer}>
          {/* Firma del técnico */}
          <View style={styles.signatureCol}>
            <View style={styles.signatureImageContainer} />
            <View style={styles.signatureLine}>
              <Text style={styles.signatureLabel}>Firma del técnico</Text>
              <Text style={styles.signatureName}>{tecnicoName}</Text>
            </View>
          </View>

          {/* Firma del cliente */}
          <View style={styles.signatureCol}>
            <View style={styles.signatureImageContainer}>
              {orden.firmaClienteUrl ? (
                <Image src={orden.firmaClienteUrl} style={styles.signatureImage} />
              ) : null}
            </View>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureLabel}>Firma del cliente</Text>
              <Text style={styles.signatureName}>{clienteName}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
