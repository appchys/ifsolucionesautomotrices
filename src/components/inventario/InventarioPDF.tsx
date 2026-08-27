import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { Producto, DatosTaller } from "@/types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 50,
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
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "column",
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
    letterSpacing: -0.5,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 9,
    color: "#64748b",
    marginBottom: 2,
  },
  dateText: {
    fontSize: 9,
    color: "#475569",
    fontWeight: "bold",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    maxWidth: "50%",
  },
  workshopInfo: {
    textAlign: "right",
    marginRight: 10,
  },
  workshopName: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 2,
  },
  workshopDetail: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 1,
  },
  logo: {
    width: 55,
    height: 50,
    objectFit: "contain",
  },
  mainDivider: {
    borderBottomWidth: 2,
    borderBottomColor: "#0f172a",
    marginBottom: 12,
    marginTop: 4,
  },
  summaryCards: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  summaryCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flex: 1,
  },
  summaryCardLabel: {
    fontSize: 7.5,
    color: "#64748b",
    textTransform: "uppercase",
    fontWeight: "bold",
    marginBottom: 2,
  },
  summaryCardValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0f172a",
  },
  table: {
    width: "100%",
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: "center",
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#ffffff",
    textTransform: "uppercase",
  },
  categoryHeader: {
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 8,
    marginBottom: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    textTransform: "uppercase",
  },
  categoryCount: {
    fontSize: 7.5,
    color: "#475569",
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  tableRowEven: {
    backgroundColor: "#f8fafc",
  },
  colNum: {
    width: "7%",
  },
  colSku: {
    width: "25%",
  },
  colNombre: {
    width: "48%",
  },
  colStock: {
    width: "20%",
    textAlign: "right",
  },
  cellText: {
    fontSize: 8.5,
    color: "#334155",
  },
  cellTextBold: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#0f172a",
  },
  cellSku: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#2563eb",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7.5,
    color: "#94a3b8",
  },
});

const SIN_CATEGORIA_LABEL = "Sin categoría";

interface InventarioPDFProps {
  productos: Producto[];
  taller: DatosTaller | null;
  fechaGeneracion: string;
}

export default function InventarioPDF({ productos, taller, fechaGeneracion }: InventarioPDFProps) {
  const totalStock = productos.reduce((acc, p) => acc + Math.max(0, Math.floor(Number(p.stockActual ?? 0))), 0);

  const tallerRuc = taller?.ruc || "0927405092001";
  const tallerPhone = taller?.telefono || "593988731879";
  const tallerEmail = taller?.email || "i.f.solucionesautomotrices@outlook.com";
  const tallerName = taller?.razonSocial || "I.F. SOLUCIONES AUTOMOTRICES";
  const tallerAddress = taller?.direccion || "Leonidas Garcia";

  // Agrupar por categoría
  const gruposMap = new Map<string, Producto[]>();
  productos.forEach((p) => {
    const cat = p.categoria?.trim() || SIN_CATEGORIA_LABEL;
    const list = gruposMap.get(cat) ?? [];
    list.push(p);
    gruposMap.set(cat, list);
  });

  const grupos = Array.from(gruposMap, ([categoria, prods]) => ({
    categoria,
    productos: prods,
  })).sort((a, b) => {
    if (a.categoria === SIN_CATEGORIA_LABEL) return 1;
    if (b.categoria === SIN_CATEGORIA_LABEL) return -1;
    return a.categoria.localeCompare(b.categoria, "es", { sensitivity: "base" });
  });

  let contadorGlobal = 0;

  return (
    <Document title={`Reporte_Inventario_${fechaGeneracion.replace(/[/ :]/g, "_")}`}>
      <Page size="A4" style={styles.page}>
        {/* Cabecera */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Reporte de Inventario</Text>
            <Text style={styles.subtitle}>Listado oficial de existencias</Text>
            <Text style={styles.dateText}>Fecha de emisión: {fechaGeneracion}</Text>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.workshopInfo}>
              <Text style={styles.workshopName}>{tallerName}</Text>
              {tallerRuc ? <Text style={styles.workshopDetail}>RUC: {tallerRuc}</Text> : null}
              {tallerPhone ? <Text style={styles.workshopDetail}>Tel: {tallerPhone}</Text> : null}
              {tallerEmail ? <Text style={styles.workshopDetail}>{tallerEmail}</Text> : null}
              {tallerAddress ? <Text style={styles.workshopDetail}>{tallerAddress}</Text> : null}
            </View>
            {taller?.logoUrl ? <Image src={taller.logoUrl} style={styles.logo} /> : null}
          </View>
        </View>

        <View style={styles.mainDivider} />

        {/* Resumen */}
        <View style={styles.summaryCards}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Total Productos Registrados</Text>
            <Text style={styles.summaryCardValue}>{productos.length}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Existencias Totales (Stock)</Text>
            <Text style={styles.summaryCardValue}>{totalStock} unidades</Text>
          </View>
        </View>

        {/* Tabla de Productos Agrupados */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colNum]}>#</Text>
            <Text style={[styles.tableHeaderCell, styles.colSku]}>SKU</Text>
            <Text style={[styles.tableHeaderCell, styles.colNombre]}>Nombre del Producto</Text>
            <Text style={[styles.tableHeaderCell, styles.colStock]}>Stock Actual</Text>
          </View>

          {productos.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.cellText, { textAlign: "center", width: "100%", paddingVertical: 12 }]}>
                No hay productos registrados en el inventario.
              </Text>
            </View>
          ) : (
            grupos.map((grupo) => (
              <View key={grupo.categoria}>
                {/* Encabezado de la Categoría */}
                <View style={styles.categoryHeader} wrap={false}>
                  <Text style={styles.categoryTitle}>{grupo.categoria}</Text>
                  <Text style={styles.categoryCount}>
                    {grupo.productos.length} {grupo.productos.length === 1 ? "producto" : "productos"}
                  </Text>
                </View>

                {/* Filas de Productos dentro de la Categoría */}
                {grupo.productos.map((producto, idx) => {
                  contadorGlobal++;
                  const isEven = idx % 2 === 1;
                  const stock = Math.floor(Number(producto.stockActual ?? 0));
                  return (
                    <View
                      key={producto.id || `${producto.sku}-${idx}`}
                      style={[styles.tableRow, isEven ? styles.tableRowEven : {}]}
                      wrap={false}
                    >
                      <Text style={[styles.cellText, styles.colNum]}>{contadorGlobal}</Text>
                      <Text style={[styles.cellSku, styles.colSku]}>{producto.sku || "-"}</Text>
                      <View style={styles.colNombre}>
                        <Text style={styles.cellTextBold}>{producto.nombre}</Text>
                      </View>
                      <Text style={[styles.cellTextBold, styles.colStock]}>{stock}</Text>
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </View>

        {/* Pie de página */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {taller?.razonSocial || "Taller Automotriz"} - Documento de Inventario Interno
          </Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
