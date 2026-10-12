// Entitlements — qual e-mail tem direito a qual produto.
// Regra central: NUNCA conceder acesso por URL, query string ou preço exibido.
// O acesso nasce de Entitlement.status === 'active' vinculado a pagamento confirmado.

import { db } from '@/lib/db'
import type { ProductKey } from '@/lib/config'

export type EntitlementInfo = {
  productKey: ProductKey
  status: string
  offerId: string
  grantedAt: Date | null
  paymentId: string
}

export async function getActiveEntitlements(email: string): Promise<EntitlementInfo[]> {
  const rows = await db.entitlement.findMany({
    where: { buyerEmail: email.toLowerCase(), status: 'active' },
    orderBy: { grantedAt: 'desc' },
  })
  return rows.map((r) => ({
    productKey: r.productKey as ProductKey,
    status: r.status,
    offerId: r.offerId,
    grantedAt: r.grantedAt,
    paymentId: r.paymentId,
  }))
}

export async function hasProduct(email: string, product: ProductKey): Promise<boolean> {
  const rows = await getActiveEntitlements(email)
  return rows.some((r) => r.productKey === product)
}

/** Pacote completo (app) liberado? */
export async function hasAppAccess(email: string): Promise<boolean> {
  return hasProduct(email, 'book_app')
}

/** Acesso ao PDF (comprador do PDF ou do pacote completo). */
export async function hasPdfAccess(email: string): Promise<boolean> {
  const rows = await getActiveEntitlements(email)
  return rows.some((r) => r.productKey === 'book_pdf' || r.productKey === 'book_app')
}

/** Federal: entitlement separado E fonte de dados configurada. */
export async function federalAvailable(email: string): Promise<{ entitled: boolean; feedConfigured: boolean }> {
  const entitled = await hasProduct(email, 'federal_addon')
  return { entitled, feedConfigured: federalFeedConfigured() }
}

function federalFeedConfigured(): boolean {
  return !!process.env.FEDERAL_FEED_URL && process.env.FEDERAL_FEED_URL.trim() !== ''
}
