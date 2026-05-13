// app/page.tsx — Homepage (Server Component)
import Link from 'next/link'
import { getLiveAuctions } from '@/lib/db'
import { AuctionCard } from '@/components/auction/AuctionCard'
import { Ticker } from '@/components/layout/Ticker'

export const revalidate = 60 // ISR: re-render every 60s

export default async function HomePage() {
  const featured = await getLiveAuctions()

  return (
    <main>
      {/* HERO */}
      <section className="hero">
        <div className="hero-left">
          <div className="hero-eyebrow">Live Auctions Now Open</div>
          <h1 className="hero-title">
            BID ON<br />
            <span className="accent">HEAVY</span><br />
            IRON
          </h1>
          <p className="hero-sub">
            The industrial marketplace for excavators, cranes, bulldozers,
            and heavy machinery. Trusted by 14,000+ buyers and dealers across
            North America.
          </p>
          <div className="hero-cta">
            <Link href="/auctions" className="btn-primary btn-lg">
              Browse Live Auctions
            </Link>
            <Link href="/dashboard/listings/new" className="btn-ghost btn-lg">
              List Your Equipment
            </Link>
          </div>

          <div className="hero-stats">
            <div className="stat">
              <div className="stat-num">2,847<span>+</span></div>
              <div className="stat-label">Active Listings</div>
            </div>
            <div className="stat">
              <div className="stat-num">$4.2<span>B</span></div>
              <div className="stat-label">Equipment Sold</div>
            </div>
            <div className="stat">
              <div className="stat-num">14<span>K</span></div>
              <div className="stat-label">Registered Buyers</div>
            </div>
          </div>
        </div>
        <div className="hero-right">
          {/* SVG machine illustration injected via CSS/bg */}
        </div>
      </section>

      {/* LIVE TICKER */}
      <Ticker />

      {/* CATEGORIES */}
      <section className="categories-section">
        <div className="section-header">
          <h2>Browse by <span>Category</span></h2>
          <Link href="/auctions" className="section-link">All Categories →</Link>
        </div>
        <div className="categories-grid">
          {CATEGORIES.map(cat => (
            <Link key={cat.slug} href={`/auctions?category=${cat.slug}`} className="cat-card">
              <span className="cat-icon">{cat.icon}</span>
              <div className="cat-name">{cat.name}</div>
              <div className="cat-count">{cat.count} listings</div>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED AUCTIONS */}
      <section className="featured-section">
        <div className="section-header">
          <h2>Featured <span>Auctions</span></h2>
          <Link href="/auctions" className="section-link">View All →</Link>
        </div>
        <div className="auctions-grid">
          {featured.map(({ auction, listing }) => (
            <AuctionCard
              key={auction.id}
              auction={auction}
              listing={listing}
            />
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-section">
        <div className="section-header">
          <h2>How <span>It Works</span></h2>
        </div>
        <div className="how-grid">
          {HOW_STEPS.map((step, i) => (
            <div key={i} className="how-card">
              <div className="how-num">0{i + 1}</div>
              <span className="how-icon">{step.icon}</span>
              <div className="how-title">{step.title}</div>
              <p className="how-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TRUST BANNER */}
      <section className="trust-section">
        <div className="trust-headline">Trusted by the Industry&apos;s Biggest Players</div>
        <div className="trust-stats">
          <div><div className="ts-num">99.2%</div><div className="ts-label">Transaction Success</div></div>
          <div><div className="ts-num">48hr</div><div className="ts-label">Avg Title Transfer</div></div>
          <div><div className="ts-num">$0</div><div className="ts-label">Listing Fee</div></div>
        </div>
        <Link href="/dashboard/listings/new" className="btn-primary btn-lg">
          Start Selling →
        </Link>
      </section>
    </main>
  )
}

const CATEGORIES = [
  { slug: 'excavator',  name: 'Excavators',   icon: '⛏️',  count: 847 },
  { slug: 'bulldozer',  name: 'Bulldozers',   icon: '🚜',  count: 312 },
  { slug: 'crane',      name: 'Cranes',       icon: '🏗️',  count: 204 },
  { slug: 'loader',     name: 'Loaders',      icon: '🔄',  count: 519 },
  { slug: 'truck',      name: 'Haul Trucks',  icon: '🚛',  count: 286 },
  { slug: 'aerial',     name: 'Aerial Work',  icon: '📡',  count: 378 },
]

const HOW_STEPS = [
  { icon: '📋', title: 'Register & Verify',  desc: 'Create your buyer account and complete identity and credit verification in under 10 minutes.' },
  { icon: '🔍', title: 'Browse & Inspect',   desc: 'Review detailed specs, photos, inspection reports, and condition grades. Request third-party inspections.' },
  { icon: '⚡', title: 'Bid Live or Auto',   desc: 'Place bids in real-time or set an autobid maximum. Get outbid alerts instantly via SMS and email.' },
  { icon: '🤝', title: 'Win & Transfer',     desc: 'Pay securely via ACH or wire. We handle title transfer documentation and coordinate logistics.' },
]
