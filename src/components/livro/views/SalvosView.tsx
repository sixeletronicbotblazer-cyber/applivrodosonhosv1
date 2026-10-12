'use client'

// Salvos — verbetes favoritos do usuário, com opção de apagar (um ou todos).

import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/app-client'
import { useApp } from '@/lib/app-store'
import { PageHeader } from '@/components/livro/PageHeader'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/livro/States'
import { Skeleton } from '@/components/ui/skeleton'
import { SourceBadge } from '@/components/livro/SourceBadge'
import { toast } from '@/hooks/use-toast'

type SavedItem = {
  slug: string
  title: string
  sourceType: 'pdf_literal' | 'editorial'
  printPage: number | null
  pdfPage: number | null
  animal: string | null
  dezena: string | null
  savedAt: string
}

export function SalvosView() {
  const { navigate } = useApp()
  const [items, setItems] = useState<SavedItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api<{ items: SavedItem[] }>('/api/saved')
      .then((res) => {
        if (alive) setItems(res.items)
      })
      .catch((e) => {
        if (alive) setError(e instanceof ApiError ? e.message : 'Não foi possível carregar os salvos.')
      })
    return () => {
      alive = false
    }
  }, [])

  async function remove(slug: string) {
    try {
      await api(`/api/saved?slug=${encodeURIComponent(slug)}`, { method: 'DELETE' })
      setItems((prev) => prev?.filter((i) => i.slug !== slug) ?? [])
      toast({ title: 'Removido dos salvos' })
    } catch {
      toast({ title: 'Não foi possível remover agora', description: 'Tente novamente em instantes.' })
    }
  }

  async function clearAll() {
    try {
      await api('/api/saved?all=1', { method: 'DELETE' })
      setItems([])
      toast({ title: 'Lista de salvos apagada' })
    } catch {
      toast({ title: 'Não foi possível apagar agora', description: 'Tente novamente em instantes.' })
    }
  }

  return (
    <div>
      <PageHeader title="Salvos" subtitle="Seus verbetes guardados para reconsulta" />

      <div className="mx-auto w-full max-w-3xl px-5 py-7 md:px-8">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Os salvos ficam vinculados à sua conta neste serviço. Você pode apagar um por um ou tudo de uma vez.
        </p>

        {error ? (
          <div className="mt-5">
            <EmptyState title="Não foi possível carregar" description={error} />
          </div>
        ) : !items ? (
          <div className="mt-5 space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl bg-lilas/50" />
            <Skeleton className="h-20 w-full rounded-2xl bg-lilas/50" />
          </div>
        ) : items.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title="Nenhum salvo ainda"
              description="Abra um verbete e toque no marcador para guardá-lo aqui."
              action={
                <Button onClick={() => navigate('buscar')} className="focus-ring h-11 rounded-xl bg-roxo px-5 text-white hover:bg-roxo-2">
                  Buscar um sonho
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="mt-5 space-y-3">
              {items.map((it) => (
                <div key={it.slug} className="rounded-2xl border border-linha bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => navigate('verbete', { slug: it.slug, params: { de: 'salvos' } })} className="focus-ring min-w-0 flex-1 text-left">
                      <h3 className="font-display truncate text-lg font-bold uppercase tracking-tight text-roxo">{it.title}</h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {it.animal ? `${it.animal} · dezena ${it.dezena ?? '—'}` : 'Sugestão editorial'}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(it.slug)}
                      aria-label={`Remover ${it.title} dos salvos`}
                      className="focus-ring flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-[#FBF1F0] hover:text-destructive"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-2.5">
                    <SourceBadge sourceType={it.sourceType} printPage={it.printPage} size="sm" />
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={() => void clearAll()}
              className="focus-ring mt-5 h-12 w-full rounded-2xl border-linha bg-white text-destructive hover:bg-[#FBF1F0]"
            >
              Apagar todos os salvos
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
