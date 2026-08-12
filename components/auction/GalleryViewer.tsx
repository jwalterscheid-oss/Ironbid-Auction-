'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Photo {
  url: string
  order: number
  caption?: string
}

export function GalleryViewer({ photos }: { photos: Photo[] }) {
  const sorted = [...photos].sort((left, right) => left.order - right.order)
  const [index, setIndex] = useState(0)

  if (sorted.length === 0) {
    return (
      <div className="gallery-viewer">
        <div className="gv-empty">No photos available</div>
      </div>
    )
  }

  const safeIndex = Math.min(index, sorted.length - 1)
  const current = sorted[safeIndex]
  const prev = () => setIndex(i => (i - 1 + sorted.length) % sorted.length)
  const next = () => setIndex(i => (i + 1) % sorted.length)

  return (
    <div className="gallery-viewer-wrap">
      <div className="gallery-viewer gv-stage">
        <Image
          src={current.url}
          alt={current.caption ?? `Equipment photo ${safeIndex + 1}`}
          className="gv-primary"
          width={1200}
          height={900}
          unoptimized
          priority
        />
        {sorted.length > 1 && (
          <>
            <button className="gv-nav gv-prev" onClick={prev} aria-label="Previous photo">‹</button>
            <button className="gv-nav gv-next" onClick={next} aria-label="Next photo">›</button>
            <div className="gv-count">{safeIndex + 1} / {sorted.length}</div>
          </>
        )}
      </div>
      {sorted.length > 1 && (
        <div className="gv-thumbs">
          {sorted.map((photo, i) => (
            <button
              key={photo.url}
              className={`gv-thumb${i === safeIndex ? ' gv-thumb-active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`View photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.caption ?? `Thumbnail ${i + 1}`} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
