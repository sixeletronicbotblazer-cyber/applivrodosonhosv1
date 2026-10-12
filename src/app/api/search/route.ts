import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { hasAppAccess } from '@/lib/entitlements'
import { searchEntries } from '@/lib/search'
import { db } from '@/lib/db'
import { createHash } from 'crypto'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { apiError } from '@/lib/api-helpers'

// POST /api/search — busca determinística por palavra ou relato (1–500 caracteres).
// Exige pacote completo (book_app). Telemetria mínima: sem texto íntimo do sonho.
export async function POST(req: Request) {
  const auth = await getAuth(req)
  if (!auth) return apiError('auth_required', 'Entre com seu e-mail para consultar.', 401)
  if (!(await hasAppAccess(auth.email))) {
    return apiError('upgrade_required', 'A busca faz parte do pacote Livro + Aplicativo.', 403, { product: 'book_app' })
  }

  const limit = rateLimit(`search:${auth.userId}:${clientIp(req)}`, 60, 60 * 1000)
  if (!limit.ok) return apiError('rate_limited', 'Muitas buscas seguidas. Aguarde um instante.', 429)

  let body: { query?: string }
  try {
    body = await req.json()
  } catch {
    return apiError('bad_request', 'Corpo inválido.', 400)
  }
  const query = (body.query ?? '').trim()
  if (query.length < 1) return apiError('bad_request', 'Digite uma palavra ou descreva o sonho.', 400)
  if (query.length > 500) return apiError('bad_request', 'O relato pode ter até 500 caracteres.', 400)

  const started = Date.now()
  const result = await searchEntries(query)
  const durationMs = Date.now() - started

  try {
    await db.searchLog.create({
      data: {
        mode: result.mode,
        queryHash: createHash('sha256').update(query.toLowerCase()).digest('hex').slice(0, 16),
        elementCount: result.elements.length,
        resultCount: result.candidates.length,
        durationMs,
      },
    })
  } catch {
    // telemetria nunca derruba a busca
  }

  return NextResponse.json(result)
}
