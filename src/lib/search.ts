// Busca determinística (sem IA remota) — Livro dos Sonhos.
// Ranqueamento reproduzível, em camadas:
//   título exato (100) > alias revisado exato (90) > contexto/contém (80…55) > aproximação ortográfica (45…40)
// Apenas verbetes review_status = 'published' e aliases status = 'active' participam.

import { db } from '@/lib/db'
import { normalizeText, tokenKey, tokenizeContentWords, levenshteinWithin } from '@/lib/normalize'

export type SearchCandidate = {
  id: string
  slug: string
  title: string
  sourceType: 'pdf_literal' | 'editorial'
  snippet: string
  printPage: number | null
  pdfPage: number | null
  animal: string | null
  group: number | null
  dezena: string | null
  centena: string | null
  milhar: string | null
  score: number
  matchedTokens: string[]
  editorialBase: { slug: string; title: string; printPage: number | null; pdfPage: number | null } | null
}

export type SearchResponse = {
  mode: 'termo' | 'relato'
  query: string
  elements: string[]
  candidates: SearchCandidate[]
  ambiguous: boolean
  suggestion: string | null
}

type IndexedAlias = { normalizedAlias: string; entryId: string }

type IndexedEntry = {
  id: string
  slug: string
  title: string
  normTitle: string
  titleKeys: Set<string>
  sourceType: 'pdf_literal' | 'editorial'
  meaning: string
  printPage: number | null
  pdfPage: number | null
  animal: string | null
  group: number | null
  dezena: string | null
  centena: string | null
  milhar: string | null
  relatedPdfId: string | null
}

type Index = {
  entries: Map<string, IndexedEntry>
  aliases: IndexedAlias[]
  aliasByKey: Map<string, string[]> // tokenKey(alias) → entryIds
  builtAt: number
}

let indexCache: Index | null = null
const INDEX_TTL_MS = 15_000

async function buildIndex(): Promise<Index> {
  const rows = await db.dreamEntry.findMany({
    where: { reviewStatus: 'published' },
    include: {
      association: true,
      aliases: { where: { status: 'active' } },
      relatedPdf: { include: { association: true } },
    },
  })
  const entryMap = new Map<string, IndexedEntry>()
  const aliases: IndexedAlias[] = []
  const aliasByKey = new Map<string, string[]>()

  for (const e of rows) {
    const normTitle = normalizeText(e.title)
    const titleKeys = new Set(normTitle.split(' ').map(tokenKey).filter(Boolean))
    titleKeys.add(tokenKey(normTitle))
    entryMap.set(e.id, {
      id: e.id,
      slug: e.slug,
      title: e.title,
      normTitle,
      titleKeys,
      sourceType: e.sourceType as 'pdf_literal' | 'editorial',
      meaning: e.meaning ?? '',
      printPage: e.sourcePrintPage,
      pdfPage: e.sourcePdfPage,
      animal: e.association?.animal ?? null,
      group: e.association?.groupNumber ?? null,
      dezena: e.association?.dezena ?? null,
      centena: e.association?.centena ?? null,
      milhar: e.association?.milhar ?? null,
      relatedPdfId: e.relatedPdfId,
    })
    for (const a of e.aliases) {
      const norm = normalizeText(a.alias)
      aliases.push({ normalizedAlias: norm, entryId: e.id })
      const keys = new Set(norm.split(' ').map(tokenKey).filter(Boolean))
      keys.add(tokenKey(norm))
      for (const k of keys) {
        const list = aliasByKey.get(k) ?? []
        list.push(e.id)
        aliasByKey.set(k, list)
      }
    }
  }
  return { entries: entryMap, aliases, aliasByKey, builtAt: Date.now() }
}

async function getIndex(): Promise<Index> {
  if (!indexCache || Date.now() - indexCache.builtAt > INDEX_TTL_MS) indexCache = await buildIndex()
  return indexCache
}

/** invalida após publicação/edição no admin */
export function invalidateSearchIndex() {
  indexCache = null
}

function snippetOf(text: string, tokens: string[]): string {
  if (!text) return ''
  const t = text.length > 200 ? text.slice(0, 200) + '…' : text
  void tokens
  return t
}

export async function searchEntries(rawQuery: string): Promise<SearchResponse> {
  const query = rawQuery.trim().slice(0, 500)
  const idx = await getIndex()
  const q = normalizeText(query)
  const qTokensRaw = tokenizeContentWords(query)
  const qTokens = qTokensRaw.length > 0 ? qTokensRaw : (q ? q.split(' ') : [])
  const mode: 'termo' | 'relato' = qTokensRaw.length > 2 || q.length > 40 ? 'relato' : 'termo'

  type Agg = { score: number; matched: Set<string> }
  const candidates = new Map<string, Agg>()

  const add = (entryId: string, score: number, token: string | null) => {
    const cur = candidates.get(entryId) ?? { score: 0, matched: new Set<string>() }
    cur.score = Math.max(cur.score, score)
    if (token) cur.matched.add(token)
    candidates.set(entryId, cur)
  }

  // 1) frase completa
  for (const e of idx.entries.values()) {
    if (!q) continue
    if (e.normTitle === q) add(e.id, e.sourceType === 'pdf_literal' ? 100 : 80, q)
    else if (e.normTitle.startsWith(q + ' ') || e.normTitle.startsWith(q)) add(e.id, e.sourceType === 'pdf_literal' ? 72 : 62, q)
    else if (e.normTitle.includes(q)) add(e.id, 65, q)
  }
  for (const a of idx.aliases) {
    if (!q) continue
    if (a.normalizedAlias === q) add(a.entryId, 90, q)
    else if (a.normalizedAlias.includes(q)) add(a.entryId, 55, q)
  }

  // 2) token a token (palavra ou alias)
  const matchedElements: string[] = []
  for (const token of qTokens) {
    const key = tokenKey(token)
    if (!key) continue
    let tokenMatched = false

    for (const e of idx.entries.values()) {
      if (e.titleKeys.has(key)) {
        add(e.id, e.sourceType === 'pdf_literal' ? 62 : 52, token)
        tokenMatched = true
        continue
      }
      // palavra dentro de título composto
      if ([...e.normTitle.split(' ')].some((w) => tokenKey(w) === key)) {
        add(e.id, e.sourceType === 'pdf_literal' ? 55 : 48, token)
        tokenMatched = true
        continue
      }
      // aproximação ortográfica leve (erros de digitação), palavra >= 5
      if (key.length >= 5) {
        for (const tk of e.titleKeys) {
          if (Math.abs(tk.length - key.length) <= 2 && levenshteinWithin(key, tk, 2) !== null) {
            add(e.id, 40, token)
            tokenMatched = true
            break
          }
        }
      }
    }
    const aliasHit = idx.aliasByKey.get(key)
    if (aliasHit) {
      tokenMatched = true
      for (const entryId of aliasHit) add(entryId, 52, token)
    }
    if (tokenMatched) matchedElements.push(token)
  }

  // 3) bônus por múltiplos elementos distintos (relato com vários elementos)
  const ranked: SearchCandidate[] = []
  for (const [entryId, agg] of candidates) {
    const e = idx.entries.get(entryId)
    if (!e) continue
    let score = agg.score
    if (agg.matched.size > 1) score += Math.min(16, (agg.matched.size - 1) * 8)
    let editorialBase: SearchCandidate['editorialBase'] = null
    if (e.sourceType === 'editorial' && e.relatedPdfId) {
      const base = idx.entries.get(e.relatedPdfId)
      if (base && base.sourceType === 'pdf_literal') {
        editorialBase = { slug: base.slug, title: base.title, printPage: base.printPage, pdfPage: base.pdfPage }
      }
    }
    ranked.push({
      id: e.id,
      slug: e.slug,
      title: e.title,
      sourceType: e.sourceType,
      snippet: snippetOf(e.meaning, [...agg.matched]),
      printPage: e.printPage,
      pdfPage: e.pdfPage,
      animal: e.animal,
      group: e.group,
      dezena: e.dezena,
      centena: e.centena,
      milhar: e.milhar,
      score,
      matchedTokens: [...agg.matched],
      editorialBase,
    })
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    // especificidade: título mais curto e literal primeiro
    const lenDelta = a.title.length - b.title.length
    if (lenDelta !== 0) return lenDelta
    return a.title.localeCompare(b.title, 'pt-BR')
  })

  // termo exato de verbete literal domina: mostra apenas ele (resposta única e clara)
  const top = ranked[0]
  let finalList: SearchCandidate[]
  if (top && top.score >= 100 && mode === 'termo') finalList = [top]
  else finalList = ranked.slice(0, 3)

  const ambiguous = finalList.length > 1 && mode === 'relato'

  let suggestion: string | null = null
  if (finalList.length === 0) {
    suggestion =
      'Tente uma palavra principal do sonho (ex.: "cavalo", "água") ou consulte o índice A–Z do livro. Sem correspondência confiável, não inventamos verbete.'
  } else if (ambiguous) {
    suggestion = 'Mais de um verbete combina com o relato. Escolha o mais próximo da sua lembrança.'
  }

  return {
    mode,
    query,
    elements: [...new Set(matchedElements)].slice(0, 8),
    candidates: finalList,
    ambiguous,
    suggestion,
  }
}
