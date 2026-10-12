// Rate limit em memória (por processo). Suficiente para o ambiente local;
// em produção multi-instância, trocar por armazenamento compartilhado.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    if (buckets.size > 5000) {
      // limpeza simples de chaves expiradas
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k)
    }
    return { ok: true, retryAfterSeconds: 0 }
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) }
  }
  b.count++
  return { ok: true, retryAfterSeconds: 0 }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'local'
}
