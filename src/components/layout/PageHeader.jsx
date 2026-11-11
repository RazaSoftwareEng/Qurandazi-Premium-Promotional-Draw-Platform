/** Page title block for dashboard pages. */
export default function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/** Hero banner for public inner pages. */
export function PublicHero({ eyebrow, title, subtitle, children }) {
  return (
    <section className="relative overflow-hidden bg-navy-900 text-white">
      <div className="pattern-stars pointer-events-none absolute inset-0" aria-hidden />
      <div className="container-page relative py-16 sm:py-20">
        {eyebrow && (
          <p className="eyebrow-dark">
            <span className="gold-rule" /> {eyebrow}
          </p>
        )}
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.08] text-white sm:text-6xl">{title}</h1>
        {subtitle && <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">{subtitle}</p>}
        {children}
      </div>
      <div className="hairline-gold" />
    </section>
  )
}
