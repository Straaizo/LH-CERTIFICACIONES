import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Activity, ArrowDown, ArrowUp, ChevronDown, ClipboardList, Download, Eye, FileUp, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { api, descargarArchivo } from '../api'
import { useAccion, useDatos } from '../hooks'
import { fecha, fechaYHora } from '../formato'
import type { UnidadRef } from '../tipos'
import { useSesionActiva } from '../contexto/Sesion'
import {
  BarraPorcentaje, Boton, Campo, Cargando, ElegirArchivo, EncabezadoPagina, Insignia, MensajeError, Modal, Pestanas, Vacio,
  claseEntrada,
  useAviso, type Tono,
} from '../componentes/ui'
import { Documentos } from './Documentos'
import { Selector } from '../componentes/Desplegable'

// ---------- Tipos compartidos con RegistroDetalle ----------

export type TipoCampo = 'texto' | 'numero' | 'fecha' | 'si_no' | 'tabla' | 'checklist' | 'foto' | 'archivo' | 'firma'
export type TipoColumna = 'texto' | 'numero' | 'fecha' | 'si_no'
export type AmbitoPlantilla = 'campo' | 'planta' | 'ambos'
export type EstadoRegistro = 'borrador' | 'en_revision' | 'aprobado' | 'rechazado'
type FiltroRegistro = '' | EstadoRegistro | 'atrasado'
export type OpcionChecklist = 'si' | 'no' | 'na'
export type Orientacion = 'vertical' | 'horizontal'

export interface ColumnaRegistro {
  id: string
  etiqueta: string
  tipo: TipoColumna
}

export interface ItemChecklist {
  id: string
  texto: string
  seccion: string
}

export interface RespuestaChecklist {
  r: OpcionChecklist | null
  obs: string
}

export interface CampoRegistro {
  id: string
  etiqueta: string
  tipo: TipoCampo
  obligatorio: boolean
  columnas?: ColumnaRegistro[]
  filas_sugeridas?: number
  items?: ItemChecklist[]
  opciones?: OpcionChecklist[]
  con_observacion?: boolean
}

export interface FormatoPlantilla {
  encargado?: string
  frecuencia?: string
  orientacion?: Orientacion
  creado_por?: string
  aprobado_por?: string
  fecha_revision?: string
  direccion?: string
  notas?: string[]
}

export interface Plantilla {
  id: number
  codigo: string | null
  version: string
  nombre: string
  descripcion: string | null
  ambito: AmbitoPlantilla
  formato: FormatoPlantilla
  campos: CampoRegistro[]
  activa: boolean
  creada_en: string
}

export interface Registro {
  id: number
  titulo: string
  estado: EstadoRegistro
  observacion: string | null
  codigo: string | null
  version: string | null
  plantilla: { id: number; nombre: string }
  unidad: UnidadRef
  temporada_id: number | null
  responsable: { id: number; nombre: string } | null
  /** Última vez que alguien del campo guardó o envió */
  fecha_revision: string | null
  dias_sin_revision: number
  /** 15 días o más sin revisión del campo mientras se llena */
  atrasado: boolean
  creado_en: string
  actualizado_en: string | null
  enviado_en: string | null
  aprobado_en: string | null
  aprobado_por: string | null
  actualizado_por: string | null
  tiene_word_original: boolean
  avance: { completos: number; total: number; porcentaje: number }
  campos?: CampoRegistro[]
  valores?: Record<string, unknown>
  formato?: FormatoPlantilla
  tiene_logo?: boolean
}

export const ETIQUETA_TIPO: Record<TipoCampo, string> = {
  texto: 'Texto',
  numero: 'Número',
  fecha: 'Fecha',
  si_no: 'Sí/No',
  tabla: 'Tabla',
  checklist: 'Checklist',
  foto: 'Foto',
  archivo: 'Archivo',
  firma: 'Firma',
}

export const ESTADO_REGISTRO: Record<EstadoRegistro, { texto: string; tono: Tono }> = {
  borrador: { texto: 'Borrador', tono: 'gris' },
  en_revision: { texto: 'En revisión', tono: 'azul' },
  aprobado: { texto: 'Aprobado', tono: 'verde' },
  rechazado: { texto: 'Rechazado', tono: 'rojo' },
}

export const ETIQUETA_AMBITO: Record<AmbitoPlantilla, string> = { campo: 'Campo', planta: 'Planta', ambos: 'Campo y planta' }

export const ETIQUETA_OPCION: Record<OpcionChecklist, string> = { si: 'Sí', no: 'No', na: 'N/A' }
export const OPCIONES_CHECKLIST: OpcionChecklist[] = ['si', 'no', 'na']

export type AccionEvento = 'crear' | 'guardar' | 'enviar' | 'aprobar' | 'rechazar' | 'llenar'

export interface EventoRegistro {
  id: number
  fecha_hora: string
  usuario: string
  accion: AccionEvento
  detalle: { cambios?: string[]; avance?: number; observacion?: string | null }
  registro_id: number
  registro?: { id: number; titulo: string; codigo: string | null; unidad: string; estado: EstadoRegistro }
}

export const VERBO_ACCION: Record<AccionEvento, string> = {
  crear: 'creó',
  guardar: 'guardó cambios en',
  llenar: 'guardó cambios en',
  enviar: 'envió a revisión',
  aprobar: 'aprobó',
  rechazar: 'rechazó',
}

export function tiempoRelativo(valor: string): string {
  const minutos = Math.floor((Date.now() - new Date(valor).getTime()) / 60000)
  if (Number.isNaN(minutos)) return '—'
  if (minutos < 1) return 'recién'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias < 30) return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
  return fechaYHora(valor)
}

export function UltimoCambio({ registro, className = '' }: { registro: Pick<Registro, 'actualizado_por' | 'actualizado_en'>; className?: string }) {
  return (
    <p className={`text-xs text-slate-500 ${className}`}>
      {registro.actualizado_por && registro.actualizado_en
        ? `Último cambio: ${registro.actualizado_por} · ${fechaYHora(registro.actualizado_en)}`
        : 'Sin cambios aún'}
    </p>
  )
}

/** El título del registro empieza con el código: se muestra sin repetirlo junto a la insignia del código. */
function tituloSinCodigo(r: Pick<Registro, 'titulo' | 'codigo'>): string {
  return r.codigo && r.titulo.startsWith(r.codigo) ? r.titulo.slice(r.codigo.length).trim() : r.titulo
}

export function Codigo({ codigo, className = '' }: { codigo: string | null | undefined; className?: string }) {
  if (!codigo) return null
  return <span className={`font-mono text-xs font-semibold text-emerald-800 ${className}`}>{codigo}</span>
}

const ordenarPlantillas = (lista: Plantilla[]) =>
  [...lista].sort((a, b) =>
    (a.codigo ?? '￿').localeCompare(b.codigo ?? '￿', 'es', { numeric: true }) || a.nombre.localeCompare(b.nombre, 'es'))

const nombrePlantilla = (p: Pick<Plantilla, 'codigo' | 'nombre'>) => (p.codigo ? `${p.codigo} · ${p.nombre}` : p.nombre)


// ---------- Página ----------

type Seccion = 'documentos' | 'registros' | 'plantillas'

export function Registros() {
  const { esCertificaciones } = useSesionActiva()
  const [parametros, setParametros] = useSearchParams()
  const pedida = parametros.get('seccion')
  const seccion: Seccion = parametros.get('doc')
    ? 'documentos'
    : pedida === 'registros' || (pedida === 'plantillas' && esCertificaciones)
      ? pedida
      : 'documentos'

  const opciones: { valor: Seccion; etiqueta: string }[] = [
    { valor: 'documentos', etiqueta: 'Documentos fijos' },
    { valor: 'registros', etiqueta: 'Registros' },
    ...(esCertificaciones ? [{ valor: 'plantillas' as const, etiqueta: 'Plantillas' }] : []),
  ]

  return (
    <div>
      <EncabezadoPagina
        titulo="Registros"
        descripcion="Documentos fijos que se suben como archivo y registros que se llenan en la aplicación."
      />
      <Pestanas opciones={opciones} valor={seccion} onCambio={(v) => setParametros(new URLSearchParams({ seccion: v }))} />
      {seccion === 'documentos' && <Documentos embebido />}
      {seccion === 'registros' && <ListaRegistros />}
      {seccion === 'plantillas' && esCertificaciones && <ListaPlantillas />}
    </div>
  )
}

// ---------- Registros ----------

function ListaRegistros() {
  const { filtros, esCertificaciones } = useSesionActiva()
  const navigate = useNavigate()
  const [estado, setEstado] = useState<FiltroRegistro>('')
  const [plantillaId, setPlantillaId] = useState('')
  const [nuevoAbierto, setNuevoAbierto] = useState(false)

  const { datos, cargando, error, recargar } = useDatos<Registro[]>('/registros', {
    empresa_id: filtros.empresa_id,
    unidad_id: filtros.unidad_id,
    temporada_id: filtros.temporada_id,
    plantilla_id: plantillaId || undefined,
  })
  const plantillas = useDatos<Plantilla[]>('/registros/plantillas')

  const cumple = (r: Registro, f: FiltroRegistro) => !f || (f === 'atrasado' ? r.atrasado : r.estado === f)
  const lista = useMemo(() => (datos ?? []).filter((r) => cumple(r, estado)), [datos, estado])
  const cuenta = (f: FiltroRegistro) => (datos ?? []).filter((r) => cumple(r, f)).length
  const resumen: { estado: FiltroRegistro; texto: string; clase: string }[] = [
    { estado: 'borrador', texto: 'Por llenar', clase: 'text-slate-900' },
    { estado: 'en_revision', texto: 'En revisión', clase: 'text-sky-700' },
    { estado: 'rechazado', texto: 'Rechazados', clase: 'text-amber-700' },
    { estado: 'atrasado', texto: 'Atrasados (15+ días)', clase: 'text-red-700' },
  ]

  const abrir = (id: number) => navigate(`/registros/r/${id}`)
  const descarga = useAccion()
  const [descargandoId, setDescargandoId] = useState<number | null>(null)
  const descargarWord = async (id: number) => {
    setDescargandoId(id)
    await descarga.ejecutar(() => descargarArchivo(`/registros/${id}/exportar`, { formato: 'docx' }, 'registro.docx'))
    setDescargandoId(null)
  }

  return (
    <div>
      {esCertificaciones && <ActividadReciente />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Los registros se crean desde una plantilla; el encargado los llena y certificaciones los aprueba.
        </p>
        {esCertificaciones && (
          <Boton icono={<Plus className="h-4 w-4" />} onClick={() => setNuevoAbierto(true)}>
            Nuevo registro
          </Boton>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {resumen.map((r) => (
          <button
            key={r.estado}
            onClick={() => setEstado(estado === r.estado ? '' : r.estado)}
            className={`rounded-xl border bg-white p-3 text-left shadow-sm ${
              estado === r.estado ? 'border-emerald-600 ring-2 ring-emerald-600/20' : 'border-slate-200'
            }`}
          >
            <div className={`text-2xl font-semibold tabular-nums ${r.clase}`}>{datos ? cuenta(r.estado) : '—'}</div>
            <div className="text-xs text-slate-500">{r.texto}</div>
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo etiqueta="Estado">
          <Selector className={claseEntrada} value={estado} onChange={(e) => setEstado(e.target.value as FiltroRegistro)}>
            <option value="">Todos</option>
            {(Object.keys(ESTADO_REGISTRO) as EstadoRegistro[]).map((e) => (
              <option key={e} value={e}>{ESTADO_REGISTRO[e].texto}</option>
            ))}
            <option value="atrasado">Atrasados (15+ días sin revisión)</option>
          </Selector>
        </Campo>
        <Campo etiqueta="Plantilla">
          <Selector className={claseEntrada} value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)}>
            <option value="">Todas</option>
            {ordenarPlantillas(plantillas.datos ?? []).map((p) => (
              <option key={p.id} value={p.id}>{nombrePlantilla(p)}</option>
            ))}
          </Selector>
        </Campo>
      </div>

      <MensajeError error={plantillas.error} onReintentar={plantillas.recargar} />
      <MensajeError error={error} onReintentar={recargar} />
      <MensajeError error={descarga.error} />
      {cargando && !datos ? (
        <Cargando variante="tabla" />
      ) : !lista.length ? (
        <Vacio>No hay registros con estos filtros.</Vacio>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {lista.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <button onClick={() => abrir(r.id)} className="block w-full rounded-xl p-4 text-left active:bg-slate-50">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-500">
                    <Codigo codigo={r.codigo} className="text-sm" />
                    <span>{r.plantilla.nombre}</span>
                  </div>
                  <div className="mt-0.5 font-medium text-slate-900">{r.titulo}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {r.unidad.nombre} · {r.responsable?.nombre ?? 'Sin responsable'}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                    <EstadoInsignia registro={r} />
                    <FechaRevision registro={r} />
                  </div>
                  <div className="mt-2"><BarraPorcentaje valor={r.avance.porcentaje} /></div>
                  <UltimoCambio registro={r} className="mt-1" />
                  {r.estado === 'rechazado' && r.observacion && (
                    <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">{r.observacion}</p>
                  )}
                </button>
                {esCertificaciones && (
                  <div className="flex gap-2 border-t border-slate-100 p-3">
                    <Boton className="flex-1 py-3" icono={<Eye className="h-4 w-4" />} onClick={() => abrir(r.id)}>Ver avance</Boton>
                    <Boton variante="secundario" className="flex-1 py-3" icono={<Download className="h-4 w-4" />}
                      ocupado={descargandoId === r.id} disabled={descarga.ocupado} onClick={() => void descargarWord(r.id)}>
                      Word
                    </Boton>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Registro</th>
                  <th className="px-4 py-2.5">Fecha de revisión</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="min-w-52 px-4 py-2.5">Avance</th>
                  {esCertificaciones && <th className="px-3 py-2"><span className="sr-only">Acciones</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((r) => (
                  <tr key={r.id} onClick={() => abrir(r.id)} className="cursor-pointer align-top hover:bg-slate-50">
                    <td className="min-w-64 px-4 py-3">
                      <Codigo codigo={r.codigo} />
                      <p className="mt-0.5 font-medium text-slate-900">{tituloSinCodigo(r)}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {r.unidad.nombre} · {r.responsable?.nombre ?? 'Sin responsable'}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3"><FechaRevision registro={r} /></td>
                    <td className="px-4 py-3">
                      <EstadoInsignia registro={r} />
                      {r.estado === 'rechazado' && r.observacion && (
                        <p className="mt-1 max-w-56 text-xs text-red-700">{r.observacion}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <BarraPorcentaje valor={r.avance.porcentaje} />
                      <UltimoCambio registro={r} className="mt-1" />
                    </td>
                    {esCertificaciones && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <Boton variante="secundario" className="whitespace-nowrap" icono={<Eye className="h-4 w-4" />} onClick={() => abrir(r.id)}>
                            Ver avance
                          </Boton>
                          <Boton variante="secundario" icono={<Download className="h-4 w-4" />} title="Descargar Word"
                            aria-label="Descargar Word" ocupado={descargandoId === r.id} disabled={descarga.ocupado}
                            onClick={() => void descargarWord(r.id)} />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {nuevoAbierto && <NuevoRegistro onCerrar={() => setNuevoAbierto(false)} onCreado={(r) => abrir(r.id)} />}
    </div>
  )
}

function detalleEvento(e: EventoRegistro): string {
  const partes = [...(e.detalle?.cambios ?? [])]
  if (typeof e.detalle?.avance === 'number') partes.push(`avance ${e.detalle.avance} %`)
  if (e.detalle?.observacion) partes.push(`“${e.detalle.observacion}”`)
  return partes.join(' · ')
}

function ActividadReciente() {
  const [limite, setLimite] = useState(15)
  const [abierto, setAbierto] = useState(false)
  const { datos, cargando, error, recargar } = useDatos<EventoRegistro[]>('/registros/actividad', { limite })

  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left md:cursor-default"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Activity className="h-4 w-4 text-emerald-700" /> Actividad reciente
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform md:hidden ${abierto ? 'rotate-180' : ''}`} />
      </button>
      <div className={`${abierto ? 'block' : 'hidden'} border-t border-slate-100 px-4 py-3 md:block`}>
        <MensajeError error={error} onReintentar={recargar} />
        {cargando && !datos ? (
          <Cargando variante="lista" />
        ) : !datos?.length ? (
          <p className="text-sm text-slate-500">Todavía no hay actividad en los registros.</p>
        ) : (
          <>
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {datos.map((e) => {
                const detalle = detalleEvento(e)
                return (
                  <li key={e.id} className="py-2 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="min-w-0 text-slate-700">
                        <span className="font-medium text-slate-900">{e.usuario}</span> {VERBO_ACCION[e.accion] ?? e.accion}{' '}
                        <Link to={`/registros/r/${e.registro_id}`} className="font-medium text-emerald-700 hover:underline">
                          {e.registro?.codigo || e.registro?.titulo || `registro ${e.registro_id}`}
                        </Link>
                        {e.registro && <span className="text-slate-500"> · {e.registro.unidad}</span>}
                      </p>
                      <span className="whitespace-nowrap text-xs text-slate-500" title={fechaYHora(e.fecha_hora)}>
                        {tiempoRelativo(e.fecha_hora)}
                      </span>
                    </div>
                    {detalle && <p className="mt-0.5 text-xs text-slate-500">{detalle}</p>}
                  </li>
                )
              })}
            </ul>
            {limite < 60 && datos.length >= limite && (
              <Boton variante="fantasma" className="mt-2 w-full sm:w-auto" ocupado={cargando} onClick={() => setLimite(60)}>
                Ver más
              </Boton>
            )}
          </>
        )}
      </div>
    </section>
  )
}

export function EstadoInsignia({ registro }: { registro: Pick<Registro, 'estado'> }) {
  const e = ESTADO_REGISTRO[registro.estado] ?? { texto: registro.estado, tono: 'gris' as Tono }
  return <Insignia tono={e.tono}>{e.texto}</Insignia>
}

/** Fecha de la última revisión del campo; "Atrasado" si pasan 15 días o más sin revisar mientras se llena. */
export function FechaRevision({ registro }: { registro: Pick<Registro, 'fecha_revision' | 'atrasado' | 'dias_sin_revision'> }) {
  return (
    <span className={`inline-flex flex-col ${registro.atrasado ? 'text-red-700' : 'text-slate-600'}`}>
      <span className={registro.atrasado ? 'font-semibold' : ''}>
        {registro.fecha_revision ? fecha(registro.fecha_revision) : 'Sin revisión del campo'}
      </span>
      {registro.atrasado && (
        <span className="mt-0.5 w-fit">
          <Insignia tono="rojo" titulo="15 días o más sin que el campo lo actualice">
            Atrasado · {registro.dias_sin_revision} días
          </Insignia>
        </span>
      )}
    </span>
  )
}

function NuevoRegistro({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: (r: Registro) => void }) {
  const { catalogos } = useSesionActiva()
  const plantillas = useDatos<Plantilla[]>('/registros/plantillas', { solo_activas: true })
  const accion = useAccion()
  const [plantillaId, setPlantillaId] = useState('')
  const [unidadId, setUnidadId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [responsableId, setResponsableId] = useState('')

  const plantilla = plantillas.datos?.find((p) => String(p.id) === plantillaId)
  const unidades = catalogos.unidades.filter((u) => !plantilla || plantilla.ambito === 'ambos' || u.tipo === plantilla.ambito)
  const mes = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date())
  const sugerencia = (p?: Plantilla) => (p ? `${p.codigo ? `${p.codigo} ` : ''}${p.nombre} · ${mes}` : '')
  const ordenadas = useMemo(() => ordenarPlantillas(plantillas.datos ?? []), [plantillas.datos])

  const elegirPlantilla = (id: string) => {
    const nueva = plantillas.datos?.find((p) => String(p.id) === id)
    if (!titulo.trim() || titulo === sugerencia(plantilla)) setTitulo(sugerencia(nueva))
    if (nueva && nueva.ambito !== 'ambos' && !catalogos.unidades.some((u) => String(u.id) === unidadId && u.tipo === nueva.ambito)) {
      setUnidadId('')
    }
    setPlantillaId(id)
  }

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    const r: { creado?: Registro } = {}
    const ok = await accion.ejecutar(async () => {
      r.creado = await api.post<Registro>('/registros', {
        plantilla_id: Number(plantillaId),
        unidad_id: Number(unidadId),
        titulo: titulo.trim(),
        responsable_id: responsableId ? Number(responsableId) : null,
      })
    })
    if (ok && r.creado) onCreado(r.creado)
  }

  return (
    <Modal abierto titulo="Nuevo registro" onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-4">
        <MensajeError error={plantillas.error} onReintentar={plantillas.recargar} />
        {plantillas.cargando && !plantillas.datos ? (
          <Cargando variante="formulario" />
        ) : !plantillas.datos?.length ? (
          <Vacio>No hay plantillas activas. Cree una en la pestaña Plantillas.</Vacio>
        ) : (
          <>
            <Campo etiqueta="Plantilla" ayuda={plantilla?.descripcion ?? undefined}>
              <Selector required className={claseEntrada} value={plantillaId} onChange={(e) => elegirPlantilla(e.target.value)}>
                <option value="">Seleccione…</option>
                {ordenadas.map((p) => (
                  <option key={p.id} value={p.id}>{nombrePlantilla(p)} ({ETIQUETA_AMBITO[p.ambito]})</option>
                ))}
              </Selector>
            </Campo>
            {plantilla && (
              <div className="grid grid-cols-1 gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="block text-xs text-slate-500">Encargado</span>
                  <span className="text-slate-800">{plantilla.formato?.encargado || '—'}</span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Frecuencia</span>
                  <span className="text-slate-800">{plantilla.formato?.frecuencia || '—'}</span>
                </div>
              </div>
            )}
            <Campo etiqueta="Sucursal">
              <Selector required className={claseEntrada} value={unidadId} onChange={(e) => setUnidadId(e.target.value)}>
                <option value="">Seleccione…</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre} ({u.tipo === 'campo' ? 'Campo' : 'Planta'})</option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Título">
              <input required minLength={2} maxLength={250} className={claseEntrada} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </Campo>
            <Campo etiqueta="Responsable">
              <Selector className={claseEntrada} value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
                <option value="">Sin responsable</option>
                {catalogos.usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </Selector>
            </Campo>
          </>
        )}
        <MensajeError error={accion.error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton type="button" variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" ocupado={accion.ocupado} disabled={!plantillas.datos?.length} icono={<Plus className="h-4 w-4" />}>
            Crear registro
          </Boton>
        </div>
      </form>
    </Modal>
  )
}

// ---------- Plantillas ----------

function ListaPlantillas() {
  const { datos, cargando, error, recargar } = useDatos<Plantilla[]>('/registros/plantillas')
  const [editando, setEditando] = useState<Plantilla | 'nueva' | null>(null)
  const [importando, setImportando] = useState(false)
  const { avisar, nodo } = useAviso()
  const ordenadas = useMemo(() => ordenarPlantillas(datos ?? []), [datos])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Las plantillas definen los campos que el encargado debe llenar en cada registro.</p>
        <div className="flex flex-wrap gap-2">
          <Boton variante="secundario" icono={<FileUp className="h-4 w-4" />} onClick={() => setImportando(true)}>
            Importar desde Word
          </Boton>
          <Boton icono={<Plus className="h-4 w-4" />} onClick={() => setEditando('nueva')}>Nueva plantilla</Boton>
        </div>
      </div>

      <MensajeError error={error} onReintentar={recargar} />
      {cargando && !datos ? (
        <Cargando variante="tabla" />
      ) : !ordenadas.length ? (
        <Vacio>Todavía no hay plantillas.</Vacio>
      ) : (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {ordenadas.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <Codigo codigo={p.codigo} className="text-sm" />
                  <span className="font-medium text-slate-900">{p.nombre}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {p.codigo && <span>Versión {p.version}</span>}
                  <span>{ETIQUETA_AMBITO[p.ambito] ?? p.ambito}</span>
                  <span>· {p.campos.length} {p.campos.length === 1 ? 'campo' : 'campos'}</span>
                  {p.formato?.frecuencia && <span>· {p.formato.frecuencia}</span>}
                  {p.activa ? <Insignia tono="verde">Activa</Insignia> : <Insignia>Inactiva</Insignia>}
                </div>
                {p.descripcion && <p className="mt-1 text-xs text-slate-500">{p.descripcion}</p>}
              </div>
              <Boton variante="secundario" icono={<Pencil className="h-4 w-4" />} onClick={() => setEditando(p)}>
                Editar
              </Boton>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <ConstructorPlantilla
          plantilla={editando === 'nueva' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardada={(msg) => { setEditando(null); avisar(msg); void recargar() }}
        />
      )}
      {importando && (
        <ImportarWord
          onCerrar={() => setImportando(false)}
          onImportada={(msg) => { setImportando(false); avisar(msg); void recargar() }}
        />
      )}
      {nodo}
    </div>
  )
}

// ---------- Importar desde Word ----------

interface VistaImportacion {
  codigo: string | null
  version: string
  nombre: string
  formato: FormatoPlantilla
  campos: CampoRegistro[]
  advertencias: string[]
  tiene_logo: boolean
  ya_existe: boolean
  plantilla?: Plantilla
}

function ResumenCampos({ campos }: { campos: CampoRegistro[] }) {
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
      {campos.map((c) => {
        const secciones = [...new Set((c.items ?? []).map((it) => it.seccion).filter(Boolean))]
        return (
          <li key={c.id}>
            {c.etiqueta}{' '}
            <span className="text-xs text-slate-500">
              ({ETIQUETA_TIPO[c.tipo] ?? c.tipo}
              {c.tipo === 'tabla' && c.columnas?.length ? `: ${c.columnas.map((x) => x.etiqueta).join(', ')}` : ''}
              {c.tipo === 'tabla' && c.filas_sugeridas ? ` · ${c.filas_sugeridas} filas sugeridas` : ''}
              {c.tipo === 'checklist' ? `: ${c.items?.length ?? 0} ítems` : ''}
              {c.tipo === 'checklist' && secciones.length ? ` en ${secciones.length} secciones (${secciones.join(', ')})` : ''})
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{etiqueta}</dt>
      <dd className="text-slate-800">{valor || '—'}</dd>
    </div>
  )
}

function ImportarWord({ onCerrar, onImportada }: { onCerrar: () => void; onImportada: (mensaje: string) => void }) {
  const accion = useAccion()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [ambito, setAmbito] = useState<AmbitoPlantilla>('campo')
  const [reemplazar, setReemplazar] = useState(false)
  const [vista, setVista] = useState<VistaImportacion | null>(null)

  const enviar = (confirmar: boolean) => {
    const datos = new FormData()
    datos.append('archivo', archivo as File)
    datos.append('confirmar', String(confirmar))
    datos.append('ambito', ambito)
    datos.append('reemplazar', String(reemplazar))
    return api.post<VistaImportacion>('/registros/plantillas/importar-word', datos)
  }

  const previsualizar = async (e: FormEvent) => {
    e.preventDefault()
    if (!archivo) return accion.setError('Elija un archivo Word .docx')
    setVista(null)
    await accion.ejecutar(async () => setVista(await enviar(false)))
  }

  const crear = async () => {
    const r: { resultado?: VistaImportacion } = {}
    const ok = await accion.ejecutar(async () => { r.resultado = await enviar(true) })
    if (ok && r.resultado) {
      const p = r.resultado.plantilla
      onImportada(`${vista?.ya_existe ? 'Plantilla actualizada' : 'Plantilla creada'}: ${p ? nombrePlantilla(p) : r.resultado.nombre}`)
    }
  }

  const f = vista?.formato ?? {}
  const pie = [
    f.creado_por && `Creado por: ${f.creado_por}`,
    f.aprobado_por && `Aprobado y autorizado por: ${f.aprobado_por}`,
    f.fecha_revision && `Fecha de revisión: ${f.fecha_revision}`,
    f.direccion,
  ].filter(Boolean) as string[]

  return (
    <Modal abierto titulo="Importar plantilla desde Word" onCerrar={onCerrar} ancho="max-w-3xl">
      <form onSubmit={previsualizar} className="space-y-4">
        <p className="text-sm text-slate-600">
          La aplicación lee el Word (código, encabezado, pie, tablas y checklist) y crea la plantilla. Luego puedes ajustarla.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo etiqueta="Archivo Word (.docx)">
            <ElegirArchivo
              aceptar=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onCambio={(f) => { setArchivo(f); setVista(null); setReemplazar(false) }}
            />
          </Campo>
          <Campo etiqueta="Ámbito">
            <Selector className={claseEntrada} value={ambito} onChange={(e) => setAmbito(e.target.value as AmbitoPlantilla)}>
              {(Object.keys(ETIQUETA_AMBITO) as AmbitoPlantilla[]).map((a) => (
                <option key={a} value={a}>{ETIQUETA_AMBITO[a]}</option>
              ))}
            </Selector>
          </Campo>
        </div>

        {vista && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <Codigo codigo={vista.codigo} className="text-base" />
              <span className="font-semibold text-slate-900">{vista.nombre}</span>
              <span className="text-xs text-slate-500">Versión {vista.version}</span>
            </div>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <Dato etiqueta="Encargado" valor={f.encargado} />
              <Dato etiqueta="Frecuencia" valor={f.frecuencia} />
              <Dato etiqueta="Logo" valor={vista.tiene_logo ? 'Sí' : 'No'} />
            </dl>
            {pie.length > 0 && (
              <div className="text-sm">
                <div className="text-xs text-slate-500">Pie del documento</div>
                <p className="text-slate-700">{pie.join(' · ')}</p>
              </div>
            )}
            {!!f.notas?.length && (
              <div className="text-sm">
                <div className="text-xs text-slate-500">Notas</div>
                <ul className="list-disc pl-5 text-xs italic text-slate-600">
                  {f.notas.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}
            <div>
              <div className="mb-1 text-xs text-slate-500">Campos ({vista.campos.length})</div>
              <ResumenCampos campos={vista.campos} />
            </div>
            {vista.advertencias.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <div className="font-medium">Revisa estos puntos en el constructor después de importar</div>
                <ul className="mt-1 list-disc pl-5">
                  {vista.advertencias.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
            {vista.ya_existe && (
              <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <input type="checkbox" className="h-5 w-5 accent-emerald-700" checked={reemplazar} onChange={(e) => setReemplazar(e.target.checked)} />
                Ya existe una plantilla {vista.codigo}: reemplazar si ya existe
              </label>
            )}
          </div>
        )}

        <MensajeError error={accion.error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton type="button" variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          {vista ? (
            <Boton type="button" ocupado={accion.ocupado} disabled={vista.ya_existe && !reemplazar} icono={<Save className="h-4 w-4" />} onClick={crear}>
              Crear plantilla
            </Boton>
          ) : (
            <Boton type="submit" ocupado={accion.ocupado} disabled={!archivo} icono={<Eye className="h-4 w-4" />}>
              Ver vista previa
            </Boton>
          )}
        </div>
      </form>
    </Modal>
  )
}

// ---------- Constructor ----------

interface ColumnaEdicion { clave: number; id?: string; etiqueta: string; tipo: TipoColumna }
interface ItemEdicion { clave: number; id?: string; texto: string; seccion: string }
interface CampoEdicion {
  clave: number
  id?: string
  etiqueta: string
  tipo: TipoCampo
  obligatorio: boolean
  columnas: ColumnaEdicion[]
  filasSugeridas: string
  items: ItemEdicion[]
  opciones: OpcionChecklist[]
  conObservacion: boolean
}
interface NotaEdicion { clave: number; texto: string }

let contadorClaves = 0
const nuevaClave = () => ++contadorClaves

const columnaVacia = (): ColumnaEdicion => ({ clave: nuevaClave(), etiqueta: '', tipo: 'texto' })
const itemVacio = (seccion = ''): ItemEdicion => ({ clave: nuevaClave(), texto: '', seccion })
const campoVacio = (): CampoEdicion => ({
  clave: nuevaClave(), etiqueta: '', tipo: 'texto', obligatorio: true, columnas: [], filasSugeridas: '',
  items: [], opciones: ['si', 'no'], conObservacion: true,
})

const TIPOS_COLUMNA: TipoColumna[] = ['texto', 'numero', 'fecha', 'si_no']

function moverEn<T>(lista: T[], indice: number, delta: number): T[] {
  const destino = indice + delta
  if (destino < 0 || destino >= lista.length) return lista
  const copia = [...lista]
  ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
  return copia
}

function ConstructorPlantilla({ plantilla, onCerrar, onGuardada }: {
  plantilla: Plantilla | null
  onCerrar: () => void
  onGuardada: (mensaje: string) => void
}) {
  const accion = useAccion()
  const formatoInicial = plantilla?.formato ?? {}
  const [codigo, setCodigo] = useState(plantilla?.codigo ?? '')
  const [version, setVersion] = useState(plantilla?.version ?? '01')
  const [nombre, setNombre] = useState(plantilla?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(plantilla?.descripcion ?? '')
  const [ambito, setAmbito] = useState<AmbitoPlantilla>(plantilla?.ambito ?? 'campo')
  const [activa, setActiva] = useState(plantilla?.activa ?? true)
  const [formato, setFormato] = useState({
    encargado: formatoInicial.encargado ?? '',
    frecuencia: formatoInicial.frecuencia ?? '',
    orientacion: (formatoInicial.orientacion ?? 'vertical') as Orientacion,
    creado_por: formatoInicial.creado_por ?? '',
    aprobado_por: formatoInicial.aprobado_por ?? '',
    fecha_revision: formatoInicial.fecha_revision ?? '',
    direccion: formatoInicial.direccion ?? '',
  })
  const [notas, setNotas] = useState<NotaEdicion[]>(() => (formatoInicial.notas ?? []).map((texto) => ({ clave: nuevaClave(), texto })))
  const [campos, setCampos] = useState<CampoEdicion[]>(() =>
    plantilla?.campos.length
      ? plantilla.campos.map((c) => ({
          clave: nuevaClave(),
          id: c.id,
          etiqueta: c.etiqueta,
          tipo: c.tipo,
          obligatorio: c.obligatorio,
          columnas: (c.columnas ?? []).map((col) => ({ clave: nuevaClave(), id: col.id, etiqueta: col.etiqueta, tipo: col.tipo })),
          filasSugeridas: c.filas_sugeridas ? String(c.filas_sugeridas) : '',
          items: (c.items ?? []).map((it) => ({ clave: nuevaClave(), id: it.id, texto: it.texto, seccion: it.seccion ?? '' })),
          opciones: c.opciones?.length ? c.opciones : ['si', 'no'],
          conObservacion: c.con_observacion ?? true,
        }))
      : [campoVacio()],
  )

  const cambiarFormato = (cambios: Partial<typeof formato>) => setFormato((f) => ({ ...f, ...cambios }))

  const cambiarCampo = (clave: number, cambios: Partial<CampoEdicion>) =>
    setCampos((lista) => lista.map((c) => (c.clave === clave ? { ...c, ...cambios } : c)))

  const cambiarTipo = (c: CampoEdicion, tipo: TipoCampo) =>
    cambiarCampo(c.clave, {
      tipo,
      columnas: tipo === 'tabla' && !c.columnas.length ? [columnaVacia()] : c.columnas,
      items: tipo === 'checklist' && !c.items.length ? [itemVacio()] : c.items,
    })

  const mover = (indice: number, delta: number) => setCampos((lista) => moverEn(lista, indice, delta))

  const cambiarColumna = (c: CampoEdicion, claveCol: number, cambios: Partial<ColumnaEdicion>) =>
    cambiarCampo(c.clave, { columnas: c.columnas.map((col) => (col.clave === claveCol ? { ...col, ...cambios } : col)) })

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (!campos.length) return accion.setError('Agregue al menos un campo')
    const tablaSinColumnas = campos.find((c) => c.tipo === 'tabla' && !c.columnas.length)
    if (tablaSinColumnas) return accion.setError(`La tabla "${tablaSinColumnas.etiqueta || 'sin nombre'}" necesita al menos una columna`)
    const checklistSinItems = campos.find((c) => c.tipo === 'checklist' && !c.items.some((it) => it.texto.trim()))
    if (checklistSinItems) return accion.setError(`El checklist "${checklistSinItems.etiqueta || 'sin nombre'}" necesita al menos un ítem`)
    const checklistSinOpciones = campos.find((c) => c.tipo === 'checklist' && !c.opciones.length)
    if (checklistSinOpciones) return accion.setError(`El checklist "${checklistSinOpciones.etiqueta || 'sin nombre'}" necesita al menos una opción`)
    const cuerpo = {
      codigo: codigo.trim() || null,
      version: version.trim() || '01',
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      ambito,
      activa,
      formato: {
        ...formatoInicial,
        encargado: formato.encargado.trim(),
        frecuencia: formato.frecuencia.trim(),
        orientacion: formato.orientacion,
        creado_por: formato.creado_por.trim(),
        aprobado_por: formato.aprobado_por.trim(),
        fecha_revision: formato.fecha_revision.trim(),
        direccion: formato.direccion.trim(),
        notas: notas.map((n) => n.texto.trim()).filter(Boolean),
      },
      campos: campos.map((c) => ({
        id: c.id,
        etiqueta: c.etiqueta.trim(),
        tipo: c.tipo,
        obligatorio: c.obligatorio,
        columnas: c.tipo === 'tabla' ? c.columnas.map((col) => ({ id: col.id, etiqueta: col.etiqueta.trim(), tipo: col.tipo })) : [],
        filas_sugeridas: c.tipo === 'tabla' && Number(c.filasSugeridas) > 0 ? Number(c.filasSugeridas) : null,
        ...(c.tipo === 'checklist'
          ? {
              items: c.items.filter((it) => it.texto.trim()).map((it) => ({ id: it.id, texto: it.texto.trim(), seccion: it.seccion.trim() })),
              opciones: c.opciones,
              con_observacion: c.conObservacion,
            }
          : {}),
      })),
    }
    const ok = await accion.ejecutar(() =>
      plantilla ? api.put(`/registros/plantillas/${plantilla.id}`, cuerpo) : api.post('/registros/plantillas', cuerpo),
    )
    if (ok) onGuardada(plantilla ? 'Plantilla actualizada' : 'Plantilla creada')
  }

  return (
    <Modal abierto titulo={plantilla ? 'Editar plantilla' : 'Nueva plantilla'} onCerrar={onCerrar} ancho="max-w-4xl">
      <form onSubmit={guardar} className="space-y-4">
        {plantilla && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Editar una plantilla no cambia los registros ya creados.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo etiqueta="Código" className="col-span-1">
            <input maxLength={40} placeholder="R-OC-CE-12 o PK-01" className={`${claseEntrada} font-mono uppercase`} value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())} />
          </Campo>
          <Campo etiqueta="Versión" className="col-span-1">
            <input maxLength={10} className={claseEntrada} value={version} onChange={(e) => setVersion(e.target.value)} />
          </Campo>
          <Campo etiqueta="Nombre" className="col-span-2">
            <input required minLength={2} maxLength={200} className={claseEntrada} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Campo>
          <Campo etiqueta="Encargado" className="col-span-2">
            <input className={claseEntrada} value={formato.encargado} onChange={(e) => cambiarFormato({ encargado: e.target.value })} />
          </Campo>
          <Campo etiqueta="Frecuencia" className="col-span-2">
            <input placeholder="Mensual, cada uso…" className={claseEntrada} value={formato.frecuencia} onChange={(e) => cambiarFormato({ frecuencia: e.target.value })} />
          </Campo>
          <Campo etiqueta="Ámbito" className="col-span-2">
            <Selector className={claseEntrada} value={ambito} onChange={(e) => setAmbito(e.target.value as AmbitoPlantilla)}>
              {(Object.keys(ETIQUETA_AMBITO) as AmbitoPlantilla[]).map((a) => (
                <option key={a} value={a}>{ETIQUETA_AMBITO[a]}</option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Orientación" className="col-span-2">
            <Selector className={claseEntrada} value={formato.orientacion} onChange={(e) => cambiarFormato({ orientacion: e.target.value as Orientacion })}>
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
            </Selector>
          </Campo>
          <Campo etiqueta="Descripción" className="col-span-2 sm:col-span-4">
            <textarea rows={2} className={claseEntrada} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </Campo>
          <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700 sm:col-span-4">
            <input type="checkbox" className="h-5 w-5 accent-emerald-700" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
            Activa (se puede usar para crear registros)
          </label>
        </div>

        <details className="rounded-lg border border-slate-200 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-slate-700">Pie del documento</summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo etiqueta="Creado por">
              <input className={claseEntrada} value={formato.creado_por} onChange={(e) => cambiarFormato({ creado_por: e.target.value })} />
            </Campo>
            <Campo etiqueta="Aprobado y autorizado por">
              <input className={claseEntrada} value={formato.aprobado_por} onChange={(e) => cambiarFormato({ aprobado_por: e.target.value })} />
            </Campo>
            <Campo etiqueta="Fecha de revisión">
              <input className={claseEntrada} value={formato.fecha_revision} onChange={(e) => cambiarFormato({ fecha_revision: e.target.value })} />
            </Campo>
            <Campo etiqueta="Dirección">
              <input className={claseEntrada} value={formato.direccion} onChange={(e) => cambiarFormato({ direccion: e.target.value })} />
            </Campo>
          </div>
        </details>

        <details className="rounded-lg border border-slate-200 p-3 text-sm" open={notas.length > 0}>
          <summary className="cursor-pointer font-medium text-slate-700">Notas ({notas.length})</summary>
          <div className="mt-3 space-y-2">
            {notas.map((n) => (
              <div key={n.clave} className="flex items-start gap-2">
                <textarea rows={1} className={`${claseEntrada} field-sizing-content min-h-10 flex-1 resize-y`} value={n.texto}
                  onChange={(e) => setNotas((l) => l.map((x) => (x.clave === n.clave ? { ...x, texto: e.target.value } : x)))} />
                <Boton type="button" variante="fantasma" aria-label="Quitar nota" icono={<Trash2 className="h-4 w-4 text-red-600" />}
                  onClick={() => setNotas((l) => l.filter((x) => x.clave !== n.clave))} />
              </div>
            ))}
            <Boton type="button" variante="secundario" icono={<Plus className="h-4 w-4" />}
              onClick={() => setNotas((l) => [...l, { clave: nuevaClave(), texto: '' }])}>
              Agregar nota
            </Boton>
          </div>
        </details>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Campos</h3>
          <div className="space-y-3">
            {campos.map((c, i) => (
              <div key={c.clave} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem]">
                  <Campo etiqueta={`Campo ${i + 1}`}>
                    <input
                      required
                      maxLength={200}
                      placeholder="Etiqueta del campo"
                      className={claseEntrada}
                      value={c.etiqueta}
                      onChange={(e) => cambiarCampo(c.clave, { etiqueta: e.target.value })}
                    />
                  </Campo>
                  <Campo etiqueta="Tipo">
                    <Selector className={claseEntrada} value={c.tipo} onChange={(e) => cambiarTipo(c, e.target.value as TipoCampo)}>
                      {(Object.keys(ETIQUETA_TIPO) as TipoCampo[]).map((t) => (
                        <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>
                      ))}
                    </Selector>
                  </Campo>
                </div>

                {c.tipo === 'tabla' && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-2 text-xs font-medium text-slate-600">Columnas de la tabla</div>
                    <div className="space-y-2">
                      {c.columnas.map((col) => (
                        <div key={col.clave} className="flex flex-wrap items-center gap-2">
                          <input
                            required
                            maxLength={120}
                            placeholder="Etiqueta de la columna"
                            className={`${claseEntrada} min-w-0 flex-1`}
                            value={col.etiqueta}
                            onChange={(e) => cambiarColumna(c, col.clave, { etiqueta: e.target.value })}
                          />
                          <Selector
                            className={`${claseEntrada} w-32`}
                            value={col.tipo}
                            onChange={(e) => cambiarColumna(c, col.clave, { tipo: e.target.value as TipoColumna })}
                          >
                            {TIPOS_COLUMNA.map((t) => <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>)}
                          </Selector>
                          <Boton
                            type="button"
                            variante="fantasma"
                            aria-label="Quitar columna"
                            icono={<Trash2 className="h-4 w-4" />}
                            onClick={() => cambiarCampo(c.clave, { columnas: c.columnas.filter((x) => x.clave !== col.clave) })}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap items-end gap-3">
                      <Boton
                        type="button"
                        variante="secundario"
                        icono={<Plus className="h-4 w-4" />}
                        onClick={() => cambiarCampo(c.clave, { columnas: [...c.columnas, columnaVacia()] })}
                      >
                        Agregar columna
                      </Boton>
                      <Campo etiqueta="Filas sugeridas (opcional)" className="w-44">
                        <input type="number" min={1} max={60} inputMode="numeric" className={claseEntrada} value={c.filasSugeridas}
                          onChange={(e) => cambiarCampo(c.clave, { filasSugeridas: e.target.value })} />
                      </Campo>
                    </div>
                  </div>
                )}

                {c.tipo === 'checklist' && <EditorChecklist campo={c} onCambio={(cambios) => cambiarCampo(c.clave, cambios)} />}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-emerald-700"
                      checked={c.obligatorio}
                      onChange={(e) => cambiarCampo(c.clave, { obligatorio: e.target.checked })}
                    />
                    Obligatorio
                  </label>
                  <div className="flex gap-1">
                    <Boton type="button" variante="secundario" aria-label="Subir" disabled={i === 0} icono={<ArrowUp className="h-4 w-4" />} onClick={() => mover(i, -1)} />
                    <Boton type="button" variante="secundario" aria-label="Bajar" disabled={i === campos.length - 1} icono={<ArrowDown className="h-4 w-4" />} onClick={() => mover(i, 1)} />
                    <Boton
                      type="button"
                      variante="secundario"
                      aria-label="Quitar campo"
                      icono={<Trash2 className="h-4 w-4 text-red-600" />}
                      onClick={() => setCampos((lista) => lista.filter((x) => x.clave !== c.clave))}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Boton type="button" variante="secundario" className="mt-3 w-full sm:w-auto" icono={<Plus className="h-4 w-4" />} onClick={() => setCampos((l) => [...l, campoVacio()])}>
            Agregar campo
          </Boton>
        </div>

        {campos.some((c) => c.etiqueta.trim()) && (
          <details className="rounded-lg border border-slate-200 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-slate-700">Vista previa</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
              {campos.filter((c) => c.etiqueta.trim()).map((c) => (
                <li key={c.clave}>
                  {c.etiqueta}
                  {c.obligatorio && <span className="text-red-600"> *</span>}{' '}
                  <span className="text-xs text-slate-500">
                    ({ETIQUETA_TIPO[c.tipo]}
                    {c.tipo === 'tabla' && c.columnas.length ? `: ${c.columnas.map((x) => x.etiqueta || '…').join(', ')}` : ''}
                    {c.tipo === 'checklist' ? `: ${c.items.filter((it) => it.texto.trim()).length} ítems` : ''})
                  </span>
                </li>
              ))}
            </ol>
          </details>
        )}

        <MensajeError error={accion.error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton type="button" variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" ocupado={accion.ocupado} icono={<Save className="h-4 w-4" />}>Guardar plantilla</Boton>
        </div>
      </form>
    </Modal>
  )
}

function EditorChecklist({ campo, onCambio }: { campo: CampoEdicion; onCambio: (cambios: Partial<CampoEdicion>) => void }) {
  const [pegando, setPegando] = useState(false)
  const [textoPegado, setTextoPegado] = useState('')
  const [seccionPegado, setSeccionPegado] = useState('')

  const cambiarItem = (clave: number, cambios: Partial<ItemEdicion>) =>
    onCambio({ items: campo.items.map((it) => (it.clave === clave ? { ...it, ...cambios } : it)) })

  const agregarPegados = () => {
    const nuevos = textoPegado.split('\n').map((l) => l.trim()).filter(Boolean)
      .map((texto) => ({ clave: nuevaClave(), texto, seccion: seccionPegado.trim() }))
    if (!nuevos.length) return
    onCambio({ items: [...campo.items.filter((it) => it.texto.trim() || it.id), ...nuevos] })
    setTextoPegado('')
    setPegando(false)
  }

  const alternarOpcion = (o: OpcionChecklist, marcada: boolean) =>
    onCambio({ opciones: OPCIONES_CHECKLIST.filter((x) => (x === o ? marcada : campo.opciones.includes(x))) })

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700">
        <span className="text-xs font-medium text-slate-600">Opciones de respuesta:</span>
        {OPCIONES_CHECKLIST.map((o) => (
          <label key={o} className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5 accent-emerald-700" checked={campo.opciones.includes(o)}
              onChange={(e) => alternarOpcion(o, e.target.checked)} />
            {ETIQUETA_OPCION[o]}
          </label>
        ))}
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-5 w-5 accent-emerald-700" checked={campo.conObservacion}
            onChange={(e) => onCambio({ conObservacion: e.target.checked })} />
          Con observación
        </label>
      </div>

      <div>
        <div className="mb-2 text-xs font-medium text-slate-600">Ítems del checklist ({campo.items.length})</div>
        <div className="space-y-2">
          {campo.items.map((it, i) => (
            <div key={it.clave} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 p-2 sm:flex-nowrap sm:border-0 sm:p-0">
              <span className="w-6 text-right text-xs tabular-nums text-slate-500">{i + 1}</span>
              <input maxLength={500} placeholder="Texto del ítem" className={`${claseEntrada} min-w-0 flex-1 basis-48`} value={it.texto}
                onChange={(e) => cambiarItem(it.clave, { texto: e.target.value })} />
              <input placeholder="Sección" className={`${claseEntrada} w-full sm:w-40`} value={it.seccion}
                onChange={(e) => cambiarItem(it.clave, { seccion: e.target.value })} />
              <div className="flex gap-1">
                <Boton type="button" variante="fantasma" aria-label="Subir ítem" disabled={i === 0} icono={<ArrowUp className="h-4 w-4" />}
                  onClick={() => onCambio({ items: moverEn(campo.items, i, -1) })} />
                <Boton type="button" variante="fantasma" aria-label="Bajar ítem" disabled={i === campo.items.length - 1} icono={<ArrowDown className="h-4 w-4" />}
                  onClick={() => onCambio({ items: moverEn(campo.items, i, 1) })} />
                <Boton type="button" variante="fantasma" aria-label="Quitar ítem" icono={<Trash2 className="h-4 w-4 text-red-600" />}
                  onClick={() => onCambio({ items: campo.items.filter((x) => x.clave !== it.clave) })} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Boton type="button" variante="secundario" icono={<Plus className="h-4 w-4" />}
            onClick={() => onCambio({ items: [...campo.items, itemVacio(campo.items.at(-1)?.seccion ?? '')] })}>
            Agregar ítem
          </Boton>
          <Boton type="button" variante="secundario" icono={<ClipboardList className="h-4 w-4" />} onClick={() => setPegando((v) => !v)}>
            Pegar varios ítems
          </Boton>
        </div>
      </div>

      {pegando && (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <Campo etiqueta="Ítems (uno por línea)">
            <textarea rows={5} className={claseEntrada} value={textoPegado} onChange={(e) => setTextoPegado(e.target.value)} />
          </Campo>
          <Campo etiqueta="Sección de estos ítems (opcional)">
            <input className={claseEntrada} value={seccionPegado} onChange={(e) => setSeccionPegado(e.target.value)} />
          </Campo>
          <div className="flex flex-wrap gap-2">
            <Boton type="button" icono={<Plus className="h-4 w-4" />} disabled={!textoPegado.trim()} onClick={agregarPegados}>
              Agregar {textoPegado.split('\n').filter((l) => l.trim()).length || ''} ítems
            </Boton>
            <Boton type="button" variante="fantasma" onClick={() => setPegando(false)}>Cancelar</Boton>
          </div>
        </div>
      )}
    </div>
  )
}
