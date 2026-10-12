import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { apiError } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { invalidateSearchIndex } from '@/lib/search'

// POST /api/admin/entries/bulk — publicar/devolver em lote { ids: string[], action: 'publish'|'unpublish' }
// Regra: editorial sem vínculo e literal sem página nunca são publicados (falha detalhada por id).
export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return apiError('forbidden', 'Acesso restrito à administração.', 403)

  const body = (await req.json().catch(() => ({}))) as { ids?: string[]; action?: 'publish' | 'unpublish' }
  const ids = (body.ids ?? []).filter(Boolean)
  if (ids.length === 0) return apiError('bad_request', 'Selecione ao menos um verbete.', 400)
  const action = body.action === 'unpublish' ? 'unpublish' : 'publish'

  const results: { id: string; ok: boolean; reason?: string }[] = []
  for (const id of ids) {
    const entry = await db.dreamEntry.findUnique({ where: { id } })
    if (!entry) {
      results.push({ id, ok: false, reason: 'não encontrado' })
      continue
    }
    if (action === 'publish') {
      if (entry.sourceType === 'pdf_literal' && !entry.sourcePdfPage) {
        results.push({ id, ok: false, reason: 'literal sem página de origem' })
        continue
      }
      if (entry.sourceType === 'editorial' && !entry.relatedPdfId) {
        results.push({ id, ok: false, reason: 'editorial sem verbete-base' })
        continue
      }
    }
    await db.dreamEntry.update({
      where: { id },
      data: { reviewStatus: action === 'publish' ? 'published' : 'draft', reviewedAt: new Date(), version: { increment: 1 } },
    })
    results.push({ id, ok: true })
  }

  invalidateSearchIndex()
  return NextResponse.json({
    ok: results.every((r) => r.ok),
    published: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok),
  })
}
