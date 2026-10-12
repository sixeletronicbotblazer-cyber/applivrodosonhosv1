'use client'

// Painel roxo de associações (tela 04): bicho, grupo, dezena, centena, milhar.
// Modo editorial: título muda para "No verbete relacionado X, o livro registra" —
// os números pertencem SEMPRE ao verbete-base, nunca ao termo editorial.

export type Association = {
  animal: string
  group: number | null
  dezena: string | null
  centena: string | null
  milhar: string | null
  loto?: string | null
  evidencePdfPage?: number
}

export function AssociationPanel({
  association,
  creditBaseTitle,
  compact = false,
}: {
  association: Association
  creditBaseTitle?: string | null
  compact?: boolean
}) {
  const editorial = !!creditBaseTitle
  return (
    <section
      aria-label={editorial ? 'Associações registradas no verbete relacionado do livro' : 'Associações registradas no livro'}
      className="rounded-2xl bg-roxo px-6 py-6 text-white shadow-sm md:px-8"
    >
      <p className="text-[13px] font-bold uppercase tracking-widest text-ouro">
        {editorial ? 'Associação do verbete relacionado' : 'Associações do livro'}
      </p>

      {editorial ? (
        <p className="mt-2 text-sm leading-relaxed text-[#E4D6F2]">
          No verbete relacionado <strong className="font-semibold text-white">{creditBaseTitle}</strong>, o livro registra:
        </p>
      ) : null}

      <p className={`font-display font-bold ${compact ? 'text-3xl' : 'text-4xl md:text-5xl'} mt-2`}>{association.animal}</p>

      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
        <NumberCell label="Grupo" value={association.group != null ? String(association.group).padStart(2, '0') : '—'} gold />
        <NumberCell label="Dezena" value={association.dezena ?? '—'} gold />
        <div className="col-span-2 h-px bg-white/15" role="presentation" />
        <NumberCell label="Centena" value={association.centena ?? '—'} />
        <NumberCell label="Milhar" value={association.milhar ?? '—'} />
      </div>

      {association.loto ? (
        <p className="mt-4 border-t border-white/10 pt-3 text-xs text-[#CDBBE0]">
          Loto (informativo do verbete): <span className="text-[#E4D6F2]">{association.loto}</span>
        </p>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-[#B7A3CC]">
        {editorial
          ? `Conexão editorial: o termo pesquisado não está impresso no PDF; os números acima são do verbete ${creditBaseTitle}.`
          : 'Valores exatamente como registrados no verbete do livro.'}
      </p>
    </section>
  )
}

function NumberCell({ label, value, gold = false }: { label: string; value: string; gold?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#CDBBE0]">{label}</p>
      <p className={`font-display text-3xl font-bold md:text-4xl ${gold ? 'text-ouro' : 'text-white'}`}>{value}</p>
    </div>
  )
}
