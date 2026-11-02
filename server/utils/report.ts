import type { DatabaseSync } from 'node:sqlite'

const DAY = 86_400_000

/** Periodos del tablero: meses hacia atrás desde el mes actual (incluido). */
export const PERIODS = { '3m': 3, '6m': 6, '12m': 12 } as const
export type Period = keyof typeof PERIODS

export function parsePeriod(v: unknown): Period {
  return typeof v === 'string' && v in PERIODS ? (v as Period) : '12m'
}

/** Primer día (UTC) del mes que queda `monthsBack` meses antes del de `now`. */
export function monthStart(now: Date, monthsBack = 0): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1))
}

/** Claves YYYY-MM de los `months` meses que terminan en el de `now`, de más antiguo a más reciente. */
export function monthKeys(now: Date, months: number): string[] {
  return Array.from({ length: months }, (_, i) => monthStart(now, months - 1 - i).toISOString().slice(0, 7))
}

/** Variación en % frente al periodo anterior; null si no hay base con la que comparar. */
export function delta(current: number, previous: number): number | null {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

/** Deja los `max - 1` primeros y suma el resto en «Otros», para no pasar de `max` series. */
export function topWithOthers<T extends { label: string; value: number; count: number }>(rows: T[], max = 6) {
  if (rows.length <= max) return rows.map(({ label, value, count }) => ({ label, value, count }))
  const head = rows.slice(0, max - 1).map(({ label, value, count }) => ({ label, value, count }))
  const rest = rows.slice(max - 1)
  head.push({
    label: 'Otros',
    value: rest.reduce((s, r) => s + r.value, 0),
    count: rest.reduce((s, r) => s + r.count, 0)
  })
  return head
}

export type Segment = 'large' | 'mid' | 'small'

/** Reparte afiliados ya ordenados por importe (de mayor a menor): 20 % grandes, 30 % medianos y el resto pequeños. */
export function segmentAffiliates<T extends { value: number }>(rows: T[]): Array<T & { segment: Segment }> {
  const n = rows.length
  const large = Math.max(1, Math.round(n * 0.2))
  const mid = Math.round(n * 0.5)
  return rows.map((r, i) => ({ ...r, segment: (i < large ? 'large' : i < Math.max(mid, large) ? 'mid' : 'small') as Segment }))
}

const round2 = (n: number) => Math.round((n || 0) * 100) / 100

/**
 * Datos del tablero para el periodo: indicadores frente al periodo anterior, evolución mensual de ventas
 * válidas y anuladas, ventas por programa, afiliados por volumen, próximas renovaciones, estado de las
 * comisiones y últimas ventas. Todo sale de las tablas que llena la sincronización con Tradedoubler.
 */
export function buildReport(db: DatabaseSync, period: Period, now = new Date()) {
  const months = PERIODS[period]
  const from = monthStart(now, months - 1).toISOString()
  const prevFrom = monthStart(now, 2 * months - 1).toISOString()
  const nowIso = now.toISOString()

  const totals = (a: string, b: string) =>
    db
      .prepare(
        `SELECT COUNT(*) AS count, COALESCE(SUM(order_value), 0) AS value FROM sales
         WHERE valid = 1 AND occurred_at >= ? AND occurred_at < ?`
      )
      .get(a, b) as { count: number; value: number }
  const cur = totals(from, nowIso)
  const prev = totals(prevFrom, from)

  // Tasa de renovación: de las ventas cuyo plazo ya venció y tienen respuesta, cuántas renovaron.
  const ren = db
    .prepare(
      `SELECT SUM(renewal_status = 'renewed') AS renewed, SUM(renewal_status = 'not_renewed') AS lost,
              SUM(renewal_status = 'pending') AS pending
       FROM sales WHERE valid = 1`
    )
    .get() as { renewed: number | null; lost: number | null; pending: number | null }
  const decided = (ren.renewed ?? 0) + (ren.lost ?? 0)

  const comm = db
    .prepare(`SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount FROM commissions GROUP BY status`)
    .all() as Array<{ status: string; count: number; amount: number }>
  const commissions = Object.fromEntries(
    ['pending', 'approved', 'paid'].map((s) => {
      const r = comm.find((c) => c.status === s)
      return [s, { count: r?.count ?? 0, amount: round2(r?.amount ?? 0) }]
    })
  ) as Record<'pending' | 'approved' | 'paid', { count: number; amount: number }>

  const monthlyRows = db
    .prepare(
      `SELECT substr(occurred_at, 1, 7) AS month,
              SUM(valid = 1) AS valid, SUM(valid = 0) AS invalid,
              COALESCE(SUM(CASE WHEN valid = 1 THEN order_value END), 0) AS value,
              COALESCE(SUM(CASE WHEN valid = 0 THEN order_value END), 0) AS invalid_value
       FROM sales WHERE occurred_at >= ? AND occurred_at < ? GROUP BY month`
    )
    .all(from, nowIso) as Array<{ month: string; valid: number; invalid: number; value: number; invalid_value: number }>
  const monthly = monthKeys(now, months).map((month) => {
    const r = monthlyRows.find((m) => m.month === month)
    return {
      month,
      valid: r?.valid ?? 0,
      invalid: r?.invalid ?? 0,
      value: round2(r?.value ?? 0),
      invalidValue: round2(r?.invalid_value ?? 0)
    }
  })

  const programRows = (from_: string, to: string) =>
    db
      .prepare(
        `SELECT COALESCE(program_name, 'Programa ' || program_id, 'Sin programa') AS label,
                COUNT(*) AS count, COALESCE(SUM(order_value), 0) AS value
         FROM sales WHERE valid = 1 AND occurred_at >= ? AND occurred_at < ?
         GROUP BY program_id ORDER BY value DESC`
      )
      .all(from_, to) as Array<{ label: string; count: number; value: number }>
  const prevByLabel = new Map(programRows(prevFrom, from).map((r) => [r.label, r.value]))
  const byProgram = topWithOthers(programRows(from, nowIso).map((r) => ({ ...r, value: round2(r.value) }))).map((r) => {
    const prevValue =
      r.label === 'Otros'
        ? null
        : prevByLabel.get(r.label) ?? 0
    return { ...r, delta: prevValue == null ? null : delta(r.value, prevValue) }
  })

  const topAffiliates = (
    db
      .prepare(
        `SELECT s.affiliate_id AS id, COALESCE(a.name, 'Afiliado ' || s.affiliate_id) AS label,
                COUNT(*) AS count, COALESCE(SUM(s.order_value), 0) AS value
         FROM sales s LEFT JOIN affiliates a ON a.id = s.affiliate_id
         WHERE s.valid = 1 AND s.occurred_at >= ? AND s.occurred_at < ?
         GROUP BY s.affiliate_id ORDER BY value DESC LIMIT 8`
      )
      .all(from, nowIso) as Array<{ id: number; label: string; count: number; value: number }>
  ).map((r) => ({ ...r, value: round2(r.value) }))

  const upcomingCount = (days: number) =>
    (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM sales
           WHERE valid = 1 AND renewal_status = 'pending' AND renewal_due_at >= ? AND renewal_due_at < ?`
        )
        .get(nowIso, new Date(now.getTime() + days * DAY).toISOString()) as { n: number }
    ).n
  const upcoming = {
    in30: upcomingCount(30),
    in60: upcomingCount(60),
    in90: upcomingCount(90),
    next: db
      .prepare(
        `SELECT s.transaction_id, s.order_number, s.order_value, s.renewal_due_at,
                COALESCE(a.name, 'Afiliado ' || s.affiliate_id) AS affiliate_name
         FROM sales s LEFT JOIN affiliates a ON a.id = s.affiliate_id
         WHERE s.valid = 1 AND s.renewal_status = 'pending' AND s.renewal_due_at >= ?
         ORDER BY s.renewal_due_at LIMIT 6`
      )
      .all(nowIso)
  }

  // Afiliados del periodo repartidos en tres grupos por importe: el 20 % de arriba, el 30 % siguiente y el resto.
  const segments = segmentAffiliates(
    (
      db
        .prepare(
          `SELECT s.affiliate_id AS id, COALESCE(a.name, 'Afiliado ' || s.affiliate_id) AS label,
                  COUNT(*) AS count, COALESCE(SUM(s.order_value), 0) AS value
           FROM sales s LEFT JOIN affiliates a ON a.id = s.affiliate_id
           WHERE s.valid = 1 AND s.occurred_at >= ? AND s.occurred_at < ?
           GROUP BY s.affiliate_id ORDER BY value DESC`
        )
        .all(from, nowIso) as Array<{ id: number; label: string; count: number; value: number }>
    ).map((r) => ({ ...r, value: round2(r.value) }))
  )

  // Ventas válidas de los últimos 30 días, día a día.
  const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const dailyFrom = new Date(dayStart - 29 * DAY).toISOString()
  const dailyRows = db
    .prepare(
      `SELECT substr(occurred_at, 1, 10) AS day, COUNT(*) AS count FROM sales
       WHERE valid = 1 AND occurred_at >= ? AND occurred_at < ? GROUP BY day`
    )
    .all(dailyFrom, nowIso) as Array<{ day: string; count: number }>
  const daily = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(dayStart - (29 - i) * DAY).toISOString().slice(0, 10)
    return { day, count: dailyRows.find((d) => d.day === day)?.count ?? 0 }
  })

  // Renovaciones pendientes que vencen en cada una de las próximas 12 semanas.
  const weekly = Array.from({ length: 12 }, (_, i) => {
    const a = new Date(dayStart + i * 7 * DAY)
    const b = new Date(dayStart + (i + 1) * 7 * DAY)
    const n = (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM sales WHERE valid = 1 AND renewal_status = 'pending'
           AND renewal_due_at >= ? AND renewal_due_at < ?`
        )
        .get(a.toISOString(), b.toISOString()) as { n: number }
    ).n
    return { week: a.toISOString().slice(0, 10), count: n }
  })

  // Tasa de renovación por mes de vencimiento (solo ventas con respuesta del partner).
  const healthRows = db
    .prepare(
      `SELECT substr(renewal_due_at, 1, 7) AS month, SUM(renewal_status = 'renewed') AS renewed,
              SUM(renewal_status = 'not_renewed') AS lost
       FROM sales WHERE valid = 1 AND renewal_due_at >= ? AND renewal_due_at < ? GROUP BY month`
    )
    .all(monthStart(now, 11).toISOString(), nowIso) as Array<{ month: string; renewed: number; lost: number }>
  const renewalHealth = monthKeys(now, 12).map((month) => {
    const h = healthRows.find((r) => r.month === month)
    const decided = (h?.renewed ?? 0) + (h?.lost ?? 0)
    return { month, decided, rate: decided ? Math.round(((h!.renewed ?? 0) / decided) * 1000) / 10 : null }
  })

  const latest = db
    .prepare(
      `SELECT s.transaction_id, s.occurred_at, s.order_number, s.order_value, s.valid, s.renewal_status, s.program_name,
              COALESCE(a.name, 'Afiliado ' || s.affiliate_id) AS affiliate_name
       FROM sales s LEFT JOIN affiliates a ON a.id = s.affiliate_id
       ORDER BY s.occurred_at DESC LIMIT 8`
    )
    .all()

  return {
    period,
    from,
    kpis: {
      sales: { value: cur.count, delta: delta(cur.count, prev.count) },
      revenue: { value: round2(cur.value), delta: delta(cur.value, prev.value) },
      pendingRenewals: { value: ren.pending ?? 0 },
      renewalRate: { value: decided ? Math.round(((ren.renewed ?? 0) / decided) * 1000) / 10 : null, decided },
      pendingCommissions: { value: commissions.pending.amount, count: commissions.pending.count }
    },
    monthly,
    byProgram,
    topAffiliates,
    segments,
    daily,
    weekly,
    renewalHealth,
    upcoming,
    commissions,
    latest
  }
}

export type Report = ReturnType<typeof buildReport>
