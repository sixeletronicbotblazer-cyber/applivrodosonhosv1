// Sessões, OTP e helpers de autenticação (servidor).
// - OTP: 6 dígitos, hash SHA-256 com pepper, expiração, limite de tentativas, cooldown de reenvio.
// - Sessão: cookie httpOnly com token aleatório persistido no banco.

import { db } from '@/lib/db'
import { config } from '@/lib/config'
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'lds_session'

function hashCode(email: string, code: string): string {
  return createHash('sha256').update(`${email.toLowerCase()}::${code}::${config.otpPepper}`).digest('hex')
}

export type RequestOtpResult =
  | { ok: true; transport: 'smtp' | 'dev'; devCode?: string; resendCooldownSeconds: number }
  | { ok: false; reason: 'rate_limited' | 'cooldown' | 'smtp_error'; retryAfterSeconds?: number }

export async function requestOtp(rawEmail: string, ip: string): Promise<RequestOtpResult> {
  const email = rawEmail.trim().toLowerCase()
  const otp = config.otp

  const ipLimit = rateLimitCheck(`otp:ip:${ip}`, otp.maxPerIpPerHour, 60 * 60 * 1000)
  if (!ipLimit.ok) return { ok: false, reason: 'rate_limited', retryAfterSeconds: ipLimit.retryAfterSeconds }

  const emailLimit = rateLimitCheck(`otp:email:${email}`, otp.maxPerEmailPer10Min, 10 * 60 * 1000)
  if (!emailLimit.ok) return { ok: false, reason: 'rate_limited', retryAfterSeconds: emailLimit.retryAfterSeconds }

  // cooldown de reenvio (mensagem neutra; não revela existência de conta)
  const last = await db.otpCode.findFirst({ where: { email }, orderBy: { createdAt: 'desc' } })
  if (last) {
    const elapsed = (Date.now() - last.createdAt.getTime()) / 1000
    if (elapsed < otp.resendCooldownSeconds) {
      return { ok: false, reason: 'cooldown', retryAfterSeconds: Math.ceil(otp.resendCooldownSeconds - elapsed) }
    }
  }

  const code = String(randomInt(100000, 1000000))
  await db.otpCode.create({
    data: {
      email,
      codeHash: hashCode(email, code),
      expiresAt: new Date(Date.now() + otp.ttlMinutes * 60 * 1000),
      ip,
    },
  })

  const mail = await sendOtpViaMailer(email, code)
  if (mail.error) return { ok: false, reason: 'smtp_error' }

  return {
    ok: true,
    transport: mail.transport,
    devCode: config.otpDevDisplay ? code : undefined, // apenas modo dev isolado, nunca com SMTP ativo
    resendCooldownSeconds: otp.resendCooldownSeconds,
  }
}

export type VerifyOtpResult =
  | { ok: true; userId: string; email: string; role: string; isNew: boolean }
  | { ok: false; reason: 'invalid' | 'expired' | 'too_many_attempts' | 'not_found' }

export async function verifyOtp(rawEmail: string, code: string, ip: string): Promise<VerifyOtpResult> {
  const email = rawEmail.trim().toLowerCase()
  const attemptLimit = rateLimitCheck(`otp-verify:${email}:${ip}`, 10, 15 * 60 * 1000)
  if (!attemptLimit.ok) return { ok: false, reason: 'too_many_attempts' }

  const otp = await db.otpCode.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  if (!otp) return { ok: false, reason: 'not_found' }
  if (otp.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' }
  if (otp.attempts >= config.otp.maxAttempts) return { ok: false, reason: 'too_many_attempts' }

  const provided = Buffer.from(hashCode(email, code.trim()))
  const stored = Buffer.from(otp.codeHash)
  const matches = provided.length === stored.length && timingSafeEqual(provided, stored)

  if (!matches) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })
    return { ok: false, reason: 'invalid' }
  }

  await db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } })

  // mensagem genérica: não revela se a conta já existia
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, role: 'USER' },
  })

  const token = randomBytes(32).toString('hex')
  await db.session.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ip,
      userAgent: undefined,
    },
  })
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.FORCE_INSECURE_COOKIE !== 'true',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  })

  return { ok: true, userId: user.id, email: user.email, role: user.role, isNew: true }
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await db.session.deleteMany({ where: { token } })
  jar.delete(SESSION_COOKIE)
}

export type AuthContext = { userId: string; email: string; role: string }

export async function getAuth(): Promise<AuthContext | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await db.session.findUnique({ where: { token }, include: { user: true } })
  if (!session || session.expiresAt.getTime() < Date.now()) return null
  return { userId: session.user.id, email: session.user.email, role: session.user.role }
}

export async function requireAdmin(): Promise<AuthContext | null> {
  const auth = await getAuth()
  if (!auth || auth.role !== 'ADMIN') return null
  return auth
}

// wrapper local para não circular-importar rate-limit aqui
import { rateLimit as rateLimitCheck } from '@/lib/rate-limit'

async function sendOtpViaMailer(email: string, code: string) {
  const { sendOtpEmail } = await import('@/lib/mailer')
  return sendOtpEmail(email, code)
}
