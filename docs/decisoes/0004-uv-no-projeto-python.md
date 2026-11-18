# 0004. uv para gerenciar o projeto Python

- Status: aceita
- Data: 2026-11-18

## Contexto

O coletor é desenvolvido no Windows e testado no Linux (CI). O ambiente precisa ser reproduzível:
o CI deve instalar exatamente as mesmas versões de bibliotecas que a máquina de desenvolvimento.

## Decisão

Usar o [uv](https://docs.astral.sh/uv/), com as dependências no `pyproject.toml` e as versões
exatas travadas no `uv.lock`. O CI instala com `uv sync --locked`, que falha se o lockfile estiver
desatualizado.

## Alternativas consideradas

- **pip, venv e requirements.txt.** São as ferramentas padrão, mas não travam as dependências das
  dependências sem ferramentas extras, e a manutenção é manual.
- **Poetry.** Também tem lockfile, mas é mais lento e pede mais configuração.

## Consequências

- Mais uma ferramenta para instalar (`pip install uv`).
- O `uv.lock` vai para o Git e é atualizado com `uv add` ou `uv lock`.
- Instalações rápidas no CI, com cache.
