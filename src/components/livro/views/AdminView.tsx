'use client'

// Admin — curadoria dos 1.076 registros de trabalho:
//  · Revisão lado a lado com a página do PDF (quando a imagem existe)
//  · Correção de título/interpretação/números, publicar individual ou em lote
//  · Aliases (variações contextuais) para ativar após revisão
//  · Pagamentos: simulação de eventos (mesmo pipeline do webhook) + log idempotente
//  · Catálogo: importação auditável (JSON/CSV) com origem e critério obrigatórios
//  · Caixa OTP dev (somente modo de desenvolvimento sem SMTP)

import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/app-client'
import { useApp } from '@/lib/app-store'
import { PageHeader } from '@/components/livro/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'

type Overview = {
  counts: { totalEntries: number; published: number; pdfLiteral: number; editorial: number; draft: number; aliasesDraft: number; aliasesActive: number; workRecordsTotal: number; searchCount: number }
  publishedBreakdown: { pdfLiteral: number; editorial: number }
  integrations: { smtpConfigured: boolean; webhookSecretConfigured: boolean; offersConfigured: Record<string, boolean>; federalFeedConfigured: boolean; demoMode: boolean }
  recentPayments: { eventId: string; eventType: string; paymentId: string | null; result: string | null; simulated: boolean; processedAt: string }[]
  entitlements: { id: string; buyerEmail: string; productKey: string; status: string; paymentId: string; grantedAt: string | null; revokedAt: string | null }[]
}

type AdminEntry = {
  id: string
  slug: string
  title: string
  sourceType: 'pdf_literal' | 'editorial'
  kind: string | null
  reviewStatus: string
  pdfPage: number | null
  printPage: number | null
  meaning: string | null
  reviewerNote: string | null
  sourceNotes: string | null
  association: { animal: string; group: number | null; dezena: string | null; centena: string | null; milhar: string | null; loto: string | null; evidencePdfPage: number } | null
  relatedBase: { id: string; title: string; reviewStatus: string; association: { animal: string; group: number | null; dezena: string | null; centena: string | null; milhar: string | null } | null } | null
}

type Tab = 'overview' | 'review' | 'aliases' | 'payments' | 'catalog' | 'otp'

export function AdminView() {
  const { me } = useApp()
  const [tab, setTab] = useState<Tab>('overview')

  if (!me?.user) return null
  if (me.user.role !== 'ADMIN') {
    return (
      <div>
        <PageHeader title="Administração" subtitle="Acesso restrito" />
        <div className="mx-auto max-w-3xl px-5 py-10">
          <div className="rounded-2xl border border-linha bg-white p-8 text-center">
            <p className="font-display text-xl font-bold text-tinta">Painel protegido por papel administrativo.</p>
            <p className="mt-2 text-sm text-muted-foreground">Sua conta ({me.user.email}) não possui o papel ADMIN.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Administração" subtitle="Curadoria, pagamentos e integrações" />
      <div className="mx-auto w-full max-w-3xl px-5 py-6 md:px-8">
        <div className="nice-scroll flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Seções administrativas">
          {(
            [
              ['overview', 'Visão geral'],
              ['review', 'Revisão de verbetes'],
              ['aliases', 'Aliases'],
              ['payments', 'Pagamentos'],
              ['catalog', 'Catálogo'],
              ['otp', 'OTP (dev)'],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`focus-ring h-10 shrink-0 rounded-full px-4 text-sm font-bold transition-colors ${
                tab === t ? 'bg-roxo text-white' : 'bg-lilas text-roxo-2 hover:bg-[#E8DBF2]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === 'overview' ? <OverviewTab /> : tab === 'review' ? <ReviewTab /> : tab === 'aliases' ? <AliasesTab /> : tab === 'payments' ? <PaymentsTab /> : tab === 'catalog' ? <CatalogTab /> : <OtpTab />}
        </div>
      </div>
    </div>
  )
}

// ── Visão geral ─────────────────────────────────────────────────────────

function OverviewTab() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<Overview>('/api/admin/overview')
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Erro ao carregar visão geral.'))
  }, [])

  if (error) return <EmptyBox text={error} />
  if (!data) return <Skeleton className="h-72 w-full rounded-2xl bg-lilas/50" />

  const c = data.counts
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Registros de trabalho" value={c.workRecordsTotal} hint={`${c.totalEntries} verbetes + ${c.aliasesDraft + c.aliasesActive} aliases`} />
        <StatCard label="Publicados" value={c.published} hint={`${data.publishedBreakdown.pdfLiteral} do PDF · ${data.publishedBreakdown.editorial} editoriais`} gold />
        <StatCard label="Em curadoria (draft)" value={c.draft} hint="aguardando conferência com a página" />
        <StatCard label="Aliases (draft)" value={c.aliasesDraft} hint={`${c.aliasesActive} ativos`} />
      </div>

      <div className="rounded-2xl border border-linha bg-white p-5">
        <h3 className="font-display text-lg font-bold text-tinta">Cobertura</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Verbetes literais do PDF: <strong className="text-tinta">{data.publishedBreakdown.pdfLiteral}</strong> publicados de{' '}
          <strong className="text-tinta">{c.pdfLiteral}</strong> extraídos. Meta operacional "2×" ={' '}
          <strong className="text-tinta">{c.pdfLiteral * 2}</strong> registros de trabalho (contagem de importação, não de verbetes
          literais validados).
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Buscas registradas (telemetria mínima, sem texto): {c.searchCount}</p>
      </div>

      <div className="rounded-2xl border border-linha bg-white p-5">
        <h3 className="font-display text-lg font-bold text-tinta">Integrações</h3>
        <ul className="mt-2 space-y-2 text-sm">
          <IntegrationRow ok={data.integrations.smtpConfigured} label="E-mail SMTP (OTP real)" missingNote="não configurado — modo dev: código visível na caixa OTP (aba ao lado)" />
          <IntegrationRow ok={data.integrations.webhookSecretConfigured} label="Assinatura do webhook Cakto" missingNote="não configurada — eventos aceitos sem verificação (apenas dev)" />
          <IntegrationRow ok={Object.values(data.integrations.offersConfigured).some(Boolean)} label="IDs reais das ofertas (CAKTO_OFFER_*)" missingNote="nenhum ID configurado — concessões por offer_id serão recusadas" />
          <IntegrationRow ok={data.integrations.federalFeedConfigured} label="Fonte de dados da Federal" missingNote="módulo permanece bloqueado sem fonte autorizada" />
        </ul>
        {data.integrations.demoMode ? (
          <p className="mt-3 rounded-xl bg-[#F8F0DC] px-4 py-2.5 text-[13px] text-[#6B5313]">
            Modo de demonstração ativo (DEMO_MODE). Em produção configure DEMO_MODE=false + variáveis acima.
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-linha bg-white p-5">
        <h3 className="font-display text-lg font-bold text-tinta">Últimos eventos de pagamento</h3>
        {data.recentPayments.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum evento processado ainda.</p>
        ) : (
          <ul className="nice-scroll mt-3 max-h-64 space-y-2 overflow-y-auto">
            {data.recentPayments.map((p) => (
              <li key={p.eventId} className="rounded-xl bg-[#FBF9F4] px-4 py-2.5 text-[13px]">
                <span className="font-semibold text-tinta">{p.eventType}</span>
                {p.simulated ? <span className="ml-2 rounded bg-lilas px-1.5 py-0.5 text-[10px] font-bold uppercase text-roxo-2">simulado</span> : null}
                <span className="mt-0.5 block text-muted-foreground">{p.result}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, hint, gold = false }: { label: string; value: number; hint?: string; gold?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${gold ? 'border-transparent bg-roxo text-white' : 'border-linha bg-white'}`}>
      <p className={`text-[11px] font-bold uppercase tracking-wide ${gold ? 'text-ouro' : 'text-muted-foreground'}`}>{label}</p>
      <p className={`font-display mt-1 text-3xl font-bold ${gold ? 'text-white' : 'text-roxo'}`}>{value}</p>
      {hint ? <p className={`mt-1 text-[11px] leading-snug ${gold ? 'text-[#D9C6EA]' : 'text-muted-foreground'}`}>{hint}</p> : null}
    </div>
  )
}

function IntegrationRow({ ok, label, missingNote }: { ok: boolean; label: string; missingNote: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={`mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${ok ? 'bg-verde' : 'bg-[#D9A13B]'}`} aria-hidden="true" />
      <span>
        <span className="font-semibold text-tinta">{label}:</span>{' '}
        <span className={ok ? 'text-verde' : 'text-muted-foreground'}>{ok ? 'configurado' : missingNote}</span>
      </span>
    </li>
  )
}

// ── Revisão de verbetes ─────────────────────────────────────────────────

function ReviewTab() {
  const [items, setItems] = useState<AdminEntry[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<'all' | 'draft' | 'published'>('draft')
  const [source, setSource] = useState<'all' | 'pdf_literal' | 'editorial'>('all')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<AdminEntry | null>(null)
  const [pageImages, setPageImages] = useState<Map<number, string>>(new Map())
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let alive = true
    api<{ items: AdminEntry[]; total: number }>(`/api/admin/entries?status=${status}&source=${source}&q=${encodeURIComponent(q)}&page=${page}`)
      .then((res) => {
        if (!alive) return
        setItems(res.items)
        setTotal(res.total)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [status, source, q, page, reloadKey])

  useEffect(() => {
    api<{ pages: { pdfPage: number; imagePath: string | null }[] }>('/api/book/pages')
      .then((res) => {
        const m = new Map<number, string>()
        for (const p of res.pages) if (p.imagePath) m.set(p.pdfPage, p.imagePath)
        setPageImages(m)
      })
      .catch(() => undefined)
  }, [])

  async function bulk(action: 'publish' | 'unpublish') {
    setBusy(true)
    try {
      const res = await api<{ published: number; failed: { id: string; reason: string }[] }>('/api/admin/entries/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids: [...selected], action }),
      })
      toast({ title: `${res.published} verbetes processados`, description: res.failed.length ? `${res.failed.length} falharam (ver regra de publicação).` : undefined })
      setSelected(new Set())
      reload()
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : 'Falha na operação' })
    } finally {
      setBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1) }} aria-label="Filtrar por status" className="focus-ring h-10 rounded-xl border border-linha bg-white px-3 text-sm">
          <option value="draft">Em curadoria</option>
          <option value="published">Publicados</option>
          <option value="all">Todos</option>
        </select>
        <select value={source} onChange={(e) => { setSource(e.target.value as typeof source); setPage(1) }} aria-label="Filtrar por origem" className="focus-ring h-10 rounded-xl border border-linha bg-white px-3 text-sm">
          <option value="all">PDF + editoriais</option>
          <option value="pdf_literal">Só do PDF</option>
          <option value="editorial">Só editoriais</option>
        </select>
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Buscar título…" aria-label="Buscar título" className="h-10 w-40 rounded-xl border-linha bg-white text-sm" />
        <span className="ml-auto text-xs text-muted-foreground">{total} verbetes</span>
      </div>

      {selected.size > 0 ? (
        <div className="sticky top-2 z-10 mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-roxo px-4 py-2.5 text-white">
          <span className="text-sm font-semibold">{selected.size} selecionados</span>
          <Button onClick={() => void bulk('publish')} disabled={busy} className="focus-ring h-9 rounded-lg bg-ouro px-3 text-xs font-bold text-roxo hover:bg-[#EBBB3E]">
            Publicar selecionados
          </Button>
          <Button onClick={() => void bulk('unpublish')} disabled={busy} variant="outline" className="focus-ring h-9 rounded-lg border-white/30 bg-transparent px-3 text-xs font-bold text-white hover:bg-white/10">
            Devolver para draft
          </Button>
          <button type="button" onClick={() => setSelected(new Set())} className="focus-ring ml-auto text-xs underline">
            limpar
          </button>
        </div>
      ) : null}

      <div className="mt-4 space-y-2.5">
        {!items ? (
          <Skeleton className="h-64 w-full rounded-2xl bg-lilas/50" />
        ) : items.length === 0 ? (
          <EmptyBox text="Nenhum verbete com esses filtros." />
        ) : (
          items.map((e) => <ReviewRow key={e.id} entry={e} pageImage={pageImages.get(e.pdfPage ?? -1) ?? null} selected={selected.has(e.id)} onToggle={() => {
            const next = new Set(selected)
            if (next.has(e.id)) next.delete(e.id)
            else next.add(e.id)
            setSelected(next)
          }} onEdit={() => setEditing(e)} onChanged={reload} />)
        )}
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="focus-ring h-10 rounded-xl border-linha bg-white px-4 text-sm text-roxo">
            ← Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="focus-ring h-10 rounded-xl border-linha bg-white px-4 text-sm text-roxo">
            Próxima →
          </Button>
        </div>
      ) : null}

      {editing ? <EditDialog entry={editing} pageImage={pageImages.get(editing.pdfPage ?? -1) ?? null} onClose={() => setEditing(null)} onChanged={reload} /> : null}
    </div>
  )
}

function ReviewRow({
  entry,
  pageImage,
  selected,
  onToggle,
  onEdit,
  onChanged,
}: {
  entry: AdminEntry
  pageImage: string | null
  selected: boolean
  onToggle: () => void
  onEdit: () => void
  onChanged: () => void
}) {
  async function quickPublish() {
    try {
      await api('/api/admin/entries/bulk', { method: 'POST', body: JSON.stringify({ ids: [entry.id], action: 'publish' }) })
      toast({ title: 'Verbete publicado' })
      onChanged()
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : 'Falha ao publicar' })
    }
  }

  return (
    <div className={`rounded-2xl border bg-white p-4 ${selected ? 'border-roxo-2/60 ring-1 ring-roxo-2/30' : 'border-linha'}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Selecionar ${entry.title}`} className="mt-1 h-4 w-4 accent-[#321053]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-base font-bold uppercase text-tinta">{entry.title}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${entry.reviewStatus === 'published' ? 'bg-verde-bg text-verde' : 'bg-[#F8F0DC] text-[#8A6A14]'}`}>
              {entry.reviewStatus === 'published' ? 'publicado' : 'draft'}
            </span>
            <span className="rounded-full bg-lilas px-2 py-0.5 text-[10px] font-bold uppercase text-roxo-2">
              {entry.sourceType === 'pdf_literal' ? `PDF pág. ${entry.pdfPage}` : 'editorial'}
            </span>
            {entry.kind === 'novo_simbolo_editorial' ? <span className="text-[10px] font-bold uppercase text-muted-foreground">novo símbolo</span> : null}
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{entry.meaning ?? '— sem interpretação —'}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {entry.association
              ? `${entry.association.animal} · grupo ${entry.association.group ?? '—'} · dz ${entry.association.dezena ?? '—'} · ct ${entry.association.centena ?? '—'} · mh ${entry.association.milhar ?? '—'}`
              : entry.relatedBase
                ? `→ base: ${entry.relatedBase.title} (${entry.relatedBase.reviewStatus})`
                : 'sem associação'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <Button variant="outline" onClick={onEdit} className="focus-ring h-9 rounded-lg border-linha px-3 text-xs font-bold text-roxo hover:bg-lilas">
            Revisar
          </Button>
          {entry.reviewStatus !== 'published' ? (
            <Button onClick={() => void quickPublish()} className="focus-ring h-9 rounded-lg bg-roxo px-3 text-xs font-bold text-white hover:bg-roxo-2">
              Publicar
            </Button>
          ) : null}
        </div>
      </div>
      {entry.sourceType === 'pdf_literal' && !pageImage ? (
        <p className="mt-2 rounded-lg bg-[#FBF9F4] px-3 py-2 text-[11px] text-muted-foreground">
          Imagem da página {entry.pdfPage} não anexada neste ambiente — conferir no PDF original antes de publicar.
        </p>
      ) : null}
    </div>
  )
}

function EditDialog({
  entry,
  pageImage,
  onClose,
  onChanged,
}: {
  entry: AdminEntry
  pageImage: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const [title, setTitle] = useState(entry.title)
  const [meaning, setMeaning] = useState(entry.meaning ?? '')
  const [animal, setAnimal] = useState(entry.association?.animal ?? '')
  const [group, setGroup] = useState(entry.association?.group?.toString() ?? '')
  const [dezena, setDezena] = useState(entry.association?.dezena ?? '')
  const [centena, setCentena] = useState(entry.association?.centena ?? '')
  const [milhar, setMilhar] = useState(entry.association?.milhar ?? '')
  const [busy, setBusy] = useState(false)

  async function save(publish: boolean) {
    setBusy(true)
    try {
      await api('/api/admin/entries', {
        method: 'PATCH',
        body: JSON.stringify({
          id: entry.id,
          title,
          meaning,
          reviewStatus: publish ? 'published' : entry.reviewStatus,
          association: entry.association ? { animal, group: group ? Number(group) : undefined, dezena, centena, milhar } : undefined,
        }),
      })
      toast({ title: publish ? 'Verbete publicado' : 'Alterações salvas' })
      onChanged()
      onClose()
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : 'Falha ao salvar' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-6" role="dialog" aria-modal="true" aria-label={`Revisar ${entry.title}`}>
      <div className="nice-scroll max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-papel p-5 md:rounded-3xl md:p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold text-tinta">Revisar: {entry.title}</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" className="focus-ring flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-lilas">
            ✕
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {entry.sourceType === 'pdf_literal' ? `Verbetes do PDF · página ${entry.pdfPage}${entry.printPage ? ` (impressa ${entry.printPage})` : ''}` : `Editorial · ${entry.kind ?? ''}`} · {entry.sourceNotes ?? ''}
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-roxo" htmlFor="ed-title">Título</label>
            <Input id="ed-title" value={title} onChange={(e) => setTitle(e.target.value)} className="focus-ring mt-1.5 h-11 rounded-xl border-linha bg-white" />
            <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-roxo" htmlFor="ed-meaning">Interpretação</label>
            <Textarea id="ed-meaning" value={meaning} onChange={(e) => setMeaning(e.target.value)} className="focus-ring mt-1.5 min-h-40 rounded-xl border-linha bg-white text-[15px]" />

            {entry.association ? (
              <fieldset className="mt-3 rounded-xl border border-linha bg-white p-3">
                <legend className="px-1 text-xs font-bold uppercase tracking-wide text-roxo">Números conferidos</legend>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Bicho" value={animal} onChange={setAnimal} id="ed-animal" />
                  <Field label="Grupo" value={group} onChange={setGroup} id="ed-group" />
                  <Field label="Dezena" value={dezena} onChange={setDezena} id="ed-dezena" />
                  <Field label="Centena" value={centena} onChange={setCentena} id="ed-centena" />
                  <Field label="Milhar" value={milhar} onChange={setMilhar} id="ed-milhar" />
                </div>
              </fieldset>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-roxo">Página original (conferência)</p>
            {pageImage ? (
              <img src={pageImage} alt={`Página ${entry.pdfPage} do PDF original`} className="mt-1.5 w-full rounded-xl border border-linha" />
            ) : (
              <div className="mt-1.5 rounded-xl border border-dashed border-linha bg-white px-4 py-8 text-center text-sm text-muted-foreground">
                Imagem da página {entry.pdfPage ?? '—'} não anexada neste ambiente.
                <br />
                Confira no PDF original antes de publicar.
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => void save(true)} disabled={busy} className="focus-ring h-12 rounded-xl bg-roxo px-5 font-bold text-white hover:bg-roxo-2">
            Salvar e publicar
          </Button>
          <Button variant="outline" onClick={() => void save(false)} disabled={busy} className="focus-ring h-12 rounded-xl border-linha bg-white px-5 font-bold text-roxo hover:bg-lilas">
            Salvar como draft
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, id }: { label: string; value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="focus-ring mt-1 h-9 rounded-lg border-linha bg-[#FCF8F1] text-sm" />
    </div>
  )
}

// ── Aliases ─────────────────────────────────────────────────────────────

type AliasRow = {
  id: number
  alias: string
  normalizedAlias: string
  status: string
  kind: string | null
  entry: { id: string; slug: string; title: string; reviewStatus: string; pdfPage: number | null; association: { animal: string; dezena: string; milhar: string } | null }
}

function AliasesTab() {
  const [items, setItems] = useState<AliasRow[] | null>(null)
  const [status, setStatus] = useState<'draft' | 'active'>('draft')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let alive = true
    api<{ items: AliasRow[]; total: number }>(`/api/admin/aliases?status=${status}&page=${page}`)
      .then((res) => {
        if (!alive) return
        setItems(res.items)
        setTotal(res.total)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [status, page, reloadKey])

  async function setActive(id: number, next: 'active' | 'draft') {
    try {
      await api('/api/admin/aliases', { method: 'PATCH', body: JSON.stringify({ id, status: next }) })
      reload()
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : 'Falha ao atualizar alias' })
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 30))

  return (
    <div>
      <p className="rounded-xl bg-[#F8F0DC] px-4 py-3 text-[13px] leading-relaxed text-[#6B5313]">
        Variações contextuais viram pontos de busca (aliases) — <strong>não herdam números como se estivessem impressas no PDF</strong>. O
        alias só participa da busca se o verbete-base estiver publicado.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <select value={status} onChange={(e) => { setStatus(e.target.value as 'draft' | 'active'); setPage(1) }} aria-label="Status do alias" className="focus-ring h-10 rounded-xl border border-linha bg-white px-3 text-sm">
          <option value="draft">Draft ({total > 0 && status === 'draft' ? total : ''})</option>
          <option value="active">Ativos</option>
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{total} aliases</span>
      </div>

      <div className="mt-4 space-y-2">
        {!items ? (
          <Skeleton className="h-56 w-full rounded-2xl bg-lilas/50" />
        ) : items.length === 0 ? (
          <EmptyBox text="Nenhum alias com esse filtro." />
        ) : (
          items.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-linha bg-white px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-tinta">“{a.alias}”</p>
                <p className="text-xs text-muted-foreground">
                  → {a.entry.title} (pág. {a.entry.pdfPage ?? '—'})
                  {a.entry.association ? ` · ${a.entry.association.animal} · dz ${a.entry.association.dezena}` : ''} · base{' '}
                  <span className={a.entry.reviewStatus === 'published' ? 'text-verde' : 'text-[#8A6A14]'}>{a.entry.reviewStatus}</span>
                </p>
              </div>
              {a.status === 'draft' ? (
                <Button onClick={() => void setActive(a.id, 'active')} className="focus-ring h-9 rounded-lg bg-roxo px-3 text-xs font-bold text-white hover:bg-roxo-2">
                  Ativar
                </Button>
              ) : (
                <Button variant="outline" onClick={() => void setActive(a.id, 'draft')} className="focus-ring h-9 rounded-lg border-linha px-3 text-xs font-bold text-roxo hover:bg-lilas">
                  Desativar
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="focus-ring h-10 rounded-xl border-linha bg-white px-4 text-sm text-roxo">←</Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="focus-ring h-10 rounded-xl border-linha bg-white px-4 text-sm text-roxo">→</Button>
        </div>
      ) : null}
    </div>
  )
}

// ── Pagamentos ──────────────────────────────────────────────────────────

function PaymentsTab() {
  const [eventType, setEventType] = useState('payment.approved')
  const [email, setEmail] = useState('comprador@exemplo.com')
  const [offerId, setOfferId] = useState('CAKTO-OFFER-ID-AQUI')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function simulate() {
    setBusy(true)
    setResult(null)
    try {
      const res = await api<{ action: string; message: string }>('/api/admin/payments/simulate', {
        method: 'POST',
        body: JSON.stringify({ eventType, email, offerId }),
      })
      setResult(res.message)
      toast({ title: 'Evento simulado', description: res.message })
    } catch (e) {
      setResult(e instanceof ApiError ? e.message : 'Falha na simulação.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-linha bg-white p-5">
        <h3 className="font-display text-lg font-bold text-tinta">Simular evento (teste local)</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Executa o mesmo pipeline do webhook real: idempotência, verificação de oferta e concessão/revogação. Configure os IDs reais
          (CAKTO_OFFER_*) para simular o mapeamento. Sem IDs reais, a concessão é recusada — comportamento esperado.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <label htmlFor="sim-type" className="text-xs font-bold uppercase text-muted-foreground">Evento</label>
            <select id="sim-type" value={eventType} onChange={(e) => setEventType(e.target.value)} className="focus-ring mt-1 h-11 w-full rounded-xl border border-linha bg-[#FCF8F1] px-3 text-sm">
              <option value="payment.approved">payment.approved (conceder)</option>
              <option value="payment.refunded">payment.refunded (revogar)</option>
              <option value="payment.canceled">payment.canceled (revogar)</option>
            </select>
          </div>
          <div>
            <label htmlFor="sim-email" className="text-xs font-bold uppercase text-muted-foreground">E-mail do comprador</label>
            <Input id="sim-email" value={email} onChange={(e) => setEmail(e.target.value)} className="focus-ring mt-1 h-11 rounded-xl border-linha bg-[#FCF8F1]" />
          </div>
          <div>
            <label htmlFor="sim-offer" className="text-xs font-bold uppercase text-muted-foreground">Offer_id</label>
            <Input id="sim-offer" value={offerId} onChange={(e) => setOfferId(e.target.value)} className="focus-ring mt-1 h-11 rounded-xl border-linha bg-[#FCF8F1]" />
          </div>
        </div>
        <Button onClick={() => void simulate()} disabled={busy} className="focus-ring mt-4 h-12 rounded-xl bg-roxo px-6 font-bold text-white hover:bg-roxo-2">
          {busy ? 'Processando…' : 'Executar evento simulado'}
        </Button>
        {result ? <p className="mt-3 rounded-xl bg-lilas/60 px-4 py-3 text-sm text-roxo-2">{result}</p> : null}
      </div>

      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Webhook real: <code className="rounded bg-lilas px-1.5 py-0.5 text-xs">POST /api/webhooks/cakto</code> — ver README para
        assinatura HMAC e campos confirmados.
      </p>
    </div>
  )
}

// ── Catálogo ────────────────────────────────────────────────────────────

function CatalogTab() {
  const [payload, setPayload] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function import_() {
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/catalog', { method: 'POST', body: payload, headers: { 'Content-Type': 'text/plain' } })
      const data = (await res.json()) as { imported?: number; rejected?: number; errors?: string[]; error?: { message: string } }
      if (!res.ok) {
        setResult(data.error?.message ?? 'Falha na importação.')
        return
      }
      setResult(`${data.imported ?? 0} itens importados como draft · ${data.rejected ?? 0} rejeitados${data.errors?.length ? ` — ex.: ${data.errors[0]}` : ''}`)
    } catch {
      setResult('Falha na importação.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-linha bg-white p-5">
        <h3 className="font-display text-lg font-bold text-tinta">Importar lista de centenas/milhares</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Aceita JSON (array com value, value_kind, source_name, methodology, reference_period) ou CSV com cabeçalho. Origem e critério
          são obrigatórios — sem eles a linha é rejeitada. Itens entram como <strong>draft</strong>; nada é exibido ao público até
          revisão e publicação.
        </p>
        <Textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder={'[{"value":"0534","value_kind":"centena","source_name":"lista X","methodology":"critério…","reference_period":"2024-01 a 2024-12"}]'}
          className="focus-ring mt-3 min-h-36 rounded-xl border-linha bg-[#FCF8F1] font-mono text-xs"
        />
        <Button onClick={() => void import_()} disabled={busy || !payload.trim()} className="focus-ring mt-3 h-11 rounded-xl bg-roxo px-5 font-bold text-white hover:bg-roxo-2">
          {busy ? 'Importando…' : 'Importar lista'}
        </Button>
        {result ? <p className="mt-3 rounded-xl bg-lilas/60 px-4 py-3 text-sm text-roxo-2">{result}</p> : null}
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Regra: enquanto não houver lista com origem verificada, o público vê apenas o aviso de indisponível — nunca valores nem
        alegações de “viciadas”.
      </p>
    </div>
  )
}

// ── OTP dev ─────────────────────────────────────────────────────────────

type MailRow = { id: string; toEmail: string; subject: string; body: string; code: string | null; transport: string; createdAt: string }

function OtpTab() {
  const [data, setData] = useState<{ available: boolean; notice?: string; items?: MailRow[]; message?: string } | null>(null)

  useEffect(() => {
    api<{ available: boolean; notice?: string; items?: MailRow[]; message?: string }>('/api/admin/otp-mailbox')
      .then(setData)
      .catch(() => setData({ available: false, message: 'Erro ao carregar caixa OTP.' }))
  }, [])

  if (!data) return <Skeleton className="h-56 w-full rounded-2xl bg-lilas/50" />
  if (!data.available) return <EmptyBox text={data.message ?? 'Indisponível neste modo.'} />

  return (
    <div>
      <p className="rounded-xl bg-[#F8F0DC] px-4 py-3 text-[13px] leading-relaxed text-[#6B5313]">{data.notice}</p>
      <div className="mt-4 space-y-2.5">
        {data.items?.length === 0 ? <EmptyBox text="Nenhum e-mail gerado ainda." /> : null}
        {data.items?.map((m) => (
          <div key={m.id} className="rounded-2xl border border-linha bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-tinta">{m.toEmail}</p>
              {m.code ? <span className="font-display rounded-lg bg-roxo px-3 py-1 text-lg font-bold tracking-[0.25em] text-ouro">{m.code}</span> : <span className="text-xs text-muted-foreground">{m.transport}</span>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{m.subject} · {new Date(m.createdAt).toLocaleString('pt-BR')}</p>
            {m.code ? <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-[#FBF9F4] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">{m.body}</pre> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyBox({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-linha bg-white/70 px-6 py-8 text-center text-sm text-muted-foreground">{text}</div>
}
