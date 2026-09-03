import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { MovimientoStock, DatosTaller, Producto } from "@/types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 35,
    paddingBottom: 45,
    paddingHorizontal: 35,
    fontFamily: "Helvetica",
    fontSize: 8,
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
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 2,
  },
  dateText: {
    fontSize: 7.5,
    color: "#475569",
    fontFamily: "Helvetica-Bold",
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
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 1,
  },
  workshopDetail: {
    fontSize: 7,
    color: "#64748b",
    marginBottom: 1,
  },
  logo: {
    width: 48,
    height: 42,
    objectFit: "contain",
  },
  mainDivider: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#0f172a",
    marginBottom: 10,
    marginTop: 4,
  },
  summaryCards: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flex: 1,
  },
  summaryCardLabel: {
    fontSize: 6.5,
    color: "#64748b",
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    marginBottom: 1,
  },
  summaryCardValue: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  productSection: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 3,
    overflow: "hidden",
  },
  productHeader: {
    backgroundColor: "#0f172a",
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  productSku: {
    fontSize: 7,
    color: "#94a3b8",
    fontFamily: "Helvetica",
    marginLeft: 4,
  },
  productMetrics: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#cbd5e1",
  },
  table: {
    width: "100%",
  },
  tableSubHeader: {
    backgroundColor: "#f1f5f9",
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  tableSubHeaderCell: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  tableRowEven: {
    backgroundColor: "#fafafa",
  },
  colFecha: {
    width: "12%",
    color: "#64748b",
    fontSize: 5.8,
  },
  colTipo: {
    width: "7%",
    textAlign: "center",
  },
  colCant: {
    width: "5%",
    textAlign: "right",
  },
  colStock: {
    width: "10%",
    textAlign: "right",
    fontSize: 5.8,
    color: "#475569",
  },
  colDetalle: {
    width: "16%",
    paddingLeft: 4,
    fontSize: 5.8,
    color: "#334155",
  },
  colCostoU: {
    width: "8%",
    textAlign: "right",
    fontSize: 5.8,
    color: "#475569",
  },
  colPrecioU: {
    width: "8%",
    textAlign: "right",
    fontSize: 5.8,
    color: "#475569",
  },
  colIvaU: {
    width: "7%",
    textAlign: "right",
    fontSize: 5.8,
    color: "#64748b",
  },
  colSubtotal: {
    width: "9%",
    textAlign: "right",
    fontSize: 5.8,
    color: "#334155",
  },
  colIvaTotal: {
    width: "8%",
    textAlign: "right",
    fontSize: 5.8,
    color: "#64748b",
  },
  colTotal: {
    width: "10%",
    textAlign: "right",
    fontSize: 5.8,
    color: "#0f172a",
    fontFamily: "Helvetica-Bold",
  },
  badgeEntrada: {
    backgroundColor: "#dcfce7",
    color: "#15803d",
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 1,
    paddingHorizontal: 3,
    borderRadius: 2,
    textAlign: "center",
  },
  badgeSalida: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 1,
    paddingHorizontal: 3,
    borderRadius: 2,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 35,
    right: 35,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: "#94a3b8",
  },
});

interface MovimientosPDFProps {
  movimientos: MovimientoStock[];
  taller: DatosTaller | null;
  fechaGeneracion: string;
  periodo?: string;
  ordenesMap?: Record<string, string>;
  productos?: Producto[];
}

interface GrupoProductoPDF {
  productoId: string;
  nombre: string;
  sku: string;
  unidad?: string;
  stockActual?: number;
  costoBase?: number;
  precioBase?: number;
  aplicaIva?: boolean;
  totalMovimientos: number;
  entradas: number;
  salidas: number;
  balance: number;
  items: MovimientoStock[];
}

function parseDateEC(val: unknown): Date | null {
  if (!val) return null;
  if (typeof val === "object" && val !== null && "toDate" in val && typeof (val as { toDate: () => Date }).toDate === "function") {
    return (val as { toDate: () => Date }).toDate();
  }
  if (val instanceof Date) return val;
  if (typeof val === "object" && val !== null && "seconds" in val && typeof (val as { seconds: number }).seconds === "number") {
    return new Date((val as { seconds: number }).seconds * 1000);
  }
  const d = new Date(val as string | number);
  return isNaN(d.getTime()) ? null : d;
}

function formatTimeEC(date: Date): string {
  return date.toLocaleTimeString("es-EC", {
    timeZone: "America/Guayaquil",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDateTimeEC(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const d = parts.find((p) => p.type === "day")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const y = parts.find((p) => p.type === "year")?.value;
  const timeStr = formatTimeEC(date);

  return `${d}/${m}/${y} ${timeStr}`;
}

export default function MovimientosPDF({
  movimientos,
  taller,
  fechaGeneracion,
  periodo = "Período seleccionado",
  ordenesMap = {},
  productos = [],
}: MovimientosPDFProps) {
  // Mapa de productos para enriquecer costos y precios base
  const prodMapRef: Record<string, Producto> = {};
  productos.forEach((p) => {
    if (p.id) prodMapRef[p.id] = p;
  });

  // Métricas Globales
  let totalEntradas = 0;
  let totalSalidas = 0;
  movimientos.forEach((m) => {
    if (m.tipo === "entrada") totalEntradas += Number(m.cantidad || 0);
    else totalSalidas += Number(m.cantidad || 0);
  });
  const balanceNeto = totalEntradas - totalSalidas;

  // AGRUPACIÓN PRINCIPAL: SOLO POR PRODUCTO
  const prodMap = new Map<string, MovimientoStock[]>();
  movimientos.forEach((m) => {
    const key = m.productoId || `${m.productoNombre}_${m.sku}`;
    const list = prodMap.get(key) ?? [];
    list.push(m);
    prodMap.set(key, list);
  });

  const gruposPorProducto: GrupoProductoPDF[] = Array.from(prodMap.entries())
    .map(([key, items]) => {
      const primer = items[0];
      let ent = 0;
      let sal = 0;

      items.forEach((m) => {
        if (m.tipo === "entrada") ent += Number(m.cantidad || 0);
        else sal += Number(m.cantidad || 0);
      });

      const prodData = prodMapRef[primer.productoId];
      const stockActual = prodData?.stockActual !== undefined ? prodData.stockActual : primer.stockNuevo;

      return {
        productoId: primer.productoId || key,
        nombre: primer.productoNombre || prodData?.nombre || "Sin nombre",
        sku: primer.sku || prodData?.sku || "",
        unidad: primer.unidadMedida || prodData?.unidadMedida,
        stockActual,
        costoBase: prodData?.costoBase,
        precioBase: prodData?.precioBase,
        aplicaIva: prodData?.aplicaIva,
        totalMovimientos: items.length,
        entradas: ent,
        salidas: sal,
        balance: ent - sal,
        items,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  const formatearNota = (nota?: string) => {
    if (!nota) return "-";
    let formatted = nota;
    Object.entries(ordenesMap).forEach(([id, label]) => {
      formatted = formatted.replace(id, label);
    });
    return formatted;
  };

  return (
    <Document title="Reporte de Movimientos de Stock" author={taller?.razonSocial || "Taller Automotriz"}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>REPORTE DE MOVIMIENTOS</Text>
            <Text style={styles.subtitle}>Historial agrupado por Producto • {periodo}</Text>
            <Text style={styles.dateText}>Emisión: {fechaGeneracion}</Text>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.workshopInfo}>
              <Text style={styles.workshopName}>{taller?.razonSocial || "I.F. Soluciones Automotrices"}</Text>
              {taller?.ruc && <Text style={styles.workshopDetail}>RUC: {taller.ruc}</Text>}
              {taller?.telefono && <Text style={styles.workshopDetail}>Tel: {taller.telefono}</Text>}
            </View>
            {taller?.logoUrl && <Image src={taller.logoUrl} style={styles.logo} />}
          </View>
        </View>

        <View style={styles.mainDivider} />

        {/* Tarjetas de Resumen */}
        <View style={styles.summaryCards}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Productos con Mov.</Text>
            <Text style={styles.summaryCardValue}>{gruposPorProducto.length}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Total Movimientos</Text>
            <Text style={styles.summaryCardValue}>{movimientos.length}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Unidades Entradas</Text>
            <Text style={[styles.summaryCardValue, { color: "#16a34a" }]}>+{totalEntradas}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Unidades Salidas</Text>
            <Text style={[styles.summaryCardValue, { color: "#dc2626" }]}>-{totalSalidas}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Balance Neto</Text>
            <Text style={[styles.summaryCardValue, { color: balanceNeto >= 0 ? "#16a34a" : "#dc2626" }]}>
              {balanceNeto > 0 ? `+${balanceNeto}` : balanceNeto}
            </Text>
          </View>
        </View>

        {/* Listado agrupado SOLO POR PRODUCTO */}
        {gruposPorProducto.map((prod) => (
          <View key={prod.productoId} style={styles.productSection} wrap={false}>
            {/* Cabecera del Producto (Slate 900 #0f172a) */}
            <View style={styles.productHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.productTitle}>{prod.nombre}</Text>
                {prod.sku ? <Text style={styles.productSku}>[{prod.sku}]</Text> : null}
                <Text style={[styles.productSku, { color: "#cbd5e1", marginLeft: 8 }]}>
                  ({prod.totalMovimientos} {prod.totalMovimientos === 1 ? "mov." : "movs."})
                </Text>
              </View>
              <Text style={styles.productMetrics}>
                {prod.entradas > 0 ? `+${prod.entradas} ent. ` : ""}
                {prod.salidas > 0 ? `-${prod.salidas} sal. ` : ""}
                Variación: {prod.balance > 0 ? `+${prod.balance}` : prod.balance}
                {prod.stockActual !== undefined ? ` | Stock: ${prod.stockActual}` : ""}
              </Text>
            </View>

            {/* Subcabecera de la tabla de movimientos */}
            <View style={styles.tableSubHeader}>
              <Text style={[styles.tableSubHeaderCell, styles.colFecha]}>FECHA / HORA</Text>
              <Text style={[styles.tableSubHeaderCell, styles.colTipo]}>TIPO</Text>
              <Text style={[styles.tableSubHeaderCell, styles.colCant]}>CANT.</Text>
              <Text style={[styles.tableSubHeaderCell, styles.colStock]}>STOCK</Text>
              <Text style={[styles.tableSubHeaderCell, styles.colDetalle]}>DETALLE / REF</Text>
              <Text style={[styles.tableSubHeaderCell, styles.colCostoU]}>COSTO U.</Text>
              <Text style={[styles.tableSubHeaderCell, styles.colPrecioU]}>P. VENTA U.</Text>
              <Text style={[styles.tableSubHeaderCell, styles.colIvaU]}>IVA U.</Text>
              <Text style={[styles.tableSubHeaderCell, styles.colSubtotal]}>SUBTOTAL</Text>
              <Text style={[styles.tableSubHeaderCell, styles.colIvaTotal]}>IVA</Text>
              <Text style={[styles.tableSubHeaderCell, styles.colTotal]}>TOTAL</Text>
            </View>

            {/* Tabla de movimientos del producto */}
            <View style={styles.table}>
              {prod.items.map((mov, index) => {
                const d = parseDateEC(mov.createdAt);
                const isEntrada = mov.tipo === "entrada";
                const nota = formatearNota(mov.nota);
                const cant = Math.max(0, Number(mov.cantidad || 0));

                const costo =
                  mov.costoUnitario != null
                    ? Number(mov.costoUnitario)
                    : prod.costoBase != null
                    ? Number(prod.costoBase)
                    : null;

                const precioBruto =
                  mov.precioVentaUnitario != null
                    ? Number(mov.precioVentaUnitario)
                    : prod.precioBase != null
                    ? Number(prod.precioBase)
                    : null;

                const aplicaIva = prod.aplicaIva ?? false;
                const precioUnitario =
                  precioBruto != null
                    ? (aplicaIva ? Number((precioBruto / 1.15).toFixed(2)) : precioBruto)
                    : null;
                const ivaUnitario =
                  precioUnitario != null ? (aplicaIva ? Number((precioUnitario * 0.15).toFixed(2)) : 0) : null;
                const subtotal =
                  precioUnitario != null && cant > 0
                    ? Number((cant * precioUnitario).toFixed(2))
                    : null;
                const ivaTotal =
                  ivaUnitario != null && cant > 0
                    ? Number((cant * ivaUnitario).toFixed(2))
                    : null;
                const total =
                  subtotal != null ? Number((subtotal + (ivaTotal || 0)).toFixed(2)) : null;

                return (
                  <View
                    key={mov.id || index}
                    style={[styles.tableRow, index % 2 === 1 ? styles.tableRowEven : {}]}
                  >
                    <Text style={styles.colFecha}>{d ? formatDateTimeEC(d) : "-"}</Text>
                    <View style={styles.colTipo}>
                      <Text style={isEntrada ? styles.badgeEntrada : styles.badgeSalida}>
                        {mov.tipo.toUpperCase()}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.colCant,
                        {
                          fontFamily: "Helvetica-Bold",
                          color: isEntrada ? "#16a34a" : "#dc2626",
                        },
                      ]}
                    >
                      {isEntrada ? `+${mov.cantidad}` : `-${mov.cantidad}`}
                    </Text>
                    <Text style={styles.colStock}>
                      {mov.stockAnterior} → {mov.stockNuevo} {mov.unidadMedida || ""}
                    </Text>
                    <Text style={styles.colDetalle}>
                      {nota}
                    </Text>
                    <Text style={styles.colCostoU}>
                      {costo != null ? `$${costo.toFixed(2)}` : "-"}
                    </Text>
                    <Text style={styles.colPrecioU}>
                      {precioUnitario != null ? `$${precioUnitario.toFixed(2)}` : "-"}
                    </Text>
                    <Text style={styles.colIvaU}>
                      {ivaUnitario != null ? `$${ivaUnitario.toFixed(2)}` : "-"}
                    </Text>
                    <Text style={styles.colSubtotal}>
                      {subtotal != null ? `$${subtotal.toFixed(2)}` : "-"}
                    </Text>
                    <Text style={styles.colIvaTotal}>
                      {ivaTotal != null ? `$${ivaTotal.toFixed(2)}` : "-"}
                    </Text>
                    <Text style={styles.colTotal}>
                      {total != null ? `$${total.toFixed(2)}` : "-"}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {/* Footer con paginación */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {taller?.razonSocial || "I.F. Soluciones Automotrices"} - Sistema de Gestión
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
