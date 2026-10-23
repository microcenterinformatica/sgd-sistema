# Checklist de Desenvolvimento — SGE/SGD

Legenda: `[x]` feito · `[ ]` a fazer · `[~]` em andamento · 🚀 em produção · 💻 só local

---

## 🔧 Mudança atual

### Nota de Conduta automática — 23/10/2026
**Objetivo:** categoria de atividade cuja nota vem sozinha da conduta do aluno no trimestre.
**Regras:** começa em 10 a cada trimestre · indisciplina desconta, mérito devolve (máx. 10, mín. 0) · sem faltas/não entregas · cada professora cria a sua categoria e escolhe o peso
- [x] Combinar regra com o usuário
- [x] Backend (campo na categoria + migração `e5b8c2f7a9d3` cadeia notas + cálculo no boletim)
- [x] Frontend (opção em Gerenciar Categorias + nota com cadeado no boletim)
- [x] Testar local
- [x] Usuário revisar na tela
- [x] Commit
- [ ] Backup do banco de produção
- [ ] Migração em produção + conferir
- [ ] Push / deploy + conferir em produção

<!--
### <Nome da mudança> — <data>
**Objetivo:** <1 linha>
- [ ] Combinar regra/tela com o usuário
- [ ] Backend (modelo / migração / endpoint)
- [ ] Frontend (tela)
- [ ] Testar local
- [x] Commit
- [ ] Backup do banco de produção
- [ ] Migração em produção + conferir
- [ ] Push / deploy (Render + Vercel) + conferir em produção
-->

---

## ⏳ Pendente

- [ ] **Deploy da recuperação por dias de aula + bônus de bom comportamento** (commit `d270c84`, 2 migrações) 💻
- [~] **Indicadores locais (BI nativo)**: código não commitado na branch `feature/indicadores-locais` 💻
- [ ] Marcar turmas reais (1B, 2B, 5A) como Fundamental 1 ou 2 (checar faltas antes)
- [ ] Fix de código do `search_path` do pooler Neon (hoje resolvido só por configuração)
- [ ] Filtro de período no Ranking (bimestre/trimestre/ano)
- [ ] Telas de consulta de anos letivos anteriores
- [ ] Refatorar `turma` texto → `turma_id` (só se precisar das telas históricas)

---

## ✅ Já feito (resumo, de 24/08 a 22/10/2026)

**Base do sistema** 🚀
- [x] Backend FastAPI + PostgreSQL e frontend Next.js, multi-escola, com login e papéis
- [x] Disciplina e notas unificados em um só sistema
- [x] Hospedagem no Render + Neon + Vercel, com script de backup do banco
- [x] Instalável como app no celular/PC (PWA)
- [x] Nome da escola e da moeda de mérito configuráveis por escola
- [x] Ano letivo com histórico de turma e isolamento entre escolas

**Cadastros** 🚀
- [x] Turmas (com segmento Fundamental 1/2), alunos, professores, regras e condutas editáveis
- [x] Aluno com histórico não pode ser excluído; registros individuais podem

**Disciplina** 🚀
- [x] Registro de indisciplina/mérito com edição de data/hora (só admin/coordenação)
- [x] Mérito em lote para a turma
- [x] Recuperação automática de pontos configurável
- [x] Painel com alertas de conduta e faltas do dia
- [x] Professor só registra ocorrência nas suas turmas
- [x] Histórico Disciplinar ordenado por pontos, com opção de agrupar
- [x] Terminologia ajustada: "infração" → "indisciplina", "punição" → "conduta", SGD → SGE

**Patrimônio Disciplinar (Ranking)** 🚀
- [x] Fórmula justa (desconta faltas e não entregas), desempate compartilhado
- [x] Moeda Veracom: desenho, total, cotação em R$ configurável, visão por turma

**Notas e frequência** 🚀
- [x] Atividades com categorias, filtros e badge "Registrado"
- [x] Pendências de entrega por atividade
- [x] Chamada: falta única por dia no Fundamental 1 (exceto disciplina especialista)
- [x] Ajuste manual da nota final do trimestre

**Consultas e relatórios** 🚀
- [x] Consultas em abas: Conteúdo, Frequência, Atividades, Histórico, Boletim, visão do aluno
- [x] PDFs: relatório disciplinar (com WhatsApp do responsável), Patrimônio por turma,
      conteúdo lecionado, boletim anual em grade por trimestre
- [x] Exportação inicial para Excel (BI)

**Correções de tela**: menu mobile, rolagem horizontal, diálogos sobrepondo o X, botões no celular 🚀
