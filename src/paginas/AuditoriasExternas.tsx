import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, Download, FileText, FileUp, History, MapPin,
  ShieldCheck, Upload, UserRound,
} from 'lucide-react'
import { abrirUrlFirmada, api, descargarArchivo } from '../api'
import { useAccion, useDatos } from '../hooks'
import { fecha, num } from '../formato'
import { useSesionActiva } from '../contexto/Sesion'
import { Boton, Cargando, EncabezadoPagina, Insignia, MensajeError, Tarjeta, Vacio, useAviso } from '../componentes/ui'
import { useConfirmarRepetido } from '../componentes/ConfirmarRepetido'
import type { UnidadRef } from '../tipos'

// ---------- Tipos de la API ----------

interface Puntaje { nivel: string; valor: number | null; despues_ac: number | null }
interface Preguntas { total?: number; si?: number; no?: number; na?: number }
interface Hallazgo {
  codigo: string
  texto: string
  comentario: string
  nivel: string | null
  respuesta_auditado: string | null
  respuesta_auditor: string | null
}

interface InformeExterno {
  id: string
  titulo: string
  tipo_informe: 'final' | 'no_conformidades' | 'acciones_correctivas'
  tipo_nombre: string
  protocolo: { id: string; codigo: string; nombre: string } | null
  empresa: string | null
  numero: string | null
  entidad: string | null
  auditor: string | null
  fecha: string | null
  sucursales: UnidadRef[]
  versiones_total: number
  version: { id: string; numero: number; nombre_archivo: string; subido_en: string } | null
  puntajes: Puntaje[]
  preguntas: Preguntas
  hallazgos_total: number
}

interface DetalleExterno extends InformeExterno {
  resumen: {
    productos: string | null
    certificado_desde: string | null
    certificado_hasta: string | null
    secciones: { codigo: string; titulo: string; si: number; no: number; na: number }[]
    hallazgos: Hallazgo[]
    advertencias: string[]
  }
  versiones: { id: string; numero: number; nombre_archivo: string; subido_en: string; subido_por: string | null }[]
}

interface ResultadoSubida {
  id: string
  titulo: string
  archivo: string
  nueva: boolean
  version: number
  tipo_nombre: string
  advertencias: string[]
  reemplazada?: boolean
}

const TONO_TIPO = { final: 'verde', no_conformidades: 'amarillo', acciones_correctivas: 'azul' } as const

function pct(v: number | null | undefined, decimales = 1) {
  return v === null || v === undefined ? '—' : `${num(Number(v.toFixed(decimales)))} %`
}

function Puntajes({ puntajes, compacto = false }: { puntajes: Puntaje[]; compacto?: boolean }) {
  if (!puntajes.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {puntajes.map((p) => (
        <span key={p.nivel} className={`inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-slate-700 ${compacto ? 'text-xs' : 'text-sm'}`}>
          <span className="text-slate-500">{p.nivel}</span>
          <span className="font-semibold tabular-nums">{pct(p.valor)}</span>
          {p.despues_ac !== null && p.despues_ac !== p.valor && (
            <span className="tabular-nums text-emerald-700" title="Después de las acciones correctivas">→ {pct(p.despues_ac)}</span>
          )}
        </span>
      ))}
    </div>
  )
}

// ---------- Lista ----------

export function AuditoriasExternas() {
  const { filtros, setFiltros } = useSesionActiva()
  const { datos, cargando, error, recargar } = useDatos<InformeExterno[]>('/auditorias-externas', { ...filtros })
  const entrada = useRef<HTMLInputElement>(null)
  const subida = useAccion()
  const repetido = useConfirmarRepetido()
  const [resultados, setResultados] = useState<ResultadoSubida[] | null>(null)

  const subir = (archivos: FileList | null) => {
    if (!archivos?.length) return
    const lista = Array.from(archivos)
    void subida.ejecutar(async () => {
      const r = await repetido.intentar((reemplazar) => {
        const datos = new FormData()
        lista.forEach((a) => datos.append('archivos', a))
        datos.append('reemplazar', String(reemplazar))
        return api.post<ResultadoSubida[]>('/auditorias-externas', datos)
      })
      if (!r) return
      setResultados(r)
      recargar()
    })
  }

  return (
    <div>
      <EncabezadoPagina
        titulo="Auditorías externas"
        descripcion="Informes de la certificadora como documento de consulta: súbelos y la aplicación arma el resumen. No generan no conformidades."
        acciones={
          <>
            <Boton icono={<Upload className="h-4 w-4" />} ocupado={subida.ocupado} onClick={() => entrada.current?.click()}>
              Subir informes
            </Boton>
            <input ref={entrada} type="file" accept="application/pdf,.pdf" multiple className="hidden"
              onChange={(e) => { subir(e.target.files); e.target.value = '' }} />
          </>
        }
      />
      <MensajeError error={subida.error ?? error} />
      {repetido.nodo}

      {resultados && (
        <Tarjeta titulo={`${resultados.length} ${resultados.length === 1 ? 'informe leído' : 'informes leídos'}`} className="mb-5">
          <ul className="divide-y divide-slate-100">
            {resultados.map((r) => (
              <li key={`${r.id}-${r.version}-${r.archivo}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <Link to={`/auditorias-externas/${r.id}`} className="font-medium text-slate-900 hover:underline">{r.titulo}</Link>
                <span className="text-slate-500">{r.tipo_nombre}</span>
                <Insignia tono={r.nueva ? 'verde' : r.reemplazada ? 'amarillo' : 'azul'}>
                  {r.nueva ? 'Nuevo' : r.reemplazada ? `Versión ${r.version} reemplazada` : `Versión ${r.version}`}
                </Insignia>
                {r.advertencias.map((a) => <span key={a} className="basis-full pl-7 text-amber-700">{a}</span>)}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setResultados(null)} className="mt-2 text-sm font-medium text-slate-500 hover:text-slate-800">
            Ocultar
          </button>
        </Tarjeta>
      )}

      {cargando ? <Cargando /> : !datos?.length ? (
        <Tarjeta>
          <Vacio>
            Aún no hay informes de auditorías externas{filtros.unidad_id || filtros.temporada_id ? ' con estos filtros' : ''}.
            <span className="mt-1 block">Sube los PDF de la certificadora (puedes elegir varios a la vez).</span>
            {filtros.temporada_id && (
              <button type="button" onClick={() => setFiltros({ ...filtros, temporada_id: undefined })}
                className="mt-3 min-h-10 font-medium text-emerald-700 hover:underline">
                Ver todas las temporadas
              </button>
            )}
          </Vacio>
        </Tarjeta>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {datos.map((a) => (
            <li key={a.id}>
              <Link to={`/auditorias-externas/${a.id}`}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-slate-200/80 bg-superficie p-4 shadow-[0_1px_2px_rgba(16,40,16,0.04)] transition-colors hover:border-emerald-300 active:bg-slate-50 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug text-slate-900">{a.titulo}</p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {[a.fecha && fecha(a.fecha), a.auditor, a.entidad].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Insignia tono={TONO_TIPO[a.tipo_informe] ?? 'gris'}>{a.tipo_nombre}</Insignia>
                  {a.hallazgos_total > 0
                    ? <Insignia tono="rojo">{a.hallazgos_total} {a.hallazgos_total === 1 ? 'hallazgo' : 'hallazgos'}</Insignia>
                    : <Insignia tono="verde">Sin hallazgos</Insignia>}
                  {a.versiones_total > 1 && <Insignia>{a.versiones_total} versiones</Insignia>}
                </div>
                <Puntajes puntajes={a.puntajes} compacto />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------- Detalle ----------

function Dato({ icono, etiqueta, children }: { icono: React.ReactNode; etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 text-slate-400">{icono}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{etiqueta}</p>
        <p className="text-sm text-slate-900">{children}</p>
      </div>
    </div>
  )
}

function BarraPreguntas({ p }: { p: Preguntas }) {
  const total = p.total || (p.si ?? 0) + (p.no ?? 0) + (p.na ?? 0)
  if (!total) return null
  const partes = [
    { clave: 'Sí', valor: p.si ?? 0, clase: 'bg-emerald-600' },
    { clave: 'No', valor: p.no ?? 0, clase: 'bg-red-600' },
    { clave: 'N/A', valor: p.na ?? 0, clase: 'bg-slate-300' },
  ]
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" role="img"
        aria-label={partes.map((x) => `${x.clave} ${x.valor}`).join(', ')}>
        {partes.map((x) => x.valor > 0 && <span key={x.clave} className={x.clase} style={{ width: `${(x.valor / total) * 100}%` }} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {partes.map((x) => (
          <span key={x.clave} className="flex items-center gap-1.5 text-slate-600">
            <span className={`h-2.5 w-2.5 rounded-full ${x.clase}`} />{x.clave} <strong className="tabular-nums text-slate-900">{x.valor}</strong>
          </span>
        ))}
        <span className="text-slate-500">de {total} preguntas</span>
      </div>
    </div>
  )
}

export function AuditoriaExternaDetalle() {
  const { id } = useParams()
  const { datos: d, cargando, error, recargar } = useDatos<DetalleExterno>(`/auditorias-externas/${id}`)
  const descarga = useAccion()
  const version = useAccion()
  const repetidoVersion = useConfirmarRepetido()
  const entrada = useRef<HTMLInputElement>(null)
  const [todasSecciones, setTodasSecciones] = useState(false)
  const { avisar, nodo: nodoAviso } = useAviso()

  if (cargando) return <Cargando variante="detalle" />
  if (error || !d) return <MensajeError error={error ?? 'No se encontró el informe'} />

  const r = d.resumen
  const secciones = todasSecciones ? r.secciones : r.secciones.filter((s) => s.no > 0)
  const subirVersion = (archivo: File | undefined) => {
    if (!archivo) return
    void version.ejecutar(async () => {
      let reemplazo = false
      const r = await repetidoVersion.intentar((reemplazar) => {
        reemplazo = reemplazar
        const datos = new FormData()
        datos.append('archivo', archivo)
        datos.append('reemplazar', String(reemplazar))
        return api.post(`/auditorias-externas/${d.id}/versiones`, datos)
      })
      if (!r) return
      recargar()
      avisar(reemplazo ? 'Versión reemplazada' : 'Versión nueva guardada')
    })
  }
  const nombreBase = `Resumen ${d.titulo}`

  return (
    <div className="space-y-5">
      {nodoAviso}
      {repetidoVersion.nodo}
      <Link to="/auditorias-externas" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Auditorías externas
      </Link>

      <div>
        <div className="mb-2 flex flex-wrap gap-2">
          <Insignia tono={TONO_TIPO[d.tipo_informe] ?? 'gris'}>{d.tipo_nombre}</Insignia>
          {d.version && <Insignia>Versión {d.version.numero}</Insignia>}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{d.titulo}</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {d.version && (
          <Boton variante="secundario" icono={<FileText className="h-4 w-4" />} ocupado={descarga.ocupado}
            onClick={() => void descarga.ejecutar(() => abrirUrlFirmada(`/auditorias-externas/versiones/${d.version!.id}/descarga`))}>
            Ver informe original
          </Boton>
        )}
        <Boton variante="secundario" icono={<Download className="h-4 w-4" />}
          onClick={() => void descarga.ejecutar(() => descargarArchivo(`/auditorias-externas/${d.id}/resumen.pdf`, undefined, `${nombreBase}.pdf`))}>
          Resumen PDF
        </Boton>
        <Boton variante="secundario" icono={<Download className="h-4 w-4" />}
          onClick={() => void descarga.ejecutar(() => descargarArchivo(`/auditorias-externas/${d.id}/resumen.docx`, undefined, `${nombreBase}.docx`))}>
          Resumen Word
        </Boton>
        <Boton variante="secundario" icono={<FileUp className="h-4 w-4" />} ocupado={version.ocupado} onClick={() => entrada.current?.click()}>
          Subir versión nueva
        </Boton>
        <input ref={entrada} type="file" accept="application/pdf,.pdf" className="hidden"
          onChange={(e) => { subirVersion(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      <MensajeError error={descarga.error ?? version.error} />

      {/* General */}
      <Tarjeta titulo="Resumen general">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Dato icono={<CalendarDays className="h-4 w-4" />} etiqueta="Fecha">{d.fecha ? fecha(d.fecha) : '—'}</Dato>
          <Dato icono={<MapPin className="h-4 w-4" />} etiqueta="Sucursales">{d.sucursales.map((s) => s.nombre).join(', ') || '—'}</Dato>
          <Dato icono={<UserRound className="h-4 w-4" />} etiqueta="Auditor">{[d.auditor, d.entidad].filter(Boolean).join(' · ') || '—'}</Dato>
          {d.numero && <Dato icono={<ShieldCheck className="h-4 w-4" />} etiqueta="ID de auditoría">{d.numero}</Dato>}
          {r.productos && <Dato icono={<FileText className="h-4 w-4" />} etiqueta="Productos">{r.productos}</Dato>}
          {r.certificado_hasta && (
            <Dato icono={<ShieldCheck className="h-4 w-4" />} etiqueta="Certificado vigente">
              {r.certificado_desde ? `${fecha(r.certificado_desde)} al ` : 'hasta '}{fecha(r.certificado_hasta)}
            </Dato>
          )}
        </div>
        {(d.puntajes.length > 0 || d.preguntas.total) && (
          <div className="mt-5 grid gap-5 border-t border-slate-100 pt-5 lg:grid-cols-2">
            {d.puntajes.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-800">Puntaje</p>
                <Puntajes puntajes={d.puntajes} />
              </div>
            )}
            {d.preguntas.total ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-800">Preguntas</p>
                <BarraPreguntas p={d.preguntas} />
              </div>
            ) : null}
          </div>
        )}
        {r.advertencias.length > 0 && (
          <p className="mt-4 flex items-start gap-2 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{r.advertencias.join(' ')}</p>
        )}
      </Tarjeta>

      {/* Específico */}
      <Tarjeta titulo={`Hallazgos (${r.hallazgos.length})`}>
        {!r.hallazgos.length ? (
          <p className="flex items-center gap-2 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" /> El informe no registra hallazgos.</p>
        ) : (
          <ul className="space-y-3">
            {r.hallazgos.map((h) => (
              <li key={h.codigo} className="rounded-xl border border-slate-200/80 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-900">{h.codigo}</span>
                  {h.nivel && <Insignia tono={h.nivel.includes('menor') ? 'amarillo' : 'rojo'}>{h.nivel}</Insignia>}
                  {h.respuesta_auditor && (
                    <Insignia tono={/acept/i.test(h.respuesta_auditor) ? 'verde' : 'rojo'}>Acción correctiva: {h.respuesta_auditor.toLowerCase()}</Insignia>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-800">{h.texto}</p>
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"><strong>Auditor:</strong> {h.comentario}</p>
                {h.respuesta_auditado && <p className="mt-2 text-sm text-slate-600"><strong>Respuesta:</strong> {h.respuesta_auditado}</p>}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {r.secciones.length > 0 && (
        <Tarjeta titulo="Por sección"
          acciones={<button type="button" onClick={() => setTodasSecciones((v) => !v)} className="min-h-10 text-sm font-medium text-emerald-700 hover:underline">
            {todasSecciones ? 'Solo con hallazgos' : `Ver las ${r.secciones.length}`}
          </button>}>
          {!secciones.length ? <p className="text-sm text-slate-500">Ninguna sección tiene hallazgos.</p> : (
            <ul className="divide-y divide-slate-100">
              {secciones.map((s) => (
                <li key={s.codigo} className="flex items-center gap-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate" title={s.titulo}><span className="font-mono font-semibold">{s.codigo}</span> {s.titulo}</span>
                  <span className="tabular-nums text-emerald-700">{s.si} sí</span>
                  <span className={`tabular-nums ${s.no ? 'font-semibold text-red-700' : 'text-slate-400'}`}>{s.no} no</span>
                  <span className="tabular-nums text-slate-400">{s.na} N/A</span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      )}

      <Tarjeta titulo="Versiones">
        <ul className="divide-y divide-slate-100">
          {d.versiones.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <History className="h-4 w-4 text-slate-400" />
              <span className="font-semibold">Versión {v.numero}</span>
              <span className="min-w-0 flex-1 truncate text-slate-600" title={v.nombre_archivo}>{v.nombre_archivo}</span>
              <span className="text-slate-500">{fecha(v.subido_en)}{v.subido_por ? ` · ${v.subido_por}` : ''}</span>
              <button type="button" className="min-h-10 font-medium text-emerald-700 hover:underline"
                onClick={() => void descarga.ejecutar(() => abrirUrlFirmada(`/auditorias-externas/versiones/${v.id}/descarga`))}>
                Ver
              </button>
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  )
}
