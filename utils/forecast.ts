/**
 * Proyección sencilla para «Evolución de ventas»: recta de mínimos cuadrados sobre los meses cerrados,
 * con intervalo de predicción al 95 % y tres escenarios (conservador = percentil 25, base = tendencia,
 * optimista = percentil 75). Sin dependencias para poder probarla con node --test.
 */
export type Scenario = 'conservative' | 'base' | 'optimistic'

export interface ForecastPoint {
  value: number
  low: number
  high: number
}

export interface Forecast {
  points: ForecastPoint[]
  /** Variación mensual de la tendencia, en % sobre la media histórica. */
  monthlyTrendPct: number
  /** Suma de los 3 primeros meses proyectados (escenario elegido). */
  next3: number
  /** Probabilidad (0-100) de que los 3 próximos meses superen a los 3 últimos cerrados. */
  beatPrev3Pct: number
}

const Z95 = 1.96
const Z75 = 0.674

export function forecast(values: number[], horizon = 4, scenario: Scenario = 'base'): Forecast | null {
  const n = values.length
  if (n < 3) return null
  const xm = (n - 1) / 2
  const ym = values.reduce((s, v) => s + v, 0) / n
  let sxx = 0
  let sxy = 0
  values.forEach((y, x) => {
    sxx += (x - xm) ** 2
    sxy += (x - xm) * (y - ym)
  })
  const b = sxy / sxx
  const a = ym - b * xm
  const sse = values.reduce((s, y, x) => s + (y - (a + b * x)) ** 2, 0)
  const sigma = Math.sqrt(sse / (n - 2))
  const shift = scenario === 'conservative' ? -Z75 : scenario === 'optimistic' ? Z75 : 0

  const sds: number[] = []
  const points = Array.from({ length: horizon }, (_, i) => {
    const x = n + i
    const sd = sigma * Math.sqrt(1 + 1 / n + (x - xm) ** 2 / sxx)
    sds.push(sd)
    const trend = a + b * x
    return {
      value: Math.max(0, round2(trend + shift * sd)),
      low: Math.max(0, round2(trend - Z95 * sd)),
      high: Math.max(0, round2(trend + Z95 * sd))
    }
  })

  const k = Math.min(3, horizon)
  const next3 = round2(points.slice(0, k).reduce((s, p) => s + p.value, 0))
  const prev3 = values.slice(-3).reduce((s, v) => s + v, 0)
  // Suma de 3 normales (se tratan como independientes): media y desviación de la suma.
  const mean3 = points.slice(0, k).reduce((s, p) => s + p.value, 0)
  const sd3 = Math.sqrt(sds.slice(0, k).reduce((s, d) => s + d * d, 0))
  const beatPrev3Pct = sd3 > 0 ? Math.round(normalCdf((mean3 - prev3) / sd3) * 1000) / 10 : mean3 > prev3 ? 100 : 0

  return { points, monthlyTrendPct: ym ? Math.round((b / ym) * 1000) / 10 : 0, next3, beatPrev3Pct }
}

/** Función de distribución de la normal estándar (aproximación de Abramowitz y Stegun, error < 1e-7). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2)
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return z >= 0 ? 1 - p : p
}

const round2 = (n: number) => Math.round(n * 100) / 100
