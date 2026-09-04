const TAMANHOS = {
  sm: 16,
  md: 24,
  lg: 40,
} as const;

export function MoedaVeracom({
  size = "md",
  className,
}: {
  size?: keyof typeof TAMANHOS;
  className?: string;
}) {
  const px = TAMANHOS[size];
  return (
    <img
      src="/veracom/veracom-mark.svg"
      alt=""
      aria-hidden
      width={px}
      height={px}
      className={className}
    />
  );
}
