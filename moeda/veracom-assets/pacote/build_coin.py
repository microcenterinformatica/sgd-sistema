#!/usr/bin/env python3
"""
Gera o vetor da moeda VERACOM (SGD) a partir do desenho a mao.
Saida: SVG mestre com texto convertido em paths (100% portavel).
"""
import math
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

FONT = "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"

# ---------- paleta ----------
OURO_CLARO = "#F7E9A0"
OURO       = "#E3C558"
OURO_ESC   = "#B8912F"
TINTA      = "#252A3D"   # azul-marinho quase preto (a caneta do desenho)
PRATA_CL   = "#D9DCE2"
PRATA      = "#AFB5BF"
PRATA_ESC  = "#7C838F"

CX = CY = 256.0

# ---------- texto -> path ----------
def texto_para_path(texto, tamanho, cx, cy, tracking=0.0):
    f = TTFont(FONT)
    upm = f["head"].unitsPerEm
    gs = f.getGlyphSet()
    cmap = f.getBestCmap()
    hmtx = f["hmtx"]
    esc = tamanho / upm

    larg = 0.0
    for ch in texto:
        larg += hmtx[cmap[ord(ch)]][0] * esc + tracking
    larg -= tracking

    x = cx - larg / 2.0
    partes = []
    for ch in texto:
        nome = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[nome].draw(pen)
        d = pen.getCommands()
        if d:
            partes.append(
                f'<path d="{d}" transform="translate({x:.2f},{cy:.2f}) '
                f'scale({esc:.6f},{-esc:.6f})"/>'
            )
        x += hmtx[nome][0] * esc + tracking
    return "\n      ".join(partes)

# ---------- arcos quebrados internos ----------
def arco(r, g1, g2):
    """arco no circulo r, de g1 a g2 graus (0=direita, cresce horario em SVG)"""
    x1 = CX + r * math.cos(math.radians(g1))
    y1 = CY + r * math.sin(math.radians(g1))
    x2 = CX + r * math.cos(math.radians(g2))
    y2 = CY + r * math.sin(math.radians(g2))
    grande = 1 if (g2 - g1) % 360 > 180 else 0
    return f"M {x1:.2f},{y1:.2f} A {r},{r} 0 {grande} 1 {x2:.2f},{y2:.2f}"

R_ARCO = 168
ARCOS = [
    arco(R_ARCO, 192, 258),   # superior esquerdo
    arco(R_ARCO, 282, 348),   # superior direito
    arco(R_ARCO,  12,  78),   # inferior direito
    arco(R_ARCO, 102, 168),   # inferior esquerdo
]

# ---------- o "V" serifado central ----------
V_PATH = (
    "M 96,166 L 216,166 L 194,196 "      # serifa esquerda
    "L 266,316 "                          # vertice interno
    "L 338,196 L 316,166 L 418,166 "      # serifa direita
    "L 400,196 L 259,430 L 118,196 Z"     # aresta externa direita/ponta/esquerda
)

# ---------- estrelas de 4 pontas (topo e base do aro) ----------
def estrela(cy_, altura=48, largura=26, miolo=17):
    return (f"M {CX},{cy_-altura} L {CX+miolo*0.42},{cy_-miolo*0.42} "
            f"L {CX+largura},{cy_} L {CX+miolo*0.42},{cy_+miolo*0.42} "
            f"L {CX},{cy_+altura} L {CX-miolo*0.42},{cy_+miolo*0.42} "
            f"L {CX-largura},{cy_} L {CX-miolo*0.42},{cy_-miolo*0.42} Z")

# ---------- faixa (banner) ----------
FAIXA_EXT = "M 32,228 L 480,228 L 500,251 L 500,295 L 480,318 L 32,318 L 12,295 L 12,251 Z"
FAIXA_INT = "M 40,237 L 476,237 L 492,255 L 492,291 L 476,309 L 40,309 L 20,291 L 20,255 Z"


def montar(com_texto=True):
    texto_svg = texto_para_path("VERACOM", 62, CX, 293, tracking=3.2) if com_texto else ""

    arcos_svg = "\n    ".join(
        f'<path d="{a}" fill="none" stroke="{TINTA}" stroke-width="15" stroke-linecap="round"/>'
        for a in ARCOS
    )

    faixa = ""
    if com_texto:
        faixa = f"""
    <!-- faixa prateada -->
    <path d="{FAIXA_EXT}" fill="url(#prata)" stroke="{OURO_ESC}" stroke-width="4"/>
    <path d="{FAIXA_INT}" fill="none" stroke="{OURO}" stroke-width="5"/>
    <g fill="url(#ouro)" stroke="{TINTA}" stroke-width="9" stroke-linejoin="round"
       paint-order="stroke fill">
      {texto_svg}
    </g>"""

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
     width="512" height="512" role="img" aria-label="Moeda Veracom">
  <title>Veracom</title>
  <defs>
    <linearGradient id="ouro" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0"    stop-color="{OURO_CLARO}"/>
      <stop offset="0.45" stop-color="{OURO}"/>
      <stop offset="1"    stop-color="{OURO_ESC}"/>
    </linearGradient>
    <linearGradient id="prata" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0"    stop-color="{PRATA_CL}"/>
      <stop offset="0.5"  stop-color="{PRATA}"/>
      <stop offset="1"    stop-color="{PRATA_ESC}"/>
    </linearGradient>
  </defs>

  <g stroke-linejoin="round">
    <!-- aro externo -->
    <circle cx="{CX}" cy="{CY}" r="207" fill="none"
            stroke="url(#ouro)" stroke-width="30"/>
    <circle cx="{CX}" cy="{CY}" r="222" fill="none" stroke="{TINTA}" stroke-width="4"/>
    <circle cx="{CX}" cy="{CY}" r="192" fill="none" stroke="{TINTA}" stroke-width="4"/>

    <!-- arcos internos quebrados -->
    {arcos_svg}

    <!-- V central -->
    <g transform="translate(256,292) scale(0.93) translate(-256,-292)">
      <path d="{V_PATH}" fill="url(#ouro)" stroke="{TINTA}" stroke-width="5.4"/>
    </g>

    <!-- estrelas do aro -->
    <path d="{estrela(41)}"  fill="url(#ouro)" stroke="{TINTA}" stroke-width="4"/>
    <path d="{estrela(471)}" fill="url(#ouro)" stroke="{TINTA}" stroke-width="4"/>
{faixa}
  </g>
</svg>
'''


if __name__ == "__main__":
    open("veracom-coin.svg", "w").write(montar(True))
    open("veracom-mark.svg", "w").write(montar(False))
    print("svg gerado")
