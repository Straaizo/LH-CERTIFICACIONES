import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, Download, Eye, FileCheck, Search } from 'lucide-react'
import { api, descargarArchivo } from '../api'
import {
  BarraPorcentaje,
  Boton,
  Cargando,
  EncabezadoPagina,
  Insignia,
  ErrorPagina,
  MensajeError,
  Modal,
  Tarjeta,
  TextoConEnlaces,
  Vacio,
  claseEntrada,
  useAviso,
  type Tono,
} from '../componentes/ui'
import { useSesionActiva } from '../contexto/Sesion'
import { ETIQUETA_ESTADO_AUDITORIA, ETIQUETA_NIVEL, ETIQUETA_RESULTADO, fecha } from '../formato'
import { useAccion, useDatos } from '../hooks'
import type { Auditoria, AuditoriaDetalle as Detalle, AvanceClausula, ItemChecklist, ResumenAuditoria } from '../tipos'
import { Selector } from '../componentes/Desplegable'

type Resultado = ItemChecklist['resultado']
type FiltroItems = 'todos' | 'sin' | 'no' | 'advertencia'

interface RespuestaGuardada {
  resultado: Resultado
  no_conformidad: ItemChecklist['no_conformidad']
  resumen: ResumenAuditoria
}

const TONO_NIVEL: Record<string, Tono> = { mayor: 'rojo', menor: 'amarillo', recomendacion: 'gris', fundamental: 'violeta' }
const TONO_ESTADO: Record<string, Tono> = { planificada: 'azul', en_curso: 'amarillo', cerrada: 'verde' }

const BOTONES: { valor: 'si' | 'no' | 'na'; etiqueta: string; activo: string }[] = [
  { valor: 'si', etiqueta: 'Sí', activo: 'border-emerald-600 bg-emerald-600 text-white' },
  { valor: 'no', etiqueta: 'No', activo: 'border-red-600 bg-red-600 text-white' },
  { valor: 'na', etiqueta: 'N/A', activo: 'border-slate-500 bg-slate-500 text-white' },
]

/** Misma regla que la API (seccion_principal): GLOBALG.A.P. usa la sección completa; el resto, el número antes del punto. */
function clausulaDe(requisito: ItemChecklist['requisito']): string {
  return requisito.seccion.startsWith('FV') ? requisito.seccion : requisito.codigo.split('.')[0]
}

function rangoFechas(a: Pick<Auditoria, 'fecha_inicio' | 'fecha_fin'>): string {
  return a.fecha_fin && a.fecha_fin !== a.fecha_inicio ? `${fecha(a.fecha_inicio)} – ${fecha(a.fecha_fin)}` : fecha(a.fecha_inicio)
}

function claseAvance(c: AvanceClausula): string {
  if (c.total && c.respondidos >= c.total) return 'border-emerald-300 bg-emerald-50 text-emerald-800'
  if (c.respondidos) return 'border-amber-300 bg-amber-50 text-amber-800'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

export function AuditoriaDetalle() {
  const { id } = useParams()
  const { esCertificaciones } = useSesionActiva()
  const { datos, cargando, error, recargar, setDatos } = useDatos<Detalle>(`/auditorias/${id}`)
  const { datos: codigos } = useDatos<Record<string, number>>('/documentos/codigos')
  const [parametros, setParametros] = useSearchParams()
  const [filtro, setFiltro] = useState<FiltroItems>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set())
  const [descargando, setDescargando] = useState(false)
  const [emitiendo, setEmitiendo] = useState(false)
  const accionEstado = useAccion()
  const { avisar, nodo } = useAviso()

  const clausulaParam = parametros.get('clausula')
  const clausula = datos?.clausulas.some((c) => c.codigo === clausulaParam) ? clausulaParam : null

  const elegirClausula = (codigo: string | null) => {
    const nuevos = new URLSearchParams(parametros)
    if (codigo) nuevos.set('clausula', codigo)
    else nuevos.delete('clausula')
    setParametros(nuevos, { replace: true })
  }

  const grupos = useMemo(() => {
    if (!datos) return []
    const texto = busqueda.trim().toLowerCase()
    const mapa = new Map<string, { titulo: string | null; items: ItemChecklist[] }>()
    for (const item of datos.items) {
      if (clausula && clausulaDe(item.requisito) !== clausula) continue
      if (filtro === 'sin' && item.resultado !== null) continue
      if (filtro === 'no' && item.resultado !== 'no') continue
      if (filtro === 'advertencia' && !item.advertencia) continue
      if (
        texto &&
        !`${item.requisito.codigo} ${item.requisito.texto} ${item.comentario ?? ''}`.toLowerCase().includes(texto)
      )
        continue
      const grupo = mapa.get(item.requisito.seccion) ?? { titulo: item.requisito.seccion_titulo, items: [] }
      grupo.items.push(item)
      mapa.set(item.requisito.seccion, grupo)
    }
    return [...mapa.entries()]
  }, [datos, filtro, busqueda, clausula])

  if (cargando && !datos) return <Cargando variante="detalle" />
  if (error && !datos) return <ErrorPagina error={error} volverA="/auditorias" volverTexto="Auditorías" onReintentar={recargar} />
  if (!datos) return null

  const editable = esCertificaciones && datos.estado !== 'cerrada' && !datos.emitida_en
  const r = datos.resumen
  const actual = datos.clausulas.find((c) => c.codigo === clausula) ?? null

  const actualizarItem = (requisitoId: number, cambios: Partial<ItemChecklist>, resumen: ResumenAuditoria) => {
    setDatos((prev) => {
      if (!prev) return prev
      const anterior = prev.items.find((i) => i.requisito.id === requisitoId)
      const items = prev.items.map((i) => (i.requisito.id === requisitoId ? { ...i, ...cambios } : i))
      let clausulas = prev.clausulas
      if (anterior && cambios.resultado !== undefined) {
        const codigo = clausulaDe(anterior.requisito)
        const delta = (v: Resultado) => (v ? 1 : 0)
        const deltaNo = (v: Resultado) => (v === 'no' ? 1 : 0)
        clausulas = prev.clausulas.map((c) =>
          c.codigo === codigo
            ? {
                ...c,
                respondidos: c.respondidos + delta(cambios.resultado ?? null) - delta(anterior.resultado),
                no: c.no + deltaNo(cambios.resultado ?? null) - deltaNo(anterior.resultado),
              }
            : c,
        )
      }
      return {
        ...prev,
        items,
        clausulas,
        resumen,
        estado: prev.estado === 'planificada' ? 'en_curso' : prev.estado,
        no_conformidades: items.filter((i) => i.no_conformidad).length,
      }
    })
  }

  const cambiarEstado = async (estado: Auditoria['estado']) => {
    let nueva: Auditoria | null = null
    const ok = await accionEstado.ejecutar(async () => {
      nueva = await api.patch<Auditoria>(`/auditorias/${datos.id}`, { estado })
    })
    if (ok && nueva) {
      const actualizada: Auditoria = nueva
      setDatos((prev) => (prev ? { ...prev, ...actualizada } : prev))
      avisar(estado === 'cerrada' ? 'Auditoría cerrada' : 'Auditoría iniciada')
    }
  }

  const alternarSeccion = (seccion: string) =>
    setPlegadas((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(seccion)) nuevo.delete(seccion)
      else nuevo.add(seccion)
      return nuevo
    })

  return (
    <div className="space-y-4">
      <Link to="/auditorias" className="-ml-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Auditorías
      </Link>
      <EncabezadoPagina
        titulo={datos.titulo}
        descripcion={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              {datos.protocolo.codigo} {datos.version.nombre}
            </span>
            <span>{datos.unidad.nombre}</span>
            <span>{rangoFechas(datos)}</span>
            <span>Auditor: {datos.auditor ?? '—'}</span>
            <Insignia tono={TONO_ESTADO[datos.estado]}>{ETIQUETA_ESTADO_AUDITORIA[datos.estado]}</Insignia>
            {datos.emitida_en && <Insignia tono="violeta">Informe emitido el {fecha(datos.emitida_en)}</Insignia>}
            {datos.origen === 'importada' && <Insignia tono="violeta">Importada</Insignia>}
          </span>
        }
        acciones={
          <>
            <Boton variante="secundario" icono={<Download className="h-4 w-4" />} onClick={() => setDescargando(true)}>
              Descargar Excel
            </Boton>
            {!esCertificaciones && (
              <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm" title="Las auditorías las responde certificaciones. Las no conformidades de tus sucursales se trabajan en No conformidades.">
              <Eye className="h-4 w-4" /> Solo lectura
            </span>
            )}
            {esCertificaciones && !datos.emitida_en && (
              <>
                {datos.estado === 'planificada' && (
                  <Boton ocupado={accionEstado.ocupado} onClick={() => void cambiarEstado('en_curso')}>
                    Iniciar auditoría
                  </Boton>
                )}
                <Boton icono={<FileCheck className="h-4 w-4" />} onClick={() => setEmitiendo(true)}>
                  Emitir informe
                </Boton>
              </>
            )}
          </>
        }
      />
      <MensajeError error={accionEstado.error} />

      <Tarjeta titulo="Resumen">
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <Contador etiqueta="Sí" valor={r.si} clase="text-emerald-700" />
          <Contador etiqueta="No" valor={r.no} clase="text-red-700" />
          <Contador etiqueta="N/A" valor={r.na} clase="text-slate-600" />
          <Contador etiqueta="Sin responder" valor={r.sin} clase="text-slate-500" />
        </div>
        <div className="mt-4">
          <p className="mb-1 text-xs text-slate-500">Cumplimiento = Sí / (Sí + No), sin N/A</p>
          <BarraPorcentaje valor={r.cumplimiento} tono="auto" />
        </div>
        {r.aprueba !== undefined && (
          <div className="mt-4 rounded-lg border border-slate-200 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-700">Regla GLOBALG.A.P.: 100 % mayores y 95 % menores</span>
              <Insignia tono={r.aprueba ? 'verde' : 'rojo'}>{r.aprueba ? 'Aprueba' : 'No aprueba'}</Insignia>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(r.por_nivel).map(([nivel, valor]) => (
                <Insignia key={nivel} tono={TONO_NIVEL[nivel] ?? 'gris'}>
                  {ETIQUETA_NIVEL[nivel] ?? nivel}: {valor} %
                </Insignia>
              ))}
            </div>
          </div>
        )}
        {datos.no_conformidades > 0 && (
          <p className="mt-3 text-sm">
            <Link to="/no-conformidades" className="font-medium text-red-700 underline">
              {datos.no_conformidades} no conformidades
            </Link>
          </p>
        )}
      </Tarjeta>

      {datos.advertencias.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> Revisar: errores detectados en la planilla original (no se corrigieron
            automáticamente)
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {datos.advertencias.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {!datos.items.length ? (
        <Vacio>Esta norma no tiene requisitos importados para estas cláusulas; impórtalos desde una planilla.</Vacio>
      ) : (
        <Tarjeta titulo="Checklist">
          {editable && (
            <p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              Cada respuesta se guarda al instante: puedes trabajar una cláusula hoy y seguir mañana con otra en esta misma
              auditoría. Cada "No" crea una no conformidad automáticamente.
            </p>
          )}
          <div className="sin-barra -mx-4 mb-4 overflow-x-auto px-4">
            <div className="flex gap-2 pb-1">
              <button
                onClick={() => elegirClausula(null)}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium ${
                  clausula === null ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                Todas
              </button>
              {datos.clausulas.map((c) => (
                <button
                  key={c.codigo}
                  onClick={() => elegirClausula(c.codigo)}
                  title={c.titulo || undefined}
                  className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium ${
                    clausula === c.codigo ? 'ring-2 ring-emerald-700 ring-offset-1' : ''
                  } ${claseAvance(c)}`}
                >
                  {c.no > 0 && <span className="h-2 w-2 rounded-full bg-red-600" aria-label="Tiene No" />}
                  <span>{c.codigo}</span>
                  <span className="text-xs tabular-nums opacity-80">
                    {c.respondidos}/{c.total}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {actual && (
            <p className="mb-3 text-sm text-slate-700">
              <span className="font-semibold">Cláusula {actual.codigo}</span>
              {actual.titulo ? ` · ${actual.titulo}` : ''} · {actual.respondidos} de {actual.total} respondidos
              {actual.no > 0 ? ` · ${actual.no} "No"` : ''}
            </p>
          )}
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                className={`${claseEntrada} pl-9`}
                placeholder="Buscar por código o texto"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <Selector
              aria-label="Filtro"
              className={`${claseEntrada} sm:w-56`}
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as FiltroItems)}
            >
              <option value="todos">Todos</option>
              <option value="sin">Sin responder</option>
              <option value="no">Solo "No"</option>
              <option value="advertencia">Con advertencia</option>
            </Selector>
          </div>
          {!grupos.length && <Vacio>Ningún requisito coincide con el filtro.</Vacio>}
          <div className="space-y-3">
            {grupos.map(([seccion, grupo]) => {
              const plegada = plegadas.has(seccion)
              return (
                <section key={seccion} className="rounded-lg border border-slate-200">
                  <button
                    onClick={() => alternarSeccion(seccion)}
                    className="flex w-full items-center gap-2 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-800"
                  >
                    {plegada ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    <span className="flex-1">
                      {seccion}
                      {grupo.titulo ? ` · ${grupo.titulo}` : ''}
                    </span>
                    <span className="text-xs font-normal text-slate-500">{grupo.items.length}</span>
                  </button>
                  {!plegada && (
                    <div className="divide-y divide-slate-100">
                      {grupo.items.map((item) => (
                        <FilaRequisito
                          key={item.requisito.id}
                          auditoriaId={datos.id}
                          item={item}
                          editable={editable}
                          codigos={codigos ?? {}}
                          onGuardado={actualizarItem}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </Tarjeta>
      )}

      {descargando && (
        <ModalDescarga
          auditoriaId={datos.id}
          clausulas={datos.clausulas}
          actual={clausula}
          onCerrar={() => setDescargando(false)}
        />
      )}
      {emitiendo && (
        <ModalEmitir
          auditoriaId={datos.id}
          noConformidades={datos.no_conformidades}
          onCerrar={() => setEmitiendo(false)}
          onEmitida={(mensaje) => {
            setEmitiendo(false)
            avisar(mensaje)
            void recargar()
          }}
        />
      )}
      {nodo}
    </div>
  )
}

function ModalDescarga({ auditoriaId, clausulas, actual, onCerrar }: {
  auditoriaId: number
  clausulas: AvanceClausula[]
  actual: string | null
  onCerrar: () => void
}) {
  const [elegidas, setElegidas] = useState<Set<string>>(() => new Set(clausulas.map((c) => c.codigo)))
  const { ocupado, error, ejecutar } = useAccion()
  const todas = elegidas.size === clausulas.length

  const alternar = (codigo: string) =>
    setElegidas((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(codigo)) nuevo.delete(codigo)
      else nuevo.add(codigo)
      return nuevo
    })

  const descargar = async () => {
    const ok = await ejecutar(() =>
      descargarArchivo(
        `/auditorias/${auditoriaId}/exportar`,
        { clausulas: todas ? undefined : clausulas.filter((c) => elegidas.has(c.codigo)).map((c) => c.codigo).join(',') },
        'auditoria.xlsx',
      ),
    )
    if (ok) onCerrar()
  }

  return (
    <Modal abierto titulo="Descargar Excel" onCerrar={onCerrar} ancho="max-w-md">
      <div className="space-y-3 text-sm">
        <p className="text-slate-600">
          Mismo formato de las planillas de auditoría interna; incluye la hoja de no conformidades.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 font-medium text-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-700"
              checked={todas}
              onChange={(e) => setElegidas(new Set(e.target.checked ? clausulas.map((c) => c.codigo) : []))}
            />
            Todas las cláusulas
          </label>
          {actual && (
            <button onClick={() => setElegidas(new Set([actual]))} className="text-xs font-medium text-emerald-700 underline">
              Solo la cláusula actual ({actual})
            </button>
          )}
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {clausulas.map((c) => (
            <label key={c.codigo} className="flex items-start gap-2 rounded px-1 py-1 hover:bg-slate-50">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-700"
                checked={elegidas.has(c.codigo)}
                onChange={() => alternar(c.codigo)}
              />
              <span className="text-slate-700">
                <span className="font-medium">{c.codigo}</span>
                {c.titulo ? ` · ${c.titulo}` : ''}
                <span className="ml-1 text-xs text-slate-500">
                  ({c.respondidos}/{c.total})
                </span>
              </span>
            </label>
          ))}
        </div>
        <MensajeError error={error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            icono={<Download className="h-4 w-4" />}
            ocupado={ocupado}
            disabled={!elegidas.size}
            onClick={() => void descargar()}
          >
            Descargar
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

function ModalEmitir({ auditoriaId, noConformidades, onCerrar, onEmitida }: {
  auditoriaId: number
  noConformidades: number
  onCerrar: () => void
  onEmitida: (mensaje: string) => void
}) {
  const { ocupado, error, ejecutar } = useAccion()

  const emitir = async () => {
    let respuesta: { responsable: string | null; plazo_dias: number } | null = null
    const ok = await ejecutar(async () => {
      respuesta = await api.post<{ responsable: string | null; plazo_dias: number }>(`/auditorias/${auditoriaId}/emitir`)
    })
    if (ok && respuesta) {
      const r: { responsable: string | null; plazo_dias: number } = respuesta
      onEmitida(
        noConformidades
          ? `Informe emitido: ${noConformidades} no conformidades para ${r.responsable ?? 'el jefe de área'}, plazo ${r.plazo_dias} días`
          : 'Informe emitido',
      )
    }
  }

  return (
    <Modal abierto titulo="Emitir informe" onCerrar={onCerrar} ancho="max-w-md">
      <div className="space-y-3 text-sm">
        <p className="text-slate-700">
          Se cierra la auditoría y cada no conformidad ({noConformidades}) pasa al jefe del campo o área, con un plazo de 28
          días para completar el análisis de causa raíz y las acciones correctiva y preventiva. Ya no se podrán modificar
          las respuestas.
        </p>
        <MensajeError error={error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton icono={<FileCheck className="h-4 w-4" />} ocupado={ocupado} onClick={() => void emitir()}>
            Emitir informe
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

function Contador({ etiqueta, valor, clase }: { etiqueta: string; valor: number; clase: string }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <p className={`text-2xl font-semibold tabular-nums ${clase}`}>{valor}</p>
      <p className="text-xs text-slate-500">{etiqueta}</p>
    </div>
  )
}

function FilaRequisito({ auditoriaId, item, editable, codigos, onGuardado }: {
  auditoriaId: number
  item: ItemChecklist
  editable: boolean
  codigos: Record<string, number>
  onGuardado: (requisitoId: number, cambios: Partial<ItemChecklist>, resumen: ResumenAuditoria) => void
}) {
  const [verMas, setVerMas] = useState(false)
  const [editando, setEditando] = useState(false)
  const [pendienteNo, setPendienteNo] = useState(false)
  const [comentario, setComentario] = useState(item.comentario ?? '')
  const { ocupado, error, setError, ejecutar } = useAccion()
  const { requisito } = item

  // El área ya no se elige: se indica en el comentario
  const guardar = async (resultado: Resultado, texto: string | null) => {
    if (resultado === 'no' && !texto?.trim()) {
      setError("Un 'No' requiere comentario (será la descripción de la no conformidad)")
      return
    }
    let respuesta: RespuestaGuardada | null = null
    const ok = await ejecutar(async () => {
      respuesta = await api.put<RespuestaGuardada>(`/auditorias/${auditoriaId}/respuestas/${requisito.id}`, {
        resultado,
        comentario: texto?.trim() || null,
      })
    })
    if (ok && respuesta) {
      const r: RespuestaGuardada = respuesta
      onGuardado(
        requisito.id,
        { resultado: r.resultado, comentario: texto?.trim() || null, no_conformidad: r.no_conformidad },
        r.resumen,
      )
      setEditando(false)
      setPendienteNo(false)
    }
  }

  const marcar = (valor: 'si' | 'no' | 'na') => {
    if (valor === 'no' && !item.comentario?.trim()) {
      setPendienteNo(true)
      setEditando(true)
      return
    }
    void guardar(valor, comentario)
  }

  const resultadoComentario: Resultado = pendienteNo ? 'no' : item.resultado

  return (
    <article className={`p-3 ${item.advertencia ? 'bg-amber-50/50' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-slate-800">{requisito.codigo}</span>
        {requisito.nivel && (
          <Insignia tono={TONO_NIVEL[requisito.nivel] ?? 'gris'}>{ETIQUETA_NIVEL[requisito.nivel] ?? requisito.nivel}</Insignia>
        )}
        {item.no_conformidad && (
          <Link to={`/no-conformidades/${item.no_conformidad.id}`}>
            <Insignia tono="rojo" titulo={`Estado: ${item.no_conformidad.estado}`}>
              NC #{item.no_conformidad.id}
              {item.no_conformidad.reincidencias > 0 ? ` · Reincidente ×${item.no_conformidad.reincidencias}` : ''}
            </Insignia>
          </Link>
        )}
      </div>
      <p className={`mt-1 whitespace-pre-line text-sm text-slate-700 ${verMas ? '' : 'line-clamp-2'}`}>{requisito.texto}</p>
      {requisito.texto.length > 160 && (
        <button onClick={() => setVerMas((v) => !v)} className="-ml-1 inline-flex min-h-9 items-center rounded-lg px-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
          {verMas ? 'ver menos' : 'ver más'}
        </button>
      )}

      {item.advertencia && (
        <p className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {item.advertencia}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        {editable ? (
          <div className="grid grid-cols-3 gap-2 sm:w-72">
            {BOTONES.map((b) => {
              const activo = item.resultado === b.valor || (pendienteNo && b.valor === 'no')
              return (
                <button
                  key={b.valor}
                  disabled={ocupado}
                  onClick={() => marcar(b.valor)}
                  className={`min-h-12 rounded-lg border-2 text-base font-semibold transition-colors disabled:opacity-60 ${
                    activo ? b.activo : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {b.etiqueta}
                </button>
              )
            })}
          </div>
        ) : (
          <Insignia tono={item.resultado === 'no' ? 'rojo' : item.resultado === 'si' ? 'verde' : 'gris'}>
            {item.resultado ? ETIQUETA_RESULTADO[item.resultado] : 'Sin responder'}
          </Insignia>
        )}
      </div>

      {editando ? (
        <div className="mt-2 space-y-2">
          <textarea
            autoFocus
            rows={3}
            className={claseEntrada}
            placeholder={pendienteNo ? 'Describe el hallazgo e indica el área (obligatorio para un "No")' : 'Comentario (indica el área si corresponde)'}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
          />
          <div className="flex gap-2">
            <Boton ocupado={ocupado} onClick={() => void guardar(resultadoComentario, comentario)}>
              {pendienteNo ? 'Guardar "No"' : 'Guardar comentario'}
            </Boton>
            <Boton
              variante="secundario"
              onClick={() => {
                setEditando(false)
                setPendienteNo(false)
                setComentario(item.comentario ?? '')
                setError(null)
              }}
            >
              Cancelar
            </Boton>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-sm">
          {item.comentario && (
            <p className="whitespace-pre-line text-slate-600">
              <TextoConEnlaces texto={item.comentario} codigos={codigos} />
            </p>
          )}
          {editable && (
            <button onClick={() => setEditando(true)} className="-ml-1 mt-1 inline-flex min-h-9 items-center rounded-lg px-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
              {item.comentario ? 'Editar comentario' : 'Agregar comentario'}
            </button>
          )}
        </div>
      )}
      <MensajeError error={error} />

      {item.historial.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500">Auditorías anteriores:</span>
          {item.historial.map((h) => (
            <Link key={h.auditoria_id} to={`/auditorias/${h.auditoria_id}`}>
              <Insignia tono={h.resultado === 'no' ? 'rojo' : h.resultado === 'si' ? 'verde' : 'gris'} titulo={h.comentario ?? undefined}>
                {fecha(h.fecha)} · {ETIQUETA_RESULTADO[h.resultado] ?? h.resultado}
              </Insignia>
            </Link>
          ))}
        </div>
      )}
    </article>
  )
}
