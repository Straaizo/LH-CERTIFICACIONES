import {
  Children, Fragment, isValidElement, useContext, useEffect, useId, useLayoutEffect, useRef, useState,
  type KeyboardEvent, type ReactElement, type ReactNode, type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { ContextoCampo } from './ui'

export interface OpcionDesplegable {
  valor: string
  etiqueta: string
  detalle?: string
  icono?: ReactNode
  grupo?: string
  deshabilitada?: boolean
}

// ---------- Panel común (misma base que el Portal Interno) ----------

function useDesplegable(lista: OpcionDesplegable[], valor: string, onElegir: (o: OpcionDesplegable) => void) {
  const [abierto, setAbierto] = useState(false)
  const indiceElegido = Math.max(0, lista.findIndex((o) => o.valor === valor))
  const [activo, setActivo] = useState(indiceElegido)
  const raiz = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node
      if (raiz.current?.contains(t) || panel.current?.parentElement?.contains(t)) return
      setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    panel.current?.focus({ preventScroll: true })
    panel.current?.querySelector(`[data-i="${activo}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [abierto, activo])

  const habilitadas = lista.map((o, i) => (o.deshabilitada ? -1 : i)).filter((i) => i >= 0)
  const mover = (paso: number) =>
    setActivo((i) => {
      const pos = habilitadas.indexOf(i)
      const sig = pos < 0 ? 0 : Math.min(habilitadas.length - 1, Math.max(0, pos + paso))
      return habilitadas[sig] ?? i
    })

  const abrir = () => {
    setActivo(lista[indiceElegido]?.deshabilitada ? (habilitadas[0] ?? 0) : indiceElegido)
    setAbierto(true)
  }
  const cerrar = (devolverFoco = true) => {
    setAbierto(false)
    if (devolverFoco) boton.current?.focus()
  }
  const elegir = (o: OpcionDesplegable) => {
    if (o.deshabilitada) return
    cerrar()
    onElegir(o)
  }
  const teclado = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Solo cierra el panel, no el modal que lo contiene
      e.stopPropagation()
      e.nativeEvent.stopImmediatePropagation()
      cerrar()
    }
    else if (e.key === 'ArrowDown') { e.preventDefault(); mover(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1) }
    else if (e.key === 'Home') { e.preventDefault(); setActivo(habilitadas[0] ?? 0) }
    else if (e.key === 'End') { e.preventDefault(); setActivo(habilitadas[habilitadas.length - 1] ?? 0) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (lista[activo]) elegir(lista[activo]) }
    else if (e.key === 'Tab') cerrar(false)
  }
  const tecladoBoton = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); abrir() }
  }
  return { abierto, setAbierto, abrir, activo, setActivo, raiz, boton, panel, elegir, teclado, tecladoBoton }
}

function Panel({ id, titulo, lista, valor, activo, setActivo, elegir, teclado, panel, ancla, alinear, ancho, vacio }: {
  id: string
  titulo: string
  lista: OpcionDesplegable[]
  valor: string
  activo: number
  setActivo: (i: number) => void
  elegir: (o: OpcionDesplegable) => void
  teclado: (e: KeyboardEvent) => void
  panel: React.RefObject<HTMLUListElement | null>
  /** Elemento junto al que se abre el panel */
  ancla: RefObject<HTMLDivElement | null>
  alinear: 'izquierda' | 'derecha'
  ancho: string
  vacio: string
}) {
  // En un portal con posición fija: ningún contenedor con scroll (como un modal) lo recorta.
  // Se abre hacia abajo o, si no cabe, hacia arriba, y nunca se sale de la pantalla.
  const caja = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number; alto: number } | null>(null)
  useLayoutEffect(() => {
    const calcular = () => {
      const a = ancla.current?.getBoundingClientRect()
      const c = caja.current
      if (!a || !c) return
      const margen = 12
      const separacion = 8
      const vw = document.documentElement.clientWidth
      const vh = window.innerHeight
      const abajo = vh - a.bottom - separacion - margen
      const arriba = a.top - separacion - margen
      const alto = c.offsetHeight
      const haciaArriba = alto > abajo && arriba > abajo
      const disponible = Math.max(160, haciaArriba ? arriba : abajo)
      const altoFinal = Math.min(alto, disponible)
      const anchoPanel = Math.max(c.offsetWidth, a.width)
      let left = alinear === 'derecha' ? a.right - anchoPanel : a.left
      left = Math.min(Math.max(margen, left), vw - margen - anchoPanel)
      setPos({ top: haciaArriba ? a.top - separacion - altoFinal : a.bottom + separacion, left, minWidth: a.width, alto: disponible })
    }
    calcular()
    window.addEventListener('resize', calcular)
    window.addEventListener('scroll', calcular, true)
    return () => {
      window.removeEventListener('resize', calcular)
      window.removeEventListener('scroll', calcular, true)
    }
  }, [ancla, alinear])

  return createPortal(
    <div
      ref={caja}
      style={{
        position: 'fixed',
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        minWidth: pos?.minWidth,
        visibility: pos ? 'visible' : 'hidden',
      }}
      className={`z-[60] ${ancho} overflow-hidden rounded-2xl border border-slate-200 bg-superficie text-left text-slate-800 shadow-[0_12px_40px_-8px_rgba(16,40,16,0.28)]`}
    >
      <p className="px-4 pb-2 pt-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">{titulo}</p>
      <ul
        ref={panel}
        id={id}
        role="listbox"
        tabIndex={-1}
        aria-label={titulo}
        aria-activedescendant={lista.length ? `${id}-${activo}` : undefined}
        onKeyDown={teclado}
        style={pos ? { maxHeight: Math.min(352, pos.alto - 44) } : undefined}
        className="max-h-[min(60vh,22rem)] overflow-y-auto overscroll-contain px-2 pb-2 outline-none"
      >
        {lista.length === 0 && <li className="px-3 py-4 text-sm text-slate-500">{vacio}</li>}
        {lista.map((o, i) => {
          const elegida = o.valor === valor
          const todas = o.valor === '' && i === 0 && lista.length > 1
          const nuevoGrupo = o.grupo && o.grupo !== lista[i - 1]?.grupo
          return (
            <li key={`${o.grupo ?? ''}|${o.valor}|${i}`} role="presentation">
              {nuevoGrupo && (
                <p className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{o.grupo}</p>
              )}
              <div
                id={`${id}-${i}`}
                data-i={i}
                role="option"
                aria-selected={elegida}
                aria-disabled={o.deshabilitada || undefined}
                onMouseEnter={() => !o.deshabilitada && setActivo(i)}
                onClick={() => elegir(o)}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-2 ${
                  o.deshabilitada
                    ? 'cursor-not-allowed text-slate-400'
                    : `cursor-pointer ${elegida ? 'bg-emerald-50' : i === activo ? 'bg-slate-100' : ''}`
                }`}
              >
                {o.icono && (
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      todas ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {o.icono}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className={`block text-[15px] leading-snug ${elegida ? 'font-semibold text-slate-900' : ''}`}>{o.etiqueta}</span>
                  {o.detalle && <span className="block truncate text-xs text-slate-500">{o.detalle}</span>}
                </span>
                {elegida && <Check className="h-4 w-4 shrink-0 text-emerald-700" />}
              </div>
              {todas && <div className="mx-2.5 my-1.5 h-px bg-slate-200" />}
            </li>
          )
        })}
      </ul>
    </div>,
    document.body,
  )
}

// ---------- Píldora (encabezado y filtros de contexto) ----------

const DISPARADOR = {
  oscuro: 'rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-white hover:bg-white/15',
  ambar: 'rounded-full border border-amber-300/60 bg-amber-300/15 px-3.5 py-1.5 text-amber-50 hover:bg-amber-300/25',
  claro: 'h-10 rounded-xl border border-slate-200 bg-white px-3 text-slate-800 shadow-sm hover:border-slate-300',
}

export function Desplegable({
  titulo, etiqueta, valor, opciones, todas, onCambio, tono = 'oscuro', alinear = 'izquierda', punto = false,
  icono, disabled = false, vacio = 'Sin opciones', className = '', textoBoton,
}: {
  titulo: string
  etiqueta?: string
  valor: string
  opciones: OpcionDesplegable[]
  todas?: OpcionDesplegable
  onCambio: (valor: string) => void
  tono?: keyof typeof DISPARADOR
  alinear?: 'izquierda' | 'derecha'
  punto?: boolean
  icono?: ReactNode
  disabled?: boolean
  vacio?: string
  className?: string
  textoBoton?: string
}) {
  const lista = todas ? [todas, ...opciones] : opciones
  const d = useDesplegable(lista, valor, (o) => o.valor !== valor && onCambio(o.valor))
  const id = useId()
  const elegida = lista.find((o) => o.valor === valor)
  const tenue = tono === 'claro' ? 'text-slate-500' : tono === 'ambar' ? 'text-amber-100/80' : 'text-white/75'

  return (
    <div ref={d.raiz} className={`relative min-w-0 ${className}`}>
      <button
        ref={d.boton}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={d.abierto}
        aria-controls={d.abierto ? id : undefined}
        aria-label={etiqueta ? `${etiqueta}: ${textoBoton ?? elegida?.etiqueta ?? ''}` : titulo}
        title={textoBoton ?? elegida?.etiqueta}
        onClick={() => (d.abierto ? d.setAbierto(false) : d.abrir())}
        onKeyDown={d.tecladoBoton}
        className={`inline-flex max-w-full items-center gap-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 ${DISPARADOR[tono]}`}
      >
        {punto && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300" />}
        {icono}
        {etiqueta && <span className={`shrink-0 ${tenue}`}>{etiqueta}</span>}
        <span className="truncate font-semibold">{textoBoton ?? elegida?.etiqueta ?? '—'}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 opacity-70 transition-transform ${d.abierto ? 'rotate-180' : ''}`} />
      </button>
      {d.abierto && (
        <Panel id={id} titulo={titulo} lista={lista} valor={valor} activo={d.activo} setActivo={d.setActivo}
          elegir={d.elegir} teclado={d.teclado} panel={d.panel} ancla={d.raiz} alinear={alinear} vacio={vacio}
          ancho="w-80 max-w-[calc(100vw-2rem)]" />
      )}
    </div>
  )
}

// ---------- Selector de formulario: reemplazo directo de <select> ----------

type ElementoOpcion = ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean; label?: string }>

function textoDe(nodo: ReactNode): string {
  return Children.toArray(nodo).map((n) => (typeof n === 'string' || typeof n === 'number' ? String(n) : '')).join('')
}

/** Lee las <option> y <optgroup> hijas (incluidas las de .map y fragmentos). */
function leerOpciones(children: ReactNode, grupo?: string): OpcionDesplegable[] {
  const salida: OpcionDesplegable[] = []
  Children.toArray(children).forEach((hijo) => {
    if (!isValidElement(hijo)) return
    const el = hijo as ElementoOpcion
    if (el.type === Fragment) salida.push(...leerOpciones(el.props.children, grupo))
    else if (el.type === 'optgroup') salida.push(...leerOpciones(el.props.children, el.props.label))
    else if (el.type === 'option') {
      const etiqueta = textoDe(el.props.children)
      salida.push({ valor: String(el.props.value ?? etiqueta), etiqueta, grupo, deshabilitada: !!el.props.disabled })
    }
  })
  return salida
}

const ANCHO = /^(?:[a-z]+:)?(?:w-|min-w-|max-w-|flex-1|flex-none|shrink|grow|basis-)/

/**
 * Mismo uso que <select> (value, onChange con e.target.value, required, disabled, <option>/<optgroup>),
 * con el panel del portal. Un campo oculto conserva la validación nativa de `required`.
 */
export function Selector({
  value, onChange, children, required, disabled, className = '', titulo, id: idExterno, ...resto
}: {
  value: string | number | undefined | null
  onChange?: (e: { target: { value: string }; currentTarget: { value: string } }) => void
  children: ReactNode
  required?: boolean
  disabled?: boolean
  className?: string
  titulo?: string
  id?: string
  'aria-label'?: string
  name?: string
}) {
  const valor = value === undefined || value === null ? '' : String(value)
  const todas = leerOpciones(children)
  // Una opción vacía deshabilitada o tipo "Selecciona…" es solo el texto de ayuda: no se lista
  const placeholder = todas.find((o) => o.valor === '' && (o.deshabilitada || /^(selecciona|seleccione|elige)/i.test(o.etiqueta)))
  const lista = todas.filter((o) => o !== placeholder)
  const etiquetaCampo = useContext(ContextoCampo)
  const d = useDesplegable(lista, valor, (o) => {
    if (o.valor !== valor) onChange?.({ target: { value: o.valor }, currentTarget: { value: o.valor } })
  })
  const id = useId()
  const elegida = todas.find((o) => o.valor === valor)
  const clases = className.split(/\s+/).filter(Boolean)
  const anchoContenedor = clases.filter((c) => ANCHO.test(c)).join(' ')
  const claseBoton = clases.filter((c) => !ANCHO.test(c)).join(' ')
  const vacio = !elegida || elegida === placeholder

  return (
    <div ref={d.raiz} className={`relative ${anchoContenedor || 'w-full'}`}>
      <button
        ref={d.boton}
        id={idExterno}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={d.abierto}
        aria-controls={d.abierto ? id : undefined}
        aria-label={resto['aria-label']}
        title={elegida?.etiqueta}
        onClick={(e) => {
          e.preventDefault()
          if (d.abierto) d.setAbierto(false)
          else d.abrir()
        }}
        onKeyDown={d.tecladoBoton}
        className={`${claseBoton} flex w-full min-w-0 items-center justify-between gap-2 text-left disabled:cursor-not-allowed`}
      >
        <span className={`truncate ${vacio ? 'text-slate-500' : ''}`}>{elegida?.etiqueta || placeholder?.etiqueta || 'Selecciona…'}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${d.abierto ? 'rotate-180' : ''}`} />
      </button>
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          name={resto.name}
          value={valor}
          onChange={() => undefined}
          onFocus={() => d.boton.current?.focus()}
          className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0"
        />
      )}
      {d.abierto && (
        <Panel id={id} titulo={titulo ?? resto['aria-label'] ?? etiquetaCampo ?? 'Elige una opción'} lista={lista} valor={valor}
          activo={d.activo} setActivo={d.setActivo} elegir={d.elegir} teclado={d.teclado} panel={d.panel} ancla={d.raiz}
          alinear="izquierda" vacio="Sin opciones" ancho="w-max max-w-[min(26rem,calc(100vw-2rem))]" />
      )}
    </div>
  )
}
