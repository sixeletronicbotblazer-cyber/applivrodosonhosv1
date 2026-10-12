'use client'

// Tela 02 — início: busca rápida, CTA de relato, caminhos de consulta.
// book_pdf: busca/ferramentas aparecem travadas com CTA de upgrade (sem liberar premium).

import { useState } from 'react'
import Image from 'next/image'
import { useApp, type ViewName } from '@/lib/app-store'
import { PageHeader } from '@/components/livro/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SkeletonCard } from '@/components/livro/States'

type NavigateFn = (view: ViewName, opts?: { slug?: string; params?: Record<string, string> }) => void

export function InicioView() {
  const { me, navigate, meLoading } = useApp()
  const [quick, setQuick] = useState('')

  const access = me?.access
  const firstName = me?.user?.email.split('@')[0] ?? ''

  function quickSearch() {
    navigate('buscar', { params: { q: quick.trim(), auto: '1' } })
  }

  return (
    <div>
      <PageHeader title="Livro dos Sonhos" subtitle={`Olá${firstName ? `, ${firstName}` : ''} · sua consulta, no seu ritmo`} />

      <div className="mx-auto w-full max-w-3xl px-5 py-7 md:px-8">
        <h2 className="font-display text-3xl font-bold leading-tight text-tinta md:text-4xl">O que você sonhou?</h2>
        <p className="mt-1.5 text-[15px] text-muted-foreground">Uma palavra já é suficiente para começar.</p>

        {access?.app ? (
          <>
            <form
              className="mt-5"
              onSubmit={(e) => {
                e.preventDefault()
                quickSearch()
              }}
            >
              <div className="flex items-center gap-3 rounded-2xl border border-linha bg-white px-4 py-3.5 transition-colors focus-within:border-roxo-2/50">
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-roxo-2" />
                <Input
                  aria-label="Buscar palavra do sonho"
                  value={quick}
                  onChange={(e) => setQuick(e.target.value)}
                  placeholder="Ex.: cavalo, água, viagem…"
                  className="h-8 border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
                />
              </div>
            </form>

            {/* Consulta rápida — cartão roxo (tela 02) */}
            <section className="mt-6 rounded-3xl bg-roxo px-6 py-7 text-white md:px-8">
              <p className="text-xs font-bold uppercase tracking-widest text-ouro">Consulta rápida</p>
              <h3 className="font-display mt-2 text-2xl font-bold md:text-3xl">Lembrou de um detalhe?</h3>
              <p className="mt-2 max-w-md text-[15px] leading-relaxed text-[#E4D6F2]">
                Descreva seu sonho e veja os verbetes mais próximos do que você contou.
              </p>
              <Button
                onClick={() => navigate('buscar')}
                className="focus-ring mt-5 h-12 rounded-full bg-ouro px-6 text-base font-bold text-roxo hover:bg-[#EBBB3E]"
              >
                Contar meu sonho <span aria-hidden="true" className="ml-1">→</span>
              </Button>
            </section>

            <h3 className="font-display mt-8 text-2xl font-bold text-tinta">Seus caminhos de consulta</h3>
            <div className="mt-4 space-y-3.5">
              <PathCard
                icon={<span className="font-display text-xl font-bold text-roxo-2">A-Z</span>}
                title="Índice do livro"
                description="Encontre a palavra no verbete."
                onClick={() => navigate('livro', { params: { aba: 'indice' } })}
              />
              <PathCard
                icon={<span className="font-display text-xl font-bold text-roxo-2">25</span>}
                title="Tabela dos bichos"
                description="Grupos e dezenas em um lugar."
                onClick={() => navigate('ferramentas', { params: { aba: 'bichos' } })}
              />
            </div>

            <button
              type="button"
              onClick={() => navigate('livro')}
              className="focus-ring mt-4 flex w-full items-center gap-4 rounded-2xl border border-linha bg-[#F8F0DC] px-4 py-4 text-left transition-colors hover:bg-[#F4EAD0]"
            >
              <Image src="/book/capa.jpg" alt="Capa do Livro dos Sonhos" width={48} height={68} className="rounded-md object-cover shadow-sm" style={{ width: 48, height: 68 }} />
              <span>
                <span className="block font-display text-lg font-bold text-tinta">Seu livro também está aqui</span>
                <span className="mt-0.5 block text-sm font-medium text-roxo-2">Abrir o PDF original →</span>
              </span>
            </button>
          </>
        ) : meLoading ? (
          <div className="mt-6 space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : access?.pdf ? (
          <PlanoPdfView navigate={navigate} />
        ) : (
          <SemAcessoView email={me?.user?.email ?? ''} navigate={navigate} />
        )}
      </div>
    </div>
  )
}

function PathCard({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring flex w-full items-center gap-4 rounded-2xl border border-linha bg-white px-5 py-4 text-left transition-colors hover:border-roxo-2/40"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-lilas">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-bold text-tinta">{title}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
      <span aria-hidden="true" className="text-roxo">›</span>
    </button>
  )
}

function PlanoPdfView({ navigate }: { navigate: NavigateFn }) {
  return (
    <div className="mt-6">
      <section className="rounded-3xl bg-roxo px-6 py-7 text-white md:px-8">
        <p className="text-xs font-bold uppercase tracking-widest text-ouro">Seu plano: Livro digital</p>
        <h3 className="font-display mt-2 text-2xl font-bold md:text-3xl">Seu PDF já está disponível</h3>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-[#E4D6F2]">
          A busca por relatos e as ferramentas fazem parte do pacote Livro + Aplicativo.
        </p>
        <Button onClick={() => navigate('livro')} className="focus-ring mt-5 h-12 rounded-full bg-ouro px-6 text-base font-bold text-roxo hover:bg-[#EBBB3E]">
          Abrir o livro →
        </Button>
      </section>
      <div className="mt-4 rounded-2xl border border-linha bg-white px-5 py-4">
        <p className="font-display text-base font-bold text-tinta">Quer a busca completa?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          O pacote Livro + Aplicativo (R$ 24,90) inclui busca por palavra e relato, tabela dos bichos, gerador e salvos. Já comprou o
          PDF? O upgrade custa a diferença de R$ 19,90 pela sua oferta.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Fale com o suporte em <a className="font-medium text-roxo underline-offset-2 hover:underline" href="mailto:suporte@livrodossonhos.app">suporte@livrodossonhos.app</a> para concluir o upgrade.
        </p>
      </div>
    </div>
  )
}

function SemAcessoView({ email, navigate }: { email: string; navigate: NavigateFn }) {
  return (
    <div className="mt-6 space-y-4">
      <section className="rounded-2xl border border-linha bg-white px-6 py-6">
        <h3 className="font-display text-xl font-bold text-tinta">Localizando sua compra…</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Não encontramos acesso ativo vinculado a <strong className="text-tinta">{email}</strong>. Se você acabou de comprar, o
          processamento do pagamento pode levar alguns minutos. Atualize a página ou saia e entre novamente após a confirmação.
        </p>
        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <p className="font-semibold text-tinta">O que cada pacote inclui:</p>
          <p>· Livro digital (PDF) — R$ 12,90: o livro original para leitura.</p>
          <p>· Livro + Aplicativo — R$ 24,90: o PDF e todas as ferramentas de consulta.</p>
        </div>
        <p className="mt-4 text-sm">
          Dúvidas? <a className="font-bold text-roxo underline-offset-2 hover:underline" href="mailto:suporte@livrodossonhos.app">suporte@livrodossonhos.app</a>
        </p>
      </section>
      <Button variant="outline" onClick={() => navigate('conta')} className="focus-ring h-12 w-full rounded-2xl border-linha bg-white text-roxo hover:bg-lilas">
        Ver minha conta e compras
      </Button>
    </div>
  )
}
