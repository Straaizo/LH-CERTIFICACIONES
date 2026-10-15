import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarPlus, Eye } from 'lucide-react'
import { api } from '../api'
import {
  BarraPorcentaje,
  Boton,
  Campo,
  Cargando,
  EncabezadoPagina,
  Insignia,
  MensajeError,
  Modal,
  Pestanas,
  Tarjeta,
  Vacio,
  claseEntrada,
  useAviso,
  type Tono,
} from '../componentes/ui'
import { useSesionActiva } from '../contexto/Sesion'
import { fecha, ETIQUETA_ESTADO_AUDITORIA } from '../formato'
import { useAccion, useDatos } from '../hooks'
import type { Auditoria, UnidadRef } from '../tipos'
import { Selector } from '../componentes/Desplegable'
import { VerVersionNorma } from '../componentes/VersionNorma'

interface SeccionCobertura {
  codigo: string
  titulo: string
  estado: 'cubierta' | 'en_curso' | 'planificada' | 'pendiente'
  total: number
  respondidos: number
}

interface FilaPrograma {
  protocolo: Auditoria['protocolo']
  version: Auditoria['version']
  unidad: UnidadRef
  auditorias: Auditoria[]
  cobertura: SeccionCobertura[]
  porcentaje: number | null
}

interface Programa {
  temporada: { id: number; nombre: string; inicio: string; fin: string }
  filas: FilaPrograma[]
}

const TONO_ESTADO_AUDITORIA: Record<string, Tono> = { planificada: 'azul', en_curso: 'amarillo', cerrada: 'verde' }

const TONO_COBERTURA: Record<SeccionCobertura['estado'], string> = {
  cubierta: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
  en_curso: 'bg-amber-100 text-amber-800 ring-amber-300',
  planificada: 'bg-sky-100 text-sky-800 ring-sky-300',
  pendiente: 'bg-slate-100 text-slate-500 ring-slate-200',
}

const ETIQUETA_COBERTURA: Record<SeccionCobertura['estado'], string> = {
  cubierta: 'cubierta',
  en_curso: 'en curso',
  planificada: 'planificada',
  pendiente: 'pendiente',
}

const TONO_AUDITORIA_CALENDARIO: Record<Auditoria['estado'], string> = {
  planificada: TONO_COBERTURA.planificada,
  en_curso: TONO_COBERTURA.en_curso,
  cerrada: TONO_COBERTURA.cubierta,
}

function rangoFechas(a: Pick<Auditoria, 'fecha_inicio' | 'fecha_fin'>): string {
  return a.fecha_fin && a.fecha_fin !== a.fecha_inicio ? `${fecha(a.fecha_inicio)} – ${fecha(a.fecha_fin)}` : fecha(a.fecha_inicio)
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function Auditorias() {
  const { esCertificaciones } = useSesionActiva()
  const [pestana, setPestana] = useState<'auditorias' | 'programa'>('auditorias')
  const [planificando, setPlanificando] = useState(false)
  const [version, setVersion] = useState(0)
  const { avisar, nodo } = useAviso()

  return (
    <div>
      <EncabezadoPagina
        titulo="Auditorías"
        descripcion="Auditorías internas por protocolo y sucursal, y programa anual de cobertura de cláusulas."
        acciones={
          esCertificaciones ? (
            <Boton icono={<CalendarPlus className="h-4 w-4" />} onClick={() => setPlanificando(true)}>
              Planificar auditoría
            </Boton>
          ) : (
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm" title="Las auditorías las responde certificaciones. Las no conformidades de tus sucursales se trabajan en No conformidades.">
              <Eye className="h-4 w-4" /> Solo lectura
            </span>
          )
        }
      />
      <Pestanas
        opciones={[
          { valor: 'auditorias', etiqueta: 'Auditorías' },
          { valor: 'programa', etiqueta: 'Programa anual' },
        ]}
        valor={pestana}
        onCambio={setPestana}
      />
      {pestana === 'auditorias' ? <ListaAuditorias key={version} /> : <ProgramaAnual key={version} />}
      {planificando && (
        <ModalPlanificar
          onCerrar={() => setPlanificando(false)}
          onCreada={() => {
            setPlanificando(false)
            setVersion((v) => v + 1)
            avisar('Auditoría planificada')
          }}
        />
      )}
      {nodo}
    </div>
  )
}

function ListaAuditorias() {
  const { filtros } = useSesionActiva()
  const navegar = useNavigate()
  const { datos, cargando, error, recargar } = useDatos<Auditoria[]>('/auditorias', { ...filtros })

  if (cargando && !datos) return <Cargando variante="tarjetas" />
  if (error) return <MensajeError error={error} onReintentar={recargar} />
  if (!datos?.length) return <Vacio>No hay auditorías con los filtros seleccionados.</Vacio>

  return (
    <div>
      <p className="mb-3 text-xs text-slate-500">Cumplimiento = Sí / (Sí + No), sin N/A.</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {datos.map((a) => (
          <button
            key={a.id}
            onClick={() => navegar(`/auditorias/${a.id}`)}
            className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-emerald-400"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{a.titulo}</p>
                <p className="text-sm text-slate-600">
                  {a.protocolo.codigo} {a.version.nombre} · {a.unidad.nombre}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Insignia tono={TONO_ESTADO_AUDITORIA[a.estado]}>{ETIQUETA_ESTADO_AUDITORIA[a.estado]}</Insignia>
                {a.emitida_en && <Insignia tono="violeta">Informe emitido</Insignia>}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
              <span>{rangoFechas(a)}</span>
              {a.secciones.length > 0 && <span>Cláusulas: {a.secciones.join(', ')}</span>}
              <Insignia tono={a.origen === 'importada' ? 'violeta' : 'gris'}>
                {a.origen === 'importada' ? 'Importada' : 'App'}
              </Insignia>
            </div>
            <div className="mt-3">
              <BarraPorcentaje valor={a.resumen.cumplimiento} tono="auto" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <Insignia tono={a.no_conformidades ? 'rojo' : 'gris'}>
                {a.no_conformidades} NC
              </Insignia>
              {a.advertencias.length > 0 && (
                <Insignia tono="amarillo" titulo="Errores detectados en la planilla original">
                  <AlertTriangle className="h-3 w-3" /> {a.advertencias.length} advertencias de importación
                </Insignia>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ProgramaAnual() {
  const { filtros, catalogos } = useSesionActiva()
  const temporadaId = filtros.temporada_id ?? catalogos.temporadas.find((t) => t.actual)?.id
  const { datos, cargando, error, recargar } = useDatos<Programa>(temporadaId ? '/programa' : null, {
    ...filtros,
    temporada_id: temporadaId,
  })

  if (!temporadaId) return <Vacio>Selecciona una temporada para ver el programa anual.</Vacio>
  if (cargando && !datos) return <Cargando variante="tabla" />
  if (error) return <MensajeError error={error} onReintentar={recargar} />
  if (!datos) return null

  const [anioInicio, mesInicio] = datos.temporada.inicio.slice(0, 7).split('-').map(Number)
  const meses = Array.from({ length: 12 }, (_, i) => {
    const indice = mesInicio - 1 + i
    return { anio: anioInicio + Math.floor(indice / 12), mes: indice % 12 }
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <p>
          Temporada <span className="font-medium text-slate-800">{datos.temporada.nombre}</span>. BRCGS exige cubrir
          todas sus cláusulas a lo largo del año.
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <Insignia tono="verde">Cubierta</Insignia>
          <Insignia tono="amarillo">En curso</Insignia>
          <Insignia tono="azul">Planificada</Insignia>
          <Insignia tono="gris">Pendiente</Insignia>
        </div>
      </div>
      {!datos.filas.length && <Vacio>No hay auditorías en esta temporada con los filtros seleccionados.</Vacio>}
      {datos.filas.map((fila) => (
        <Tarjeta
          key={`${fila.version.id}-${fila.unidad.id}`}
          titulo={
            <span>
              {fila.protocolo.codigo} {fila.version.nombre} · {fila.unidad.nombre}
            </span>
          }
        >
          <div className="mb-3">
            <p className="mb-1 text-xs text-slate-500">Cobertura de cláusulas</p>
            <BarraPorcentaje valor={fila.porcentaje} tono="auto" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {fila.cobertura.map((s) => (
              <span
                key={s.codigo}
                title={`${s.codigo}${s.titulo ? ` ${s.titulo}` : ''}: ${ETIQUETA_COBERTURA[s.estado]} · ${s.respondidos}/${s.total}`}
                className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${TONO_COBERTURA[s.estado]}`}
              >
                {s.codigo}
              </span>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto">
            <div className="grid min-w-[720px] grid-cols-12 gap-1">
              {meses.map(({ anio, mes }) => {
                const delMes = fila.auditorias.filter((a) => {
                  const [y, m] = a.fecha.slice(0, 7).split('-').map(Number)
                  return y === anio && m - 1 === mes
                })
                return (
                  <div key={`${anio}-${mes}`} className="min-h-16 rounded-md border border-slate-100 bg-slate-50 p-1">
                    <p className="text-center text-[11px] font-medium text-slate-500">
                      {MESES[mes]} {String(anio).slice(2)}
                    </p>
                    {delMes.map((a) => (
                      <Link
                        key={a.id}
                        to={`/auditorias/${a.id}`}
                        title={`${a.titulo} · ${rangoFechas(a)}`}
                        className={`mt-1 block truncate rounded px-1 py-0.5 text-[11px] ring-1 ring-inset ${
                          TONO_AUDITORIA_CALENDARIO[a.estado]
                        }`}
                      >
                        {a.fecha.slice(8, 10)} · {a.secciones.join(', ') || 'Todo'}
                      </Link>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </Tarjeta>
      ))}
    </div>
  )
}

function ModalPlanificar({ onCerrar, onCreada }: { onCerrar: () => void; onCreada: () => void }) {
  const { catalogos, filtros } = useSesionActiva()
  const [titulo, setTitulo] = useState('')
  const [protocoloId, setProtocoloId] = useState<number | ''>(filtros.protocolo_id ?? '')
  const [versionId, setVersionId] = useState<number | ''>('')
  const [unidadId, setUnidadId] = useState<number | ''>(filtros.unidad_id ?? '')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [auditor, setAuditor] = useState('')
  const [viendoVersion, setViendoVersion] = useState<number | null>(null)
  const { ocupado, error, ejecutar } = useAccion()

  const protocolo = catalogos.protocolos.find((p) => p.id === protocoloId)
  const unidad = catalogos.unidades.find((u) => u.id === unidadId)
  const temporada = fechaInicio
    ? catalogos.temporadas.find((t) => t.inicio.slice(0, 10) <= fechaInicio && fechaInicio <= t.fin.slice(0, 10))
    : catalogos.temporadas.find((t) => t.actual)
  // Primero la sucursal; el protocolo solo ofrece los que aplican a ella (planta, campo o packing)
  const unidades = catalogos.unidades.filter((u) => !filtros.empresa_id || u.empresa_id === filtros.empresa_id)
  const protocolos = unidadId ? catalogos.protocolos.filter((p) => p.unidades_aplica.includes(unidadId)) : []
  const tituloSugerido = `Auditoría interna ${protocolo?.nombre ?? '‹protocolo›'} ${temporada?.nombre ?? '‹temporada›'} · ${
    unidad?.nombre ?? '‹sucursal›'
  }`

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await ejecutar(() =>
      api.post('/auditorias', {
        version_id: versionId,
        unidad_id: unidadId,
        titulo: titulo.trim() || null,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin || null,
        auditor: auditor.trim() || null,
      }),
    )
    if (ok) onCreada()
  }

  return (
    <Modal abierto titulo="Planificar auditoría" onCerrar={onCerrar} ancho="max-w-lg">
      <form onSubmit={enviar} className="space-y-3">
        <Campo etiqueta="Título (opcional)" ayuda="Si lo dejas vacío se usa un título automático.">
          <input
            className={claseEntrada}
            maxLength={250}
            placeholder={tituloSugerido}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Sucursal">
          <Selector
            required
            className={claseEntrada}
            value={unidadId}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : ''
              setUnidadId(id)
              if (protocolo && (!id || !protocolo.unidades_aplica.includes(id))) {
                setProtocoloId('')
                setVersionId('')
              }
            }}
          >
            <option value="">Selecciona…</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Protocolo" ayuda={unidadId ? undefined : 'Elige primero la sucursal.'}>
          <Selector
            required
            disabled={!unidadId}
            className={claseEntrada}
            value={protocoloId}
            onChange={(e) => {
              setProtocoloId(e.target.value ? Number(e.target.value) : '')
              setVersionId('')
            }}
          >
            <option value="">Selecciona…</option>
            {protocolos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Versión de la norma" ayuda="La auditoría incluye todas las cláusulas de esta versión.">
          <Selector
            required
            className={claseEntrada}
            value={versionId}
            disabled={!protocolo}
            onChange={(e) => setVersionId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Selecciona…</option>
            {protocolo?.versiones.map((v) => (
              <option key={v.id} value={v.id} disabled={v.requisitos === 0}>
                {v.nombre}
                {v.vigente ? ' (vigente)' : ''}
                {v.requisitos === 0 ? ' — sin requisitos importados' : ` — ${v.requisitos} requisitos`}
                {v.cargada_en ? ` · cargada ${fecha(v.cargada_en)}` : ''}
              </option>
            ))}
          </Selector>
        </Campo>
        {versionId !== '' && (
          <button type="button" onClick={() => setViendoVersion(Number(versionId))}
            className="-mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
            <Eye className="h-4 w-4" /> Ver los puntos de esta versión
          </button>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Fecha inicio">
            <input
              required
              type="date"
              className={claseEntrada}
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Fecha fin">
            <input
              type="date"
              className={claseEntrada}
              min={fechaInicio || undefined}
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </Campo>
        </div>
        <Campo etiqueta="Auditor">
          <input className={claseEntrada} value={auditor} onChange={(e) => setAuditor(e.target.value)} />
        </Campo>
        <MensajeError error={error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton type="button" variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" ocupado={ocupado}>
            Planificar
          </Boton>
        </div>
      </form>
      {viendoVersion !== null && <VerVersionNorma versionId={viendoVersion} onCerrar={() => setViendoVersion(null)} />}
    </Modal>
  )
}
