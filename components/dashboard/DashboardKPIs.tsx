// components/dashboard/DashboardKPIs.tsx
interface Props {
  ytdRevenue:    number
  activeListings: number
  soldItems:     number
  avgSellPrice:  number
}

export function DashboardKPIs({ ytdRevenue, activeListings, soldItems, avgSellPrice }: Props) {
  return (
    <div className="kpi-grid">
      <div className="kpi">
        <div className="kpi-label">Total Revenue (YTD)</div>
        <div className="kpi-val">${ytdRevenue >= 1000000
          ? `${(ytdRevenue / 1000000).toFixed(1)}M`
          : ytdRevenue >= 1000
          ? `${(ytdRevenue / 1000).toFixed(0)}K`
          : ytdRevenue.toLocaleString()
        }</div>
        <div className="kpi-ghost">$</div>
      </div>
      <div className="kpi kpi-amber">
        <div className="kpi-label">Active Listings</div>
        <div className="kpi-val">{activeListings}</div>
        <div className="kpi-ghost">📋</div>
      </div>
      <div className="kpi kpi-green">
        <div className="kpi-label">Items Sold (YTD)</div>
        <div className="kpi-val">{soldItems}</div>
        <div className="kpi-ghost">✓</div>
      </div>
      <div className="kpi kpi-blue">
        <div className="kpi-label">Avg Sell Price</div>
        <div className="kpi-val">${avgSellPrice >= 1000
          ? `${(avgSellPrice / 1000).toFixed(0)}K`
          : avgSellPrice.toLocaleString()
        }</div>
        <div className="kpi-ghost">~</div>
      </div>
    </div>
  )
}
