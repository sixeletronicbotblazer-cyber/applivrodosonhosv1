import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { apiError } from '@/lib/api-helpers'
import { processCaktoEvent, type CaktoEvent } from '@/lib/webhook-cakto'

// POST /api/admin/payments/simulate — executa o MESMO pipeline do webhook
// com eventos simulados (teste local por eventos, como pedido na especificação).
// Em produção, desativar via DEMO_MODE=false (a UI não exibe a simulação).
export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return apiError('forbidden', 'Acesso restrito à administração.', 403)

  const body = (await req.json().catch(() => ({}))) as {
    eventType?: string
    email?: string
    offerId?: string
    paymentId?: string
  }
  const eventType = (body.eventType ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const offerId = (body.offerId ?? '').trim()
  if (!eventType || !email || !offerId) {
    return apiError('bad_request', 'Informe tipo de evento, e-mail e offer_id.', 400)
  }

  const eventId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const event: CaktoEvent = {
    eventId,
    eventType,
    buyerEmail: email,
    offerId,
    paymentId: body.paymentId?.trim() || `sim-pay-${eventId}`,
    raw: { simulated: true, event: eventType, customer: { email }, offer: { id: offerId }, payment: { id: body.paymentId ?? `sim-pay-${eventId}` } },
  }

  // simulação segue o pipeline completo (idempotência, mapeamento, concessão/revogação)
  const result = await processCaktoEvent(event, { signatureVerified: true, simulated: true })
  return NextResponse.json({ eventId, ...result })
}
