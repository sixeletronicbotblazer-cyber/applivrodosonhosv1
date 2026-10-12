import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { hasAppAccess } from '@/lib/entitlements'
import { apiError } from '@/lib/api-helpers'
import { db } from '@/lib/db'

// GET /api/index — índice A–Z dos verbetes publicados (pacote completo).
export async function GET() {
  const auth = await getAuth()
  if (!auth) return apiError('auth_required', 'Entre com seu e-mail para consultar.', 401)
  if (!(await hasAppAccess(auth.email))) {
    return apiError('upgrade_required', 'O índice faz parte do pacote Livro + Aplicativo.', 403, { product: 'book_app' })
  }

  const rows = await db.dreamEntry.findMany({
    where: { reviewStatus: 'published' },
    select: { slug: true, title: true, sourceType: true, sourcePrintPage: true },
    orderBy: { title: 'asc' },
  })

  const letters = new Map<string, { slug: string; title: string; sourceType: string; printPage: number | null }[]>()
  for (const r of rows) {
    const first = (r.title.trim()[0] ?? '#').toUpperCase().normalize('NFD').replace(/[^A-Z]/g, '') || '#'
    const list = letters.get(first) ?? []
    list.push({ slug: r.slug, title: r.title, sourceType: r.sourceType, printPage: r.sourcePrintPage })
    letters.set(first, list)
  }
  const groups = [...letters.entries()]
    .map(([letter, entries]) => ({ letter, entries }))
    .sort((a, b) => a.letter.localeCompare(b.letter, 'pt-BR'))

  return NextResponse.json({ letters: groups, total: rows.length })
}
