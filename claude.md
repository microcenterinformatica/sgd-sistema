# SGD - Sistema de Gestão da Disciplina Escolar
## Briefing de Modernização (Prototipo Python/JSON → Web Multiusuário)

---

## 1. Contexto do negócio

Sistema para controle disciplinar escolar: registro de infrações, méritos, cálculo de pontuação, punições progressivas e notificação de responsáveis via WhatsApp. Protótipo atual (`SGD-6.py`, testado inicialmente na Escola Barreto Coelho, Mococa) validou o conceito e as regras de negócio; agora vira produto profissional multi-tenant, para atender várias escolas diferentes como clientes independentes — não haverá migração dos dados do protótipo, o sistema novo nasce limpo.

**Requisitos confirmados com o cliente:**
- Acesso via internet, inclusive de casa/celular — portanto a solução será **web**, não mais desktop
- Deve suportar múltiplas escolas/clientes na mesma instalação (multi-tenant), com isolamento total de dados entre elas

---

## 2. Diagnóstico do protótipo atual

| Problema | Risco |
|---|---|
| Persistência em arquivo `dados_disciplina.json` único, reescrito por completo a cada ação | Sem concorrência: dois usuários simultâneos podem sobrescrever dados um do outro. Sem transações. Cresce sem limite. |
| ID de registro = índice/posição na lista (usado no Treeview) | Frágil — filtros/ordenações podem levar a editar/excluir o item errado |
| Sem autenticação/login | Qualquer pessoa com acesso ao PC vê e edita tudo |
| Nome da escola/prefeitura fixo no código-fonte | Impede reuso comercial para outro cliente sem reescrever código |
| Notificação via `web.whatsapp.com` no navegador desktop | Não funciona em servidor web / não é confiável para produção, mas é aceitável manter como link clicável no MVP |
| Tudo em um único arquivo `.py` de ~960 linhas, lógica e UI misturadas | Difícil manter, testar ou evoluir |

---

## 3. Arquitetura alvo

**Backend:** FastAPI (Python) + PostgreSQL + SQLModel (ou SQLAlchemy) + Alembic para migrações
**Frontend:** Next.js (React) + Tailwind CSS — responsivo (desktop e celular via navegador)
**Autenticação:** JWT, com papéis: `admin_escola`, `coordenacao`, `professor`
**Multi-tenancy:** toda entidade principal carrega `escola_id`, permitindo múltiplos clientes na mesma instalação
**Hospedagem sugerida:** Railway ou Render (API + banco), Vercel (frontend)
**Notificação WhatsApp:** manter geração de link `https://wa.me/55<numero>?text=<mensagem>` (grátis, já validado); migração para WhatsApp Business API fica como evolução futura (tem custo)

---

## 4. Modelo de dados (entidades principais)

```
Escola
- id, nome, cnpj (opcional), ativo

Usuario (login do sistema)
- id, escola_id, nome, email, senha_hash, papel [admin_escola|coordenacao|professor]

Aluno
- id, escola_id, nome, matricula (única por escola), whatsapp_responsavel,
  observacoes_condutas, controle_trabalhos_notas, pontos_atuais,
  data_ultima_infracao, data_ultima_recuperacao

RegraInfracao (catálogo)
- id, escola_id, descricao, peso, ativo

Punicao (catálogo, faixas de pontuação)
- id, escola_id, descricao, pontuacao_minima, ativo

Professor
- id, escola_id, nome, usuario_id (opcional, se também fizer login)

RegistroDisciplinar (substitui a lista "infracoes" embutida no aluno)
- id, aluno_id, tipo [infracao|merito], regra_id (nullable p/ mérito),
  descricao, peso, data_hora, observacao, professor_id, registrado_por_usuario_id

ConfiguracaoRecuperacao (por escola, hoje fixo em 7 dias / 2 pontos)
- escola_id, dias_para_recuperacao, pontos_recuperacao
```

**Por que separar `RegistroDisciplinar` do Aluno:** no protótipo, infrações ficam numa lista dentro do JSON do aluno. Numa tabela própria, ganhamos histórico auditável, consultas por período/professor/regra, e paginação — essencial quando o número de registros crescer.

---

## 5. Regras de negócio a preservar (extraídas do código atual)

- Infração soma `peso` aos pontos do aluno; mérito subtrai (nunca deixa pontos negativos)
- Punição aplicável = maior `pontuacao_minima` que o aluno atingiu (olhando o catálogo ordenado)
- Recuperação automática: se pontos > 0 e passaram ≥ 7 dias desde a última recuperação (ou desde sempre, se nunca recuperou), reduz até 2 pontos
- Ao registrar infração ou mérito, gerar mensagem formatada e link de WhatsApp para o responsável (se número cadastrado)
- Edição de registro disciplinar deve recalcular a pontuação do aluno corretamente (remove peso antigo, aplica peso novo)

---

## 6. Roadmap de execução sugerido (fases para o Claude Code)

**Fase 1 — Backend base**
- Modelagem das tabelas (SQLModel) + migrações Alembic
- Autenticação JWT + gestão de usuários/papéis
- Endpoints CRUD: Alunos, Regras, Punições, Professores
- Endpoint de registro de infração/mérito com recálculo de pontos
- Endpoint de recuperação automática (pode virar um cron/job)

**Fase 2 — Onboarding de escolas (multi-tenant desde o início)**
- Não há migração de dados do protótipo antigo — o sistema nasce limpo, pensado para atender várias escolas diferentes desde o primeiro dia
- Script/rotina de "cadastro de nova escola": cria o registro em `Escola`, cria o primeiro usuário `admin_escola` e catálogos padrão (regras, punições) que podem ser usados como ponto de partida e depois customizados por escola
- Cada escola só enxerga seus próprios dados (isolamento por `escola_id` em todas as consultas)

**Fase 3 — Frontend web**
- Login
- Tela de Alunos (cadastro/edição/lista com pontuação)
- Tela de Registrar Infração/Mérito
- Histórico de infrações (com filtro por aluno)
- Ranking de méritos
- Gestão de cadastros (Regras, Condutas, Professores) — apenas admin/coordenação

**Fase 4 — Deploy**
- Backend + banco no Railway/Render
- Frontend na Vercel
- Domínio e variáveis de ambiente

---

## 7. Como usar este briefing com o Claude Code

1. Crie a pasta do projeto localmente, ex: `sgd-web/`
2. Coloque este arquivo como `CLAUDE.md` na raiz do projeto (o Claude Code lê automaticamente a cada sessão)
3. Abra o terminal na pasta e rode `claude`
4. Comece pedindo a Fase 1 por partes, ex:
   > "Baseado no CLAUDE.md, crie a estrutura inicial do backend FastAPI com SQLModel: models de Escola, Usuario, Aluno, RegraInfracao, Punicao, Professor e RegistroDisciplinar, com Alembic configurado."
5. Revise e aprove cada mudança antes de seguir para a próxima parte (autenticação, depois endpoints de negócio, etc.)
