// Webhook Cakto — pipeline único usado pelo webhook real E pela simulação do /admin.
//
// Regras (BANCO_DE_DADOS.md):
//  - Idempotência por provider_event_id (chave primária de payment_events).
//  - Verificação de assinatura HMAC-SHA256 quando CAKTO_WEBHOOK_SECRET está configurado.
//  - Mapeamento offer_id → produto APENAS com IDs reais configurados em env; preço nunca é entitlement.
//  - Pagamento aprovado → entitlement active; estorno/cancelamento → revoked.
//  - Payload: schema da Cakto não confirmado nesta construção — parser flexível documentado;
//    ajustar os seletores assim que a documentação oficial for conferida (ver README).

import { db } from '@/lib/db'
import { config, offerIdToProductKey, type ProductKey } from '@/lib/config'
import { createHash, createHmac } from 'crypto'

export type CaktoEvent = {
  eventId: string
  eventType: string
  buyerEmail: string | null
  offerId: string | null
  paymentId: string | null
  raw: unknown
}

export function verifyCaktoSignature(rawBody: string, signatureHeader: string | null): { verified: boolean; required: boolean } {
  const secret = config.cakto.webhookSecret
  if (!secret) return { verified: false, required: false } // modo dev: aceito, evento marcado como não verificado
  if (!signatureHeader) return { verified: false, required: true }
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  // aceita formatos comuns: "sha256=<hex>", "<hex>"
  const provided = signatureHeader.toLowerCase().replace(/^sha256=/, '').trim()
  return { verified: provided === expected, required: true }
}

/** Seletores flexíveis — a Cakto varia nomes de campo por versão de payload. */
function pick(obj: unknown, paths: string[]): unknown {
  for (const p of paths) {
    let cur: unknown = obj
    let found = true
    for (const part of p.split('.')) {
      if (cur === null || typeof cur !== 'object') {
        found = false
        break
      }
      cur = (cur as Record<string, unknown>)[part]
      if (cur === undefined || cur === null) {
        found = false
        break
      }
    }
    if (found) return cur
  }
  return undefined
}

function findEmail(obj: unknown, depth = 0): string | null {
  if (depth > 6 || typeof obj !== 'object' || obj === null) return null
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (/e-?mail/i.test(k) && typeof v === 'string' && v.includes('@')) return v
    const nested = findEmail(v, depth + 1)
    if (nested) return nested
  }
  return null
}

export function parseCaktoPayload(payload: unknown): CaktoEvent | null {
  const p = payload as Record<string, unknown>
  if (!p || typeof p !== 'object') return null

  const eventId =
    (pick(p, ['event_id', 'id', 'eventId', 'data.id', 'webhookEventId', 'data.eventId']) as string | undefined) ?? null
  const eventType =
    (pick(p, ['event', 'type', 'eventType', 'event_type', 'data.type', 'status', 'data.status']) as string | undefined) ??
    'unknown'
  const buyerEmail = findEmail(p)
  const offerId =
    (pick(p, ['offer.id', 'offerId', 'offer_id', 'product.id', 'productId', 'product_id', 'data.offerId']) as
      | string
      | undefined) ?? null
  const paymentId =
    (pick(p, ['payment.id', 'paymentId', 'payment_id', 'transaction.id', 'transactionId', 'transaction_id', 'subscription.id', 'order.id', 'data.paymentId', 'data.id']) as
      | string
      | undefined) ?? null

  if (!eventId) return null
  return { eventId, eventType, buyerEmail, offerId, paymentId, raw: payload }
}

export type ProcessResult = {
  duplicate: boolean
  mapped: boolean
  productKey: ProductKey | null
  action: 'granted' | 'revoked' | 'ignored' | 'unmapped_offer' | 'missing_email' | 'unverified'
  message: string
}

/** Classifica o evento por padrões de nome comuns; ajuste fino quando a doc oficial for conferida. */
function isApproved(type: string): boolean {
  return /approve|paid|completed|confirm|purchase|sale/i.test(type)
}
function isRevoking(type: string): boolean {
  return /refund|cancel|chargeback|dispute|revoke|refused|failed|expired/i.test(type)
}

export async function processCaktoEvent(event: CaktoEvent, opts: { signatureVerified: boolean; simulated: boolean }): Promise<ProcessResult> {
  // idempotência
  const existing = await db.paymentEvent.findUnique({ where: { providerEventId: event.eventId } })
  if (existing) {
    return { duplicate: true, mapped: true, productKey: null, action: 'ignored', message: 'Evento já processado anteriormente (idempotente).' }
  }

  const payloadHash = createHash('sha256').update(JSON.stringify(event.raw)).digest('hex')
  const record = await db.paymentEvent.create({
    data: {
      providerEventId: event.eventId,
      provider: 'cakto',
      paymentId: event.paymentId,
      payloadHash,
      eventType: event.eventType,
      simulated: opts.simulated,
    },
  })

  if (!opts.signatureVerified && !opts.simulated && config.cakto.webhookSecret) {
    await db.paymentEvent.update({ where: { providerEventId: record.providerEventId }, data: { result: 'assinatura inválida — evento ignorado' } })
    return { duplicate: false, mapped: false, productKey: null, action: 'unverified', message: 'Assinatura HMAC inválida — evento rejeitado.' }
  }

  if (event.eventType === 'unknown' || (!isApproved(event.eventType) && !isRevoking(event.eventType))) {
    await db.paymentEvent.update({ where: { providerEventId: record.providerEventId }, data: { result: 'tipo de evento não mapeado' } })
    return { duplicate: false, mapped: false, productKey: null, action: 'ignored', message: `Evento "${event.eventType}" registrado, porém não mapeado para concessão/revogação.` }
  }

  if (!event.buyerEmail) {
    await db.paymentEvent.update({ where: { providerEventId: record.providerEventId }, data: { result: 'e-mail do comprador ausente' } })
    return { duplicate: false, mapped: false, productKey: null, action: 'missing_email', message: 'Evento sem e-mail do comprador — reconciliação manual necessária.' }
  }

  const productKey = offerIdToProductKey(event.offerId ?? '')
  if (!productKey) {
    await db.paymentEvent.update({ where: { providerEventId: record.providerEventId }, data: { result: `offer_id não configurada: ${event.offerId ?? '—'}` } })
    return {
      duplicate: false,
      mapped: false,
      productKey: null,
      action: 'unmapped_offer',
      message: `offer_id "${event.offerId ?? '—'}" não corresponde a nenhum produto configurado (CAKTO_OFFER_*). Nenhum acesso concedido.`,
    }
  }

  const email = event.buyerEmail.toLowerCase()
  const paymentId = event.paymentId ?? event.eventId

  if (isApproved(event.eventType)) {
    const user = await db.user.findUnique({ where: { email } })
    await db.entitlement.upsert({
      where: { paymentId },
      update: { status: 'active', grantedAt: new Date(), revokedAt: null, userId: user?.id },
      create: {
        buyerEmail: email,
        offerId: event.offerId ?? 'unknown',
        productKey,
        paymentId,
        status: 'active',
        grantedAt: new Date(),
        userId: user?.id,
      },
    })
    // simulação também deve atualizar vínculo de usuários existentes
    if (!user) {
      await db.entitlement.updateMany({ where: { paymentId }, data: { userId: null } })
    }
    await db.paymentEvent.update({ where: { providerEventId: record.providerEventId }, data: { result: `entitlement ativo: ${productKey}` } })
    return { duplicate: false, mapped: true, productKey, action: 'granted', message: `Acesso concedido: ${productKey} para ${email}.` }
  }

  // evento de revogação
  const result = await db.entitlement.updateMany({
    where: { paymentId },
    data: { status: 'revoked', revokedAt: new Date() },
  })
  await db.paymentEvent.update({
    where: { providerEventId: record.providerEventId },
    data: { result: result.count > 0 ? 'entitlement revogado' : 'nenhum entitlement correspondente' },
  })
  return {
    duplicate: false,
    mapped: true,
    productKey,
    action: 'revoked',
    message:
      result.count > 0
        ? `Acesso revogado (payment ${paymentId}).`
        : `Evento de revogação sem entitlement correspondente (payment ${paymentId}) — nada alterado.`,
  }
}
