'use client'

// Cartão de resultado de busca (tela 03): número, título, trecho, procedência.

import { SourceBadge } from '@/components/livro/SourceBadge'

export type EntryCardData = {
  slug: string
  title: string
  snippet: string
  sourceType: 'pdf_literal' | 'editorial'
  printPage: number | null
  ordinal?: number
  matchedTokens?: string[]
  editorialBaseTitle?: string | null
}

export function EntryCard({ data, onOpen }: { data: EntryCardData; onOpen: (slug: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(data.slug)}
      className="focus-ring w-full rounded-2xl border border-linha bg-white p-5 text-left transition-colors hover:border-roxo-2/40 hover:bg-[#FBF7F2]"
      aria-label={`Abrir verbete ${data.title}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            {data.ordinal ? <span className="font-display text-lg font-bold text-roxo-2">{String(data.ordinal).padStart(2, '0')}</span> : null}
            <h3 className="font-display truncate text-lg font-bold uppercase tracking-tight text-roxo md:text-xl">{data.title}</h3>
          </div>
          <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-muted-foreground">{data.snippet}</p>
          {data.editorialBaseTitle ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Conexão editorial com o verbete <strong className="text-roxo-2">{data.editorialBaseTitle}</strong>
            </p>
          ) : null}
        </div>
        <ChevronRight />
      </div>
      <div className="mt-3">
        <SourceBadge sourceType={data.sourceType} printPage={data.printPage} size="sm" />
      </div>
    </button>
  )
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#321053" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
