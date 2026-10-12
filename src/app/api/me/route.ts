import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { getActiveEntitlements } from '@/lib/entitlements'
import { config } from '@/lib/config'

// GET /api/me — sessão atual + entitlements + flags de módulo.
export async function GET(req: Request) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ user: null })

  const entitlements = await getActiveEntitlements(auth.email)
  const productKeys = new Set(entitlements.map((e) => e.productKey))
  return NextResponse.json({
    user: { email: auth.email, role: auth.role },
    entitlements: entitlements.map((e) => ({ productKey: e.productKey, status: e.status, offerId: e.offerId, paymentId: e.paymentId, grantedAt: e.grantedAt })),
    access: {
      app: productKeys.has('book_app'),
      pdf: productKeys.has('book_pdf') || productKeys.has('book_app'),
      federal: productKeys.has('federal_addon') && config.federalFeedConfigured,
      federalEntitledOnly: productKeys.has('federal_addon'),
    },
  })
}
