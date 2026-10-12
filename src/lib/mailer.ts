// Envio de e-mail com dois transportes:
//  1. "smtp" — produção (SMTP_HOST/PORT/FROM configurados; usa nodemailer).
//  2. "dev"  — modo de desenvolvimento isolado: grava em DevMailbox (visível em /admin).
// Nunca há OTP universal: o código é gerado por requisição e enviado por e-mail.

import { db } from '@/lib/db'
import { config } from '@/lib/config'

export type MailResult = { transport: 'smtp' | 'dev'; error?: string }

export async function sendOtpEmail(to: string, code: string): Promise<MailResult> {
  const subject = 'Livro dos Sonhos · seu código de acesso'
  const body = [
    'Seu código de acesso ao Livro dos Sonhos:',
    '',
    `    ${code.slice(0, 3)} ${code.slice(3)}`,
    '',
    `O código expira em ${config.otp.ttlMinutes} minutos.`,
    'Se você não solicitou este código, ignore este e-mail.',
    '',
    'Livro dos Sonhos — consulta editorial; os números são para consulta e não garantem resultado de jogo.',
  ].join('\n')

  if (config.smtpConfigured) {
    try {
      const nodemailer = await import('nodemailer')
      const transport = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      })
      await transport.sendMail({
        from: config.smtp.from,
        to,
        subject,
        text: body,
      })
      // guarda cópia sem código para auditoria de envio
      await db.devMailbox.create({
        data: { toEmail: to, subject, body: 'Enviado via SMTP (código não armazenado em texto puro).', transport: 'smtp' },
      })
      return { transport: 'smtp' }
    } catch (e) {
      // SMTP configurado mas falhou — registra e sinaliza erro (sem fallback silencioso)
      await db.devMailbox.create({
        data: { toEmail: to, subject: `[FALHA SMTP] ${subject}`, body: String(e), transport: 'smtp-error' },
      })
      return { transport: 'smtp', error: 'smtp_send_failed' }
    }
  }

  // Modo de desenvolvimento isolado: entrega registrada na caixa dev (visível no /admin).
  await db.devMailbox.create({ data: { toEmail: to, subject, body, code, transport: 'dev' } })
  return { transport: 'dev' }
}
