# COMANDO MASTER — colar no Z.ai com anexos

> Anexe junto deste comando: `DESIGN.md`, `BANCO_DE_DADOS.md`, `schema.sql`, os cinco PNG de `telas/`, os dois JSON de verbetes e o PDF original `Livro_dos_Sonhos_A4(1).pdf`. Se houver limite de arquivos, coloque o ZIP e o PDF e peça para extrair o ZIP. As telas são guia visual; o PDF é a fonte de verdade para o texto literal.

---

Você é arquiteto full stack, designer de produto e curador de dados. **Construa e execute um aplicativo web responsivo/PWA funcional chamado Livro dos Sonhos.** Não entregue apenas wireframe, landing page, telas estáticas ou texto descrevendo o que faria. Quero rotas navegáveis, autenticação e autorização reais, banco persistente, busca operacional e painel de revisão. Tome as cinco imagens anexadas como direção visual de alta fidelidade. Leia `DESIGN.md` e `BANCO_DE_DADOS.md` integralmente antes de codar. Use o PDF anexado como fonte principal e os JSON como rascunho de importação.

## Produto e oferta

O usuário comprou o livro em PDF ou o pacote Livro + Aplicativo. O app permite lembrar uma palavra do sonho ou descrever até 500 caracteres; encontra verbetes relacionados do livro, sua interpretação, o bicho e os números associados registrados no verbete. Há índice A–Z, PDF original, tabela dos 25 bichos, gerador de combinações por grupo e um catálogo de centenas/milhares importado e verificado. A experiência é consulta editorial, sem garantia de resultado. A oferta de R$ 12,90 inclui somente livro digital; R$ 24,90 inclui livro + app; a eventual recuperação de R$ 19,90 pode habilitar o mesmo pacote completo conforme o ID real dessa oferta. O recurso de resultados da Loteria Federal é **módulo adicional vendido separadamente**, apenas bloqueado e identificado no app até haver entitlement e fonte de dados real. Nunca conceder recursos com base apenas em URL, query string ou preço mostrado.

## Construção: vibecode com entrega verificável

Escolha a stack que o ambiente Z.ai conseguir executar de ponta a ponta; preferência por React/Next.js + TypeScript + CSS/Tailwind + Postgres/Supabase, PWA instalável. Faça componentes e tipos reutilizáveis, responsividade real, carregamento e estados de erro. Use migrações, `.env.example` sem segredos, README com instalação, configuração de e-mail OTP/Cakto, seed e implantação. Não grave chaves privadas no navegador. Se faltar credencial externa, implemente o código de integração completo com interface de configuração e modo de desenvolvimento isolado; não alegue autenticação ou pagamento “funcionando” em produção sem configurá-los. Nunca criar OTP universal nem conceder acesso temporário público para contornar a compra.

## Acesso e compra

1. `/entrar`: pessoa insere o e-mail da compra, toca **Receber código**, recebe OTP de 6 dígitos por e-mail, copia/cola, confirma. Mostrar expiração, reenvio e mensagens de erro sem revelar existência de conta. Configurar template OTP que envia o token numérico. O código é enviado por e-mail, não gerado e exposto na página. Proteger rate limit e tentativas.
2. Após verificar e-mail, consultar entitlement pelo e-mail confirmado ou usuário vinculado. Para compra Cakto: webhook no servidor, validar autenticidade usando mecanismo oficial disponível, armazenar ID de evento de forma idempotente, mapear IDs reais dos três produtos/upgrade, conceder apenas após pagamento aprovado e revogar em estorno/cancelamento. Fazer reconciliação manual/admin para atraso de evento. Não supor esquema de payload: documentar os campos/eventos confirmados na documentação Cakto antes da ativação.
3. `book_pdf`: orientar para o PDF e compra/upgrade do app, sem liberar busca premium; `book_app`: liberar PDF e ferramentas; `federal_addon`: somente módulo separado quando houver dado atualizado e entitlement. Um e-mail diferente do da compra recebe ajuda, sem conceder acesso indevido.

## Conteúdo e banco

Importe `verbetes_pdf_ocr.json` (538 registros automatizados) e `verbetes_ampliados_editoriais.json` (538 complementos de pesquisa). Meta de trabalho: 1.076 registros, o dobro da extração inicial. **Não confunda 1.076 com 1.076 entradas literais comprovadas.** PDF tem 120 páginas raster; OCR não é publicação. Faça painel `/admin` para revisar lado a lado cada registro com sua página, editar título, descrição e números, aprovar/publicar em lote apenas após conferência, identificar faltantes e recalcular cobertura. Carregue todos como `draft`; conteúdo público numérico só de registros publicados. Tabela dos 25 bichos: extraia/revise a página 4 do PDF. Nunca inventar números para preencher campo vazio.

As 132 entradas editoriais novas devem ser distinguíveis dos verbetes do livro e ligadas ao verbete fonte. As 406 variações contextuais podem virar aliases após revisão; uma nova expressão como “celular quebrado” **não** herda números como se estivesse impressa no PDF. Se mostrar a associação, escrever “No verbete relacionado CARTA, o livro registra ...”, com página do verbete, e deixar claro que a conexão é editorial. Ver `BANCO_DE_DADOS.md` e `schema.sql`. A qualquer dúvida, preservar a fonte literal e solicitar escolha/refinamento.

## Busca e relatório

- Entradas: palavra, pequeno conjunto de elementos, descrição de sonho com 1–500 caracteres; normalizar acentos/caixa, suportar erros leves, plurais e aliases revisados. Não exigir IA remota para busca básica.
- Ranqueamento reproduzível: título exato, alias revisado, palavras distintas com peso por especificidade, contexto editorial e similaridade com limite. Exibir até 3 opções quando relato for ambíguo; o usuário escolhe. Não deduzir um único bicho de uma narrativa com vários elementos conflitantes.
- Tela de resultado: título, interpretação conferida, variantes relevantes (ex.: cavalo branco/escuro), bicho, grupo, dezena, centena, milhar, evidência `PDF pág. 46 · pág. impressa 42`, visualizar a página, salvar. Exemplo Cavalo da tela 04: COBRA, grupo 09, dezena 34, centena 534, milhar 8534; conferir uma vez mais na imagem do PDF.
- Não usar modelo generativo para criar número, citação do livro ou previsão. Se usar modelo apenas para extrair elementos do relato, validar qualquer saída contra IDs publicados, mostrar procedência e ter fallback determinístico. Sem resultado: mostrar busca alternativa e índice, sem resposta inventada.
- Histórico/favoritos opcionais por usuário; explicar armazenamento, permitir apagar. Registrar telemetria de navegação sem guardar texto íntimo do sonho por padrão.

## Páginas e visual

Implemente todas as rotas de `DESIGN.md`: entrar, início, buscar, verbete, livro/índice/PDF, ferramentas, salvos, conta/suporte, admin. Reproduza a linguagem visual das cinco imagens: roxo profundo, papel quente, amarelo da capa, títulos editoriais, cartões claros, espaçamento largo, texto legível. Use a **capa verdadeira do PDF** e página real de amostra; não redesenhe outra capa. Barra inferior mobile, desktop adaptado. Alta acessibilidade: 16 px no corpo, contraste, foco visível, rótulos de formulário, toque ≥44 px, zoom do PDF, `prefers-reduced-motion`. Nada de conteúdo promocional intrusivo após a compra.

Gerador: usuário escolhe grupo/bicho e o sistema combina milhares de quatro dígitos cuja dezena final pertença ao grupo segundo tabela verificada. Permitir semente estável para a mesma sessão/dia se rotulado, evitar dizer que aumentam chance. Exibir método e botão de copiar. Catálogo: componente, esquema e importação; **ocultar valores e não publicar afirmação de “viciadas” até receber lista e critério de origem verificados**. Federal: cartão bloqueado de produto extra; sem jogos/resultados fictícios.

## Ordem de execução

1. Inspecionar anexos e montar mapa de páginas/arquivos; indicar qualquer campo faltante antes de conectar serviços externos, sem travar UI local.
2. Implementar banco/migrações/RLS, seed draft, painel de revisão e importador de PDF/catálogo.
3. Implementar OTP, entitlement e webhook idempotente, com variáveis de ambiente e testes locais por eventos simulados.
4. Construir interface final para mobile e desktop, busca determinística, visualizador PDF e ferramentas.
5. Executar build e testar: OTP inválido/expirado, comprador só PDF, pacote completo, estorno, busca exata Cavalo, relato ambíguo, termo editorial, sem resultado, bloqueio Federal, viewport 320/390/768/1440, teclado, página PDF e números com zero à esquerda.
6. Entregar projeto editável, instruções de deploy, lista de integrações pendentes, e capturas reais das páginas implementadas. Não considerar concluído se for só mockup ou se aparecerem números não verificados no ambiente público.

## Critérios de aceite

Em uma compra de pacote completo confirmada e com e-mail correto, o usuário recebe OTP verdadeiro, entra e consulta um verbete revisado. Uma compra do PDF isolado não acessa as ferramentas premium. Busca por “cavalo branco” mostra o trecho correspondente e os números do verbete Cavalo, com ligação à página original. Busca por termo novo explicita que a ligação foi editorial. Várias palavras plausíveis geram opções. O catálogo só exibe dados importados e revisados. O código, os dados e o design são entregues juntos, com funcionamento responsivo e sem promessas de ganho.

---

**Agora execute o projeto completo com os anexos. Ao encontrar dado OCR duvidoso, mantenha-o em revisão e mostre pendências; jamais complete lacunas com invenção.**
