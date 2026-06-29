interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function ModuleHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="flex items-center gap-4 px-8 py-5 bg-white border-b border-border flex-shrink-0">
      <div>
        <h1 className="font-spectral text-[23px] font-semibold text-text-primary leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="ml-auto flex items-center gap-3">{actions}</div>}
    </header>
  );
}
