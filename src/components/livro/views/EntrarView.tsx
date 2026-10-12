'use client'

// Tela 01 — acesso por e-mail + código OTP de 6 dígitos.
// O código NUNCA é gerado/exposto na tela: chega por e-mail. Em modo de
// desenvolvimento isolado (sem SMTP), o backend devolve devCode e a UI o exibe
// dentro de um aviso claramente rotulado que não existe com SMTP configurado.

import { useState, useEffect } from 'react'
import { api, ApiError } from '@/lib/app-client'
import { useApp } from '@/lib/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp'
import { toast } from '@/hooks/use-toast'

export function EntrarView() {
  const { refreshMe, appConfig } = useApp()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function requestCode() {
    setError(null)
    if (!email.trim()) {
      setError('Informe o e-mail usado na compra.')
      return
    }
    setBusy(true)
    try {
      const res = await api<{ devCode?: string; resendCooldownSeconds: number; message: string }>('/api/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })
      setStep('code')
      setDevCode(res.devCode ?? null)
      setCooldown(res.resendCooldownSeconds ?? 60)
      toast({ title: 'Código enviado', description: appConfig?.smtpConfigured ? 'Confira sua caixa de entrada.' : 'Veja o aviso de modo de desenvolvimento abaixo.' })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível enviar o código. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmCode() {
    setError(null)
    if (code.length !== 6) {
      setError('Digite o código completo de 6 dígitos.')
      return
    }
    setBusy(true)
    try {
      await api('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: email.trim(), code }) })
      await refreshMe()
      toast({ title: 'Acesso liberado', description: 'Boa consulta!' })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Código inválido. Tente novamente.')
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-papel">
      {/* Hero roxo (tela 01) */}
      <div className="bg-roxo px-5 pt-10 pb-24 md:px-8 md:pt-14 md:pb-32">
        <div className="mx-auto w-full max-w-3xl">
          <p className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.18em] text-ouro md:text-base">
            <span aria-hidden="true">◆</span> Livro dos Sonhos
          </p>
          <h1 className="font-display mt-6 text-4xl font-bold leading-[1.08] text-white md:text-5xl">
            Seu acesso começa aqui.
          </h1>
          <p className="mt-3 text-[15px] text-[#CDBBE0] md:text-base">Entre com o e-mail usado na compra.</p>
        </div>
      </div>

      {/* Cartão branco de acesso */}
      <div className="mx-auto -mt-16 w-full max-w-3xl px-5 pb-16 md:-mt-24 md:px-8">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/[0.03] md:p-8">
          <h2 className="font-display text-2xl font-bold text-tinta md:text-3xl">Entrar no aplicativo</h2>
          <p className="mt-1.5 text-[15px] text-muted-foreground">Enviaremos um código de 6 dígitos por e-mail.</p>

          {step === 'email' ? (
            <form
              className="mt-6"
              onSubmit={(e) => {
                e.preventDefault()
                void requestCode()
              }}
            >
              <label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-roxo">
                Seu e-mail
              </label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="focus-ring mt-2 h-14 rounded-2xl border-linha bg-[#FCF8F1] px-4 text-base"
                required
              />
              {error ? (
                <p role="alert" className="mt-2 text-sm font-medium text-destructive">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={busy}
                className="focus-ring mt-4 h-14 w-full justify-between rounded-2xl bg-roxo px-6 text-base font-semibold hover:bg-roxo-2 disabled:opacity-70"
              >
                {busy ? 'Enviando…' : 'Receber código'}
                <span aria-hidden="true">›</span>
              </Button>
            </form>
          ) : (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-widest text-roxo">Já recebeu o código?</p>
              <div className="mt-3" aria-live="polite">
                <InputOTP maxLength={6} value={code} onChange={setCode} containerClassName="justify-between gap-2 sm:gap-3">
                  <InputOTPGroup className="gap-2 sm:gap-3">
                    <InputOTPSlot index={0} className="h-14 w-11 rounded-xl border-linha bg-[#FCF8F1] text-lg font-semibold sm:w-12" />
                    <InputOTPSlot index={1} className="h-14 w-11 rounded-xl border-linha bg-[#FCF8F1] text-lg font-semibold sm:w-12" />
                    <InputOTPSlot index={2} className="h-14 w-11 rounded-xl border-linha bg-[#FCF8F1] text-lg font-semibold sm:w-12" />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup className="gap-2 sm:gap-3">
                    <InputOTPSlot index={3} className="h-14 w-11 rounded-xl border-linha bg-[#FCF8F1] text-lg font-semibold sm:w-12" />
                    <InputOTPSlot index={4} className="h-14 w-11 rounded-xl border-linha bg-[#FCF8F1] text-lg font-semibold sm:w-12" />
                    <InputOTPSlot index={5} className="h-14 w-11 rounded-xl border-linha bg-[#FCF8F1] text-lg font-semibold sm:w-12" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {error ? (
                <p role="alert" className="mt-2 text-sm font-medium text-destructive">
                  {error}
                </p>
              ) : null}

              {devCode ? (
                <div className="mt-4 rounded-xl border border-[#E5C96B] bg-[#FBF3DC] px-4 py-3" data-testid="dev-code-banner">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#7A5C12]">Modo de desenvolvimento · SMTP não configurado</p>
                  <p className="mt-1 text-sm text-[#6B5313]">
                    Em produção o código chega só por e-mail. Neste ambiente de teste, o código desta sessão é:{' '}
                    <strong className="font-display text-base tracking-[0.3em] text-[#321053]">{devCode}</strong>
                  </p>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                <Button
                  onClick={() => void confirmCode()}
                  disabled={busy || code.length !== 6}
                  className="focus-ring h-12 flex-1 rounded-2xl bg-roxo px-6 text-base font-semibold hover:bg-roxo-2 disabled:opacity-70 sm:flex-none"
                >
                  {busy ? 'Confirmando…' : 'Confirmar código'}
                </Button>
                <button
                  type="button"
                  onClick={() => void requestCode()}
                  disabled={cooldown > 0 || busy}
                  className="focus-ring text-sm font-medium text-muted-foreground underline-offset-2 hover:text-roxo hover:underline disabled:opacity-60"
                >
                  {cooldown > 0 ? `Reenviar em ${cooldown} s` : 'Reenviar código'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email')
                    setCode('')
                    setError(null)
                  }}
                  className="focus-ring text-sm font-medium text-muted-foreground underline-offset-2 hover:text-roxo hover:underline"
                >
                  Trocar e-mail
                </button>
              </div>
            </div>
          )}

          {appConfig?.demoMode ? (
            <div className="mt-6 rounded-xl bg-lilas/70 px-4 py-3 text-[13px] leading-relaxed text-roxo-2">
              <strong className="font-semibold">Ambiente de demonstração:</strong> use <code>demo@livrodossonhos.app</code> (pacote
              completo), <code>pdf@livrodossonhos.app</code> (só PDF) ou <code>outro@livrodossonhos.app</code> (sem compra). Qualquer
              e-mail recebe código neste modo.
            </div>
          ) : null}
        </div>

        <div className="mt-8 space-y-4 px-2 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Comprou o pacote? O acesso aparece após a confirmação do pagamento.
          </p>
          <p className="text-sm">
            <a href="mailto:suporte@livrodossonhos.app" className="focus-ring font-bold text-roxo underline-offset-2 hover:underline">
              Precisa de ajuda?
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
