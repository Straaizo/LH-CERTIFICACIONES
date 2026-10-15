import { createContext, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { ArrowLeft, Camera, CircleAlert, FileUp, Loader2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EsqueletoCarga, type VarianteCarga } from './Esqueletos'

// ---------- Estilos base reutilizables ----------

export const claseEntrada =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:bg-slate-100'

const VARIANTES = {
  primario: 'bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 disabled:bg-emerald-700/50',
  secundario: 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  peligro: 'bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-red-600/50',
  fantasma: 'text-slate-600 hover:bg-slate-100 disabled:text-slate-400',
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
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTES[variante]} ${className}`}
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
    <section className={`min-w-0 rounded-2xl border border-slate-200/80 bg-superficie shadow-[0_1px_2px_rgba(16,40,16,0.04)] ${className}`}>
      {(titulo || acciones) && (
        <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
          <h2 className="text-[17px] font-semibold tracking-tight text-slate-900">{titulo}</h2>
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
        {miga && <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-slate-500">{miga}</p>}
        <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-950 sm:text-[40px] sm:leading-[1.1]">{titulo}</h1>
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
  gris: 'bg-slate-100 text-slate-700 ring-slate-200',
  verde: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amarillo: 'bg-amber-50 text-amber-800 ring-amber-200',
  rojo: 'bg-red-50 text-red-700 ring-red-200',
  azul: 'bg-sky-50 text-sky-800 ring-sky-200',
  violeta: 'bg-violet-50 text-violet-800 ring-violet-200',
}
export type Tono = keyof typeof TONOS

export function Insignia({ tono = 'gris', children, titulo }: { tono?: Tono; children: ReactNode; titulo?: string }) {
  return (
    <span
      title={titulo}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONOS[tono]}`}
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
    <div className="my-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
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
      <div className="mt-4 rounded-2xl border border-slate-200/80 bg-superficie p-8 text-center">
        <CircleAlert className="mx-auto h-9 w-9 text-red-500" />
        <h1 className="mt-3 text-lg font-bold tracking-tight text-slate-900">
          {definitivo ? 'No puedes ver esta página' : 'No se pudo cargar la página'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{error}</p>
        <div className="mt-5 flex justify-center gap-2">
          {!definitivo && onReintentar && <Boton variante="secundario" onClick={onReintentar}>Reintentar</Boton>}
          <Link to={volverA} className="inline-flex items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
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
  useEffect(() => {
    if (!abierto) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [abierto, onCerrar])
  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        className={`flex max-h-[92vh] w-full ${ancho} flex-col rounded-t-3xl bg-superficie shadow-2xl sm:rounded-3xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-4">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{titulo}</h2>
          <button onClick={onCerrar} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
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
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-slate-300 bg-white p-2">
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
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3">
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
export function TextoConEnlaces({ texto, codigos }: { texto: string | null; codigos: Record<string, number> }) {
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
      <div className="h-2 w-full min-w-16 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, valor)}%` }} />
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
  return (
    <div className="sin-barra mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-superficie p-1.5 shadow-[0_1px_2px_rgba(16,40,16,0.04)]">
      {opciones.map((o) => (
        <button
          key={o.valor}
          onClick={() => onCambio(o.valor)}
          className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            valor === o.valor ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          {o.etiqueta}
        </button>
      ))}
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
    <div className="fixed inset-x-4 bottom-[calc(1rem+var(--alto-pestanas,0px))] z-50 mx-auto max-w-md rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl">
      {aviso}
    </div>
  ) : null
  return { avisar: setAviso, nodo }
}
