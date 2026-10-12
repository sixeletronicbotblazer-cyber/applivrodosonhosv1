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

---
Task ID: 2
Agent: Z.ai Code (orquestrador)
Task: Ajuste do app existente — nova tela de entrada, fluxo de acesso sem código, revisão geral, responsividade

Work Log:
- Inspeção: mapeadas 9 views (entrar/inicio/buscar/verbete/livro/ferramentas/salvos/conta/admin), 15 rotas de API, store zustand com hash-routing, gating por entitlements no servidor
- Novo endpoint POST /api/auth/access: valida e-mail, rate limit 20/h por IP; produção só cria sessão com Entitlement ativo (resposta neutra purchase_not_found); prévia (DEMO_MODE) cria sessão de demonstração com pacote completo para qualquer e-mail (idempotente via paymentId determinístico), preservando pdf@ (só PDF) e outro@ (sem compra)
- auth.ts: extraído createSession(user, ip) reutilizável (cookie httpOnly, 30 dias)
- EntrarView reescrita: marca pequena no topo, carta central max-w-[440px] (desktop) / largura cheia (mobile), capa do livro como detalhe visual (next/image), título "Seu Livro dos Sonhos está pronto para consultar.", campo único "Seu e-mail", botão "Acessar aplicativo" com estado Entrando… (spinner, imune a cliques repetidos), link discreto "Precisa de ajuda para acessar?"; removidos 6 campos de código, contador de reenvio, avisos SMTP/devCode, e-mails demo e textos técnicos
- Fluxo: e-mail → /api/auth/access → refreshMe → navigate('inicio') imediato; sessão ativa ao voltar abre #/inicio direto (RedirectToInicio já existente)
- VerbeteView: adicionado "← Voltar" contextual via param de=buscar|indice|salvos (também no estado de carregamento/erro)
- LivroView: índice abre verbete com de=indice; <img> → next/image
- FerramentasView: abas internas sincronizadas com ?aba= do hash (cards do Início agora navegam por hash)
- SalvosView: try/catch + toast em remover/apagar todos; verbete abre com de=salvos
- InicioView: "Bom dia" → "Olá"; capa com next/image (remove warning de dimensão — provável origem do "1 Issue")
- /api/me + app-client: entitlements agora incluem paymentId (corrige key da lista de compras na Conta)
- Corrigidos 5 erros de tipo TS pré-existentes (verify-otp ApiErrorCode, Verbete data null, InicioView NavigateFn)
- AdminView: <img> → next/image unoptimized (página de conferência)
- README.md: nova seção "Fluxo de acesso (sem código de 6 dígitos)" + integração Cakto marcada como obrigatória para produção; nota de que a pendência fica SÓ na documentação, nunca na tela

Stage Summary:
- Verificado no browser (Agent Browser): fluxo completo e-mail → Acessar aplicativo → #/inicio → busca "cavalo" → verbete (salvar) → voltar → livro (página 46 + zoom + índice A–Z) → ferramentas (bichos + gerador) → salvos → conta → sair → entrar novamente; sessão ativa ao recarregar abre #/inicio direto
- Planos preservados: pdf@ = ferramentas travadas com gate de upgrade; outro@ = "Localizando sua compra…"; admin@ = painel /admin acessível
- Responsividade: 0px de rolagem horizontal em 320/390/768/1440 em inicio/buscar/livro/bichos; botão de acesso a 495px do topo em 390x844 (teclado não cobre); rodapé fixo com safe-area
- Console/erros: zero warnings e zero erros após correção do next/image
- Capturas: download/nova-tela-acesso-celular.png (390px), nova-tela-acesso-celular-320.png, nova-tela-acesso-desktop.png (1440px)
- Pendência documentada (não na tela): CAKTO_* reais para acesso pago em produção; SMTP opcional para OTP alternativo
- Dados de teste criados em demo: usuário cliente@teste.com.br com entitlement demo book_app (idempotente, esperado em DEMO_MODE)

---
Task ID: 3
Agent: Z.ai Code (orquestrador)
Task: Correção do login — "digito e-mail, clico em Acessar aplicativo e continuo na mesma tela"

Work Log:
- Diagnóstico: servidor OK (POST /api/auth/access 200 + GET /api/me 200 no dev.log, repetido em cada clique). Causa raiz no CLIENTE: o Preview Panel roda o app em iframe cross-site; cookie de sessão SameSite=Lax (src/lib/auth.ts createSession) é descartado pelo navegador nesse contexto → /api/me volta {user:null} → guard de page.tsx força <EntrarView/> de volta. Por isso o clique não levava a lugar nenhum.
- auth.ts reescrito na parte de sessão: createSession agora retorna o token; getAuth(req) aceita Authorization: Bearer (sessão no banco) com fallback para cookie; destroyCurrentSession(req) idem; requireAdmin(req) repassa; cookie passa a SameSite=None; Secure quando a requisição é HTTPS (x-forwarded-proto) — funciona dentro do iframe https; verifyOtp usa createSession e devolve token.
- Rotas atualizadas para autenticação consciente de requisição (Bearer OU cookie): me, animals, index, book/pages, saved (GET/POST/DELETE), account/delete, search, entries, tools/generate e todas as admin (requireAdmin(req)).
- /api/auth/access devolve token no corpo; /api/auth/verify-otp idem; /api/auth/logout aceita Bearer.
- app-client.ts: saveSessionToken/clearSessionToken/authHeaders; api() anexa Bearer automaticamente e limpa token em 401.
- app-store.ts: refreshMe limpa token obsoleto quando user null; logout limpa token e não quebra se o servidor falhar.
- EntrarView: guarda o token da resposta, confirma a sessão (me.user) antes de navegar e mostra mensagem clara se falhar; form noValidate para o erro de e-mail inválido aparecer abaixo do campo (não na bolha nativa); botão sempre reabilitado no finally.
- AdminView: fetch cru do catálogo agora envia authHeaders() (Bearer).
- Warning next/image da capa corrigido (props/estilo com dimensões fixas nos dois eixos — capa real 700×990).

Stage Summary:
- curl sem cookies (contexto iframe): access→token→me→search→logout→me=null, tudo OK; regressão com cookie (top-level) OK.
- Browser real (Agent Browser), estado zerado: e-mail inválido → erro abaixo do campo; cliente@teste.com.br → #/inicio imediato; verbete CAVALO completo; Livro (3 páginas + zoom); Ferramentas + tabela dos bichos; reload → continua logado; Sair → #/entrar com token limpo; segundo ciclo completo idem.
- Console sem erros/warnings; lint limpo; dev.log sem erros; sem rolagem horizontal em 390px; botão de acesso visível (top 440px em 844px).
- Produção preservada: sem DEMO_MODE o /api/auth/access continua exigindo Entitlement ativo (purchase_not_found); integração segura do comprador segue como pendência documentada no README.
- App deixado logado em #/inicio no browser de teste; screenshots em download/entrar-mobile-390.png, entrar-desktop-1280.png, inicio-desktop-logado.png, inicio-mobile-390-logado.png.

---
Task ID: 4
Agent: Z.ai Code (orquestrador)
Task: Publicação do projeto no GitHub (applivrodosonhosv1)

Work Log:
- Verificado repositório local (main, 6 commits; alterações de código já commitadas pelo ambiente; apenas db/custom.db pendente)
- Auditado .env rastreado: continha somente DATABASE_URL local (sem segredos); removido do rastreamento com git rm --cached (arquivo mantido localmente)
- Commit do banco local + commit de limpeza do .env
- Remote origin apontado para github.com/sixeletronicbotblazer-cyber/applivrodosonhosv1.git; ls-remote confirmou repo vazio e token válido
- Push de main executado com token inline (sem persistir o token em .git/config); upstream configurado para origin/main
- Verificação: remote main = 05eccad (igual ao HEAD local), 166 arquivos (103 em src/), .env não rastreado

Stage Summary:
- Código completo do Livro dos Sonhos (incluindo correção do login Bearer+cookie da Task 3) publicado em main
- Recomendação registrada: revogar/regenerar o token PAT compartilhado no chat após o uso

---
Task ID: 5
Agent: Z.ai Code (orquestrador)
Task: Republicar na Vercel, associar o domínio público ao deployment ativo e validar o fluxo em janela anônima

Work Log:
- Encontrado o deployment existente do projeto (projeto Vercel "applivrodosonhosv1" ligado ao GitHub; domínio público applivrodosonhosv1.vercel.app já apontava para o build anterior do repo)
- Diagnóstico do deployment antigo: /api/config OK, porém POST /api/auth/access → HTTP 500 vazio (Prisma/SQLite quebrados no serverless) e demoMode=false; ou seja, login não funcionava na URL pública
- Causa 1 — runtime Prisma no lambda: sem DATABASE_URL e sem engine para Amazon Linux. Correções: prisma/schema.prisma com binaryTargets ["native","rhel-openssl-1.0.x","rhel-openssl-3.0.x"]; build do package.json roda `prisma generate` antes do next build
- Causa 2 — filesystem efêmero: src/lib/db.ts copia o banco empacotado (db/custom.db incluído via outputFileTracingIncludes "/api/**" no next.config.ts) para /tmp no cold start; serverExternalPackages @prisma/client
- Causa 3 — cada rota de API é uma lambda com cópia própria do banco em /tmp (sessão/entitlement criados numa instância não existiam nas outras → 401 auth_required determinístico em index/animals/search/book). Correções: token de sessão stateless assinado HMAC (prefixo lds1., validação sem banco, segredo por VERCEL_URL, ativo SOMENTE na prévia DEMO_MODE+Vercel) em src/lib/auth.ts; entitlement demo derivado do e-mail sem escrita (demo-preview-*) em src/lib/entitlements.ts, preservando outro@ (sem compra) e pdf@ (só PDF)
- Prévia pública: vercel.json com env DEMO_MODE=true + fallback determinístico no config.ts (VERCEL=1 sem variável → prévia); produção real permanece com DEMO_MODE=false + CAKTO_* documentados no README (nova seção "Deploy na Vercel")
- Commits a24daac e 704b14a; push em main disparou auto-deploy da Vercel; novo build ativo confirmado pela troca do build id (tSHPjaTJRF9EX4INBpl5l → ea06PWUGrUxJmRGNiPn84) e demoMode:true
- Validação por API no domínio público: access → 200 com token lds1. + entitlements; me, index, animals, book/pages, search "cavalo" (score 100) e entries?slug=cavalo → todos 200, repetidos em múltiplas rodadas (independência de instância)
- Teste em janela anônima (Agent Browser, sessão isolada com storage/cookies zerados) em https://applivrodosonhosv1.vercel.app: abre #/entrar; e-mail inválido mostra "Confira o e-mail digitado — parece incompleto." abaixo do campo; e-mail válido + Acessar aplicativo → #/inicio imediato; reload continua logado; busca "cavalo" → verbete completo (pág. impressa 42, associações, editoriais, salvar); Livro (capa ok, abas Páginas/Índice A–Z); Ferramentas (tabela dos 25 bichos com badges); Sair → #/entrar com token limpo; segundo ciclo completo OK
- Responsividade: sem rolagem horizontal em 390px; footer fixo; console sem erros/warnings

Stage Summary:
- URL pública final: https://applivrodosonhosv1.vercel.app (domínio público já associado ao deployment ativo de produção via integração Git; o push em main publica)
- Login funciona fim a fim na URL pública em janela anônima (antes: HTTP 500 no access)
- Prévia = acesso por qualquer e-mail (DEMO_MODE); produção real exige DEMO_MODE=false + credenciais Cakto no painel (documentado no README); persistência entre sessões/dados gravados continuam sujeitos ao efêmero /tmp do SQLite até migração para banco gerenciado (nota no README)
- Screenshots: download/vercel-desktop-logado.png, download/vercel-mobile-390.png, download/vercel-inicio-segundo-ciclo.png
