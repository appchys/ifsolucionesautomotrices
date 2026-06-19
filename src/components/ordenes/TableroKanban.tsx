"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  subscribeOrdenes, 
  getClientes, 
  getVehiculos, 
  updateEstadoOrden, 
  convertirIngresoAOrden,
  getItemsOrden,
  getPagos
} from "@/lib/services";
import { OrdenTrabajo, Cliente, Vehiculo, EstadoOrden, ItemOrden, Pago } from "@/types";
import { 
  Columns3, 
  Search, 
  Maximize2, 
  Minimize2, 
  Clock, 
  Eye, 
  ArrowRight,
  ClipboardList,
  Hourglass,
  Package,
  UserCheck,
  Wrench,
  CheckCircle2,
  Truck,
  Archive,
  XCircle,
  HelpCircle,
  ChevronsLeftRight,
  ChevronsRightLeft
} from "lucide-react";
import { toast } from "react-hot-toast";
import OrdenDetalleSidebar from "@/components/ordenes/OrdenDetalleSidebar";

// Mapeo de columnas con sus respectivos estados de órdenes e iconos
interface ColumnConfig {
  id: string;
  title: string;
  icon: React.ElementType;
  colorClass: string; // Tailwind border-color
  badgeColorClass: string; // Tailwind badge background
  dotColor: string; // CSS color code for dot
  estado: EstadoOrden | "Ingresado";
}

const COLUMNAS: ColumnConfig[] = [
  { 
    id: "ingresados", 
    title: "Ingresados", 
    icon: ClipboardList, 
    colorClass: "border-t-4 border-purple-500", 
    badgeColorClass: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
    dotColor: "#a855f7",
    estado: "Ingresado"
  },
  { 
    id: "pendiente", 
    title: "Pendiente", 
    icon: Hourglass, 
    colorClass: "border-t-4 border-red-500", 
    badgeColorClass: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    dotColor: "#ef4444",
    estado: "Borrador" // Borrador de orden mapeado a Pendiente
  },
  { 
    id: "diagnostico", 
    title: "En Diagnóstico", 
    icon: Search, 
    colorClass: "border-t-4 border-blue-500", 
    badgeColorClass: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    dotColor: "#3b82f6",
    estado: "En Diagnóstico"
  },
  { 
    id: "repuestos", 
    title: "Esperando Repuestos", 
    icon: Package, 
    colorClass: "border-t-4 border-amber-500", 
    badgeColorClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    dotColor: "#f59e0b",
    estado: "Esperando Repuestos"
  },
  { 
    id: "aprobacion", 
    title: "Esperando Aprobación", 
    icon: UserCheck, 
    colorClass: "border-t-4 border-indigo-500", 
    badgeColorClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
    dotColor: "#6366f1",
    estado: "Esperando Aprobación"
  },
  { 
    id: "reparacion", 
    title: "En Reparación", 
    icon: Wrench, 
    colorClass: "border-t-4 border-cyan-500", 
    badgeColorClass: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400",
    dotColor: "#06b6d4",
    estado: "En Reparación"
  },
  { 
    id: "completada", 
    title: "Completada", 
    icon: CheckCircle2, 
    colorClass: "border-t-4 border-emerald-500", 
    badgeColorClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    dotColor: "#10b981",
    estado: "Completada"
  },
  { 
    id: "entrega", 
    title: "Listo para Entrega", 
    icon: Truck, 
    colorClass: "border-t-4 border-teal-500", 
    badgeColorClass: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
    dotColor: "#14b8a6",
    estado: "Listo para Entrega"
  },
  { 
    id: "entregada", 
    title: "Entregada", 
    icon: Archive, 
    colorClass: "border-t-4 border-slate-500", 
    badgeColorClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    dotColor: "#64748b",
    estado: "Entregada"
  },
  { 
    id: "cancelada", 
    title: "Cancelada", 
    icon: XCircle, 
    colorClass: "border-t-4 border-zinc-500", 
    badgeColorClass: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
    dotColor: "#71717a",
    estado: "Cancelada"
  }
];

export default function TableroKanban() {
  const router = useRouter();
  const [allDocs, setAllDocs] = useState<OrdenTrabajo[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, Cliente>>({});
  const [vehiculosMap, setVehiculosMap] = useState<Record<string, Vehiculo>>({});
  
  // Mapa de items y pagos por orden
  const [ordenesValores, setOrdenesValores] = useState<Record<string, { total: number; abonado: number; saldo: number }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSinPago, setFilterSinPago] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Estado para arrastrar y soltar
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [activeOverCol, setActiveOverCol] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Sidebar de vista rápida
  const [quickViewOrderId, setQuickViewOrderId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Columnas colapsadas por el usuario
  const [collapsedCols, setCollapsedCols] = useState<Record<string, boolean>>({});

  // Cargar relaciones de clientes y vehículos
  const loadRelations = useCallback(async () => {
    try {
      const [cList, vList] = await Promise.all([getClientes(), getVehiculos()]);
      const cMap: Record<string, Cliente> = {};
      const vMap: Record<string, Vehiculo> = {};
      cList.forEach(c => { if (c.id) cMap[c.id] = c; });
      vList.forEach(v => { if (v.id) vMap[v.id] = v; });
      setClientesMap(cMap);
      setVehiculosMap(vMap);
    } catch (err) {
      console.error("Error cargando clientes y vehiculos en Tablero", err);
    }
  }, []);

  // Suscripción a los datos de Firestore
  useEffect(() => {
    loadRelations().catch(console.error);
    const unsub = subscribeOrdenes(
      (data) => {
        setAllDocs(data);
        setLoading(false);
      },
      (err) => {
        console.error("Error en subscribeOrdenes en Tablero", err);
        toast.error("Error al cargar datos en tiempo real");
        setLoading(false);
      }
    );
    return () => unsub();
  }, [loadRelations]);

  // Cargar valores financieros de las órdenes de manera reactiva/dinámica
  useEffect(() => {
    if (allDocs.length === 0) return;
    
    // Obtener sólo las órdenes que no tenemos cargadas o cuyas actualizaciones requieran recálculo
    const fetchValores = async () => {
      const promesas = allDocs.map(async (o) => {
        if (!o.id) return null;
        try {
          const [items, pagos] = await Promise.all([
            getItemsOrden(o.id),
            getPagos(o.id)
          ]);
          
          const subtotal = items.reduce((acc, it) => acc + it.precioUnitario * it.cantidad, 0);
          const iva = items.reduce((acc, it) => acc + it.precioUnitario * it.cantidad * (it.impuestoAplicable / 100), 0);
          const total = subtotal + iva;
          const abonado = pagos.reduce((acc, p) => acc + (p.montoBase ?? p.monto), 0);
          const saldo = Math.max(0, total - abonado);
          
          return { id: o.id, total, abonado, saldo };
        } catch (e) {
          console.error(`Error calculando valores para orden ${o.id}`, e);
          return { id: o.id, total: 0, abonado: 0, saldo: 0 };
        }
      });

      const res = await Promise.all(promesas);
      const nuevoMapa: Record<string, { total: number; abonado: number; saldo: number }> = {};
      res.forEach(item => {
        if (item) {
          nuevoMapa[item.id] = {
            total: item.total,
            abonado: item.abonado,
            saldo: item.saldo
          };
        }
      });
      setOrdenesValores(nuevoMapa);
    };

    fetchValores().catch(console.error);
  }, [allDocs]);

  // Calcular fecha transcurrida
  const getDiasTranscurridos = (createdAtVal: any) => {
    if (!createdAtVal) return "0d";
    let dateObj: Date;
    if (createdAtVal instanceof Date) {
      dateObj = createdAtVal;
    } else if (typeof createdAtVal.toDate === "function") {
      dateObj = createdAtVal.toDate();
    } else {
      dateObj = new Date(createdAtVal);
    }
    const diffTime = Math.abs(new Date().getTime() - dateObj.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays}d`;
  };

  // Filtrar documentos listos para renderizar
  const processedDocs = allDocs
    .map(o => ({
      ...o,
      cliente: clientesMap[o.clienteId] || o.cliente,
      vehiculo: vehiculosMap[o.vehiculoId] || o.vehiculo,
      valores: ordenesValores[o.id!] || { total: 0, abonado: 0, saldo: 0 }
    }))
    .filter(o => {
      // Filtrar cotizaciones de presupuestos que no son ingresos
      if (o.esCotizacion) return false;
      // Filtrar archivados
      if (o.archivado) return false;

      // Filtro de búsqueda
      const term = search.toLowerCase();
      const matchSearch =
        !search ||
        o.vehiculo?.placa?.toLowerCase().includes(term) ||
        o.cliente?.nombre?.toLowerCase().includes(term) ||
        o.cliente?.apellido?.toLowerCase().includes(term) ||
        (o.numeroOrden && `ot-${o.numeroOrden}`.includes(term)) ||
        (o.numeroIngreso && `ing-${o.numeroIngreso}`.includes(term));
      
      // Filtro de sin pago
      const matchSinPago = !filterSinPago || (o.valores.total > 0 && o.valores.abonado === 0);

      return matchSearch && matchSinPago;
    });

  // Dividir los documentos procesados por columnas
  const getDocsPorColumna = (col: ColumnConfig) => {
    if (col.id === "ingresados") {
      // Ingresos que no han sido convertidos a orden (no tienen numeroOrden)
      return processedDocs.filter(o => !o.numeroOrden);
    } else {
      // Órdenes activas filtradas por su respectivo estado
      return processedDocs.filter(o => !!o.numeroOrden && o.estado === col.estado);
    }
  };

  // Contar órdenes totales activas (en columnas de orden activa, excluye entregadas y canceladas)
  const totalActivasCount = processedDocs.filter(
    o => !!o.numeroOrden && o.estado !== "Entregada" && o.estado !== "Cancelada"
  ).length;

  // Contar órdenes sin pago
  const totalSinPagoCount = processedDocs.filter(
    o => !!o.numeroOrden && o.valores.total > 0 && o.valores.abonado === 0
  ).length;

  // Alternar el colapso manual de una columna
  const toggleColCollapse = (colId: string) => {
    setCollapsedCols(prev => {
      const col = COLUMNAS.find(c => c.id === colId);
      const colIsEmpty = col ? getDocsPorColumna(col).length === 0 : false;
      const currentVal = prev[colId] !== undefined ? prev[colId] : colIsEmpty;
      return {
        ...prev,
        [colId]: !currentVal
      };
    });
  };

  // Determinar el estado del colapso global de columnas
  const getCurrentGlobalCollapseState = (): "all" | "empty" | "none" | "mixed" => {
    let collapsedCount = 0;
    let emptyCollapsedCount = 0;
    let emptyCount = 0;

    COLUMNAS.forEach((col) => {
      const colDocs = getDocsPorColumna(col);
      const isEmpty = colDocs.length === 0;
      const isCollapsed = collapsedCols[col.id] !== undefined ? collapsedCols[col.id] : isEmpty;

      if (isEmpty) {
        emptyCount++;
        if (isCollapsed) emptyCollapsedCount++;
      }
      if (isCollapsed) {
        collapsedCount++;
      }
    });

    if (collapsedCount === COLUMNAS.length) return "all";
    if (collapsedCount === 0) return "none";

    const nonCollapseds = COLUMNAS.length - collapsedCount;
    const nonEmptys = COLUMNAS.length - emptyCount;
    if (emptyCollapsedCount === emptyCount && nonCollapseds === nonEmptys) {
      return "empty";
    }

    return "mixed";
  };

  // Alternar el colapso global ciclando entre los 3 estados
  const handleGlobalCollapseToggle = () => {
    const currentState = getCurrentGlobalCollapseState();
    const nextCollapsed: Record<string, boolean> = {};

    if (currentState === "none") {
      // none -> empty (contraer vacías)
      COLUMNAS.forEach((col) => {
        const isEmpty = getDocsPorColumna(col).length === 0;
        nextCollapsed[col.id] = isEmpty;
      });
    } else if (currentState === "empty") {
      // empty -> all (contraer todas)
      COLUMNAS.forEach((col) => {
        nextCollapsed[col.id] = true;
      });
    } else {
      // all o mixed -> none (expandir todas)
      COLUMNAS.forEach((col) => {
        nextCollapsed[col.id] = false;
      });
    }

    setCollapsedCols(nextCollapsed);
  };

  // Manejadores de Drag and Drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    setDraggedId(id);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setActiveOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (activeOverCol !== colId) {
      setActiveOverCol(colId);
    }
  };

  const handleDrop = async (e: React.DragEvent, col: ColumnConfig) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggedId;
    handleDragEnd();

    if (!id) return;

    // Asegurar que la columna destino se expanda
    setCollapsedCols((prev) => ({ ...prev, [col.id]: false }));
    
    // Obtener la orden arrastrada
    const docArrastrado = processedDocs.find(o => o.id === id);
    if (!docArrastrado) return;

    // Verificar si se tiró en la misma columna
    const esIngreso = !docArrastrado.numeroOrden;
    const colOrigen = esIngreso ? "ingresados" : COLUMNAS.find(c => c.estado === docArrastrado.estado)?.id;
    if (colOrigen === col.id) return;

    // Si se arrastra hacia "Ingresados" y ya es orden activa, no permitir revertir a ingreso
    if (col.id === "ingresados" && !esIngreso) {
      toast.error("No se puede revertir una orden de trabajo activa a un ingreso preliminar.");
      return;
    }

    setIsUpdating(true);
    const toastId = toast.loading("Actualizando estado...");

    try {
      if (esIngreso) {
        // Viene de "Ingresados" (es ingreso) y va a una columna de orden activa
        const targetEstado = col.estado === "Ingresado" ? "Borrador" : col.estado;
        
        // 1. Convertir a orden (asigna número de orden e importa presupuesto si existe)
        await convertirIngresoAOrden(id);
        
        // 2. Cambiar al estado de la columna destino
        await updateEstadoOrden(id, targetEstado);
        toast.success(`Ingreso convertido a orden y movido a ${col.title}`, { id: toastId });
      } else {
        // Es una orden activa que se mueve a otro estado de orden
        if (col.estado !== "Ingresado") {
          await updateEstadoOrden(id, col.estado);
          toast.success(`Orden movida a ${col.title}`, { id: toastId });
        }
      }
    } catch (error) {
      console.error("Error al mover tarjeta", error);
      toast.error("No se pudo actualizar el estado de la orden", { id: toastId });
    } finally {
      setIsUpdating(false);
    }
  };

  // Mover tarjeta al estado siguiente al hacer clic en la flecha
  const moverAlEstadoSiguiente = async (o: OrdenTrabajo) => {
    if (!o.id) return;
    
    const esIngreso = !o.numeroOrden;
    const colActualIndex = esIngreso 
      ? 0 
      : COLUMNAS.findIndex(c => c.estado === o.estado);

    if (colActualIndex === -1 || colActualIndex >= 8) return; // Menor que "Entregada" (index 8)

    const colDestino = COLUMNAS[colActualIndex + 1];
    if (colDestino.id === "cancelada") return; // No mover a cancelada automáticamente

    // Asegurar que la columna destino se expanda
    setCollapsedCols((prev) => ({ ...prev, [colDestino.id]: false }));

    setIsUpdating(true);
    const toastId = toast.loading("Moviendo al estado siguiente...");

    try {
      if (esIngreso) {
        const targetEstado = colDestino.estado === "Ingresado" ? "Borrador" : colDestino.estado;
        await convertirIngresoAOrden(o.id);
        await updateEstadoOrden(o.id, targetEstado);
        toast.success(`Ingreso convertido a orden y movido a ${colDestino.title}`, { id: toastId });
      } else {
        if (colDestino.estado !== "Ingresado") {
          await updateEstadoOrden(o.id, colDestino.estado);
          toast.success(`Orden movida a ${colDestino.title}`, { id: toastId });
        }
      }
    } catch (error) {
      console.error("Error al mover al estado siguiente", error);
      toast.error("No se pudo mover al estado siguiente", { id: toastId });
    } finally {
      setIsUpdating(false);
    }
  };

  // Alternar pantalla completa
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        toast.error(`Error al activar pantalla completa: ${err.message}`);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Escuchar cambio de pantalla completa del sistema
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`flex flex-col flex-1 h-full min-h-0 bg-[var(--bg-primary)] ${isFullscreen ? "p-6 overflow-hidden" : ""}`}
    >
      {/* Header del tablero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 shrink-0">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
          >
            <Columns3 size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
              Tablero
              <span className="badge badge-gray text-xs font-semibold px-2 py-0.5">
                {totalActivasCount} activas
              </span>
            </h1>
          </div>
        </div>

        {/* Acciones y Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Barra de búsqueda */}
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar placa, cliente, código..."
              className="input pl-9 pr-4 py-1.5 h-9 text-sm w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filtro Dinámico sin Pago */}
          <button
            onClick={() => setFilterSinPago(!filterSinPago)}
            className={`btn btn-sm h-9 text-xs font-bold transition-all flex items-center gap-1.5 rounded-xl border border-[var(--border)] ${
              filterSinPago 
                ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30 font-extrabold" 
                : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <span className="font-bold">$</span>
            <span>{totalSinPagoCount} sin pago</span>
          </button>

          {/* Botón Contraer/Expandir todas las columnas (3 estados) */}
          {(() => {
            const globalState = getCurrentGlobalCollapseState();
            let buttonTitle = "Contraer columnas vacías";
            let buttonIcon = <Columns3 size={15} />;

            if (globalState === "none") {
              buttonTitle = "Contraer columnas vacías";
              buttonIcon = <Columns3 size={15} />;
            } else if (globalState === "empty") {
              buttonTitle = "Contraer todas las columnas";
              buttonIcon = <ChevronsRightLeft size={16} />;
            } else {
              buttonTitle = "Expandir todas las columnas";
              buttonIcon = <ChevronsLeftRight size={16} />;
            }

            return (
              <button
                onClick={handleGlobalCollapseToggle}
                className="btn btn-sm h-9 w-9 bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded-xl flex items-center justify-center cursor-pointer"
                title={buttonTitle}
                aria-label={buttonTitle}
              >
                {buttonIcon}
              </button>
            );
          })()}

          {/* Botón Pantalla Completa */}
          <button
            onClick={toggleFullscreen}
            className="btn btn-sm h-9 bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded-xl flex items-center gap-1.5 text-xs font-semibold"
          >
            {isFullscreen ? (
              <>
                <Minimize2 size={14} /> Pantalla normal
              </>
            ) : (
              <>
                <Maximize2 size={14} /> Pantalla completa
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grid horizontal de columnas */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="spinner" />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <div 
            className="absolute inset-0 flex items-stretch gap-4 overflow-x-auto pb-4 pt-1 px-1 custom-scrollbar select-none"
          >
            {COLUMNAS.map((col) => {
              const colDocs = getDocsPorColumna(col);
              const isOver = activeOverCol === col.id;
              const isEmpty = colDocs.length === 0;
              const isCollapsed = collapsedCols[col.id] !== undefined ? collapsedCols[col.id] : isEmpty;
              
              return (
                <div
                  key={col.id}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={() => setActiveOverCol(null)}
                  onDrop={(e) => handleDrop(e, col)}
                  className={`flex flex-col shrink-0 h-full rounded-2xl border transition-all ${
                    isCollapsed ? "w-[56px]" : "w-[300px]"
                  } ${
                    isOver 
                      ? "bg-slate-100/90 border-dashed border-blue-400 scale-[1.01] dark:bg-slate-950/40" 
                      : draggedId && isCollapsed
                        ? "border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/10 dark:bg-slate-950/10"
                        : "border-transparent bg-transparent"
                  }`}
                  title={isCollapsed ? col.title : undefined}
                >
                  {/* Cabecera de la columna */}
                  <div 
                    className={`p-3 border-b-2 flex items-center shrink-0 cursor-pointer select-none transition-all ${
                      isCollapsed ? "justify-center px-1" : "justify-between"
                    }`}
                    style={{ borderBottomColor: col.dotColor }}
                    onClick={() => toggleColCollapse(col.id)}
                    title={col.title}
                  >
                    <div className={`flex items-center gap-2 ${isCollapsed ? "justify-center" : "min-w-0"}`}>
                      <col.icon 
                        size={16} 
                        style={{ color: col.dotColor }} 
                        className={isCollapsed ? "mx-auto" : "flex-shrink-0"} 
                      />
                      {!isCollapsed && (
                        <h3 className="font-bold text-xs text-[var(--text-primary)] truncate max-w-[150px]" title={col.title}>
                          {col.title}
                        </h3>
                      )}
                    </div>
                    {!isCollapsed && (
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${col.badgeColorClass}`}>
                          {colDocs.length}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Listado de tarjetas */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar min-h-0">
                    {!isCollapsed && colDocs.map((o) => {
                        const esIngresoCard = !o.numeroOrden;
                        const numero = esIngresoCard 
                          ? `ING-${String(o.numeroIngreso ?? o.numero ?? 0).padStart(5, "0")}`
                          : `OT-${String(o.numeroOrden ?? o.numero ?? 0).padStart(4, "0")}`;
                        
                        const colActualIndex = esIngresoCard 
                          ? 0 
                          : COLUMNAS.findIndex(c => c.estado === o.estado);
                        const puedeMoverSiguiente = colActualIndex !== -1 && colActualIndex < 8;

                        // Determinar color de dot basado en abono/saldo
                        let dotColor = "#94a3b8"; // Sin pago/default
                        if (!esIngresoCard) {
                          if (o.valores.total > 0) {
                            if (o.valores.saldo <= 0.01) {
                              dotColor = "#10b981"; // Pagado (verde)
                            } else if (o.valores.abonado > 0.01) {
                              dotColor = "#eab308"; // Parcial (amarillo)
                            } else {
                              dotColor = "#ef4444"; // Sin pago (rojo)
                            }
                          }
                        }

                        // Determinar inicial de tipo cliente (Empresa = E, Persona = I)
                        const tipoClienteInit = (o.cliente as any)?.tipo === "Empresa" ? "E" : "I";

                        return (
                          <div
                            key={o.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, o.id!)}
                            onDragEnd={handleDragEnd}
                            onClick={() => {
                              if (esIngresoCard) {
                                router.push(`/ingresos/${o.id}`);
                              } else {
                                router.push(`/ordenes/detalle?id=${o.id}`);
                              }
                            }}
                            className="group relative bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] hover:shadow-md hover:scale-[1.01] transition-all rounded-xl p-3.5 cursor-grab active:cursor-grabbing text-xs space-y-2.5 shadow-sm"
                          >
                            {/* Fila superior: ID y estado de ingresos / acciones flotantes */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {!esIngresoCard && (
                                  <div 
                                    className="w-2 h-2 rounded-full shrink-0" 
                                    style={{ backgroundColor: dotColor }}
                                    title={o.valores.saldo <= 0.01 ? "Pagado" : o.valores.abonado > 0 ? "Abono parcial" : "Sin pago"}
                                  />
                                )}
                                <span className={`font-mono font-bold tracking-tight text-[11px] truncate ${
                                  esIngresoCard ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400"
                                }`}>
                                  #{numero}
                                </span>
                                {esIngresoCard && (
                                  <span className="badge badge-sm bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400 font-extrabold scale-90 origin-left">
                                    Recibido
                                  </span>
                                )}
                              </div>

                              {/* Acciones flotantes que aparecen al pasar el mouse (hover) */}
                              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-card)] pl-1.5 z-10">
                                {/* Ojo para ir al detalle completo de la página */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (esIngresoCard) {
                                      router.push(`/ingresos/${o.id}`);
                                    } else {
                                      router.push(`/ordenes/detalle?id=${o.id}`);
                                    }
                                  }}
                                  className="w-6 h-6 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] flex items-center justify-center cursor-pointer transition-colors"
                                  title="Ver página de detalle"
                                >
                                  <Eye size={12} />
                                </button>
                                {/* Flecha para mover al estado siguiente */}
                                {puedeMoverSiguiente && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moverAlEstadoSiguiente(o);
                                    }}
                                    className="w-6 h-6 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] flex items-center justify-center cursor-pointer transition-colors"
                                    title="Mover al estado siguiente"
                                  >
                                    <ArrowRight size={12} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Motivo de visita (Negrita) */}
                            <div className="font-bold text-[13px] text-[var(--text-primary)] leading-tight line-clamp-2" title={o.motivo}>
                              {esIngresoCard ? "Ingreso Preliminar" : o.motivo || "Sin motivo"}
                            </div>

                            {/* Vehículo y Placa */}
                            <div className="text-[var(--text-secondary)] font-medium">
                              {o.vehiculo ? `${o.vehiculo.marca} ${o.vehiculo.modelo}` : "Vehículo"} 
                              <span className="font-mono text-[10px] text-[var(--text-muted)] ml-1.5 uppercase font-semibold">
                                {o.vehiculo?.placa || "—"}
                              </span>
                            </div>

                            {/* Línea divisoria delgada */}
                            <div className="border-t border-[var(--border-light)] dark:border-slate-800/40" />

                            {/* Fila inferior: Cliente, tiempo transcurrido y valor monetario */}
                            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                              <div className="truncate max-w-[130px] font-semibold text-[var(--text-secondary)]" title={o.cliente ? `${o.cliente.nombre} ${o.cliente.apellido}` : "Cliente"}>
                                {o.cliente ? `${o.cliente.nombre} ${o.cliente.apellido}` : "Sin cliente"}
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0 ml-1.5">
                                {/* Inicial del tipo de cliente (Empresa / Individual) */}
                                <span 
                                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white uppercase ${
                                    tipoClienteInit === "E" 
                                      ? "bg-purple-500 shadow-[0_0_4px_#a855f7]" 
                                      : "bg-blue-500 shadow-[0_0_4px_#3b82f6]"
                                  }`}
                                  title={(o.cliente as any)?.tipo === "Empresa" ? "Empresa" : "Persona Particular"}
                                >
                                  {tipoClienteInit}
                                </span>

                                {/* Tiempo transcurrido */}
                                <div className="flex items-center gap-1 text-[var(--text-muted)] font-medium">
                                  <Clock size={11} />
                                  <span>{getDiasTranscurridos(o.createdAt)}</span>
                                </div>

                                {/* Valor financiero de la orden */}
                                {!esIngresoCard && o.valores.total > 0 && (
                                  <div className="font-bold text-[var(--text-primary)]">
                                    ${o.valores.total.toFixed(2)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sidebar interactivo de vista rápida */}
      {quickViewOrderId && (
        <OrdenDetalleSidebar
          ordenId={quickViewOrderId}
          onClose={() => setQuickViewOrderId(null)}
          onUpdate={() => {
            // La actualización es automática debido a la suscripción activa
          }}
        />
      )}
    </div>
  );
}
