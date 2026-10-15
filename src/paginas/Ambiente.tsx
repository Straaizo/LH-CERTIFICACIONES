import { useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, BarChart3, Plus, Recycle, Sun, Factory } from 'lucide-react'
import { api } from '../api'
import { useAccion, useDatos } from '../hooks'
import { fecha, hoyIso, num } from '../formato'
import type { UnidadRef } from '../tipos'
import { useSesionActiva } from '../contexto/Sesion'
import { VentanaComparativa } from './AmbienteComparativa'
import {
  Boton, Campo, Cargando, EncabezadoPagina, MensajeError, Pestanas, Tarjeta, Vacio, claseEntrada, useAviso,
} from '../componentes/ui'
import { Selector } from '../componentes/Desplegable'

type Pestana = 'huella' | 'reciclaje' | 'fotovoltaico'

interface Huella {
  total_tco2e: number
  por_concepto: { concepto: string; tco2e: number }[]
  por_mes: { mes: string; tco2e: number }[]
  conceptos_sin_factor: string[]
}

interface Consumo {
  id: number
  fecha: string
  concepto: string
  concepto_nombre: string
  cantidad: number
  unidad_medida: string
  unidad: UnidadRef
}

interface Concepto {
  codigo: string
  nombre: string
  unidad_medida: string
}

interface Factor {
  id: number
  temporada_id: number
  concepto: string
  unidad_medida: string
  factor_kgco2e: number
  fuente: string | null
}

interface RegistroReciclaje {
  id: number
  fecha: string
  material: string
  kilos: number
  unidad: UnidadRef
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function nombreMes(mes: string): string {
  const [a, m] = mes.split('-')
  return `${MESES[Number(m) - 1] ?? m} ${a}`
}

function Barras({ filas, unidad, color = 'bg-emerald-600' }: {
  filas: { etiqueta: string; valor: number }[]
  unidad: string
  color?: string
}) {
  const maximo = Math.max(...filas.map((f) => f.valor), 0)
  if (!filas.length) return <Vacio>Sin datos.</Vacio>
  return (
    <ul className="space-y-2">
      {filas.map((f) => (
        <li key={f.etiqueta} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2 text-sm sm:grid-cols-[minmax(0,12rem)_1fr_auto]">
          <span className="truncate text-slate-600" title={f.etiqueta}>{f.etiqueta}</span>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${maximo ? (f.valor / maximo) * 100 : 0}%` }} />
          </div>
          <span className="whitespace-nowrap text-right text-xs font-medium tabular-nums text-slate-700">{num(f.valor)} {unidad}</span>
        </li>
      ))}
    </ul>
  )
}

export function Ambiente() {
  const { usuario } = useSesionActiva()
  const [pestana, setPestana] = useState<Pestana>('huella')
  const [comparativa, setComparativa] = useState(false)
  // Administrativos y jefes de área solo registran diésel, bencina y gas de sus campos
  if (usuario.rol === 'encargado') {
    return (
      <div>
        <EncabezadoPagina titulo="Medio ambiente" descripcion="Registra el consumo de combustible de tu campo: diésel, bencina y gas." />
        <HuellaCarbono soloCombustible />
      </div>
    )
  }
  return (
    <div>
      <EncabezadoPagina
        titulo="Medio ambiente"
        descripcion="Estos datos también sirven de evidencia para GLOBALG.A.P. (energía, GEI y residuos)."
        acciones={
          <Boton icono={<BarChart3 className="h-4 w-4" />} onClick={() => setComparativa(true)}>
            Comparar temporadas
          </Boton>
        }
      />
      <Pestanas
        opciones={[
          { valor: 'huella', etiqueta: 'Huella de carbono' },
          { valor: 'reciclaje', etiqueta: 'Reciclaje' },
          { valor: 'fotovoltaico', etiqueta: 'Fotovoltaico' },
        ]}
        valor={pestana}
        onCambio={setPestana}
      />
      {pestana === 'huella' && <HuellaCarbono />}
      {pestana === 'reciclaje' && <Reciclaje />}
      {pestana === 'fotovoltaico' && <Fotovoltaico />}
      <VentanaComparativa abierta={comparativa} onCerrar={() => setComparativa(false)} />
    </div>
  )
}

function unidadInicial(unidades: UnidadRef[], filtro?: number): number | undefined {
  return filtro ?? (unidades.length === 1 ? unidades[0].id : undefined)
}

// ---------- Huella de carbono ----------

function HuellaCarbono({ soloCombustible = false }: { soloCombustible?: boolean }) {
  const { catalogos, filtros, puedeEscribir } = useSesionActiva()
  const huella = useDatos<Huella>(soloCombustible ? null : '/ambiente/huella', { ...filtros })
  const consumos = useDatos<Consumo[]>('/ambiente/consumos', { ...filtros })
  const conceptos = useDatos<Concepto[]>('/ambiente/conceptos')
  const factores = useDatos<Factor[]>(soloCombustible ? null : '/ambiente/factores', { temporada_id: filtros.temporada_id })
  const { avisar, nodo: nodoAviso } = useAviso()
  const accion = useAccion()

  const [unidadId, setUnidadId] = useState<number | undefined>(unidadInicial(catalogos.unidades, filtros.unidad_id))
  const [fechaRegistro, setFechaRegistro] = useState(hoyIso())
  const [concepto, setConcepto] = useState('')
  const [cantidad, setCantidad] = useState('')

  const nombreConcepto = (codigo: string) => conceptos.datos?.find((c) => c.codigo === codigo)?.nombre ?? codigo
  const unidadConcepto = conceptos.datos?.find((c) => c.codigo === concepto)?.unidad_medida

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    const valor = Number(cantidad.replace(',', '.'))
    if (!unidadId || !concepto || cantidad.trim() === '' || Number.isNaN(valor) || valor < 0)
      return accion.setError('Completa sucursal, concepto y una cantidad válida')
    const ok = await accion.ejecutar(() =>
      api.post('/ambiente/consumos', { unidad_id: unidadId, fecha: fechaRegistro, concepto, cantidad: valor }),
    )
    if (ok) {
      setCantidad('')
      avisar('Consumo registrado')
      void huella.recargar()
      void consumos.recargar()
    }
  }

  return (
    <div className="space-y-4">
      {!soloCombustible && <MensajeError error={huella.error} onReintentar={huella.recargar} />}
      {soloCombustible ? null : huella.cargando && !huella.datos ? (
        <Cargando variante="panel" />
      ) : huella.datos && (
        <>
          {huella.datos.conceptos_sin_factor.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Hay consumos sin factor de emisión para su temporada y no se incluyen en el total:{' '}
                <strong>{huella.datos.conceptos_sin_factor.join(', ')}</strong>.
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Tarjeta titulo="Total">
              <div className="flex items-center gap-3">
                <Factory className="h-8 w-8 text-emerald-700" />
                <div>
                  <div className="text-3xl font-semibold tabular-nums text-slate-900">{num(huella.datos.total_tco2e)}</div>
                  <div className="text-xs text-slate-500">t CO₂e</div>
                </div>
              </div>
            </Tarjeta>
            <Tarjeta titulo="Por concepto (t CO₂e)" className="lg:col-span-2">
              <Barras filas={huella.datos.por_concepto.map((c) => ({ etiqueta: c.concepto, valor: c.tco2e }))} unidad="t" />
            </Tarjeta>
          </div>
          <Tarjeta titulo="Por mes (t CO₂e)">
            <Barras filas={huella.datos.por_mes.map((m) => ({ etiqueta: nombreMes(m.mes), valor: m.tco2e }))} unidad="t" color="bg-sky-600" />
          </Tarjeta>
        </>
      )}

      {puedeEscribir && (
        <Tarjeta titulo={soloCombustible ? 'Registrar consumo de combustible' : 'Registrar consumo'}>
          <form onSubmit={guardar} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <Campo etiqueta="Sucursal">
              <Selector className={claseEntrada} required value={unidadId ?? ''} onChange={(e) => setUnidadId(Number(e.target.value) || undefined)}>
                <option value="" disabled>Elige una sucursal</option>
                {catalogos.unidades.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.tipo})</option>)}
              </Selector>
            </Campo>
            <Campo etiqueta="Fecha">
              <input type="date" className={claseEntrada} required value={fechaRegistro} onChange={(e) => setFechaRegistro(e.target.value)} />
            </Campo>
            <Campo etiqueta="Concepto">
              <Selector className={claseEntrada} required value={concepto} onChange={(e) => setConcepto(e.target.value)}>
                <option value="" disabled>Elige un concepto</option>
                {(conceptos.datos ?? []).map((c) => <option key={c.codigo} value={c.codigo}>{c.nombre} ({c.unidad_medida})</option>)}
              </Selector>
            </Campo>
            <Campo etiqueta={`Cantidad${unidadConcepto ? ` (${unidadConcepto})` : ''}`}>
              <input className={claseEntrada} required inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </Campo>
            <Boton type="submit" ocupado={accion.ocupado} icono={<Plus className="h-4 w-4" />}>Registrar</Boton>
          </form>
          <MensajeError error={accion.error ?? conceptos.error} />
        </Tarjeta>
      )}

      <Tarjeta titulo="Registros de consumo">
        <MensajeError error={consumos.error} onReintentar={consumos.recargar} />
        {consumos.cargando && !consumos.datos ? (
          <Cargando variante="tabla" />
        ) : !consumos.datos?.length ? (
          <Vacio>No hay consumos registrados con estos filtros.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-1 pr-3">Fecha</th>
                  <th className="py-1 pr-3">Sucursal</th>
                  <th className="py-1 pr-3">Concepto</th>
                  <th className="py-1 text-right">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {consumos.datos.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5 pr-3">{fecha(r.fecha)}</td>
                    <td className="py-1.5 pr-3">{r.unidad.nombre}</td>
                    <td className="py-1.5 pr-3">{r.concepto_nombre}</td>
                    <td className="py-1.5 text-right tabular-nums">{num(r.cantidad)} {r.unidad_medida}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      {!soloCombustible && <Tarjeta titulo="Factores de emisión de la temporada">
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Valores referenciales de demo: deben validarse con la fuente oficial antes de reportar.
        </p>
        <MensajeError error={factores.error} onReintentar={factores.recargar} />
        {factores.cargando && !factores.datos ? (
          <Cargando variante="tabla" />
        ) : !factores.datos?.length ? (
          <Vacio>No hay factores registrados para esta temporada.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-1 pr-3">Concepto</th>
                  <th className="py-1 pr-3 text-right">kg CO₂e por unidad</th>
                  <th className="py-1">Fuente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {factores.datos.map((f) => (
                  <tr key={f.id}>
                    <td className="py-1.5 pr-3">{nombreConcepto(f.concepto)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{num(f.factor_kgco2e)} / {f.unidad_medida}</td>
                    <td className="py-1.5 text-slate-600">{f.fuente ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>}
      {nodoAviso}
    </div>
  )
}

// ---------- Reciclaje ----------

function Reciclaje() {
  const { catalogos, filtros, puedeEscribir } = useSesionActiva()
  const registros = useDatos<RegistroReciclaje[]>('/ambiente/reciclaje', { ...filtros })
  const { avisar, nodo: nodoAviso } = useAviso()
  const accion = useAccion()
  const [unidadId, setUnidadId] = useState<number | undefined>(unidadInicial(catalogos.unidades, filtros.unidad_id))
  const [fechaRegistro, setFechaRegistro] = useState(hoyIso())
  const [materialId, setMaterialId] = useState<number | undefined>()
  const [kilos, setKilos] = useState('')

  const totales = useMemo(() => {
    const porMaterial = new Map<string, number>()
    const porUnidad = new Map<string, number>()
    let total = 0
    for (const r of registros.datos ?? []) {
      porMaterial.set(r.material, (porMaterial.get(r.material) ?? 0) + r.kilos)
      porUnidad.set(r.unidad.nombre, (porUnidad.get(r.unidad.nombre) ?? 0) + r.kilos)
      total += r.kilos
    }
    const aFilas = (m: Map<string, number>) =>
      [...m.entries()].map(([etiqueta, valor]) => ({ etiqueta, valor })).sort((a, b) => b.valor - a.valor)
    return { total, porMaterial: aFilas(porMaterial), porUnidad: aFilas(porUnidad) }
  }, [registros.datos])

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    const valor = Number(kilos.replace(',', '.'))
    if (!unidadId || !materialId || Number.isNaN(valor) || valor <= 0)
      return accion.setError('Completa sucursal, material y kilos mayores a 0')
    const ok = await accion.ejecutar(() =>
      api.post('/ambiente/reciclaje', { unidad_id: unidadId, fecha: fechaRegistro, material_id: materialId, kilos: valor }),
    )
    if (ok) {
      setKilos('')
      avisar('Reciclaje registrado')
      void registros.recargar()
    }
  }

  return (
    <div className="space-y-4">
      <MensajeError error={registros.error} onReintentar={registros.recargar} />
      {registros.cargando && !registros.datos ? (
        <Cargando variante="panel" />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Tarjeta titulo="Total reciclado">
            <div className="flex items-center gap-3">
              <Recycle className="h-8 w-8 text-emerald-700" />
              <div>
                <div className="text-3xl font-semibold tabular-nums text-slate-900">{num(totales.total)}</div>
                <div className="text-xs text-slate-500">kg</div>
              </div>
            </div>
          </Tarjeta>
          <Tarjeta titulo="Por material (kg)">
            <Barras filas={totales.porMaterial} unidad="kg" />
          </Tarjeta>
          <Tarjeta titulo="Por sucursal (kg)">
            <Barras filas={totales.porUnidad} unidad="kg" color="bg-sky-600" />
          </Tarjeta>
        </div>
      )}

      {puedeEscribir && (
        <Tarjeta titulo="Registrar reciclaje">
          <form onSubmit={guardar} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <Campo etiqueta="Sucursal">
              <Selector className={claseEntrada} required value={unidadId ?? ''} onChange={(e) => setUnidadId(Number(e.target.value) || undefined)}>
                <option value="" disabled>Elige una sucursal</option>
                {catalogos.unidades.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.tipo})</option>)}
              </Selector>
            </Campo>
            <Campo etiqueta="Fecha">
              <input type="date" className={claseEntrada} required value={fechaRegistro} onChange={(e) => setFechaRegistro(e.target.value)} />
            </Campo>
            <Campo etiqueta="Material">
              <Selector className={claseEntrada} required value={materialId ?? ''} onChange={(e) => setMaterialId(Number(e.target.value) || undefined)}>
                <option value="" disabled>Elige un material</option>
                {catalogos.materiales_reciclaje.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </Selector>
            </Campo>
            <Campo etiqueta="Kilos">
              <input className={claseEntrada} required inputMode="decimal" value={kilos} onChange={(e) => setKilos(e.target.value)} />
            </Campo>
            <Boton type="submit" ocupado={accion.ocupado} icono={<Plus className="h-4 w-4" />}>Registrar</Boton>
          </form>
          <MensajeError error={accion.error} />
        </Tarjeta>
      )}

      <Tarjeta titulo="Registros de reciclaje">
        {!registros.datos?.length ? (
          <Vacio>No hay registros de reciclaje con estos filtros.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-1 pr-3">Fecha</th>
                  <th className="py-1 pr-3">Sucursal</th>
                  <th className="py-1 pr-3">Material</th>
                  <th className="py-1 text-right">Kilos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registros.datos.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5 pr-3">{fecha(r.fecha)}</td>
                    <td className="py-1.5 pr-3">{r.unidad.nombre}</td>
                    <td className="py-1.5 pr-3">{r.material}</td>
                    <td className="py-1.5 text-right tabular-nums">{num(r.kilos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
      {nodoAviso}
    </div>
  )
}

// ---------- Fotovoltaico ----------

function Fotovoltaico() {
  return (
    <Tarjeta titulo="Fotovoltaico">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Sun className="h-10 w-10 shrink-0 text-amber-500" />
        <div className="text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Módulo preparado — alcance por definir con el cliente</p>
          <p className="mt-2">Cuando se defina, podría registrar por sucursal y mes:</p>
          <ul className="mt-1 list-disc pl-5">
            <li>Generación (kWh)</li>
            <li>Autoconsumo (kWh)</li>
            <li>Inyección a la red (kWh)</li>
          </ul>
          <p className="mt-2 text-xs text-slate-500">Aún no tiene funcionalidad.</p>
        </div>
      </div>
    </Tarjeta>
  )
}
