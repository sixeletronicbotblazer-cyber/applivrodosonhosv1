import { NextResponse } from 'next/server'
import { verifyOtp } from '@/lib/auth'
import { clientIp } from '@/lib/rate-limit'
import { apiError, type ApiErrorCode } from '@/lib/api-helpers'
import { getActiveEntitlements } from '@/lib/entitlements'

// POST /api/auth/verify-otp — valida o código e cria a sessão (cookie httpOnly).
const REASONS: Record<string, { code: ApiErrorCode; message: string; status: number }> = {
  invalid: { code: 'invalid_code', message: 'Código incorreto. Confira os 6 dígitos.', status: 400 },
  expired: { code: 'expired_code', message: 'Código expirado. Solicite um novo.', status: 400 },
  too_many_attempts: { code: 'too_many_attempts', message: 'Muitas tentativas. Solicite um novo código.', status: 429 },
  not_found: { code: 'no_code', message: 'Nenhum código ativo para este e-mail. Solicite um novo.', status: 400 },
}

export async function POST(req: Request) {
  let body: { email?: string; code?: string }
  try {
    body = await req.json()
  } catch {
    return apiError('bad_request', 'Corpo inválido.', 400)
  }
  const email = (body.email ?? '').trim().toLowerCase()
  const code = (body.code ?? '').replace(/\D/g, '')
  if (!email || code.length !== 6) {
    return apiError('bad_request', 'Informe o e-mail e o código de 6 dígitos.', 400)
  }

  const result = await verifyOtp(email, code, clientIp(req))
  if (!result.ok) {
    const r = REASONS[result.reason]
    return apiError(r.code, r.message, r.status)
  }

  const entitlements = await getActiveEntitlements(result.email)
  return NextResponse.json({
    user: { email: result.email, role: result.role },
    entitlements: entitlements.map((e) => ({ productKey: e.productKey, status: e.status, grantedAt: e.grantedAt })),
  })
}
