import { NextResponse } from 'next/server'
import { destroyCurrentSession } from '@/lib/auth'

// POST /api/auth/logout — encerra a sessão atual (cookie ou token Bearer do corpo).
export async function POST(req: Request) {
  await destroyCurrentSession(req)
  return NextResponse.json({ ok: true })
}
