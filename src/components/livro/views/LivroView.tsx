'use client'

// Livro — capa, visualizador de páginas (zoom) e índice A–Z.
// Disponível para book_pdf e book_app (rota de leitura do produto básico).

import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/app-client'
import { useApp } from '@/lib/app-store'
import { PageHeader } from '@/components/livro/PageHeader'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/livro/States'
import { Skeleton } from '@/components/ui/skeleton'

type BookPage = { pdfPage: number; printPage: number | null; imagePath: string | null; title: string }

export function LivroView() {
  const { route, navigate, refreshMe } = useApp()
  const [pagesData, setPagesData] = useState<{ pages: BookPage[]; notice: string } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [indexData, setIndexData] = useState<{ letters: { letter: string; entries: { slug: string; title: string; sourceType: string; printPage: number | null }[] }[]; total: number } | null>(null)
  const [indexError, setIndexError] = useState<string | null>(null)
  const [letterFilter, setLetterFilter] = useState<string | null>(null)

  const aba = route.params.aba === 'indice' ? 'indice' : 'paginas'
  const paginaParam = route.params.pagina ? Number(route.params.pagina) : null
  const pages = pagesData?.pages ?? []
  const notice = pagesData?.notice ?? null
  const currentPage = pages.find((p) => p.pdfPage === paginaParam) ?? pages[0] ?? null

  useEffect(() => {
    let alive = true
    api<{ pages: BookPage[]; notice: string }>('/api/book/pages')
      .then((res) => {
        if (!alive) return
        setPagesData(res)
      })
      .catch(async (e) => {
        if (e instanceof ApiError && e.code === 'auth_required') {
          await refreshMe()
          navigate('entrar')
        }
      })
    return () => {
      alive = false
    }
  }, [navigate, refreshMe])

  useEffect(() => {
    let alive = true
    api<{ letters: { letter: string; entries: { slug: string; title: string; sourceType: string; printPage: number | null }[] }[]; total: number }>('/api/index')
      .then((res) => alive && setIndexData(res))
      .catch((e) => alive && setIndexError(e instanceof ApiError ? e.message : 'Índice indisponível.'))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div>
      <PageHeader title="Seu livro" subtitle="Páginas originais e índice de verbetes" />

      <div className="mx-auto w-full max-w-3xl px-5 py-6 md:px-8">
        {/* Abas */}
        <div className="flex gap-2" role="tablist" aria-label="Seções do livro">
          <TabButton active={aba === 'paginas'} onClick={() => navigate('livro', { params: {} })}>
            Páginas
          </TabButton>
          <TabButton active={aba === 'indice'} onClick={() => navigate('livro', { params: { aba: 'indice' } })}>
            Índice A–Z
          </TabButton>
        </div>

        {aba === 'paginas' ? (
          !pagesData ? (
            <Skeleton className="mt-6 h-96 w-full rounded-2xl bg-lilas/50" />
          ) : currentPage ? (
            <>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Escolher página do livro"
                    value={currentPage.pdfPage}
                    onChange={(e) => navigate('livro', { params: { pagina: e.target.value } })}
                    className="focus-ring h-11 rounded-xl border border-linha bg-white px-3 text-sm font-medium text-tinta"
                  >
                    {pages.map((p) => (
                      <option key={p.pdfPage} value={p.pdfPage}>
                        {p.title} (PDF pág. {p.pdfPage})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2" role="group" aria-label="Zoom da página">
                  <ZoomBtn onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))} label="Diminuir zoom">−</ZoomBtn>
                  <span className="w-14 text-center text-sm tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
                  <ZoomBtn onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} label="Aumentar zoom">+</ZoomBtn>
                </div>
              </div>

              <div className="nice-scroll mt-4 max-h-[70vh] overflow-auto rounded-2xl border border-linha bg-white p-3">
                <img
                  src={currentPage.imagePath ?? ''}
                  alt={`Página do livro — ${currentPage.title}`}
                  style={{ width: `${zoom * 100}%` }}
                  className="mx-auto block h-auto max-w-full rounded-lg"
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {currentPage.title} · página do PDF: {currentPage.pdfPage}
                {currentPage.printPage ? ` · página impressa: ${String(currentPage.printPage).padStart(2, '0')}` : ''}
              </p>

              {notice ? <p className="mt-4 rounded-xl bg-lilas/60 px-4 py-3 text-[13px] leading-relaxed text-roxo-2">{notice}</p> : null}
            </>
          ) : (
            <div className="mt-6">
              <EmptyState title="Nenhuma página anexada" description="O operador deve anexar as páginas do PDF original para liberar a leitura aqui." />
            </div>
          )
        ) : (
          <>
            <div className="mt-6" role="tabpanel" aria-label="Índice A-Z">
              {indexError ? (
                <EmptyState title="Índice indisponível" description={indexError} />
              ) : !indexData ? (
                <Skeleton className="h-64 w-full rounded-2xl bg-lilas/50" />
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {indexData.total} verbetes publicados. Entradas editoriais aparecem marcadas com ✦ e não são texto do livro.
                  </p>
                  {/* navegação por letras */}
                  <div className="nice-scroll mt-4 flex gap-1.5 overflow-x-auto pb-2" role="navigation" aria-label="Letras do índice">
                    {indexData.letters.map((g) => (
                      <button
                        key={g.letter}
                        type="button"
                        onClick={() => setLetterFilter(letterFilter === g.letter ? null : g.letter)}
                        aria-pressed={letterFilter === g.letter}
                        className={`focus-ring h-10 min-w-10 shrink-0 rounded-lg px-3 text-sm font-bold transition-colors ${
                          letterFilter === g.letter ? 'bg-roxo text-white' : 'bg-lilas text-roxo-2 hover:bg-[#E8DBF2]'
                        }`}
                      >
                        {g.letter}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 space-y-5">
                    {indexData.letters
                      .filter((g) => !letterFilter || g.letter === letterFilter)
                      .map((g) => (
                        <section key={g.letter} aria-label={`Verbetes com a letra ${g.letter}`}>
                          <h3 className="font-display text-xl font-bold text-roxo">{g.letter}</h3>
                          <ul className="mt-2 divide-y divide-linha overflow-hidden rounded-2xl border border-linha bg-white">
                            {g.entries.map((e) => (
                              <li key={e.slug}>
                                <button
                                  type="button"
                                  onClick={() => navigate('verbete', { slug: e.slug })}
                                  className="focus-ring flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[#FBF7F2]"
                                >
                                  <span className="flex min-w-0 items-center gap-2">
                                    <span className="font-display truncate text-[15px] font-semibold uppercase tracking-tight text-tinta">{e.title}</span>
                                    {e.sourceType === 'editorial' ? <span title="Sugestão editorial" className="text-ouro" aria-label="entrada editorial">✦</span> : null}
                                  </span>
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    {e.printPage ? `pág. ${String(e.printPage).padStart(2, '0')}` : 'editorial'}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </section>
                      ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`focus-ring h-11 rounded-full px-5 text-sm font-bold transition-colors ${
        active ? 'bg-roxo text-white' : 'bg-lilas text-roxo-2 hover:bg-[#E8DBF2]'
      }`}
    >
      {children}
    </button>
  )
}

function ZoomBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="focus-ring h-10 w-10 rounded-lg border border-linha bg-white text-lg font-bold text-roxo hover:bg-lilas"
    >
      {children}
    </button>
  )
}
