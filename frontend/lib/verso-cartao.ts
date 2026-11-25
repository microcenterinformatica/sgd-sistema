// Conteúdo do verso do cartão com a equipe da escola. Cada lista vale só para a
// escola e a turma indicadas; as demais turmas usam o verso padrão.

export interface LinhaEquipe {
  /** Cada item é uma linha do rótulo. */
  funcao: string[];
  nomes: string[];
}

export interface VersoEquipe {
  escola: string;
  frase: string;
  logo: string;
  equipe: LinhaEquipe[];
}

interface VersoDaTurma extends VersoEquipe {
  escolaContem: string;
  turma: RegExp;
}

const VERSOS: VersoDaTurma[] = [
  {
    escolaContem: "vera sandoval",
    // "5A", "5º A", "5º ano A"
    turma: /^5\s*[ºo°]?\s*(ano)?\s*A$/i,
    escola: "EMEB “Professora Vera Sandoval Meirelles”",
    frase: "Com boas atitudes, todos ganham.",
    logo: "/logo-prefeitura-mococa.png",
    equipe: [
      { funcao: ["Direção"], nomes: ["Bruno Araújo Dzielinski"] },
      { funcao: ["Coordenação"], nomes: ["José Guilherme V. dos S. de Carvalho"] },
      { funcao: ["Professora"], nomes: ["Márcia Angelita de Lima Toscano Guerra"] },
      {
        funcao: ["Professores", "especialistas"],
        nomes: [
          "Ana Paula Ferreira Weurthmamm",
          "Áurea Maria Rezende Moreira",
          "Clovis Eduardo Magri",
          "Daniel Teodoro de Melo",
        ],
      },
    ],
  },
];

export function versoDaTurma(escolaNome: string, turma: string): VersoEquipe | null {
  const escola = escolaNome.toLowerCase();
  return VERSOS.find((v) => escola.includes(v.escolaContem) && v.turma.test(turma.trim())) ?? null;
}
