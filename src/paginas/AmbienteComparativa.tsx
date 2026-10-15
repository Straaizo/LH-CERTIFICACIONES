import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeftRight, BarChart3, CalendarRange, Check, Database, Factory, Flame, Fuel, GitCompareArrows, Info, Leaf, Lightbulb,
  Loader2, Recycle, RotateCcw, SlidersHorizontal, Sparkles, Sprout, Table2, Target, TrendingDown, TrendingUp, X, Zap,
} from 'lucide-react'
import { api } from '../api'
import { useSesionActiva } from '../contexto/Sesion'
import { Boton, Campo, MensajeError, Tarjeta, Vacio, claseEntrada } from '../componentes/ui'
import { Selector } from '../componentes/Desplegable'
import { EsqueletoPanel } from '../componentes/Esqueletos'
import {
  BarrasVariacion, COLOR, LineaComparativa, Leyenda, Mancuernas, Minigrafico, TablaDatos, Variacion, numero,
  NumeroAnimado,
} from '../componentes/graficos'

interface Indicador {
  unidad_medida: string
  actual: number
  anterior: number
  variacion: number | null
  mensual_actual: number[]
  mensual_anterior: number[]
}

interface Comparativa {
  actual: { id: number; nombre: string; inicio: string; fin: string }
  anterior: { id: number; nombre: string } | null
  meses: string[]
  meses_comparados: number
  huella: {
    actual_a_la_fecha: number
    anterior_mismo_periodo: number
    anterior_total: number
    variacion: number | null
    proyeccion_cierre: number | null
    variacion_proyeccion: number | null
    mensual_actual: number[]
    mensual_anterior: number[]
    acumulado_actual: number[]
    acumulado_anterior: number[]
  }
  indicadores: Record<'combustibles' | 'gas' | 'electricidad' | 'fertilizantes' | 'reciclaje', Indicador>
  conceptos: { codigo: string; nombre: string; unidad_medida: string; actual: number; anterior: number; tco2e_actual: number; tco2e_anterior: number; variacion: number | null }[]
  sucursales: { unidad: { id: number; nombre: string; tipo: string }; tco2e_actual: number; tco2e_anterior: number; variacion: number | null }[]
  reciclaje_materiales: { nombre: string; actual: number; anterior: number; variacion: number | null }[]
}

const TARJETAS: { clave: keyof Comparativa['indicadores']; titulo: string; icono: typeof Fuel; menosEsMejor: boolean }[] = [
  { clave: 'combustibles', titulo: 'Diésel y bencina', icono: Fuel, menosEsMejor: true },
  { clave: 'gas', titulo: 'Gas', icono: Flame, menosEsMejor: true },
  { clave: 'electricidad', titulo: 'Electricidad', icono: Zap, menosEsMejor: true },
  { clave: 'fertilizantes', titulo: 'Fertilizantes', icono: Sprout, menosEsMejor: true },
  { clave: 'reciclaje', titulo: 'Reciclaje', icono: Recycle, menosEsMejor: false },
]

const corto = (t: string) => t.replace(/^(\d{4})-\d{2}(\d{2})$/, '$1-$2')

/** Revela el panel por tandas para repartir el trabajo de montarlo (sin congelar la animación). */
function useEtapas(total: number, cada = 110) {
  const [etapa, setEtapa] = useState(0)
  useEffect(() => {
    if (etapa >= total) return
    const t = setTimeout(() => setEtapa((e) => e + 1), etapa === 0 ? 30 : cada)
    return () => clearTimeout(t)
  }, [etapa, total, cada])
  return etapa
}

function Reserva({ alto }: { alto: string }) {
  return <div className={`hueso rounded-2xl ${alto}`} aria-hidden />
}

function Segmentado<T extends string>({ opciones, valor, onCambio, etiqueta }: {
  opciones: [T, string][]
  valor: T
  onCambio: (v: T) => void
  etiqueta: string
}) {
  return (
    <div role="group" aria-label={etiqueta} className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
      {opciones.map(([v, texto]) => (
        <button
          key={v}
          type="button"
          aria-pressed={valor === v}
          onClick={() => onCambio(v)}
          className={`min-h-8 rounded-lg px-3 text-sm font-semibold transition-colors ${
            valor === v ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {texto}
        </button>
      ))}
    </div>
  )
}

function BotonTabla({ activo, onClick }: { activo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
    >
      <Table2 className="h-4 w-4" /> {activo ? 'Ver gráfico' : 'Ver tabla'}
    </button>
  )
}

/** Frases con lo más relevante, armadas desde los datos (no hay texto fijo). */
function hallazgos(d: Comparativa): { tono: 'bueno' | 'malo' | 'neutro'; texto: ReactNode }[] {
  const ant = d.anterior?.nombre ?? 'la anterior'
  const salida: { tono: 'bueno' | 'malo' | 'neutro'; texto: ReactNode }[] = []
  const h = d.huella
  if (h.variacion !== null) {
    salida.push({
      tono: h.variacion <= 0 ? 'bueno' : 'malo',
      texto: <>La huella va <strong>{numero(Math.abs(h.variacion), 1)} % {h.variacion <= 0 ? 'bajo' : 'sobre'}</strong> la temporada {ant} en los mismos {d.meses_comparados} meses.</>,
    })
  }
  if (h.proyeccion_cierre !== null && h.variacion_proyeccion !== null && d.meses_comparados < 12) {
    salida.push({
      tono: h.variacion_proyeccion <= 0 ? 'bueno' : 'malo',
      texto: <>Si se mantiene el ritmo, la temporada cerraría en <strong>{numero(h.proyeccion_cierre, 0)} t CO₂e</strong>, {numero(Math.abs(h.variacion_proyeccion), 1)} % {h.variacion_proyeccion <= 0 ? 'menos' : 'más'} que {ant}.</>,
    })
  }
  const conVar = d.conceptos.filter((c) => c.variacion !== null)
  const mejor = [...conVar].sort((a, b) => (a.variacion ?? 0) - (b.variacion ?? 0))[0]
  const peor = [...conVar].sort((a, b) => (b.variacion ?? 0) - (a.variacion ?? 0))[0]
  if (mejor && (mejor.variacion ?? 0) < 0) {
    salida.push({ tono: 'bueno', texto: <>Mayor ahorro: <strong>{mejor.nombre}</strong>, {numero(Math.abs(mejor.variacion ?? 0), 1)} % menos ({numero(mejor.anterior - mejor.actual)} {mejor.unidad_medida}).</> })
  }
  if (peor && (peor.variacion ?? 0) > 0) {
    salida.push({ tono: 'malo', texto: <>Mayor alza: <strong>{peor.nombre}</strong>, {numero(peor.variacion ?? 0, 1)} % más ({numero(peor.actual - peor.anterior)} {peor.unidad_medida}). Conviene revisar la causa.</> })
  }
  const suc = d.sucursales.filter((s) => s.variacion !== null)
  if (suc.length > 1) {
    const sMejor = suc[0]
    const sPeor = suc[suc.length - 1]
    if ((sMejor.variacion ?? 0) < 0) salida.push({ tono: 'bueno', texto: <><strong>{sMejor.unidad.nombre}</strong> es la sucursal que más mejora ({numero(sMejor.variacion ?? 0, 1)} %).</> })
    if ((sPeor.variacion ?? 0) > 0) salida.push({ tono: 'malo', texto: <><strong>{sPeor.unidad.nombre}</strong> es la que más sube su huella (+{numero(sPeor.variacion ?? 0, 1)} %).</> })
  }
  const rec = d.indicadores.reciclaje
  if (rec.variacion !== null) {
    salida.push({
      tono: rec.variacion >= 0 ? 'bueno' : 'malo',
      texto: <>Reciclaje: <strong>{numero(rec.actual)} kg</strong>, {numero(Math.abs(rec.variacion), 1)} % {rec.variacion >= 0 ? 'más' : 'menos'} que al mismo período de {ant}.</>,
    })
  }
  return salida
}

function PanelComparativa({ d, cargando, acciones }: { d: Comparativa; cargando: boolean; acciones: ReactNode }) {
  const { filtros } = useSesionActiva()
  const etapa = useEtapas(4)
  const [vista, setVista] = useState<'acumulado' | 'mensual'>('acumulado')
  const [tablaHuella, setTablaHuella] = useState(false)
  const [tablaConceptos, setTablaConceptos] = useState(false)

  if (!d.anterior) return <Vacio>No hay una temporada anterior con la que comparar.</Vacio>
  if (!d.huella.anterior_total || !d.meses_comparados) {
    const sin = !d.meses_comparados ? d.actual.nombre : d.anterior.nombre
    return (
      <div className="space-y-4 animar-aparecer">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <p className="flex items-center gap-2 text-sm"><Info className="h-5 w-5 shrink-0" /> La temporada <strong>{sin}</strong> no tiene consumos registrados: elige otra para comparar.</p>
          {acciones}
        </div>
      </div>
    )
  }

  const nAct = corto(d.actual.nombre)
  const nAnt = corto(d.anterior.nombre)
  const h = d.huella
  const periodo = d.meses_comparados ? `${d.meses[0]} – ${d.meses[d.meses_comparados - 1]}` : 'sin meses con datos'
  const serieActual = vista === 'acumulado' ? h.acumulado_actual : h.mensual_actual
  const serieAnterior = vista === 'acumulado' ? h.acumulado_anterior : h.mensual_anterior
  const llave = `${d.actual.id}-${filtros.empresa_id ?? 0}-${filtros.unidad_id ?? 0}`

  return (
    // La llave reinicia las animaciones al cambiar de temporada, empresa o sucursal; al recargar se mantiene el gráfico atenuado
    <div key={llave} className={`space-y-5 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 animar-aparecer">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">Resultado</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            <span style={{ color: COLOR.actual }}>{d.actual.nombre}</span>
            <span className="mx-2 font-normal text-slate-400">vs</span>
            <span className="text-slate-600">{d.anterior.nombre}</span>
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
            <CalendarRange className="h-4 w-4" /> Comparado al mismo período: <strong className="font-semibold text-slate-800">{periodo}</strong>
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {acciones}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            <Info className="h-3.5 w-3.5" /> Datos ficticios de demostración
          </span>
        </div>
      </div>

      {/* Cifra principal + proyección */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-superficie p-6 shadow-[0_1px_2px_rgba(16,40,16,0.04)] lg:col-span-2 animar-aparecer">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Leaf className="h-4 w-4 text-emerald-700" /> Huella de carbono a la fecha</p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-3">
            <span className="text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl"><NumeroAnimado valor={h.actual_a_la_fecha} decimales={1} /></span>
            <span className="text-lg font-semibold text-slate-500">t CO₂e</span>
          </p>
          <div className="mt-3">
            <Variacion grande valor={h.variacion} contra={`vs ${d.anterior.nombre} al mismo período (${numero(h.anterior_mismo_periodo, 1)} t)`} />
          </div>
          <div className="mt-5">
            <div className="mb-1.5 flex justify-between text-xs text-slate-500">
              <span>Avance de la temporada</span>
              <span className="font-semibold text-slate-700">{d.meses_comparados} de 12 meses</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: '#dbe7f7' }}>
              <div className="h-full origin-left rounded-full animar-crecer" style={{ width: `${(d.meses_comparados / 12) * 100}%`, backgroundColor: COLOR.actual }} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-superficie p-6 shadow-[0_1px_2px_rgba(16,40,16,0.04)] animar-aparecer" style={{ animationDelay: '80ms' }}>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Factory className="h-4 w-4 text-slate-500" /> Proyección al cierre</p>
          {h.proyeccion_cierre !== null ? (
            <>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-slate-950"><NumeroAnimado valor={h.proyeccion_cierre} /></span>
                <span className="font-semibold text-slate-500">t CO₂e</span>
              </p>
              <div className="mt-2"><Variacion valor={h.variacion_proyeccion} contra={`vs ${numero(h.anterior_total)} t de ${nAnt}`} /></div>
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                Estimada con lo que va de temporada y el ritmo mensual de {d.anterior.nombre}. Se ajusta sola cada mes.
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Sin datos suficientes para proyectar.</p>
          )}
        </section>
      </div>

      {/* Indicadores */}
      {etapa < 1 ? <Reserva alto="h-[188px]" /> : (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {TARJETAS.map(({ clave, titulo, icono: Icono, menosEsMejor }, i) => {
          const ind = d.indicadores[clave]
          return (
            <section
              key={clave}
              className={`rounded-2xl border border-slate-200/80 bg-superficie p-4 shadow-[0_1px_2px_rgba(16,40,16,0.04)] animar-aparecer ${clave === 'reciclaje' ? 'col-span-2 md:col-span-1' : ''}`}
              style={{ animationDelay: `${120 + i * 60}ms` }}
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Icono className="h-4 w-4" /></span>
                {titulo}
              </p>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl"><NumeroAnimado valor={ind.actual} /></span>
                <span className="text-sm font-semibold text-slate-500">{ind.unidad_medida}</span>
              </p>
              <div className="mt-1"><Variacion valor={ind.variacion} menosEsMejor={menosEsMejor} /></div>
              <div className="mt-2"><Minigrafico actual={ind.mensual_actual} anterior={ind.mensual_anterior} /></div>
              <p className="text-xs text-slate-500">{nAnt}: {numero(ind.anterior)} {ind.unidad_medida}</p>
            </section>
          )
        })}
      </div>
      )}

      {/* Huella mes a mes */}
      {etapa < 2 ? <Reserva alto="h-[430px]" /> : (
      <Tarjeta
        titulo="Huella de carbono, mes a mes"
        acciones={
          <>
            <Segmentado etiqueta="Tipo de vista" valor={vista} onCambio={setVista} opciones={[['acumulado', 'Acumulada'], ['mensual', 'Mensual']]} />
            <BotonTabla activo={tablaHuella} onClick={() => setTablaHuella((v) => !v)} />
          </>
        }
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Leyenda actual={d.actual.nombre} anterior={d.anterior.nombre} />
          <p className="text-xs text-slate-500">t CO₂e · {vista === 'acumulado' ? 'suma desde el inicio de la temporada' : 'total de cada mes'}</p>
        </div>
        {tablaHuella ? (
          <TablaDatos
            columnas={['Mes', d.actual.nombre, d.anterior.nombre, 'Variación']}
            filas={d.meses.map((mes, i) => {
              const a = serieActual[i]
              const b = serieAnterior[i]
              return [mes, a === undefined ? '—' : numero(a, 1), numero(b, 1), a === undefined || !b ? '—' : `${a >= b ? '+' : '−'}${numero(Math.abs(((a - b) / b) * 100), 1)} %`]
            })}
          />
        ) : (
          <LineaComparativa
            meses={d.meses}
            actual={serieActual}
            anterior={serieAnterior}
            nombreActual={d.actual.nombre}
            nombreAnterior={d.anterior.nombre}
            unidad="t CO₂e"
          />
        )}
      </Tarjeta>
      )}

      {etapa < 3 ? <Reserva alto="h-[520px]" /> : (
      <div className="grid gap-4 xl:grid-cols-2">
        <Tarjeta
          titulo="¿Dónde se genera la huella?"
          acciones={<BotonTabla activo={tablaConceptos} onClick={() => setTablaConceptos((v) => !v)} />}
        >
          <p className="mb-3 text-sm text-slate-600">
            Por concepto, en t CO₂e, al mismo período. El punto <span className="font-semibold" style={{ color: COLOR.actual }}>azul</span> es {d.actual.nombre} y el <span className="font-semibold text-slate-600">gris</span>, {d.anterior.nombre}.
          </p>
          {tablaConceptos ? (
            <TablaDatos
              columnas={['Concepto', `${nAct} (cantidad)`, `${nAnt} (cantidad)`, `${nAct} t CO₂e`, `${nAnt} t CO₂e`, 'Variación']}
              filas={d.conceptos.map((c) => [
                c.nombre, `${numero(c.actual)} ${c.unidad_medida}`, `${numero(c.anterior)} ${c.unidad_medida}`,
                numero(c.tco2e_actual, 1), numero(c.tco2e_anterior, 1),
                c.variacion === null ? '—' : `${c.variacion > 0 ? '+' : '−'}${numero(Math.abs(c.variacion), 1)} %`,
              ])}
            />
          ) : (
            <Mancuernas
              filas={[...d.conceptos].sort((a, b) => b.tco2e_actual - a.tco2e_actual).map((c) => ({
                etiqueta: c.nombre,
                detalle: `${numero(c.actual)} ${c.unidad_medida} (antes ${numero(c.anterior)})`,
                actual: c.tco2e_actual,
                anterior: c.tco2e_anterior,
                variacion: c.variacion,
              }))}
              unidad="t CO₂e"
              nombreActual={d.actual.nombre}
              nombreAnterior={d.anterior.nombre}
            />
          )}
        </Tarjeta>

        <Tarjeta titulo="¿Qué sucursal mejora y cuál empeora?">
          <p className="mb-3 text-sm text-slate-600">
            Variación de la huella de cada sucursal frente a {d.anterior.nombre}, al mismo período.
            <span className="ml-1 inline-flex items-center gap-1 font-semibold" style={{ color: COLOR.textoBueno }}><TrendingDown className="h-4 w-4" />izquierda mejora</span>
            <span className="ml-2 inline-flex items-center gap-1 font-semibold" style={{ color: COLOR.textoMalo }}><TrendingUp className="h-4 w-4" />derecha empeora</span>
          </p>
          {d.sucursales.length ? (
            <BarrasVariacion
              filas={d.sucursales.map((s) => ({
                etiqueta: s.unidad.nombre,
                detalle: `${numero(s.tco2e_actual, 1)} t (antes ${numero(s.tco2e_anterior, 1)})`,
                variacion: s.variacion,
              }))}
            />
          ) : (
            <Vacio>Sin consumos registrados.</Vacio>
          )}
        </Tarjeta>
      </div>
      )}

      {etapa < 4 ? <Reserva alto="h-[420px]" /> : (
      <div className="grid gap-4 xl:grid-cols-2">
        <Tarjeta titulo="Lo más importante">
          <ul className="space-y-3">
            {hallazgos(d).map((item, i) => (
              <li key={i} className="flex gap-3 animar-aparecer" style={{ animationDelay: `${i * 80}ms` }}>
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: item.tono === 'bueno' ? '#ecf8ec' : item.tono === 'malo' ? '#fcefef' : '#eef3fb',
                    color: item.tono === 'bueno' ? COLOR.textoBueno : item.tono === 'malo' ? COLOR.textoMalo : COLOR.actual,
                  }}
                >
                  {item.tono === 'bueno' ? <TrendingDown className="h-4 w-4" /> : item.tono === 'malo' ? <TrendingUp className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
                </span>
                <p className="text-sm leading-relaxed text-slate-700">{item.texto}</p>
              </li>
            ))}
          </ul>
        </Tarjeta>

        <Tarjeta titulo="Reciclaje por material">
          <p className="mb-3 text-sm text-slate-600">Kilos reciclados al mismo período. Aquí subir es mejorar.</p>
          {d.reciclaje_materiales.length ? (
            <Mancuernas
              filas={d.reciclaje_materiales.map((m) => ({ etiqueta: m.nombre, actual: m.actual, anterior: m.anterior, variacion: m.variacion }))}
              unidad="kg"
              decimales={0}
              menosEsMejor={false}
              nombreActual={d.actual.nombre}
              nombreAnterior={d.anterior.nombre}
            />
          ) : (
            <Vacio>Sin reciclaje registrado.</Vacio>
          )}
        </Tarjeta>
      </div>
      )}
    </div>
  )
}

// ---------- Armado de la comparativa (a pedido, con etapas animadas) ----------

const PASOS: { titulo: string; detalle: (a: string, b: string) => string; icono: typeof Leaf }[] = [
  { titulo: 'Reuniendo consumos', detalle: (a, b) => `Combustibles, electricidad, fertilizantes y reciclaje de ${a} y ${b}`, icono: Database },
  { titulo: 'Calculando la huella de carbono', detalle: () => 'Con los factores de emisión de cada temporada', icono: Leaf },
  { titulo: 'Comparando al mismo período', detalle: () => 'Mes a mes, por concepto y por sucursal', icono: GitCompareArrows },
  { titulo: 'Proyectando el cierre', detalle: () => 'Y detectando lo más importante', icono: Sparkles },
]
const MS_POR_PASO = 650

type Fase = 'inicio' | 'armando' | 'listo'

export function ComparativaTemporadas() {
  const { catalogos, filtros } = useSesionActiva()
  const temporadas = [...catalogos.temporadas].sort((a, b) => b.inicio.localeCompare(a.inicio))
  const porDefecto = filtros.temporada_id ?? temporadas.find((t) => t.actual)?.id ?? temporadas[0]?.id
  const siguienteMasAntigua = (id: number | undefined) => {
    const i = temporadas.findIndex((t) => t.id === id)
    return temporadas[i + 1]?.id ?? temporadas.find((t) => t.id !== id)?.id
  }
  const [actualId, setActualId] = useState<number | undefined>(porDefecto)
  const [anteriorId, setAnteriorId] = useState<number | undefined>(siguienteMasAntigua(porDefecto))
  const [fase, setFase] = useState<Fase>('inicio')
  const [paso, setPaso] = useState(0)
  const [datos, setDatos] = useState<Comparativa | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recargando, setRecargando] = useState(false)
  const turno = useRef(0)
  const nombre = (id: number | undefined) => temporadas.find((t) => t.id === id)?.nombre ?? '—'
  const parametros = { empresa_id: filtros.empresa_id, unidad_id: filtros.unidad_id, temporada_id: actualId, anterior_id: anteriorId }

  const armar = async () => {
    if (!actualId || !anteriorId) return
    const id = ++turno.current
    setError(null)
    setFase('armando')
    setPaso(0)
    const animacion = (async () => {
      const espera = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 120 : MS_POR_PASO
      for (let i = 1; i <= PASOS.length; i++) {
        await new Promise((r) => setTimeout(r, espera))
        if (turno.current !== id) return
        setPaso(i)
      }
    })()
    try {
      const [respuesta] = await Promise.all([api.get<Comparativa>('/ambiente/comparativa', parametros), animacion])
      if (turno.current !== id) return
      setDatos(respuesta)
      await new Promise((r) => setTimeout(r, 250))
      if (turno.current === id) setFase('listo')
    } catch (e) {
      if (turno.current !== id) return
      setError(e instanceof Error ? e.message : 'No se pudo armar la comparativa')
      setFase('inicio')
    }
  }

  // Con la comparativa armada, un cambio de empresa o sucursal en el encabezado la actualiza sin rehacer la animación
  useEffect(() => {
    if (fase !== 'listo' || !actualId || !anteriorId) return
    let vigente = true
    setRecargando(true)
    api.get<Comparativa>('/ambiente/comparativa', parametros)
      .then((r) => vigente && setDatos(r))
      .catch((e: Error) => vigente && setError(e.message))
      .finally(() => vigente && setRecargando(false))
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.empresa_id, filtros.unidad_id])

  if (fase === 'listo' && datos) {
    return (
      <PanelComparativa
        d={datos}
        cargando={recargando}
        acciones={
          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" icono={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setFase('inicio')}>
              Cambiar temporadas
            </Boton>
            <Boton variante="secundario" icono={<RotateCcw className="h-4 w-4" />} onClick={() => void armar()}>
              Volver a armar
            </Boton>
          </div>
        }
      />
    )
  }

  const empresa = catalogos.empresas.find((e) => e.id === filtros.empresa_id)
  const sucursal = catalogos.unidades.find((u) => u.id === filtros.unidad_id)
  const avance = Math.round((paso / PASOS.length) * 100)

  return (
    // Mientras se elige, la tarjeta queda centrada en la ventana
    <div className={`space-y-5 ${fase === 'inicio' ? 'flex min-h-full flex-col justify-center' : ''}`}>
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-[#eef3fb] via-superficie to-emerald-50/60 p-6 shadow-[0_1px_2px_rgba(16,40,16,0.04)] sm:p-8 animar-escala">
        {fase === 'inicio' ? (
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">¿Qué temporadas quieres comparar?</h2>
              <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-slate-600">
                Compara el consumo, la huella de carbono y el reciclaje de dos temporadas, <strong className="font-semibold text-slate-800">al mismo período</strong>,
                y muestra si se está mejorando o empeorando, con gráficos y conclusiones.
              </p>
              <ul className="mt-5 grid gap-2 text-sm text-slate-700 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {[
                  { icono: TrendingDown, texto: 'Huella mes a mes' },
                  { icono: GitCompareArrows, texto: 'Mejoras y alzas por concepto y sucursal' },
                  { icono: Target, texto: 'Proyección al cierre' },
                ].map(({ icono: Icono, texto }) => (
                  <li key={texto} className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm"><Icono className="h-4 w-4" /></span>
                    {texto}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <Campo etiqueta="Temporada a analizar">
                  <Selector className={claseEntrada} value={actualId ?? ''} onChange={(e) => {
                    const id = Number(e.target.value)
                    setActualId(id)
                    if (id === anteriorId) setAnteriorId(siguienteMasAntigua(id))
                  }}>
                    {temporadas.map((t) => <option key={t.id} value={t.id}>{t.nombre}{t.actual ? ' (actual)' : ''}</option>)}
                  </Selector>
                </Campo>
                <button
                  type="button"
                  aria-label="Intercambiar temporadas"
                  title="Intercambiar"
                  onClick={() => { setActualId(anteriorId); setAnteriorId(actualId) }}
                  className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:rotate-180 hover:border-slate-300 hover:text-slate-900"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </button>
                <Campo etiqueta="Comparar con">
                  <Selector className={claseEntrada} value={anteriorId ?? ''} onChange={(e) => setAnteriorId(Number(e.target.value))}>
                    {temporadas.filter((t) => t.id !== actualId).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </Selector>
                </Campo>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Alcance: {empresa?.nombre ?? 'todas las empresas'} · {sucursal?.nombre ?? 'todas las sucursales'}. Se cambia en el encabezado.
              </p>
              <MensajeError error={error} />
              <button
                type="button"
                onClick={() => void armar()}
                disabled={!actualId || !anteriorId}
                className="group mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 text-base font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles className="h-5 w-5 transition-transform group-hover:rotate-12 group-hover:scale-110" />
                Armar comparativa
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">Armando la comparativa</p>
                <p className="mt-1 text-xl font-bold tracking-tight text-slate-950">
                  <span style={{ color: COLOR.actual }}>{nombre(actualId)}</span>
                  <span className="mx-2 font-normal text-slate-400">vs</span>
                  <span className="text-slate-600">{nombre(anteriorId)}</span>
                </p>
              </div>
              <span className="text-3xl font-bold tracking-tight text-slate-900">{avance}%</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white shadow-inner">
              <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${avance}%`, background: `linear-gradient(90deg, ${COLOR.actual}, #0b7a0b)` }} />
            </div>
            <ol className="mt-6 space-y-3">
              {PASOS.map((p, i) => {
                const estado = i < paso ? 'listo' : i === paso ? 'activo' : 'pendiente'
                const Icono = p.icono
                return (
                  <li
                    key={p.titulo}
                    className={`flex items-start gap-3 rounded-2xl border p-3 transition-all duration-300 animar-aparecer ${
                      estado === 'activo' ? 'border-sky-200 bg-white shadow-sm' : estado === 'listo' ? 'border-transparent bg-white/60' : 'border-transparent opacity-50'
                    }`}
                    style={{ animationDelay: `${i * 90}ms` }}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        estado === 'listo' ? 'bg-emerald-600 text-white' : estado === 'activo' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {estado === 'listo' ? <Check className="h-5 w-5 animar-pop" /> : estado === 'activo' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icono className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                      <p className={`font-semibold ${estado === 'pendiente' ? 'text-slate-500' : 'text-slate-900'}`}>{p.titulo}</p>
                      <p className="text-sm text-slate-500">{p.detalle(nombre(actualId), nombre(anteriorId))}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </section>

      {fase === 'armando' && (
        <div className="pointer-events-none opacity-50" aria-hidden>
          <EsqueletoPanel />
        </div>
      )}
    </div>
  )
}

// ---------- Ventana de la comparativa (se abre desde el botón del encabezado) ----------

export function VentanaComparativa({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const cerrar = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!abierta) return
    const previo = document.activeElement as HTMLElement | null
    cerrar.current?.focus()
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', tecla)
    return () => {
      window.removeEventListener('keydown', tecla)
      previo?.focus?.()
    }
  }, [abierta, onCerrar])
  if (!abierta) return null
  return (
    <div className="fixed inset-0 z-50 flex bg-slate-950/55 animar-velo sm:p-4 lg:p-6" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-comparativa"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex h-full w-full max-w-[1400px] flex-col overflow-hidden bg-fondo shadow-2xl sm:rounded-3xl animar-subir"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200/80 bg-superficie px-4 py-3 sm:px-6 sm:py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ backgroundColor: COLOR.actual }}>
            <BarChart3 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="titulo-comparativa" className="truncate text-lg font-bold tracking-tight text-slate-950 sm:text-xl">Comparativa de temporadas</h2>
            <p className="hidden truncate text-sm text-slate-500 sm:block">Consumo, huella de carbono y reciclaje de dos temporadas, al mismo período</p>
          </div>
          <button
            ref={cerrar}
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar comparativa"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="scroll-principal min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
          <ComparativaTemporadas />
        </div>
      </div>
    </div>
  )
}
