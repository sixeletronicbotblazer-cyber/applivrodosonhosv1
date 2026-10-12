# Worklog — Livro dos Sonhos

Projeto: app web responsivo/PWA "Livro dos Sonhos" (consulta editorial de sonhos, números do jogo do bicho, OTP por e-mail, entitlements Cakto, painel de curadoria).

Fonte da especificação: pacote do usuário (Google Drive) — DESIGN.md, BANCO_DE_DADOS.md, schema.sql, COMANDO_MASTER_ZAI.md, 5 telas PNG, 2 JSON de verbetes (538 OCR + 538 editoriais), 3 páginas do PDF (capa, pág. 5, pág. 46).

---
Task ID: 0
Agent: Z.ai Code (orquestrador)
Task: Análise do pacote e verificação de dados

Work Log:
- Extraído ZIP do Google Drive em /tmp/drive_extract/app_livro_sonhos
- Lidos DESIGN.md, BANCO_DE_DADOS.md, schema.sql, COMANDO_MASTER_ZAI.md, banco_manifesto.json
- Inspecionados verbetes_pdf_ocr.json (538) e verbetes_ampliados_editoriais.json (538 = 132 novos símbolos + 406 variações contextuais)
- Verificadas visualmente 3 páginas do PDF fornecidas:
  - Página 1 = capa ("Livro dos Sonhos", tigre/armação amarela)
  - Página 5 = página impressa 01: A→AVESTRUZ 1/02/002/1002; ABACATE→CABRA 6/21/921/5921; ABACAXI→CARNEIRO 7/26/526/8526; ABELHA→ELEFANTE 12/46/746/4746; ABISMO→JACARÉ 15/60/960/5960
  - Página 46 = página impressa 42: CAVALO→COBRA 9/34/534/8534; CEGONHA→MACACO 17/66/166/5166; CINZA→COELHO 10/38/038/1038; COBRA→LEÃO 16/62/362/8362; COELHO→CAVALO 11/42/742/3742
- OCR consistente 100% nesses pontos; erros de OCR conhecidos: título ausente (A, ABACAXI, CINZA), "BELHA"→ABELHA, animais sem acento (LEAO/JACARE/PAVAO)
- Tabela dos 25 bichos: agregada do OCR (grupos 1–25, 4 dezenas por grupo), consistente com padrão do jogo; marcada como "reconstruída do OCR — conferir página 4 do PDF original" (página 4 não veio no pacote)

Stage Summary:
- Decisão: adaptar schema.sql PostgreSQL → Prisma/SQLite (limitação do ambiente)
- Somente publico no ambiente: os 10 verbetes literalmente verificados contra as imagens + 4 editoriais coerentes ligados a eles (ext-0111, 0112, 0113, 0114). Todo o restante (1.062 registros) fica draft para curadoria em /admin
- 406 variações contextuais entram como aliases draft (não herdam números como se fossem do livro)
- PWA + hash-routing SPA (restrição: apenas a rota / é visível ao usuário neste ambiente)
- Próximos passos: schema, seed, APIs, frontend, admin, verificação no browser

---
Task ID: 1
Agent: Z.ai Code (orquestrador)
Task: Construção completa do aplicativo (schema, seed, APIs, frontend, admin, PWA)

Work Log:
- prisma/schema.prisma: 12 modelos (User, Session, OtpCode, DevMailbox, DreamEntry, NumberAssociation, EntryAlias, AnimalGroup, BookPage, Entitlement, PaymentEvent, CatalogItem, SavedEntry, SearchLog) — adaptado do schema.sql para SQLite; db push OK
- prisma/seed.ts: importados 538 OCR (draft) + 132 editoriais (draft, 4 publicados) + 406 variações como aliases draft; tabela dos 25 bichos agregada do OCR com status de verificação; 3 páginas do livro em imagem; 4 usuários demo
- Backend libs: config (envs seguras), normalize (acentos/plural/levenshtein), auth (OTP hash+pepper, sessões httpOnly, rate limit), mailer (SMTP nodemailer + transporte dev), entitlements, search (ranqueamento determinístico em camadas), webhook-cakto (HMAC, idempotente, parser flexível)
- APIs: /api/config, auth/request-otp, auth/verify-otp, auth/logout, me, search, entries, index, saved, animals, tools/generate, book/pages, webhooks/cakto, account/delete, admin/{overview,entries,entries/bulk,aliases,otp-mailbox,payments/simulate,catalog}
- Frontend: tema fiel ao DESIGN.md (roxo #321053, papel #FCF8F1, ouro #F7C94D, lilás, verde procedência), AppShell (sidebar desktop + bottom nav mobile + footer com safe-area), 9 views por hash-routing
- Correções durante dev: bug no parser do webhook (função pick), Skeleton imports, regras react-hooks/set-state-in-effect, footer coberto pela bottom nav
- PWA: manifest.webmanifest, ícones (roxo/ouro), sw.js network-first registrado só em produção
- README.md (instalação, integrações pendentes, contas demo) + .env.example (SMTP, Cakto, DEMO_MODE, FEDERAL_FEED_URL)

Stage Summary:
- Verificado por API (curl): OTP completo, sessões, gating (401/403 upgrade_required por plano), busca "cavalo" (score 100 literal), "cavalo branco" (editorial creditado ao verbete CAVALO), relato ambíguo com 3 candidatos, salvos, animais, gerador (combos terminam nas dezenas do grupo), índice, páginas, webhook idempotente (2ª chamada = duplicate), estorno revoga acesso, admin protegido por papel
- Verificado no browser (Agent Browser): telas 01–05 reproduzidas (entrar, início, busca, verbete Cavalo com COBRA·09·34·534·8534, ferramentas), fluxo OTP com banner dev rotulado, salvar verbete, livro com página 46 original + zoom, índice A–Z com letras, tabela dos bichos com badges conferido/em revisão, gerador com semente do dia, admin (visão geral 1076/14/656/406, revisão lado a lado, caixa OTP dev, simulação de pagamento com recusa de offer não mapeada e concessão com DEMO-OFFER), responsividade 320/390/1440, footer fixo sem sobreposição
- Dados resetados ao estado de seed limpo ao final
- Pendências documentadas no README: SMTP real, IDs Cakto reais + doc oficial do payload, fonte da Federal, lista do catálogo, PDF completo do livro
