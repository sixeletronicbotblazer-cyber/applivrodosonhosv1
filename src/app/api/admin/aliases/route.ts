import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { apiError } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { invalidateSearchIndex } from '@/lib/search'
import { normalizeText } from '@/lib/normalize'

// GET /api/admin/aliases?status=&page= — aliases (variações contextuais) para revisão.
export async function GET(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return apiError('forbidden', 'Acesso restrito à administração.', 403)

  const params = new URL(req.url).searchParams
  const status = params.get('status') ?? 'draft'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const pageSize = 30

  const where: Record<string, unknown> = {}
  if (['draft', 'active'].includes(status)) where.status = status

  const [total, rows] = await Promise.all([
    db.entryAlias.count({ where }),
    db.entryAlias.findMany({
      where,
      include: { entry: { include: { association: true } } },
      orderBy: { id: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json({
    total,
    page,
    pageSize,
    items: rows.map((a) => ({
      id: a.id,
      alias: a.alias,
      normalizedAlias: a.normalizedAlias,
      status: a.status,
      kind: a.kind,
      entry: {
        id: a.entry.id,
        slug: a.entry.slug,
        title: a.entry.title,
        reviewStatus: a.entry.reviewStatus,
        pdfPage: a.entry.sourcePdfPage,
        association: a.entry.association
          ? { animal: a.entry.association.animal, dezena: a.entry.association.dezena, milhar: a.entry.association.milhar }
          : null,
      },
    })),
  })
}

// PATCH /api/admin/aliases { id, status: 'active'|'draft' } — ativar alias revisado.
export async function PATCH(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return apiError('forbidden', 'Acesso restrito à administração.', 403)

  const body = (await req.json().catch(() => ({}))) as { id?: number; status?: string }
  if (!body.id || !['active', 'draft'].includes(body.status ?? '')) {
    return apiError('bad_request', 'Informe id e status válidos.', 400)
  }
  const alias = await db.entryAlias.findUnique({ where: { id: body.id }, include: { entry: true } })
  if (!alias) return apiError('not_found', 'Alias não encontrado.', 404)

  // Regra do projeto: alias só participa da busca pública se o verbete-base estiver publicado
  // (a associação numérica é sempre do verbete do livro, nunca "do alias").
  if (body.status === 'active' && alias.entry.reviewStatus !== 'published') {
    return apiError('bad_request', 'O verbete-base ainda não está publicado — publique-o antes de ativar o alias.', 400)
  }

  await db.entryAlias.update({ where: { id: body.id }, data: { status: body.status! } })
  invalidateSearchIndex()
  return NextResponse.json({ ok: true })
}

// POST /api/admin/aliases — criar alias manual { entryId, alias }
export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return apiError('forbidden', 'Acesso restrito à administração.', 403)
  const body = (await req.json().catch(() => ({}))) as { entryId?: string; alias?: string }
  if (!body.entryId || !body.alias?.trim()) return apiError('bad_request', 'Informe verbete e alias.', 400)
  const entry = await db.dreamEntry.findUnique({ where: { id: body.entryId } })
  if (!entry) return apiError('not_found', 'Verbetes não encontrado.', 404)
  const aliasText = body.alias.trim()
  try {
    await db.entryAlias.create({
      data: { entryId: entry.id, alias: aliasText, normalizedAlias: normalizeText(aliasText), kind: 'revisao_manual', status: 'draft' },
    })
  } catch {
    return apiError('bad_request', 'Alias já existe para este verbete.', 409)
  }
  invalidateSearchIndex()
  return NextResponse.json({ ok: true })
}
