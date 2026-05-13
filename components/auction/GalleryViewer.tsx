import Image from 'next/image'

interface Photo {
  url: string
  order: number
  caption?: string
}

export function GalleryViewer({ photos }: { photos: Photo[] }) {
  const primary = [...photos].sort((left, right) => left.order - right.order)[0]

  return (
    <div className="gallery-viewer">
      {primary ? (
        <Image src={primary.url} alt={primary.caption ?? 'Equipment photo'} className="gv-primary" width={1200} height={900} unoptimized />
      ) : (
        <div className="gv-empty">No photos available</div>
      )}
    </div>
  )
}
