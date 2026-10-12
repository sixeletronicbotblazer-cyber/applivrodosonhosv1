// Sessões, OTP e helpers de autenticação (servidor).
// - OTP: 6 dígitos, hash SHA-256 com pepper, expiração, limite de tentativas, cooldown de reenvio.
// - Sessão: cookie httpOnly com token aleatório persistido no banco.

import { db } from '@/lib/db'
import { config } from '@/lib/config'
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto'
import { cookies, headers } from 'next/headers'

export const SESSION_COOKIE = 'lds_session'

// ── Token de sessão stateless (prévia serverless) ─────────────────────────
// Na Vercel, cada rota de API é uma lambda com cópia própria do banco em /tmp:
// a sessão gravada por /api/auth/access não existe nas outras instâncias. Na
// prévia pública (DEMO_MODE + Vercel) a sessão é emitida também como token
// assinado (HMAC) e validado SEM consultar o banco, ficando consistente entre
// instâncias. Em produção (DEMO_MODE=false) a sessão continua 100% no banco.
const STATELESS_PREFIX = 'lds1.'
const STATELESS_TTL_MS = 30 * 24 * 60 * 60 * 1000

function statelessEnabled(): boolean {
  return process.env.VERCEL === '1' && config.demoMode
}

function statelessSecret(): string {
  // VERCEL_URL é constante dentro do mesmo deployment: tokens morrem a cada
  // novo deploy (re-login), o que é desejado na prévia.
  return `lds-stateless::${process.env.VERCEL_URL ?? 'local'}::${config.otpPepper}`
}

function createStatelessToken(user: { id: string; email: string; role: string }): string {
  const payload = { uid: user.id, em: user.email, ro: user.role, exp: Date.now() + STATELESS_TTL_MS }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', statelessSecret()).update(body).digest('base64url')
  return `${STATELESS_PREFIX}${body}.${sig}`
}

function parseStatelessToken(token: string): AuthContext | null {
  const rest = token.slice(STATELESS_PREFIX.length)
  const dot = rest.lastIndexOf('.')
  if (dot <= 0) return null
  const body = rest.slice(0, dot)
  const sig = rest.slice(dot + 1)
  const expected = createHmac('sha256', statelessSecret()).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as {
      uid: string
      em: string
      ro: string
      exp: number
    }
    if (!payload?.em || !payload.exp || payload.exp < Date.now()) return null
    return { userId: payload.uid, email: payload.em, role: payload.ro }
  } catch {
    return null
  }
}

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
  | { ok: true; userId: string; email: string; role: string; isNew: boolean; token: string }
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

  const token = await createSession(user, ip)

  return { ok: true, userId: user.id, email: user.email, role: user.role, isNew: true, token }
}

/** Encerra a sessão atual. Com requisição, aceita também o token Bearer
 *  (mesma sessão do cliente, mesmo quando o cookie não circula). */
export async function destroyCurrentSession(req?: Request): Promise<void> {
  const jar = await cookies()
  let token = jar.get(SESSION_COOKIE)?.value
  const bearer = bearerToken(req)
  if (bearer) token = bearer
  if (token) await db.session.deleteMany({ where: { token } })
  jar.delete(SESSION_COOKIE)
}

/** Detecta HTTPS atrás do gateway (x-forwarded-proto) para poder emitir o
 *  cookie com SameSite=None; Secure — necessário quando o app roda incorporado
 *  em iframe cross-site (painel de prévia), onde SameSite=Lax é descartado. */
async function requestIsHttps(): Promise<boolean> {
  try {
    const h = await headers()
    const proto = h.get('x-forwarded-proto') ?? ''
    return proto.split(',')[0].trim() === 'https'
  } catch {
    return false
  }
}

async function sessionCookieOptions(): Promise<{
  httpOnly: true
  sameSite: 'none' | 'lax'
  secure: boolean
  maxAge: number
  path: string
}> {
  const https = await requestIsHttps()
  return {
    httpOnly: true,
    sameSite: https ? 'none' : 'lax',
    secure: https,
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  }
}

/** Cria uma sessão persistente (30 dias) para o usuário, grava o cookie httpOnly
 *  e devolve o token (o cliente guarda como fallback Bearer para contextos em
 *  que cookies não circulam, ex.: iframe cross-site do painel de prévia).
 *  Usada pelo acesso por e-mail (vínculo de compra / sessão de demonstração). */
export async function createSession(
  user: { id: string; email: string; role: string },
  ip: string,
): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await db.session.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ip,
    },
  })
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, await sessionCookieOptions())
  // Prévia serverless: o cliente recebe o token assinado (validação sem banco);
  // o cookie mantém o token do banco (mesmo comportamento em requisições da
  // mesma instância).
  if (statelessEnabled()) return createStatelessToken(user)
  return token
}

function bearerToken(req?: Request): string | null {
  const header = req?.headers.get('authorization')
  if (!header) return null
  const [scheme, value] = header.split(' ')
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !value) return null
  const token = value.trim()
  return token.length > 0 ? token : null
}

async function authFromToken(token: string): Promise<AuthContext | null> {
  const session = await db.session.findUnique({ where: { token }, include: { user: true } })
  if (!session || session.expiresAt.getTime() < Date.now()) return null
  return { userId: session.user.id, email: session.user.email, role: session.user.role }
}

/** Autenticação consciente da requisição: aceita `Authorization: Bearer`
 *  (sessão criada por /api/auth/access e guardada pelo cliente) e mantém o
 *  cookie httpOnly como caminho padrão. Isso corrige o login no modo de
 *  prévia incorporada, onde o navegador descarta cookies SameSite=Lax. */
export async function getAuth(req?: Request): Promise<AuthContext | null> {
  if (req) {
    const bearer = bearerToken(req)
    if (bearer) {
      if (bearer.startsWith(STATELESS_PREFIX)) {
        if (statelessEnabled()) {
          const ctx = parseStatelessToken(bearer)
          if (ctx) return ctx
        }
      } else {
        const viaBearer = await authFromToken(bearer)
        if (viaBearer) return viaBearer
      }
    }
  }
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  return authFromToken(token)
}

export async function requireAdmin(req?: Request): Promise<AuthContext | null> {
  const auth = await getAuth(req)
  if (!auth || auth.role !== 'ADMIN') return null
  return auth
}

export type AuthContext = { userId: string; email: string; role: string }

// wrapper local para não circular-importar rate-limit aqui
import { rateLimit as rateLimitCheck } from '@/lib/rate-limit'

async function sendOtpViaMailer(email: string, code: string) {
  const { sendOtpEmail } = await import('@/lib/mailer')
  return sendOtpEmail(email, code)
}
