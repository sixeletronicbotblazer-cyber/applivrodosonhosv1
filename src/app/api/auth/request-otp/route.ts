import { NextResponse } from 'next/server'
import { requestOtp } from '@/lib/auth'
import { clientIp } from '@/lib/rate-limit'
import { apiError } from '@/lib/api-helpers'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// POST /api/auth/request-otp — gera e envia código de 6 dígitos por e-mail.
// Resposta genérica: não revela se o e-mail possui compra (privacidade).
export async function POST(req: Request) {
  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return apiError('bad_request', 'Corpo inválido.', 400)
  }
  const email = (body.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return apiError('bad_request', 'Informe um e-mail válido.', 400)
  }
  const ip = clientIp(req)
  const result = await requestOtp(email, ip)

  if (!result.ok) {
    if (result.reason === 'rate_limited') {
      return apiError('rate_limited', `Muitas solicitações. Tente novamente em ${Math.ceil((result.retryAfterSeconds ?? 60) / 60)} min.`, 429, { retryAfterSeconds: result.retryAfterSeconds })
    }
    if (result.reason === 'cooldown') {
      return apiError('rate_limited', `Aguarde ${result.retryAfterSeconds ?? 60} s para solicitar um novo código.`, 429, { retryAfterSeconds: result.retryAfterSeconds })
    }
    if (result.reason === 'smtp_error') {
      return apiError('server_error', 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.', 502)
    }
  }

  return NextResponse.json({
    sent: true,
    message: 'Se este e-mail tiver acesso ao aplicativo, o código de 6 dígitos chegará em instantes.',
    transport: result.ok ? result.transport : undefined,
    devCode: result.ok ? result.devCode : undefined, // presente APENAS em modo de desenvolvimento isolado (SMTP não configurado)
    resendCooldownSeconds: result.ok ? result.resendCooldownSeconds : 60,
  })
}
