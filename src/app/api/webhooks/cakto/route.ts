import { NextResponse } from 'next/server'
import { verifyCaktoSignature, parseCaktoPayload, processCaktoEvent } from '@/lib/webhook-cakto'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { apiError } from '@/lib/api-helpers'

// POST /api/webhooks/cakto — recepção de eventos de pagamento.
// - Assinatura HMAC verificada quando CAKTO_WEBHOOK_SECRET está configurado.
// - Idempotente por ID de evento (reprocessar o mesmo evento não duplica acesso).
// - Concessão apenas com pagamento aprovado e offer_id mapeada em CAKTO_OFFER_*.
export async function POST(req: Request) {
  const limit = rateLimit(`cakto:${clientIp(req)}`, 120, 60 * 1000)
  if (!limit.ok) return apiError('rate_limited', 'Muitas requisições.', 429)

  const raw = await req.text()
  const sig = req.headers.get('x-cakto-signature') ?? req.headers.get('x-signature') ?? req.headers.get('signature')
  const sigCheck = verifyCaktoSignature(raw, sig)
  if (sigCheck.required && !sigCheck.verified) {
    return apiError('forbidden', 'Assinatura inválida.', 403)
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return apiError('bad_request', 'Payload não é JSON válido.', 400)
  }

  const event = parseCaktoPayload(payload)
  if (!event) {
    return apiError('bad_request', 'Não foi possível identificar o ID do evento — reconciliação manual necessária.', 422)
  }

  const result = await processCaktoEvent(event, { signatureVerified: sigCheck.verified || !sigCheck.required, simulated: false })
  return NextResponse.json({ received: true, ...result })
}
