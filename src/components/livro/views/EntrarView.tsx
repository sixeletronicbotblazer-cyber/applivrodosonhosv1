'use client'

// Tela de entrada — um único campo de e-mail, botão "Acessar aplicativo" e
// redirecionamento imediato para o início. Sem código, sem etapas intermediárias,
// sem avisos técnicos: o comprador informa o e-mail usado na compra e entra.
// Em produção, o acesso é validado pelo vínculo da compra (entitlements);
// a experiência mostrada aqui é sempre neutra e acolhedora.

import { useState } from 'react'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { api, ApiError, saveSessionToken } from '@/lib/app-client'
import { useApp } from '@/lib/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function EntrarView() {
  const { refreshMe, navigate } = useApp()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function acessar() {
    if (busy) return
    const value = email.trim()
    if (!value) {
      setError('Informe o e-mail usado na compra.')
      return
    }
    if (!EMAIL_RE.test(value)) {
      setError('Confira o e-mail digitado — parece incompleto.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      // 1) cria a sessão de demonstração (cookie + token de apoio para
      //    contextos em que o navegador não guarda cookies, ex.: prévia incorporada)
      const res = await api<{ token?: string }>('/api/auth/access', {
        method: 'POST',
        body: JSON.stringify({ email: value }),
      })
      if (res.token) saveSessionToken(res.token)

      // 2) confirma a sessão antes de navegar — nunca deixa o botão sem resposta
      await refreshMe()
      if (!useApp.getState().me?.user) {
        throw new ApiError('session_failed', 'Não foi possível confirmar sua sessão. Tente novamente em instantes.', 500)
      }

      // 3) entra direto no início
      navigate('inicio')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível entrar agora. Tente novamente em instantes.')
    } finally {
      // se o redirecionamento não acontecer (falha de sessão), libera o botão de novo
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-papel">
      {/* detalhes suaves de fundo (identidade das páginas internas) */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-lilas blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-ouro/25 blur-3xl" />

      {/* marca discreta no topo */}
      <header className="relative z-10 flex items-center justify-center px-5 pb-2 pt-6">
        <p className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.18em] text-roxo">
          <span aria-hidden="true" className="text-ouro">
            ✦
          </span>
          Livro dos Sonhos
        </p>
      </header>

      {/* cartão central (440px no desktop, largura disponível no celular) */}
      <main className="relative z-10 flex flex-1 flex-col items-center px-5 pb-8 pt-4 md:justify-center md:pt-0">
        <div className="w-full max-w-[440px]">
          <div className="rounded-3xl bg-white p-6 shadow-[0_10px_40px_-18px_rgba(50,16,83,0.25)] ring-1 ring-black/[0.04] sm:p-8">
            <div className="flex flex-col items-center text-center">
              <Image
                src="/book/capa.jpg"
                alt="Capa do Livro dos Sonhos"
                width={64}
                height={91}
                className="rounded-lg shadow-md ring-1 ring-black/10"
                style={{ width: 64, height: 91 }}
                priority
              />
              <h1 className="font-display mt-4 text-[26px] font-bold leading-[1.15] text-tinta sm:text-[28px]">
                Seu Livro dos Sonhos está pronto para consultar.
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                Entre com o e-mail usado na compra para acessar seu material.
              </p>
            </div>

            <form
              noValidate
              className="mt-6"
              onSubmit={(e) => {
                e.preventDefault()
                void acessar()
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
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                autoFocus
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError(null)
                }}
                className="focus-ring mt-2 h-13 rounded-2xl border-linha bg-papel px-4 text-base"
                required
              />
              {error ? (
                <p role="alert" className="mt-2.5 text-sm font-medium text-destructive">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={busy}
                className="focus-ring mt-4 h-14 w-full rounded-2xl bg-roxo text-base font-semibold text-white hover:bg-roxo-2 disabled:opacity-70"
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
                    Entrando…
                  </span>
                ) : (
                  'Acessar aplicativo'
                )}
              </Button>
            </form>
          </div>

          {/* ajuda discreta */}
          <p className="mt-5 text-center text-sm">
            <a
              href="mailto:suporte@livrodossonhos.app?subject=Preciso%20de%20ajuda%20para%20acessar"
              className="focus-ring font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-roxo hover:underline"
            >
              Precisa de ajuda para acessar?
            </a>
          </p>
        </div>
      </main>

      {/* rodapé fixo ao fundo */}
      <footer className="relative z-10 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-center">
        <p className="text-xs text-muted-foreground">Livro dos Sonhos · consulta editorial</p>
      </footer>
    </div>
  )
}
