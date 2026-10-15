import { Link } from 'react-router-dom'
import { useSesionActiva } from '../contexto/Sesion'
import { useDatos } from '../hooks'
import { fecha, num, textoDias } from '../formato'
import type { Analisis, NoConformidad, UnidadRef, Vencimiento } from '../tipos'
import {
  BarraPorcentaje, Cargando, EncabezadoPagina, Insignia, MensajeError, Tarjeta, Vacio, type Tono,
} from '../componentes/ui'

type Color = 'verde' | 'amarillo' | 'rojo' | 'gris'

interface CeldaSemaforo {
  empresa: string
  empresa_id: number
  protocolo: string
  protocolo_id: number
  ambito: 'campo' | 'planta' | 'ambos'
  color: Color
  motivo: string
  vigente_hasta: string | null
  cumplimiento: number | null
  nc_abiertas: number
}

interface Conteo {
  nombre: string
  cantidad: number
}

interface FilaCobertura {
  protocolo: { id: number; codigo: string; nombre: string }
  version: { id: number; nombre: string }
  unidad: UnidadRef
  cobertura: { codigo: string; titulo: string; estado: 'cubierta' | 'planificada' | 'pendiente' }[]
  porcentaje: number | null
}

interface Dashboard {
  temporada: { id: number | null; nombre: string | null }
  kpis: {
    registros_por_revisar: number
    registros_atrasados: number
    vencidos: number
    vencen_30: number
    nc_abiertas: number
    nc_reincidentes: number
    nc_vencidas: number
    analisis_fuera_norma: number
    analisis_total: number
  }
  semaforo: CeldaSemaforo[]
  nc_por_responsable: Conteo[]
  nc_por_antiguedad: Conteo[]
  nc_reincidentes: NoConformidad[]
  proximos_vencimientos: Vencimiento[]
  analisis_fuera_norma: Analisis[]
  cobertura: FilaCobertura[]
}

const PUNTO: Record<Color, string> = {
  verde: 'bg-emerald-500',
  amarillo: 'bg-amber-400',
  rojo: 'bg-red-600',
  gris: 'bg-slate-300',
}
const ETIQUETA_COLOR: Record<Color, string> = {
  verde: 'Al día',
  amarillo: 'Atención',
  rojo: 'Crítico',
  gris: 'Sin información',
}
const AMBITOS: { valor: CeldaSemaforo['ambito']; etiqueta: string }[] = [
  { valor: 'campo', etiqueta: 'Campo' },
  { valor: 'planta', etiqueta: 'Planta' },
  { valor: 'ambos', etiqueta: 'Campo y planta' },
]
const TONO_COBERTURA: Record<FilaCobertura['cobertura'][number]['estado'], Tono> = {
  cubierta: 'verde',
  planificada: 'azul',
  pendiente: 'gris',
}
const TONO_VENCIMIENTO: Record<Vencimiento['tipo'], Tono> = { certificado: 'azul' }
const ETIQUETA_TIPO: Record<Vencimiento['tipo'], string> = { certificado: 'Certificado' }

function Punto({ color }: { color: Color }) {
  return <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${PUNTO[color]}`} title={ETIQUETA_COLOR[color]} />
}

function ListaNc({ ncs, vacio, detalle }: { ncs: NoConformidad[]; vacio: string; detalle: (n: NoConformidad) => string }) {
  if (!ncs.length) return <p className="py-4 text-center text-sm text-slate-500">{vacio}</p>
  return (
    <ul className="divide-y divide-slate-100">
      {ncs.map((n) => (
        <li key={n.id} className="py-2">
          <Link to={`/no-conformidades/${n.id}`} className="block hover:bg-slate-50">
            <p className="text-sm font-medium text-emerald-800">
              {n.protocolo.codigo} {n.requisito.codigo} · {n.unidad.nombre}
            </p>
            <p className="line-clamp-2 text-xs text-slate-600">{n.descripcion}</p>
            <p className="text-xs text-slate-500">
              {n.responsable?.nombre ?? 'Sin asignar'} · {n.dias_abierta} d abierta
            </p>
            {detalle(n) && <p className="line-clamp-2 text-xs font-medium text-red-700">{detalle(n)}</p>}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Kpi({ etiqueta, valor, enlace, alerta }: { etiqueta: string; valor: string; enlace: string; alerta: boolean }) {
  return (
    <Link
      to={enlace}
      className={`rounded-xl border bg-white p-3 shadow-sm hover:border-emerald-300 ${alerta ? 'border-red-200' : 'border-slate-200'}`}
    >
      <p className={`text-2xl font-semibold tabular-nums ${alerta ? 'text-red-700' : 'text-slate-900'}`}>{valor}</p>
      <p className="mt-1 text-xs text-slate-500">{etiqueta}</p>
    </Link>
  )
}

function Barras({ datos }: { datos: Conteo[] }) {
  if (!datos.length) return <p className="py-4 text-center text-sm text-slate-500">Sin NC abiertas</p>
  const maximo = Math.max(...datos.map((d) => d.cantidad))
  return (
    <ul className="space-y-2">
      {datos.map((d) => (
        <li key={d.nombre}>
          <div className="mb-0.5 truncate text-xs text-slate-600" title={d.nombre}>{d.nombre}</div>
          <div className="flex items-center gap-2">
            <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
              <div className="h-full rounded bg-emerald-600" style={{ width: `${(d.cantidad / maximo) * 100}%` }} />
            </div>
            <span className="w-8 text-right text-sm font-medium tabular-nums text-slate-800">{d.cantidad}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function Semaforo({ celdas }: { celdas: CeldaSemaforo[] }) {
  const empresas = [...new Map(celdas.map((c) => [c.empresa_id, c.empresa])).entries()]
  const ambitos = AMBITOS.filter((a) => celdas.some((c) => c.ambito === a.valor))
  if (!celdas.length) return <Vacio>Sin protocolos para los filtros elegidos</Vacio>

  const detalle = (c: CeldaSemaforo) => (
    <div className="space-y-0.5 text-xs text-slate-600">
      <p className="font-medium text-slate-800">{c.motivo}</p>
      <p>Vigencia: {fecha(c.vigente_hasta)}</p>
      <p>Cumplimiento: {c.cumplimiento === null ? 'Sin información' : `${num(c.cumplimiento)} %`}</p>
      <p>NC abiertas: {c.nc_abiertas}</p>
    </div>
  )

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-600">
        {(Object.keys(PUNTO) as Color[]).map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <Punto color={c} /> {ETIQUETA_COLOR[c]}
          </span>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">Protocolo</th>
              {empresas.map(([id, codigo]) => (
                <th key={id} className="px-3 py-2 font-medium">{codigo}</th>
              ))}
            </tr>
          </thead>
          {ambitos.map((a) => {
            const protocolos = [...new Map(celdas.filter((c) => c.ambito === a.valor).map((c) => [c.protocolo_id, c.protocolo])).entries()]
            return (
              <tbody key={a.valor}>
                <tr>
                  <td colSpan={empresas.length + 1} className="bg-slate-50 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {a.etiqueta}
                  </td>
                </tr>
                {protocolos.map(([pid, nombre]) => (
                  <tr key={pid} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 font-medium text-slate-800">{nombre}</td>
                    {empresas.map(([eid]) => {
                      const c = celdas.find((x) => x.protocolo_id === pid && x.empresa_id === eid)
                      return (
                        <td key={eid} className="px-3 py-2">
                          {c ? (
                            <div className="flex gap-2">
                              <Punto color={c.color} />
                              {detalle(c)}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            )
          })}
        </table>
      </div>

      <div className="space-y-4 md:hidden">
        {ambitos.map((a) => (
          <div key={a.valor}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{a.etiqueta}</p>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {celdas
                .filter((c) => c.ambito === a.valor)
                .map((c) => (
                  <li key={`${c.protocolo_id}-${c.empresa_id}`} className="flex gap-2 p-3">
                    <Punto color={c.color} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">
                        {c.protocolo} · {c.empresa}
                      </p>
                      {detalle(c)}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  )
}

export function Inicio() {
  const { filtros } = useSesionActiva()
  const { datos, cargando, error, recargar } = useDatos<Dashboard>('/dashboard', { ...filtros })

  if (cargando && !datos) return <Cargando variante="panel" />
  if (error && !datos) return <MensajeError error={error} onReintentar={recargar} />
  if (!datos) return null
  const k = datos.kpis

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Inicio"
        descripcion={`Estado general${datos.temporada.nombre ? ` · temporada ${datos.temporada.nombre}` : ''}`}
      />
      <MensajeError error={error} onReintentar={recargar} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <Kpi etiqueta="Registros por revisar" valor={String(k.registros_por_revisar)} enlace="/registros?seccion=registros" alerta={false} />
        <Kpi etiqueta="Registros atrasados (15+ días sin revisión)" valor={String(k.registros_atrasados)} enlace="/registros?seccion=registros" alerta={k.registros_atrasados > 0} />
        <Kpi etiqueta="Vencidos" valor={String(k.vencidos)} enlace="/vencimientos" alerta={k.vencidos > 0} />
        <Kpi etiqueta="Vencen en ≤30 días" valor={String(k.vencen_30)} enlace="/vencimientos" alerta={false} />
        <Kpi etiqueta="NC abiertas" valor={String(k.nc_abiertas)} enlace="/no-conformidades" alerta={false} />
        <Kpi etiqueta="NC reincidentes (devueltas por certificaciones)" valor={String(k.nc_reincidentes)} enlace="/no-conformidades" alerta={k.nc_reincidentes > 0} />
        <Kpi etiqueta="NC con plazo vencido" valor={String(k.nc_vencidas)} enlace="/no-conformidades" alerta={k.nc_vencidas > 0} />
        <Kpi
          etiqueta="Análisis fuera de norma"
          valor={`${k.analisis_fuera_norma} / ${k.analisis_total}`}
          enlace="/laboratorio"
          alerta={k.analisis_fuera_norma > 0}
        />
      </div>

      <Tarjeta titulo="Estado por protocolo y empresa">
        <Semaforo celdas={datos.semaforo} />
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="NC abiertas por responsable">
          <Barras datos={datos.nc_por_responsable} />
        </Tarjeta>
        <Tarjeta titulo="NC abiertas por antigüedad">
          <Barras datos={datos.nc_por_antiguedad} />
        </Tarjeta>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo="NC reincidentes abiertas">
          <ListaNc
            ncs={datos.nc_reincidentes}
            vacio="Sin NC devueltas por certificaciones"
            detalle={(n) => `Reincidente ×${n.reincidencias}${n.ultima_revision?.observacion ? ` · ${n.ultima_revision.observacion}` : ''}`}
          />
        </Tarjeta>

        <Tarjeta titulo="Próximos vencimientos" acciones={<Link to="/vencimientos" className="inline-flex min-h-9 items-center rounded-lg px-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">Ver todos</Link>}>
          {datos.proximos_vencimientos.length ? (
            <ul className="divide-y divide-slate-100">
              {datos.proximos_vencimientos.map((v) => (
                <li key={`${v.tipo}-${v.id}`} className="flex items-start justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <Insignia tono={TONO_VENCIMIENTO[v.tipo]}>{ETIQUETA_TIPO[v.tipo]}</Insignia>
                    <p className="mt-1 truncate text-sm text-slate-800" title={v.titulo}>{v.titulo}</p>
                    <p className="truncate text-xs text-slate-500" title={v.unidad}>{v.unidad}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <p className="text-slate-700">{fecha(v.vence)}</p>
                    <p className={v.dias < 0 ? 'font-medium text-red-700' : v.dias <= 7 ? 'text-amber-700' : 'text-slate-500'}>
                      {textoDias(v.dias)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-slate-500">Nada vence en los próximos 60 días</p>
          )}
        </Tarjeta>

        <Tarjeta titulo="Análisis fuera de norma" acciones={<Link to="/laboratorio" className="inline-flex min-h-9 items-center rounded-lg px-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">Ver laboratorio</Link>}>
          {datos.analisis_fuera_norma.length ? (
            <ul className="divide-y divide-slate-100">
              {datos.analisis_fuera_norma.map((a) => (
                <li key={a.id} className="py-2">
                  <Link to="/laboratorio" className="block hover:bg-slate-50">
                    <p className="text-sm font-medium text-slate-800">
                      {a.tipo.nombre} · {a.unidad.nombre}
                    </p>
                    <p className="text-xs text-slate-500">
                      {fecha(a.fecha_muestreo)}
                      {a.fuente_agua ? ` · ${a.fuente_agua}` : ''}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {a.fuera_de_norma.map((p) => (
                        <Insignia key={p} tono="rojo">{p}</Insignia>
                      ))}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-slate-500">Sin análisis fuera de norma</p>
          )}
        </Tarjeta>
      </div>

      <Tarjeta titulo="Cobertura del programa de auditorías internas">
        {datos.cobertura.length ? (
          <ul className="space-y-4">
            {datos.cobertura.map((f) => (
              <li key={`${f.version.id}-${f.unidad.id}`}>
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">
                    {f.protocolo.nombre} <span className="font-normal text-slate-500">({f.version.nombre})</span> · {f.unidad.nombre}
                  </p>
                </div>
                <BarraPorcentaje valor={f.porcentaje} tono="auto" />
                <div className="mt-2 flex flex-wrap gap-1">
                  {f.cobertura.map((c) => (
                    <Insignia key={c.codigo} tono={TONO_COBERTURA[c.estado]} titulo={`${c.titulo ? `${c.titulo} · ` : ''}${c.estado}`}>
                      {c.codigo}
                    </Insignia>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Vacio>Sin auditorías programadas en la temporada para los filtros elegidos</Vacio>
        )}
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          <Insignia tono="verde">Cubierta</Insignia>
          <Insignia tono="azul">Planificada</Insignia>
          <Insignia tono="gris">Pendiente</Insignia>
        </div>
      </Tarjeta>
    </div>
  )
}
