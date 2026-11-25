export default function PageHeader({ title, subtitle, extra, eyebrow }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {extra && <div className="page-header-extra">{extra}</div>}
    </div>
  )
}
