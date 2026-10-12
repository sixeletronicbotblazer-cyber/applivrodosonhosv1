'use client'

// Tela 04 — verbete: título, etiqueta de procedência, interpretação, associações
// exatamente vinculadas à fonte, ver página original, salvar, sugestões editoriais.

import { useEffect, useState } from 'react'
import { api, ApiError, type EntryDetail } from '@/lib/app-client'
import { useApp } from '@/lib/app-store'
import { PageHeader } from '@/components/livro/PageHeader'
import { SourceBadge } from '@/components/livro/SourceBadge'
import { AssociationPanel } from '@/components/livro/AssociationPanel'
import { SkeletonCard, EmptyState } from '@/components/livro/States'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

function displayTitle(raw: string): string {
  if (raw.length <= 2) return raw.toUpperCase() // letras soltas (verbete "A")
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
}

const BACK_FROM: Record<string, { view: 'buscar' | 'livro' | 'salvos' | 'ferramentas'; label: string; params?: Record<string, string> }> = {
  buscar: { view: 'buscar', label: 'Voltar à busca' },
  indice: { view: 'livro', label: 'Voltar ao índice A–Z', params: { aba: 'indice' } },
  salvos: { view: 'salvos', label: 'Voltar aos salvos' },
  bichos: { view: 'ferramentas', label: 'Voltar às ferramentas', params: { aba: 'bichos' } },
}

export function VerbeteView() {
  const { route, navigate } = useApp()
  const slug = route.slug
  const back = BACK_FROM[route.params.de ?? ''] ?? BACK_FROM.buscar
  const [data, setData] = useState<{ slug: string; entry: EntryDetail | null; error: string | null } | null>(null)
  const [savedBusy, setSavedBusy] = useState(false)

  const entry = data && data.slug === slug ? data.entry : null
  const error = data && data.slug === slug ? data.error : null
  const loading = !slug || data === null || data.slug !== slug

  useEffect(() => {
    if (!slug) return
    let alive = true
    api<{ entry: EntryDetail }>(`/api/entries?slug=${encodeURIComponent(slug)}`)
      .then((res) => {
        if (alive) setData({ slug, entry: res.entry, error: null })
      })
      .catch((e) => {
        if (alive) setData({ slug, entry: null, error: e instanceof ApiError ? e.message : 'Não foi possível abrir o verbete.' })
      })
    return () => {
      alive = false
    }
  }, [slug])

  async function toggleSave() {
    if (!entry || savedBusy) return
    setSavedBusy(true)
    const nextSaved = !entry.saved
    try {
      if (nextSaved) {
        await api('/api/saved', { method: 'POST', body: JSON.stringify({ slug: entry.slug }) })
        toast({ title: 'Salvo para consultar depois' })
      } else {
        await api(`/api/saved?slug=${encodeURIComponent(entry.slug)}`, { method: 'DELETE' })
        toast({ title: 'Removido dos salvos' })
      }
      setData((prev) => (prev && prev.slug === entry.slug && prev.entry ? { ...prev, entry: { ...prev.entry, saved: nextSaved } } : prev))
    } catch {
      toast({ title: 'Não foi possível salvar agora', description: 'Tente novamente em instantes.' })
    } finally {
      setSavedBusy(false)
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Resultado da consulta" subtitle="Verbete conferido no Livro dos Sonhos" />
        <div className="mx-auto w-full max-w-3xl space-y-4 px-5 py-7 md:px-8">
          <BackLink label={back.label} onClick={() => navigate(back.view, { params: back.params })} />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (error || !entry) {
    return (
      <div>
        <PageHeader title="Resultado da consulta" subtitle="Verbete conferido no Livro dos Sonhos" />
        <div className="mx-auto w-full max-w-3xl px-5 py-7 md:px-8">
          <BackLink label={back.label} onClick={() => navigate(back.view, { params: back.params })} />
          <div className="mt-4">
          <EmptyState
            title="Verbete não disponível"
            description={error ?? 'Este verbete pode ainda estar em revisão editorial.'}
            action={
              <Button onClick={() => navigate(back.view, { params: back.params })} className="focus-ring h-11 rounded-xl bg-roxo px-5 text-white hover:bg-roxo-2">
                {back.label}
              </Button>
            }
          />
          </div>
        </div>
      </div>
    )
  }

  const assoc = entry.association
  const isEditorial = entry.sourceType === 'editorial'

  return (
    <div>
      <PageHeader title="Resultado da consulta" subtitle="Verbete conferido no Livro dos Sonhos" />

      <div className="mx-auto w-full max-w-3xl px-5 py-7 md:px-8">
        <BackLink label={back.label} onClick={() => navigate(back.view, { params: back.params })} />
        <div className="mt-3 flex items-start justify-between gap-4">
          <h2 className="font-display text-4xl font-bold tracking-tight text-tinta md:text-5xl">{displayTitle(entry.title)}</h2>
          <button
            type="button"
            onClick={() => void toggleSave()}
            aria-pressed={entry.saved}
            aria-label={entry.saved ? 'Remover dos salvos' : 'Salvar verbete'}
            className="focus-ring mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-linha bg-white text-roxo transition-colors hover:bg-lilas"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={entry.saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
            </svg>
          </button>
        </div>

        <div className="mt-3.5 flex flex-wrap gap-2">
          <SourceBadge sourceType={entry.sourceType} printPage={entry.printPage} />
          {isEditorial && entry.category ? (
            <span className="rounded-full bg-[#F7F1E8] px-3 py-1.5 text-xs font-medium capitalize text-muted-foreground">{entry.category.replace(/_/g, ' ')}</span>
          ) : null}
        </div>

        {/* O que diz o verbete */}
        <section className="mt-5 rounded-2xl border border-linha bg-white p-6 md:p-7">
          <h3 className="text-xs font-bold uppercase tracking-widest text-roxo">
            {isEditorial ? 'Leitura editorial (não é texto do livro)' : 'O que diz o verbete'}
          </h3>
          <p className="mt-3 whitespace-pre-line text-[17px] leading-relaxed text-tinta">{entry.meaning}</p>
          {isEditorial ? (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Interpretação editorial original, criada para situações atuais. Não é citação do PDF.
            </p>
          ) : null}
          {entry.aliases.length > 0 ? (
            <div className="mt-4 border-t border-linha pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Também pode aparecer como</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {entry.aliases.map((a) => (
                  <span key={a} className="rounded-full bg-[#F7F1E8] px-3 py-1 text-[13px] text-muted-foreground">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* Associações */}
        {isEditorial && entry.editorialBase ? (
          entry.editorialBase.association ? (
            <div className="mt-5">
              <AssociationPanel association={entry.editorialBase.association} creditBaseTitle={entry.editorialBase.title} />
              <div className="mt-3 rounded-2xl border border-linha bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-roxo">O que o verbete {entry.editorialBase.title} diz</p>
                <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-muted-foreground">{entry.editorialBase.meaning}</p>
                <Button
                  variant="link"
                  onClick={() => navigate('verbete', { slug: entry.editorialBase!.slug })}
                  className="focus-ring mt-1 h-9 px-0 text-sm font-semibold text-roxo-2 hover:underline"
                >
                  Abrir verbete {entry.editorialBase.title} →
                </Button>
              </div>
            </div>
          ) : null
        ) : assoc ? (
          <div className="mt-5">
            <AssociationPanel association={assoc} />
          </div>
        ) : null}

        {/* Ver página original */}
        {!isEditorial && entry.pdfPage ? (
          <button
            type="button"
            onClick={() => navigate('livro', { params: { pagina: String(entry.pdfPage) } })}
            className="focus-ring mt-5 w-full rounded-2xl border border-linha bg-white px-6 py-5 text-left transition-colors hover:bg-[#FBF7F2]"
          >
            <span className="flex items-center gap-2.5">
              <BookIcon />
              <span className="font-display text-lg font-bold text-tinta">Ver a página original do livro</span>
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">Confira a escrita e o contexto completo.</span>
          </button>
        ) : null}

        {/* Sugestões editoriais relacionadas */}
        {entry.relatedEditorial.filter((r) => !r.isCurrent).length > 0 ? (
          <section className="mt-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-roxo">Sugestões relacionadas (editoriais)</h3>
            <div className="mt-3 space-y-3">
              {entry.relatedEditorial
                .filter((r) => !r.isCurrent)
                .map((r) => (
                  <button
                    key={r.slug}
                    type="button"
                    onClick={() => navigate('verbete', { slug: r.slug })}
                    className="focus-ring w-full rounded-2xl border border-linha bg-white px-5 py-4 text-left transition-colors hover:bg-[#FBF7F2]"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-display text-base font-bold capitalize text-roxo-2">{r.title}</span>
                      <span aria-hidden="true" className="text-roxo">›</span>
                    </span>
                    <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{r.meaning}</span>
                  </button>
                ))}
            </div>
          </section>
        ) : null}

        {/* Aviso (tela 04) */}
        <aside className="mt-6 rounded-2xl bg-[#F8F0DC] px-6 py-5">
          <p className="font-display text-base font-bold text-tinta">As associações são para consulta.</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Não garantem resultado de jogo.</p>
        </aside>
      </div>
    </div>
  )
}

function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring text-sm font-semibold text-roxo-2 underline-offset-2 hover:underline"
    >
      ← {label}
    </button>
  )
}

function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#321053" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  )
}
