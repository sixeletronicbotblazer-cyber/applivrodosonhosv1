import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { hasAppAccess } from '@/lib/entitlements'
import { apiError } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { normalizeText } from '@/lib/normalize'

// GET /api/entries?slug=… — detalhe do verbete publicado (pacote completo).
// Conteúdo editorial traz o bloco de associação atribuído ao verbete-base, nunca como número próprio.
export async function GET(req: Request) {
  const auth = await getAuth(req)
  if (!auth) return apiError('auth_required', 'Entre com seu e-mail para consultar.', 401)
  if (!(await hasAppAccess(auth.email))) {
    return apiError('upgrade_required', 'Os verbetes fazem parte do pacote Livro + Aplicativo.', 403, { product: 'book_app' })
  }

  const slug = new URL(req.url).searchParams.get('slug')
  if (!slug) return apiError('bad_request', 'Informe o slug do verbete.', 400)

  const entry = await db.dreamEntry.findUnique({
    where: { slug },
    include: {
      association: true,
      relatedPdf: { include: { association: true } },
      aliases: { where: { status: 'active' } },
    },
  })
  if (!entry || entry.reviewStatus !== 'published') {
    return apiError('not_found', 'Verbete não encontrado ou ainda em revisão.', 404)
  }

  const relatedEditorial = await db.dreamEntry.findMany({
    where: { relatedPdfId: entry.id, reviewStatus: 'published', sourceType: 'editorial' },
    select: { slug: true, title: true, meaning: true },
    orderBy: { title: 'asc' },
  })

  const saved = await db.savedEntry.findUnique({
    where: { userId_entryId: { userId: auth.userId, entryId: entry.id } },
  })

  const base = entry.sourceType === 'editorial' ? entry.relatedPdf : null

  return NextResponse.json({
    entry: {
      id: entry.id,
      slug: entry.slug,
      title: entry.title,
      sourceType: entry.sourceType,
      meaning: entry.meaning,
      category: entry.category,
      pdfPage: entry.sourcePdfPage,
      printPage: entry.sourcePrintPage,
      aliases: entry.aliases.map((a) => a.alias),
      association: entry.association
        ? {
            animal: entry.association.animal,
            group: entry.association.groupNumber,
            dezena: entry.association.dezena,
            centena: entry.association.centena,
            milhar: entry.association.milhar,
            loto: entry.association.loto,
            evidencePdfPage: entry.association.evidencePdfPage,
          }
        : null,
      editorialBase: base
        ? {
            slug: base.slug,
            title: base.title,
            meaning: base.meaning,
            pdfPage: base.sourcePdfPage,
            printPage: base.sourcePrintPage,
            association: base.association
              ? {
                  animal: base.association.animal,
                  group: base.association.groupNumber,
                  dezena: base.association.dezena,
                  centena: base.association.centena,
                  milhar: base.association.milhar,
                  evidencePdfPage: base.association.evidencePdfPage,
                }
              : null,
          }
        : null,
      relatedEditorial: relatedEditorial.map((r) => ({
        slug: r.slug,
        title: r.title,
        meaning: r.meaning,
        isCurrent: normalizeText(r.title) === normalizeText(entry.title),
      })),
      saved: !!saved,
      reviewerNote: entry.reviewerNote,
    },
  })
}
