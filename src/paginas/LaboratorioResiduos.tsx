import { useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle, Check, CheckCircle2, CircleHelp, FileSpreadsheet, Globe2, Lock, Plus, RefreshCw, Trash2, Upload, X, XCircle,
} from 'lucide-react'
import { api } from '../api'
import { useAccion, useDatos } from '../hooks'
import { fecha, num } from '../formato'
import { useSesionActiva } from '../contexto/Sesion'
import {
  Boton, Campo, Cargando, ElegirArchivo, EncabezadoPagina, Insignia, MensajeError, Modal, Tarjeta, Vacio, claseEntrada,
  useAviso,
} from '../componentes/ui'
import { useConfirmarRepetido } from '../componentes/ConfirmarRepetido'

// ---------- Tipos de la API ----------

/** Límites vigentes de una especie: salen de la planilla ASOEX más reciente que la trae */
interface FrutaAsoex {
  nombre: string
  paises: string[]
  sustancias: number
  proximos_cambios: string[]
  carga_id: string
  nombre_archivo: string
  fecha: string | null
}
interface CargaAsoex { id: string; nombre_archivo: string; fecha: string | null; cargado_en: string; frutas: string[] }
/** Carta de mercados de destino de GESEX: países por especie para una temporada y empresa */
interface CartaDestino {
  id: string
  empresa_id: number | null
  empresa: string | null
  temporada: string | null
  destinatario: string | null
  fecha: string | null
  destinos: Record<string, string[]>
  nombre_archivo: string
}
interface EstadoAsoex { frutas: FrutaAsoex[]; historial: CargaAsoex[]; cartas: CartaDestino[] }
interface ResultadoCarga { nombre_archivo: string; repetido: boolean; frutas: string[]; fecha: string | null }

/** 'UVA DE MESA / LOBESIA BOTRANA' → 'Uva de mesa / Lobesia botrana' */
const nombreEspecie = (n: string) => n.toLowerCase().replace(/(^|\/\s*)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase())
const esAgenda = (archivo: string) => /agenda/i.test(archivo)

interface LecturaMRL {
  texto_leido: boolean
  fruta: string | null
  variedad: string | null
  punto: string | null
  fecha_muestreo: string | null
  laboratorio: string | null
  productor: string | null
  codigo_sucursal: number | null
  unidad_id: number | null
  especie_id: string | null
  residuos: { sustancia: string; valor: number | null; valor_texto: string | null }[]
  advertencias: string[]
}

type EstadoCelda = 'cumple' | 'excede' | 'sin_tolerancia' | 'exento' | 'sin_lmr' | 'no_detectado'
type EstadoPais = 'apto' | 'no_apto' | 'revisar'

interface Comparacion {
  fruta: string
  paises: string[]
  detectados: number
  filas: {
    sustancia: string
    sustancia_asoex: string | null
    aproximada: boolean
    valor: number | null
    valor_texto: string | null
    detectado: boolean
    por_pais: Record<string, { ppm: number | null; condicion: string | null; carencia_dias: number | null; estado: EstadoCelda }>
  }[]
  conclusiones: { pais: string; estado: EstadoPais; texto: string; motivos: string[] }[]
  resumen: Record<EstadoPais, string[]>
  asoex: { nombre_archivo: string; fecha: string | null }
  proximos_cambios: string[]
}

interface FilaResiduo { clave: number; sustancia: string; valor: string; valor_texto: string | null }

let contador = 0
const nuevaFila = (sustancia = '', valor: number | null = null, valor_texto: string | null = null): FilaResiduo => ({
  clave: ++contador, sustancia, valor: valor === null ? '' : String(valor).replace('.', ','), valor_texto,
})

const CLAVE_PAISES = 'certificaciones.mrl.paises'
function paisesGuardados(fruta: string): string[] {
  try {
    return (JSON.parse(localStorage.getItem(CLAVE_PAISES) ?? '{}') as Record<string, string[]>)[fruta] ?? []
  } catch {
    return []
  }
}
function guardarPaises(fruta: string, paises: string[]) {
  try {
    const todo = JSON.parse(localStorage.getItem(CLAVE_PAISES) ?? '{}') as Record<string, string[]>
    localStorage.setItem(CLAVE_PAISES, JSON.stringify({ ...todo, [fruta]: paises }))
  } catch {
    /* almacenamiento no disponible */
  }
}

// ---------- Presentación del resultado ----------

const CELDA: Record<EstadoCelda, { clase: string; icono: ReactNode; titulo: string }> = {
  cumple: { clase: 'bg-emerald-50 text-emerald-800', icono: <Check className="h-3.5 w-3.5" />, titulo: 'Dentro del límite' },
  excede: { clase: 'bg-red-50 text-red-700 font-semibold', icono: <X className="h-3.5 w-3.5" />, titulo: 'Supera el límite' },
  sin_tolerancia: { clase: 'bg-red-50 text-red-700 font-semibold', icono: <X className="h-3.5 w-3.5" />, titulo: 'Sin tolerancia (ST): no se acepta residuo' },
  exento: { clase: 'bg-slate-50 text-slate-600', icono: <Check className="h-3.5 w-3.5" />, titulo: 'Exento (EX)' },
  sin_lmr: { clase: 'bg-amber-50 text-amber-800', icono: <CircleHelp className="h-3.5 w-3.5" />, titulo: 'ASOEX no informa límite' },
  no_detectado: { clase: 'text-slate-400', icono: null, titulo: 'No detectado' },
}

const PAIS: Record<EstadoPais, { tono: 'verde' | 'rojo' | 'amarillo'; etiqueta: string; icono: ReactNode; borde: string }> = {
  apto: { tono: 'verde', etiqueta: 'Se puede enviar', icono: <CheckCircle2 className="h-5 w-5 text-emerald-600" />, borde: 'border-emerald-200' },
  no_apto: { tono: 'rojo', etiqueta: 'No se puede enviar', icono: <XCircle className="h-5 w-5 text-red-600" />, borde: 'border-red-200' },
  revisar: { tono: 'amarillo', etiqueta: 'Revisar', icono: <CircleHelp className="h-5 w-5 text-amber-600" />, borde: 'border-amber-200' },
}

function textoLimite(c: Comparacion['filas'][number]['por_pais'][string]): string {
  if (c.condicion === 'ST') return 'ST'
  if (c.condicion === 'EX') return 'EX'
  return c.ppm === null ? '—' : num(c.ppm)
}

function Resultado({ r }: { r: Comparacion }) {
  const n = (e: EstadoPais) => r.resumen[e]?.length ?? 0
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Insignia tono="verde">{n('apto')} se pueden enviar</Insignia>
        <Insignia tono="rojo">{n('no_apto')} no se pueden enviar</Insignia>
        {n('revisar') > 0 && <Insignia tono="amarillo">{n('revisar')} por revisar</Insignia>}
        <span className="text-slate-500">
          {r.fruta.toLowerCase()} · {r.detectados} residuos detectados · ASOEX {r.asoex.fecha ? fecha(r.asoex.fecha) : r.asoex.nombre_archivo}
        </span>
      </div>

      {/* Matriz: residuo × país, con el límite de ASOEX en cada celda */}
      <Tarjeta titulo="Comparación por residuo">
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="sticky left-0 z-10 bg-superficie py-2 pr-3 font-semibold">Residuo</th>
                <th className="hidden px-2 py-2 text-right font-semibold sm:table-cell">Detectado (ppm)</th>
                {r.paises.map((p) => (
                  <th key={p} className="px-2 py-2 text-center font-semibold">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.filas.map((f) => (
                <tr key={f.sustancia} className="border-t border-slate-100">
                  <td className="sticky left-0 z-10 max-w-[9.5rem] border-t border-slate-100 bg-superficie py-2 pr-3 shadow-[6px_0_8px_-8px_rgba(16,40,16,0.25)] sm:max-w-none sm:shadow-none">
                    <span className="block break-words font-medium text-slate-900">{f.sustancia_asoex ?? f.sustancia}</span>
                    {/* En el celular, el valor detectado va bajo el nombre */}
                    <span className="block text-xs tabular-nums text-slate-500 sm:hidden">
                      {f.detectado ? `${num(f.valor!)} ppm` : (f.valor_texto ?? 'No detectado')}
                    </span>
                    {f.aproximada && <span className="block text-xs text-amber-700">Informe: {f.sustancia}</span>}
                    {!f.sustancia_asoex && <span className="block text-xs text-amber-700">No figura en ASOEX</span>}
                  </td>
                  <td className="hidden border-t border-slate-100 px-2 py-2 text-right tabular-nums sm:table-cell">
                    {f.detectado ? <span className="font-semibold text-slate-900">{num(f.valor!)}</span>
                      : <span className="text-slate-400">{f.valor_texto ?? 'ND'}</span>}
                  </td>
                  {r.paises.map((p) => {
                    const c = f.por_pais[p]
                    const v = CELDA[c.estado]
                    return (
                      <td key={p} className="border-t border-slate-100 px-1 py-1 text-center">
                        <span title={`${v.titulo}${c.carencia_dias ? ` · carencia ${c.carencia_dias} días` : ''}`}
                          className={`inline-flex min-w-16 items-center justify-center gap-1 rounded-md px-2 py-1 tabular-nums ${v.clase}`}>
                          {v.icono}{textoLimite(c)}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Cada celda muestra el límite de ASOEX (ppm). <strong>ST</strong>: sin tolerancia, no se acepta residuo.{' '}
          <strong>EX</strong>: exento. <strong>—</strong>: ASOEX no informa límite.
        </p>
      </Tarjeta>

      {/* Conclusión, debajo de la comparación: a qué país se puede enviar y por qué no a los otros */}
      <Tarjeta titulo="Conclusión por país">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {r.conclusiones.map((c) => {
            const v = PAIS[c.estado]
            return (
              <li key={c.pais} className={`rounded-2xl border bg-white p-4 ${v.borde}`}>
                <div className="flex items-center gap-2">
                  {v.icono}
                  <span className="font-semibold text-slate-900">{c.pais}</span>
                  <span className="ml-auto"><Insignia tono={v.tono}>{v.etiqueta}</Insignia></span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{c.texto}</p>
                {c.motivos.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {c.motivos.map((m) => (
                      <li key={m} className={`flex gap-2 ${c.estado === 'no_apto' ? 'text-red-700' : 'text-amber-800'}`}>
                        <span aria-hidden>•</span>{m}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
        {r.proximos_cambios.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Próximos cambios anunciados por ASOEX</p>
            <ul className="mt-1 list-disc pl-5">{r.proximos_cambios.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        )}
      </Tarjeta>
    </div>
  )
}

// ---------- Carga de la tabla ASOEX ----------

function CargarAsoex({ abierta, onCerrar, onCargada, especie, cargadas, historial }: {
  abierta: boolean
  onCerrar: () => void
  onCargada: (r: ResultadoCarga[]) => void
  /** Si se abre desde una especie: se pide su agenda */
  especie?: string
  cargadas: FrutaAsoex[]
  /** Planillas ya subidas: el aviso aparece apenas se elige el archivo */
  historial: CargaAsoex[]
}) {
  const [archivos, setArchivos] = useState<File[]>([])
  const entrada = useRef<HTMLInputElement>(null)
  const { ocupado, error, ejecutar } = useAccion()
  const repetido = useConfirmarRepetido()
  const enviar = () => void ejecutar(async () => {
    if (!archivos.length) throw new Error('Elige al menos una planilla de ASOEX')
    const r = await repetido.intentar((reemplazar) => {
      const datos = new FormData()
      archivos.forEach((a) => datos.append('archivos', a))
      datos.append('reemplazar', String(reemplazar))
      return api.post<{ cargas: ResultadoCarga[] }>('/laboratorio/asoex', datos)
    })
    if (!r) return
    setArchivos([])
    onCargada(r.cargas)
    onCerrar()
  })
  return (
    <Modal abierto={abierta} onCerrar={onCerrar} titulo={especie ? `Actualizar límites de ${nombreEspecie(especie)}` : 'Cargar límites ASOEX'} ancho="max-w-lg">
      <div className="space-y-4">
        {repetido.nodo}
        {especie ? (
          <p className="text-sm text-slate-600">
            Sube la agenda de pesticidas de <strong>{nombreEspecie(especie)}</strong> descargada desde Frutas de Chile
            (por ejemplo, <em>AgendaPesticidasFdch_{especie.replace(/\s+/g, '')}_….xlsx</em>). Desde ahora se compara con ella; la anterior queda en el historial.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Sube la <strong>agenda de pesticidas de cada especie</strong> (por ejemplo, <em>AgendaPesticidasFdch_CEREZAS_….xlsx</em>)
              o la planilla general <em>LMR ASOEX dd-mm-aaaa.xlsx</em>. Puedes elegir varias a la vez.
            </p>
            <p className="text-sm text-slate-600">Para cada especie se usan los límites de la planilla más reciente; las anteriores quedan en el historial.</p>
          </>
        )}
        <div className="rounded-xl border border-dashed border-slate-300 p-3">
          <Boton variante="secundario" icono={<FileSpreadsheet className="h-4 w-4" />} onClick={() => entrada.current?.click()}>
            Elegir planillas
          </Boton>
          <input ref={entrada} type="file" accept=".xlsx,.xlsm" multiple className="hidden"
            onChange={(e) => { setArchivos(Array.from(e.target.files ?? [])); e.target.value = '' }} />
          {archivos.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {archivos.map((a) => {
                const ya = historial.find((h) => h.nombre_archivo === a.name)
                return (
                  <li key={a.name} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate" title={a.name}>{a.name}</span>
                    {ya && <Insignia tono="amarillo">Ya cargada{ya.fecha ? ` · ${fecha(ya.fecha)}` : ''}</Insignia>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <MensajeError error={error} />
        {!especie && cargadas.length > 0 && (
          <details className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-slate-700">Límites cargados hoy ({cargadas.length} especies)</summary>
            <ul className="mt-2 space-y-1 text-slate-600">
              {cargadas.map((f) => (
                <li key={f.nombre} className="flex justify-between gap-3">
                  <span>{nombreEspecie(f.nombre)}</span>
                  <span className="text-right text-slate-500">{esAgenda(f.nombre_archivo) ? 'Agenda' : 'Planilla general'}{f.fecha ? ` · ${fecha(f.fecha)}` : ''}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton icono={<Upload className="h-4 w-4" />} ocupado={ocupado} disabled={!archivos.length} onClick={enviar}>
            {archivos.length > 1 ? `Cargar ${archivos.length} planillas` : 'Cargar'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

function CargarCarta({ abierta, onCerrar, onCargada, cartas }: {
  abierta: boolean
  onCerrar: () => void
  onCargada: (c: CartaDestino) => void
  cartas: CartaDestino[]
}) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const { ocupado, error, ejecutar } = useAccion()
  const repetido = useConfirmarRepetido()
  const enviar = () => void ejecutar(async () => {
    if (!archivo) throw new Error('Elige la carta de destino')
    const r = await repetido.intentar((reemplazar) => {
      const datos = new FormData()
      datos.append('archivo', archivo)
      datos.append('reemplazar', String(reemplazar))
      return api.post<{ carta: CartaDestino }>('/laboratorio/destinos', datos)
    })
    if (!r) return
    setArchivo(null)
    onCargada(r.carta)
    onCerrar()
  })
  return (
    <Modal abierto={abierta} onCerrar={onCerrar} titulo="Carta de destino" ancho="max-w-lg">
      <div className="space-y-4">
        {repetido.nodo}
        <p className="text-sm text-slate-600">
          Sube la carta de mercados de destino que entrega GESEX (PDF). La aplicación lee la empresa, la temporada y los países de cada especie,
          y los deja marcados al comparar un informe de esa especie.
        </p>
        <ElegirArchivo aceptar=".pdf" onCambio={setArchivo} texto="Elegir carta" />
        {archivo && cartas.some((c) => c.nombre_archivo === archivo.name) && (
          <p className="flex items-center gap-2 text-sm text-amber-800">
            <Insignia tono="amarillo">Ya cargada</Insignia> Esta carta ya está subida; al cargar podrás reemplazarla.
          </p>
        )}
        <MensajeError error={error} />
        {cartas.length > 0 && (
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <p className="font-medium text-slate-700">Cartas cargadas</p>
            <ul className="mt-1 space-y-2 text-slate-600">
              {cartas.map((c) => (
                <li key={c.id}>
                  <span className="font-medium text-slate-800">{c.empresa ?? c.destinatario ?? 'Empresa sin reconocer'}</span>
                  {c.temporada && <> · temporada {c.temporada}</>}{c.fecha && <> · {fecha(c.fecha)}</>}
                  <span className="block text-xs text-slate-500">{Object.keys(c.destinos).map(nombreEspecie).join(', ')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton icono={<Upload className="h-4 w-4" />} ocupado={ocupado} disabled={!archivo} onClick={enviar}>Cargar</Boton>
        </div>
      </div>
    </Modal>
  )
}

// ---------- Panel ----------

export function ResiduosDestinos() {
  const { puede, catalogos } = useSesionActiva()
  const puedeEditar = puede('LABORATORIO_EDITAR')
  const asoex = useDatos<EstadoAsoex>('/laboratorio/asoex')
  const frutas = useMemo(() => asoex.datos?.frutas ?? [], [asoex.datos])
  const hayAsoex = frutas.length > 0

  // undefined = cerrado · '' = carga general · 'CEREZAS' = actualizar esa especie
  const [cargarPara, setCargarPara] = useState<string | undefined>(undefined)
  const [cartaAbierta, setCartaAbierta] = useState(false)
  const [fruta, setFruta] = useState('')
  const [paises, setPaises] = useState<string[]>([])
  const [filas, setFilas] = useState<FilaResiduo[]>([nuevaFila()])
  const [nombreInforme, setNombreInforme] = useState('')
  const [lectura, setLectura] = useState<LecturaMRL | null>(null)
  const [resultado, setResultado] = useState<Comparacion | null>(null)
  const leer = useAccion()
  const comparar = useAccion()
  const { avisar, nodo: nodoAviso } = useAviso()

  const frutaActual = frutas.find((f) => f.nombre === fruta)

  // Carta de destino que aplica: la de la empresa del informe; si no hay, la más reciente que trae la especie
  const cartaPara = (f: string, unidadId: number | null) => {
    const cartas = (asoex.datos?.cartas ?? []).filter((c) => c.destinos[f]?.length)
    const empresa = catalogos.unidades.find((u) => u.id === unidadId)?.empresa_id
    const propia = cartas.find((c) => empresa != null && c.empresa_id === empresa)
    return { carta: propia ?? cartas[0] ?? null, deOtraEmpresa: !propia && !!cartas[0] && empresa != null }
  }
  const { carta, deOtraEmpresa } = cartaPara(fruta, lectura?.unidad_id ?? null)
  const paisesCarta = (f: string, c: CartaDestino | null) => {
    const enAsoex = new Set(frutas.find((x) => x.nombre === f)?.paises ?? [])
    return (c?.destinos[f] ?? []).filter((p) => enAsoex.has(p))
  }
  const deCarta = paisesCarta(fruta, carta)
  const fueraDeAsoex = (carta?.destinos[fruta] ?? []).filter((p) => !(frutaActual?.paises ?? []).includes(p))
  const igualACarta = deCarta.length > 0 && deCarta.length === paises.length && deCarta.every((p) => paises.includes(p))

  // La especie la fija el informe: no se elige a mano. Los países parten de la carta de destino.
  const elegirFruta = (f: string, unidadId: number | null = null) => {
    setFruta(f)
    const desdeCarta = paisesCarta(f, cartaPara(f, unidadId).carta)
    setPaises(desdeCarta.length ? desdeCarta : paisesGuardados(f))
    setResultado(null)
  }
  const alternarPais = (p: string) => {
    const nuevos = paises.includes(p) ? paises.filter((x) => x !== p) : [...paises, p]
    setPaises(nuevos)
    if (fruta) guardarPaises(fruta, nuevos)
    setResultado(null)
  }
  const todosPaises = (todos: boolean) => {
    const nuevos = todos ? [...(frutaActual?.paises ?? [])] : []
    setPaises(nuevos)
    if (fruta) guardarPaises(fruta, nuevos)
    setResultado(null)
  }

  const subirInforme = (archivo: File | null) => {
    if (!archivo) return
    void leer.ejecutar(async () => {
      const datos = new FormData()
      datos.append('archivo', archivo)
      const l = await api.post<LecturaMRL>('/laboratorio/mrl/leer', datos)
      setLectura(l)
      setNombreInforme(archivo.name)
      setFilas(l.residuos.length ? l.residuos.map((r) => nuevaFila(r.sustancia, r.valor, r.valor_texto)) : [nuevaFila()])
      elegirFruta(l.fruta ?? '', l.unidad_id)
      setResultado(null)
    })
  }

  const residuos = filas.filter((f) => f.sustancia.trim()).map((f) => {
    const valor = f.valor.trim() ? Number(f.valor.replace(',', '.')) : null
    return { sustancia: f.sustancia.trim(), valor: valor !== null && Number.isFinite(valor) ? valor : null, valor_texto: f.valor_texto }
  })
  const listo = !!fruta && paises.length > 0 && residuos.length > 0

  const hacerComparacion = () => void comparar.ejecutar(async () => {
    const r = await api.post<Comparacion>('/laboratorio/mrl/comparar', { fruta, paises, residuos })
    setResultado(r)
    setTimeout(() => document.getElementById('resultado-mrl')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  })

  const cambiarFila = (clave: number, cambio: Partial<FilaResiduo>) => {
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...cambio } : f)))
    setResultado(null)
  }

  return (
    <div>
      <EncabezadoPagina
        titulo="Residuos y destinos (MRL)"
        descripcion="Residuos de plaguicidas del informe de laboratorio comparados con los límites de ASOEX de cada país de destino."
        acciones={puedeEditar && (
          <>
            <Boton variante="secundario" icono={<Globe2 className="h-4 w-4" />} onClick={() => setCartaAbierta(true)}>
              Carta de destino
            </Boton>
            <Boton variante="secundario" icono={<FileSpreadsheet className="h-4 w-4" />} onClick={() => setCargarPara('')}>
              {hayAsoex ? 'Actualizar ASOEX' : 'Cargar ASOEX'}
            </Boton>
          </>
        )}
      />
      {nodoAviso}

      {asoex.cargando ? <Cargando /> : !hayAsoex ? (
        <Tarjeta>
          <Vacio>
            Para comparar, primero carga los límites de ASOEX (la agenda de cada especie o la planilla general).
            {puedeEditar && <span className="mt-3 block"><Boton icono={<Upload className="h-4 w-4" />} onClick={() => setCargarPara('')}>Cargar ASOEX</Boton></span>}
          </Vacio>
        </Tarjeta>
      ) : (
        <div className="space-y-5">
          {/* 1. Informe de residuos */}
          <Tarjeta titulo="1. Informe de residuos del laboratorio">
            <div className="max-w-xl">
              {puedeEditar && (
                <Campo etiqueta="Subir informe" ayuda="El PDF de resultados del laboratorio (Mérieux, Eurofins o GESEX): la aplicación lee la especie, la sucursal y los residuos.">
                  <ElegirArchivo aceptar=".pdf,.xlsx,.xlsm,.csv,.txt" onCambio={subirInforme} texto={leer.ocupado ? 'Leyendo…' : 'Elegir informe'} />
                </Campo>
              )}
            </div>
            <MensajeError error={leer.error} />

            {lectura && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
                <p className="font-semibold">Leído de {nombreInforme}</p>
                <p className="mt-0.5">
                  {[lectura.variedad && `Variedad: ${lectura.variedad}`,
                    lectura.punto && `Cuartel: ${lectura.punto}`,
                    lectura.productor && `${lectura.productor}${lectura.codigo_sucursal !== null ? ` (${lectura.codigo_sucursal})` : ''}`,
                    lectura.fecha_muestreo && `Muestreo: ${fecha(lectura.fecha_muestreo)}`,
                    `${lectura.residuos.length} residuos`].filter(Boolean).join(' · ')}
                </p>
                {lectura.advertencias.map((a) => <p key={a} className="mt-1 text-amber-800">{a}</p>)}
                <p className="mt-1 text-emerald-800">Revisa los valores antes de comparar.</p>
              </div>
            )}

          </Tarjeta>

          {/* 2. Especie: la del informe, no se cambia */}
          {lectura && (
            <Tarjeta titulo="2. Especie y límites ASOEX">
              {!lectura.fruta ? (
                <p className="flex items-start gap-2 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  No se reconoció la especie en el informe. Revisa que sea un informe de residuos del laboratorio; si lo es, envíalo para ajustar la lectura.
                </p>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                      {nombreEspecie(lectura.fruta)}
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        <Lock className="h-3 w-3" /> Según el informe
                      </span>
                    </p>
                    {frutaActual ? (
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                        Se compara con <span className="min-w-0 truncate font-medium text-slate-800" title={frutaActual.nombre_archivo}>{frutaActual.nombre_archivo}</span>
                        {frutaActual.fecha && <span>· al {fecha(frutaActual.fecha)}</span>}
                        <span>· {frutaActual.paises.length} países · {frutaActual.sustancias} sustancias</span>
                      </p>
                    ) : (
                      <p className="flex items-start gap-2 text-sm text-amber-800">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        No hay límites de ASOEX cargados para {nombreEspecie(lectura.fruta)}. Sube su agenda de pesticidas para poder comparar.
                      </p>
                    )}
                  </div>
                  {puedeEditar && (
                    <Boton variante="secundario" icono={frutaActual ? <RefreshCw className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                      onClick={() => setCargarPara(lectura.fruta ?? '')}>
                      {frutaActual ? 'Actualizar límites' : 'Cargar límites'} de {nombreEspecie(lectura.fruta)}
                    </Boton>
                  )}
                </div>
              )}
            </Tarjeta>
          )}

          {/* 3. Residuos detectados (se pueden corregir) */}
          {lectura && (
            <Tarjeta titulo="3. Residuos detectados">
            {lectura && (
              <div className="space-y-2">
                <div className="hidden grid-cols-[1fr_9rem_2.75rem] gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
                  <span>Sustancia</span><span>Resultado (ppm)</span><span />
                </div>
                {filas.map((f) => (
                  <div key={f.clave} className="grid grid-cols-[1fr_7rem_2.75rem] gap-2 sm:grid-cols-[1fr_9rem_2.75rem]">
                    <input className={claseEntrada} placeholder="Ej.: ACETAMIPRID" value={f.sustancia} aria-label="Sustancia"
                      onChange={(e) => cambiarFila(f.clave, { sustancia: e.target.value })} />
                    <input className={`${claseEntrada} text-right tabular-nums`} inputMode="decimal" aria-label="Resultado en ppm"
                      placeholder={f.valor_texto ?? 'ND'} value={f.valor}
                      onChange={(e) => cambiarFila(f.clave, { valor: e.target.value, valor_texto: e.target.value ? null : f.valor_texto })} />
                    <button type="button" aria-label="Quitar residuo" onClick={() => setFilas((fs) => fs.length > 1 ? fs.filter((x) => x.clave !== f.clave) : [nuevaFila()])}
                      className="flex h-11 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Boton variante="secundario" icono={<Plus className="h-4 w-4" />} onClick={() => setFilas((fs) => [...fs, nuevaFila()])}>
                  Agregar residuo
                </Boton>
                <p className="text-xs text-slate-500">Deja el resultado vacío si no se detectó (ND o bajo el límite de cuantificación).</p>
              </div>
            )}
            </Tarjeta>
          )}

          {/* 4. Países */}
          {frutaActual && (
          <Tarjeta titulo="4. Países de destino">
            {(
              <div>
                {carta && deCarta.length > 0 ? (
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-2 text-sm text-sky-900">
                    <p className="min-w-0">
                      Marcados según la <strong>carta de destino de GESEX</strong>
                      {carta.empresa && <> · {carta.empresa}</>}{carta.temporada && <> · temporada {carta.temporada}</>}
                      {deOtraEmpresa && <span className="block text-xs text-sky-800">No hay carta para la empresa de este informe: se usó la más reciente.</span>}
                      {fueraDeAsoex.length > 0 && (
                        <span className="block text-xs text-amber-800">ASOEX no tiene límites de {nombreEspecie(fruta)} para: {fueraDeAsoex.join(', ')}.</span>
                      )}
                      <span className="block text-xs text-sky-800">Puedes marcar o desmarcar países antes de comparar.</span>
                    </p>
                    {!igualACarta && (
                      <button type="button" onClick={() => { setPaises(deCarta); setResultado(null) }}
                        className="min-h-9 shrink-0 rounded-lg px-2 text-sm font-medium text-sky-800 hover:bg-sky-100">
                        Volver a la carta
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="mb-3 text-sm text-slate-500">No hay carta de destino para {nombreEspecie(fruta)}: se marca tu última selección.</p>
                )}
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">Países a comparar ({paises.length} de {frutaActual.paises.length})</span>
                  <button type="button" onClick={() => todosPaises(true)} className="min-h-9 rounded-lg px-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">Todos</button>
                  <button type="button" onClick={() => todosPaises(false)} className="min-h-9 rounded-lg px-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Ninguno</button>
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Países de destino">
                  {frutaActual.paises.map((p) => {
                    const sel = paises.includes(p)
                    return (
                      <button key={p} type="button" aria-pressed={sel} onClick={() => alternarPais(p)}
                        className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors lg:min-h-9 ${
                          sel ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                        }`}>
                        {sel ? <Check className="h-3.5 w-3.5" /> : <Globe2 className="h-3.5 w-3.5 text-slate-400" />}{p}
                      </button>
                    )
                  })}
                </div>
                {!deCarta.length && <p className="mt-2 text-xs text-slate-500">La selección se recuerda para la próxima vez que compares esta especie.</p>}
              </div>
            )}
          </Tarjeta>
          )}

          {frutaActual && (
            <div className="flex flex-wrap items-center gap-3">
              <Boton ocupado={comparar.ocupado} disabled={!listo} onClick={hacerComparacion}>Comparar con ASOEX</Boton>
              {!listo && (
                <span className="text-sm text-slate-500">{!residuos.length ? 'El informe no trae residuos: agrégalos arriba' : 'Elige al menos un país'}</span>
              )}
            </div>
          )}
          <MensajeError error={comparar.error} />

          {resultado && (
            <section id="resultado-mrl" className="scroll-mt-4 space-y-5">
              <Resultado r={resultado} />
            </section>
          )}
        </div>
      )}
      <CargarCarta abierta={cartaAbierta} onCerrar={() => setCartaAbierta(false)} cartas={asoex.datos?.cartas ?? []}
        onCargada={(c) => {
          asoex.recargar()
          setResultado(null)
          if (fruta && c.destinos[fruta]) setPaises(paisesCarta(fruta, c))
          avisar(`Carta de destino cargada: ${Object.keys(c.destinos).map(nombreEspecie).join(', ')}${c.temporada ? ` · ${c.temporada}` : ''}`)
        }} />
      <CargarAsoex abierta={cargarPara !== undefined} especie={cargarPara || undefined} cargadas={frutas}
        historial={asoex.datos?.historial ?? []}
        onCerrar={() => setCargarPara(undefined)} onCargada={(r) => {
          asoex.recargar()
          setResultado(null)
          const cargadasAhora = [...new Set(r.flatMap((c) => c.frutas))]
          const omitidas = r.filter((c) => c.repetido).length
          const nota = omitidas ? ` · ${omitidas === 1 ? 'se omitió 1 planilla repetida' : `se omitieron ${omitidas} planillas repetidas`}` : ''
          if (cargarPara && !cargadasAhora.includes(cargarPara)) {
            avisar(`Ojo: esa planilla no trae ${nombreEspecie(cargarPara)} (trae ${cargadasAhora.map(nombreEspecie).join(', ') || 'nada nuevo'})${nota}`)
          } else {
            avisar((cargadasAhora.length ? `Límites ASOEX actualizados: ${cargadasAhora.map(nombreEspecie).join(', ')}` : 'Esas planillas ya estaban cargadas') + nota)
          }
        }} />
    </div>
  )
}
