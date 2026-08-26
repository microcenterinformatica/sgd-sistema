export type Papel = "admin_escola" | "coordenacao" | "professor";

export interface Usuario {
  id: number;
  escola_id: number;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
}

export interface Aluno {
  id: number;
  escola_id: number;
  nome: string;
  matricula: string;
  turma: string | null;
  numero_chamada: number | null;
  whatsapp_responsavel: string | null;
  observacoes_condutas: string | null;
  pontos_atuais: number;
  data_ultima_infracao: string | null;
  data_ultima_recuperacao: string | null;
}

export interface RegraInfracao {
  id: number;
  escola_id: number;
  descricao: string;
  peso: number;
  ativo: boolean;
}

export interface Punicao {
  id: number;
  escola_id: number;
  descricao: string;
  pontuacao_minima: number;
  ativo: boolean;
}

export interface Professor {
  id: number;
  escola_id: number;
  nome: string;
  usuario_id: number | null;
}

export type TipoRegistro = "infracao" | "merito";

export interface RegistroDisciplinar {
  id: number;
  aluno_id: number;
  tipo: TipoRegistro;
  regra_id: number | null;
  descricao: string;
  peso: number;
  data_hora: string;
  observacao: string | null;
  professor_id: number | null;
  registrado_por_usuario_id: number;
  professor_nome: string | null;
}

export interface RegistroDisciplinarResponse {
  registro: RegistroDisciplinar;
  pontos_atuais: number;
  whatsapp_link: string | null;
}

export type TipoAtividade = "prova" | "atividade";

export interface Atividade {
  id: number;
  escola_id: number;
  professor_id: number | null;
  disciplina_id: number;
  turma: string | null;
  titulo: string;
  tipo: TipoAtividade;
  categoria_id: number;
  categoria_nome: string;
  categoria_peso: number;
  data: string;
  data_entrega: string | null;
  ativo: boolean;
}

export interface CategoriaAtividade {
  id: number;
  disciplina_id: number;
  nome: string;
  peso: number;
  ativo: boolean;
}

export interface Disciplina {
  id: number;
  escola_id: number;
  nome: string;
  ativo: boolean;
}

export type SegmentoTurma = "fundamental_1" | "fundamental_2";

export interface Turma {
  id: number;
  escola_id: number;
  nome: string;
  ativo: boolean;
  segmento: SegmentoTurma;
}

export interface ProfessorResumo {
  id: number;
  nome: string;
}

export interface AtribuicaoRead {
  id: number;
  professor_id: number;
  professor_nome: string;
  disciplina_id: number;
  disciplina_nome: string;
  turma: string;
}

export interface TurmaDisciplinaPermitida {
  turma: string;
  disciplina_id: number;
  disciplina_nome: string;
}

export interface MinhasAtribuicoesRead {
  acesso_total: boolean;
  combinacoes: TurmaDisciplinaPermitida[];
}

export interface AlunoResumo {
  id: number;
  nome: string;
  matricula: string;
  turma: string | null;
  numero_chamada: number | null;
}

export interface LancamentoItem {
  aluno_id: number;
  nota?: number | null;
  fez?: boolean | null;
  entregue_em?: string | null;
  observacao?: string | null;
}

export interface FaltaResumoItem {
  aluno_id: number;
  aluno_nome: string;
  total_faltas: number;
}

export interface FaltaRead {
  id: number;
  aluno_id: number;
  disciplina_id: number | null;
  data: string;
  justificada: boolean;
  observacao: string | null;
}

export interface ChamadaAlunoStatus {
  aluno_id: number;
  aluno_nome: string;
  matricula: string;
  numero_chamada: number | null;
  ausente: boolean;
  justificada: boolean;
  observacao: string | null;
}

export interface ChamadaRead {
  turma: string;
  disciplina_id: number;
  data: string;
  conteudo: string | null;
  alunos: ChamadaAlunoStatus[];
}

export interface ConteudoAulaRead {
  id: number;
  turma: string;
  disciplina_id: number;
  data: string;
  conteudo: string;
}

export interface AtividadeResumoItem {
  aluno_id: number;
  aluno_nome: string;
  total_atividades: number;
  total_fez: number;
  percentual: number;
}

export interface LancamentoRead {
  id: number;
  atividade_id: number;
  aluno_id: number;
  nota: number | null;
  fez: boolean | null;
  entregue_em: string | null;
  no_prazo: boolean | null;
  observacao: string | null;
  aluno_nome: string | null;
}

export interface ConfiguracaoPeriodo {
  trimestre1_inicio: string | null;
  trimestre1_fim: string | null;
  trimestre2_inicio: string | null;
  trimestre2_fim: string | null;
  trimestre3_inicio: string | null;
  trimestre3_fim: string | null;
}

export interface BoletimGrupoPeso {
  categoria: string;
  peso: number;
  quantidade_atividades: number;
  media: number;
  pontos: number;
}

export interface BoletimAluno {
  aluno_id: number;
  aluno_nome: string;
  grupos: BoletimGrupoPeso[];
  peso_total: number;
  nota_calculada: number;
  nota_final: number;
  nota_ajustada: number | null;
  ajuste_motivo: string | null;
  ajuste_id: number | null;
  total_faltas: number;
  faltas_justificadas: number;
}

export interface BoletimTrimestre {
  trimestre: number;
  data_inicio: string | null;
  data_fim: string | null;
  grupos: BoletimGrupoPeso[];
  peso_total: number;
  nota_calculada: number;
  nota_final: number;
  nota_ajustada: number | null;
  ajuste_motivo: string | null;
  ajuste_id: number | null;
  total_faltas: number;
  faltas_justificadas: number;
}

export interface BoletimDisciplinaAnual {
  disciplina_id: number;
  disciplina_nome: string;
  trimestres: BoletimTrimestre[];
  media_final: number;
  aprovado: boolean;
  total_faltas: number;
}

export interface BoletimAnualAluno {
  aluno_id: number;
  aluno_nome: string;
  disciplinas: BoletimDisciplinaAnual[];
}

export interface LancamentoAlunoRead {
  id: number;
  atividade_id: number;
  atividade_titulo: string;
  atividade_tipo: TipoAtividade;
  atividade_turma: string | null;
  disciplina_id: number;
  disciplina_nome: string;
  atividade_data: string;
  atividade_data_entrega: string | null;
  nota: number | null;
  fez: boolean | null;
  entregue_em: string | null;
  no_prazo: boolean | null;
  observacao: string | null;
}
