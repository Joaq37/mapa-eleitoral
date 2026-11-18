# Mapa Eleitoral

Site estático (MapLibre + JS puro) com os dados abertos do TSE (eleições de 1994 a 2026), fotos oficiais dos candidatos, emendas parlamentares e indicadores do IBGE.

**Acesse: https://joaq37.github.io/mapa-eleitoral/**

## Rodar localmente

```bash
python -m http.server 8765 --directory site
```

Abra http://localhost:8765

## Eleições disponíveis

Clique para abrir o site já na eleição escolhida (dentro do site, o seletor **Eleição** troca de ano e os botões trocam de cargo e turno):

| Ano | Tipo | Abrir direto (1º turno) |
|---|---|---|
| **2026** | Federal e estadual | [Presidente](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22pres1%22%7D) · [Governador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22gov1%22%7D) · [Senador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22sen1%22%7D) · [Dep. Federal](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22dfed1%22%7D) · [Dep. Estadual](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22dest1%22%7D) · [Dep. Distrital](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22ddist1%22%7D) |
| **2022** | Federal e estadual | [Presidente](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22pres1%4022%22%7D) · [Governador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22gov1%4022%22%7D) · [Senador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22sen1%4022%22%7D) · [Dep. Federal](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22dfed1%4022%22%7D) · [Dep. Estadual](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22dest1%4022%22%7D) · [Dep. Distrital](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22ddist1%4022%22%7D) |
| **2018** | Federal e estadual | [Presidente](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22pres1%4018%22%7D) · [Governador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22gov1%4018%22%7D) · [Senador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22sen1%4018%22%7D) · [Dep. Federal](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22dfed1%4018%22%7D) · [Dep. Estadual](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22dest1%4018%22%7D) · [Dep. Distrital](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22ddist1%4018%22%7D) |
| **2014** | Federal e estadual | [Presidente](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22pres1%4014%22%7D) · [Governador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22gov1%4014%22%7D) · [Senador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22sen1%4014%22%7D) · [Dep. Federal](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22dfed1%4014%22%7D) · [Dep. Estadual](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22dest1%4014%22%7D) · [Dep. Distrital](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22ddist1%4014%22%7D) |
| **2010** | Federal e estadual | [Presidente](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22pres1%4010%22%7D) · [Governador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22gov1%4010%22%7D) · [Senador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22sen1%4010%22%7D) · [Dep. Federal](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22dfed1%4010%22%7D) · [Dep. Estadual](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22dest1%4010%22%7D) · [Dep. Distrital](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22ddist1%4010%22%7D) |
| **2006** | Federal e estadual | [Presidente](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22pres1%4006%22%7D) · [Governador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22gov1%4006%22%7D) · [Senador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22sen1%4006%22%7D) · [Dep. Federal](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22dfed1%4006%22%7D) · [Dep. Estadual](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22dest1%4006%22%7D) · [Dep. Distrital](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22ddist1%4006%22%7D) |
| **2002** | Federal e estadual | [Presidente](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22pres1%4002%22%7D) · [Governador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22gov1%4002%22%7D) · [Senador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22sen1%4002%22%7D) · [Dep. Federal](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22dfed1%4002%22%7D) · [Dep. Estadual](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22dest1%4002%22%7D) · [Dep. Distrital](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22ddist1%4002%22%7D) |
| **1998** | Federal e estadual | [Presidente](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22pres1%4098%22%7D) · [Governador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22gov1%4098%22%7D) · [Senador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22sen1%4098%22%7D) · [Dep. Federal](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22dfed1%4098%22%7D) · [Dep. Estadual](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22dest1%4098%22%7D) |
| **1994** | Federal e estadual | [Presidente](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22pres1%4094%22%7D) · [Governador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22gov1%4094%22%7D) · [Senador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22sen1%4094%22%7D) · [Dep. Federal](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22dfed1%4094%22%7D) · [Dep. Estadual](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22dest1%4094%22%7D) |
| **2024** | Municipal | [Prefeito](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22pref1%4024%22%7D) · [Vereador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22vere1%4024%22%7D) |
| **2020** | Municipal | [Prefeito](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22pref1%4020%22%7D) · [Vereador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22vere1%4020%22%7D) |
| **2016** | Municipal | [Prefeito](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22pref1%4016%22%7D) · [Vereador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22vere1%4016%22%7D) |
| **2012** | Municipal | [Prefeito](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22pref1%4012%22%7D) · [Vereador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22vere1%4012%22%7D) |
| **2008** | Municipal | [Prefeito](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22pref1%4008%22%7D) · [Vereador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22vere1%4008%22%7D) |
| **2004** | Municipal | [Prefeito](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22pref1%4004%22%7D) · [Vereador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22vere1%4004%22%7D) |
| **2000** | Municipal | [Prefeito](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22pref1%4000%22%7D) · [Vereador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22vere1%4000%22%7D) |
| **1996** | Municipal | [Prefeito](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22pref1%4096%22%7D) · [Vereador](https://joaq37.github.io/mapa-eleitoral/#%7B%22ds%22%3A%22vere1%4096%22%7D) |

- Presidente, Governador e Prefeito têm 1º e 2º turnos. Nas eleições municipais, a lista mostra partidos (com nº de prefeituras ganhas) e, ao clicar num município, os candidatos de lá.
- O botão **Variação vs …** compara o mesmo candidato ou partido entre anos (ex.: Lula 2022 × 2026).
- **Emendas parlamentares individuais** (Portal da Transparência/CGU) de deputados e senadores que são candidatos em 2026: totais, por ano, por área e mapa dos municípios que receberam recursos.
- Os dados de 1994 a 2024 foram gerados no GitHub Actions (workflow `dados-extra.yml`), sem baixar os arquivos do TSE para o computador.

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
