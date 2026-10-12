'use client'

// Tela 03 — busca por palavra ou relato (até 500 caracteres), elementos identificados,
// até 3 candidatos com procedência. Estados: vazio, carregando, sem resultado, ambíguo.

import { useEffect, useRef, useState } from 'react'
import { api, ApiError, type SearchResponse } from '@/lib/app-client'
import { useApp } from '@/lib/app-store'
import { PageHeader } from '@/components/livro/PageHeader'
import { Button } from '@/components/ui/button'
import { EntryCard } from '@/components/livro/EntryCard'
import { EmptyState, SkeletonCard } from '@/components/livro/States'
import { Textarea } from '@/components/ui/textarea'

const MAX = 500

export function BuscarView() {
  const { route, navigate, refreshMe } = useApp()
  const [query, setQuery] = useState(route.params.q ?? '')
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoRan = useRef(false)

  async function runSearch(q: string) {
    const trimmed = q.trim()
    if (!trimmed) {
      setError('Digite uma palavra ou descreva o que lembra do sonho.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await api<SearchResponse>('/api/search', { method: 'POST', body: JSON.stringify({ query: trimmed }) })
      setResult(res)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'auth_required') {
        await refreshMe()
        navigate('entrar')
        return
      }
      setError(e instanceof ApiError ? e.message : 'A busca falhou. Tente novamente.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // ?q=…&auto=1 vindo do Início
    if (route.params.auto === '1' && route.params.q && !autoRan.current) {
      autoRan.current = true
      void runSearch(route.params.q)
    }
  }, [route.params.auto, route.params.q])


  return (
    <div>
      <PageHeader title="Buscar um sonho" subtitle="Palavra, elemento ou pequena descrição" />

      <div className="mx-auto w-full max-w-3xl px-5 py-7 md:px-8">
        <h2 className="font-display text-3xl font-bold leading-tight text-tinta md:text-4xl">
          Conte o que ficou
          <br />
          na sua memória.
        </h2>

        <div className="mt-5 rounded-2xl border border-linha bg-white p-5">
          <Textarea
            aria-label="Palavra ou descrição do sonho"
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, MAX))}
            placeholder="Sonhei com um cavalo branco correndo em uma estrada e acordei feliz…"
            className="min-h-28 resize-none border-0 bg-transparent p-0 text-[17px] leading-relaxed shadow-none focus-visible:ring-0"
          />
          <div className="mt-4 flex items-center justify-between border-t border-linha pt-3">
            <p className="text-xs text-muted-foreground">Palavra ou descrição · até {MAX} caracteres</p>
            <p className="text-xs tabular-nums text-muted-foreground" aria-live="off">
              {query.length}/{MAX}
            </p>
          </div>
        </div>

        {error ? (
          <p role="alert" className="mt-3 text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}

        <Button
          onClick={() => void runSearch(query)}
          disabled={loading}
          className="focus-ring mt-4 h-14 w-full justify-between rounded-2xl bg-roxo px-6 text-base font-semibold hover:bg-roxo-2 disabled:opacity-70"
        >
          {loading ? 'Procurando no livro…' : 'Encontrar no livro'}
          <span aria-hidden="true">›</span>
        </Button>

        {result && result.elements.length > 0 ? (
          <section className="mt-7">
            <h3 className="text-xs font-bold uppercase tracking-widest text-roxo">Elementos identificados</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {result.elements.map((el) => (
                <span key={el} className="rounded-full bg-lilas px-3.5 py-1.5 text-sm font-medium text-roxo-2">
                  {el}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-7" aria-live="polite">
          {loading ? (
            <div className="space-y-3.5">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : result ? (
            result.candidates.length > 0 ? (
              <>
                <h3 className="font-display text-2xl font-bold text-tinta">Verbetes para conferir</h3>
                {result.ambiguous ? (
                  <p className="mt-1.5 rounded-xl bg-[#F8F0DC] px-4 py-3 text-sm text-[#6B5313]">
                    Mais de um verbete combina com o relato — escolha o mais próximo da sua lembrança.
                  </p>
                ) : null}
                <div className="mt-4 space-y-3.5">
                  {result.candidates.map((c, i) => (
                    <EntryCard
                      key={c.id}
                      data={{
                        slug: c.slug,
                        title: c.title,
                        snippet: c.snippet,
                        sourceType: c.sourceType,
                        printPage: c.printPage,
                        ordinal: result.candidates.length > 1 ? i + 1 : undefined,
                        editorialBaseTitle: c.editorialBase?.title ?? null,
                      }}
                      onOpen={(slug) => navigate('verbete', { slug, params: { de: 'buscar' } })}
                    />
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                title="Nada encontrado no livro"
                description={result.suggestion ?? 'Não encontramos correspondência confiável para esse relato.'}
                action={
                  <Button variant="outline" onClick={() => navigate('livro', { params: { aba: 'indice' } })} className="focus-ring h-11 rounded-xl border-linha bg-white text-roxo hover:bg-lilas">
                    Abrir índice A–Z
                  </Button>
                }
              />
            )
          ) : (
            <EmptyState
              title="Sua consulta aparece aqui"
              description="Digite uma palavra-chave (ex.: cavalo) ou um pequeno relato. Mostramos até 3 verbetes do livro para você conferir."
            />
          )}
        </section>
      </div>
    </div>
  )
}
