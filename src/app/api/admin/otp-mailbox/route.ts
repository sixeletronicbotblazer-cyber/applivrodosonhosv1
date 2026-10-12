import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { apiError } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { config } from '@/lib/config'

// GET /api/admin/otp-mailbox — caixa de saída do transporte dev.
// Existe APENAS em modo de desenvolvimento isolado (SMTP não configurado).
// Com SMTP ativo, nenhum código é armazenado em texto puro nem exibido aqui.
export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return apiError('forbidden', 'Acesso restrito à administração.', 403)

  if (!config.demoMode || config.smtpConfigured) {
    return NextResponse.json({ available: false, message: 'Indisponível: SMTP configurado ou modo de produção. Os códigos vão direto por e-mail.' })
  }

  const rows = await db.devMailbox.findMany({ orderBy: { createdAt: 'desc' }, take: 25 })
  return NextResponse.json({
    available: true,
    notice:
      'MODO DE DESENVOLVIMENTO — caixa de saída simulada. Nenhum e-mail real foi enviado. Com SMTP configurado, esta tela deixa de existir.',
    items: rows.map((r) => ({
      id: r.id,
      toEmail: r.toEmail,
      subject: r.subject,
      body: r.body,
      code: r.code,
      transport: r.transport,
      createdAt: r.createdAt,
    })),
  })
}
