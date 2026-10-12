# Banco de dados — semente, curadoria e procedência

## O que acompanha este pacote

| Arquivo | Linhas | Origem | Estado |
|---|---:|---|---|
| `verbetes_pdf_ocr.json` | 538 | OCR das páginas 5–120 do PDF de 120 páginas enviado | **Rascunho:** todos requerem conferência na imagem original. Alguns títulos e números podem estar incorretos/ausentes. |
| `verbetes_ampliados_editoriais.json` | 538 | 132 símbolos contemporâneos + 406 variações de busca vinculadas por tema | **Rascunho editorial:** revisar vínculo e interpretação; não são verbetes literais do livro. |
| Total de registros de trabalho | **1.076** | 2× a contagem da extração automatizada | Contagem operacional, não afirma que o livro tenha exatamente 538 verbetes. |

O PDF é majoritariamente imagem raster. O OCR pode fundir dois títulos, deixar entradas de fora e confundir algarismos. Por isso **não publicar dados financeiros/de aposta extraídos automaticamente sem revisão humana contra a página**. A contagem “2×” é do banco de trabalho comparado ao conjunto que conseguimos extrair, não uma contagem editorial definitiva do livro.

As 406 variações contextuais são pontos de busca para verbetes existentes: idealmente migrar para `entry_aliases` após revisão, para não inflar o índice como se fossem 406 novos significados. As 132 entradas novas são editoriais e devem continuar identificadas como tais. Se a contagem editorial final do PDF mudar, recalcular a meta de cobertura 2× após curadoria.

## Regras de ingestão

1. Importar o PDF fornecido como fonte imutável/versionada; preservar número da página do PDF e número impresso.
2. Carregar os JSON como `draft`. No painel de revisão, exibir recorte/página original e campos lado a lado; corrigir título, interpretação e números. Publicar somente depois de aprovação.
3. Importar tabela real de 25 bichos/grupos/dezenas da página 4, também sob revisão. Não derivar correspondências ausentes.
4. Transformar variações em aliases; deduplicar Unicode/acentos, títulos repetidos e plurais. Novas entradas editoriais precisam de interpretação original, ligação a verbete-base e aprovação.
5. Não criar catálogo de centenas/milhares “viciadas” sem arquivo de referência, período e critério fornecidos; o importador deve aceitar CSV/JSON auditável. Ocultar o módulo até receber os dados. Não alimentar resultados da Federal sem uma fonte autorizada e atual.
6. Se o PDF reprocessado revelar mais que 538 verbetes, manter registros adicionais e recalcular o dobro; nunca descartar entrada real para preservar meta artificial.

## Estrutura lógica e restrições

`dream_entries`: id, slug, title, source_type (`pdf_literal`/`editorial`), source_pdf_page, source_print_page, meaning, related_pdf_id, review_status, reviewer_id, reviewed_at, version. `entry_aliases`: alias normalizado, tipo, `dream_entry_id`, revisão. `number_associations`: entry_id de origem literal, animal, group_number, dezena, centena, milhar, evidência de página. `book_pages`: localização protegida do PDF, número, OCR, status. `catalog_items`: item, tipo, origem/período/critério, status e versão. `entitlements`: e-mail/usuário/offer_id/produto/status/transaction_id. `payment_events`: id externo único, payload hash, data processada, resultado. `saved_entries`: usuário+entrada. `search_logs`: opcional, minimizado e com expiração.

Campos de milhar/centena/dezena são strings com zeros à esquerda. `group_number` é 1–25. Associação numérica em registro editorial é **referência ao verbete-base**, não associação própria. API pública devolve somente `review_status=published` e nunca expõe dados de outros compradores. Administração usa service role exclusivamente no servidor.

## Exemplo conferido

`CAVALO`, PDF página 46, página impressa 42: cavalo escuro associa bom presságio, elevação social, promoção no emprego e bons negócios; branco associa felicidade e alegria. Bicho `COBRA`, grupo `09`, dezena `34`, centena `534`, milhar `8534`. O mockup da tela 04 usa somente esse exemplo. Faça segunda revisão visual ao implementar.

## Segurança e acesso

E-mail OTP real com seis dígitos enviado por provedor autenticado; limitador de tentativas e reenvio. Nunca mostrar o OTP gerado na interface nem aceitar um código universal. Após confirmação do e-mail, consultar entitlement servidor com evento de compra verificado. Plano `book_pdf` (R$ 12,90) recebe apenas PDF; plano `book_app` (R$ 24,90) ou upgrade autorizado (R$ 19,90) recebe PDF+app. O preço não serve como identificador do direito: configurar IDs reais das ofertas. Módulo Federal é produto separado. Uma compra pendente ou devolvida não concede acesso. Webhook assinado/verificado, idempotente, e reconciliável.
