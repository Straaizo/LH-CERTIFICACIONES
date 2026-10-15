import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileUp,
  FlagTriangleRight,
  Loader2,
  Paperclip,
  Send,
  Undo2,
  XCircle,
} from 'lucide-react'
import { abrirUrlFirmada, api, subirArchivo } from '../api'
import {
  BloquePlazo,
  ETIQUETA_PLAN,
  Esqueleto,
  InsigniaReincidente,
  PORQUES,
  TONO_ESTADO_NC,
  TONO_PLAN,
  estadoPlan,
} from '../componentes/nc'
import { Boton, Insignia, MensajeError, TextoConEnlaces, claseEntrada, useAviso } from '../componentes/ui'
import { useSesionActiva } from '../contexto/Sesion'
import { ETIQUETA_ESTADO_NC, fecha, fechaYHora } from '../formato'
import { useAccion, useDatos } from '../hooks'
import type { AccionCorrectiva, NoConformidad } from '../tipos'

const claseTarjeta = 'rounded-xl border border-slate-200 bg-white shadow-sm'
const claseTituloSeccion = 'text-sm font-semibold text-slate-900'

function listaAcciones(nc: NoConformidad): AccionCorrectiva[] {
  return Array.isArray(nc.acciones) ? nc.acciones : []
}

function porquesCompletos(causa: string[]): number {
  return Array.from({ length: PORQUES }, (_, i) => causa[i] ?? '').filter((p) => p.trim()).length
}

export function NoConformidadDetalle() {
  const { id } = useParams()
  const { datos: nc, cargando, error, recargar, setDatos } = useDatos<NoConformidad>(`/no-conformidades/${id}`)
  const { datos: codigos } = useDatos<Record<string, number>>('/documentos/codigos')
  const { esCertificaciones, puedeEscribir } = useSesionActiva()
  const { avisar, nodo } = useAviso()

  if (cargando && !nc) return <EsqueletoDetalle />
  if (!nc) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Volver />
        <div className={`${claseTarjeta} mt-4 p-6 text-center`}>
          <CircleAlert className="mx-auto h-8 w-8 text-red-500" aria-hidden />
          <h1 className="mt-2 text-base font-semibold text-slate-900">No se pudo abrir la no conformidad</h1>
          <MensajeError error={error} onReintentar={recargar} />
        </div>
      </div>
    )
  }

  const cerrada = nc.estado === 'cerrada'
  const editable = puedeEscribir && !cerrada && (!nc.plan.enviado_en || esCertificaciones)
  const actualizar = (nueva: NoConformidad, mensaje: string) => {
    setDatos(nueva)
    avisar(mensaje)
  }

  return (
    <div className={editable ? 'pb-36 lg:pb-0' : ''}>
      <Encabezado nc={nc} />
      <Stepper nc={nc} />

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:order-2 lg:max-h-[calc(100dvh-72px-3rem)] lg:overflow-y-auto">
          <PanelEstado nc={nc} />
          {esCertificaciones && !cerrada && (
            <PanelRevision nc={nc} onRevisada={(nueva, cumple) => actualizar(nueva, cumple ? 'No conformidad cerrada' : 'Devuelta al jefe de área')} />
          )}
        </aside>

        <div className="min-w-0 space-y-5 lg:order-1 lg:col-span-2">
          <TarjetaHallazgo nc={nc} codigos={codigos ?? {}} />
          <FormularioPlan
            key={nc.id}
            nc={nc}
            editable={editable}
            puedeSubir={puedeEscribir && !cerrada}
            onGuardado={(nueva, enviado) => actualizar(nueva, enviado ? 'Plan enviado a certificaciones' : 'Borrador guardado')}
            onEvidencia={(nueva) => actualizar(nueva, 'Evidencia subida')}
          />
        </div>
      </div>
      {nodo}
    </div>
  )
}

function Volver() {
  return (
    <Link
      to="/no-conformidades"
      className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 sm:min-h-9"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden /> No conformidades
    </Link>
  )
}

function EsqueletoDetalle() {
  return (
    <div aria-busy="true" aria-label="Cargando no conformidad">
      <Esqueleto className="h-5 w-36" />
      <Esqueleto className="mt-4 h-7 w-64" />
      <Esqueleto className="mt-2 h-4 w-96 max-w-full" />
      <Esqueleto className="mt-5 h-12 w-full" />
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Esqueleto className="h-40 w-full rounded-xl" />
          <Esqueleto className="h-80 w-full rounded-xl" />
        </div>
        <Esqueleto className="h-64 w-full rounded-xl" />
      </div>
    </div>
  )
}

// ---------- Encabezado y flujo ----------

function Encabezado({ nc }: { nc: NoConformidad }) {
  return (
    <header>
      <Volver />
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            No conformidad #{nc.id} · {nc.protocolo.codigo}
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">
            <span className="font-mono">{nc.requisito.codigo}</span>
            {nc.clausula_titulo && <span className="font-normal text-slate-500"> · {nc.clausula_titulo}</span>}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            <Link to={`/auditorias/${nc.auditoria.id}`} className="-my-1 inline-flex min-h-9 items-center font-medium text-emerald-800 hover:underline">
              {nc.auditoria.titulo}
            </Link>
            <span className="text-slate-500"> · </span>
            {nc.unidad.nombre}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Insignia tono={TONO_ESTADO_NC[nc.estado]}>{ETIQUETA_ESTADO_NC[nc.estado]}</Insignia>
            {nc.estado !== 'cerrada' && nc.auditoria.emitida_en && (
              <Insignia tono={TONO_PLAN[estadoPlan(nc)]}>{ETIQUETA_PLAN[estadoPlan(nc)]}</Insignia>
            )}
            <InsigniaReincidente nc={nc} />
          </div>
        </div>
        <div className="shrink-0 sm:min-w-44 sm:text-right">
          <BloquePlazo nc={nc} />
        </div>
      </div>
    </header>
  )
}

type EstadoPaso = 'hecho' | 'actual' | 'pendiente' | 'alerta'

function pasos(nc: NoConformidad): { titulo: string; quien?: string; estado: EstadoPaso; nota?: string }[] {
  const cerrada = nc.estado === 'cerrada'
  const enviado = !!nc.plan.enviado_en
  const conEvidencia = listaAcciones(nc).some((a) => a.tiene_evidencia)
  const planCompleto =
    porquesCompletos(nc.plan.causa_raiz) === PORQUES && !!nc.plan.accion_correctiva && !!nc.plan.accion_preventiva
  const devuelta = estadoPlan(nc) === 'devuelta'

  let analisis: EstadoPaso = planCompleto || enviado || cerrada ? 'hecho' : 'pendiente'
  let evidencia: EstadoPaso = conEvidencia || cerrada ? 'hecho' : 'pendiente'
  let revision: EstadoPaso = cerrada ? 'hecho' : enviado ? 'actual' : 'pendiente'
  if (!cerrada && !enviado) {
    if (analisis !== 'hecho') analisis = 'actual'
    else if (evidencia !== 'hecho') evidencia = 'actual'
    else revision = 'actual'
  }
  if (enviado && !conEvidencia && !cerrada) evidencia = 'alerta'
  if (devuelta && revision === 'pendiente') revision = 'alerta'
  return [
    { titulo: 'Hallazgo', estado: 'hecho', nota: fecha(nc.fecha_deteccion) },
    { titulo: 'Análisis y acciones', quien: 'Jefe de área', estado: analisis },
    { titulo: 'Evidencia', quien: 'Jefe de área', estado: evidencia, nota: evidencia === 'alerta' ? 'Falta' : undefined },
    {
      titulo: 'Revisión',
      quien: 'Certificaciones',
      estado: revision,
      nota: devuelta ? `Devuelta ×${nc.reincidencias}` : !enviado && revision === 'actual' ? 'Falta enviar' : undefined,
    },
    { titulo: 'Cerrada', estado: cerrada ? 'hecho' : 'pendiente', nota: nc.cerrada_en ? fecha(nc.cerrada_en) : undefined },
  ]
}

const CIRCULO: Record<EstadoPaso, string> = {
  hecho: 'bg-emerald-700 text-white',
  actual: 'bg-white text-emerald-800 ring-2 ring-emerald-700',
  pendiente: 'bg-white text-slate-500 ring-1 ring-slate-300',
  alerta: 'bg-red-50 text-red-700 ring-2 ring-red-500',
}

function Stepper({ nc }: { nc: NoConformidad }) {
  const lista = pasos(nc)
  const indiceActual = Math.max(
    lista.findIndex((p) => p.estado === 'actual'),
    nc.estado === 'cerrada' ? lista.length - 1 : 0,
  )
  const actual = lista[indiceActual]
  return (
    <nav aria-label="Avance de la no conformidad" className={`${claseTarjeta} mt-5 px-4 py-3`}>
      <ol className="flex items-start">
        {lista.map((p, i) => (
          <li
            key={p.titulo}
            aria-current={i === indiceActual ? 'step' : undefined}
            className="relative flex flex-1 flex-col items-center text-center"
          >
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2 ${lista[i - 1].estado === 'hecho' ? 'bg-emerald-600' : 'bg-slate-200'}`}
              />
            )}
            <span
              className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${CIRCULO[p.estado]}`}
            >
              {p.estado === 'hecho' ? <Check className="h-4 w-4" aria-hidden /> : p.estado === 'alerta' ? '!' : i + 1}
            </span>
            <span className="sr-only">
              Paso {i + 1}: {p.titulo}, {p.estado === 'hecho' ? 'completo' : p.estado === 'actual' ? 'en curso' : p.estado === 'alerta' ? 'requiere atención' : 'pendiente'}
            </span>
            <span aria-hidden className={`mt-1.5 hidden text-xs font-medium sm:block ${p.estado === 'pendiente' ? 'text-slate-500' : 'text-slate-900'}`}>
              {p.titulo}
            </span>
            <span aria-hidden className={`hidden text-[11px] sm:block ${p.estado === 'alerta' ? 'font-semibold text-red-700' : 'text-slate-500'}`}>
              {p.nota ?? p.quien ?? ''}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-center text-xs text-slate-600 sm:hidden" aria-hidden>
        Paso {indiceActual + 1} de {lista.length}: <span className="font-semibold text-slate-900">{actual.titulo}</span>
        {actual.nota || actual.quien ? ` · ${actual.nota ?? actual.quien}` : ''}
      </p>
    </nav>
  )
}

// ---------- Hallazgo ----------

function TarjetaHallazgo({ nc, codigos }: { nc: NoConformidad; codigos: Record<string, number> }) {
  return (
    <section aria-labelledby="titulo-hallazgo" className={claseTarjeta}>
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <FlagTriangleRight className="h-4 w-4 text-red-600" aria-hidden />
        <h2 id="titulo-hallazgo" className={claseTituloSeccion}>No conformidad</h2>
        <span className="ml-auto text-xs text-slate-500">Detectada el {fecha(nc.fecha_deteccion)}</span>
      </header>
      <dl className="space-y-4 p-4 text-sm">
        <div>
          <dt className="text-xs font-medium text-slate-500">Cláusula</dt>
          <dd className="mt-0.5 text-slate-800">
            <span className="font-semibold">{nc.clausula}</span>
            {nc.clausula_titulo ? ` ${nc.clausula_titulo}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Pregunta</dt>
          <dd className="mt-0.5 whitespace-pre-line text-slate-800">
            <span className="font-mono font-semibold">{nc.requisito.codigo}</span> {nc.requisito.texto ?? ''}
          </dd>
        </div>
        <div className="rounded-lg border-l-4 border-red-400 bg-red-50/60 px-3 py-2">
          <dt className="text-xs font-medium text-red-800">Comentario del auditor</dt>
          <dd className="mt-0.5 whitespace-pre-line text-slate-900">
            {nc.descripcion ? <TextoConEnlaces texto={nc.descripcion} codigos={codigos} /> : <span className="text-slate-500">Sin comentario</span>}
          </dd>
        </div>
      </dl>
    </section>
  )
}

// ---------- Estado e historial ----------

type Evento = { fecha: string; titulo: string; por?: string | null; detalle?: string | null; tono: 'neutro' | 'verde' | 'rojo'; icono: ReactNode }

function eventos(nc: NoConformidad): Evento[] {
  const lista: Evento[] = [
    { fecha: nc.fecha_deteccion, titulo: 'No conformidad detectada', detalle: nc.auditoria.titulo, tono: 'neutro', icono: <FlagTriangleRight className="h-3.5 w-3.5" /> },
  ]
  if (nc.auditoria.emitida_en)
    lista.push({
      fecha: nc.auditoria.emitida_en,
      titulo: 'Informe emitido',
      detalle: nc.plazo ? `Plazo hasta el ${fecha(nc.plazo)}` : null,
      tono: 'neutro',
      icono: <FileText className="h-3.5 w-3.5" />,
    })
  if (nc.plan.enviado_en)
    lista.push({ fecha: nc.plan.enviado_en, titulo: 'Plan enviado a certificaciones', por: nc.plan.por, tono: 'neutro', icono: <Send className="h-3.5 w-3.5" /> })
  else if (nc.plan.en)
    lista.push({ fecha: nc.plan.en, titulo: 'Borrador guardado', por: nc.plan.por, tono: 'neutro', icono: <Clock className="h-3.5 w-3.5" /> })
  listaAcciones(nc)
    .filter((a) => a.tiene_evidencia)
    .forEach((a) =>
      lista.push({ fecha: a.creada_en, titulo: 'Evidencia subida', por: a.creada_por, detalle: a.nombre_archivo, tono: 'neutro', icono: <Paperclip className="h-3.5 w-3.5" /> }),
    )
  ;(nc.revisiones ?? []).forEach((r) =>
    lista.push({
      fecha: r.fecha,
      titulo: r.resultado === 'cumple' ? 'Conforme: cerrada' : 'No conforme: devuelta',
      por: r.por,
      detalle: r.observacion,
      tono: r.resultado === 'cumple' ? 'verde' : 'rojo',
      icono: r.resultado === 'cumple' ? <Check className="h-3.5 w-3.5" /> : <Undo2 className="h-3.5 w-3.5" />,
    }),
  )
  if (nc.cerrada_en && !(nc.revisiones ?? []).some((r) => r.resultado === 'cumple'))
    lista.push({ fecha: nc.cerrada_en, titulo: 'Cerrada', tono: 'verde', icono: <CheckCircle2 className="h-3.5 w-3.5" /> })
  return lista.sort((a, b) => b.fecha.slice(0, 16).localeCompare(a.fecha.slice(0, 16)))
}

const PUNTO_EVENTO = {
  neutro: 'bg-slate-100 text-slate-600 ring-slate-200',
  verde: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  rojo: 'bg-red-100 text-red-700 ring-red-200',
}

function PanelEstado({ nc }: { nc: NoConformidad }) {
  const [abierto, setAbierto] = useState(false)
  const idContenido = useId()
  const lista = eventos(nc)
  const ultima = nc.ultima_revision
  const devoluciones = nc.reincidencias > 0 && (
    <span className="text-xs font-semibold text-red-700">
      {nc.reincidencias} {nc.reincidencias === 1 ? 'devolución' : 'devoluciones'}
    </span>
  )
  return (
    <section aria-label="Estado y revisiones" className={claseTarjeta}>
      <header className="hidden items-center justify-between gap-2 px-4 py-3 lg:flex">
        <h2 className={claseTituloSeccion}>Estado y revisiones</h2>
        {devoluciones}
      </header>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls={idContenido}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-emerald-600 lg:hidden"
      >
        <span className="min-w-0 flex-1">
          <span className={`block ${claseTituloSeccion}`}>Estado y revisiones</span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {ultima
              ? `Última revisión: ${ultima.resultado === 'cumple' ? 'Conforme' : 'No conforme'} · ${fechaYHora(ultima.fecha)}`
              : `Sin revisiones · ${lista.length} ${lista.length === 1 ? 'evento' : 'eventos'}`}
          </span>
        </span>
        {devoluciones}
        <ChevronDown className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <div id={idContenido} className={`border-t border-slate-100 px-4 py-3 ${abierto ? '' : 'hidden'} lg:block`}>
        <ol className="relative space-y-4">
          {lista.map((e, i) => (
            <li key={i} className="relative flex gap-3">
              {i < lista.length - 1 && <span aria-hidden className="absolute left-3 top-7 -bottom-4 w-px bg-slate-200" />}
              <span aria-hidden className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${PUNTO_EVENTO[e.tono]}`}>
                {e.icono}
              </span>
              <div className="min-w-0 flex-1 pb-0.5">
                <p className={`text-sm font-medium ${e.tono === 'rojo' ? 'text-red-800' : e.tono === 'verde' ? 'text-emerald-800' : 'text-slate-800'}`}>
                  {e.titulo}
                </p>
                <p className="text-xs text-slate-500">
                  {e.fecha.length > 10 ? fechaYHora(e.fecha) : fecha(e.fecha)}
                  {e.por ? ` · ${e.por}` : ''}
                </p>
                {e.detalle && (
                  <p
                    className={`mt-1 whitespace-pre-line break-words text-xs ${
                      e.tono === 'rojo' ? 'rounded-md bg-red-50 px-2 py-1.5 text-red-900' : 'text-slate-600'
                    }`}
                  >
                    {e.detalle}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ---------- Revisión de certificaciones ----------

function ItemChecklist({ ok, advertencia, children }: { ok: boolean; advertencia?: boolean; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-label="Completo" />
      ) : advertencia ? (
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-label="Falta" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-red-600" aria-label="Falta" />
      )}
      <span className={ok ? 'text-slate-800' : 'text-slate-600'}>{children}</span>
    </li>
  )
}

function PanelRevision({ nc, onRevisada }: { nc: NoConformidad; onRevisada: (nc: NoConformidad, cumple: boolean) => void }) {
  const [observacion, setObservacion] = useState('')
  const [decision, setDecision] = useState<boolean | null>(null)
  const revision = useAccion()
  const idAyuda = useId()
  const enviado = !!nc.plan.enviado_en
  const evidencias = listaAcciones(nc).filter((a) => a.tiene_evidencia).length
  const porques = porquesCompletos(nc.plan.causa_raiz)

  const revisar = async (cumple: boolean) => {
    setDecision(cumple)
    let nueva: NoConformidad | null = null
    const ok = await revision.ejecutar(async () => {
      nueva = await api.post<NoConformidad>(`/no-conformidades/${nc.id}/revision`, {
        cumple,
        observacion: observacion.trim() || null,
      })
    })
    if (ok && nueva) {
      setObservacion('')
      onRevisada(nueva, cumple)
    }
  }

  return (
    <section aria-labelledby={`${idAyuda}-titulo`} className={`${claseTarjeta} ${enviado ? 'border-emerald-300 ring-1 ring-emerald-200' : ''}`}>
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 id={`${idAyuda}-titulo`} className={claseTituloSeccion}>Revisión de certificaciones</h2>
        {enviado && <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-semibold text-white">Por revisar</span>}
      </header>
      <div className="space-y-4 p-4">
        {!enviado && (
          <div className="flex gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <p>Esperando que el jefe de área envíe su plan. Avance hasta ahora:</p>
          </div>
        )}
        <ul className="space-y-1.5" aria-label="Lo recibido">
          <ItemChecklist ok={porques === PORQUES}>5 porqués ({porques}/{PORQUES})</ItemChecklist>
          <ItemChecklist ok={!!nc.plan.accion_correctiva}>Acción correctiva</ItemChecklist>
          <ItemChecklist ok={!!nc.plan.accion_preventiva}>Acción preventiva</ItemChecklist>
          <ItemChecklist ok={evidencias > 0} advertencia>
            {evidencias ? `Evidencia (${evidencias})` : 'Sin evidencia'}
          </ItemChecklist>
        </ul>
        {enviado && (
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Observación</span>
              <textarea
                rows={3}
                className={claseEntrada}
                value={observacion}
                aria-describedby={idAyuda}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Qué debe corregir el jefe de área, o un comentario de cierre"
              />
              <span id={idAyuda} className="mt-1 block text-xs text-slate-500">
                Obligatoria para devolver: el jefe de área la verá arriba del formulario.
              </span>
            </label>
            <div className="grid gap-2">
              <Boton
                icono={<Check className="h-4 w-4" />}
                ocupado={revision.ocupado && decision === true}
                disabled={!evidencias || revision.ocupado}
                aria-describedby={!evidencias ? `${idAyuda}-sinevidencia` : undefined}
                onClick={() => void revisar(true)}
                className="min-h-11 w-full"
              >
                Conforme: cerrar
              </Boton>
              {!evidencias && (
                <p id={`${idAyuda}-sinevidencia`} className="-mt-1 text-xs text-amber-800">
                  Para cerrar se necesita evidencia (foto o documento).
                </p>
              )}
              <Boton
                variante="secundario"
                icono={<Undo2 className="h-4 w-4" />}
                ocupado={revision.ocupado && decision === false}
                disabled={!observacion.trim() || revision.ocupado}
                onClick={() => void revisar(false)}
                className="min-h-11 w-full border-red-300 text-red-700 hover:bg-red-50"
              >
                No conforme: devolver
              </Boton>
            </div>
            <MensajeError error={revision.error} />
          </>
        )}
      </div>
    </section>
  )
}

// ---------- Formulario del jefe de área ----------

function EncabezadoSeccion({ numero, titulo, extra, id }: { numero: number; titulo: string; extra?: ReactNode; id: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-xs font-semibold text-white">
        {numero}
      </span>
      <h3 id={id} className={claseTituloSeccion}>{titulo}</h3>
      {extra && <div className="ml-auto">{extra}</div>}
    </div>
  )
}

function FormularioPlan({ nc, editable, puedeSubir, onGuardado, onEvidencia }: {
  nc: NoConformidad
  editable: boolean
  puedeSubir: boolean
  onGuardado: (nc: NoConformidad, enviado: boolean) => void
  onEvidencia: (nc: NoConformidad) => void
}) {
  const [porques, setPorques] = useState<string[]>(() => Array.from({ length: PORQUES }, (_, i) => nc.plan.causa_raiz[i] ?? ''))
  const [correctiva, setCorrectiva] = useState(nc.plan.accion_correctiva ?? '')
  const [preventiva, setPreventiva] = useState(nc.plan.accion_preventiva ?? '')
  const [intento, setIntento] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const { ocupado, error, ejecutar } = useAccion()
  const raiz = useRef<HTMLDivElement>(null)

  const evidencias = listaAcciones(nc).filter((a) => a.tiene_evidencia)
  const completos = porques.filter((p) => p.trim()).length
  const faltaPorque = porques.map((p) => !p.trim())
  const faltaCorrectiva = !correctiva.trim()
  const faltaPreventiva = !preventiva.trim()
  const faltantes = [
    ...(completos < PORQUES ? [`${PORQUES - completos} ${PORQUES - completos === 1 ? 'porqué' : 'porqués'}`] : []),
    ...(faltaCorrectiva ? ['acción correctiva'] : []),
    ...(faltaPreventiva ? ['acción preventiva'] : []),
  ]
  const guardado = Array.from({ length: PORQUES }, (_, i) => (nc.plan.causa_raiz[i] ?? '').trim())
  const sinGuardar =
    porques.some((p, i) => p.trim() !== guardado[i]) ||
    correctiva.trim() !== (nc.plan.accion_correctiva ?? '') ||
    preventiva.trim() !== (nc.plan.accion_preventiva ?? '')
  const devuelta = estadoPlan(nc) === 'devuelta'
  const enviado = !!nc.plan.enviado_en

  const guardar = async (enviar: boolean) => {
    if (enviar && faltantes.length) {
      setIntento(true)
      raiz.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    setEnviando(enviar)
    const causa = porques.map((p) => p.trim())
    while (causa.length && !causa[causa.length - 1]) causa.pop()
    let nueva: NoConformidad | null = null
    const ok = await ejecutar(async () => {
      nueva = await api.put<NoConformidad>(`/no-conformidades/${nc.id}/plan`, {
        causa_raiz: causa,
        accion_correctiva: correctiva.trim() || null,
        accion_preventiva: preventiva.trim() || null,
        enviar,
      })
    })
    if (ok && nueva) {
      setIntento(false)
      onGuardado(nueva, enviar)
    }
  }

  const marcar = (falta: boolean) => (intento && falta ? 'border-red-400 ring-2 ring-red-500/20' : '')

  return (
    <div ref={raiz} className="space-y-5">
      {devuelta && (
        <div role="alert" className="flex gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <Undo2 className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold">Certificaciones devolvió esta no conformidad</p>
            <p className="text-xs text-red-800">
              {nc.ultima_revision?.por} · {fechaYHora(nc.ultima_revision?.fecha)}
            </p>
            {nc.ultima_revision?.observacion && (
              <blockquote className="mt-2 whitespace-pre-line border-l-2 border-red-300 pl-3">{nc.ultima_revision.observacion}</blockquote>
            )}
            <p className="mt-2 font-semibold">Corrige lo indicado y vuelve a enviar.</p>
          </div>
        </div>
      )}

      <section aria-labelledby="titulo-plan" className={claseTarjeta}>
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 id="titulo-plan" className={claseTituloSeccion}>Plan de acción</h2>
            <p className="text-xs text-slate-500">
              {enviado
                ? `Enviado el ${fechaYHora(nc.plan.enviado_en)}${nc.plan.por ? ` por ${nc.plan.por}` : ''}`
                : 'Lo completa el jefe de área y lo envía a certificaciones.'}
            </p>
          </div>
          {enviado && !editable && <Insignia tono="verde">Plan enviado</Insignia>}
        </header>

        <div className="divide-y divide-slate-100">
          <div className="p-4">
            <EncabezadoSeccion
              numero={1}
              id="sec-porques"
              titulo="Análisis de causa raíz: 5 porqués"
              extra={
                <span className={`text-xs font-semibold tabular-nums ${completos === PORQUES ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {completos}/{PORQUES} completos
                </span>
              }
            />
            <p className="mb-3 text-xs text-slate-500">
              Parte del hallazgo y pregunta "¿por qué?" cinco veces; cada respuesta explica la anterior. El último es la causa raíz.
            </p>
            <ol className="relative">
              {porques.map((valor, i) => {
                const lleno = !!valor.trim()
                return (
                  <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
                    {i < PORQUES - 1 && (
                      <span aria-hidden className={`absolute bottom-0 left-3.5 top-8 w-0.5 ${lleno ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                    )}
                    <span
                      aria-hidden
                      className={`relative z-10 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        lleno
                          ? 'bg-emerald-700 text-white'
                          : intento
                            ? 'bg-red-50 text-red-700 ring-2 ring-red-400'
                            : 'bg-white text-slate-500 ring-1 ring-slate-300'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      {editable ? (
                        <label className="block">
                          <span className="sr-only">Porqué {i + 1}</span>
                          <textarea
                            rows={2}
                            className={`${claseEntrada} resize-y ${marcar(faltaPorque[i])}`}
                            aria-invalid={intento && faltaPorque[i]}
                            placeholder={i === 0 ? '¿Por qué ocurrió el hallazgo?' : `¿Por qué pasó lo del punto ${i}?`}
                            value={valor}
                            onChange={(e) => setPorques((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
                          />
                        </label>
                      ) : (
                        <p className={`whitespace-pre-line pt-1.5 text-sm ${lleno ? 'text-slate-800' : 'italic text-slate-500'}`}>
                          {lleno ? valor : 'Sin respuesta'}
                        </p>
                      )}
                      {i === PORQUES - 1 && <p className="mt-1 text-xs font-medium text-emerald-800">Causa raíz</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>

          <CampoAccion
            numero={2}
            titulo="Acción correctiva"
            ayuda="Qué se hará de inmediato para corregir el hallazgo."
            valor={correctiva}
            onCambio={setCorrectiva}
            editable={editable}
            invalido={intento && faltaCorrectiva}
          />
          <CampoAccion
            numero={3}
            titulo="Acción preventiva"
            ayuda="Qué se hará para que no vuelva a ocurrir (ataca la causa raíz)."
            valor={preventiva}
            onCambio={setPreventiva}
            editable={editable}
            invalido={intento && faltaPreventiva}
          />

          <div className="p-4">
            <EncabezadoSeccion
              numero={4}
              id="sec-evidencia"
              titulo="Evidencia"
              extra={
                <span className={`text-xs font-semibold ${evidencias.length ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {evidencias.length ? `${evidencias.length} ${evidencias.length === 1 ? 'archivo' : 'archivos'}` : 'Sin evidencia'}
                </span>
              }
            />
            <p className="mb-3 text-xs text-slate-500">Foto o documento que demuestre la corrección. Sin evidencia, certificaciones no puede cerrar.</p>
            <Evidencias ncId={nc.id} evidencias={evidencias} editable={puedeSubir} onAgregada={onEvidencia} />
          </div>
        </div>
      </section>

      {editable && (
        <div
          className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur lg:sticky lg:bottom-4 lg:rounded-xl lg:border lg:pb-3 lg:shadow-md"
          aria-label="Acciones del plan"
          role="region"
        >
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 text-xs" aria-live="polite">
              {intento && faltantes.length ? (
                <p className="font-medium text-red-700">
                  <CircleAlert className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
                  Para enviar falta: {faltantes.join(', ')}
                </p>
              ) : sinGuardar ? (
                <p className="font-medium text-amber-700">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                  Cambios sin guardar
                </p>
              ) : (
                <p className="text-slate-600">
                  {nc.plan.en ? `Guardado ${fechaYHora(nc.plan.en)}` : 'Aún sin guardar'}
                  {faltantes.length ? ` · falta: ${faltantes.join(', ')}` : ' · listo para enviar'}
                </p>
              )}
              {!evidencias.length && !enviado && (
                <p className="mt-0.5 text-amber-700">
                  <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
                  Sin evidencia: certificaciones no podrá cerrarla.
                </p>
              )}
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2 lg:flex">
              <Boton
                variante="secundario"
                ocupado={ocupado && !enviando}
                disabled={ocupado || !sinGuardar}
                onClick={() => void guardar(false)}
                className="min-h-11 lg:min-h-0"
              >
                {enviado ? 'Guardar cambios' : <span>Guardar<span className="hidden min-[400px]:inline">&nbsp;borrador</span></span>}
              </Boton>
              {!enviado && (
                <Boton
                  icono={<Send className="h-4 w-4" />}
                  ocupado={ocupado && enviando}
                  disabled={ocupado}
                  onClick={() => void guardar(true)}
                  className="min-h-11 lg:min-h-0"
                >
                  <span>Enviar<span className="hidden min-[400px]:inline">&nbsp;a certificaciones</span></span>
                </Boton>
              )}
            </div>
          </div>
          {error && (
            <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function CampoAccion({ numero, titulo, ayuda, valor, onCambio, editable, invalido }: {
  numero: number
  titulo: string
  ayuda: string
  valor: string
  onCambio: (v: string) => void
  editable: boolean
  invalido: boolean
}) {
  const id = useId()
  return (
    <div className="p-4">
      <EncabezadoSeccion numero={numero} id={`${id}-titulo`} titulo={titulo} />
      {editable ? (
        <>
          <textarea
            rows={3}
            aria-labelledby={`${id}-titulo`}
            aria-describedby={`${id}-ayuda`}
            aria-invalid={invalido}
            className={`${claseEntrada} resize-y ${invalido ? 'border-red-400 ring-2 ring-red-500/20' : ''}`}
            value={valor}
            onChange={(e) => onCambio(e.target.value)}
          />
          <p id={`${id}-ayuda`} className="mt-1 text-xs text-slate-500">{ayuda}</p>
        </>
      ) : (
        <p className={`whitespace-pre-line text-sm ${valor ? 'text-slate-800' : 'italic text-slate-500'}`}>{valor || 'Sin respuesta'}</p>
      )}
    </div>
  )
}

const EXT_IMAGEN = /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i
const EXT_PLANILLA = /\.(xlsx?|csv|ods)$/i

function IconoArchivo({ nombre }: { nombre: string | null }) {
  const clase = 'h-5 w-5'
  if (nombre && EXT_IMAGEN.test(nombre)) return <FileImage className={`${clase} text-sky-700`} aria-hidden />
  if (nombre && EXT_PLANILLA.test(nombre)) return <FileSpreadsheet className={`${clase} text-emerald-700`} aria-hidden />
  return <FileText className={`${clase} text-slate-600`} aria-hidden />
}

function Evidencias({ ncId, evidencias, editable, onAgregada }: {
  ncId: number
  evidencias: AccionCorrectiva[]
  editable: boolean
  onAgregada: (nc: NoConformidad) => void
}) {
  const subida = useAccion()
  const apertura = useAccion()
  const [abriendo, setAbriendo] = useState<number | null>(null)
  const [subiendo, setSubiendo] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const refArchivo = useRef<HTMLInputElement>(null)
  const refCamara = useRef<HTMLInputElement>(null)

  const subir = async (archivo: File | undefined) => {
    if (!archivo) return
    setSubiendo(archivo.name)
    let nueva: NoConformidad | null = null
    const ok = await subida.ejecutar(async () => {
      const subido = await subirArchivo(archivo, 'evidencias')
      nueva = await api.post<NoConformidad>(`/no-conformidades/${ncId}/acciones`, {
        archivo_key: subido.clave,
        nombre_archivo: subido.nombre,
      })
    })
    setSubiendo(null)
    if (refArchivo.current) refArchivo.current.value = ''
    if (refCamara.current) refCamara.current.value = ''
    if (ok && nueva) onAgregada(nueva)
  }

  const soltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setArrastrando(false)
    void subir(e.dataTransfer.files?.[0])
  }

  return (
    <div className="space-y-3">
      {!!evidencias.length && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {evidencias.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2">
              <IconoArchivo nombre={a.nombre_archivo} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{a.nombre_archivo ?? 'Evidencia'}</p>
                <p className="truncate text-xs text-slate-500">
                  {a.creada_por} · {fechaYHora(a.creada_en)}
                </p>
              </div>
              <Boton
                variante="secundario"
                ocupado={apertura.ocupado && abriendo === a.id}
                aria-label={`Ver ${a.nombre_archivo ?? 'evidencia'}`}
                className="min-h-11 shrink-0 lg:min-h-0"
                onClick={() => {
                  setAbriendo(a.id)
                  void apertura.ejecutar(() => abrirUrlFirmada(`/no-conformidades/acciones/${a.id}/evidencia`))
                }}
              >
                Ver
              </Boton>
            </li>
          ))}
        </ul>
      )}

      {editable ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setArrastrando(true)
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={soltar}
          className={`rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
            arrastrando ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50/60'
          }`}
        >
          {subiendo ? (
            <p className="flex items-center justify-center gap-2 text-sm text-slate-700" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Subiendo {subiendo}…
            </p>
          ) : (
            <>
              <FileUp className="mx-auto h-6 w-6 text-slate-500" aria-hidden />
              <p className="mt-1 text-sm text-slate-700">
                <span className="hidden lg:inline">Arrastra un archivo aquí o elige una opción</span>
                <span className="lg:hidden">Sube una foto o un documento</span>
              </p>
              <p className="text-xs text-slate-500">Imagen, PDF, Word o Excel. Se sube al elegirlo.</p>
              <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:justify-center">
                <Boton
                  type="button"
                  variante="secundario"
                  icono={<FileUp className="h-4 w-4" />}
                  onClick={() => refArchivo.current?.click()}
                  className="min-h-11 whitespace-nowrap px-3 lg:min-h-0"
                >
                  Elegir archivo
                </Boton>
                <Boton
                  type="button"
                  variante="secundario"
                  icono={<Camera className="h-4 w-4" />}
                  onClick={() => refCamara.current?.click()}
                  className="min-h-11 whitespace-nowrap px-3 lg:min-h-0"
                >
                  Tomar foto
                </Boton>
              </div>
            </>
          )}
          <input
            ref={refArchivo}
            type="file"
            accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={(e) => void subir(e.target.files?.[0])}
          />
          <input
            ref={refCamara}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void subir(e.target.files?.[0])}
          />
        </div>
      ) : (
        !evidencias.length && <p className="text-sm italic text-slate-500">No se subió evidencia.</p>
      )}
      <MensajeError error={subida.error ?? apertura.error} />
    </div>
  )
}
