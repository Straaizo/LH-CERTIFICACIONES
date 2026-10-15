import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

/*
  Gráficos del panel (SVG/HTML propio, sin librerías).
  Forma "énfasis": la temporada actual en azul (serie 1 validada) y la anterior en gris de contexto (#838d7e,
  >= 3:1 sobre la superficie). Mejora/empeora usa los colores de estado, siempre con ícono y texto.
*/
export const COLOR = {
  actual: '#2a78d6',
  anterior: '#838d7e',
  bueno: '#0ca30c',
  malo: '#d03b3b',
  textoBueno: '#006300',
  textoMalo: '#b42323',
  grilla: '#e3e8df',
  eje: '#c4cdbe',
}

const formateadores = new Map<number, Intl.NumberFormat>()
function fmt(decimales: number): Intl.NumberFormat {
  let f = formateadores.get(decimales)
  if (!f) {
    f = new Intl.NumberFormat('es-CL', { maximumFractionDigits: decimales, minimumFractionDigits: 0 })
    formateadores.set(decimales, f)
  }
  return f
}
const formatoCompacto = new Intl.NumberFormat('es-CL', { notation: 'compact', maximumFractionDigits: 1 })
export function numero(valor: number | null | undefined, decimales = 0): string {
  return valor === null || valor === undefined ? '—' : fmt(decimales).format(valor)
}
export function compacto(valor: number): string {
  return formatoCompacto.format(valor)
}

/** Ancho del contenedor (los gráficos dibujan en píxeles reales para que el texto no se achique en el celular). */
export function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [ancho, setAncho] = useState(0)
  useLayoutEffect(() => {
    if (!ref.current) return
    const obs = new ResizeObserver(([e]) => setAncho(Math.round(e.contentRect.width)))
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return { ref, ancho }
}

const reducirMovimiento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Número que sube desde 0 hasta el valor (se desactiva con "reducir movimiento"). */
export function useContador(objetivo: number, duracion = 1100) {
  const [valor, setValor] = useState(reducirMovimiento() ? objetivo : 0)
  useEffect(() => {
    if (reducirMovimiento()) {
      setValor(objetivo)
      return
    }
    let raf = 0
    const inicio = performance.now()
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracion)
      setValor(objetivo * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [objetivo, duracion])
  return valor
}

/** Número que sube desde 0 escribiendo directo en el DOM: 60 cuadros por segundo sin re-renderizar React. */
export function NumeroAnimado({ valor, decimales = 0, duracion = 1100 }: { valor: number; decimales?: number; duracion?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reducirMovimiento()) {
      el.textContent = numero(valor, decimales)
      return
    }
    let raf = 0
    const inicio = performance.now()
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracion)
      el.textContent = numero(valor * (1 - Math.pow(1 - p, 3)), decimales)
      if (p < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [valor, decimales, duracion])
  return <span ref={ref}>{numero(reducirMovimiento() ? valor : 0, decimales)}</span>
}

/** Activa una transición después del primer pintado (para animar desde el estado inicial). */
export function useMontado(retardo = 60) {
  const [listo, setListo] = useState(reducirMovimiento())
  useEffect(() => {
    const t = setTimeout(() => setListo(true), retardo)
    return () => clearTimeout(t)
  }, [retardo])
  return listo
}

function escalaLimpia(maximo: number, marcas = 4): number[] {
  if (maximo <= 0) return [0, 1]
  const bruto = maximo / marcas
  const potencia = Math.pow(10, Math.floor(Math.log10(bruto)))
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? bruto
  const ticks: number[] = []
  for (let v = 0; v <= maximo + paso * 0.001; v += paso) ticks.push(v)
  if (ticks[ticks.length - 1] < maximo) ticks.push(ticks[ticks.length - 1] + paso)
  return ticks
}

// ---------- Variación (mejora / empeora) ----------

/** Chip de variación. menosEsMejor: en consumo y huella bajar es mejorar; en reciclaje, subir. */
export function Variacion({ valor, menosEsMejor = true, contra, grande = false }: {
  valor: number | null
  menosEsMejor?: boolean
  contra?: string
  grande?: boolean
}) {
  if (valor === null || Math.abs(valor) < 0.05) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600">
        <Minus className="h-4 w-4" /> Sin cambio{contra ? <span className="font-normal text-slate-500"> {contra}</span> : null}
      </span>
    )
  }
  const mejora = menosEsMejor ? valor < 0 : valor > 0
  const Icono = valor < 0 ? ArrowDownRight : ArrowUpRight
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 ${grande ? 'text-base' : 'text-sm'}`}>
      <span
        className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold ring-1 ring-inset"
        style={{
          color: mejora ? COLOR.textoBueno : COLOR.textoMalo,
          backgroundColor: mejora ? '#ecf8ec' : '#fcefef',
          boxShadow: `inset 0 0 0 1px ${mejora ? '#bfe5bf' : '#f2c9c9'}`,
        }}
      >
        <Icono className={grande ? 'h-5 w-5' : 'h-4 w-4'} />
        {valor > 0 ? '+' : '−'}{numero(Math.abs(valor), 1)} %
      </span>
      <span className="font-medium" style={{ color: mejora ? COLOR.textoBueno : COLOR.textoMalo }}>
        {mejora ? 'Mejor' : 'Peor'}
      </span>
      {contra && <span className="text-slate-500">{contra}</span>}
    </span>
  )
}

// ---------- Minigráfico ----------

export function Minigrafico({ actual, anterior, alto = 40 }: { actual: number[]; anterior: number[]; alto?: number }) {
  const { ref, ancho } = useAncho<HTMLDivElement>()
  const max = Math.max(...actual, ...anterior, 1)
  const x = (i: number) => (i / 11) * Math.max(ancho - 8, 1) + 4
  const y = (v: number) => alto - 4 - (v / max) * (alto - 8)
  const linea = (serie: number[]) => serie.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')
  return (
    <div ref={ref} className="h-10 w-full" aria-hidden>
      {ancho > 0 && (
        <svg width={ancho} height={alto} className="overflow-visible">
          <path d={linea(anterior)} fill="none" stroke={COLOR.anterior} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
          {actual.length > 0 && (
            <>
              <path d={linea(actual)} pathLength={1} className="animar-trazo" fill="none" stroke={COLOR.actual} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(actual.length - 1)} cy={y(actual[actual.length - 1])} r={3.5} fill={COLOR.actual} stroke="#fff" strokeWidth={2} className="animar-desvanecer" />
            </>
          )}
        </svg>
      )}
    </div>
  )
}

// ---------- Leyenda ----------

export function Leyenda({ actual, anterior }: { actual: string; anterior: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
      <span className="inline-flex items-center gap-2">
        <span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: COLOR.actual }} /> Temporada {actual}
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: COLOR.anterior }} /> Temporada {anterior}
      </span>
    </div>
  )
}

// ---------- Línea comparativa con cursor ----------

export function LineaComparativa({ meses, actual, anterior, nombreActual, nombreAnterior, unidad, decimales = 1, alto = 300 }: {
  meses: string[]
  actual: number[]
  anterior: number[]
  nombreActual: string
  nombreAnterior: string
  unidad: string
  decimales?: number
  alto?: number
}) {
  const { ref, ancho } = useAncho<HTMLDivElement>()
  const [indice, setIndice] = useState<number | null>(null)
  const angosto = ancho < 520
  const m = { izq: 52, der: angosto ? 16 : 84, arr: 18, aba: 30 }
  const w = Math.max(ancho - m.izq - m.der, 10)
  const h = alto - m.arr - m.aba
  const ticks = escalaLimpia(Math.max(...actual, ...anterior, 0))
  const maxY = ticks[ticks.length - 1]
  const x = (i: number) => m.izq + (i / (meses.length - 1)) * w
  const y = (v: number) => m.arr + h - (v / maxY) * h
  const linea = (serie: number[]) => serie.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')
  const area = actual.length
    ? `${linea(actual)}L${x(actual.length - 1)},${y(0)}L${x(0)},${y(0)}Z`
    : ''
  const n = actual.length
  const ultimo = n - 1

  const mover = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const i = Math.round(((clientX - rect.left - m.izq) / w) * (meses.length - 1))
    setIndice(Math.max(0, Math.min(meses.length - 1, i)))
  }
  const teclado = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setIndice((i) => Math.min(meses.length - 1, (i ?? -1) + 1))
    else if (e.key === 'ArrowLeft') setIndice((i) => Math.max(0, (i ?? meses.length) - 1))
    else if (e.key === 'Escape') setIndice(null)
  }
  const vAct = indice !== null && indice < n ? actual[indice] : null
  const vAnt = indice !== null ? anterior[indice] : null
  const delta = vAct !== null && vAnt ? ((vAct - vAnt) / vAnt) * 100 : null

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height: alto }}>
      {ancho > 0 && (
        <svg
          width={ancho}
          height={alto}
          role="img"
          aria-label={`Gráfico de líneas: ${nombreActual} contra ${nombreAnterior}, por mes, en ${unidad}. Usa las flechas para recorrer los meses.`}
          tabIndex={0}
          onKeyDown={teclado}
          onBlur={() => setIndice(null)}
          onPointerMove={(e) => mover(e.clientX)}
          onPointerLeave={() => setIndice(null)}
          className="overflow-visible outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-emerald-600/40"
        >
          {/* Período comparado */}
          {n > 0 && (
            <g className="animar-desvanecer">
              <rect x={x(0) - 6} y={m.arr} width={x(ultimo) - x(0) + 12} height={h} rx={8} fill="#eef3fb" />
              <text x={x(0) - 2} y={m.arr + 14} fontSize={11} fill="#3d5f8a" fontWeight={600}>
                Período comparado
              </text>
            </g>
          )}
          {/* Grilla y eje */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.izq} x2={m.izq + w} y1={y(t)} y2={y(t)} stroke={t === 0 ? COLOR.eje : COLOR.grilla} strokeWidth={1} />
              <text x={m.izq - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#6b7566" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {compacto(t)}
              </text>
            </g>
          ))}
          {meses.map((mes, i) => (
            (!angosto || i % 2 === 0) && (
              <text key={mes + i} x={x(i)} y={alto - 8} textAnchor="middle" fontSize={11} fill={i < n ? '#3b4338' : '#6b7566'} fontWeight={i < n ? 600 : 400}>
                {mes}
              </text>
            )
          ))}
          {/* Temporada anterior: contexto en gris */}
          <path d={linea(anterior)} pathLength={1} className="animar-trazo" fill="none" stroke={COLOR.anterior} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {!angosto && (
            <text x={x(anterior.length - 1) + 8} y={y(anterior[anterior.length - 1])} dy="0.32em" fontSize={11} fill="#5a6455">
              {nombreAnterior}
            </text>
          )}
          {/* Temporada actual: énfasis */}
          {n > 0 && (
            <>
              <path d={area} fill={COLOR.actual} fillOpacity={0.12} className="animar-desvanecer" />
              <path d={linea(actual)} pathLength={1} className="animar-trazo" style={{ animationDelay: '.25s' }} fill="none" stroke={COLOR.actual} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(ultimo)} cy={y(actual[ultimo])} r={5} fill={COLOR.actual} stroke="#fff" strokeWidth={2} className="animar-desvanecer" />
              <text x={x(ultimo)} y={y(actual[ultimo]) - 12} textAnchor="middle" fontSize={12} fontWeight={700} fill="#172016" className="animar-desvanecer">
                {numero(actual[ultimo], decimales)}
              </text>
            </>
          )}
          {/* Cursor */}
          {indice !== null && (
            <g pointerEvents="none">
              <line x1={x(indice)} x2={x(indice)} y1={m.arr} y2={m.arr + h} stroke="#3b4338" strokeWidth={1} opacity={0.35} />
              {vAnt !== null && <circle cx={x(indice)} cy={y(vAnt)} r={4.5} fill={COLOR.anterior} stroke="#fff" strokeWidth={2} />}
              {vAct !== null && <circle cx={x(indice)} cy={y(vAct)} r={5} fill={COLOR.actual} stroke="#fff" strokeWidth={2} />}
            </g>
          )}
        </svg>
      )}
      {indice !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 w-64 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg"
          style={{ left: Math.min(Math.max(x(indice) - 128, 0), Math.max(ancho - 256, 0)) }}
        >
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-slate-500">{meses[indice]}</p>
          <p className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-600"><span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: COLOR.actual }} />{nombreActual}</span>
            <strong className="whitespace-nowrap text-slate-900">{vAct !== null ? `${numero(vAct, decimales)} ${unidad}` : 'Sin datos aún'}</strong>
          </p>
          <p className="mt-0.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-600"><span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: COLOR.anterior }} />{nombreAnterior}</span>
            <strong className="whitespace-nowrap text-slate-900">{numero(vAnt, decimales)} {unidad}</strong>
          </p>
          {delta !== null && <div className="mt-2 border-t border-slate-100 pt-2"><Variacion valor={delta} /></div>}
        </div>
      )}
    </div>
  )
}

// ---------- Mancuernas: antes → ahora por ítem ----------

export interface FilaMancuerna {
  etiqueta: string
  detalle?: ReactNode
  actual: number
  anterior: number
  variacion: number | null
}

export function Mancuernas({ filas, unidad, decimales = 1, menosEsMejor = true, nombreActual, nombreAnterior }: {
  filas: FilaMancuerna[]
  unidad: string
  decimales?: number
  menosEsMejor?: boolean
  nombreActual: string
  nombreAnterior: string
}) {
  const max = Math.max(...filas.flatMap((f) => [f.actual, f.anterior]), 0) || 1
  const pct = (v: number) => (v / max) * 100
  return (
    <ul className="space-y-1">
      {filas.map((f, i) => {
        const mejora = f.variacion === null ? null : menosEsMejor ? f.variacion < 0 : f.variacion > 0
        const desde = Math.min(f.actual, f.anterior)
        const hasta = Math.max(f.actual, f.anterior)
        const retardo = `${200 + i * 70}ms`
        return (
          <li
            key={f.etiqueta}
            className="rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50 animar-aparecer"
            style={{ animationDelay: `${i * 60}ms` }}
            title={`${f.etiqueta}: ${nombreAnterior} ${numero(f.anterior, decimales)} ${unidad} → ${nombreActual} ${numero(f.actual, decimales)} ${unidad}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">{f.etiqueta}</p>
                {f.detalle && <p className="text-xs text-slate-500">{f.detalle}</p>}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-x-2">
                <p className="text-sm font-semibold text-slate-900">
                  {numero(f.actual, decimales)} <span className="font-normal text-slate-500">{unidad}</span>
                </p>
                <Variacion valor={f.variacion} menosEsMejor={menosEsMejor} />
              </div>
            </div>
            {/* Las capas miden lo mismo que la pista: translateX en % es % de la pista. El borde recorta las capas
                trasladadas (si no, desbordan la página) y el margen interno deja ver enteros los puntos de los extremos. */}
            <div className="mt-1 overflow-hidden px-2" aria-hidden>
            <div className="relative h-6">
              <div className="absolute inset-x-0 top-[11px] h-px bg-slate-200" />
              <div className="absolute inset-x-0 top-[9px] h-1.5 overflow-hidden">
                <div
                  className="h-full origin-left rounded-full animar-banda"
                  style={{
                    transform: `translateX(${pct(desde)}%) scaleX(${(pct(hasta) - pct(desde)) / 100})`,
                    ['--desde' as string]: `translateX(${pct(f.anterior)}%) scaleX(0)`,
                    animationDelay: retardo,
                    backgroundColor: mejora === null ? '#c4cdbe' : mejora ? '#bfe5bf' : '#f2c9c9',
                  }}
                />
              </div>
              <div className="pointer-events-none absolute inset-0" style={{ transform: `translateX(${pct(f.anterior)}%)` }}>
                <span className="absolute left-0 top-[5px] h-3.5 w-3.5 -ml-[7px] rounded-full ring-2 ring-white" style={{ backgroundColor: COLOR.anterior }} />
              </div>
              <div
                className="pointer-events-none absolute inset-0 animar-desplazar"
                style={{ transform: `translateX(${pct(f.actual)}%)`, ['--desde' as string]: `translateX(${pct(f.anterior)}%)`, animationDelay: retardo }}
              >
                <span className="absolute left-0 top-1 h-4 w-4 -ml-2 rounded-full shadow-sm ring-2 ring-white" style={{ backgroundColor: COLOR.actual }} />
              </div>
            </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ---------- Barras divergentes: variación % por ítem ----------

export function BarrasVariacion({ filas, menosEsMejor = true }: {
  filas: { etiqueta: string; detalle?: string; variacion: number | null }[]
  menosEsMejor?: boolean
}) {
  const max = Math.max(...filas.map((f) => Math.abs(f.variacion ?? 0)), 1)
  return (
    <ul className="space-y-2">
      {filas.map((f, i) => {
        const v = f.variacion ?? 0
        const mejora = menosEsMejor ? v < 0 : v > 0
        // La barra más larga deja 3.75rem libres para su etiqueta: nunca se sale del gráfico
        const ancho = `calc((50% - 3.75rem) * ${Math.abs(v) / max})`
        const Icono = v < 0 ? ArrowDownRight : ArrowUpRight
        const retardo = `${200 + i * 70}ms`
        return (
          <li key={f.etiqueta} className="grid grid-cols-1 items-center gap-x-3 sm:grid-cols-[minmax(0,13rem)_1fr] animar-aparecer" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800" title={f.etiqueta}>{f.etiqueta}</p>
              {f.detalle && <p className="truncate text-xs text-slate-500">{f.detalle}</p>}
            </div>
            <div className="relative h-8">
              <div className="absolute inset-y-0 left-1/2 w-px bg-slate-300" />
              <div
                className={`absolute top-1.5 h-5 animar-crecer ${v < 0 ? 'origin-right' : 'origin-left'}`}
                style={{
                  width: ancho,
                  [v < 0 ? 'right' : 'left']: '50%',
                  backgroundColor: mejora ? COLOR.bueno : COLOR.malo,
                  borderRadius: v < 0 ? '4px 0 0 4px' : '0 4px 4px 0',
                  opacity: 0.85,
                  animationDelay: retardo,
                }}
                title={`${f.etiqueta}: ${v > 0 ? '+' : ''}${numero(v, 1)} %`}
              />
              <span
                className="absolute top-1/2 inline-flex -translate-y-1/2 items-center gap-0.5 whitespace-nowrap text-xs font-semibold animar-desvanecer"
                style={{
                  color: mejora ? COLOR.textoBueno : COLOR.textoMalo,
                  [v < 0 ? 'right' : 'left']: `calc(50% + ${ancho} + 6px)`,
                  animationDelay: `${500 + i * 70}ms`,
                }}
              >
                <Icono className="h-3.5 w-3.5" />
                {v > 0 ? '+' : '−'}{numero(Math.abs(v), 1)} %
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ---------- Tabla equivalente (accesibilidad) ----------

export function TablaDatos({ columnas, filas }: { columnas: string[]; filas: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>{columnas.map((c, i) => <th key={c} className={`px-3 py-2 ${i ? 'text-right' : ''}`}>{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.map((f, i) => (
            <tr key={i}>{f.map((v, j) => <td key={j} className={`px-3 py-1.5 ${j ? 'text-right' : 'font-medium text-slate-800'}`}>{v}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
