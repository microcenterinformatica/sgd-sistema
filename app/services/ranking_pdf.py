from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.tempo import para_horario_local
from app.models.escola import Escola
from app.schemas.ranking import RankingItem

CAMINHO_MOEDA = (
    Path(__file__).resolve().parent.parent.parent / "moeda" / "veracom-assets" / "pacote" / "png" / "veracom-coin-256.png"
)

COR_OURO = colors.HexColor("#D4AF37")
COR_PRATA = colors.HexColor("#9CA3AF")
COR_BRONZE = colors.HexColor("#CD7F32")
COR_NEUTRA = colors.HexColor("#1e293b")

CORES_POSICAO = {1: COR_OURO, 2: COR_PRATA, 3: COR_BRONZE}


def _tamanho_ajustado(texto: str, fonte: str, largura_maxima: float, tamanho_maximo: float, tamanho_minimo: float) -> float:
    """Maior tamanho de fonte (até tamanho_maximo) que cabe numa única linha dentro de largura_maxima."""
    tamanho = tamanho_maximo
    while tamanho > tamanho_minimo and stringWidth(texto, fonte, tamanho) > largura_maxima:
        tamanho -= 0.5
    return tamanho


def gerar_pdf_ranking_turma(
    escola: Escola,
    turma: str,
    itens: list[tuple[RankingItem, int]],
    top: Optional[int],
) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=1.5 * cm,
        bottomMargin=2 * cm,
        leftMargin=2.5 * cm,
        rightMargin=2.5 * cm,
    )
    estilos = getSampleStyleSheet()
    titulo = ParagraphStyle(
        "Titulo", parent=estilos["Heading1"], fontSize=15, textColor=COR_NEUTRA, alignment=1, spaceAfter=2
    )

    elementos = []

    if CAMINHO_MOEDA.exists():
        moeda = Image(str(CAMINHO_MOEDA), width=3 * cm, height=3 * cm)
        moeda.hAlign = "CENTER"
        elementos.append(moeda)

    if top is None:
        frase = f"Desempenho em disciplina da Turma {turma}"
        destaque_legenda = "Todos os alunos"
    else:
        frase = f"Parabéns aos destaques em disciplina da Turma {turma}"
        destaque_legenda = f"Top {top}"

    # doc.width é a largura crua do frame; o SimpleDocTemplate usa um Frame com
    # 6pt de padding de cada lado por padrão, então a largura útil real é menor.
    largura_util = doc.width - 12
    tamanho_frase = _tamanho_ajustado(frase, "Helvetica-Bold", largura_util, tamanho_maximo=19, tamanho_minimo=11)
    destaque = ParagraphStyle(
        "Destaque",
        parent=estilos["Normal"],
        fontSize=tamanho_frase,
        leading=tamanho_frase * 1.2,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#b45309"),
        alignment=1,
        spaceBefore=8,
        spaceAfter=2,
    )
    legenda_maiuscula = destaque_legenda.upper()
    tamanho_legenda = _tamanho_ajustado(
        legenda_maiuscula, "Helvetica-Bold", largura_util, tamanho_maximo=18, tamanho_minimo=13
    )
    legenda = ParagraphStyle(
        "Legenda",
        parent=estilos["Normal"],
        fontSize=tamanho_legenda,
        leading=tamanho_legenda * 1.15,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#b45309"),
        alignment=1,
    )

    elementos += [
        Spacer(1, 0.3 * cm),
        Paragraph(escola.nome, titulo),
        Paragraph(frase, destaque),
        Spacer(1, 0.3 * cm),
        Paragraph(legenda_maiuscula, legenda),
        Spacer(1, 0.4 * cm),
    ]

    if not itens:
        elementos.append(Paragraph("Nenhum aluno encontrado nessa turma.", estilos["Normal"]))
    else:
        linhas = [["Pos.", "Aluno", "Veracom"]]
        for item, posicao in itens:
            linhas.append([f"{posicao}º", item.aluno_nome, f"{item.pontuacao:g}"])

        tabela = Table(linhas, colWidths=[2 * cm, 10.5 * cm, 3 * cm], repeatRows=1)
        estilo_tabela = [
            ("BACKGROUND", (0, 0), (-1, 0), COR_NEUTRA),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 10),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (2, 0), (2, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("FONTSIZE", (0, 1), (-1, -1), 11),
            ("TOPPADDING", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ("LEFTPADDING", (1, 0), (1, -1), 10),
        ]

        for linha, (item, posicao) in enumerate(itens, start=1):
            cor_medalha = CORES_POSICAO.get(posicao)
            if cor_medalha is not None:
                estilo_tabela += [
                    ("BACKGROUND", (0, linha), (0, linha), cor_medalha),
                    ("TEXTCOLOR", (0, linha), (0, linha), colors.white),
                    ("FONTNAME", (0, linha), (0, linha), "Helvetica-Bold"),
                    ("FONTSIZE", (0, linha), (0, linha), 13),
                    ("FONTNAME", (1, linha), (1, linha), "Helvetica-Bold"),
                    ("FONTSIZE", (1, linha), (1, linha), 12),
                ]
            estilo_tabela += [
                ("TEXTCOLOR", (2, linha), (2, linha), colors.HexColor("#b45309")),
                ("FONTNAME", (2, linha), (2, linha), "Helvetica-Bold"),
                ("FONTSIZE", (2, linha), (2, linha), 12),
            ]

        tabela.setStyle(TableStyle(estilo_tabela))
        elementos.append(tabela)

    elementos.append(Spacer(1, 0.6 * cm))
    rodape = f"Relatório gerado em {para_horario_local(datetime.now(timezone.utc)).strftime('%d/%m/%Y %H:%M')}."
    elementos.append(
        Paragraph(
            rodape,
            ParagraphStyle("Rodape", parent=estilos["Normal"], fontSize=8, textColor=colors.HexColor("#888888")),
        )
    )

    doc.build(elementos)
    return buffer.getvalue()
