import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { config } from '@/lib/config'
import { createSession } from '@/lib/auth'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { apiError } from '@/lib/api-helpers'
import { getActiveEntitlements } from '@/lib/entitlements'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// POST /api/auth/access — acesso pelo e-mail da compra, sem código de 6 dígitos.
//
// Produção: o direito de acesso nasce do pagamento confirmado (webhook da
// plataforma de pagamento cria Entitlements vinculados ao e-mail). O login só
// estabelece sessão quando existe entitlement ativo; caso contrário responde de
// forma neutra (a tela nunca menciona detalhes técnicos de integração).
//
// Prévia/demonstração (DEMO_MODE): estabelece a sessão de demonstração e concede
// o pacote completo para qualquer e-mail válido, preservando as contas de
// demonstração já semeadas (pdf@ mostra o estado "só PDF"; outro@ mostra o
// estado "sem compra"). Esse comportamento NUNCA existe em produção.
export async function POST(req: Request) {
  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return apiError('bad_request', 'Corpo inválido.', 400)
  }
  const email = (body.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return apiError('invalid_email', 'Confira o e-mail digitado — parece incompleto.', 400)
  }

  const ip = clientIp(req)
  const limit = rateLimit(`access:ip:${ip}`, 20, 60 * 60 * 1000)
  if (!limit.ok) {
    return apiError('rate_limited', `Muitas tentativas. Tente novamente em ${Math.ceil(limit.retryAfterSeconds / 60)} min.`, 429, {
      retryAfterSeconds: limit.retryAfterSeconds,
    })
  }

  let user = await db.user.findUnique({ where: { email } })
  let entitlements = await getActiveEntitlements(email)

  if (!config.demoMode) {
    // Produção: sessão apenas com compra confirmada vinculada a este e-mail.
    if (!user || entitlements.length === 0) {
      return apiError(
        'purchase_not_found',
        'Não localizamos um acesso ativo para este e-mail. Se você acabou de comprar, aguarde alguns minutos e tente novamente.',
        403,
      )
    }
  } else if (entitlements.length === 0 && email !== 'outro@livrodossonhos.app') {
    // Prévia: sessão de demonstração com o pacote completo (idempotente).
    if (!user) user = await db.user.create({ data: { email, role: 'USER' } })
    const demoPaymentId = `demo-access-${createHash('sha1').update(email).digest('hex').slice(0, 24)}`
    await db.entitlement.upsert({
      where: { paymentId: demoPaymentId },
      update: { status: 'active', userId: user.id },
      create: {
        userId: user.id,
        buyerEmail: email,
        offerId: 'DEMO-OFFER-BOOK-APP',
        productKey: 'book_app',
        paymentId: demoPaymentId,
        status: 'active',
        grantedAt: new Date(),
      },
    })
    entitlements = await getActiveEntitlements(email)
  } else if (!user) {
    user = await db.user.create({ data: { email, role: 'USER' } })
  }

  const token = await createSession(user, ip)

  return NextResponse.json({
    // token também no corpo: fallback Bearer para contextos onde o cookie de
    // sessão não circula (prévia incorporada em iframe cross-site). Em
    // produção com cookie o valor é o mesmo do cookie httpOnly.
    token,
    user: { email: user.email, role: user.role },
    entitlements: entitlements.map((e) => ({ productKey: e.productKey, status: e.status, grantedAt: e.grantedAt })),
  })
}
