export type CommissionType = 'percent' | 'fixed'

export interface CommissionRule {
  type: CommissionType
  value: number
}

/** Importe de la comisión, redondeado a céntimos. Nunca negativo. */
export function computeCommission(rule: CommissionRule, baseAmount: number): number {
  if (!Number.isFinite(rule.value) || rule.value <= 0) return 0
  const raw = rule.type === 'percent' ? (baseAmount * rule.value) / 100 : rule.value
  return Math.max(0, Math.round(raw * 100) / 100)
}
