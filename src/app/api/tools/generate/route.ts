import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { hasAppAccess } from '@/lib/entitlements'
import { apiError } from '@/lib/api-helpers'
import { db } from '@/lib/db'

// POST /api/tools/generate — gerador de combinações por grupo.
// Método: milhares de 4 dígitos cujo par final (dezena) pertence às dezenas do grupo.
// Semente estável por sessão/dia quando solicitado — rotulada, nunca sugerindo aumento de chance.

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export async function POST(req: Request) {
  const auth = await getAuth()
  if (!auth) return apiError('auth_required', 'Entre com seu e-mail.', 401)
  if (!(await hasAppAccess(auth.email))) {
    return apiError('upgrade_required', 'O gerador faz parte do pacote Livro + Aplicativo.', 403, { product: 'book_app' })
  }

  const body = (await req.json().catch(() => ({}))) as { group?: number; count?: number; stableSeed?: boolean }
  const group = Math.round(Number(body.group))
  if (!Number.isInteger(group) || group < 1 || group > 25) {
    return apiError('bad_request', 'Escolha um grupo de 1 a 25.', 400)
  }
  const count = Math.min(12, Math.max(1, Math.round(Number(body.count) || 6)))

  const animal = await db.animalGroup.findUnique({ where: { groupNumber: group } })
  const dezenas = (animal?.dezenas ?? '').split(',').filter(Boolean)
  if (dezenas.length === 0) {
    return apiError('bad_request', 'As dezenas deste grupo ainda não foram conferidas na página 4 do PDF.', 409)
  }

  const today = new Date().toISOString().slice(0, 10)
  const seedInput = body.stableSeed === false ? `${Date.now()}-${Math.random()}` : `${today}|grupo-${group}|${auth.userId}`
  const rng = mulberry32(hashSeed(seedInput))

  const seen = new Set<string>()
  const combos: string[] = []
  while (combos.length < count) {
    const prefix = String(Math.floor(rng() * 100)).padStart(2, '0')
    const dezena = dezenas[Math.floor(rng() * dezenas.length)]
    const milhar = `${prefix}${dezena}`
    if (seen.has(milhar)) continue
    seen.add(milhar)
    combos.push(milhar)
  }

  return NextResponse.json({
    group,
    animal: animal?.animal ?? null,
    dezenas,
    combos,
    seedLabel: body.stableSeed === false ? 'aleatória (não repetida)' : `dia ${today} · grupo ${group}`,
    method:
      'Cada combinação é uma milhar de 4 dígitos cujo par final (dezena) pertence ao grupo escolhido, conforme a tabela dos bichos. Combinações para consulta; não são previsão ou recomendação de aposta.',
  })
}
