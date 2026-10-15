import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Eye, FileSpreadsheet, Upload, XCircle } from 'lucide-react'
import { api } from '../api'
import {
  BarraPorcentaje,
  Boton,
  Campo,
  EncabezadoPagina,
  Insignia,
  MensajeError,
  Modal,
  Tarjeta,
  Vacio,
  ElegirArchivo,
  claseEntrada,
  useAviso,
} from '../componentes/ui'
import { useSesionActiva } from '../contexto/Sesion'
import { ETIQUETA_NIVEL, ETIQUETA_RESULTADO, fecha } from '../formato'
import { useAccion } from '../hooks'
import { Selector } from '../componentes/Desplegable'
import { VerVersionNorma } from '../componentes/VersionNorma'

interface ItemVistaPrevia {
  codigo: string
  seccion: string
  fundamental: boolean
  resultado: 'si' | 'no' | 'na' | null
  comentario: string
  texto: string
  fila: number
  advertencias: string[]
}

interface HojaVistaPrevia {
  hoja: string
  lugar: string
  auditor: string
  fecha: string | null
  alcance: string
  secciones: string[]
  total: number
  si: number
  no: number
  na: number
  sin_respuesta: number
  cumplimiento: number | null
  advertencias: string[]
  items: ItemVistaPrevia[]
  unidad: { id: number; nombre: string } | null
  temporada: string | null
  ya_importada: boolean
  errores: string[]
  auditoria_id?: number
}

interface ResultadoBrcgs {
  archivo: string
  confirmado: boolean
  hojas: HojaVistaPrevia[]
}

interface ResultadoChecklist {
  archivo: string
  formato: string
  protocolo_sugerido: string | null
  protocolo: string | null
  protocolo_nombre: string | null
  version: string
  puntos: number
  niveles: Record<string, number>
  secciones: { codigo: string; titulo: string }[]
  muestra: { codigo: string; seccion: string; texto: string; nivel: string }[]
  advertencias: string[]
  version_existente: { requisitos: number; faltantes: number } | null
  comparacion: { version: string; agregados: string[]; quitados: string[]; cambiados: string[] } | null
  confirmado: boolean
  nuevos: number
  version_id?: number
}

function formulario(archivo: File, confirmar: boolean, unidadId?: number | '') {
  const datos = new FormData()
  datos.append('archivo', archivo)
  datos.append('confirmar', confirmar ? 'true' : 'false')
  if (unidadId) datos.append('unidad_id', String(unidadId))
  return datos
}

export function Importar() {
  return (
    <div className="space-y-4">
      <EncabezadoPagina
        sinFiltros
        titulo="Importar planillas"
        descripcion="El importador muestra los errores de la planilla para revisión; no los corrige en silencio."
      />
      <ImportarBrcgs />
      <ImportarChecklist />
      <VersionesCargadas />
    </div>
  )
}

function SelectorPlanilla({ onCambio }: { onCambio: (f: File | null) => void }) {
  return (
    <ElegirArchivo aceptar=".xlsx,.xlsm" onCambio={onCambio} texto="Elegir planilla" />
  )
}

function ListaAdvertencias({ titulo, lista, tono }: { titulo: string; lista: string[]; tono: 'ambar' | 'rojo' }) {
  if (!lista.length) return null
  const clase = tono === 'rojo' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-300 bg-amber-50 text-amber-900'
  return (
    <div className={`rounded-lg border p-3 text-sm ${clase}`}>
      <p className="flex items-center gap-2 font-semibold">
        {tono === 'rojo' ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {titulo}
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {lista.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </div>
  )
}

function ImportarBrcgs() {
  const { catalogos, recargarCatalogos } = useSesionActiva()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [unidadId, setUnidadId] = useState<number | ''>('')
  const [resultado, setResultado] = useState<ResultadoBrcgs | null>(null)
  const vista = useAccion()
  const confirmacion = useAccion()
  const { avisar, nodo } = useAviso()

  const previsualizar = async (unidad: number | '' = unidadId) => {
    if (!archivo) return
    await vista.ejecutar(async () => {
      setResultado(await api.post<ResultadoBrcgs>('/importaciones/brcgs', formulario(archivo, false, unidad)))
    })
  }

  const confirmar = async () => {
    if (!archivo) return
    const ok = await confirmacion.ejecutar(async () => {
      setResultado(await api.post<ResultadoBrcgs>('/importaciones/brcgs', formulario(archivo, true, unidadId)))
      await recargarCatalogos()
    })
    if (ok) avisar('Importación confirmada')
  }

  const importables = resultado?.hojas.filter((h) => !h.errores.length).length ?? 0
  const faltaUnidad = resultado?.hojas.some((h) => !h.unidad) ?? false

  return (
    <Tarjeta titulo="Auditoría interna BRCGS (planilla Excel)">
      <div className="space-y-3">
        <Campo etiqueta="Planilla (.xlsx)" ayuda="Cada hoja es una auditoría: lugar, auditor, fecha, alcance y checklist.">
          <SelectorPlanilla
            onCambio={(f) => {
              setArchivo(f)
              setResultado(null)
              setUnidadId('')
            }}
          />
        </Campo>
        <Boton
          icono={<FileSpreadsheet className="h-4 w-4" />}
          disabled={!archivo}
          ocupado={vista.ocupado}
          onClick={() => void previsualizar()}
          className="w-full sm:w-auto"
        >
          Ver vista previa
        </Boton>
        <MensajeError error={vista.error} />

        {resultado && (
          <div className="space-y-4">
            {(faltaUnidad || unidadId !== '') && !resultado.confirmado && (
              <Campo etiqueta="Sucursal para esta planilla" ayuda="Se aplica a todas las hojas del archivo.">
                <Selector
                  className={claseEntrada}
                  value={unidadId}
                  onChange={(e) => {
                    const valor = e.target.value ? Number(e.target.value) : ''
                    setUnidadId(valor)
                    void previsualizar(valor)
                  }}
                >
                  <option value="">Detectar desde la planilla</option>
                  {catalogos.unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
            )}
            {resultado.hojas.map((hoja) => (
              <VistaHoja key={hoja.hoja} hoja={hoja} />
            ))}
            {!resultado.confirmado ? (
              <div>
                <Boton
                  ocupado={confirmacion.ocupado}
                  disabled={!importables}
                  onClick={() => void confirmar()}
                  className="w-full sm:w-auto"
                >
                  Confirmar importación ({importables} de {resultado.hojas.length} hojas)
                </Boton>
                {importables < resultado.hojas.length && (
                  <p className="mt-1 text-xs text-slate-500">Las hojas con errores bloqueantes no se importan.</p>
                )}
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Importación confirmada.
              </p>
            )}
            <MensajeError error={confirmacion.error} />
          </div>
        )}
      </div>
      {nodo}
    </Tarjeta>
  )
}

function VistaHoja({ hoja }: { hoja: HojaVistaPrevia }) {
  const [soloAdvertencias, setSoloAdvertencias] = useState(false)
  const [verItems, setVerItems] = useState(false)
  const items = soloAdvertencias ? hoja.items.filter((i) => i.advertencias.length) : hoja.items
  const conAdvertencia = hoja.items.filter((i) => i.advertencias.length).length

  return (
    <section className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-800">Hoja: {hoja.hoja}</h3>
        {hoja.auditoria_id ? (
          <Link to={`/auditorias/${hoja.auditoria_id}`} className="text-sm font-medium text-emerald-700 underline">
            Ver auditoría creada
          </Link>
        ) : hoja.errores.length ? (
          <Insignia tono="rojo">No se importará</Insignia>
        ) : (
          <Insignia tono="verde">Lista para importar</Insignia>
        )}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        <Dato etiqueta="Lugar" valor={hoja.lugar || '—'} />
        <Dato
          etiqueta="Sucursal detectada"
          valor={hoja.unidad?.nombre ?? <span className="font-medium text-red-700">No reconocida</span>}
        />
        <Dato etiqueta="Auditor" valor={hoja.auditor || '—'} />
        <Dato etiqueta="Fecha" valor={fecha(hoja.fecha)} />
        <Dato etiqueta="Temporada" valor={hoja.temporada ?? '—'} />
        <Dato etiqueta="Cláusulas" valor={hoja.secciones.join(', ') || '—'} />
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Insignia tono="verde">Sí: {hoja.si}</Insignia>
        <Insignia tono="rojo">No: {hoja.no}</Insignia>
        <Insignia>N/A: {hoja.na}</Insignia>
        <Insignia>Sin respuesta: {hoja.sin_respuesta}</Insignia>
      </div>
      <div className="mt-2">
        <BarraPorcentaje valor={hoja.cumplimiento} tono="auto" />
      </div>
      <div className="mt-3 space-y-2">
        <ListaAdvertencias titulo="Errores bloqueantes" lista={hoja.errores} tono="rojo" />
        <ListaAdvertencias titulo="Advertencias de la hoja (revisar)" lista={hoja.advertencias} tono="ambar" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Boton variante="secundario" onClick={() => setVerItems((v) => !v)}>
          {verItems ? 'Ocultar ítems' : `Ver ${hoja.total} ítems`}
        </Boton>
        {verItems && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-700"
              checked={soloAdvertencias}
              onChange={(e) => setSoloAdvertencias(e.target.checked)}
            />
            Solo con advertencias ({conAdvertencia})
          </label>
        )}
      </div>
      {verItems && (
        <div className="mt-3 max-h-[60vh] overflow-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-2 py-2">Fila</th>
                <th className="px-2 py-2">Código</th>
                <th className="px-2 py-2">Requisito</th>
                <th className="px-2 py-2">Resultado</th>
                <th className="px-2 py-2">Comentario / advertencias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((i) => (
                <tr key={`${i.fila}-${i.codigo}`} className={i.advertencias.length ? 'bg-amber-50' : ''}>
                  <td className="px-2 py-1.5 text-xs text-slate-500">{i.fila}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono text-xs">
                    {i.codigo}
                    {i.fundamental && (
                      <span className="ml-1">
                        <Insignia tono="violeta">Fundamental</Insignia>
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-slate-600">{i.texto}</td>
                  <td className="px-2 py-1.5">
                    <Insignia tono={i.resultado === 'no' ? 'rojo' : i.resultado === 'si' ? 'verde' : 'gris'}>
                      {i.resultado ? ETIQUETA_RESULTADO[i.resultado] : 'Sin respuesta'}
                    </Insignia>
                  </td>
                  <td className="px-2 py-1.5 text-xs">
                    {i.comentario && <p className="text-slate-600">{i.comentario}</p>}
                    {i.advertencias.map((a, k) => (
                      <p key={k} className="mt-0.5 flex items-start gap-1 font-medium text-amber-800">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {a}
                      </p>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{etiqueta}</dt>
      <dd className="text-slate-800">{valor}</dd>
    </div>
  )
}

/** Carga de un checklist: vista previa, comparación con la versión vigente y confirmación.
 *  Con protocoloFijo se usa para "Subir versión nueva" de una norma ya cargada. */
function CargaChecklist({ protocoloFijo }: { protocoloFijo?: { codigo: string; nombre: string } }) {
  const { catalogos, recargarCatalogos } = useSesionActiva()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [protocolo, setProtocolo] = useState(protocoloFijo?.codigo ?? '')
  const [resultado, setResultado] = useState<ResultadoChecklist | null>(null)
  const vista = useAccion()
  const confirmacion = useAccion()
  const { avisar, nodo } = useAviso()

  const datos = (confirmar: boolean, codigo: string) => {
    const f = formulario(archivo as File, confirmar)
    if (codigo) f.append('protocolo', codigo)
    return f
  }

  const previsualizar = async (codigo = protocolo) => {
    if (!archivo) return
    await vista.ejecutar(async () => {
      const r = await api.post<ResultadoChecklist>('/importaciones/checklist', datos(false, protocoloFijo?.codigo ?? codigo))
      setResultado(r)
      setProtocolo(protocoloFijo?.codigo ?? r.protocolo ?? '')
    })
  }

  const confirmar = async () => {
    if (!archivo) return
    const ok = await confirmacion.ejecutar(async () => {
      setResultado(await api.post<ResultadoChecklist>('/importaciones/checklist', datos(true, protocolo)))
      await recargarCatalogos()
    })
    if (ok) avisar(protocoloFijo ? 'Versión nueva cargada; la anterior se conserva' : 'Checklist importado')
  }

  const comparacion = resultado?.comparacion
  const distinta = !!protocoloFijo && !!resultado?.protocolo_sugerido && resultado.protocolo_sugerido !== protocoloFijo.codigo

  return (
    <div className="space-y-3">
      <Campo
        etiqueta="Planilla (.xlsx)"
        ayuda={protocoloFijo
          ? `Checklist oficial de ${protocoloFijo.nombre} en su versión más nueva.`
          : 'GLOBALG.A.P. IFA y sus add-on (GROW, Nurture), GRASP y PrimusGFS (un módulo por archivo).'}
      >
        <SelectorPlanilla
          onCambio={(f) => {
            setArchivo(f)
            setResultado(null)
            if (!protocoloFijo) setProtocolo('')
          }}
        />
      </Campo>
      <Boton
        icono={<FileSpreadsheet className="h-4 w-4" />}
        disabled={!archivo}
        ocupado={vista.ocupado}
        onClick={() => void previsualizar('')}
        className="w-full sm:w-auto"
      >
        Ver vista previa
      </Boton>
      <MensajeError error={vista.error} />

      {resultado && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          {protocoloFijo ? (
            distinta && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                El archivo parece ser de otra norma ({resultado.protocolo_sugerido}). Revisa que sea el checklist de {protocoloFijo.nombre}.
              </p>
            )
          ) : (
            <Campo
              etiqueta="Protocolo"
              ayuda={resultado.protocolo_sugerido ? 'Detectado por la aplicación; cámbialo si no corresponde.' : 'No se pudo detectar: elígelo.'}
            >
              <Selector
                className={claseEntrada}
                value={protocolo}
                disabled={resultado.confirmado}
                onChange={(e) => {
                  setProtocolo(e.target.value)
                  void previsualizar(e.target.value)
                }}
              >
                <option value="">Elige el protocolo</option>
                {catalogos.protocolos.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
              </Selector>
            </Campo>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <Dato etiqueta="Formato" valor={resultado.formato} />
            <Dato etiqueta="Versión" valor={resultado.version} />
            <Dato etiqueta="Puntos de control" valor={resultado.puntos} />
            <Dato etiqueta="Secciones" valor={resultado.secciones.length} />
          </dl>
          {Object.keys(resultado.niveles).some((n) => n !== 'sin_nivel') && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(resultado.niveles).map(([nivel, cantidad]) => (
                <Insignia key={nivel} tono={nivel === 'mayor' ? 'rojo' : nivel === 'menor' ? 'amarillo' : 'gris'}>
                  {ETIQUETA_NIVEL[nivel] ?? (nivel === 'sin_nivel' ? 'Sin nivel' : nivel)}: {cantidad}
                </Insignia>
              ))}
            </div>
          )}

          {resultado.version_existente && (
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">
              La versión {resultado.version} ya está cargada ({resultado.version_existente.requisitos} puntos).{' '}
              {resultado.version_existente.faltantes
                ? `Se agregarán ${resultado.version_existente.faltantes} puntos que faltan (por ejemplo, otro módulo).`
                : 'Este archivo no trae puntos nuevos: no hay nada que actualizar.'}
            </p>
          )}
          {comparacion && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Versión nueva: cambios respecto de {comparacion.version}</p>
              <ul className="mt-1 space-y-0.5">
                <CambioVersion etiqueta="Puntos nuevos" codigos={comparacion.agregados} />
                <CambioVersion etiqueta="Puntos que ya no están" codigos={comparacion.quitados} />
                <CambioVersion etiqueta="Puntos con texto modificado" codigos={comparacion.cambiados} />
              </ul>
              <p className="mt-1 text-xs">
                Al confirmar, esta pasa a ser la versión vigente. {comparacion.version} <strong>se conserva</strong> y se puede seguir eligiendo al planificar una auditoría.
              </p>
            </div>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-slate-700">Ver secciones y primeros puntos leídos</summary>
            <ul className="mt-2 space-y-0.5 text-slate-700">
              {resultado.secciones.map((s) => (
                <li key={s.codigo}><span className="font-medium">{s.codigo}</span> {s.titulo}</li>
              ))}
            </ul>
            <ul className="mt-2 space-y-2">
              {resultado.muestra.map((p) => (
                <li key={p.codigo} className="rounded border border-slate-100 bg-slate-50 p-2">
                  <span className="font-medium">{p.codigo}</span>{' '}
                  <span className="whitespace-pre-line text-slate-600">{p.texto}</span>
                </li>
              ))}
            </ul>
          </details>

          <ListaAdvertencias titulo="Advertencias (revisar)" lista={resultado.advertencias} tono="ambar" />
          {resultado.confirmado ? (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> Importado: {resultado.nuevos} puntos nuevos en {resultado.protocolo_nombre} {resultado.version}.
            </p>
          ) : (
            <Boton ocupado={confirmacion.ocupado} disabled={!protocolo} onClick={() => void confirmar()} className="w-full sm:w-auto">
              {protocoloFijo ? 'Guardar como versión nueva' : 'Confirmar importación'}
            </Boton>
          )}
          <MensajeError error={confirmacion.error} />
        </div>
      )}
      {nodo}
    </div>
  )
}

function ImportarChecklist() {
  return (
    <Tarjeta titulo="Checklist de normas">
      <p className="mb-3 text-sm text-slate-600">
        Sube el checklist oficial de una norma. La aplicación reconoce la norma y sus puntos de control. Para actualizar una
        norma ya cargada, usa <strong>Subir versión nueva</strong> en la tabla de abajo.
      </p>
      <CargaChecklist />
    </Tarjeta>
  )
}

/** Versiones de cada norma: la vigente y las anteriores (nunca se borran ni se sobrescriben). */
function VersionesCargadas() {
  const { catalogos } = useSesionActiva()
  const [verVersion, setVerVersion] = useState<number | null>(null)
  const [actualizar, setActualizar] = useState<{ codigo: string; nombre: string } | null>(null)
  const cargados = catalogos.protocolos.filter((p) => p.versiones.length > 0)

  return (
    <Tarjeta titulo="Versiones cargadas">
      <p className="mb-4 text-sm text-slate-600">
        Cada norma conserva todas sus versiones. La <strong>vigente</strong> es la que se propone al planificar una auditoría,
        pero Loreto puede elegir cualquiera. Toca una versión para ver sus puntos.
      </p>
      {!cargados.length ? (
        <Vacio>Todavía no hay checklist cargados.</Vacio>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {cargados.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
              <div className="min-w-0 lg:w-64">
                <p className="font-semibold text-slate-900">{p.nombre}</p>
                <p className="text-xs text-slate-500">{p.versiones.length} {p.versiones.length === 1 ? 'versión' : 'versiones'}</p>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                {p.versiones.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVerVersion(v.id)}
                    title={v.archivo ?? undefined}
                    className={`group inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-left text-sm transition-colors ${
                      v.vigente ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-semibold">{v.nombre}</span>
                    <span className="text-xs opacity-80">
                      {v.vigente ? 'Vigente' : 'Anterior'} · {v.requisitos} puntos{v.cargada_en ? ` · ${fecha(v.cargada_en)}` : ''}
                    </span>
                    <Eye className="h-4 w-4 opacity-60 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
              <Boton variante="secundario" icono={<Upload className="h-4 w-4" />} onClick={() => setActualizar({ codigo: p.codigo, nombre: p.nombre })}>
                Subir versión nueva
              </Boton>
            </li>
          ))}
        </ul>
      )}
      {verVersion !== null && <VerVersionNorma versionId={verVersion} onCerrar={() => setVerVersion(null)} />}
      {actualizar && (
        <Modal abierto titulo={`Versión nueva de ${actualizar.nombre}`} onCerrar={() => setActualizar(null)} ancho="max-w-3xl">
          <p className="mb-4 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">
            La versión actual <strong>no se sobrescribe</strong>: queda guardada y se puede seguir usando en las auditorías.
          </p>
          <CargaChecklist protocoloFijo={actualizar} />
        </Modal>
      )}
    </Tarjeta>
  )
}

function CambioVersion({ etiqueta, codigos }: { etiqueta: string; codigos: string[] }) {
  return (
    <li>
      {etiqueta}: <strong>{codigos.length}</strong>
      {codigos.length > 0 && <span className="text-xs"> ({codigos.slice(0, 12).join(', ')}{codigos.length > 12 ? '…' : ''})</span>}
    </li>
  )
}
