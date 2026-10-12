import { NextResponse } from 'next/server'
import { config } from '@/lib/config'

// Flags públicas do ambiente (nada sensível): usadas pela UI para exibir
// avisos de modo de demonstração e estados de configuração de e-mail/pagamento.
export async function GET() {
  return NextResponse.json({
    demoMode: config.demoMode,
    smtpConfigured: config.smtpConfigured,
    webhookSecretConfigured: !!config.cakto.webhookSecret,
    offersConfigured: {
      book_pdf: !!config.cakto.offerBookPdf,
      book_app: !!config.cakto.offerBookApp,
      upgrade: !!config.cakto.offerUpgrade,
      federal: !!config.cakto.offerFederal,
    },
    federalFeedConfigured: config.federalFeedConfigured,
    prices: {
      book_pdf: 'R$ 12,90',
      book_app: 'R$ 24,90',
      upgrade: 'R$ 19,90',
    },
  })
}
