import { useEffect, useMemo, useState } from 'react'

const colors = ['#e3e8d8', '#e9dfd3', '#dce7e5', '#e8e2d4', '#e4dfe9', '#e9dce0', '#e1e6d1', '#dce3ea']
const extensions = ['jpg', 'jpeg', 'png', 'webp', 'JPG', 'PNG']

export default function Avatar({ person, size = 'md', className = '' }) {
  const name = person?.name?.trim() || 'Integrante'
  const photo = person?.photo
  const [imageIndex, setImageIndex] = useState(0)
  const [loadedSource, setLoadedSource] = useState(null)
  const sources = useMemo(() => {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
    const files = extensions.map((extension) => `${base}fotos/${encodeURIComponent(name)}.${extension}`)
    if (photo) files.unshift(/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(photo) ? photo : `${base}${photo.replace(/^\/+/, '')}`)
    return [...new Set(files)]
  }, [name, photo])

  useEffect(() => { setImageIndex(0) }, [name, photo])

  const parts = name.split(/\s+/)
  const initials = (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0].slice(0, 2)).toLocaleUpperCase('pt-BR')
  const colorIndex = [...name].reduce((hash, letter) => ((hash << 5) - hash + letter.codePointAt(0)) | 0, 0)

  return (
    <span className={`avatar avatar-${size} ${className}`} style={{ '--avatar-color': colors[Math.abs(colorIndex) % colors.length], backgroundColor: colors[Math.abs(colorIndex) % colors.length] }} role="img" aria-label={name}>
      <span aria-hidden="true">{initials}</span>
      {imageIndex < sources.length && (
        <img
          key={sources[imageIndex]}
          src={sources[imageIndex]}
          style={{ opacity: loadedSource === sources[imageIndex] ? 1 : 0 }}
          alt=""
          draggable="false"
          onLoad={() => setLoadedSource(sources[imageIndex])}
          onError={() => setImageIndex((index) => Math.min(index + 1, sources.length))}
        />
      )}
    </span>
  )
}
