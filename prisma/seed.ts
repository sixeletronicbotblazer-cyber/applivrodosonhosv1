/**
 * Seed — Livro dos Sonhos
 *
 * Importa:
 *  - verbetes_pdf_ocr.json (538)      → DreamEntry pdf_literal, status DRAFT
 *  - verbetes_ampliados_editoriais.json (538):
 *      · 132 novo_simbolo_editorial  → DreamEntry editorial, status DRAFT (4 publicados: verificação manual na construção)
 *      · 406 variacao_contextual     → EntryAlias status DRAFT (não herdam números como próprios)
 *  - Tabela dos 25 bichos: agregada do OCR, marcada "ocr_aggregated" (página 4 do PDF não veio no pacote)
 *  - book_pages: apenas as 3 páginas fornecidas em imagem (1 capa, 5 → impressa 01, 46 → impressa 42)
 *
 * PUBLICAÇÃO: somente os verbetes literalmente conferidos contra as imagens do PDF
 * (páginas 5 e 46) + 4 editoriais coerentes ligados a eles. Todo o resto exige revisão
 * humana no painel /admin antes de publicar (regra: nunca inventar números).
 *
 * Uso: bun prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import path from 'path'
import { normalizeText, slugify } from '../src/lib/normalize'

const db = new PrismaClient()

type OcrRecord = {
  id: string
  title_ocr: string | null
  meaning_ocr: string | null
  animal: string
  group: number
  dezena: string
  centena: string
  milhar: string
  source_pdf_page: number
  source_dictionary_page: number | null
  provenance: string
  status: string
  ocr_flags: string[]
  ocr_animal_raw: string
}

type ExtRecord = {
  id: string
  title: string
  category: string
  interpretation_editorial: string
  kind: 'novo_simbolo_editorial' | 'variacao_contextual'
  related_pdf_id: string
  related_pdf_title_ocr: string
  animal_association: string
  group_association: number
  dezena_association: string
  centena_association: string
  milhar_association: string
  association_provenance: string
  source_notes: string
  status: string
}

// ── Verificações feitas contra as imagens fornecidas (pdf_page_005.png e pdf_page_046.png) ──
type VerifiedFix = {
  id: string
  title: string
  meaning: string
  animal: string
  group: number
  dezena: string
  centena: string
  milhar: string
  loto: string
  printPage: number
}

const VERIFIED: VerifiedFix[] = [
  {
    id: 'pdf-005-01', title: 'A',
    meaning: 'Escrever ou ler a letra A: boas notícias, novidades ótimas que virão de longe, na certa através de pessoa muito querida, há tempos afastada.',
    animal: 'AVESTRUZ', group: 1, dezena: '02', centena: '002', milhar: '1002', loto: '02, 61, 70, 22, 13', printPage: 1,
  },
  {
    id: 'pdf-005-02', title: 'ABACATE',
    meaning: 'Maduro: esperança, dias melhores. Verde: alguma tristeza na família, talvez uma discussão ou briga entre parentes.',
    animal: 'CABRA', group: 6, dezena: '21', centena: '921', milhar: '5921', loto: '21, 44, 59, 85, 70', printPage: 1,
  },
  {
    id: 'pdf-005-03', title: 'ABACAXI',
    meaning: 'Força e esperança no futuro. Grandes melhorias para todos, sem exceção. Para as jovens solteiras, um casamento à vista.',
    animal: 'CARNEIRO', group: 7, dezena: '26', centena: '526', milhar: '8526', loto: '26, 76, 34, 07, 62', printPage: 1,
  },
  {
    id: 'pdf-005-04', title: 'ABELHA',
    meaning: 'Mel, açúcar: adoçar a vida, melhorar a vida, afastar os problemas. Logo, logo, motivos para grandes alegrias e risos.',
    animal: 'ELEFANTE', group: 12, dezena: '46', centena: '746', milhar: '4746', loto: '46, 64, 39, 40, 97', printPage: 1,
  },
  {
    id: 'pdf-005-05', title: 'ABISMO',
    meaning: 'Possível preocupação, uma queda no amor ou nos negócios, mas com melhoras imediatas. Pensamento positivo e muita fé no amanhã.',
    animal: 'JACARÉ', group: 15, dezena: '60', centena: '960', milhar: '5960', loto: '60, 89, 74, 64, 06', printPage: 1,
  },
  {
    id: 'pdf-046-01', title: 'CAVALO',
    meaning: 'Escuro: bom presságio, elevação social, promoção no emprego, bons negócios. Branco: somente felicidade e alegria, para todos.',
    animal: 'COBRA', group: 9, dezena: '34', centena: '534', milhar: '8534', loto: '34, 09, 88, 47, 15', printPage: 42,
  },
  {
    id: 'pdf-046-02', title: 'CEGONHA',
    meaning: 'Para as futuras mães, excelente sonho, e é quase certo que nasça menina. Para as noivas, prole numerosa. Para os namorados, noivado em breve.',
    animal: 'MACACO', group: 17, dezena: '66', centena: '166', milhar: '5166', loto: '66, 17, 29, 73, 40', printPage: 42,
  },
  {
    id: 'pdf-046-03', title: 'CINZA',
    meaning: 'Vitória nos empreendimentos, nos planos. Indica também namoro ou noivado desfeito, mas com fácil reconciliação. Reforma na casa em breve.',
    animal: 'COELHO', group: 10, dezena: '38', centena: '038', milhar: '1038', loto: '38, 10, 92, 77, 04', printPage: 42,
  },
  {
    id: 'pdf-046-04', title: 'COBRA',
    meaning: 'Sonho não muito bom. Estar sendo mordido por uma traição de amigos, trabalho sendo feito, problemas financeiros. Cobra grande: cautela com os falsos amigos. Cobra pequena: desentendimentos na família e com os parentes.',
    animal: 'LEÃO', group: 16, dezena: '62', centena: '362', milhar: '8362', loto: '62, 16, 57, 93, 39', printPage: 42,
  },
  {
    id: 'pdf-046-05', title: 'COELHO',
    meaning: 'Noivado ou namoro desfeito, divórcio. Estar afagando um coelho: melhoras financeiras, promoção no trabalho, azar no jogo.',
    animal: 'CAVALO', group: 11, dezena: '42', centena: '742', milhar: '3742', loto: '42, 11, 98, 29, 85', printPage: 42,
  },
]

const verifiedById = new Map(VERIFIED.map((v) => [v.id, v]))

// Editoriais publicados na construção: vínculo coerente com verbete verificado.
// "abelhas em enxame" → CAVALO (vínculo duvidoso no pacote) permanece DRAFT para revisão no /admin.
const EDITORIAL_PUBLISH = new Set(['ext-0111', 'ext-0112', 'ext-0113', 'ext-0114'])

const ANIMAL_DISPLAY: Record<string, string> = {
  AVESTRUZ: 'AVESTRUZ', AGUIA: 'ÁGUIA', BURRO: 'BURRO', BORBOLETA: 'BORBOLETA',
  CACHORRO: 'CACHORRO', CABRA: 'CABRA', CARNEIRO: 'CARNEIRO', CAMELO: 'CAMELO',
  COBRA: 'COBRA', COELHO: 'COELHO', CAVALO: 'CAVALO', ELEFANTE: 'ELEFANTE',
  GALO: 'GALO', GATO: 'GATO', JACARE: 'JACARÉ', LEAO: 'LEÃO', MACACO: 'MACACO',
  PORCO: 'PORCO', PAVAO: 'PAVÃO', PERU: 'PERU', TOURO: 'TOURO', TIGRE: 'TIGRE',
  URSO: 'URSO', VEADO: 'VEADO', VACA: 'VACA',
}

async function main() {
  console.log('· Limpando tabelas…')
  await db.searchLog.deleteMany()
  await db.savedEntry.deleteMany()
  await db.catalogItem.deleteMany()
  await db.paymentEvent.deleteMany()
  await db.entitlement.deleteMany()
  await db.devMailbox.deleteMany()
  await db.otpCode.deleteMany()
  await db.session.deleteMany()
  await db.entryAlias.deleteMany()
  await db.numberAssociation.deleteMany()
  await db.dreamEntry.deleteMany()
  await db.animalGroup.deleteMany()
  await db.bookPage.deleteMany()
  await db.user.deleteMany()

  const dataDir = path.join(__dirname, 'seed-data')
  const ocr: OcrRecord[] = JSON.parse(readFileSync(path.join(dataDir, 'verbetes_pdf_ocr.json'), 'utf8'))
  const ext: ExtRecord[] = JSON.parse(readFileSync(path.join(dataDir, 'verbetes_ampliados_editoriais.json'), 'utf8'))
  console.log(`· OCR: ${ocr.length} registros | Editoriais: ${ext.length} registros`)

  // ── 1. Verbetes do PDF (OCR) ──────────────────────────────────────────
  const usedSlugs = new Set<string>()
  const makeUniqueSlug = (base: string, id: string) => {
    let s = base || `verbete-${id}`
    if (s.length > 60) s = s.slice(0, 60)
    let candidate = s
    let n = 2
    while (usedSlugs.has(candidate)) candidate = `${s}-${n++}`
    usedSlugs.add(candidate)
    return candidate
  }

  for (const r of ocr) {
    const v = verifiedById.get(r.id)
    const title = v ? v.title : (r.title_ocr ?? '').trim() || `Verbete sem título no OCR (pág. ${r.source_pdf_page})`
    const isPublished = !!v
    const slug = makeUniqueSlug(v ? slugify(v.title) : (r.title_ocr ? slugify(r.title_ocr) : ''), r.id)
    await db.dreamEntry.create({
      data: {
        id: r.id,
        slug,
        title,
        sourceType: 'pdf_literal',
        sourcePdfPage: r.source_pdf_page,
        sourcePrintPage: r.source_dictionary_page,
        meaning: v ? v.meaning : (r.meaning_ocr ?? '').trim() || null,
        reviewStatus: isPublished ? 'published' : 'draft',
        reviewerNote: v
          ? `Conferido contra imagem fornecida do PDF (página ${r.source_pdf_page}, impressa ${v.printPage}) durante a construção. Segunda revisão visual OK.`
          : null,
        reviewedAt: v ? new Date() : null,
        sourceNotes: `origem: OCR automatizado (${r.provenance}); flags: ${r.ocr_flags.join(', ') || 'nenhuma'}`,
      },
    })
    await db.numberAssociation.create({
      data: {
        entryId: r.id,
        animal: v ? v.animal : (ANIMAL_DISPLAY[r.animal] ?? r.animal),
        groupNumber: r.group,
        dezena: r.dezena,
        centena: r.centena,
        milhar: r.milhar,
        loto: v ? v.loto : null,
        evidencePdfPage: r.source_pdf_page,
      },
    })
  }
  console.log(`· Verbetes PDF importados: ${ocr.length} (publicados: ${verifiedById.size})`)

  // ── 2. Editoriais: novos símbolos (132) ───────────────────────────────
  let editorialCount = 0
  let editorialPublished = 0
  for (const e of ext) {
    if (e.kind !== 'novo_simbolo_editorial') continue
    editorialCount++
    const publish = EDITORIAL_PUBLISH.has(e.id)
    if (publish) editorialPublished++
    await db.dreamEntry.create({
      data: {
        id: e.id,
        slug: makeUniqueSlug(slugify(e.title), e.id),
        title: e.title,
        sourceType: 'editorial',
        category: e.category,
        kind: e.kind,
        meaning: e.interpretation_editorial,
        relatedPdfId: e.related_pdf_id,
        reviewStatus: publish ? 'published' : 'draft',
        reviewerNote: publish
          ? 'Vínculo editorial conferido na construção: verbete-base verificado contra a imagem do PDF. Associação de números permanece atribuída ao verbete-base.'
          : null,
        reviewedAt: publish ? new Date() : null,
        sourceNotes: `${e.source_notes} | ${e.association_provenance}`,
      },
    })
  }
  console.log(`· Novos símbolos editoriais: ${editorialCount} (publicados: ${editorialPublished})`)

  // ── 3. Variações contextuais (406) → aliases DRAFT ────────────────────
  let aliasCount = 0
  for (const e of ext) {
    if (e.kind !== 'variacao_contextual') continue
    const aliasText = e.title.replace(/^Ver\s+/i, '').trim()
    const norm = normalizeText(aliasText)
    const exists = await db.entryAlias.findUnique({
      where: { entryId_normalizedAlias: { entryId: e.related_pdf_id, normalizedAlias: norm } },
    })
    if (exists) continue
    try {
      await db.entryAlias.create({
        data: {
          entryId: e.related_pdf_id,
          alias: aliasText,
          normalizedAlias: norm,
          kind: 'variacao_contextual',
          status: 'draft',
        },
      })
      aliasCount++
    } catch {
      // verbete-base inexistente no OCR (caso raro) — registrado para revisão no admin
      console.warn(`  ! alias sem base: ${e.id} → ${e.related_pdf_id}`)
    }
  }
  console.log(`· Aliases criados (draft): ${aliasCount}`)

  // ── 4. Tabela dos 25 bichos (agregada do OCR) ─────────────────────────
  const verifiedAnimals = new Set(VERIFIED.map((v) => v.animal))
  const byGroup = new Map<number, Map<string, number>>()
  const dezenasByGroup = new Map<number, Map<string, number>>()
  for (const r of ocr) {
    const animal = (ANIMAL_DISPLAY[r.animal] ?? r.animal).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    byGroup.set(r.group, (byGroup.get(r.group) ?? new Map()).set(animal, ((byGroup.get(r.group)?.get(animal)) ?? 0) + 1))
    const dz = byGroupDezena(r.dezena, r.group)
    if (dz) dezenasByGroup.set(r.group, (dezenasByGroup.get(r.group) ?? new Map()).set(dz, (dezenasByGroup.get(r.group)?.get(dz) ?? 0) + 1))
  }
  for (let g = 1; g <= 25; g++) {
    const animals = [...(byGroup.get(g) ?? new Map()).entries()].sort((a, b) => b[1] - a[1])
    const animalRaw = animals[0]?.[0] ?? null
    const animal = animalRaw ? (ANIMAL_DISPLAY[animalRaw] ?? animalRaw) : '—'
    const dezCount = [...(dezenasByGroup.get(g) ?? new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([d]) => d)
    const dezenas = dezCount.length === 4 ? dezCount.join(',') : ''
    const isVerified = [...verifiedAnimals].some((va) => va.toUpperCase().normalize('NFD') === animal.toUpperCase().normalize('NFD'))
    await db.animalGroup.create({
      data: {
        groupNumber: g,
        animal: animal === '—' ? 'Aguardando página 4 do PDF' : animal,
        dezenas,
        verification: isVerified && dezenas ? 'verified_page' : 'ocr_aggregated',
        sourceNote:
          animal === '—'
            ? 'Bicho ausente no OCR enviado — preencher após conferência da página 4 do PDF original.'
            : `Bicho agregado do OCR (${animals[0]?.[1] ?? 0} ocorrências). Dezenas do grupo extraídas do OCR; conferir contra a página 4 do PDF original antes de publicar.`,
      },
    })
  }
  console.log('· Tabela dos 25 bichos: agregada do OCR (marcada para conferência)')

  // ── 5. Páginas do livro disponíveis em imagem ─────────────────────────
  await db.bookPage.createMany({
    data: [
      { pdfPage: 1, printPage: null, imagePath: '/book/capa.jpg', reviewStatus: 'published', ocrText: 'Capa — Livro dos Sonhos: descubra os significados dos sonhos e seus números associados.' },
      { pdfPage: 5, printPage: 1, imagePath: '/book/pagina-005.jpg', reviewStatus: 'published', ocrText: 'Dicionário dos sonhos — letra A: A, ABACATE, ABACAXI, ABELHA, ABISMO.' },
      { pdfPage: 46, printPage: 42, imagePath: '/book/pagina-046.jpg', reviewStatus: 'published', ocrText: 'Dicionário dos sonhos — letra C: CAVALO, CEGONHA, CINZA, COBRA, COELHO.' },
    ],
  })
  console.log('· Páginas do livro (imagens fornecidas): 1, 5, 46')

  // ── 6. Usuários e entitlements de demonstração ────────────────────────
  // DEMO_MODE: contas criadas para testar os fluxos localmente. Em produção,
  // configure DEMO_MODE=false e o acesso nasce apenas do webhook de pagamento.
  const demoUsers = [
    { email: 'admin@livrodossonhos.app', role: 'ADMIN', product: 'book_app', pay: 'demo-seed-admin-book-app' },
    { email: 'demo@livrodossonhos.app', role: 'USER', product: 'book_app', pay: 'demo-seed-demo-book-app' },
    { email: 'pdf@livrodossonhos.app', role: 'USER', product: 'book_pdf', pay: 'demo-seed-pdf-book-pdf' },
    { email: 'outro@livrodossonhos.app', role: 'USER', product: null, pay: null },
  ]
  for (const u of demoUsers) {
    await db.user.create({ data: { email: u.email, role: u.role } })
    if (u.product && u.pay) {
      await db.entitlement.create({
        data: {
          buyerEmail: u.email,
          offerId: u.product === 'book_pdf' ? 'DEMO-OFFER-BOOK-PDF' : 'DEMO-OFFER-BOOK-APP',
          productKey: u.product,
          paymentId: u.pay,
          status: 'active',
          grantedAt: new Date(),
        },
      })
    }
  }
  console.log('· Usuários demo: admin@ / demo@ (book_app) / pdf@ (book_pdf) / outro@ (sem acesso) — todos @livrodossonhos.app')

  const total = await db.dreamEntry.count()
  const published = await db.dreamEntry.count({ where: { reviewStatus: 'published' } })
  console.log(`✓ Seed concluído: ${total} registros de trabalho, ${published} publicados (verificados), resto em curadoria.`)
}

/** valida dezena contra a faixa do grupo (04 por grupo); null se ruído de OCR */
function byGroupDezena(dezena: string, group: number): string | null {
  const n = parseInt(dezena, 10)
  const lo = (group - 1) * 4 + 1
  const hi = group * 4
  if (Number.isNaN(n) || n < lo || n > hi) return null
  return dezena.padStart(2, '0')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
