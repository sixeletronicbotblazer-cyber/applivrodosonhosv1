'use client'

// Etiquetas de procedência (DESIGN.md):
//  - literal: etiqueta verde "Do Livro dos Sonhos" + página impressa
//  - editorial: etiqueta lilás "Sugestão relacionada" (conexão editorial, nunca texto do livro)

export function SourceBadge({
  sourceType,
  printPage,
  size = 'md',
}: {
  sourceType: 'pdf_literal' | 'editorial'
  printPage?: number | null
  size?: 'sm' | 'md'
}) {
  const cls = size === 'sm' ? 'text-[11px] px-2.5 py-1' : 'text-xs px-3.5 py-1.5'
  if (sourceType === 'pdf_literal') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-verde-bg font-semibold uppercase tracking-wide text-verde ${cls}`}>
        <BookMini />
        Livro{typeof printPage === 'number' ? ` · página impressa ${printPage}` : ''}
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-lilas font-semibold uppercase tracking-wide text-roxo-2 ${cls}`}>
      <SparkMini />
      Sugestão relacionada
    </span>
  )
}

function BookMini() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  )
}

function SparkMini() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
    </svg>
  )
}
