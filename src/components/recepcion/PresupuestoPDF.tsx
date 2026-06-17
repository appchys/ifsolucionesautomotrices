import { Document, Page, Text, View, StyleSheet, Image, Svg, Rect, Path } from "@react-pdf/renderer";
import { OrdenTrabajo, Cliente, Vehiculo, ItemOrden, DatosTaller } from "@/types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 45,
    paddingBottom: 80,
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
    marginBottom: 8,
    marginTop: 5,
  },
  metaLine: {
    fontSize: 7.5,
    color: "#64748b",
    textAlign: "left",
    marginBottom: 15,
  },
  twoColSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  columnLeft: {
    width: "48%",
  },
  columnRight: {
    width: "48%",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  sectionLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 5,
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
  vehicleDetails: {
    flex: 1,
    flexDirection: "column",
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
  // Table styling
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    paddingVertical: 5,
    marginTop: 15,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 7,
    alignItems: "center",
  },
  subtotalRow: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#0f172a",
    borderTopWidth: 1.5,
    borderTopColor: "#0f172a",
    paddingVertical: 6,
    fontWeight: "bold",
  },
  colDesc: {
    width: "45%",
    textAlign: "left",
  },
  colSku: {
    width: "15%",
    textAlign: "center",
  },
  colPrice: {
    width: "15%",
    textAlign: "right",
  },
  colQty: {
    width: "10%",
    textAlign: "center",
  },
  colTotal: {
    width: "15%",
    textAlign: "right",
  },
  headerText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#64748b",
  },
  cellDesc: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#0f172a",
    textTransform: "uppercase",
  },
  cellSku: {
    fontSize: 8.5,
    color: "#64748b",
  },
  cellPrice: {
    fontSize: 8.5,
    color: "#334155",
  },
  cellQty: {
    fontSize: 8.5,
    color: "#334155",
  },
  cellTotal: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#0f172a",
  },
  subtotalLabelText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0f172a",
  },
  subtotalValueText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0f172a",
  },
  // Totals box styling
  totalsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 15,
  },
  totalsBox: {
    width: 200,
    spaceY: 4,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalLabel: {
    fontSize: 8.5,
    color: "#475569",
  },
  totalValue: {
    fontSize: 8.5,
    color: "#0f172a",
    textAlign: "right",
  },
  finalTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#94a3b8",
    paddingTop: 5,
    marginTop: 3,
  },
  finalTotalLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0f172a",
  },
  finalTotalValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0f172a",
    textAlign: "right",
  },
  condicionesSection: {
    marginTop: 25,
  },
  condicionesLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  condicionesText: {
    fontSize: 7.5,
    color: "#94a3b8",
    lineHeight: 1.3,
  },
});

const BrandLogo = ({ brand }: { brand: string }) => {
  const cleanBrand = brand.toLowerCase().trim();
  
  if (cleanBrand.includes("changan")) {
    return (
      <Svg width="30" height="30" viewBox="0 0 40 40" style={{ marginRight: 10, marginTop: 2 }}>
        <Rect x="0" y="0" width="40" height="40" rx="20" ry="20" fill="#0c4a6e" />
        <Rect x="3" y="3" width="34" height="34" rx="17" ry="17" fill="none" stroke="#e2e8f0" strokeWidth="1" />
        <Path d="M13 15 L20 28 L27 15 L24 15 L20 23 L16 15 Z" fill="#ffffff" />
      </Svg>
    );
  }
  
  if (cleanBrand.includes("chevrolet")) {
    return (
      <Svg width="30" height="30" viewBox="0 0 40 40" style={{ marginRight: 10, marginTop: 2 }}>
        <Rect x="0" y="0" width="40" height="40" rx="20" ry="20" fill="#b45309" />
        <Path d="M10 17 H15 V12 H25 V17 H30 L28 23 H25 V28 H15 V23 H10 Z" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (cleanBrand.includes("toyota")) {
    return (
      <Svg width="30" height="30" viewBox="0 0 40 40" style={{ marginRight: 10, marginTop: 2 }}>
        <Rect x="0" y="0" width="40" height="40" rx="20" ry="20" fill="#991b1b" />
        <Rect x="8" y="12" width="24" height="16" rx="8" ry="8" fill="none" stroke="#ffffff" strokeWidth="1.5" />
        <Rect x="13" y="12" width="14" height="16" rx="7" ry="8" fill="none" stroke="#ffffff" strokeWidth="1.5" />
        <Path d="M8 20 H32" stroke="#ffffff" strokeWidth="1.5" />
      </Svg>
    );
  }

  return (
    <Svg width="30" height="30" viewBox="0 0 40 40" style={{ marginRight: 10, marginTop: 2 }}>
      <Rect x="0" y="0" width="40" height="40" rx="20" ry="20" fill="#475569" />
      <Rect x="4" y="4" width="32" height="32" rx="16" ry="16" fill="none" stroke="#ffffff" strokeWidth="1.5" />
      <Path d="M20 4 V36 M4 20 H36" stroke="#ffffff" strokeWidth="1" />
      <Rect x="15" y="15" width="10" height="10" rx="5" ry="5" fill="#475569" stroke="#ffffff" strokeWidth="1" />
    </Svg>
  );
};

const formatFecha = (timestamp: any) => {
  if (!timestamp) return "";
  let date: Date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (timestamp && typeof timestamp.toDate === "function") {
    date = timestamp.toDate();
  } else if (timestamp && typeof timestamp.seconds === "number") {
    date = new Date(timestamp.seconds * 1000);
  } else if (timestamp && typeof timestamp.toMillis === "function") {
    date = new Date(timestamp.toMillis());
  } else {
    date = new Date(timestamp);
  }
  
  if (isNaN(date.getTime())) return "";

  const mesesEs = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${date.getDate()} ${mesesEs[date.getMonth()]} ${date.getFullYear()}`;
};

interface PresupuestoPDFProps {
  orden: OrdenTrabajo;
  cliente: Cliente;
  vehiculo: Vehiculo;
  items: ItemOrden[];
  taller: DatosTaller | null;
}

export default function PresupuestoPDF({
  orden,
  cliente,
  vehiculo,
  items,
  taller,
}: PresupuestoPDFProps) {
  const numPre = String(orden.numeroCotizacion || orden.numero || 0).padStart(4, "0");
  const dateFormatted = formatFecha(orden.createdAt);
  
  const clienteName = `${cliente.nombre} ${cliente.apellido}`.trim();

  // Cálculos de Totales
  const subtotal = items.reduce((acc, it) => acc + (it.precioUnitario * it.cantidad), 0);
  const iva = items.reduce((acc, it) => acc + ((it.precioUnitario * it.cantidad) * (it.impuestoAplicable / 100)), 0);
  const total = subtotal + iva;
  const manoDeObra = items
    .filter((it) => it.tipo === "servicio")
    .reduce((acc, it) => acc + (it.precioUnitario * it.cantidad), 0);

  const tallerRuc = taller?.ruc || "0927405092001";
  const tallerPhone = taller?.telefono || "593988731879";
  const tallerEmail = taller?.email || "i.f.solucionesautomotrices@outlook.com";
  const tallerName = taller?.razonSocial || "I.F. SOLUCIONES AUTOMOTRICES";
  const tallerAddress = taller?.direccion || "Leonidas Garcia";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>PRESUPUESTO</Text>
            <Text style={styles.subtitle}>#PRE-{numPre}</Text>
            <Text style={styles.dateText}>{dateFormatted}</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.workshopInfo}>
              <Text style={styles.workshopName}>{tallerName}</Text>
              <Text style={styles.workshopDetail}>RUC: {tallerRuc}</Text>
              <Text style={styles.workshopDetail}>{tallerPhone}</Text>
              <Text style={styles.workshopDetail}>{tallerEmail}</Text>
              <Text style={styles.workshopDetail}>{tallerAddress}</Text>
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

        {/* Metadata Line */}
        <Text style={styles.metaLine}>
          {tallerName}  ·  RUC {tallerRuc}  ·  {tallerPhone}  ·  {tallerEmail}  ·  {tallerAddress}
        </Text>

        {/* Cliente y Vehículo */}
        <View style={styles.twoColSection}>
          {/* Columna Cliente */}
          <View style={styles.columnLeft}>
            <Text style={styles.sectionLabel}>Cliente</Text>
            <Text style={styles.boldText}>{clienteName}</Text>
            <Text style={styles.infoText}>CI / RUC: {cliente.identificacion || "—"}</Text>
            <Text style={styles.infoText}>Tel: {cliente.telefono || "—"}</Text>
            <Text style={styles.infoText}>{cliente.email || "—"}</Text>
            <Text style={styles.infoText}>{cliente.direccion || "—"}</Text>
          </View>

          {/* Columna Vehículo */}
          <View style={styles.columnRight}>
            <BrandLogo brand={vehiculo.marca} />
            <View style={styles.vehicleDetails}>
              <Text style={styles.sectionLabel}>Vehículo</Text>
              <Text style={styles.boldText}>
                {vehiculo.marca} {vehiculo.modelo}
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
        </View>

        {/* Tabla de Ítems */}
        <View style={styles.tableHeader}>
          <View style={styles.colDesc}><Text style={styles.headerText}>Mano de Obra</Text></View>
          <View style={styles.colSku}><Text style={[styles.headerText, { textAlign: "center" }]}>SKU</Text></View>
          <View style={styles.colPrice}><Text style={[styles.headerText, { textAlign: "right" }]}>Precio</Text></View>
          <View style={styles.colQty}><Text style={[styles.headerText, { textAlign: "center" }]}>Cant</Text></View>
          <View style={styles.colTotal}><Text style={[styles.headerText, { textAlign: "right" }]}>Total</Text></View>
        </View>

        {items.map((item, idx) => (
          <View key={idx} style={styles.tableRow}>
            <View style={styles.colDesc}><Text style={styles.cellDesc}>{item.descripcion}</Text></View>
            <View style={styles.colSku}><Text style={[styles.cellSku, { textAlign: "center" }]}>{item.productoSku || "—"}</Text></View>
            <View style={styles.colPrice}><Text style={[styles.cellPrice, { textAlign: "right" }]}>${Number(item.precioUnitario).toFixed(2)}</Text></View>
            <View style={styles.colQty}><Text style={[styles.cellQty, { textAlign: "center" }]}>{item.cantidad}</Text></View>
            <View style={styles.colTotal}><Text style={[styles.cellTotal, { textAlign: "right" }]}>${(item.precioUnitario * item.cantidad).toFixed(2)}</Text></View>
          </View>
        ))}

        {/* Fila Subtotal de Tabla */}
        <View style={styles.subtotalRow}>
          <View style={styles.colDesc}><Text style={styles.subtotalLabelText}>Subtotal Mano de Obra</Text></View>
          <View style={styles.colSku}><Text /></View>
          <View style={styles.colPrice}><Text /></View>
          <View style={styles.colQty}><Text /></View>
          <View style={styles.colTotal}><Text style={[styles.subtotalValueText, { textAlign: "right" }]}>${subtotal.toFixed(2)}</Text></View>
        </View>

        {/* Totales y Condiciones */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Mano de obra:</Text>
              <Text style={styles.totalValue}>${manoDeObra.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>${subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IVA 15%:</Text>
              <Text style={styles.totalValue}>${iva.toFixed(2)}</Text>
            </View>
            <View style={styles.finalTotalRow}>
              <Text style={styles.finalTotalLabel}>Total:</Text>
              <Text style={styles.finalTotalValue}>${total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Condiciones */}
        <View style={styles.condicionesSection}>
          <Text style={styles.condicionesLabel}>Condiciones</Text>
          <Text style={styles.condicionesText}>
            Los trabajos realizados tienen una garantía de 3 meses. El cliente debe retirar el vehículo dentro de los 5 días habiles posteriores a la notificación de termino.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
