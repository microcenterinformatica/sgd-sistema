# Checklist de Desenvolvimento — SGE/SGD

Legenda: `[x]` feito · `[ ]` a fazer · `[~]` em andamento · 🚀 em produção · 💻 só local

---

## 🔧 Mudança atual

### Cartão Veracom com QR + Caixa da Feirinha — 22/11/2026
**Objetivo:** cartão impresso com QR por aluno; caixa no celular debita do saldo (= Patrimônio Disciplinar − gastos). Ref: `docs/mudancas.md`
- [x] Combinar regra/tela com o usuário (sem trocar nome/logo da moeda, sem foto; ranking intocado)
- [x] Backend (cartao_aluno + transacao_veracoin, linhagem `alembic/`, endpoints)
- [x] Testes pytest (banco local `sgd_test`, 14 ok)
- [x] Frontend (/feirinha/caixa, /feirinha/resumo, /cartoes, /cartoes/imprimir)
- [x] Extra pedido no teste: Consulta de Saldo + extrato (tela própria + atalho no caixa)
- [x] Menu lateral "Banco" com submenus Caixa, Consulta de Saldo e Cartões
- [x] Testar local (usuário aprovou)
- [x] Commit (sem misturar arquivos dos Indicadores)
- [ ] Backup do banco de produção
- [ ] Migração em produção + conferir
- [ ] Push / deploy (Render + Vercel) + conferir em produção (câmera exige HTTPS)

<!--
### <Nome da mudança> — <data>
**Objetivo:** <1 linha>
- [ ] Combinar regra/tela com o usuário
- [ ] Backend (modelo / migração / endpoint)
- [ ] Frontend (tela)
- [ ] Testar local
- [ ] Commit
- [ ] Backup do banco de produção
- [ ] Migração em produção + conferir
- [ ] Push / deploy (Render + Vercel) + conferir em produção
-->

---

## ⏳ Pendente

- [~] **Indicadores locais (BI nativo)**: código não commitado na branch `feature/indicadores-locais` 💻
- [ ] Marcar turmas reais (1B, 2B, 5A) como Fundamental 1 ou 2 (checar faltas antes)
- [ ] Fix de código do `search_path` do pooler Neon (hoje resolvido só por configuração)
- [ ] Filtro de período no Ranking (bimestre/trimestre/ano)
- [ ] Telas de consulta de anos letivos anteriores
- [ ] Refatorar `turma` texto → `turma_id` (só se precisar das telas históricas)

---

## ✅ Já feito (resumo, de 24/08 a 23/10/2026)

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
- [x] Recuperação automática conta dias de aula + bônus de bom comportamento
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
- [x] **Nota de Conduta automática** (23/10): categoria que começa em 10 por trimestre e desconta pela indisciplina

**Consultas e relatórios** 🚀
- [x] Consultas em abas: Conteúdo, Frequência, Atividades, Histórico, Boletim, visão do aluno
- [x] PDFs: relatório disciplinar (com WhatsApp do responsável), Patrimônio por turma,
      conteúdo lecionado, boletim anual em grade por trimestre
- [x] Exportação inicial para Excel (BI)

**Correções de tela**: menu mobile, rolagem horizontal, diálogos sobrepondo o X, botões no celular 🚀
