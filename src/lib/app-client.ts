'use client'

// Cliente de API + tipos compartilhados do app.

export type ProductKey = 'book_pdf' | 'book_app' | 'federal_addon'

export type Entitlement = {
  productKey: ProductKey
  status: string
  offerId?: string
  paymentId?: string | null
  grantedAt?: string | null
}

export type Me = {
  user: { email: string; role: string } | null
  entitlements?: Entitlement[]
  access?: { app: boolean; pdf: boolean; federal: boolean; federalEntitledOnly: boolean }
}

export type AppConfig = {
  demoMode: boolean
  smtpConfigured: boolean
  webhookSecretConfigured: boolean
  offersConfigured: { book_pdf: boolean; book_app: boolean; upgrade: boolean; federal: boolean }
  federalFeedConfigured: boolean
  prices: { book_pdf: string; book_app: string; upgrade: string }
}

export type SearchCandidate = {
  id: string
  slug: string
  title: string
  sourceType: 'pdf_literal' | 'editorial'
  snippet: string
  printPage: number | null
  pdfPage: number | null
  animal: string | null
  group: number | null
  dezena: string | null
  centena: string | null
  milhar: string | null
  score: number
  matchedTokens: string[]
  editorialBase: { slug: string; title: string; printPage: number | null; pdfPage: number | null } | null
}

export type SearchResponse = {
  mode: 'termo' | 'relato'
  query: string
  elements: string[]
  candidates: SearchCandidate[]
  ambiguous: boolean
  suggestion: string | null
}

export type EntryDetail = {
  id: string
  slug: string
  title: string
  sourceType: 'pdf_literal' | 'editorial'
  meaning: string | null
  category?: string | null
  pdfPage: number | null
  printPage: number | null
  aliases: string[]
  association: {
    animal: string
    group: number | null
    dezena: string | null
    centena: string | null
    milhar: string | null
    loto: string | null
    evidencePdfPage: number
  } | null
  editorialBase: {
    slug: string
    title: string
    meaning: string | null
    pdfPage: number | null
    printPage: number | null
    association: { animal: string; group: number | null; dezena: string | null; centena: string | null; milhar: string | null; evidencePdfPage: number } | null
  } | null
  relatedEditorial: { slug: string; title: string; meaning: string | null; isCurrent: boolean }[]
  saved: boolean
  reviewerNote: string | null
}

export type AnimalRow = {
  group: number
  animal: string
  dezenas: string[]
  verification: 'verified_page' | 'ocr_aggregated'
  sourceNote?: string | null
}

export class ApiError extends Error {
  code: string
  status: number
  extra?: Record<string, unknown>
  constructor(code: string, message: string, status: number, extra?: Record<string, unknown>) {
    super(message)
    this.code = code
    this.status = status
    this.extra = extra
  }
}

// ── Sessão no cliente ─────────────────────────────────────────────────
// O cookie httpOnly continua sendo o caminho principal. O token também é
// guardado aqui e enviado como `Authorization: Bearer` — necessário em
// contextos onde o navegador descarta cookies (prévia incorporada em iframe
// cross-site), que era exatamente o caso do login que não avançava.
const SESSION_TOKEN_KEY = 'lds_session_token'

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(SESSION_TOKEN_KEY)
  } catch {
    return null
  }
}

export function saveSessionToken(token: string): void {
  try {
    window.localStorage.setItem(SESSION_TOKEN_KEY, token)
  } catch {
    // sem localStorage (modo privado etc.): segue só com cookie
  }
}

export function clearSessionToken(): void {
  try {
    window.localStorage.removeItem(SESSION_TOKEN_KEY)
  } catch {
    // nada a fazer
  }
}

/** Cabeçalhos de autenticação para chamadas feitas fora do cliente `api()`. */
export function authHeaders(): Record<string, string> {
  const token = readStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readStoredToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string> | undefined) }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers,
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } })?.error
    // token inválido/expirado: limpa para não insistir no mesmo valor
    if (res.status === 401 && token) clearSessionToken()
    throw new ApiError(err?.code ?? 'server_error', err?.message ?? 'Erro inesperado. Tente novamente.', res.status, data as Record<string, unknown>)
  }
  return data as T
}
