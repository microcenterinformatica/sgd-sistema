from dataclasses import dataclass
from datetime import date, datetime
from io import BytesIO
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.aluno import Aluno
from app.models.escola import Escola

ROTULO_TIPO_EVENTO = {
    "infracao": "Conduta Indisciplinar",
    "merito": "Mérito",
    "falta": "Falta",
    "nao_entrega": "Não entregue",
}

COR_TIPO_EVENTO = {
    "infracao": colors.HexColor("#b91c1c"),
    "merito": colors.HexColor("#047857"),
    "falta": colors.HexColor("#b45309"),
    "nao_entrega": colors.HexColor("#c2410c"),
}


@dataclass
class EventoRelatorio:
    data: date | datetime
    tipo: str
    descricao: str
    peso: Optional[int] = None
    professor_nome: Optional[str] = None
    observacao: Optional[str] = None


def _formatar_data(valor: date | datetime) -> str:
    if isinstance(valor, datetime):
        return valor.strftime("%d/%m/%Y<br/>%H:%M")
    return valor.strftime("%d/%m/%Y")


def gerar_pdf_historico_aluno(
    escola: Escola,
    aluno: Aluno,
    eventos: list[EventoRelatorio],
    periodo_inicio: date,
    periodo_fim: date,
    situacao: str,
) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
    )
    estilos = getSampleStyleSheet()
    titulo = ParagraphStyle("Titulo", parent=estilos["Heading1"], fontSize=16, spaceAfter=2)
    subtitulo = ParagraphStyle(
        "Subtitulo", parent=estilos["Normal"], fontSize=11, textColor=colors.HexColor("#555555")
    )
    label = ParagraphStyle("Label", parent=estilos["Normal"], fontSize=10, leading=15)
    celula = ParagraphStyle("Celula", parent=estilos["Normal"], fontSize=9, leading=12)

    elementos = [
        Paragraph(escola.nome, titulo),
        Paragraph("Relatório Disciplinar do Aluno", subtitulo),
        Spacer(1, 0.5 * cm),
    ]

    info = (
        f"<b>Aluno:</b> {aluno.nome} &nbsp;&nbsp; <b>Matrícula:</b> {aluno.matricula}"
        f"{f' &nbsp;&nbsp; <b>Turma:</b> {aluno.turma}' if aluno.turma else ''}<br/>"
        f"<b>Período:</b> {periodo_inicio.strftime('%d/%m/%Y')} a {periodo_fim.strftime('%d/%m/%Y')}<br/>"
        f"<b>Pontuação disciplinar atual:</b> {aluno.pontos_atuais} pontos &nbsp;&nbsp; "
        f"<b>Situação:</b> {situacao}"
    )
    elementos.append(Paragraph(info, label))
    elementos.append(Spacer(1, 0.6 * cm))

    if not eventos:
        elementos.append(Paragraph("Nenhuma ocorrência registrada no período.", estilos["Normal"]))
    else:
        linhas = [["Data", "Tipo", "Descrição", "Pontos", "Professor(a) / Observação"]]
        for evento in eventos:
            detalhe = evento.professor_nome or ""
            if evento.observacao:
                detalhe = f"{detalhe} — {evento.observacao}" if detalhe else evento.observacao
            pontos = "—" if evento.peso is None else (f"+{evento.peso}" if evento.peso >= 0 else str(evento.peso))
            linhas.append(
                [
                    Paragraph(_formatar_data(evento.data), celula),
                    Paragraph(ROTULO_TIPO_EVENTO[evento.tipo], celula),
                    Paragraph(evento.descricao, celula),
                    pontos,
                    Paragraph(detalhe, celula),
                ]
            )

        tabela = Table(
            linhas,
            colWidths=[2.1 * cm, 2.6 * cm, 4.9 * cm, 1.6 * cm, 5.6 * cm],
            repeatRows=1,
        )
        estilo_tabela = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]
        for i, evento in enumerate(eventos, start=1):
            estilo_tabela.append(("TEXTCOLOR", (3, i), (3, i), COR_TIPO_EVENTO[evento.tipo]))
            estilo_tabela.append(("FONTNAME", (3, i), (3, i), "Helvetica-Bold"))
        tabela.setStyle(TableStyle(estilo_tabela))
        elementos.append(tabela)

    elementos.append(Spacer(1, 0.8 * cm))
    rodape = f"Relatório gerado em {datetime.now().strftime('%d/%m/%Y %H:%M')}."
    elementos.append(
        Paragraph(
            rodape,
            ParagraphStyle("Rodape", parent=estilos["Normal"], fontSize=8, textColor=colors.HexColor("#888888")),
        )
    )

    doc.build(elementos)
    return buffer.getvalue()
