// Configuração central — leitura de ambiente com valores seguros por padrão.
// Produção: definir SMTP_*, CAKTO_* e DEMO_MODE=false no .env (ver .env.example).

export type ProductKey = 'book_pdf' | 'book_app' | 'federal_addon'

export const OFFER_PRICES: Record<ProductKey, string> = {
  book_pdf: 'R$ 12,90',
  book_app: 'R$ 24,90',
  federal_addon: '—',
}

export const OFFER_LABELS: Record<ProductKey, string> = {
  book_pdf: 'Livro digital (PDF)',
  book_app: 'Livro + Aplicativo',
  federal_addon: 'Resultados da Federal (módulo adicional)',
}

function env(name: string): string | undefined {
  const v = process.env[name]
  return v && v.trim() !== '' ? v.trim() : undefined
}

export const config = {
  get demoMode(): boolean {
    const explicit = env('DEMO_MODE')
    if (explicit !== undefined) return explicit === 'true'
    // Deployment público na Vercel sem variável configurada = prévia demonstrável
    // (acesso de demonstração por e-mail). Para produção real (compra obrigatória),
    // defina explicitamente DEMO_MODE=false no painel da Vercel.
    if (process.env.VERCEL === '1') return true
    return process.env.NODE_ENV !== 'production'
  },
  /** Exibe o código OTP na resposta APENAS quando SMTP não está configurado e DEMO_MODE ativo.
   *  Com SMTP configurado este valor é sempre false (o código sai só por e-mail). */
  get otpDevDisplay(): boolean {
    return this.demoMode && !this.smtpConfigured
  },
  get smtpConfigured(): boolean {
    return !!(env('SMTP_HOST') && env('SMTP_PORT') && env('SMTP_FROM'))
  },
  smtp: {
    get host() { return env('SMTP_HOST') },
    get port() { return Number(env('SMTP_PORT') ?? 587) },
    get user() { return env('SMTP_USER') },
    get pass() { return env('SMTP_PASS') },
    get from() { return env('SMTP_FROM') },
    get secure() { return env('SMTP_SECURE') === 'true' },
  },
  cakto: {
    get webhookSecret() { return env('CAKTO_WEBHOOK_SECRET') },
    get offerBookPdf() { return env('CAKTO_OFFER_BOOK_PDF') },
    get offerBookApp() { return env('CAKTO_OFFER_BOOK_APP') },
    get offerUpgrade() { return env('CAKTO_OFFER_UPGRADE') },
    get offerFederal() { return env('CAKTO_OFFER_FEDERAL') },
  },
  get otpPepper(): string {
    return env('OTP_PEPPER') ?? 'livro-dos-sonhos-dev-pepper'
  },
  get federalFeedConfigured(): boolean {
    return !!env('FEDERAL_FEED_URL')
  },
  otp: {
    ttlMinutes: 10,
    maxAttempts: 5,
    resendCooldownSeconds: 60,
    maxPerEmailPer10Min: 3,
    maxPerIpPerHour: 12,
  },
}

/** Mapeia um offer_id (da plataforma de pagamento) para o produto interno.
 *  Sem o ID real configurado, NÃO existe correspondência (regra: preço não é entitlement).
 *  Em modo de demonstração, as ofertas demo do seed também são mapeáveis para
 *  viabilizar o teste local do pipeline (nunca em produção com DEMO_MODE=false). */
export function offerIdToProductKey(offerId: string): ProductKey | null {
  const c = config.cakto
  if (c.offerBookPdf && offerId === c.offerBookPdf) return 'book_pdf'
  if (c.offerBookApp && offerId === c.offerBookApp) return 'book_app'
  if (c.offerFederal && offerId === c.offerFederal) return 'federal_addon'
  if (c.offerUpgrade && offerId === c.offerUpgrade) return 'book_app' // upgrade habilita pacote completo
  if (config.demoMode) {
    if (offerId === 'DEMO-OFFER-BOOK-PDF') return 'book_pdf'
    if (offerId === 'DEMO-OFFER-BOOK-APP') return 'book_app'
    if (offerId === 'DEMO-OFFER-FEDERAL') return 'federal_addon'
  }
  return null
}
