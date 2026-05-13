interface SellerSummary {
  companyName?: string
  firstName?: string
  lastName?: string
}

interface ListingDocumentLike {
  name: string
  url: string
  type: string
}

interface Props {
  description?: string | null
  inspectionData?: unknown
  documents: ListingDocumentLike[]
  reportUrl?: string | null
  seller?: SellerSummary | null
}

export function InspectionPanel({ description, inspectionData, documents, reportUrl, seller }: Props) {
  const sellerName = seller?.companyName ?? ([seller?.firstName, seller?.lastName].filter(Boolean).join(' ') || 'Private seller')
  const inspectionEntries = inspectionData && typeof inspectionData === 'object'
    ? Object.entries(inspectionData as Record<string, unknown>)
    : []

  return (
    <div className="inspection-panel">
      <section>
        <h2>Description</h2>
        <p>{description ?? 'No description provided.'}</p>
      </section>
      <section>
        <h2>Inspection</h2>
        {inspectionEntries.length > 0 ? (
          <div className="inspection-grid">
            {inspectionEntries.map(([key, value]) => (
              <div key={key} className="inspection-row">
                <span>{key}</span>
                <strong>{String(value)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p>No inspection data available.</p>
        )}
      </section>
      <section>
        <h2>Documents</h2>
        {documents.length > 0 ? (
          <ul>
            {documents.map(document => (
              <li key={document.url}>
                <a href={document.url}>{document.name}</a>
              </li>
            ))}
          </ul>
        ) : (
          <p>No documents attached.</p>
        )}
        {reportUrl ? <a href={reportUrl}>Inspection report</a> : null}
      </section>
      <section>
        <h2>Seller</h2>
        <p>{sellerName}</p>
      </section>
    </div>
  )
}
