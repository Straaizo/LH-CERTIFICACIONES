import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Download, Eye, History, PenLine, Plus, RefreshCw, Save, Send, Trash2, X } from 'lucide-react'
import { abrirUrlFirmada, api, descargarArchivo, subirArchivo } from '../api'
import { useAccion, useDatos } from '../hooks'
import { fecha, fechaYHora, num } from '../formato'
import { useSesionActiva } from '../contexto/Sesion'
import { FirmaPad } from '../componentes/FirmaPad'
import {
  BarraPorcentaje, Boton, Campo, CampoArchivo, Cargando, ErrorPagina, Insignia, MensajeError, Tarjeta, claseEntrada, useAviso,
} from '../componentes/ui'
import {
  Codigo, ETIQUETA_OPCION, EstadoInsignia, FechaRevision, UltimoCambio, VERBO_ACCION, type CampoRegistro, type EventoRegistro, type ColumnaRegistro, type OpcionChecklist, type Registro,
  type RespuestaChecklist, type TipoColumna,
} from './Registros'

type Valores = Record<string, unknown>
type Fila = Record<string, unknown>
interface ValorArchivo { clave: string; nombre?: string; tipo?: string }
type ValorChecklist = Record<string, RespuestaChecklist>

const TIPOS_ARCHIVO = ['foto', 'archivo', 'firma']

function esArchivo(v: unknown): v is ValorArchivo {
  return !!v && typeof v === 'object' && !Array.isArray(v) && !!(v as ValorArchivo).clave
}

function vacio(v: unknown): boolean {
  return v === null || v === undefined || v === ''
}

function comoChecklist(v: unknown): ValorChecklist {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as ValorChecklist) : {}
}

function respondidos(campo: CampoRegistro, valor: unknown): number {
  const respuestas = comoChecklist(valor)
  return (campo.items ?? []).filter((it) => respuestas[it.id]?.r).length
}

/** Tablas vacías con filas sugeridas parten con una fila para llenar. */
function conFilasIniciales(campos: CampoRegistro[], valores: Valores): Valores {
  const copia = { ...valores }
  campos.forEach((c) => {
    if (c.tipo === 'tabla' && c.filas_sugeridas && !(Array.isArray(copia[c.id]) && (copia[c.id] as Fila[]).length)) copia[c.id] = [{}]
  })
  return copia
}

/** Misma regla que la API para saber si un campo está completo. */
function completo(campo: CampoRegistro, valor: unknown): boolean {
  if (campo.tipo === 'tabla') return Array.isArray(valor) && valor.some((f: Fila) => Object.values(f ?? {}).some((v) => !vacio(v)))
  if (TIPOS_ARCHIVO.includes(campo.tipo)) return esArchivo(valor)
  if (campo.tipo === 'si_no') return typeof valor === 'boolean'
  if (campo.tipo === 'checklist') return respondidos(campo, valor) === (campo.items ?? []).length
  return !vacio(valor)
}

function textoSimple(tipo: TipoColumna | 'texto', v: unknown): string {
  if (vacio(v)) return '—'
  if (tipo === 'si_no') return v === true ? 'Sí' : v === false ? 'No' : '—'
  if (tipo === 'fecha') return fecha(String(v))
  if (tipo === 'numero') return Number.isFinite(Number(v)) ? num(Number(v)) : String(v)
  return String(v)
}

export function RegistroDetalle() {
  const { id } = useParams()
  const { esCertificaciones, puedeEscribir, usuario } = useSesionActiva()
  const { datos: registro, cargando, error, recargar, setDatos } = useDatos<Registro>(`/registros/${id}`)
  const historial = useDatos<EventoRegistro[]>(`/registros/${id}/historial`)
  const accion = useAccion()
  const subida = useAccion()
  const { avisar, nodo } = useAviso()
  const [valores, setValores] = useState<Valores>({})
  const [cambios, setCambios] = useState(false)
  const [rechazando, setRechazando] = useState(false)
  const [observacion, setObservacion] = useState('')

  const campos = useMemo(() => registro?.campos ?? [], [registro])
  const estadosEditables = esCertificaciones ? ['borrador', 'rechazado', 'en_revision'] : ['borrador', 'rechazado']
  const editable = !!registro && puedeEscribir && estadosEditables.includes(registro.estado)
  const corrigiendo = editable && esCertificaciones && registro?.responsable?.id !== usuario.id

  useEffect(() => {
    if (registro) {
      setValores(editable ? conFilasIniciales(registro.campos ?? [], registro.valores ?? {}) : registro.valores ?? {})
      setCambios(false)
    }
  }, [registro, editable])

  const avanceLocal = useMemo(() => {
    const exigidos = campos.filter((c) => c.obligatorio).length ? campos.filter((c) => c.obligatorio) : campos
    const listos = exigidos.filter((c) => completo(c, valores[c.id])).length
    return exigidos.length ? Math.round((listos / exigidos.length) * 100) : 100
  }, [campos, valores])

  const cambiar = (campoId: string, valor: unknown) => {
    setValores((v) => ({ ...v, [campoId]: valor }))
    setCambios(true)
  }

  const guardar = async () => {
    const r = await api.put<Registro>(`/registros/${id}/valores`, valores)
    setDatos(r)
    void historial.recargar()
    return r
  }

  const guardarAvance = async () => {
    if (await accion.ejecutar(guardar)) avisar('Avance guardado')
  }

  const enviar = async () => {
    const ok = await accion.ejecutar(async () => {
      await guardar()
      setDatos(await api.post<Registro>(`/registros/${id}/enviar`))
      void historial.recargar()
    })
    if (ok) avisar('Registro enviado a revisión')
  }

  const revisar = async (aprobar: boolean) => {
    if (!aprobar && !observacion.trim()) return accion.setError('Escriba la observación del rechazo')
    const ok = await accion.ejecutar(async () => {
      setDatos(await api.post<Registro>(`/registros/${id}/revision`, { aprobar, observacion: observacion.trim() || null }))
      void historial.recargar()
    })
    if (ok) {
      setRechazando(false)
      setObservacion('')
      avisar(aprobar ? 'Registro aprobado' : 'Registro rechazado; vuelve al encargado')
    }
  }

  const exportar = (formato: 'pdf' | 'docx') =>
    accion.ejecutar(() => descargarArchivo(`/registros/${id}/exportar`, { formato }, `registro.${formato}`))

  const volver = (
    <Link to="/registros?seccion=registros" className="-ml-2 mb-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
      <ArrowLeft className="h-4 w-4" /> Volver a registros
    </Link>
  )

  if (cargando && !registro) return <Cargando variante="detalle" />
  if (!registro) return <ErrorPagina error={error ?? 'Registro no encontrado'} volverA="/registros?seccion=registros" volverTexto="Registros" onReintentar={recargar} />

  return (
    <div className={editable ? 'pb-28 md:pb-0' : ''}>
      {volver}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-500">
            <Codigo codigo={registro.codigo} className="text-sm" />
            {registro.codigo && registro.version && <span>Versión {registro.version}</span>}
            <span>{registro.plantilla.nombre}</span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{registro.titulo}</h1>
        </div>
        {registro.tiene_logo && <LogoPlantilla plantillaId={registro.plantilla.id} />}
      </div>

      <Tarjeta className="mb-4">
        <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">Encargado</dt>
            <dd className="font-medium text-slate-800">{registro.formato?.encargado || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Frecuencia</dt>
            <dd className="font-medium text-slate-800">{registro.formato?.frecuencia || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Sucursal</dt>
            <dd className="font-medium text-slate-800">{registro.unidad.nombre}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Responsable</dt>
            <dd className="font-medium text-slate-800">{registro.responsable?.nombre ?? 'Sin responsable'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Fecha de revisión del campo</dt>
            <dd><FechaRevision registro={registro} /></dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Estado</dt>
            <dd><EstadoInsignia registro={registro} /></dd>
          </div>
          <div className="col-span-2 lg:col-span-1">
            <dt className="text-xs text-slate-500">Avance (obligatorios)</dt>
            <dd><BarraPorcentaje valor={editable ? avanceLocal : registro.avance.porcentaje} /></dd>
          </div>
        </dl>
        {!!registro.formato?.notas?.length && (
          <ul className="mt-3 space-y-0.5 border-t border-slate-100 pt-2 text-xs italic text-slate-500">
            {registro.formato.notas.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        )}
        {(registro.enviado_en || registro.aprobado_en) && (
          <p className="mt-3 text-xs text-slate-500">
            {registro.enviado_en && <>Enviado {fechaYHora(registro.enviado_en)}. </>}
            {registro.aprobado_en && <>Aprobado {fechaYHora(registro.aprobado_en)}{registro.aprobado_por ? ` por ${registro.aprobado_por}` : ''}.</>}
          </p>
        )}
        <UltimoCambio registro={registro} className="mt-2" />
      </Tarjeta>

      {registro.estado === 'rechazado' && registro.observacion && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-semibold">Rechazado por certificaciones</div>
          <p className="mt-1 whitespace-pre-wrap">{registro.observacion}</p>
          {editable && <p className="mt-2 text-xs">Corrija lo indicado y vuelva a enviarlo a revisión.</p>}
        </div>
      )}
      {registro.estado === 'aprobado' && registro.observacion && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="font-semibold">Observación de la aprobación</div>
          <p className="mt-1 whitespace-pre-wrap">{registro.observacion}</p>
        </div>
      )}

      {corrigiendo && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Estás corrigiendo como certificaciones: el cambio queda registrado con tu nombre.
        </div>
      )}

      <MensajeError error={subida.error} />
      <div className="space-y-4">
        {campos.map((c) => {
          const falta = c.obligatorio && !completo(c, valores[c.id])
          return (
            <section
              key={c.id}
              className={`rounded-xl border bg-white p-4 shadow-sm ${editable && falta ? 'border-amber-300' : 'border-slate-200'}`}
            >
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-800">
                  {c.etiqueta}
                  {c.obligatorio && <span className="text-red-600"> *</span>}
                </h2>
                <span className="flex flex-wrap items-center gap-2">
                  {c.tipo === 'checklist' && (
                    <span className="text-xs tabular-nums text-slate-500">
                      {respondidos(c, valores[c.id])} de {c.items?.length ?? 0} respondidos
                    </span>
                  )}
                  {editable && falta && <span className="text-xs font-medium text-amber-700">Falta completar</span>}
                </span>
              </div>
              {editable ? (
                <EditorCampo
                  campo={c}
                  valor={valores[c.id]}
                  guardado={registro.valores?.[c.id]}
                  registroId={registro.id}
                  onCambio={(v) => cambiar(c.id, v)}
                  subida={subida}
                />
              ) : (
                <LecturaCampo campo={c} valor={valores[c.id]} registroId={registro.id} />
              )}
            </section>
          )
        })}
      </div>

      <MensajeError error={accion.error} />

      {editable && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:mt-4 md:justify-end md:border-0 md:bg-transparent md:p-0">
          <Boton variante="secundario" className="flex-1 whitespace-nowrap px-3 py-3 md:flex-none md:py-2" icono={<Save className="h-4 w-4" />} ocupado={accion.ocupado} disabled={subida.ocupado} onClick={guardarAvance}>
            Guardar avance
          </Boton>
          {registro.estado !== 'en_revision' && !corrigiendo && (
            <Boton className="flex-1 whitespace-nowrap px-3 py-3 md:flex-none md:py-2" icono={<Send className="h-4 w-4" />} ocupado={accion.ocupado} disabled={subida.ocupado} onClick={enviar}>
              <span>Enviar<span className="hidden min-[380px]:inline">&nbsp;a revisión</span></span>
            </Boton>
          )}
        </div>
      )}
      {editable && cambios && <p className="mt-2 text-xs text-amber-700">Hay cambios sin guardar.</p>}

      {esCertificaciones && registro.estado === 'en_revision' && (
        <Tarjeta titulo="Revisión" className="mt-4">
          {rechazando ? (
            <div className="space-y-3">
              <Campo etiqueta="Observación (obligatoria)">
                <textarea rows={3} className={claseEntrada} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
              </Campo>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Boton variante="secundario" onClick={() => setRechazando(false)}>Cancelar</Boton>
                <Boton variante="peligro" icono={<X className="h-4 w-4" />} ocupado={accion.ocupado} onClick={() => revisar(false)}>
                  Rechazar registro
                </Boton>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Boton className="py-3 sm:py-2" icono={<Check className="h-4 w-4" />} ocupado={accion.ocupado} disabled={cambios}
                title={cambios ? 'Guarde los cambios antes de aprobar' : undefined} onClick={() => revisar(true)}>
                Aprobar
              </Boton>
              <Boton variante="peligro" className="py-3 sm:py-2" icono={<X className="h-4 w-4" />} onClick={() => setRechazando(true)}>
                Rechazar
              </Boton>
            </div>
          )}
        </Tarjeta>
      )}

      {(esCertificaciones || registro.estado === 'aprobado') && (
        <Tarjeta titulo="Descargar" className="mt-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Boton variante="secundario" className="py-3 sm:py-2" icono={<Download className="h-4 w-4" />} ocupado={accion.ocupado} onClick={() => exportar('docx')}>
              {registro.estado === 'aprobado' ? 'Descargar Word' : 'Descargar avance (Word)'}
            </Boton>
            <Boton variante="secundario" className="py-3 sm:py-2" icono={<Download className="h-4 w-4" />} ocupado={accion.ocupado} onClick={() => exportar('pdf')}>
              {registro.estado === 'aprobado' ? 'Descargar PDF' : 'Descargar avance (PDF)'}
            </Boton>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {registro.tiene_word_original
              ? 'El Word es el formulario original con los datos llenados hasta ahora. El PDF es una versión recreada con la misma base.'
              : 'Se descarga con la base del formulario original (logo, código, versión y pie).'}
          </p>
          {cambios && <p className="mt-1 text-xs text-amber-700">La descarga incluye solo lo guardado.</p>}
        </Tarjeta>
      )}

      <HistorialCambios historial={historial} abiertoInicial={esCertificaciones} />
      {nodo}
    </div>
  )
}

// ---------- Historial ----------

function HistorialCambios({ historial, abiertoInicial }: {
  historial: ReturnType<typeof useDatos<EventoRegistro[]>>
  abiertoInicial: boolean
}) {
  const { datos, cargando, error, recargar } = historial
  return (
    <details open={abiertoInicial} className="group mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-800">
        <History className="h-4 w-4 text-emerald-700" /> Historial de cambios
        {datos && <span className="text-xs font-normal text-slate-500">({datos.length})</span>}
      </summary>
      <div className="border-t border-slate-100 px-4 py-3">
        <MensajeError error={error} onReintentar={recargar} />
        {cargando && !datos ? (
          <Cargando />
        ) : !datos?.length ? (
          <p className="text-sm text-slate-500">Sin cambios registrados.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-slate-200 pl-4">
            {datos.map((e) => (
              <li key={e.id} className="relative text-sm">
                <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${
                  e.accion === 'aprobar' ? 'bg-emerald-600' : e.accion === 'rechazar' ? 'bg-red-600' : e.accion === 'enviar' ? 'bg-sky-600' : 'bg-slate-400'
                }`} />
                <p className="text-slate-700">
                  <span className="font-medium text-slate-900">{e.usuario}</span> {VERBO_ACCION[e.accion] ?? e.accion} el registro
                  {typeof e.detalle?.avance === 'number' && <span className="text-slate-500"> · avance {e.detalle.avance} %</span>}
                </p>
                <p className="text-xs text-slate-500">{fechaYHora(e.fecha_hora)}</p>
                {!!e.detalle?.cambios?.length && (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
                    {e.detalle.cambios.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                )}
                {e.accion === 'rechazar' && e.detalle?.observacion && (
                  <p className="mt-1 whitespace-pre-wrap rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">{e.detalle.observacion}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  )
}

function MetaFila({ fila, className = '' }: { fila: Fila; className?: string }) {
  if (!fila._por) return null
  return (
    <span className={`text-[11px] leading-tight text-slate-500 ${className}`}>
      {String(fila._por)}{fila._en ? ` · ${fechaYHora(String(fila._en))}` : ''}
    </span>
  )
}

// ---------- Edición ----------

function EditorCampo({ campo, valor, guardado, registroId, onCambio, subida }: {
  campo: CampoRegistro
  valor: unknown
  guardado: unknown
  registroId: number
  onCambio: (v: unknown) => void
  subida: ReturnType<typeof useAccion>
}) {
  if (campo.tipo === 'checklist') return <EditorChecklist campo={campo} valor={comoChecklist(valor)} onCambio={onCambio} />
  if (campo.tipo === 'tabla') {
    return <EditorTabla columnas={campo.columnas ?? []} filas={Array.isArray(valor) ? (valor as Fila[]) : []} onCambio={onCambio} />
  }
  if (campo.tipo === 'foto' || campo.tipo === 'archivo' || campo.tipo === 'firma') {
    return <EditorArchivo campo={campo} valor={valor} guardado={guardado} registroId={registroId} onCambio={onCambio} subida={subida} />
  }
  return <EntradaSimple tipo={campo.tipo} valor={valor} onCambio={onCambio} grande />
}

function EntradaSimple({ tipo, valor, onCambio, grande = false, etiqueta }: {
  tipo: TipoColumna
  valor: unknown
  onCambio: (v: unknown) => void
  grande?: boolean
  etiqueta?: string
}) {
  if (tipo === 'si_no') {
    const opcion = (v: boolean, texto: string) => (
      <button
        type="button"
        onClick={() => onCambio(valor === v ? null : v)}
        className={`flex-1 rounded-lg border font-medium ${grande ? 'py-3 text-base' : 'py-2 text-sm'} ${
          valor === v
            ? v ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-red-600 bg-red-600 text-white'
            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
        }`}
      >
        {texto}
      </button>
    )
    return (
      <div className="flex gap-2" role="group" aria-label={etiqueta}>
        {opcion(true, 'Sí')}
        {opcion(false, 'No')}
      </div>
    )
  }
  const texto = vacio(valor) ? '' : String(valor)
  if (tipo === 'numero') {
    return (
      <input type="number" inputMode="decimal" step="any" aria-label={etiqueta} className={claseEntrada} value={texto}
        onChange={(e) => onCambio(e.target.value)} />
    )
  }
  if (tipo === 'fecha') {
    return <input type="date" aria-label={etiqueta} className={claseEntrada} value={texto.slice(0, 10)} onChange={(e) => onCambio(e.target.value)} />
  }
  return (
    <textarea
      rows={1}
      aria-label={etiqueta}
      className={`${claseEntrada} field-sizing-content min-h-10 resize-y`}
      value={texto}
      onChange={(e) => onCambio(e.target.value)}
    />
  )
}

function EditorTabla({ columnas, filas, onCambio }: {
  columnas: ColumnaRegistro[]
  filas: Fila[]
  onCambio: (filas: Fila[]) => void
}) {
  const cambiarCelda = (i: number, colId: string, v: unknown) =>
    onCambio(filas.map((f, j) => (j === i ? { ...f, [colId]: v } : f)))
  const quitar = (i: number) => onCambio(filas.filter((_, j) => j !== i))
  const agregar = () => onCambio([...filas, {}])

  return (
    <div>
      {!filas.length && <p className="mb-2 text-sm text-slate-500">Sin filas todavía.</p>}

      <div className="space-y-3 md:hidden">
        {filas.map((f, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Fila {i + 1}</span>
              <Boton type="button" variante="fantasma" aria-label="Quitar fila" icono={<Trash2 className="h-4 w-4 text-red-600" />} onClick={() => quitar(i)} />
            </div>
            <div className="space-y-2">
              {columnas.map((col) => (
                <Campo key={col.id} etiqueta={col.etiqueta}>
                  <EntradaSimple tipo={col.tipo} valor={f[col.id]} onCambio={(v) => cambiarCelda(i, col.id, v)} />
                </Campo>
              ))}
            </div>
            <MetaFila fila={f} className="mt-2 block" />
          </div>
        ))}
      </div>

      {filas.length > 0 && (
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                {columnas.map((col) => <th key={col.id} className="px-2 py-1 font-medium">{col.etiqueta}</th>)}
                <th className="w-28 px-2 py-1 font-medium">Ingresó</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i} className="align-top">
                  {columnas.map((col) => (
                    <td key={col.id} className="min-w-32 px-2 py-1">
                      <EntradaSimple tipo={col.tipo} etiqueta={col.etiqueta} valor={f[col.id]} onCambio={(v) => cambiarCelda(i, col.id, v)} />
                    </td>
                  ))}
                  <td className="w-28 px-2 py-2"><MetaFila fila={f} /></td>
                  <td className="py-1">
                    <Boton type="button" variante="fantasma" aria-label="Quitar fila" icono={<Trash2 className="h-4 w-4 text-red-600" />} onClick={() => quitar(i)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Boton type="button" variante="secundario" className="mt-2 w-full py-3 sm:w-auto sm:py-2" icono={<Plus className="h-4 w-4" />} onClick={agregar}>
        Agregar fila
      </Boton>
    </div>
  )
}

function EditorArchivo({ campo, valor, guardado, registroId, onCambio, subida }: {
  campo: CampoRegistro
  valor: unknown
  guardado: unknown
  registroId: number
  onCambio: (v: unknown) => void
  subida: ReturnType<typeof useAccion>
}) {
  const [elegido, setElegido] = useState<File | null>(null)
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null)
  const [reemplazando, setReemplazando] = useState(false)

  useEffect(() => () => { if (vistaPrevia) URL.revokeObjectURL(vistaPrevia) }, [vistaPrevia])

  const actual = esArchivo(valor) ? valor : null
  const yaGuardado = !!actual && esArchivo(guardado) && guardado.clave === actual.clave

  const subir = async (archivo: File | null) => {
    if (!archivo) return
    setElegido(archivo)
    const ok = await subida.ejecutar(async () => {
      const { clave, nombre, tipo } = await subirArchivo(archivo, 'registros')
      onCambio({ clave, nombre, tipo })
    })
    if (ok) {
      setVistaPrevia(archivo.type.startsWith('image/') ? URL.createObjectURL(archivo) : null)
      setReemplazando(false)
    }
  }

  const mostrarSelector = !actual || reemplazando

  return (
    <div className="space-y-2">
      {actual && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="min-w-0 truncate text-slate-700">
            {campo.tipo === 'firma' ? <span className="font-medium text-emerald-700">Firmado</span> : actual.nombre ?? 'Archivo cargado'}
            {!yaGuardado && <span className="ml-2 text-xs text-amber-700">(sin guardar)</span>}
          </span>
          <div className="flex gap-2">
            {yaGuardado && (
              <Boton type="button" variante="secundario" icono={<Eye className="h-4 w-4" />}
                onClick={() => subida.ejecutar(() => abrirUrlFirmada(`/registros/${registroId}/archivo/${campo.id}`))}>
                Ver
              </Boton>
            )}
            {!reemplazando && (
              <Boton type="button" variante="secundario" icono={campo.tipo === 'firma' ? <PenLine className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                onClick={() => setReemplazando(true)}>
                {campo.tipo === 'firma' ? 'Volver a firmar' : 'Reemplazar'}
              </Boton>
            )}
          </div>
        </div>
      )}
      {vistaPrevia && actual && !reemplazando && (
        <img src={vistaPrevia} alt={campo.etiqueta} className="max-h-60 rounded-lg border border-slate-200 bg-white object-contain" />
      )}
      {mostrarSelector && (
        <>
          {campo.tipo === 'firma' ? (
            <FirmaPad onFirmar={(f) => void subir(f)} ocupado={subida.ocupado} />
          ) : (
            <CampoArchivo archivo={elegido} onCambio={(f) => void subir(f)} aceptar={campo.tipo === 'foto' ? 'image/*' : undefined} />
          )}
          {subida.ocupado && <p className="text-xs text-slate-500">Subiendo…</p>}
          {reemplazando && (
            <Boton type="button" variante="fantasma" onClick={() => setReemplazando(false)}>Cancelar</Boton>
          )}
        </>
      )}
    </div>
  )
}

// ---------- Lectura ----------

function LecturaCampo({ campo, valor, registroId }: { campo: CampoRegistro; valor: unknown; registroId: number }) {
  const accion = useAccion()
  if (campo.tipo === 'checklist') return <LecturaChecklist campo={campo} valor={comoChecklist(valor)} />
  if (campo.tipo === 'tabla') {
    const filas = Array.isArray(valor) ? (valor as Fila[]) : []
    const columnas = campo.columnas ?? []
    if (!filas.length) return <p className="text-sm text-slate-500">Sin filas</p>
    return (
      <>
        <div className="space-y-2 md:hidden">
          {filas.map((f, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <dl className="space-y-1">
                {columnas.map((col) => (
                  <div key={col.id} className="flex justify-between gap-3">
                    <dt className="text-xs text-slate-500">{col.etiqueta}</dt>
                    <dd className="text-right text-slate-700">{textoSimple(col.tipo, f[col.id])}</dd>
                  </div>
                ))}
              </dl>
              <MetaFila fila={f} className="mt-2 block" />
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {columnas.map((col) => <th key={col.id} className="px-2 py-1 font-medium">{col.etiqueta}</th>)}
                <th className="w-28 px-2 py-1 font-medium">Ingresó</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((f, i) => (
                <tr key={i}>
                  {columnas.map((col) => <td key={col.id} className="px-2 py-1 text-slate-700">{textoSimple(col.tipo, f[col.id])}</td>)}
                  <td className="w-28 px-2 py-1"><MetaFila fila={f} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }
  if (campo.tipo === 'foto' || campo.tipo === 'archivo' || campo.tipo === 'firma') {
    if (!esArchivo(valor)) return <p className="text-sm text-slate-500">Sin archivo</p>
    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="min-w-0 truncate text-slate-700">{campo.tipo === 'firma' ? 'Firmado' : valor.nombre ?? 'Archivo'}</span>
          <Boton type="button" variante="secundario" icono={<Eye className="h-4 w-4" />} ocupado={accion.ocupado}
            onClick={() => accion.ejecutar(() => abrirUrlFirmada(`/registros/${registroId}/archivo/${campo.id}`))}>
            Ver
          </Boton>
        </div>
        <MensajeError error={accion.error} />
      </div>
    )
  }
  return <p className="whitespace-pre-wrap text-sm text-slate-800">{textoSimple(campo.tipo, valor)}</p>
}

// ---------- Logo y checklist ----------

function LogoPlantilla({ plantillaId }: { plantillaId: number }) {
  const { datos } = useDatos<{ url: string }>(`/registros/plantillas/${plantillaId}/logo`)
  const [fallo, setFallo] = useState(false)
  if (!datos?.url || fallo) return null
  return <img src={datos.url} alt="Logo" className="h-10 w-auto shrink-0 object-contain" onError={() => setFallo(true)} />
}

function agruparPorSeccion(campo: CampoRegistro) {
  const grupos: { seccion: string; items: NonNullable<CampoRegistro['items']> }[] = []
  ;(campo.items ?? []).forEach((it) => {
    const ultimo = grupos.at(-1)
    if (ultimo && ultimo.seccion === (it.seccion ?? '')) ultimo.items.push(it)
    else grupos.push({ seccion: it.seccion ?? '', items: [it] })
  })
  return grupos
}

const CLASE_OPCION: Record<OpcionChecklist, string> = {
  si: 'border-emerald-700 bg-emerald-700 text-white',
  no: 'border-red-600 bg-red-600 text-white',
  na: 'border-slate-500 bg-slate-500 text-white',
}

const TONO_OPCION: Record<OpcionChecklist, 'verde' | 'rojo' | 'gris'> = { si: 'verde', no: 'rojo', na: 'gris' }

function EditorChecklist({ campo, valor, onCambio }: {
  campo: CampoRegistro
  valor: ValorChecklist
  onCambio: (v: ValorChecklist) => void
}) {
  const opciones = campo.opciones?.length ? campo.opciones : (['si', 'no'] as OpcionChecklist[])
  const cambiar = (itemId: string, cambios: Partial<RespuestaChecklist>) => {
    const actual = valor[itemId] ?? { r: null, obs: '' }
    onCambio({ ...valor, [itemId]: { ...actual, ...cambios } })
  }

  return (
    <div className="space-y-3">
      {agruparPorSeccion(campo).map((g, gi) => (
        <div key={gi} className="overflow-hidden rounded-lg border border-slate-200">
          {g.seccion && <div className="bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">{g.seccion}</div>}
          <ul className="divide-y divide-slate-100">
            {g.items.map((it) => {
              const respuesta = valor[it.id]
              return (
                <li key={it.id} className="space-y-2 p-3">
                  <p className="text-sm text-slate-800">{it.texto}</p>
                  <div className="flex gap-2" role="group" aria-label={it.texto}>
                    {opciones.map((o) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => cambiar(it.id, { r: respuesta?.r === o ? null : o })}
                        className={`min-h-11 flex-1 rounded-lg border text-base font-medium sm:max-w-28 ${
                          respuesta?.r === o ? CLASE_OPCION[o] : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {ETIQUETA_OPCION[o]}
                      </button>
                    ))}
                  </div>
                  {campo.con_observacion && (
                    <input
                      aria-label={`Observación: ${it.texto}`}
                      placeholder={respuesta?.r === 'no' ? 'Indique la observación' : 'Observación (opcional)'}
                      className={`${claseEntrada} ${respuesta?.r === 'no' ? 'border-red-400 bg-red-50' : ''}`}
                      value={respuesta?.obs ?? ''}
                      onChange={(e) => cambiar(it.id, { obs: e.target.value })}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

function LecturaChecklist({ campo, valor }: { campo: CampoRegistro; valor: ValorChecklist }) {
  return (
    <div className="space-y-3">
      {agruparPorSeccion(campo).map((g, gi) => (
        <div key={gi} className="overflow-hidden rounded-lg border border-slate-200">
          {g.seccion && <div className="bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">{g.seccion}</div>}
          <ul className="divide-y divide-slate-100">
            {g.items.map((it) => {
              const respuesta = valor[it.id]
              return (
                <li key={it.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-slate-800">{it.texto}</p>
                    {respuesta?.obs && <p className="mt-0.5 text-xs text-slate-500">Obs.: {respuesta.obs}</p>}
                  </div>
                  {respuesta?.r ? (
                    <Insignia tono={TONO_OPCION[respuesta.r]}>{ETIQUETA_OPCION[respuesta.r]}</Insignia>
                  ) : (
                    <span className="text-xs text-slate-500">—</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
