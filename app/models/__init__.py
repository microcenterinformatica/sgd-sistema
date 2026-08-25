from app.models.escola import Escola
from app.models.usuario import Usuario, PapelUsuario
from app.models.aluno import Aluno
from app.models.regra_infracao import RegraInfracao
from app.models.punicao import Punicao
from app.models.professor import Professor
from app.models.registro_disciplinar import RegistroDisciplinar, TipoRegistro
from app.models.configuracao_recuperacao import ConfiguracaoRecuperacao

from app.models.disciplina import Disciplina
from app.models.turma import Turma
from app.models.atribuicao import Atribuicao
from app.models.atividade import Atividade, TipoAtividade
from app.models.categoria_atividade import CategoriaAtividade
from app.models.conteudo_aula import ConteudoAula
from app.models.lancamento import Lancamento
from app.models.registro_falta import RegistroFalta
from app.models.configuracao_periodo import ConfiguracaoPeriodo

__all__ = [
    "Escola",
    "Usuario",
    "PapelUsuario",
    "Aluno",
    "RegraInfracao",
    "Punicao",
    "Professor",
    "RegistroDisciplinar",
    "TipoRegistro",
    "ConfiguracaoRecuperacao",
    "Disciplina",
    "Turma",
    "Atribuicao",
    "Atividade",
    "TipoAtividade",
    "CategoriaAtividade",
    "ConteudoAula",
    "Lancamento",
    "RegistroFalta",
    "ConfiguracaoPeriodo",
]
