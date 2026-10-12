import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { apiError } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { normalizeText } from '@/lib/normalize'

// POST /api/account/delete — privacidade: apaga salvos, sessões e anonimiza a conta.
// Entitlements de pagamento são preservados como registro financeiro, desvinculados do usuário.
export async function POST(req: Request) {
  const auth = await getAuth(req)
  if (!auth) return apiError('auth_required', 'Entre com seu e-mail.', 401)

  const anonEmail = `excluido+${normalizeText(auth.email).replace(/[^a-z0-9]/g, '')}-${Date.now().toString(36)}@anon.local`
  await db.savedEntry.deleteMany({ where: { userId: auth.userId } })
  await db.session.deleteMany({ where: { userId: auth.userId } })
  await db.entitlement.updateMany({ where: { buyerEmail: auth.email }, data: { userId: null } })
  const user = await db.user.findUnique({ where: { id: auth.userId } })
  if (user) {
    await db.user.update({ where: { id: user.id }, data: { email: anonEmail } })
  }
  return NextResponse.json({ ok: true, message: 'Conta e dados pessoais removidos. Registros de pagamento permanecem anônimos por exigência fiscal.' })
}
