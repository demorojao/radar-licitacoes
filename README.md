# Radar de Licitações SC

[![CI](https://github.com/demorojao/radar-licitacoes/actions/workflows/ci.yml/badge.svg)](https://github.com/demorojao/radar-licitacoes/actions/workflows/ci.yml)

Encontre licitações **abertas em Santa Catarina** que combinam com o que a sua empresa vende e
entenda o edital em minutos, com uma IA que mostra a página de onde tirou cada informação.

> 🚧 **Em construção.** Este README descreve só o que já existe. O plano completo está em
> [docs/arquitetura.md](docs/arquitetura.md).

## Por que este projeto

Em 18/11/2026, o PNCP (Portal Nacional de Contratações Públicas) listava cerca de 2,7 mil
contratações de órgãos de Santa Catarina com proposta aberta. Os editais costumam ser longos: o
que usamos de teste tem 36 páginas. O Radar quer responder duas perguntas de uma pequena empresa:

1. **Quais dessas licitações combinam com o que eu vendo?**
2. **O que esse edital exige de mim, e onde isso está escrito?**

## O que já funciona

| Parte | Status |
|---|---|
| Repositório, regras de desenvolvimento e CI (lint, formatação, tipos, testes e build) | ✅ pronto |
| Coletor: conversão das datas da API para o horário de Brasília | ✅ pronto |
| Coletor: cliente da API do PNCP (paginação, nova tentativa e validação dos dados) | ✅ pronto |
| Coletor: gravação no banco com upsert (rodar duas vezes não duplica) | ✅ pronto |
| Coletor: coleta diária agendada (workflow pronto; aguarda o banco de produção) | 🚧 em construção |
| Banco: tabelas de contratações e de coletas, com RLS (público só lê), testadas no CI | ✅ pronto |
| Banco: aplicado no Supabase de produção | 📋 planejado |
| Site: busca "O que sua empresa vende?" | 📋 planejado |
| Site: análise do edital com IA, com citação da página | 📋 planejado |

## Estrutura

```
radar-licitacoes/
├─ coletor/   Python 3.14: busca os dados no PNCP e grava no banco
├─ supabase/  migrations do banco (tabelas e RLS)
├─ web/       Next.js 16: o site
├─ docs/      arquitetura, notas sobre a API do PNCP e decisões técnicas (ADRs)
└─ .github/   CI no GitHub Actions
```

## Como rodar

Pré-requisitos: [Python 3.14](https://www.python.org/) com [uv](https://docs.astral.sh/uv/) e
[Node.js 24](https://nodejs.org/).

### Coletor

```bash
cd coletor
uv sync               # cria o .venv e instala as versões travadas no uv.lock
uv run pytest         # testes
uv run ruff check .   # lint
uv run mypy           # checagem de tipos
```

Os testes de banco (marcados `integracao`) precisam de um Postgres de teste em
`TEST_DATABASE_URL`. Sem ele, são pulados; no CI, rodam sempre.

Para rodar uma coleta de verdade, copie `coletor/.env.example` para `coletor/.env`, preencha a
`DATABASE_URL` e rode:

```bash
uv run --env-file .env python -m radar_coletor
```

A coleta leva alguns minutos, porque espera 3 s entre as páginas para respeitar o limite de uso
da API ([ADR 0005](docs/decisoes/0005-respeitar-o-limite-de-uso-da-api.md)).

### Banco

As migrations ficam em `supabase/migrations/`. Para aplicar no Supabase:

```bash
npx supabase@3.2.0 db push --remote="<a mesma DATABASE_URL>"
```

### Site

```bash
cd web
npm ci                # instala as versões travadas no package-lock.json
npm run dev           # http://localhost:3000
```

## Documentação

- [Arquitetura](docs/arquitetura.md): como as partes se conectam, fluxos e modelo de dados.
- [API do PNCP](docs/api-pncp.md): o que descobrimos testando a API (parâmetros, limites e
  armadilhas).
- [Decisões técnicas (ADRs)](docs/decisoes/README.md): o que foi decidido, as alternativas e o
  porquê.

## Desenvolvimento com IA

Este projeto é desenvolvido com auxílio de IA (Claude Code), seguindo as regras de
[AGENTS.md](AGENTS.md): plano antes de código, testes e CI desde o primeiro commit, segredos fora
do Git e documentação atualizada junto com o código.

O [`.mcp.json`](.mcp.json) conecta o agente ao Supabase pelo
[MCP oficial](https://supabase.com/docs/guides/getting-started/mcp) em **modo somente leitura**:
ele consulta tabelas, logs e alertas, mas não altera nada. Mudanças no banco só entram por
migration em `supabase/migrations/`.

## Licença

[MIT](LICENSE).
