const TAMANHOS = {
  sm: 16,
  md: 24,
  lg: 40,
} as const;

export function MoedaVeracom({
  size = "md",
  variant = "mark",
  className,
}: {
  size?: keyof typeof TAMANHOS;
  /** "mark" = só o símbolo (ícones inline); "coin" = medalhão completo com a faixa "VERACOM" (destaque, telas grandes). */
  variant?: "mark" | "coin";
  className?: string;
}) {
  const px = TAMANHOS[size];
  return (
    <img
      src={`/veracom/veracom-${variant}.svg`}
      alt=""
      aria-hidden
      width={px}
      height={px}
      className={className}
    />
  );
}
