/**
 * Utilidad para interpretar cadenas de tiempo como "45 min", "1h 5m", "1h 20m", "2h", etc.
 * Devuelve la cantidad numérica en minutos y un texto legible limpio.
 */

export function formatMinutos(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return "";
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${mins} min`;
  }
}

export function parseTiempoEstimado(input?: string | number | null): {
  duracionMinutos: number;
  tiempoEstimado: string;
} {
  if (input === undefined || input === null) {
    return { duracionMinutos: 0, tiempoEstimado: "" };
  }

  const str = String(input).trim().toLowerCase();

  if (!str) {
    return { duracionMinutos: 0, tiempoEstimado: "" };
  }

  // Si es un número entero/decimal directo (ej: 45 o "45")
  if (/^\d+(\.\d+)?$/.test(str)) {
    const mins = Math.round(parseFloat(str));
    return {
      duracionMinutos: mins,
      tiempoEstimado: formatMinutos(mins),
    };
  }

  let totalMinutes = 0;

  // Extraer horas: e.g. "1h", "1 h", "1.5h", "2 horas", "2 hrs"
  const hoursMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:h|hrs|hora|horas)/);
  if (hoursMatch) {
    totalMinutes += Math.round(parseFloat(hoursMatch[1]) * 60);
  }

  // Extraer minutos: e.g. "20m", "20 min", "20 mins", "20 minutos"
  const minutesMatch = str.match(/(\d+)\s*(?:m|min|mins|minuto|minutos)(?!\s*h)/);
  if (minutesMatch) {
    totalMinutes += parseInt(minutesMatch[1], 10);
  }

  // Si ninguna expresión coincidió, intentar extraer el primer número disponible
  if (!hoursMatch && !minutesMatch) {
    const matchNumber = str.match(/(\d+)/);
    if (matchNumber) {
      totalMinutes = parseInt(matchNumber[1], 10);
    }
  }

  if (totalMinutes <= 0) {
    return { duracionMinutos: 0, tiempoEstimado: String(input).trim() };
  }

  return {
    duracionMinutos: totalMinutes,
    tiempoEstimado: formatMinutos(totalMinutes),
  };
}
