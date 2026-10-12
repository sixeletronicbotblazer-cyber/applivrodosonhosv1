# Livro dos Sonhos — aplicativo de consulta (PWA)

Aplicativo web responsivo (PWA) para consulta editorial de sonhos com base no livro
"Livro dos Sonhos": busca por palavra ou relato, verbetes com bicho/grupo/dezena/
centena/milhar exatamente como registrados no livro, índice A–Z, PDF original,
tabela dos 25 bichos, gerador de combinações por grupo e catálogo digital
(importado e verificado).

**Promessa do produto:** "Lembrou do sonho? Encontre o verbete e consulte as
associações no mesmo lugar." As associações são para consulta e não garantem
resultado de jogo.

---

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui
- Prisma ORM + SQLite (`db/custom.db`) — schema adaptado do `schema.sql` (referência PostgreSQL)
- Sessões próprias com cookie httpOnly · acesso pelo e-mail da compra (`POST /api/auth/access`, sem código na tela)
- OTP por e-mail permanece disponível no servidor como fluxo alternativo (`/api/auth/request-otp`, `/api/auth/verify-otp`), mas a interface do comprador não usa código
- Zustand para estado de navegação (SPA com rotas por hash: `#/inicio`, `#/verbete/cavalo`, …)
- PWA: `public/manifest.webmanifest` + service worker (`public/sw.js`, registrado só em produção)

## Como rodar

```bash
bun install
bun run db:push      # cria as tabelas
bun prisma/seed.ts   # importa os 1.076 registros de trabalho + usuários demo
bun run dev          # http://localhost:3000
```

## Dados e curadoria (regra central)

O pacote de construção traz dois JSON:

| Arquivo | Registros | Estado no seed |
|---|---:|---|
| `verbetes_pdf_ocr.json` | 538 | `draft` — exigem conferência com a página do PDF |
| `verbetes_ampliados_editoriais.json` | 132 novos símbolos + 406 variações | editoriais `draft`; variações viram **aliases** `draft` |

**Total de trabalho: 1.076 registros** (670 verbetes + 406 aliases). Isso é contagem
operacional, não 1.076 verbetes literais validados.

### O que vem publicado (e por quê)

Somente os verbetes **literalmente conferidos contra as imagens do PDF** fornecidas
na construção, mais 4 editoriais coerentes vinculados a eles:

- Página 5 (impressa 01): A, ABACATE, ABACAXI, ABELHA, ABISMO
- Página 46 (impressa 42): CAVALO, CEGONHA, CINZA, COBRA, COELHO
  (CAVALO → COBRA · grupo 09 · dezena 34 · centena 534 · milhar 8534 — dupla revisão visual OK)
- Editoriais publicados: "cavalo branco correndo", "cavalo entrando em casa",
  "cobra trocando de pele", "cobra na água" — sempre com o bloco
  "No verbete relacionado X, o livro registra…". **Nunca recebem números próprios.**

Os demais 656 verbetes e 406 aliases ficam em `/admin` aguardando curadoria:
revisão lado a lado com a página do PDF, correção de título/interpretação/números,
publicação individual ou em lote. **Números nunca são inventados para preencher lacuna.**

### Tabela dos 25 bichos

A página 4 do PDF não acompanhou o pacote. A tabela foi **reconstruída do OCR**
(consistente: grupo N → dezenas 4N-3..4N) e cada linha carrega o status
`conferido` (presente nos verbetes verificados) ou `em revisão` — conferir na
página 4 antes de qualquer uso público.

## Contas de demonstração (DEMO_MODE=true)

| E-mail | Papel | Acesso |
|---|---|---|
| `admin@livrodossonhos.app` | ADMIN | pacote completo + painel /admin |
| `demo@livrodossonhos.app` | USER | pacote completo (Livro + Aplicativo) |
| `pdf@livrodossonhos.app` | USER | somente PDF (ferramentas travadas) |
| `outro@livrodossonhos.app` | USER | sem compra (tela de orientação) |

Qualquer e-mail válido entra na prévia e recebe o **pacote completo de demonstração**
(sessão de demonstração, idempotente) — exceto `pdf@` (mantém o estado "só PDF"
com ferramentas travadas) e `outro@` (mantém o estado "sem compra"). Assim a
distinção de planos continua testável. **Esse comportamento só existe com
`DEMO_MODE=true`; em produção nunca é aplicado.**

## Fluxo de acesso (sem código de 6 dígitos)

1. Comprador informa o e-mail usado na compra em `#/entrar` e clica em
   **Acessar aplicativo** — validação de campo, estado de carregamento no botão
   e redirecionamento imediato para `#/inicio`.
2. **Produção:** `POST /api/auth/access` só estabelece sessão quando existe
   `Entitlement.status = 'active'` vinculado a esse e-mail (nascido do pagamento
   confirmado pelo webhook da plataforma). Sem compra confirmada → resposta
   neutra `purchase_not_found`; a tela nunca revela detalhes técnicos.
3. **Prévia/DEMO_MODE:** qualquer e-mail válido recebe a sessão de demonstração
   com pacote completo, preservando as contas semeadas para testar cada plano.
4. Sessão persistente (cookie httpOnly, 30 dias): voltar ao app com sessão
   ativa abre `#/inicio` diretamente.

> **Integração de compra ainda não configurada:** enquanto os `CAKTO_*` não
> estiverem definidos no `.env`, o acesso completo só acontece na prévia
> (DEMO_MODE). Isso está documentado AQUI e nunca é exibido na tela do
> comprador.

## Integrações pendentes (código pronto, aguardando credenciais)

1. **Cakto (obrigatório para acesso real em produção):** definir
   `CAKTO_WEBHOOK_SECRET` (HMAC-SHA256 do corpo bruto, aceito como `sha256=<hex>`)
   e os `CAKTO_OFFER_*` reais. Endpoint: `POST /api/webhooks/cakto`.
   - Idempotente por ID de evento (`payment_events.provider_event_id`).
   - Aprovado → entitlement `active`; estorno/cancelamento → `revoked`.
   - **O schema do payload da Cakto precisa ser confirmado na documentação oficial
     antes de ativar em produção** — os seletores em `src/lib/webhook-cakto.ts`
     são flexíveis e documentados; ajuste os campos conforme a doc.
   - Reconciliação: aba Pagamentos do /admin + tabela `payment_events`.
2. **SMTP (opcional):** o fluxo de OTP por e-mail segue implementado no servidor
   (`/api/auth/request-otp` + `/api/auth/verify-otp`) como alternativa de
   verificação de posse do e-mail; a interface atual do comprador não o usa.
   Para ativá-lo, definir `SMTP_*` no `.env`.
3. **Módulo Federal:** produto separado. Exige entitlement `federal_addon` **e**
   `FEDERAL_FEED_URL` de fonte autorizada. Sem ambos, permanece bloqueado
   (nunca exibe resultados fictícios).
4. **Catálogo de centenas/milhares:** importar via /admin → Catálogo (JSON ou CSV
   com `value, value_kind, source_name, methodology, reference_period`). Itens
   entram como draft; valores só aparecem ao público após revisão e publicação.
   Sem lista verificada, o módulo exibe aviso — nunca alegação de "viciadas".
5. **PDF completo:** o arquivo original não acompanhou o ZIP. Anexe as páginas/JSON
   de páginas em `public/book/` + tabela `book_pages` para liberar as demais
   páginas do visualizador (as 3 fornecidas já estão no ar).

## Testes locais por eventos simulados

/admin → Pagamentos → "Executar evento simulado" roda **o mesmo pipeline do
webhook** (idempotência, mapeamento de oferta, concessão/revogação). Em dev,
as ofertas `DEMO-OFFER-BOOK-PDF/BOOK-APP/FEDERAL` são mapeáveis para teste;
em produção (`DEMO_MODE=false`) apenas os IDs reais valem.

## Estrutura

```
prisma/schema.prisma      # modelo de dados (SQLite) adaptado do schema.sql
prisma/seed.ts            # importador dos JSON + verificados + usuários demo
prisma/seed-data/*.json   # verbetes_pdf_ocr.json + verbetes_ampliados_editoriais.json
src/lib/                  # config, auth/OTP, mailer, entitlements, busca, webhook
src/app/api/…             # APIs (auth, me, search, entries, saved, tools, admin, webhook)
src/components/livro/     # AppShell, telas e componentes do guia visual
public/book/              # capa + páginas fornecidas em imagem
public/icons, manifest    # PWA
```

## Segurança e privacidade

- OTP: hash SHA-256 com pepper, expiração 10 min, 5 tentativas, cooldown 60 s,
  limites por e-mail e IP. Respostas genéricas (não revelam existência de conta).
- Sessão: cookie `httpOnly` `SameSite=Lax`, token de 256 bits, 30 dias.
- Autorização no servidor por entitlement (`book_pdf` ≠ `book_app` ≠ `federal_addon`).
  Preço/URL nunca concedem acesso.
- Busca: telemetria mínima (`search_logs` guarda modo/contagens/hash — **o texto do
  sonho não é armazenado**).
- Conta: exclusão de salvos, sessões e anonimização em /conta.

## Rotas do app (SPA por hash)

`#/entrar` · `#/inicio` · `#/buscar` · `#/verbete/:slug` · `#/livro` (páginas + índice)
`#/ferramentas` (bichos, gerador, catálogo, Federal) · `#/salvos` · `#/conta` · `#/admin`
