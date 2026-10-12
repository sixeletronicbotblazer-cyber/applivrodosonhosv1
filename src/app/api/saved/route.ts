import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { hasAppAccess } from '@/lib/entitlements'
import { apiError } from '@/lib/api-helpers'
import { db } from '@/lib/db'

// GET /api/saved — verbetes salvos do usuário.
export async function GET(req: Request) {
  const auth = await getAuth(req)
  if (!auth) return apiError('auth_required', 'Entre com seu e-mail.', 401)
  if (!(await hasAppAccess(auth.email))) return apiError('upgrade_required', 'Recurso do pacote Livro + Aplicativo.', 403)

  const rows = await db.savedEntry.findMany({
    where: { userId: auth.userId },
    include: { entry: { include: { association: true } } },
    orderBy: { savedAt: 'desc' },
  })
  return NextResponse.json({
    items: rows.map((r) => ({
      slug: r.entry.slug,
      title: r.entry.title,
      sourceType: r.entry.sourceType,
      printPage: r.entry.sourcePrintPage,
      pdfPage: r.entry.sourcePdfPage,
      animal: r.entry.association?.animal ?? null,
      dezena: r.entry.association?.dezena ?? null,
      savedAt: r.savedAt,
    })),
  })
}

// POST /api/saved — salva verbete { slug }
export async function POST(req: Request) {
  const auth = await getAuth(req)
  if (!auth) return apiError('auth_required', 'Entre com seu e-mail.', 401)
  if (!(await hasAppAccess(auth.email))) return apiError('upgrade_required', 'Recurso do pacote Livro + Aplicativo.', 403)

  const body = (await req.json().catch(() => ({}))) as { slug?: string }
  if (!body.slug) return apiError('bad_request', 'Informe o slug.', 400)
  const entry = await db.dreamEntry.findUnique({ where: { slug: body.slug }, select: { id: true, reviewStatus: true } })
  if (!entry || entry.reviewStatus !== 'published') return apiError('not_found', 'Verbete não disponível.', 404)

  await db.savedEntry.upsert({
    where: { userId_entryId: { userId: auth.userId, entryId: entry.id } },
    update: {},
    create: { userId: auth.userId, entryId: entry.id },
  })
  return NextResponse.json({ ok: true, saved: true })
}

// DELETE /api/saved?slug=… (um) ou ?all=1 (todos) — apagar é sempre permitido ao dono.
export async function DELETE(req: Request) {
  const auth = await getAuth(req)
  if (!auth) return apiError('auth_required', 'Entre com seu e-mail.', 401)
  const params = new URL(req.url).searchParams
  if (params.get('all') === '1') {
    await db.savedEntry.deleteMany({ where: { userId: auth.userId } })
    return NextResponse.json({ ok: true, clearedAll: true })
  }
  const slug = params.get('slug')
  if (!slug) return apiError('bad_request', 'Informe o slug.', 400)
  const entry = await db.dreamEntry.findUnique({ where: { slug }, select: { id: true } })
  if (entry) await db.savedEntry.deleteMany({ where: { userId: auth.userId, entryId: entry.id } })
  return NextResponse.json({ ok: true, saved: false })
}
