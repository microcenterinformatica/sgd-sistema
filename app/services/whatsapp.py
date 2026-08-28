from typing import Optional
from urllib.parse import quote


def limpar_numero(numero: Optional[str]) -> str:
    if not numero:
        return ""
    return "".join(filter(str.isdigit, numero))


def gerar_link_whatsapp(numero: Optional[str], mensagem: str) -> Optional[str]:
    numero_limpo = limpar_numero(numero)
    if not numero_limpo:
        return None

    # Evita duplicar o "55" se o responsável já cadastrou o número com DDI incluso
    tem_ddi = len(numero_limpo) in (12, 13) and numero_limpo.startswith("55")
    numero_completo = numero_limpo if tem_ddi else f"55{numero_limpo}"

    return f"https://wa.me/{numero_completo}?text={quote(mensagem)}"


def montar_mensagem_infracao(
    escola_nome: str,
    aluno_nome: str,
    descricao_infracao: str,
    peso: int,
    professor_nome: str,
    observacao: str,
    data_hora_str: str,
    pontos_atuais: int,
) -> str:
    return (
        f"🚨 *ALERTA DE INDISCIPLINA ESCOLAR* 🚨\n\n"
        f"Prezado(a) responsável por *{aluno_nome}*,\n\n"
        f"Informamos que o(a) aluno(a) registrou uma infração disciplinar em *{data_hora_str}*.\n\n"
        f"• *Infração:* {descricao_infracao}\n"
        f"• *Pontuação:* {peso} pontos\n"
        f"• *Professor(a):* {professor_nome}\n"
        f"• *Obs:* {observacao}\n\n"
        f"Sua atenção e acompanhamento são muito importantes para o desenvolvimento disciplinar de nosso(a) aluno(a).\n\n"
        f"*Pontuação Atual:* {pontos_atuais} pontos.\n\n"
        f"Atenciosamente,\n"
        f"{escola_nome}."
    )


def montar_mensagem_falta(
    escola_nome: str,
    aluno_nome: str,
    data_str: str,
    disciplinas: list[str],
) -> str:
    detalhe_disciplinas = f"\n• *Disciplina(s):* {', '.join(disciplinas)}" if disciplinas else ""
    return (
        f"📋 *AVISO DE FALTA* 📋\n\n"
        f"Prezado(a) responsável por *{aluno_nome}*,\n\n"
        f"Informamos que o(a) aluno(a) não compareceu à aula em *{data_str}*.{detalhe_disciplinas}\n\n"
        f"Caso a falta já tenha uma justificativa, favor desconsiderar esta mensagem.\n\n"
        f"Atenciosamente,\n"
        f"{escola_nome}."
    )


def montar_mensagem_merito(
    escola_nome: str,
    aluno_nome: str,
    pontos_bonus: int,
    professor_nome: str,
    observacao: str,
    data_hora_str: str,
    pontos_atuais: int,
) -> str:
    return (
        f"🌟 *NOTÍCIA EXCELENTE: MÉRITO DISCIPLINAR* 🌟\n\n"
        f"Prezado(a) responsável por *{aluno_nome}*,\n\n"
        f"Com alegria, informamos que o(a) aluno(a) foi reconhecido(a) com um *Ponto de Mérito* em *{data_hora_str}*!\n\n"
        f"• *Ação de Mérito:* {observacao}\n"
        f"• *Pontuação Bônus:* {pontos_bonus} pontos (redução na pontuação disciplinar)\n"
        f"• *Professor(a):* {professor_nome}\n\n"
        f"Esta atitude positiva demonstra seu compromisso com a disciplina e o bom ambiente escolar.\n\n"
        f"*Pontuação Atual:* {pontos_atuais} pontos (Parabéns!).\n\n"
        f"Agradecemos o seu apoio e acompanhamento no desenvolvimento de nosso(a) aluno(a).\n\n"
        f"Atenciosamente,\n"
        f"{escola_nome}."
    )
