import { useEffect, useState } from 'react'

/**
 * Fotos del ingreso. Los originales van en fotos-carrusel/ (raíz del proyecto); scripts/fotos-carrusel.mjs genera
 * en src/assets/carrusel/ versiones AVIF y WebP de 800 a 2800 px (`nombre-ancho.formato`). Orden: por nombre.
 * Sin fotos queda el fondo verde.
 */
export interface Foto {
  avif: string
  webp: string
  /** WebP más grande, para navegadores sin srcset */
  respaldo: string
}

const ARCHIVOS = import.meta.glob<string>('../assets/carrusel/*-*.{avif,webp}', { eager: true, import: 'default' })

const IMAGENES: Foto[] = (() => {
  const grupos = new Map<string, { avif: [number, string][]; webp: [number, string][] }>()
  for (const [ruta, url] of Object.entries(ARCHIVOS)) {
    const m = /\/([^/]+)-(\d+)\.(avif|webp)$/.exec(ruta)
    if (!m) continue
    const g = grupos.get(m[1]) ?? { avif: [], webp: [] }
    g[m[3] as 'avif' | 'webp'].push([Number(m[2]), url])
    grupos.set(m[1], g)
  }
  const srcset = (lista: [number, string][]) => lista.sort((a, b) => a[0] - b[0]).map(([w, u]) => `${u} ${w}w`).join(', ')
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, g]) => g.webp.length)
    .map(([, g]) => ({ avif: srcset(g.avif), webp: srcset(g.webp), respaldo: g.webp[g.webp.length - 1][1] }))
})()

// Ancho que ocupa la foto: en escritorio el panel (con object-cover, la foto 3:2 cubre su alto: 150vh);
// en el celular, la banda superior
const TAMANOS = '(min-width: 1024px) max(55vw, 150vh), max(100vw, 520px)'

const INTERVALO_MS = 6500

export function useCarrusel() {
  const [actual, setActual] = useState(0)
  const total = IMAGENES.length

  useEffect(() => {
    if (total < 2) return
    const id = window.setInterval(() => {
      if (!document.hidden) setActual((i) => (i + 1) % total)
    }, INTERVALO_MS)
    return () => window.clearInterval(id)
  }, [total, actual])

  return { imagenes: IMAGENES, actual, total, ir: setActual }
}

/** Capa de fotos que se funden una en otra. */
export function FondoCarrusel({ imagenes, actual }: { imagenes: Foto[]; actual: number }) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-emerald-950">
      {imagenes.map((foto, i) => (
        <picture key={foto.respaldo}>
          {foto.avif && <source type="image/avif" srcSet={foto.avif} sizes={TAMANOS} />}
          <img
            src={foto.respaldo}
            srcSet={foto.webp}
            sizes={TAMANOS}
            alt=""
            decoding="async"
            fetchPriority={i === 0 ? 'high' : 'low'}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-in-out motion-reduce:transition-none ${
              i === actual ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </picture>
      ))}
      {/* Velo verde: legibilidad del texto sobre cualquier foto */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,46,7,0.55)_0%,rgba(5,46,7,0.35)_40%,rgba(5,46,7,0.85)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,46,7,0.6)_0%,rgba(5,46,7,0.25)_55%,transparent_80%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_100%,rgba(11,122,11,0.35),transparent_60%)]" />
    </div>
  )
}

/** Indicadores: una barra por foto; la activa se llena durante el intervalo. */
export function IndicadoresCarrusel({ total, actual, ir }: { total: number; actual: number; ir: (i: number) => void }) {
  if (total < 2) return null
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Imágenes">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => ir(i)}
          aria-label={`Imagen ${i + 1} de ${total}`}
          aria-current={i === actual}
          className="group flex h-6 items-center"
        >
          <span className="relative block h-[3px] w-10 overflow-hidden rounded-full bg-white/25 transition-colors group-hover:bg-white/40">
            {i === actual && (
              <span key={actual} className="barra-progreso absolute inset-0 rounded-full bg-white"
                style={{ animationDuration: `${INTERVALO_MS}ms` }} />
            )}
          </span>
        </button>
      ))}
    </div>
  )
}
