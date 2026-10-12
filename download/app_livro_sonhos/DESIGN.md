# Livro dos Sonhos — especificação visual e funcional v1.0

## Direção

Aplicativo de consulta, com aparência editorial e leitura fácil para adultos, inclusive público mais velho. O livro original é a âncora visual e de conteúdo. A navegação reduz o caminho entre “lembrei do sonho” e “achei o verbete”, sem sugerir que números predizem resultados. As cinco imagens na pasta `telas/` são referência visual de intenção e composição. O PDF entregue junto ao construtor é a fonte para validar dados e a capa; a tela de exemplo Cavalo corresponde à página impressa 42 (página 46 do PDF).

## Tokens

| Papel | Valor | Uso |
|---|---|---|
| Roxo profundo | `#321053` | Cabeçalho, CTA primário, cartões de associação |
| Roxo secundário | `#4B1C70` | Estados ativos e destaques discretos |
| Papel | `#FCF8F1` | Fundo principal |
| Branco | `#FFFFFF` | Cartões e campos |
| Amarelo livro | `#F7C94D` | Ênfase numérica e ação secundária |
| Tinta | `#25182F` | Texto principal |
| Cinza texto | `#766B78` | Apoio; verificar contraste em tamanho pequeno |
| Lilás claro | `#F2EAF7` | Filtros, ícones e seleção |
| Verde procedência | `#356D59` | Fonte conferida no livro |
| Linha | `#E9DED4` | Divisórias e bordas |

Títulos: serifada editorial (ex.: Georgia ou equivalente com boa licença). Interface e corpo: sans de leitura clara (ex.: Inter/Arial). Corpo 16 px recomendado em produção; a imagem é referência, não tamanho mínimo. Escala fluida: títulos 28–36 px; subtítulos 20–24 px; rótulos 12–14 px; corpo 16–18 px. Altura dos alvos interativos ≥44 px. Raio 12–18 px. Sombra leve apenas quando ajudar na hierarquia; bordas claras nos demais cartões.

## Responsividade e acessibilidade

- Mobile-first de 320 a 480 px; conteúdo central máximo 440 px em telas largas; no desktop, painel com coluna lateral e área de leitura de até 760 px. Sem textos cortados, preços sobrepostos nem rolagem horizontal.
- Barra inferior fixa apenas no mobile: Início, Buscar, Livro, Ferramentas. No desktop, navegação lateral com as mesmas rotas.
- Compatível com teclado, foco visível, nomes de campos, estados de erro legíveis, `aria-live` para resultados e OTP; `prefers-reduced-motion` elimina animações.
- Para PDF rasterizado, abrir página com zoom e botão de retorno. Os números e verbetes principais devem existir também em HTML acessível após revisão do OCR.
- Não usar elementos brilhantes ou movimento constante no fluxo de consulta. Não copiar o PDF como texto pesquisável sem revisão editorial.

## Arquitetura de páginas

| Rota sugerida | Objetivo | Elementos e estados |
|---|---|---|
| `/entrar` | E-mail + código | Campo e-mail, enviar código de 6 dígitos, inserir/colar código, reenviar com temporizador, erro/expirado, contato suporte. O código chega por e-mail; a tela nunca o inventa/exibe. |
| `/inicio` | Atalho de consulta | Busca de palavra, CTA “Contar meu sonho”, índice, tabela dos 25 bichos, livro original; cartões conforme tela 02. |
| `/buscar` | Palavra ou relato | Campo até 500 caracteres, contador, elementos detectados, até 3 candidatos ordenados, refinamento manual. Estados vazio, carregando, sem resultado e ambíguo. |
| `/verbete/:slug` | Resposta rastreável | Título, resumo revisado, variações do verbete, bicho/grupo/dezena/centena/milhar exatamente vinculados à fonte, etiqueta de procedência, página PDF, salvar e voltar. |
| `/livro` | PDF + índice | Capa aprovada, índice A–Z, visualizador de páginas, página impressa e página PDF. Disponível no plano completo; link de download de PDF conforme licença/acesso. |
| `/ferramentas` | Ações do pacote | 25 bichos, gerador de combinações por grupo, catálogo digital importado/verificado, módulo da Federal bloqueado se sem compra separada. |
| `/salvos` | Reconsulta | Histórico local/servidor opt-in e verbetes favoritos, opção de apagar. |
| `/conta` | Ajuda e acesso | E-mail, compras ativas, suporte, sair, privacidade e exclusão. |
| `/admin` | Curadoria interna | Revisar OCR lado a lado com página, corrigir, versionar e publicar; importar catálogo; acompanhar pagamentos idempotentes. Protegida por papel administrativo. |

## Fluxo de busca

1. Aceitar termo breve ou relato de até 500 caracteres; normalizar caixa, acentos e plural simples sem alterar o original exibido.
2. Extrair elementos concretos (animal, pessoa, objeto, lugar, ação, cor). Classificar correspondência: título exato > alias revisado > contexto relacionado > aproximação ortográfica.
3. Se houver ambiguidade, mostrar até três candidatos com trecho e fonte; solicitar que a pessoa escolha. Não fabricar um “relatório personalizado” com associações inexistentes.
4. O resultado literal recebe etiqueta `Do Livro dos Sonhos` e página. Ampliação editorial recebe `Sugestão relacionada`, título do verbete-base e sua página. Números de uma ampliação só aparecem dentro do bloco explicitamente atribuído ao verbete-base, nunca como números próprios do novo termo.
5. Quando não houver correspondência confiável, oferecer índice/busca refinada. Conteúdo autoral interpretativo pode ser opcional e deve ser descrito como leitura editorial, não como texto do livro.

## Components

`AppShell`, `BottomNav`, `PageHeader`, `SearchField`, `StoryTextarea`, `ElementChip`, `EntryCard`, `SourceBadge`, `AssociationPanel`, `PdfPageViewer`, `AnimalTable`, `CombinationGenerator`, `CatalogList`, `LockedFeature`, `OtpForm`, `EntitlementGate`, `EmptyState`, `ErrorState`, `AdminReview`.

## Microcopy e limites

Promessa principal: “Lembrou do sonho? Encontre o verbete e consulte as associações no mesmo lugar.” Etiqueta do gerador: “Combinações para consulta; não são previsão ou recomendação de aposta.” Evitar “certeza”, “ganhar”, “assertividade garantida”, contagem regressiva promocional falsa e “milhares viciadas” como alegação estatística não demonstrada. Na interface, chamar `Catálogo digital de centenas e milhares` até que a lista e sua origem sejam verificadas. Este aplicativo é complementar ao PDF, sem assinatura no plano de pagamento único descrito na oferta.
