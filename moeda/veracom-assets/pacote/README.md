# Moeda Veracom — Pacote de Assets (SGD)

Vetorização do desenho original da moeda Veracom, moeda virtual do
Sistema de Gestão da Disciplina Escolar (SGD).

---

## Arquivos

### `svg/` — vetores (fonte da verdade)

| Arquivo | Uso |
|---|---|
| `veracom-coin.svg` | Versão completa, com a faixa "VERACOM". Usar de 128px para cima. |
| `veracom-mark.svg` | Só o símbolo (aro + V + estrelas), sem texto. Usar abaixo de 128px. |

Ambos: `viewBox="0 0 512 512"`, fundo transparente, texto já convertido em
paths (não depende de fonte instalada), sem dependência externa.

### `png/` — rasterizados, fundo transparente

| Arquivo | Onde usar |
|---|---|
| `veracom-coin-1024.png` | Impressão, banner, tela de recompensa |
| `veracom-coin-512.png` | Cartão de saldo, tela "Minha Carteira" |
| `veracom-coin-256.png` | Card de extrato, modal de transação |
| `veracom-coin-128.png` | Item de lista |
| `veracom-mark-128/64/48.png` | Ícone ao lado do saldo, badge, chip |
| `veracom-mark-32.png` | Ícone inline no texto ("50 🪙") |
| `favicon.ico` | Aba do navegador |

---

## Tokens de cor

```css
:root {
  --veracom-ouro-claro: #F7E9A0;
  --veracom-ouro:       #E3C558;
  --veracom-ouro-esc:   #B8912F;
  --veracom-tinta:      #252A3D;
  --veracom-prata-claro:#D9DCE2;
  --veracom-prata:      #AFB5BF;
  --veracom-prata-esc:  #7C838F;
}
```

Gradiente de ouro (usado no aro, no V e nas letras):
`linear-gradient(160deg, #F7E9A0 0%, #E3C558 45%, #B8912F 100%)`

---

## Onde colocar no projeto

```
sgd/
└── src/
    └── assets/
        └── veracom/
            ├── veracom-coin.svg
            ├── veracom-mark.svg
            └── png/
                └── ...
```

---

## Uso

### HTML
```html
<img src="/assets/veracom/veracom-coin.svg"
     alt="Moeda Veracom" width="64" height="64">
```

### React — componente de saldo
```jsx
import moeda from "@/assets/veracom/veracom-mark.svg";

export function SaldoVeracom({ saldo }) {
  return (
    <span className="flex items-center gap-2">
      <img src={moeda} alt="" width={24} height={24} aria-hidden />
      <strong>{saldo}</strong>
      <span className="sr-only">Veracoms</span>
    </span>
  );
}
```

### Inline (permite recolorir por CSS)
Copiar o conteúdo de `veracom-mark.svg` direto no JSX. Trocar
`fill="url(#ouro)"` por `fill="currentColor"` para versão monocromática.

---

## Regras de aplicação

- **Área de respiro:** manter livre, ao redor, o equivalente a 10% da
  largura da moeda.
- **Tamanho mínimo:** 128px para a versão com texto; 24px para a versão mark.
- **Não fazer:** distorcer proporção, girar, trocar a paleta, aplicar sombra
  dura, colocar sobre fundo amarelo ou cinza médio (o contraste some).
- **Fundos recomendados:** branco, `#F5F5F7`, ou escuro `#1A1D2A`.
- **Acessibilidade:** quando a moeda for decorativa ao lado de um número,
  usar `alt=""` + `aria-hidden` e deixar o texto acessível separado.

---

## Regenerar / alterar

O SVG é gerado pelo script `build_coin.py`. Para mudar cores, edite as
constantes no topo (`OURO`, `TINTA`, `PRATA`...) e rode:

```bash
pip install cairosvg fonttools
python3 build_coin.py
```

---

## Prompt sugerido para o Claude Code

> Adicione a moeda Veracom ao SGD. Os assets estão em
> `src/assets/veracom/`. Crie um componente `<MoedaVeracom size="sm|md|lg" />`
> que usa `veracom-mark.svg` em sm/md e `veracom-coin.svg` em lg. Adicione os
> tokens de cor do README ao tema. Use a moeda em: card de saldo do aluno,
> linhas do extrato de transações, e no toast de "Veracoms recebidos".
