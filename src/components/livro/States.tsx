'use client'

// Estados de vazio/erro/bloqueio + cartão travado (DESIGN.md: LockedFeature, EmptyState, ErrorState).

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-linha bg-white/70 px-6 py-10 text-center">
      <span aria-hidden="true" className="text-2xl text-roxo-2">✦</span>
      <h3 className="font-display mt-2 text-xl font-bold text-tinta">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-2xl border border-[#E8C8C5] bg-[#FBF1F0] px-6 py-8 text-center">
      <h3 className="font-display text-lg font-bold text-[#8C2E28]">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[#7A4A46]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-linha bg-white p-5" aria-hidden="true">
      <div className="h-5 w-2/3 rounded bg-lilas" />
      <div className="mt-3 h-4 w-full rounded bg-[#F3EDE4]" />
      <div className="mt-2 h-4 w-4/5 rounded bg-[#F3EDE4]" />
      <div className="mt-4 h-6 w-32 rounded-full bg-[#F3EDE4]" />
    </div>
  )
}

export function LockedCard({
  icon,
  title,
  description,
  label = 'Bloqueado · acesso separado',
  tone = 'lilac',
}: {
  icon?: React.ReactNode
  title: string
  description: string
  label?: string
  tone?: 'lilac' | 'paper'
}) {
  return (
    <section className={`rounded-2xl border border-linha px-6 py-6 ${tone === 'lilac' ? 'bg-lilas/60' : 'bg-white'}`}>
      <div className="flex items-center gap-2 text-roxo-2">
        {icon ?? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        )}
        <p className="text-sm font-bold uppercase tracking-wide">{title === 'Módulo adicional' ? 'Módulo adicional' : title}</p>
      </div>
      <h3 className="font-display mt-2 text-xl font-bold text-tinta md:text-2xl">{title === 'Módulo adicional' ? 'Resultados da Federal' : title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-roxo-2/70">{label}</p>
    </section>
  )
}
