const CHAVE = "sgd_notas_ultima_turma";

export function lerUltimaTurma(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CHAVE);
}

export function salvarUltimaTurma(turma: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAVE, turma);
}

export function escolherTurmaInicial(lista: string[]): string {
  const ultima = lerUltimaTurma();
  if (ultima && lista.includes(ultima)) return ultima;
  return lista[0] ?? "";
}

const CHAVE_DISCIPLINA = "sgd_notas_ultima_disciplina";

export function lerUltimaDisciplina(): number | null {
  if (typeof window === "undefined") return null;
  const valor = localStorage.getItem(CHAVE_DISCIPLINA);
  return valor ? Number(valor) : null;
}

export function salvarUltimaDisciplina(disciplinaId: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAVE_DISCIPLINA, String(disciplinaId));
}

export function escolherDisciplinaInicial(disciplinaIds: number[]): number | "" {
  const ultima = lerUltimaDisciplina();
  if (ultima && disciplinaIds.includes(ultima)) return ultima;
  return disciplinaIds[0] ?? "";
}
