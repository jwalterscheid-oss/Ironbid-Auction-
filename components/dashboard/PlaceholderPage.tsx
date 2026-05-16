import Link from 'next/link'

type Action = {
  href: string
  label: string
  variant?: 'primary' | 'ghost'
}

interface PlaceholderPageProps {
  title: string
  accent: string
  subtitle: string
  description: string
  actions?: Action[]
}

export function PlaceholderPage({
  title,
  accent,
  subtitle,
  description,
  actions = [],
}: PlaceholderPageProps) {
  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {title} <span>{accent}</span>
          </h1>
          <p className="page-sub">{subtitle}</p>
        </div>
      </div>

      <section className="section-card" style={{ padding: '18px' }}>
        <p style={{ color: 'var(--sand)', fontSize: '14px', maxWidth: '70ch' }}>{description}</p>
        {actions.length > 0 && (
          <div style={{ marginTop: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={action.variant === 'ghost' ? 'btn-ghost' : 'btn-primary'}
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
