import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { apiError } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { invalidateSearchIndex } from '@/lib/search'
import { slugify } from '@/lib/normalize'

// GET /api/admin/entries?status=&q=&source=&page= — lista de curadoria.
export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return apiError('forbidden', 'Acesso restrito à administração.', 403)

  const params = new URL(req.url).searchParams
  const status = params.get('status') ?? 'all'
  const source = params.get('source') ?? 'all'
  const q = (params.get('q') ?? '').trim().toLowerCase()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const pageSize = 20

  const where: Record<string, unknown> = {}
  if (['draft', 'published'].includes(status)) where.reviewStatus = status
  if (['pdf_literal', 'editorial'].includes(source)) where.sourceType = source
  if (q) where.OR = [{ title: { contains: q } }, { slug: { contains: q.replace(/\s+/g, '-') } }]

  const [total, rows] = await Promise.all([
    db.dreamEntry.count({ where }),
    db.dreamEntry.findMany({
      where,
      include: { association: true, relatedPdf: { include: { association: true } } },
      orderBy: [{ sourcePdfPage: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json({
    total,
    page,
    pageSize,
    items: rows.map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      sourceType: e.sourceType,
      kind: e.kind,
      reviewStatus: e.reviewStatus,
      pdfPage: e.sourcePdfPage,
      printPage: e.sourcePrintPage,
      meaning: e.meaning,
      reviewerNote: e.reviewerNote,
      sourceNotes: e.sourceNotes,
      association: e.association
        ? { animal: e.association.animal, group: e.association.groupNumber, dezena: e.association.dezena, centena: e.association.centena, milhar: e.association.milhar, loto: e.association.loto, evidencePdfPage: e.association.evidencePdfPage }
        : null,
      relatedBase: e.relatedPdf
        ? { id: e.relatedPdf.id, title: e.relatedPdf.title, reviewStatus: e.relatedPdf.reviewStatus, association: e.relatedPdf.association ? { animal: e.relatedPdf.association.animal, group: e.relatedPdf.association.groupNumber, dezena: e.relatedPdf.association.dezena, centena: e.relatedPdf.association.centena, milhar: e.relatedPdf.association.milhar } : null }
        : null,
    })),
  })
}

// PATCH /api/admin/entries — editar verbete (curadoria) { id, title?, meaning?, association?…, reviewStatus? }
export async function PATCH(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return apiError('forbidden', 'Acesso restrito à administração.', 403)

  const body = (await req.json().catch(() => ({}))) as {
    id?: string
    title?: string
    meaning?: string
    reviewStatus?: 'draft' | 'published'
    association?: { animal?: string; group?: number; dezena?: string; centena?: string; milhar?: string }
    reviewerNote?: string
  }
  if (!body.id) return apiError('bad_request', 'Informe o id do verbete.', 400)

  const entry = await db.dreamEntry.findUnique({ where: { id: body.id }, include: { association: true } })
  if (!entry) return apiError('not_found', 'Verbete não encontrado.', 404)

  const data: Record<string, unknown> = { version: { increment: 1 }, reviewedAt: new Date() }
  if (body.title !== undefined) {
    const t = body.title.trim()
    if (!t) return apiError('bad_request', 'Título não pode ficar vazio.', 400)
    data.title = t
    // novo slug se o título mudou e é literal
    if (entry.sourceType === 'pdf_literal' && entry.reviewStatus === 'published') {
      const newSlug = slugify(t)
      const clash = await db.dreamEntry.findFirst({ where: { slug: newSlug, NOT: { id: entry.id } } })
      if (!clash && newSlug) data.slug = newSlug
    }
  }
  if (body.meaning !== undefined) data.meaning = body.meaning.trim() || null
  if (body.reviewerNote !== undefined) data.reviewerNote = body.reviewerNote
  if (body.reviewStatus === 'published' || body.reviewStatus === 'draft') {
    // Regra: publicar literal exige página de origem; editorial exige vínculo.
    if (entry.sourceType === 'pdf_literal' && !entry.sourcePdfPage) {
      return apiError('bad_request', 'Verbete literal sem página de origem — complete a curadoria antes de publicar.', 400)
    }
    if (entry.sourceType === 'editorial' && !entry.relatedPdfId) {
      return apiError('bad_request', 'Verbete editorial sem verbete-base vinculado — não pode ser publicado.', 400)
    }
    data.reviewStatus = body.reviewStatus
  }
  if (body.association && entry.association) {
    const a = body.association
    await db.numberAssociation.update({
      where: { entryId: entry.id },
      data: {
        animal: a.animal?.toUpperCase().trim() || entry.association.animal,
        groupNumber: a.group !== undefined ? Math.min(25, Math.max(1, Math.round(a.group))) : undefined,
        dezena: a.dezena !== undefined ? a.dezena.padStart(2, '0').slice(0, 2) : undefined,
        centena: a.centena !== undefined ? a.centena.padStart(3, '0').slice(0, 3) : undefined,
        milhar: a.milhar !== undefined ? a.milhar.padStart(4, '0').slice(0, 4) : undefined,
      },
    })
  }

  await db.dreamEntry.update({ where: { id: entry.id }, data })
  invalidateSearchIndex()
  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/entries?id=… — remove apenas editoriais não publicados (literais são fonte histórica).
export async function DELETE(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return apiError('forbidden', 'Acesso restrito à administração.', 403)
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return apiError('bad_request', 'Informe o id.', 400)
  const entry = await db.dreamEntry.findUnique({ where: { id } })
  if (!entry) return apiError('not_found', 'Verbete não encontrado.', 404)
  if (entry.sourceType === 'pdf_literal') {
    return apiError('bad_request', 'Verbete do PDF não é removido: corrija os campos em revisão.', 400)
  }
  await db.dreamEntry.delete({ where: { id } })
  invalidateSearchIndex()
  return NextResponse.json({ ok: true })
}
