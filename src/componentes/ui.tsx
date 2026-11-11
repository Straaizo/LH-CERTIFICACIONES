import { createContext, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Camera, CircleAlert, FileUp, Loader2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EsqueletoCarga, type VarianteCarga } from './Esqueletos'
import { Hoja, useEsMovil } from './Hoja'

// ---------- Estilos base reutilizables ----------

export const claseEntrada =
  'w-full rounded-lg border border-slate-200/70 bg-slate-100 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-emerald-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 disabled:opacity-60'

const VARIANTES = {
  primario: 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-emerald-700/50',
  secundario: 'border border-emerald-700 bg-white text-emerald-800 hover:bg-emerald-50 disabled:border-slate-200 disabled:text-slate-400',
  peligro: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50',
  fantasma: 'text-emerald-800 hover:bg-emerald-50 disabled:text-slate-400',
}

export function Boton({
  variante = 'primario',
  ocupado = false,
  icono,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: keyof typeof VARIANTES
  ocupado?: boolean
  icono?: ReactNode
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || ocupado}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-[15px] font-semibold tracking-[0.01em] transition-colors disabled:cursor-not-allowed ${VARIANTES[variante]} ${className}`}
    >
      {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : icono}
      {children}
    </button>
  )
}

export function Tarjeta({ titulo, acciones, children, className = '' }: {
  titulo?: ReactNode
  acciones?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-slate-200 bg-superficie ${className}`}>
      {(titulo || acciones) && (
        <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
          <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
          {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

/** Lo entrega el Layout: ruta de la sección ("Operación · Auditorías") y filtros de contexto (protocolo y temporada). */
export const ContextoMiga = createContext<{ miga: string; filtros: ReactNode }>({ miga: '', filtros: null })

export function EncabezadoPagina({ titulo, descripcion, acciones, sinFiltros = false }: {
  titulo: string
  descripcion?: ReactNode
  acciones?: ReactNode
  /** La página no usa protocolo ni temporada: no se muestran esos filtros */
  sinFiltros?: boolean
}) {
  const contexto = useContext(ContextoMiga)
  const miga = contexto.miga
  const filtros = sinFiltros ? null : contexto.filtros
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        {miga && <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{miga}</p>}
        <h1 className="text-balance text-[28px] font-bold leading-tight tracking-[-0.02em] text-slate-950 sm:text-[32px]">{titulo}</h1>
        {descripcion && <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{descripcion}</p>}
      </div>
      {(filtros || acciones) && (
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
          {filtros}
          {acciones}
        </div>
      )}
    </div>
  )
}

const TONOS = {
  gris: 'bg-slate-500/10 text-slate-600 ring-slate-500/25',
  verde: 'bg-emerald-700/12 text-emerald-800 ring-emerald-700/30',
  amarillo: 'bg-amber-500/12 text-amber-700 ring-amber-500/30',
  rojo: 'bg-red-600/12 text-red-600 ring-red-600/30',
  azul: 'bg-sky-600/12 text-sky-600 ring-sky-600/30',
  violeta: 'bg-violet-50 text-violet-800 ring-violet-200',
}
export type Tono = keyof typeof TONOS

export function Insignia({ tono = 'gris', children, titulo }: { tono?: Tono; children: ReactNode; titulo?: string }) {
  return (
    <span
      title={titulo}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.03em] ring-1 ring-inset ${TONOS[tono]}`}
    >
      {children}
    </span>
  )
}

/** Carga inicial: un esqueleto con la forma del contenido que viene (no un ícono girando). */
export function Cargando({ texto = 'Cargando…', variante = 'lista' }: { texto?: string; variante?: VarianteCarga }) {
  return <EsqueletoCarga variante={variante} texto={texto} />
}

/** Errores en que reintentar no sirve: sin acceso o el registro no existe. */
const ERROR_DEFINITIVO = /acceso|no encontrad|no existe|no pertenece/i

export function MensajeError({ error, onReintentar }: { error: string | null; onReintentar?: () => void }) {
  if (!error) return null
  if (ERROR_DEFINITIVO.test(error)) onReintentar = undefined
  return (
    <div className="my-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
      <span>{error}</span>
      {onReintentar && (
        <button onClick={onReintentar} className="-my-1 inline-flex min-h-9 items-center rounded-lg px-2 font-semibold underline hover:bg-red-100">
          Reintentar
        </button>
      )}
    </div>
  )
}

/** Página de detalle que no se pudo abrir (sin acceso, no existe o falla de red). */
export function ErrorPagina({ error, volverA, volverTexto, onReintentar }: {
  error: string
  volverA: string
  volverTexto: string
  onReintentar?: () => void
}) {
  const definitivo = ERROR_DEFINITIVO.test(error)
  return (
    <div className="mx-auto max-w-xl py-10">
      <Link to={volverA} className="-ml-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> {volverTexto}
      </Link>
      <div className="mt-4 rounded-xl border border-slate-200 bg-superficie p-8 text-center">
        <CircleAlert className="mx-auto h-9 w-9 text-red-500" />
        <h1 className="mt-3 text-lg font-bold tracking-tight text-slate-900">
          {definitivo ? 'No puedes ver esta página' : 'No se pudo cargar la página'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{error}</p>
        <div className="mt-5 flex justify-center gap-2">
          {!definitivo && onReintentar && <Boton variante="secundario" onClick={onReintentar}>Reintentar</Boton>}
          <Link to={volverA} className="inline-flex min-h-11 items-center rounded-lg bg-emerald-700 px-4 py-2 text-[15px] font-semibold text-white hover:bg-emerald-800">
            Ir a {volverTexto.toLowerCase()}
          </Link>
        </div>
      </div>
    </div>
  )
}

export function Vacio({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-slate-500">{children}</div>
}

/** Etiqueta del campo actual: los selectores la usan como título de su panel. */
export const ContextoCampo = createContext<string | undefined>(undefined)

export function Campo({ etiqueta, children, ayuda, className = '' }: {
  etiqueta: string
  children: ReactNode
  ayuda?: ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{etiqueta}</span>
      <ContextoCampo.Provider value={etiqueta}>{children}</ContextoCampo.Provider>
      {ayuda && <span className="mt-1 block text-xs text-slate-500">{ayuda}</span>}
    </label>
  )
}

export function Modal({ abierto, titulo, onCerrar, children, ancho = 'max-w-2xl' }: {
  abierto: boolean
  titulo: ReactNode
  onCerrar: () => void
  children: ReactNode
  ancho?: string
}) {
  // En el celular: hoja inferior que se arrastra para cerrar
  const movil = useEsMovil('(max-width: 639px)')
  useEffect(() => {
    if (!abierto || movil) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [abierto, onCerrar, movil])
  if (movil) {
    return (
      <Hoja abierta={abierto} onCerrar={onCerrar} titulo={titulo}>
        <div className="px-2 pb-2">{children}</div>
      </Hoja>
    )
  }
  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onCerrar}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`flex max-h-[92vh] w-full ${ancho} flex-col rounded-2xl bg-superficie shadow-2xl`}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
              <button onClick={onCerrar} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="overflow-y-auto p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Elegir un archivo (planilla, Word) con el estilo de la aplicación, en vez del control nativo del navegador. */
export function ElegirArchivo({ aceptar, onCambio, texto = 'Elegir archivo' }: {
  aceptar: string
  onCambio: (f: File | null) => void
  texto?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [nombre, setNombre] = useState<string | null>(null)
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-dashed border-slate-300 bg-white p-2">
      <Boton type="button" variante="secundario" icono={<FileUp className="h-4 w-4" />} onClick={() => ref.current?.click()}>
        {texto}
      </Boton>
      <span className={`min-w-0 flex-1 truncate text-sm ${nombre ? 'text-slate-700' : 'text-slate-500'}`} title={nombre ?? undefined}>
        {nombre ?? 'Ningún archivo elegido'}
      </span>
      <input
        ref={ref}
        type="file"
        accept={aceptar}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          setNombre(f?.name ?? null)
          onCambio(f)
        }}
      />
    </div>
  )
}

/** Selector de archivo con opción de cámara (para cargar evidencia en terreno desde el celular). */
export function CampoArchivo({ archivo, onCambio, aceptar = 'application/pdf,image/*,.xlsx,.docx' }: {
  archivo: File | null
  onCambio: (f: File | null) => void
  aceptar?: string
}) {
  const refArchivo = useRef<HTMLInputElement>(null)
  const refCamara = useRef<HTMLInputElement>(null)
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3">
      <div className="flex flex-wrap gap-2">
        <Boton type="button" variante="secundario" icono={<FileUp className="h-4 w-4" />} onClick={() => refArchivo.current?.click()}>
          Elegir archivo
        </Boton>
        <Boton type="button" variante="secundario" icono={<Camera className="h-4 w-4" />} onClick={() => refCamara.current?.click()}>
          Tomar foto
        </Boton>
      </div>
      <input ref={refArchivo} type="file" accept={aceptar} className="hidden" onChange={(e) => onCambio(e.target.files?.[0] ?? null)} />
      <input ref={refCamara} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onCambio(e.target.files?.[0] ?? null)} />
      <p className="mt-2 truncate text-xs text-slate-600">
        {archivo ? `${archivo.name} (${Math.round(archivo.size / 1024)} KB)` : 'Ningún archivo seleccionado'}
      </p>
    </div>
  )
}

/** Convierte en enlaces los códigos de documentos citados en un texto (P OC CE 29, DPL 23). */
export function TextoConEnlaces({ texto, codigos }: { texto: string | null; codigos: Record<string, string> }) {
  if (!texto) return null
  const lista = Object.keys(codigos).sort((a, b) => b.length - a.length)
  if (!lista.length) return <>{texto}</>
  // Tolera espacios variables: "P OCCE 20" o "P OC CE 20"
  const patron = new RegExp(
    `(${lista.map((c) => c.replace(/\s+/g, '').split('').map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*')).join('|')})`,
    'gi',
  )
  const partes = texto.split(patron)
  return (
    <>
      {partes.map((parte, i) => {
        const codigo = lista.find((c) => c.replace(/\s+/g, '').toLowerCase() === parte.replace(/\s+/g, '').toLowerCase())
        return codigo ? (
          <Link key={i} to={`/registros?doc=${codigos[codigo]}`} className="font-medium text-emerald-700 underline">
            {parte}
          </Link>
        ) : (
          <span key={i}>{parte}</span>
        )
      })}
    </>
  )
}

export function BarraPorcentaje({ valor, tono = 'verde' }: { valor: number | null; tono?: 'verde' | 'auto' }) {
  if (valor === null) return <span className="text-xs text-slate-500">Sin datos</span>
  const color =
    tono === 'auto' ? (valor >= 95 ? 'bg-emerald-600' : valor >= 80 ? 'bg-amber-500' : 'bg-red-600') : 'bg-emerald-600'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full min-w-16 overflow-hidden rounded bg-slate-200">
        <div className={`h-full rounded ${color}`} style={{ width: `${Math.min(100, valor)}%` }} />
      </div>
      <span className="w-12 text-right text-xs font-medium tabular-nums text-slate-700">{valor} %</span>
    </div>
  )
}

/** Pestañas simples controladas. */
export function Pestanas<T extends string>({ opciones, valor, onCambio }: {
  opciones: { valor: T; etiqueta: ReactNode }[]
  valor: T
  onCambio: (v: T) => void
}) {
  // La pestaña elegida se desliza a su lugar; en el celular, la elegida se asoma si quedó fuera de la vista
  const grupo = useId()
  const fila = useRef<HTMLDivElement>(null)
  const [bordes, setBordes] = useState({ izq: false, der: false })
  // Si no caben todas, el borde se desvanece hacia el lado donde hay más pestañas (se pueden deslizar)
  useEffect(() => {
    const el = fila.current
    if (!el) return
    const medir = () => setBordes({ izq: el.scrollLeft > 2, der: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 })
    medir()
    el.addEventListener('scroll', medir, { passive: true })
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => {
      el.removeEventListener('scroll', medir)
      obs.disconnect()
    }
  }, [])
  const mascara = bordes.izq && bordes.der
    ? 'linear-gradient(to right, transparent, black 28px, black calc(100% - 36px), transparent)'
    : bordes.der ? 'linear-gradient(to right, black calc(100% - 36px), transparent)'
      : bordes.izq ? 'linear-gradient(to right, transparent, black 28px)' : undefined
  return (
    <div ref={fila} role="tablist" style={{ maskImage: mascara, WebkitMaskImage: mascara }}
      className="sin-barra mb-6 flex gap-1.5 overflow-x-auto py-0.5">
      {opciones.map((o) => {
        const sel = valor === o.valor
        return (
          <button
            key={o.valor}
            role="tab"
            aria-selected={sel}
            onClick={(e) => {
              onCambio(o.valor)
              e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
            }}
            className={`relative min-h-10 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors duration-200 lg:min-h-9 ${
              sel ? 'border-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50 active:bg-slate-100'
            }`}
          >
            {sel && (
              <motion.span layoutId={`pestana-${grupo}`} className="absolute -inset-px rounded-full bg-emerald-700"
                transition={{ type: 'spring', stiffness: 520, damping: 40 }} />
            )}
            <span className="relative">{o.etiqueta}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Aviso temporal de éxito. */
export function useAviso() {
  const [aviso, setAviso] = useState<string | null>(null)
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(t)
  }, [aviso])
  const nodo = aviso ? (
    <div className="fixed inset-x-4 bottom-[calc(1rem+var(--alto-pestanas,0px))] z-50 mx-auto max-w-md rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-xl">
      {aviso}
    </div>
  ) : null
  return { avisar: setAviso, nodo }
}
