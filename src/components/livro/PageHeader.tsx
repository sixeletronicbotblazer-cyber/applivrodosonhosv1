'use client'

// Cabeçalho roxo das páginas (telas 01–05 do guia visual).

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <header className="bg-roxo text-[#F4EDF8] px-5 pt-8 pb-7 md:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="text-ouro text-lg leading-none">
            ✦
          </span>
          <h1 className="font-display text-[22px] md:text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        {subtitle ? <p className="mt-1.5 text-sm text-[#CDBBE0] md:text-[15px]">{subtitle}</p> : null}
        {children}
      </div>
    </header>
  )
}
