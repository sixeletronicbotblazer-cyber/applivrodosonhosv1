'use client'

// Tela 05 — ferramentas: índice, tabela dos 25 bichos, gerador de combinações
// por grupo, catálogo digital (travado sem lista verificada) e módulo Federal travado.

import { useEffect, useState } from 'react'
import { api, ApiError, type AnimalRow } from '@/lib/app-client'
import { useApp } from '@/lib/app-store'
import { PageHeader } from '@/components/livro/PageHeader'
import { Button } from '@/components/ui/button'
import { EmptyState, LockedCard } from '@/components/livro/States'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'

export function FerramentasView() {
  const { navigate, route, me, appConfig } = useApp()
  const [tab, setTab] = useState<'menu' | 'bichos' | 'gerador'>(route.params.aba === 'bichos' ? 'bichos' : route.params.aba === 'gerador' ? 'gerador' : 'menu')

  const catalogPublishedCount = 0 // catálogo só exibe valores com lista importada e revisada

  return (
    <div>
      <PageHeader title="Ferramentas" subtitle="Do livro à consulta prática" />

      <div className="mx-auto w-full max-w-3xl px-5 py-7 md:px-8">
        <h2 className="font-display text-3xl font-bold leading-tight text-tinta md:text-4xl">Tudo em um lugar.</h2>
        <p className="mt-1.5 text-[15px] text-muted-foreground">Abra a ferramenta que faz sentido hoje.</p>

        {tab === 'menu' ? (
          <div className="mt-6 space-y-4">
            <ToolCard
              n="01"
              title="Índice A–Z"
              description="Navegue pelos verbetes do livro."
              cta="Abrir índice"
              onClick={() => navigate('livro', { params: { aba: 'indice' } })}
            />
            <ToolCard
              n="02"
              title="Tabela dos 25 bichos"
              description="Consulte grupos e dezenas."
              cta="Ver tabela"
              onClick={() => setTab('bichos')}
            />
            <ToolCard
              n="03"
              title="Combinações por grupo"
              description="Monte combinações para consulta."
              cta="Gerar combinação"
              onClick={() => setTab('gerador')}
            />
            <ToolCard
              n="04"
              title="Catálogo digital"
              description={
                catalogPublishedCount > 0
                  ? 'Centenas e milhares da lista verificada.'
                  : 'Centenas e milhares — aguardando lista com origem verificada.'
              }
              cta="Abrir catálogo"
              disabled
              lockedLabel={catalogPublishedCount > 0 ? 'Disponível' : 'Indisponível · sem lista verificada'}
            />

            <LockedCard
              title="Módulo adicional"
              description={
                me?.access?.federalEntitledOnly
                  ? 'Você possui o módulo Federal, mas a fonte de resultados ainda não está configurada neste ambiente. Nenhum resultado fictício é exibido.'
                  : 'Resultados da Loteria Federal são um módulo vendido separadamente. Sem compra e fonte de dados ativa, permanece bloqueado.'
              }
              label={me?.access?.federal ? 'Ativo' : 'Bloqueado · acesso separado'}
            />
          </div>
        ) : tab === 'bichos' ? (
          <AnimaisTable onBack={() => setTab('menu')} />
        ) : (
          <Gerador onBack={() => setTab('menu')} federalNote={appConfig?.federalFeedConfigured ?? false} />
        )}
      </div>
    </div>
  )
}

function ToolCard({
  n,
  title,
  description,
  cta,
  onClick,
  disabled = false,
  lockedLabel,
}: {
  n: string
  title: string
  description: string
  cta: string
  onClick?: () => void
  disabled?: boolean
  lockedLabel?: string
}) {
  const inner = (
    <>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-lilas">
        <span className="font-display text-xl font-bold text-roxo-2">{n}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-display block text-lg font-bold text-tinta md:text-xl">{title}</span>
        <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{description}</span>
        <span className={`mt-1.5 block text-sm font-bold ${disabled ? 'text-muted-foreground' : 'text-roxo-2'}`}>
          {cta} <span aria-hidden="true">{disabled ? '· ' : '→'}</span>
          {lockedLabel ? <span className="font-medium">{lockedLabel}</span> : null}
        </span>
      </span>
      {!disabled ? <span aria-hidden="true" className="mt-1 text-roxo">›</span> : null}
    </>
  )
  const cls = `flex w-full items-center gap-4 rounded-2xl border border-linha px-5 py-5 text-left transition-colors ${
    disabled ? 'cursor-default bg-white/60 opacity-80' : 'bg-white hover:border-roxo-2/40'
  }`
  return disabled ? (
    <div className={cls} aria-disabled="true">
      {inner}
    </div>
  ) : (
    <button type="button" onClick={onClick} className={`focus-ring ${cls}`}>
      {inner}
    </button>
  )
}

function AnimaisTable({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<AnimalRow[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<{ animals: AnimalRow[]; notice: string }>('/api/animals')
      .then((res) => {
        setRows(res.animals)
        setNotice(res.notice)
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Tabela indisponível.'))
  }, [])

  return (
    <section className="mt-6">
      <BackLink onBack={onBack} label="Voltar às ferramentas" />
      <h3 className="font-display mt-3 text-2xl font-bold text-tinta">Tabela dos 25 bichos</h3>
      <p className="mt-1 text-sm text-muted-foreground">Grupos 1 a 25 com quatro dezenas por grupo.</p>

      {error ? (
        <div className="mt-5">
          <EmptyState title="Tabela indisponível" description={error} />
        </div>
      ) : !rows ? (
        <Skeleton className="mt-5 h-96 w-full rounded-2xl bg-lilas/50" />
      ) : (
        <>
          {notice ? <p className="mt-4 rounded-xl bg-[#F8F0DC] px-4 py-3 text-[13px] leading-relaxed text-[#6B5313]">{notice}</p> : null}
          <div className="nice-scroll mt-4 max-h-[60vh] overflow-y-auto rounded-2xl border border-linha bg-white">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-lilas text-roxo-2">
                <tr>
                  <th scope="col" className="px-4 py-3 font-bold">Grupo</th>
                  <th scope="col" className="px-4 py-3 font-bold">Bicho</th>
                  <th scope="col" className="px-4 py-3 font-bold">Dezenas</th>
                  <th scope="col" className="px-4 py-3 font-bold">Fonte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linha">
                {rows.map((r) => (
                  <tr key={r.group} className="hover:bg-[#FBF7F2]">
                    <td className="px-4 py-3 font-display font-bold text-roxo">{String(r.group).padStart(2, '0')}</td>
                    <td className="px-4 py-3 font-medium text-tinta">{r.animal}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{r.dezenas.join(' · ') || '—'}</td>
                    <td className="px-4 py-3">
                      {r.verification === 'verified_page' ? (
                        <span className="rounded-full bg-verde-bg px-2.5 py-1 text-[11px] font-bold text-verde">conferido</span>
                      ) : (
                        <span className="rounded-full bg-[#F8F0DC] px-2.5 py-1 text-[11px] font-bold text-[#8A6A14]">em revisão</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

function Gerador({ onBack, federalNote }: { onBack: () => void; federalNote: boolean }) {
  const [group, setGroup] = useState(9)
  const [count, setCount] = useState(6)
  const [stable, setStable] = useState(true)
  const [result, setResult] = useState<{ combos: string[]; seedLabel: string; method: string; animal: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const res = await api<{ combos: string[]; seedLabel: string; method: string; animal: string | null }>('/api/tools/generate', {
        method: 'POST',
        body: JSON.stringify({ group, count, stableSeed: stable }),
      })
      setResult(res)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível gerar agora.')
    } finally {
      setBusy(false)
    }
  }

  async function copyAll() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.combos.join(', '))
      toast({ title: 'Combinações copiadas' })
    } catch {
      toast({ title: 'Não foi possível copiar', description: 'Selecione os números manualmente.' })
    }
  }

  return (
    <section className="mt-6">
      <BackLink onBack={onBack} label="Voltar às ferramentas" />
      <h3 className="font-display mt-3 text-2xl font-bold text-tinta">Combinações por grupo</h3>
      <p className="mt-1 text-sm text-muted-foreground">Escolha o grupo e gere milhares cuja dezena final pertence ao grupo.</p>

      <div className="mt-5 rounded-2xl border border-linha bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="gen-group" className="text-xs font-bold uppercase tracking-wide text-roxo">Grupo</label>
            <select
              id="gen-group"
              value={group}
              onChange={(e) => setGroup(Number(e.target.value))}
              className="focus-ring mt-1.5 h-12 w-full rounded-xl border border-linha bg-[#FCF8F1] px-3 text-base"
            >
              {Array.from({ length: 25 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  {String(g).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="gen-count" className="text-xs font-bold uppercase tracking-wide text-roxo">Quantidade</label>
            <select
              id="gen-count"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="focus-ring mt-1.5 h-12 w-full rounded-xl border border-linha bg-[#FCF8F1] px-3 text-base"
            >
              {[4, 6, 8, 12].map((c) => (
                <option key={c} value={c}>
                  {c} combinações
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-roxo">Semente</span>
            <label className="mt-1.5 flex h-12 items-center gap-2.5 rounded-xl border border-linha bg-[#FCF8F1] px-3 text-sm">
              <input type="checkbox" checked={stable} onChange={(e) => setStable(e.target.checked)} className="h-4 w-4 accent-[#321053]" />
              Fixa para hoje (mesma lista)
            </label>
          </div>
        </div>
        <Button onClick={() => void generate()} disabled={busy} className="focus-ring mt-4 h-12 w-full rounded-2xl bg-roxo text-base font-semibold hover:bg-roxo-2 disabled:opacity-70">
          {busy ? 'Gerando…' : 'Gerar combinação'}
        </Button>
        {error ? <p role="alert" className="mt-2 text-sm font-medium text-destructive">{error}</p> : null}

        {result ? (
          <div className="mt-5" aria-live="polite">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Semente: {result.seedLabel}
                {result.animal ? ` · grupo ${String(group).padStart(2, '0')} (${result.animal})` : ''}
              </p>
              <Button variant="outline" onClick={() => void copyAll()} className="focus-ring h-9 rounded-lg border-linha px-3 text-xs font-bold text-roxo hover:bg-lilas">
                Copiar
              </Button>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {result.combos.map((c) => (
                <li key={c} className="rounded-xl bg-roxo px-3 py-3 text-center font-display text-2xl font-bold tracking-[0.15em] text-ouro">
                  {c}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{result.method}</p>
          </div>
        ) : null}
      </div>

      {!federalNote ? (
        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
          Lembrete: combinações geradas servem para organizar consulta. Não aumentam a chance de resultado.
        </p>
      ) : null}
    </section>
  )
}

function BackLink({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button type="button" onClick={onBack} className="focus-ring text-sm font-semibold text-roxo-2 underline-offset-2 hover:underline">
      ← {label}
    </button>
  )
}
