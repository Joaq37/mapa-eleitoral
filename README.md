# Mapa Eleitoral

Site estático (MapLibre + JS puro) com os dados abertos do TSE (eleições gerais 2026), fotos oficiais dos candidatos e
indicadores do IBGE.

## Rodar o site

```bash
python -m http.server 8765 --directory site
```

Abra http://localhost:8765

## Eleições disponíveis

- **2026** — Presidente, Governador, Senador, Dep. Federal/Estadual/Distrital (1º e 2º turnos).
- **2024** — Prefeito (1º e 2º turnos; DF não tem) e Vereador. Em eleição municipal a lista mostra partidos (com nº de
  prefeituras ganhas) e, ao clicar num município, os candidatos de lá.
- **2022** — Presidente (1º e 2º turnos). Botão "Variação vs …" compara o mesmo candidato entre anos (ex.: Lula 2022 × 2026).
- **Emendas parlamentares individuais** (Portal da Transparência/CGU) de deputados e senadores que são candidatos em 2026:
  totais, por ano, por área e mapa dos municípios que receberam recursos (chip "Emendas").

## Funcionalidades

- **Resultados**: escolha cargo (Presidente, Governador, Senador, Dep. Federal/Estadual/Distrital), turno e território
  (Brasil, estado ou município). A lista mostra **todos os candidatos** com foto, partido, nº de votos e %.
  Clique em um candidato (ou partido) para ver o **mapa em degradê** da votação dele, município a município.
- **Busca** (topo): qualquer candidato de qualquer cargo (18,5 mil) ou município. Ex.: "Victor Antoun" → mapa dele no RJ.
- **Mapa**: vencedor por município, degradê por candidato, variação 1º × 2º turno, ou qualquer variável (perfil do eleitorado TSE,
  Censo 2022, renda, PIB, religião, cor/raça, saneamento, participação).
- **Correlação**: dispersão X × Y entre municípios (Pearson, Spearman, R², p-valor), ponderação, filtro por estado/porte,
  seleção por retângulo, mapa de resíduos, ranking "o que mais se correlaciona com Y" e matriz de correlação.
  Qualquer candidato pode ser X ou Y.
- **Locais de votação**: pontos por local/bairro com o voto em Presidente por seção (1º e 2º turno).
- O estado da tela fica na URL (botão **Link**).

## Indicadores do IBGE (por município)

Censo 2022 (população, densidade, crescimento, urbanização, idade mediana, envelhecimento, cor/raça, religião, alfabetização,
nível de instrução, rendimento domiciliar per capita e do trabalho, % de baixa renda, água, esgoto, lixo), PIB dos Municípios
(PIB per capita 2023; composição setorial 2021) e CEMPRE 2024 (empregos formais, empresas, salário médio).

## Regenerar os dados (pipeline)

Requer Python 3 com `pandas` e `numpy`. Entradas: `dados/tse_2026/*.zip`, `dados/fotos_2026/*.zip` (TSE) e `raw_geo/` (IBGE).

```bash
cd pipeline
python s1_geo.py       # malhas + tabela TSE<->IBGE
python s2_results.py   # resultados por município (+ candidatos de deputado por UF, índice de busca)
python s3_demo.py      # perfil do eleitorado (TSE)
python s4_locais.py    # locais de votação + votos de Presidente por local
python s5_ibge.py      # indicadores IBGE via API SIDRA/agregados (precisa de internet)
python s6_fotos.py     # extrai as fotos dos candidatos para site/fotos/
python s7_emendas.py   # emendas parlamentares individuais (dados/emendas/emendas_parlamentares.zip, CGU)
python s8_anos.py      # Presidente 2022 e Prefeito/Vereador 2024 (dados/tse_anos/*.zip)
```

## Notas e limitações

- Governador/Senador/Deputado só existem dentro do próprio estado (o degradê aparece só ali).
- Votos de legenda não entram nas parcelas dos candidatos a deputado (só votos nominais válidos).
- Votos no exterior (ZZ) não aparecem no mapa. ~2% dos locais sem apuração por seção ficam fora da aba de locais.
- Valores ausentes do IBGE (sigilo estatístico) ficam em branco; IDHM e Bolsa Família não são do IBGE e não foram incluídos.
- Sem fotos de candidatos a prefeito/vereador de 2024 (o TSE só as distribui em pacotes de vários GB); aparecem as iniciais.
- Emendas: o município é o do favorecido do recurso (arquivo "PorFavorecido"), e só aparecem parlamentares cujo nome de urna
  casa com o de um candidato 2026 a deputado federal ou senador.
- Correlação entre municípios não implica causalidade nem comportamento individual (falácia ecológica).
