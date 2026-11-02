export type RenewalStatus = 'renewed' | 'not_renewed' | 'unknown'

export interface RenewalCheck {
  status: RenewalStatus
  /** Importe de la renovación, si el partner lo informa. Si no, se usa el de la venta original. */
  amount?: number
}

export interface SaleRef {
  transactionId: number
  orderNumber: string | null
  affiliateId: number
  orderValue: number | null
}

/** Contrato que cumplirá el adaptador real cuando tengamos la documentación del partner. */
export interface PartnerAdapter {
  checkRenewal(sale: SaleRef): Promise<RenewalCheck>
}

/** Simulado y determinista: renueva ~60 % de las ventas según su ID. */
export class MockPartner implements PartnerAdapter {
  async checkRenewal(sale: SaleRef): Promise<RenewalCheck> {
    return sale.transactionId % 10 < 6
      ? { status: 'renewed', amount: sale.orderValue ?? undefined }
      : { status: 'not_renewed' }
  }
}

export function getPartner(mode: string): PartnerAdapter {
  if (mode === 'mock') return new MockPartner()
  throw new Error('Adaptador real del partner aún no implementado: usa PARTNER_MODE=mock')
}
