import { useId, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

/*
  Escena "Mercado vivo" de lh_ui (github.com/mbravot/lh_ui, lib/src/escena) llevada a SVG:
  fondo verde con formas orgánicas, frutas dibujadas con trazos, cabecera de inicio e indicadores.
*/

/** Fondo verde de marca con dos lomas y dos círculos. Cubre su contenedor como un "slice". */
export function FondoOrganico({ className = '', vertical = false }: { className?: string; vertical?: boolean }) {
  if (vertical) return <FondoOrganicoVertical className={className} />
  return (
    <svg aria-hidden="true" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" className={`absolute inset-0 h-full w-full ${className}`}>
      <rect x="-60" y="-60" width="920" height="920" fill="#2f7553" />
      <circle cx="690" cy="120" r="200" fill="#3a8762" fillOpacity="0.55" />
      <circle cx="90" cy="300" r="120" fill="#3a8762" fillOpacity="0.35" />
      <path d="M-60 520C120 420 260 600 460 540C640 486 700 380 880 420L880 880L-60 880Z" fill="#2d6a4f" />
      <path d="M-60 660C140 600 300 720 520 680C700 648 780 600 880 620L880 880L-60 880Z" fill="#245c43" />
    </svg>
  )
}

/**
 * Versión alta del fondo para el menú lateral: círculos arriba y lomas escalonadas que se oscurecen hacia abajo.
 * Anclada abajo: con el menú colapsado o una pantalla baja se recorta arriba y a los lados, nunca las lomas.
 */
function FondoOrganicoVertical({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 300 900" preserveAspectRatio="xMidYMax slice" className={`absolute inset-0 h-full w-full ${className}`}>
      <rect x="-20" y="-20" width="340" height="940" fill="#2f7553" />
      <circle cx="270" cy="70" r="150" fill="#3a8762" fillOpacity="0.5" />
      <circle cx="20" cy="300" r="95" fill="#3a8762" fillOpacity="0.3" />
      <circle cx="280" cy="520" r="70" fill="#3a8762" fillOpacity="0.28" />
      <path d="M-20 430C60 395 130 460 200 438C250 422 280 400 320 408L320 920L-20 920Z" fill="#2f7553" />
      <path d="M-20 470C70 432 140 500 210 476C260 459 290 440 320 446L320 920L-20 920Z" fill="#2d6a4f" fillOpacity="0.45" />
      <path d="M-20 600C80 560 150 630 220 606C265 590 295 575 320 580L320 920L-20 920Z" fill="#2d6a4f" />
      <path d="M-20 730C70 695 150 760 225 738C270 724 300 710 320 714L320 920L-20 920Z" fill="#245c43" />
      <path d="M-20 840C80 812 160 860 230 845C275 835 300 826 320 830L320 920L-20 920Z" fill="#1f5039" />
    </svg>
  )
}

export type TipoFruta = 'naranja' | 'uvas' | 'cerezas' | 'durazno'

const LIENZO: Record<TipoFruta, [number, number]> = {
  naranja: [120, 124],
  cerezas: [120, 130],
  uvas: [124, 132],
  durazno: [120, 124],
}
const HOJA = '#4e9a6e'
const HOJA_CLARA = '#74c69d'
const TALLO = '#6b4a1e'
const GRANOS_UVA: [number, number][] = [
  [40, 34], [62, 34], [84, 34], [30, 54], [52, 54], [74, 54], [96, 54], [40, 74], [62, 74], [84, 74], [51, 94], [73, 94], [62, 113],
]

/** Fruta ilustrada con degradado, brillo y sombra. Decorativa. */
export function Fruta({ tipo, ancho, className = '' }: { tipo: TipoFruta; ancho: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  const [w, h] = LIENZO[tipo]
  const sombra = `url(#s${id})`
  const degradado = (stops: [number, string][], cx = 0.36, cy = 0.32, r = 0.72) => (
    <radialGradient id={`g${id}`} cx={cx} cy={cy} r={r}>
      {stops.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
    </radialGradient>
  )
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${w} ${h}`} width={ancho} height={(ancho * h) / w} className={`overflow-visible ${className}`}>
      <defs>
        <filter id={`s${id}`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="8" stdDeviation="5" floodColor="#000" floodOpacity="0.16" />
        </filter>
        {tipo === 'naranja' && degradado([[0, '#ffc27a'], [0.45, '#f29a3a'], [1, '#c8661a']])}
        {tipo === 'cerezas' && degradado([[0, '#e0584f'], [0.5, '#b3302f'], [1, '#6e1414']], 0.35, 0.3, 0.75)}
        {tipo === 'uvas' && degradado([[0, '#e6f5da'], [0.55, '#afd98e'], [1, '#6fa552']], 0.35, 0.3, 0.75)}
        {tipo === 'durazno' && degradado([[0, '#ffd9a8'], [0.45, '#f2a65a'], [0.8, '#e06b3c'], [1, '#b4472a']], 0.34, 0.34, 0.74)}
        <radialGradient id={`b${id}`}>
          <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {tipo === 'naranja' && (
        <>
          <circle cx="60" cy="66" r="52" fill={`url(#g${id})`} filter={sombra} />
          <ellipse cx="42" cy="46" rx="14" ry="9" transform="rotate(-30 42 46)" fill={`url(#b${id})`} />
          <circle cx="60" cy="16" r="3.5" fill={TALLO} />
          <path d="M62 15C72 2 92 2 98 10C88 18 74 20 62 15Z" fill={HOJA} />
          <path d="M62 15C74 11 86 9 98 10" stroke="#2d6a4f" strokeWidth="1.5" fill="none" />
        </>
      )}
      {tipo === 'cerezas' && (
        <>
          <path d="M36 92C44 54 60 26 74 8M86 98C80 60 76 30 74 8" stroke={HOJA} strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M74 8C86 2 102 6 108 16C96 20 82 18 74 8Z" fill={HOJA_CLARA} />
          {([[34, 98, 24], [86, 104, 22]] as const).map(([cx, cy, r]) => (
            <g key={cx}>
              <circle cx={cx} cy={cy} r={r} fill={`url(#g${id})`} filter={sombra} />
              <ellipse cx={cx - r * 0.38} cy={cy - r * 0.42} rx={r * 0.26} ry={r * 0.16}
                transform={`rotate(-35 ${cx - r * 0.38} ${cy - r * 0.42})`} fill="#fff" fillOpacity="0.7" />
            </g>
          ))}
        </>
      )}
      {tipo === 'uvas' && (
        <>
          <path d="M62 22C62 12 66 6 74 2" stroke={TALLO} strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M66 14C56 2 38 2 30 12C42 20 56 20 66 14Z" fill={HOJA} />
          <g filter={sombra}>
            {GRANOS_UVA.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="12" fill={`url(#g${id})`} />)}
          </g>
          {GRANOS_UVA.map(([x, y]) => <circle key={`b${x}-${y}`} cx={x - 4} cy={y - 4} r="2.6" fill="#fff" fillOpacity="0.65" />)}
        </>
      )}
      {tipo === 'durazno' && (
        <>
          <path d="M60 18C96 18 112 46 112 72C112 100 88 118 60 118C32 118 8 100 8 72C8 46 24 18 60 18Z" fill={`url(#g${id})`} filter={sombra} />
          <path d="M60 22C54 50 54 84 62 116" stroke="#b4472a" strokeOpacity="0.45" strokeWidth="2" fill="none" />
          <path d="M60 20C66 6 84 2 94 8C86 16 72 20 60 20Z" fill={HOJA} />
        </>
      )}
    </svg>
  )
}

const ANCHOS_FRUTERO = [48, 40, 36]

/** Cabecera verde del inicio: antetítulo, saludo, frase de estado e indicadores montados sobre el borde inferior. */
export function Hero({ antetitulo, titulo, frase, acciones, children, frutas = ['naranja', 'uvas', 'cerezas'] }: {
  antetitulo?: string
  titulo: string
  frase?: ReactNode
  /** Filtros u otros controles, arriba a la derecha */
  acciones?: ReactNode
  /** Indicadores: montan sobre el borde de abajo del verde */
  children?: ReactNode
  frutas?: TipoFruta[]
}) {
  return (
    <section className="relative">
      <div className={`absolute inset-x-0 top-0 overflow-hidden rounded-3xl ${children ? 'bottom-14' : 'bottom-0'}`}>
        <FondoOrganico />
      </div>
      <div className={`relative px-5 pt-6 sm:px-8 sm:pt-8 ${children ? '' : 'pb-8'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className={`min-w-0 ${frutas.length ? 'pr-28 sm:pr-0' : ''}`}>
            {antetitulo && <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/75">{antetitulo}</p>}
            <h1 className="mt-1 text-balance text-[30px] font-bold leading-tight tracking-[-0.02em] text-white sm:text-[34px]">{titulo}</h1>
            {frase && <p className="mt-1 text-base text-white/85">{frase}</p>}
          </div>
          <div className="flex items-start gap-4 sm:ml-auto">
            {acciones && <div className="hidden flex-wrap items-center justify-end gap-2 lg:flex">{acciones}</div>}
            {frutas.length > 0 && (
              <div className="absolute right-4 top-5 flex items-end sm:static">
                {frutas.slice(0, 3).map((f, i) => (
                  <Fruta key={f} tipo={f} ancho={ANCHOS_FRUTERO[i]} className="shrink-0" />
                ))}
              </div>
            )}
          </div>
        </div>
        {acciones && <div className="mt-4 flex flex-wrap items-center gap-2 lg:hidden">{acciones}</div>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  )
}

export type TonoIndicador = 'neutro' | 'ok' | 'atencion' | 'error'

const TONO_INDICADOR: Record<TonoIndicador, string> = {
  neutro: 'bg-emerald-700/12 text-emerald-800',
  ok: 'bg-emerald-700/12 text-emerald-800',
  atencion: 'bg-amber-500/15 text-amber-700',
  error: 'bg-red-600/12 text-red-600',
}

/** Tarjeta de un número: ícono en un disco, el valor grande y la etiqueta debajo. Va dentro de un Hero. */
export function Indicador({ valor, etiqueta, icono: Icono, tono = 'neutro', enlace }: {
  valor: string
  etiqueta: string
  icono: LucideIcon
  tono?: TonoIndicador
  enlace?: string
}) {
  const contenido = (
    <>
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${TONO_INDICADOR[tono]}`}>
        <Icono className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <p className="mt-2 truncate text-[26px] font-bold leading-none tracking-[-0.02em] text-slate-950 tabular-nums">{valor}</p>
      <p className="mt-1 text-xs font-medium leading-tight text-slate-500">{etiqueta}</p>
    </>
  )
  const clase =
    'block h-full rounded-[18px] border border-slate-200 bg-white p-3.5 shadow-[0_10px_30px_-14px_rgba(15,30,19,0.35)] transition-colors'
  return enlace ? (
    <Link to={enlace} className={`${clase} hover:border-emerald-300 active:bg-slate-50`}>{contenido}</Link>
  ) : (
    <div className={clase}>{contenido}</div>
  )
}
