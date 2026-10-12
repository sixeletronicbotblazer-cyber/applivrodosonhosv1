import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { apiError } from '@/lib/api-helpers'
import { db } from '@/lib/db'

// GET /api/admin/catalog — lista itens importados (valores visíveis apenas à administração).
export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return apiError('forbidden', 'Acesso restrito à administração.', 403)
  const rows = await db.catalogItem.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  return NextResponse.json({
    items: rows.map((r) => ({ id: r.id, value: r.value, valueKind: r.valueKind, sourceName: r.sourceName, methodology: r.methodology, referencePeriod: r.referencePeriod, reviewStatus: r.reviewStatus, version: r.version })),
    total: rows.length,
  })
}

// POST /api/admin/catalog — importação auditável (JSON ou CSV) com critério de origem obrigatório.
// Formato JSON: [{ "value": "0534", "value_kind": "centena", "source_name": "…", "methodology": "…", "reference_period": "…" }]
// Formato CSV (cabeçalho): value,value_kind,source_name,methodology,reference_period
// Nada é publicado automaticamente: itens entram como draft e exigem revisão + origem verificada.
export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return apiError('forbidden', 'Acesso restrito à administração.', 403)

  const body = (await req.text())
  if (!body.trim()) return apiError('bad_request', 'Envie o conteúdo da lista (JSON ou CSV).', 400)

  type Row = { value: string; valueKind: string; sourceName: string; methodology: string; referencePeriod: string | null }
  let rows: Row[] = []

  try {
    const parsed = JSON.parse(body)
    if (Array.isArray(parsed)) {
      rows = parsed.map((it: Record<string, unknown>) => ({
        value: String(it.value ?? ''),
        valueKind: String(it.value_kind ?? it.valueKind ?? ''),
        sourceName: String(it.source_name ?? it.sourceName ?? ''),
        methodology: String(it.methodology ?? ''),
        referencePeriod: it.reference_period ? String(it.reference_period) : it.referencePeriod ? String(it.referencePeriod) : null,
      }))
    }
  } catch {
    // tenta CSV
    const lines = body.trim().split(/\r?\n/)
    if (lines.length >= 2) {
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
      const idx = (name: string) => header.indexOf(name)
      rows = lines.slice(1).map((line) => {
        const cols = line.split(',').map((c) => c.trim())
        return {
          value: cols[idx('value')] ?? '',
          valueKind: cols[idx('value_kind')] ?? '',
          sourceName: cols[idx('source_name')] ?? '',
          methodology: cols[idx('methodology')] ?? '',
          referencePeriod: cols[idx('reference_period')] ?? null,
        }
      })
    }
  }

  if (rows.length === 0) return apiError('bad_request', 'Lista vazia ou formato não reconhecido.', 400)

  const errors: string[] = []
  let imported = 0
  for (const [i, r] of rows.entries()) {
    const line = i + 1
    if (!/^\d{3,4}$/.test(r.value)) {
      errors.push(`linha ${line}: valor "${r.value}" deve ser centena (3 dígitos) ou milhar (4 dígitos)`)
      continue
    }
    const kind = r.value.length === 3 ? 'centena' : 'milhar'
    if (r.valueKind && r.valueKind !== kind) {
      errors.push(`linha ${line}: tipo declarado "${r.valueKind}" difere do tamanho do valor (${kind})`)
      continue
    }
    if (!r.sourceName || !r.methodology) {
      errors.push(`linha ${line}: origem (source_name) e critério (methodology) são obrigatórios`)
      continue
    }
    await db.catalogItem.create({
      data: {
        value: r.value,
        valueKind: kind,
        sourceName: r.sourceName,
        methodology: r.methodology,
        referencePeriod: r.referencePeriod,
        reviewStatus: 'draft',
      },
    })
    imported++
  }

  return NextResponse.json({ imported, rejected: errors.length, errors: errors.slice(0, 20) })
}

// DELETE /api/admin/catalog?id=… — remove item importado.
export async function DELETE(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return apiError('forbidden', 'Acesso restrito à administração.', 403)
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return apiError('bad_request', 'Informe o id.', 400)
  await db.catalogItem.deleteMany({ where: { id } })
  return NextResponse.json({ ok: true })
}
