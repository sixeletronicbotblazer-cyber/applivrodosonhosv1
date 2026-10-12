import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { hasPdfAccess } from '@/lib/entitlements'
import { apiError } from '@/lib/api-helpers'
import { db } from '@/lib/db'

// GET /api/book/pages — páginas do livro disponíveis neste ambiente + metadados.
// O PDF original completo não acompanhou o pacote de construção; as 3 páginas
// fornecidas em imagem ficam disponíveis e o restante aguarda o arquivo do operador.
export async function GET(req: Request) {
  const auth = await getAuth(req)
  if (!auth) return apiError('auth_required', 'Entre com seu e-mail.', 401)
  if (!(await hasPdfAccess(auth.email))) {
    return apiError('upgrade_required', 'O livro digital faz parte da compra.', 403, { product: 'book_pdf' })
  }

  const pages = await db.bookPage.findMany({ where: { reviewStatus: 'published' }, orderBy: { pdfPage: 'asc' } })
  return NextResponse.json({
    pdfFileAvailable: false, // alterar para true quando o PDF original for anexado pelo operador
    pages: pages.map((p) => ({
      pdfPage: p.pdfPage,
      printPage: p.printPage,
      imagePath: p.imagePath,
      title:
        p.pdfPage === 1
          ? 'Capa do livro'
          : p.printPage
            ? `Dicionário dos sonhos · página impressa ${String(p.printPage).padStart(2, '0')}`
            : 'Página do livro',
    })),
    notice:
      'Neste ambiente estão anexadas as páginas fornecidas na construção (capa, pág. 5 e pág. 46). O PDF original completo deve ser anexado pelo operador para liberar as demais páginas.',
  })
}
