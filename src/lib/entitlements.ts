// Entitlements — qual e-mail tem direito a qual produto.
// Regra central: NUNCA conceder acesso por URL, query string ou preço exibido.
// O acesso nasce de Entitlement.status === 'active' vinculado a pagamento confirmado.

import { db } from '@/lib/db'
import { config } from '@/lib/config'
import { createHash } from 'crypto'
import type { ProductKey } from '@/lib/config'

export type EntitlementInfo = {
  productKey: ProductKey
  status: string
  offerId: string
  grantedAt: Date | null
  paymentId: string
}

/** Prévia pública na Vercel: cada rota de API roda em lambda própria, com cópia
 *  do banco em /tmp — writes não são compartilhados entre instâncias. Para o
 *  acesso de demonstração ficar consistente em QUALQUER instância, o entitlement
 *  demo é DERIVADO do e-mail (sem escrita) quando não existe registro ativo.
 *  Nunca ativo em produção (exige DEMO_MODE=false no painel). */
function isServerlessDemoPreview(): boolean {
  return process.env.VERCEL === '1' && config.demoMode
}

function demoPreviewEntitlements(email: string): EntitlementInfo[] {
  const normalized = email.trim().toLowerCase()
  // conta semeadas que representam estados especiais: pdf@ (só PDF, vem do banco)
  // e outro@ (sem compra) — esta última NUNCA recebe o pacote demo.
  if (normalized === 'outro@livrodossonhos.app') return []
  return [
    {
      productKey: 'book_app',
      status: 'active',
      offerId: 'DEMO-OFFER-BOOK-APP',
      grantedAt: new Date(),
      paymentId: `demo-preview-${createHash('sha1').update(normalized).digest('hex').slice(0, 24)}`,
    },
  ]
}

export async function getActiveEntitlements(email: string): Promise<EntitlementInfo[]> {
  const rows = await db.entitlement.findMany({
    where: { buyerEmail: email.toLowerCase(), status: 'active' },
    orderBy: { grantedAt: 'desc' },
  })
  if (rows.length > 0) {
    return rows.map((r) => ({
      productKey: r.productKey as ProductKey,
      status: r.status,
      offerId: r.offerId,
      grantedAt: r.grantedAt,
      paymentId: r.paymentId,
    }))
  }
  if (isServerlessDemoPreview()) return demoPreviewEntitlements(email)
  return []
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
