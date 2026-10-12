import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { hasAppAccess } from '@/lib/entitlements'
import { apiError } from '@/lib/api-helpers'
import { db } from '@/lib/db'

// GET /api/animals — tabela dos 25 bichos/grupos/dezenas.
// Status de verificação acompanha cada linha (regra: nunca apresentar dado derivado como conferido).
export async function GET() {
  const auth = await getAuth()
  if (!auth) return apiError('auth_required', 'Entre com seu e-mail para consultar.', 401)
  if (!(await hasAppAccess(auth.email))) {
    return apiError('upgrade_required', 'A tabela dos bichos faz parte do pacote Livro + Aplicativo.', 403, { product: 'book_app' })
  }

  const rows = await db.animalGroup.findMany({ orderBy: { groupNumber: 'asc' } })
  return NextResponse.json({
    animals: rows.map((r) => ({
      group: r.groupNumber,
      animal: r.animal,
      dezenas: r.dezenas ? r.dezenas.split(',').sort() : [],
      verification: r.verification, // verified_page | ocr_aggregated
      sourceNote: r.sourceNote,
    })),
    notice:
      'Tabela reconstruída a partir dos verbetes do OCR. Linhas marcadas como "em revisão" devem ser conferidas na página 4 do PDF original antes de uso público.',
  })
}
