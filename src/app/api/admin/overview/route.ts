import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { apiError } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { config } from '@/lib/config'

// GET /api/admin/overview — números da curadoria e integrações.
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return apiError('forbidden', 'Acesso restrito à administração.', 403)

  const [totalEntries, published, pdfLiteral, editorial, draft, aliasesDraft, aliasesActive, savedCount, searchCount] =
    await Promise.all([
      db.dreamEntry.count(),
      db.dreamEntry.count({ where: { reviewStatus: 'published' } }),
      db.dreamEntry.count({ where: { sourceType: 'pdf_literal' } }),
      db.dreamEntry.count({ where: { sourceType: 'editorial' } }),
      db.dreamEntry.count({ where: { reviewStatus: 'draft' } }),
      db.entryAlias.count({ where: { status: 'draft' } }),
      db.entryAlias.count({ where: { status: 'active' } }),
      db.savedEntry.count(),
      db.searchLog.count(),
    ])

  const recentPayments = await db.paymentEvent.findMany({ orderBy: { processedAt: 'desc' }, take: 8 })
  const entitlements = await db.entitlement.findMany({ orderBy: { createdAt: 'desc' }, take: 10 })
  const publishedPdfLiteral = await db.dreamEntry.count({ where: { sourceType: 'pdf_literal', reviewStatus: 'published' } })
  const publishedEditorial = await db.dreamEntry.count({ where: { sourceType: 'editorial', reviewStatus: 'published' } })

  return NextResponse.json({
    counts: {
      totalEntries, // 670 = 538 PDF + 132 editoriais
      published,
      pdfLiteral,
      editorial,
      draft,
      aliasesDraft,
      aliasesActive,
      savedCount,
      searchCount,
      workRecordsTotal: totalEntries + aliasesDraft + aliasesActive, // 1.076 registros de trabalho
    },
    publishedBreakdown: { pdfLiteral: publishedPdfLiteral, editorial: publishedEditorial },
    coverage: {
      pdfLiteralPublished: publishedPdfLiteral,
      pdfLiteralTotal: pdfLiteral,
      metaDobro: pdfLiteral * 2,
    },
    integrations: {
      smtpConfigured: config.smtpConfigured,
      webhookSecretConfigured: !!config.cakto.webhookSecret,
      offersConfigured: {
        book_pdf: !!config.cakto.offerBookPdf,
        book_app: !!config.cakto.offerBookApp,
        upgrade: !!config.cakto.offerUpgrade,
        federal: !!config.cakto.offerFederal,
      },
      federalFeedConfigured: config.federalFeedConfigured,
      demoMode: config.demoMode,
    },
    recentPayments: recentPayments.map((p) => ({
      eventId: p.providerEventId,
      eventType: p.eventType,
      paymentId: p.paymentId,
      result: p.result,
      simulated: p.simulated,
      processedAt: p.processedAt,
    })),
    entitlements: entitlements.map((e) => ({
      id: e.id,
      buyerEmail: e.buyerEmail,
      productKey: e.productKey,
      status: e.status,
      paymentId: e.paymentId,
      grantedAt: e.grantedAt,
      revokedAt: e.revokedAt,
    })),
  })
}
