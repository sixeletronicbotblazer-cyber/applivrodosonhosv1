// Normalização de texto compartilhada (busca determinística, seed, aliases).
// Regras do projeto: normalizar acentos/caixa, plural simples, sem alterar o texto exibido.

const PT_STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'sem', 'ao', 'aos', 'à', 'às',
  'e', 'ou', 'que', 'se', 'eu', 'meu', 'minha', 'meus', 'minhas', 'voce', 'você',
  'sua', 'seu', 'suas', 'seus', 'ele', 'ela', 'eles', 'elas', 'muito', 'muita',
  'ficou', 'fui', 'foi', 'era', 'estava', 'tinha', 'havia', 'quando', 'como',
  'sonhei', 'sonho', 'com', 'depois', 'antes', 'onde', 'entao', 'então',
])

/** minúsculas + remove acentos + colapsa espaços */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** plural simples PT → singular (para tolerar plurais na busca) */
export function singularizePt(word: string): string {
  let w = word
  if (w.length > 4 && w.endsWith('oes')) w = w.slice(0, -3) + 'ao'
  else if (w.length > 4 && w.endsWith('aes')) w = w.slice(0, -3) + 'ao'
  else if (w.length > 4 && w.endsWith('ais')) w = w.slice(0, -2) + 'l'
  else if (w.length > 4 && w.endsWith('eis')) w = w.slice(0, -2) + 'l'
  else if (w.length > 4 && w.endsWith('ns')) w = w.slice(0, -2) + 'm'
  else if (w.length > 3 && w.endsWith('es') && !w.endsWith('ades') && !w.endsWith('edes') && !w.endsWith('ides') && !w.endsWith('odes') && !w.endsWith('udes')) w = w.slice(0, -2)
  else if (w.length > 3 && w.endsWith('s')) w = w.slice(0, -1)
  return w
}

/** token base: normalizado + singularizado */
export function tokenKey(word: string): string {
  return singularizePt(normalizeText(word))
}

/** slug de URL a partir de um título */
export function slugify(title: string): string {
  return normalizeText(title)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function tokenizeContentWords(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9à-ú]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !PT_STOPWORDS.has(t) && !PT_STOPWORDS.has(t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))
}

export { PT_STOPWORDS }

/** distância de Levenshtein com limite (para tolerar erros leves de digitação) */
export function levenshteinWithin(a: string, b: string, max: number): number | null {
  if (Math.abs(a.length - b.length) > max) return null
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i)
  const cur = new Array(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    let rowMin = cur[0]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (cur[j] < rowMin) rowMin = cur[j]
    }
    if (rowMin > max) return null
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]
  }
  return prev[b.length] <= max ? prev[b.length] : null
}
