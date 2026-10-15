import { useState, type FormEvent } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, FileText, FlaskConical, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { abrirUrlFirmada, api, subirArchivo } from '../api'
import { useAccion, useDatos } from '../hooks'
import { fecha, hoyIso, num } from '../formato'
import type { Analisis } from '../tipos'
import { useSesionActiva } from '../contexto/Sesion'
import {
  Boton, Campo, CampoArchivo, Cargando, EncabezadoPagina, Insignia, MensajeError, Modal, Vacio, claseEntrada,
  useAviso,
} from '../componentes/ui'
import { Selector } from '../componentes/Desplegable'

function textoLimite(min: number | null, max: number | null): string {
  if (min === null && max === null) return 'Sin límite'
  if (min !== null && max !== null) return `${num(min)} – ${num(max)}`
  if (min !== null) return `≥ ${num(min)}`
  return `≤ ${num(max)}`
}

function fueraDeLimite(valor: number | null, min: number | null, max: number | null): boolean | null {
  if (valor === null || (min === null && max === null)) return null
  return (min !== null && valor < min) || (max !== null && valor > max)
}

function EstadoAnalisis({ a }: { a: Analisis }) {
  if (a.cumple === null) return <Insignia>Sin límite</Insignia>
  if (a.cumple) return <Insignia tono="verde">Cumple</Insignia>
  return <Insignia tono="rojo">No cumple</Insignia>
}

export function Laboratorio() {
  const { catalogos, filtros, puedeEscribir } = useSesionActiva()
  const [tipoId, setTipoId] = useState('')
  const [tipoUnidad, setTipoUnidad] = useState<'' | 'campo' | 'planta'>('')
  const [soloFuera, setSoloFuera] = useState(false)
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set())
  const [nuevoAbierto, setNuevoAbierto] = useState(false)
  const [alertaFuera, setAlertaFuera] = useState<Analisis | null>(null)
  const { avisar, nodo: nodoAviso } = useAviso()
  const informe = useAccion()

  const { datos, cargando, error, recargar } = useDatos<Analisis[]>('/laboratorio/analisis', {
    ...filtros,
    tipo_analisis_id: tipoId || undefined,
    solo_fuera_de_norma: soloFuera || undefined,
    // Con una sucursal elegida en el encabezado, el tipo ya está dado por ella
    tipo_unidad: (!filtros.unidad_id && tipoUnidad) || undefined,
  })
  const sucursalElegida = catalogos.unidades.find((u) => u.id === filtros.unidad_id)

  const tiposVisibles = catalogos.tipos_analisis.filter((t) => t.ambito === 'campo')
  const lista = datos ?? []

  const alternar = (id: number) =>
    setAbiertos((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const verInforme = (id: number) => informe.ejecutar(() => abrirUrlFirmada(`/laboratorio/analisis/${id}/informe`))

  const lugar = (a: Analisis) => [a.fuente_agua, a.punto].filter(Boolean).join(' · ') || '—'

  return (
    <div>
      <EncabezadoPagina
        titulo="Laboratorio"
        descripcion="Análisis de campo comparados automáticamente con sus límites."
        acciones={
          puedeEscribir && (
            <Boton icono={<Plus className="h-4 w-4" />} onClick={() => setNuevoAbierto(true)}>
              Nuevo análisis
            </Boton>
          )
        }
      />

      {alertaFuera && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border-2 border-red-300 bg-red-50 p-4 text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">
              Análisis fuera de norma: {alertaFuera.tipo.nombre} en {alertaFuera.unidad.nombre} ({fecha(alertaFuera.fecha_muestreo)})
            </p>
            <p className="mt-1">Parámetros fuera de límite: {alertaFuera.fuera_de_norma.join(', ')}</p>
          </div>
          <button onClick={() => setAlertaFuera(null)} className="text-xs font-medium underline">Cerrar</button>
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        {sucursalElegida ? (
          <span className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
            {sucursalElegida.nombre} ({sucursalElegida.tipo === 'planta' ? 'planta' : 'campo'})
          </span>
        ) : (
          <div role="group" aria-label="Filtrar por campo o planta" className="inline-flex h-10 w-fit shrink-0 items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {([['', 'Mostrar todo'], ['campo', 'Campo'], ['planta', 'Planta']] as const).map(([valor, etiqueta]) => (
              <button
                key={valor || 'todos'}
                type="button"
                aria-pressed={tipoUnidad === valor}
                onClick={() => setTipoUnidad(valor)}
                className={`h-8 rounded-lg px-3.5 text-sm font-semibold transition-colors ${
                  tipoUnidad === valor ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        )}
        <div className="min-w-0 lg:w-72">
          <Selector className={`${claseEntrada} h-10 py-0`} value={tipoId} onChange={(e) => setTipoId(e.target.value)} aria-label="Tipo de análisis">
            <option value="">Todos los tipos de análisis</option>
            {tiposVisibles.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </Selector>
        </div>
        <label className="flex h-10 w-fit shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300">
          <input type="checkbox" className="h-4 w-4 accent-red-600" checked={soloFuera} onChange={(e) => setSoloFuera(e.target.checked)} />
          Solo fuera de norma
        </label>
      </div>

      <MensajeError error={error} onReintentar={recargar} />
      <MensajeError error={informe.error} />
      {cargando && !datos ? (
        <Cargando variante="lista" />
      ) : !lista.length ? (
        <Vacio>
          {tipoUnidad === 'planta' && !filtros.unidad_id
            ? 'No hay análisis de planta: por ahora los tipos de análisis cargados son de campo.'
            : 'No hay análisis con estos filtros.'}
        </Vacio>
      ) : (
        <ul className="space-y-3">
          {lista.map((a) => {
            const abierto = abiertos.has(a.id)
            return (
              <li
                key={a.id}
                className={`rounded-xl border bg-white shadow-sm ${a.cumple === false ? 'border-red-300' : 'border-slate-200'}`}
              >
                <button onClick={() => alternar(a.id)} className="flex w-full items-start gap-3 p-4 text-left">
                  {abierto ? <ChevronDown className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" /> : <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{a.tipo.nombre}</span>
                      {a.especie && <Insignia tono="verde">{a.especie.nombre}</Insignia>}
                      <EstadoAnalisis a={a} />
                    </div>
                    <div className="mt-1 grid grid-cols-1 gap-x-4 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                      <span>Sucursal: {a.unidad.nombre}</span>
                      <span>Fuente / punto: {lugar(a)}</span>
                      <span>Muestreo: {fecha(a.fecha_muestreo)}</span>
                      <span>Laboratorio: {a.laboratorio ?? '—'}</span>
                    </div>
                    {a.cumple === false && (
                      <p className="mt-2 text-xs font-medium text-red-700">Fuera de norma: {a.fuera_de_norma.join(', ')}</p>
                    )}
                  </div>
                </button>
                {abierto && (
                  <div className="border-t border-slate-100 p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[480px] text-left text-sm">
                        <thead className="text-xs uppercase text-slate-500">
                          <tr>
                            <th className="py-1 pr-3">Parámetro</th>
                            <th className="py-1 pr-3 text-right">Valor</th>
                            <th className="py-1 pr-3">Sucursal</th>
                            <th className="py-1 pr-3">Límite (mín – máx)</th>
                            <th className="py-1">Cumple</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {a.resultados.map((r) => (
                            <tr key={r.id} className={r.cumple === false ? 'bg-red-50 text-red-800' : ''}>
                              <td className="py-1.5 pr-3">{r.parametro}</td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">{r.valor !== null ? num(r.valor) : r.valor_texto ?? '—'}</td>
                              <td className="py-1.5 pr-3">{r.unidad_medida ?? '—'}</td>
                              <td className="py-1.5 pr-3">{textoLimite(r.limite_min, r.limite_max)}</td>
                              <td className="py-1.5">
                                {r.cumple === null ? <Insignia>—</Insignia> : r.cumple ? <Insignia tono="verde">Sí</Insignia> : <Insignia tono="rojo">No</Insignia>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3">
                      {a.tiene_informe ? (
                        <Boton variante="secundario" icono={<FileText className="h-4 w-4" />} ocupado={informe.ocupado} onClick={() => verInforme(a.id)}>
                          Ver informe PDF
                        </Boton>
                      ) : (
                        <span className="text-xs text-slate-500">Sin informe adjunto</span>
                      )}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {nuevoAbierto && (
        <NuevoAnalisis
          onCerrar={() => setNuevoAbierto(false)}
          onCreado={(a) => {
            setNuevoAbierto(false)
            if (a.cumple === false) setAlertaFuera(a)
            else avisar('Análisis registrado')
            void recargar()
          }}
        />
      )}
      {nodoAviso}
    </div>
  )
}

// ---------- Nuevo análisis ----------

interface FilaResultado {
  clave: number
  parametro: string
  valor: string
  valor_texto: string | null
  unidad_medida: string
  limite_min: number | null
  limite_max: number | null
  leida: boolean
  linea: string | null
}

interface LecturaInforme {
  texto_leido: boolean
  tipo_analisis_id: number | null
  tipo_sugerido: string | null
  fecha_muestreo: string | null
  laboratorio: string | null
  punto: string | null
  especie_id: number | null
  resultados: { parametro: string; valor: number | null; valor_texto: string | null; linea: string | null }[]
  no_encontrados: string[]
  advertencias: string[]
}

interface ResumenLectura {
  texto_leido: boolean
  completados: number
  total: number
  no_encontrados: string[]
  advertencias: string[]
}

type CampoLeido = 'tipo' | 'fecha' | 'laboratorio' | 'punto' | 'especie'

let contadorFilas = 0

const claseLeida = 'border-emerald-300 bg-emerald-50'

function NotaLeida({ visible }: { visible: boolean }) {
  return visible ? <span className="mt-1 block text-xs text-emerald-700">leído del informe</span> : null
}

function NuevoAnalisis({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: (a: Analisis) => void }) {
  const { catalogos, filtros } = useSesionActiva()
  const unidades = catalogos.unidades.filter((u) => u.tipo === 'campo')
  const tipos = catalogos.tipos_analisis.filter((t) => t.ambito === 'campo')
  const [tipoId, setTipoId] = useState<number | undefined>()
  const [unidadId, setUnidadId] = useState<number | undefined>(
    unidades.some((u) => u.id === filtros.unidad_id) ? filtros.unidad_id : undefined,
  )
  const [fuenteId, setFuenteId] = useState<number | undefined>()
  const [especieId, setEspecieId] = useState<number | undefined>()
  const [punto, setPunto] = useState('')
  const [fechaMuestreo, setFechaMuestreo] = useState(hoyIso())
  const [fechaTocada, setFechaTocada] = useState(false)
  const [laboratorio, setLaboratorio] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subido, setSubido] = useState<{ clave: string; nombre: string } | null>(null)
  const [leidoCon, setLeidoCon] = useState<{ tipoId?: number; unidadId?: number } | null>(null)
  const [resumen, setResumen] = useState<ResumenLectura | null>(null)
  const [leidos, setLeidos] = useState<Set<CampoLeido>>(new Set())
  const [filas, setFilas] = useState<FilaResultado[]>([])
  const accion = useAccion()
  const lectura = useAccion()

  const tipo = tipos.find((t) => t.id === tipoId)
  const fuentes = catalogos.fuentes_agua.filter((f) => unidadId !== undefined && f.unidades.includes(unidadId))
  const especies = catalogos.especies.filter((e) => unidadId !== undefined && e.unidades.includes(unidadId))

  const quitarLeido = (campo: CampoLeido) =>
    setLeidos((s) => {
      if (!s.has(campo)) return s
      const n = new Set(s)
      n.delete(campo)
      return n
    })

  const filasDeTipo = (id: number | undefined): FilaResultado[] =>
    catalogos.limites
      .filter((l) => l.tipo_analisis_id === id)
      .map((l) => ({
        clave: ++contadorFilas,
        parametro: l.parametro,
        valor: '',
        valor_texto: null,
        unidad_medida: l.unidad_medida ?? '',
        limite_min: l.minimo,
        limite_max: l.maximo,
        leida: false,
        linea: null,
      }))

  const cambiarTipo = (id: number | undefined) => {
    setTipoId(id)
    quitarLeido('tipo')
    if (!tipos.find((t) => t.id === id)?.usa_especie) {
      setEspecieId(undefined)
      quitarLeido('especie')
    }
    setFilas(filasDeTipo(id))
  }

  const cambiarUnidad = (id: number | undefined) => {
    setUnidadId(id)
    setFuenteId(undefined)
    const especie = catalogos.especies.find((e) => e.id === especieId)
    if (especie && (id === undefined || !especie.unidades.includes(id))) {
      setEspecieId(undefined)
      quitarLeido('especie')
    }
  }

  const cambiarFila = (clave: number, cambios: Partial<FilaResultado>) =>
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)))

  const agregarFila = () =>
    setFilas((fs) => [
      ...fs,
      { clave: ++contadorFilas, parametro: '', valor: '', valor_texto: null, unidad_medida: '', limite_min: null, limite_max: null, leida: false, linea: null },
    ])

  const valorNumerico = (v: string): number | null => {
    const n = Number(v.replace(',', '.'))
    return v.trim() === '' || Number.isNaN(n) ? null : n
  }

  const aplicarLectura = (l: LecturaInforme) => {
    const nuevos = new Set(leidos)
    const libre = (campo: CampoLeido, valor: string) => !valor.trim() || leidos.has(campo)

    let tipoFinal = tipoId
    let base = filas
    if (
      l.tipo_analisis_id && l.tipo_analisis_id !== tipoId && (!tipoId || leidos.has('tipo'))
      && tipos.some((t) => t.id === l.tipo_analisis_id)
    ) {
      tipoFinal = l.tipo_analisis_id
      base = filasDeTipo(tipoFinal)
      setTipoId(tipoFinal)
      nuevos.add('tipo')
    }
    if (l.fecha_muestreo && (!fechaTocada || leidos.has('fecha'))) {
      setFechaMuestreo(l.fecha_muestreo)
      nuevos.add('fecha')
    }
    if (l.laboratorio && libre('laboratorio', laboratorio)) {
      setLaboratorio(l.laboratorio)
      nuevos.add('laboratorio')
    }
    if (l.punto && libre('punto', punto)) {
      setPunto(l.punto)
      nuevos.add('punto')
    }
    const usaEspecie = tipos.find((t) => t.id === tipoFinal)?.usa_especie
    const especieLeida = especies.find((e) => e.id === l.especie_id)
    if (usaEspecie && especieLeida && (especieId === undefined || leidos.has('especie'))) {
      setEspecieId(especieLeida.id)
      nuevos.add('especie')
    }

    const porParametro = new Map(l.resultados.map((r) => [r.parametro.trim().toLowerCase(), r]))
    const nuevasFilas = base.map((f) => {
      const r = porParametro.get(f.parametro.trim().toLowerCase())
      if (!r || (f.valor.trim() && !f.leida)) return f
      const valor = r.valor !== null ? String(r.valor).replace('.', ',') : r.valor_texto ?? ''
      if (!valor) return f
      return { ...f, valor, valor_texto: r.valor_texto, leida: true, linea: r.linea }
    })
    setFilas(nuevasFilas)
    setLeidos(nuevos)
    setLeidoCon({ tipoId: tipoFinal, unidadId })
    setResumen({
      texto_leido: l.texto_leido,
      completados: nuevasFilas.filter((f) => f.leida).length,
      total: nuevasFilas.length,
      no_encontrados: l.no_encontrados,
      advertencias: l.advertencias,
    })
  }

  const leer = (informe: { clave: string; nombre: string }) =>
    lectura.ejecutar(async () => {
      const l = await api.post<LecturaInforme>('/laboratorio/leer-informe', {
        archivo_key: informe.clave,
        nombre_archivo: informe.nombre,
        tipo_analisis_id: tipoId ?? null,
        unidad_id: unidadId ?? null,
      })
      aplicarLectura(l)
    })

  const elegirArchivo = async (f: File | null) => {
    setArchivo(f)
    setSubido(null)
    setResumen(null)
    setLeidoCon(null)
    if (!f) return
    const r: { informe?: { clave: string; nombre: string } } = {}
    const ok = await lectura.ejecutar(async () => {
      const s = await subirArchivo(f, 'analisis')
      r.informe = { clave: s.clave, nombre: s.nombre }
      setSubido(r.informe)
    })
    if (ok && r.informe) await leer(r.informe)
  }

  const desactualizada = subido !== null && leidoCon !== null && (leidoCon.tipoId !== tipoId || leidoCon.unidadId !== unidadId)

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (!tipo) return accion.setError('Elige el tipo de análisis')
    if (!unidadId) return accion.setError('Elige el campo')
    if (tipo.usa_fuente_agua && !fuenteId) return accion.setError('Este análisis requiere indicar la fuente de agua')
    if (tipo.usa_especie && !especieId) return accion.setError('Este análisis requiere indicar la especie')
    const resultados = filas
      .filter((f) => f.parametro.trim() && f.valor.trim())
      .map((f) => {
        const valor = valorNumerico(f.valor)
        return {
          parametro: f.parametro.trim(),
          valor,
          valor_texto: f.valor_texto ?? (valor === null ? f.valor.trim() : null),
          unidad_medida: f.unidad_medida.trim() || null,
          limite_min: f.limite_min,
          limite_max: f.limite_max,
        }
      })
    if (!resultados.length) return accion.setError('Ingresa al menos un resultado')
    const r: { analisis?: Analisis } = {}
    const ok = await accion.ejecutar(async () => {
      let informe = subido
      if (!informe && archivo) {
        const s = await subirArchivo(archivo, 'analisis')
        informe = { clave: s.clave, nombre: s.nombre }
        setSubido(informe)
      }
      r.analisis = await api.post<Analisis>('/laboratorio/analisis', {
        tipo_analisis_id: tipo.id,
        unidad_id: unidadId,
        fuente_agua_id: tipo.usa_fuente_agua ? fuenteId : null,
        especie_id: tipo.usa_especie ? especieId : null,
        punto: punto.trim() || null,
        fecha_muestreo: fechaMuestreo,
        laboratorio: laboratorio.trim() || null,
        archivo_key: informe?.clave ?? null,
        nombre_archivo: informe?.nombre ?? null,
        resultados,
      })
    })
    if (ok && r.analisis) onCreado(r.analisis)
  }

  const claseCampo = (campo: CampoLeido) => `${claseEntrada} ${leidos.has(campo) ? claseLeida : ''}`

  return (
    <Modal abierto titulo="Nuevo análisis" onCerrar={onCerrar} ancho="max-w-3xl">
      <form onSubmit={guardar} className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-800">1. Sube el informe del laboratorio</h3>
          <p className="mb-2 text-xs text-slate-600">La aplicación lo lee y completa los campos que encuentre. Revisa antes de guardar.</p>
          <CampoArchivo
            archivo={archivo}
            onCambio={(f) => void elegirArchivo(f)}
            aceptar="application/pdf,image/*,.xlsx,.xls,.csv,text/csv"
          />
          {lectura.ocupado && <p className="mt-2 text-xs text-slate-600">Subiendo y leyendo el informe…</p>}
          <MensajeError error={lectura.error && `${lectura.error}. Puedes seguir completando a mano.`} />
          {resumen && !lectura.ocupado && (
            <div className="mt-2 space-y-2 text-xs">
              {resumen.texto_leido ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
                  Se completaron {resumen.completados} de {resumen.total} parámetros
                </p>
              ) : (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                  No se pudo leer texto (foto o PDF escaneado): completa los valores a mano
                </p>
              )}
              {resumen.no_encontrados.length > 0 && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                  No encontrados: {resumen.no_encontrados.join(', ')}
                </p>
              )}
              {resumen.advertencias.length > 0 && (
                <ul className="list-inside list-disc rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                  {resumen.advertencias.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}
            </div>
          )}
          {desactualizada && subido && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>Cambiaste el tipo o el campo después de leer el informe.</span>
              <Boton type="button" variante="secundario" icono={<RefreshCw className="h-4 w-4" />} ocupado={lectura.ocupado}
                onClick={() => void leer(subido)}>
                Volver a leer
              </Boton>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo etiqueta="Tipo de análisis">
            <Selector className={claseCampo('tipo')} value={tipoId ?? ''} required onChange={(e) => cambiarTipo(Number(e.target.value) || undefined)}>
              <option value="" disabled>Elige un tipo</option>
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </Selector>
            <NotaLeida visible={leidos.has('tipo')} />
          </Campo>
          <Campo etiqueta="Campo">
            <Selector className={claseEntrada} value={unidadId ?? ''} required onChange={(e) => cambiarUnidad(Number(e.target.value) || undefined)}>
              <option value="" disabled>Elige un campo</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </Selector>
          </Campo>
          {tipo?.usa_especie && (
            <Campo etiqueta="Especie" ayuda="Especies de este campo">
              <Selector className={claseCampo('especie')} value={especieId ?? ''} required
                onChange={(e) => { setEspecieId(Number(e.target.value) || undefined); quitarLeido('especie') }}>
                <option value="" disabled>
                  {unidadId ? (especies.length ? 'Elige una especie' : 'Este campo no tiene especies registradas') : 'Elige primero el campo'}
                </option>
                {especies.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </Selector>
              <NotaLeida visible={leidos.has('especie')} />
            </Campo>
          )}
          {tipo?.usa_fuente_agua && (
            <Campo etiqueta="Fuente de agua">
              <Selector className={claseEntrada} value={fuenteId ?? ''} required onChange={(e) => setFuenteId(Number(e.target.value) || undefined)}>
                <option value="" disabled>{unidadId ? (fuentes.length ? 'Elige una fuente' : 'El campo no tiene fuentes registradas') : 'Elige primero el campo'}</option>
                {fuentes.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </Selector>
            </Campo>
          )}
          <Campo etiqueta="Punto de muestreo / cuartel">
            <input className={claseCampo('punto')} value={punto} onChange={(e) => { setPunto(e.target.value); quitarLeido('punto') }} />
            <NotaLeida visible={leidos.has('punto')} />
          </Campo>
          <Campo etiqueta="Fecha de muestreo">
            <input type="date" className={claseCampo('fecha')} required value={fechaMuestreo}
              onChange={(e) => { setFechaMuestreo(e.target.value); setFechaTocada(true); quitarLeido('fecha') }} />
            <NotaLeida visible={leidos.has('fecha')} />
          </Campo>
          <Campo etiqueta="Laboratorio">
            <input className={claseCampo('laboratorio')} value={laboratorio}
              onChange={(e) => { setLaboratorio(e.target.value); quitarLeido('laboratorio') }} />
            <NotaLeida visible={leidos.has('laboratorio')} />
          </Campo>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <FlaskConical className="h-4 w-4" /> Resultados
            </h3>
            <Boton type="button" variante="secundario" icono={<Plus className="h-4 w-4" />} onClick={agregarFila}>Agregar parámetro</Boton>
          </div>
          <p className="mb-2 text-xs text-slate-500">El límite se guarda junto al resultado, así un cambio de norma no altera el histórico.</p>
          {!filas.length ? (
            <Vacio>{tipo ? 'Este tipo no tiene parámetros con límite. Agrega filas manualmente.' : 'Elige un tipo para precargar sus parámetros.'}</Vacio>
          ) : (
            <div className="space-y-2">
              {filas.map((f) => {
                const fuera = fueraDeLimite(valorNumerico(f.valor), f.limite_min, f.limite_max)
                return (
                  <div key={f.clave} className={`grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-[2fr_1fr_1fr_1.2fr_auto] sm:items-center ${fuera ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                    <input className={`${claseEntrada} col-span-2 sm:col-span-1`} placeholder="Parámetro" value={f.parametro}
                      onChange={(e) => cambiarFila(f.clave, { parametro: e.target.value })} />
                    <div title={f.linea ?? undefined}>
                      <input
                        className={`${claseEntrada} ${fuera ? 'border-red-500 text-red-700' : f.leida ? claseLeida : ''}`}
                        placeholder="Valor" inputMode="decimal" value={f.valor}
                        onChange={(e) => cambiarFila(f.clave, { valor: e.target.value, valor_texto: null, leida: false, linea: null })} />
                      {f.leida && (
                        <span className="mt-0.5 block text-xs text-emerald-700">
                          leído del informe{f.valor_texto && f.valor_texto !== f.valor ? ` (${f.valor_texto})` : ''}
                        </span>
                      )}
                    </div>
                    <input className={claseEntrada} placeholder="Unidad" value={f.unidad_medida}
                      onChange={(e) => cambiarFila(f.clave, { unidad_medida: e.target.value })} />
                    <span className={`text-xs ${fuera ? 'font-semibold text-red-700' : 'text-slate-500'}`}>
                      Límite: {textoLimite(f.limite_min, f.limite_max)}{fuera ? ' · fuera' : ''}
                    </span>
                    <button type="button" aria-label="Quitar fila" onClick={() => setFilas((fs) => fs.filter((x) => x.clave !== f.clave))}
                      className="justify-self-end rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <MensajeError error={accion.error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton type="button" variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" ocupado={accion.ocupado} disabled={lectura.ocupado}>Guardar análisis</Boton>
        </div>
      </form>
    </Modal>
  )
}
