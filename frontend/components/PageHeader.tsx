import { ReactNode } from "react";

export function PageHeader({
  icon,
  title,
  subtitle,
  action,
  centered,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Centraliza título, subtítulo e ação em coluna, em vez do layout padrão lado a lado. */
  centered?: boolean;
}) {
  if (centered) {
    return (
      <div className="flex flex-col items-center text-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {icon && <span className="mr-2">{icon}</span>}
            {title}
          </h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          {icon && <span className="mr-2">{icon}</span>}
          {title}
        </h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
