import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BadgeCheck, Building2, CheckCircle2, Download, Factory, FileSpreadsheet, FolderArchive, History, Loader2, Plus, ScanText,
  Search, Sprout, Upload,
} from 'lucide-react'
import { abrirUrlFirmada, api, descargarArchivo, subirArchivo } from '../api'
import { useAccion, useDatos } from '../hooks'
import { fecha, fechaYHora } from '../formato'
import type { AnalisisDocumento, Documento, FichaCertificado, PropuestaCertificado, SeccionDoc } from '../tipos'
import { useSesionActiva } from '../contexto/Sesion'
import {
  Boton, Campo, CampoArchivo, Cargando, EncabezadoPagina, Insignia, MensajeError, Modal, Pestanas, Vacio, claseEntrada,
  useAviso,
} from '../componentes/ui'
import { Selector } from '../componentes/Desplegable'

export const SECCIONES: Record<SeccionDoc, { etiqueta: string; corta: string }> = {
  empresarial: { etiqueta: 'Empresarial (OC)', corta: 'Empresarial' },
  campo: { etiqueta: 'Campo', corta: 'Campo' },
  planta: { etiqueta: 'Planta', corta: 'Planta' },
}
const ICONO_SECCION: Record<SeccionDoc, typeof Building2> = { empresarial: Building2, campo: Sprout, planta: Factory }

const REGLA =
  'Los documentos fijos los sube certificaciones y no requieren aprobación: cada archivo nuevo pasa a ser la versión vigente y los anteriores quedan en el historial.'

/** Certificados: fecha de vencimiento de la versión vigente, en rojo si venció. */
function VenceDoc({ doc }: { doc: Documento }) {
  const v = doc.vigente
  if (!v?.fecha_vencimiento) return null
  const dias = v.dias_para_vencer ?? 0
  return (
    <span className={`mt-1 block text-xs ${dias < 0 ? 'font-semibold text-red-700' : dias <= 30 ? 'text-amber-700' : 'text-slate-500'}`}>
      {dias < 0 ? 'Venció' : 'Vence'} {fecha(v.fecha_vencimiento)}
    </span>
  )
}

function textoVersion(d: Documento): string {
  if (!d.vigente) return '—'
  return d.vigente.version_texto ? `v${d.vigente.version_texto}` : `v${d.vigente.numero}`
}

export function Documentos({ embebido = false }: { embebido?: boolean }) {
  const { catalogos, filtros, esCertificaciones } = useSesionActiva()
  const [parametros, setParametros] = useSearchParams()
  const [seccion, setSeccion] = useState<'' | SeccionDoc>('')
  const [categoriaId, setCategoriaId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [nuevoAbierto, setNuevoAbierto] = useState(false)
  const [carpetaAbierta, setCarpetaAbierta] = useState(false)
  const { avisar, nodo: nodoAviso } = useAviso()
  const exportar = useAccion()

  const { datos, cargando, error, recargar } = useDatos<Documento[]>('/documentos', {
    empresa_id: filtros.empresa_id,
    unidad_id: filtros.unidad_id,
    seccion: seccion || undefined,
    categoria_id: categoriaId || undefined,
    q: busqueda.trim() || undefined,
  })

  const docAbierto = Number(parametros.get('doc')) || null
  const abrirDetalle = (id: number) =>
    setParametros((p) => { const n = new URLSearchParams(p); n.set('doc', String(id)); return n })
  const cerrarDetalle = () =>
    setParametros((p) => { const n = new URLSearchParams(p); n.delete('doc'); return n })

  const acciones = (
    <>
      <Boton
        variante="secundario"
        icono={<FileSpreadsheet className="h-4 w-4" />}
        ocupado={exportar.ocupado}
        onClick={() => exportar.ejecutar(() => descargarArchivo('/documentos/exportar', { ...filtros }, 'documentos-fijos.xlsx'))}
      >
        Exportar listado Excel
      </Boton>
      <Boton variante="secundario" icono={<FolderArchive className="h-4 w-4" />} onClick={() => setCarpetaAbierta(true)}>
        Carpeta para el auditor
      </Boton>
      {esCertificaciones && (
        <Boton icono={<Plus className="h-4 w-4" />} onClick={() => setNuevoAbierto(true)}>
          Nuevo documento fijo
        </Boton>
      )}
    </>
  )

  return (
    <div>
      {embebido ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-sm text-slate-600">{REGLA}</p>
          <div className="flex flex-wrap gap-2">{acciones}</div>
        </div>
      ) : (
        <EncabezadoPagina titulo="Documentos fijos" descripcion={REGLA} acciones={acciones} />
      )}
      <MensajeError error={exportar.error} />

      <Pestanas
        opciones={[
          { valor: '' as const, etiqueta: 'Todas las secciones' },
          ...(Object.keys(SECCIONES) as SeccionDoc[]).map((s) => ({ valor: s, etiqueta: SECCIONES[s].etiqueta })),
        ]}
        valor={seccion}
        onCambio={setSeccion}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo etiqueta="Categoría">
          <Selector className={claseEntrada} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">Todas</option>
            {catalogos.categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Buscar">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input
              className={`${claseEntrada} pl-9`}
              placeholder="Título o código"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </Campo>
      </div>

      <MensajeError error={error} onReintentar={recargar} />
      {cargando && !datos ? (
        <Cargando variante="tabla" />
      ) : !datos?.length ? (
        <Vacio>No hay documentos fijos con estos filtros.</Vacio>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {datos.map((d) => {
              const Icono = ICONO_SECCION[d.seccion]
              return (
                <button
                  key={d.id}
                  onClick={() => abrirDetalle(d.id)}
                  className="block w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:bg-slate-50"
                >
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Icono className="h-3.5 w-3.5" /> {SECCIONES[d.seccion].corta} · {d.categoria.nombre}
                  </div>
                  <div className="mt-1 font-semibold text-slate-900">{d.titulo}</div>
                  {d.codigo && <div className="mt-0.5 font-mono text-xs text-slate-600">{d.codigo}</div>}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <Insignia tono="verde">{textoVersion(d)}</Insignia>
                    <VenceDoc doc={d} />
                    {d.vigente && <span>Subido el {fecha(d.vigente.subido_en)}</span>}
                    {d.versiones_total > 1 && <span>· {d.versiones_total} versiones</span>}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Código</th>
                  <th className="px-4 py-2.5">Título</th>
                  <th className="px-4 py-2.5">Categoría</th>
                  {!seccion && <th className="px-4 py-2.5">Sección</th>}
                  <th className="px-4 py-2.5">Vigente</th>
                  <th className="px-4 py-2.5">Última carga</th>
                  <th className="px-4 py-2.5 text-right">Historial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {datos.map((d) => (
                  <tr key={d.id} onClick={() => abrirDetalle(d.id)} className="cursor-pointer align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{d.codigo ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{d.titulo}</td>
                    <td className="px-4 py-3 text-slate-600">{d.categoria.nombre}</td>
                    {!seccion && <td className="px-4 py-3 text-slate-600">{SECCIONES[d.seccion].corta}</td>}
                    <td className="px-4 py-3">
                      <Insignia tono="verde">{textoVersion(d)}</Insignia>
                      <VenceDoc doc={d} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {d.vigente ? (
                        <>
                          <div>{fecha(d.vigente.subido_en)}</div>
                          <div className="text-xs text-slate-500">{d.vigente.subido_por}</div>
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {d.versiones_total} {d.versiones_total === 1 ? 'versión' : 'versiones'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {docAbierto && (
        <DetalleDocumento
          id={docAbierto}
          onCerrar={cerrarDetalle}
          onCambio={(msg) => { avisar(msg); void recargar() }}
          puedeSubir={esCertificaciones}
        />
      )}
      {nuevoAbierto && (
        <NuevoDocumento
          seccionInicial={seccion || 'empresarial'}
          onCerrar={() => setNuevoAbierto(false)}
          onCreado={(doc, mensaje) => { setNuevoAbierto(false); avisar(mensaje); void recargar(); abrirDetalle(doc.id) }}
        />
      )}
      {carpetaAbierta && <CarpetaAuditor onCerrar={() => setCarpetaAbierta(false)} />}
      {nodoAviso}
    </div>
  )
}

// ---------- Detalle e historial ----------

function DetalleDocumento({ id, onCerrar, onCambio, puedeSubir }: {
  id: number
  onCerrar: () => void
  onCambio: (mensaje: string) => void
  puedeSubir: boolean
}) {
  const { catalogos } = useSesionActiva()
  const { datos: doc, cargando, error, recargar, setDatos } = useDatos<Documento>(`/documentos/${id}`)
  const accion = useAccion()
  const [nuevaVersion, setNuevaVersion] = useState(false)
  const descargar = (vid: number) => accion.ejecutar(() => abrirUrlFirmada(`/documentos/versiones/${vid}/descarga`))
  const empresa = catalogos.empresas.find((e) => e.id === doc?.empresa_id)

  return (
    <Modal abierto titulo={doc?.titulo ?? 'Documento fijo'} onCerrar={onCerrar} ancho="max-w-3xl">
      <MensajeError error={error} onReintentar={recargar} />
      {cargando && !doc ? (
        <Cargando variante="lista" />
      ) : doc ? (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-slate-500">Sección</dt><dd className="font-medium">{SECCIONES[doc.seccion].etiqueta}</dd></div>
            <div><dt className="text-xs text-slate-500">Categoría</dt><dd>{doc.categoria.nombre}</dd></div>
            <div><dt className="text-xs text-slate-500">Código</dt><dd className="font-mono">{doc.codigo ?? '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">Empresa</dt><dd>{empresa?.nombre ?? '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">Versión vigente</dt><dd>{textoVersion(doc)}</dd></div>
          </dl>

          {doc.vigente?.certificado && <FichaVigente ficha={doc.vigente.certificado} />}

          <MensajeError error={accion.error} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <History className="h-4 w-4 text-slate-500" /> Historial de versiones
            </h3>
            {puedeSubir && (
              <Boton icono={<Upload className="h-4 w-4" />} onClick={() => setNuevaVersion(true)}>Subir nueva versión</Boton>
            )}
          </div>

          <ol className="space-y-3">
            {(doc.versiones ?? []).map((v) => {
              const esVigente = doc.vigente?.id === v.id
              return (
                <li key={v.id} className={`rounded-xl border p-3 ${esVigente ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">Versión {v.numero}{v.version_texto ? ` (${v.version_texto})` : ''}</span>
                      {esVigente ? <Insignia tono="verde">Vigente</Insignia> : <Insignia>Anterior</Insignia>}
                    </div>
                    {v.nombre_archivo && (
                      <Boton variante="secundario" icono={<Download className="h-4 w-4" />} onClick={() => descargar(v.id)}>
                        Descargar
                      </Boton>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-slate-600 sm:grid-cols-2">
                    <span>Subido por {v.subido_por} el {fechaYHora(v.subido_en)}</span>
                    <span>Emisión: {fecha(v.fecha_emision)}{v.fecha_vencimiento ? ` · vence ${fecha(v.fecha_vencimiento)}` : ''}</span>
                    {v.certificado && (
                      <span className="sm:col-span-2">
                        {v.certificado.protocolo.nombre}{v.certificado.norma_version ? ` ${v.certificado.norma_version}` : ''}
                        {v.certificado.numero ? ` · N° ${v.certificado.numero}` : ''}
                        {v.certificado.vigente_desde ? ` · vigente desde ${fecha(v.certificado.vigente_desde)}` : ''}
                      </span>
                    )}
                    {v.nombre_archivo && <span className="truncate sm:col-span-2" title={v.nombre_archivo}>Archivo: {v.nombre_archivo}</span>}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      ) : null}

      {nuevaVersion && doc && (
        <NuevaVersion
          doc={doc}
          onCerrar={() => setNuevaVersion(false)}
          onCreada={(r) => {
            setDatos(r)
            setNuevaVersion(false)
            onCambio('Nueva versión guardada; la anterior quedó en el historial')
          }}
        />
      )}
    </Modal>
  )
}

/** Ficha del certificado vigente: qué norma, qué número, desde cuándo y qué sucursales cubre. */
function FichaVigente({ ficha }: { ficha: FichaCertificado }) {
  const datos: [string, string | null][] = [
    ['Norma', `${ficha.protocolo.nombre}${ficha.norma_version ? ` · ${ficha.norma_version}` : ''}`],
    ['N° de certificado', ficha.numero],
    ['Organismo certificador', ficha.entidad_certificadora],
    ['Vigencia', ficha.vigente_desde ? `${fecha(ficha.vigente_desde)} al ${fecha(ficha.vigente_hasta)}` : `Hasta ${fecha(ficha.vigente_hasta)}`],
    ['Fecha de auditoría', ficha.fecha_auditoria ? fecha(ficha.fecha_auditoria) : null],
    ['Resultado', ficha.resultado],
  ]
  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <BadgeCheck className="h-4 w-4 text-emerald-700" /> Ficha del certificado vigente
      </h3>
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
        {datos.filter(([, valor]) => valor).map(([etiqueta, valor]) => (
          <div key={etiqueta} className="min-w-0">
            <dt className="text-xs text-slate-500">{etiqueta}</dt>
            <dd className="break-words font-medium text-slate-800">{valor}</dd>
          </div>
        ))}
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-500">Sucursales cubiertas</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {ficha.unidades.length
              ? ficha.unidades.map((u) => <Insignia key={u.id} tono="verde">{u.nombre}</Insignia>)
              : <span className="text-slate-600">Sin sucursales indicadas</span>}
          </dd>
        </div>
        {ficha.productos.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-slate-500">Productos</dt>
            <dd className="text-slate-800">{ficha.productos.join(', ')}</dd>
          </div>
        )}
      </dl>
    </section>
  )
}

// ---------- Datos de versión (compartido entre nuevo documento y nueva versión) ----------

interface DatosVersion {
  version_texto: string
  fecha_emision: string
  fecha_vencimiento: string
  archivo: File | null
  /** Archivo ya subido al revisarlo, para no subirlo dos veces al guardar */
  subido: { archivo: File; clave: string; nombre: string; tipo: string } | null
  /** Ficha leída del certificado, aceptada por certificaciones (no se escribe a mano) */
  certificado: PropuestaCertificado | null
}

const VERSION_VACIA: DatosVersion = {
  version_texto: '', fecha_emision: '', fecha_vencimiento: '', archivo: null, subido: null, certificado: null,
}

async function subirUnaVez(v: DatosVersion) {
  if (!v.archivo) throw new Error('Adjunta el archivo o toma una foto')
  if (v.subido?.archivo === v.archivo) return v.subido
  return { archivo: v.archivo, ...(await subirArchivo(v.archivo, 'documentos')) }
}

/** Datos reconocidos, en corto, para mostrarlos en la pregunta. */
function datosReconocidos(a: AnalisisDocumento): string[] {
  const p = a.propuesta
  const c = p?.certificado
  return [
    c?.numero && `N° ${c.numero}`,
    c?.norma_version && `Norma ${c.norma_version}`,
    p?.codigo && `Código ${p.codigo}`,
    c?.vigente_desde && `Desde ${fecha(c.vigente_desde)}`,
    p?.fecha_vencimiento && `Vence ${fecha(p.fecha_vencimiento)}`,
    c && `${c.unidad_ids.length} ${c.unidad_ids.length === 1 ? 'sucursal' : 'sucursales'}`,
  ].filter((x): x is string => !!x)
}

function Pregunta({ titulo, datos = [], texto, aviso, si, no, onSi, onNo }: {
  titulo: string
  datos?: string[]
  texto: string
  aviso?: string | null
  si: string
  no: string
  onSi: () => void
  onNo: () => void
}) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4" role="group" aria-label={titulo}>
      <p className="flex items-start gap-2 font-semibold text-slate-900">
        <ScanText className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" /> {titulo}
      </p>
      {datos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {datos.map((d) => <Insignia key={d}>{d}</Insignia>)}
        </div>
      )}
      {aviso && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{aviso}</p>}
      <p className="mt-2 text-sm text-slate-700">{texto}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Boton type="button" onClick={onSi}>{si}</Boton>
        <Boton type="button" variante="secundario" onClick={onNo}>{no}</Boton>
      </div>
    </div>
  )
}

type Paso = 'revisando' | 'parecido' | 'como_version' | 'rellenar' | 'rellenado' | 'manual' | 'sin_datos'

/** Primer paso: se sube el archivo y la aplicación lo interpreta. Si lo reconoce, pregunta antes de rellenar. */
function ArchivoConLectura({ valor, onCambio, onRellenar, docActual, onVersionDe, onReiniciar }: {
  valor: DatosVersion
  onCambio: Dispatch<SetStateAction<DatosVersion>>
  onRellenar: (a: AnalisisDocumento) => void
  /** Nueva versión: el documento al que se sube el archivo */
  docActual?: Documento
  /** Nuevo documento: el archivo pasa a ser versión nueva del documento al que se parece (se revisa antes de guardar) */
  onVersionDe?: (a: AnalisisDocumento) => void
  /** Se eligió otro archivo o se descartó la versión nueva: el formulario vuelve a documento nuevo */
  onReiniciar?: () => void
}) {
  const [analisis, setAnalisis] = useState<AnalisisDocumento | null>(null)
  const [paso, setPaso] = useState<Paso | null>(null)
  const [error, setError] = useState<string | null>(null)

  const elegir = async (archivo: File | null) => {
    const base: DatosVersion = { ...valor, archivo, subido: null, certificado: null }
    onCambio(base)
    onReiniciar?.()
    setAnalisis(null)
    setPaso(null)
    setError(null)
    if (!archivo || !/\.(pdf|docx)$/i.test(archivo.name)) return
    setPaso('revisando')
    try {
      const subido = await subirUnaVez(base)
      const a = await api.post<AnalisisDocumento>('/documentos/analizar', {
        archivo_key: subido.clave,
        nombre_archivo: subido.nombre,
      })
      onCambio((v) => (v.archivo === archivo ? { ...v, subido } : v))
      setAnalisis(a)
      setPaso(!a.propuesta ? 'sin_datos' : a.parecido && onVersionDe ? 'parecido' : 'rellenar')
    } catch (e) {
      setPaso(null)
      setError(e instanceof Error ? e.message : 'No se pudo revisar el documento')
    }
  }

  const datos = analisis ? datosReconocidos(analisis) : []
  const otroDocumento = docActual && analisis?.parecido && analisis.parecido.id !== docActual.id
    ? `Ojo: este archivo se parece a «${analisis.parecido.titulo}», no a este documento.`
    : null

  return (
    <div className="space-y-3">
      <Campo etiqueta="Archivo (PDF, Word o foto)" ayuda="Súbelo primero: si la aplicación reconoce el documento, te ofrece rellenar los campos.">
        <CampoArchivo archivo={valor.archivo} onCambio={(f) => void elegir(f)} />
      </Campo>
      <MensajeError error={error} />
      {paso === 'revisando' && (
        <p className="flex items-center gap-2 text-sm text-slate-600" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" /> Revisando el documento…
        </p>
      )}
      {paso === 'parecido' && analisis?.parecido && (
        <Pregunta
          titulo={`Este documento se parece a «${analisis.parecido.titulo}»`}
          datos={datos}
          texto={`Ya está cargado (${analisis.parecido.motivo}). ¿Quieres subirlo como versión nueva de ese documento? La versión actual queda en el historial.`}
          si="Sí, como versión nueva"
          no="No, es otro documento"
          onSi={() => { onVersionDe?.(analisis); setPaso('como_version') }}
          onNo={() => setPaso('rellenar')}
        />
      )}
      {paso === 'como_version' && analisis?.parecido && (
        <div className="flex flex-col gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 sm:flex-row sm:items-center sm:justify-between" aria-live="polite">
          <p className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Se guardará como <strong>versión nueva</strong> de «{analisis.parecido.titulo}». Rellené los datos de la versión:
              revísalos y cámbialos si hace falta antes de guardar.
            </span>
          </p>
          <button
            type="button"
            onClick={() => { onReiniciar?.(); setPaso('rellenar') }}
            className="min-h-10 shrink-0 rounded-lg px-2 text-left font-semibold text-emerald-800 underline-offset-2 hover:underline"
          >
            No, es otro documento
          </button>
        </div>
      )}
      {paso === 'rellenar' && analisis && (
        <Pregunta
          titulo={`Este documento parece ser ${analisis.descripcion}`}
          datos={datos}
          aviso={otroDocumento}
          texto="¿Quieres rellenar los campos con estos datos? Podrás revisarlos antes de guardar."
          si="Sí, rellenar"
          no="No, los completo yo"
          onSi={() => { onRellenar(analisis); setPaso('rellenado') }}
          onNo={() => setPaso('manual')}
        />
      )}
      {paso === 'rellenado' && (
        <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900" aria-live="polite">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Campos rellenados con los datos del documento. Revísalos antes de guardar.
            {valor.certificado && ' La ficha del certificado se guarda junto con el archivo.'}
          </span>
        </p>
      )}
      {paso === 'sin_datos' && analisis && (
        <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
          {analisis.texto_leido
            ? 'No se reconoció el documento: completa los campos.'
            : 'El archivo no tiene texto (parece escaneado): completa los campos.'}
        </p>
      )}
    </div>
  )
}

function CamposVersion({ valor, onCambio, conVencimiento = false }: {
  valor: DatosVersion
  onCambio: Dispatch<SetStateAction<DatosVersion>>
  /** Certificados: la fecha de vencimiento es obligatoria y alimenta el panel de Vencimientos */
  conVencimiento?: boolean
}) {
  return (
    <div className={`grid grid-cols-1 gap-3 ${conVencimiento ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      <Campo etiqueta="Versión del documento">
        <input className={claseEntrada} maxLength={20} value={valor.version_texto} placeholder="Ej.: 03"
          onChange={(e) => onCambio({ ...valor, version_texto: e.target.value })} />
      </Campo>
      <Campo etiqueta="Fecha de emisión">
        <input type="date" className={claseEntrada} value={valor.fecha_emision}
          onChange={(e) => onCambio({ ...valor, fecha_emision: e.target.value })} />
      </Campo>
      {conVencimiento && (
        <Campo etiqueta="Fecha de vencimiento" ayuda="Aparece en Vencimientos.">
          <input type="date" required className={claseEntrada} value={valor.fecha_vencimiento}
            onChange={(e) => onCambio({ ...valor, fecha_vencimiento: e.target.value })} />
        </Campo>
      )}
    </div>
  )
}

/** Fechas y ficha propuestas por el análisis, sobre la versión en curso. */
function conPropuesta(v: DatosVersion, a: AnalisisDocumento): DatosVersion {
  const p = a.propuesta
  if (!p) return v
  return {
    ...v,
    fecha_emision: p.fecha_emision ?? v.fecha_emision,
    fecha_vencimiento: p.fecha_vencimiento ?? v.fecha_vencimiento,
    certificado: p.certificado,
  }
}

async function armarVersion(v: DatosVersion, conFicha = false) {
  const subido = await subirUnaVez(v)
  const c = v.certificado
  return {
    archivo_key: subido.clave,
    nombre_archivo: subido.nombre,
    tipo_contenido: subido.tipo,
    version_texto: v.version_texto.trim() || null,
    fecha_emision: v.fecha_emision || null,
    fecha_vencimiento: v.fecha_vencimiento || null,
    certificado: conFicha && c
      ? {
          protocolo_id: c.protocolo_id,
          numero: c.numero,
          norma_version: c.norma_version,
          entidad_certificadora: c.entidad_certificadora,
          vigente_desde: c.vigente_desde,
          fecha_auditoria: c.fecha_auditoria,
          resultado: c.resultado,
          unidad_ids: c.unidad_ids,
          productos: c.productos,
        }
      : null,
  }
}

function NuevaVersion({ doc, onCerrar, onCreada }: {
  doc: Documento
  onCerrar: () => void
  onCreada: (d: Documento) => void
}) {
  const { catalogos } = useSesionActiva()
  const [version, setVersion] = useState<DatosVersion>(VERSION_VACIA)
  const accion = useAccion()
  const conVencimiento = !!catalogos.categorias.find((c) => c.id === doc.categoria.id)?.requiere_vencimiento

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    const r: { doc?: Documento } = {}
    const ok = await accion.ejecutar(async () => {
      r.doc = await api.post<Documento>(`/documentos/${doc.id}/versiones`, await armarVersion(version, conVencimiento))
    })
    if (ok && r.doc) onCreada(r.doc)
  }

  return (
    <Modal abierto titulo={`Nueva versión: ${doc.titulo}`} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-4">
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          La nueva versión pasa a ser la vigente. La versión {textoVersion(doc)} queda guardada en el historial.
        </p>
        <ArchivoConLectura
          valor={version}
          onCambio={setVersion}
          docActual={doc}
          onRellenar={(a) => setVersion((v) => conPropuesta(v, a))}
        />
        <CamposVersion valor={version} onCambio={setVersion} conVencimiento={conVencimiento} />
        <MensajeError error={accion.error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton type="button" variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" ocupado={accion.ocupado} icono={<Upload className="h-4 w-4" />}>Subir versión</Boton>
        </div>
      </form>
    </Modal>
  )
}

// ---------- Nuevo documento fijo (solo certificaciones) ----------

function NuevoDocumento({ seccionInicial, onCerrar, onCreado }: {
  seccionInicial: SeccionDoc
  onCerrar: () => void
  onCreado: (d: Documento, mensaje: string) => void
}) {
  const { catalogos, filtros } = useSesionActiva()
  const [empresaId, setEmpresaId] = useState<number | undefined>(
    filtros.empresa_id ?? catalogos.unidades.find((u) => u.id === filtros.unidad_id)?.empresa_id ?? catalogos.empresas[0]?.id,
  )
  const [seccion, setSeccion] = useState<SeccionDoc>(seccionInicial)
  const [categoriaId, setCategoriaId] = useState<number | undefined>()
  const [titulo, setTitulo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [version, setVersion] = useState<DatosVersion>(VERSION_VACIA)
  /** Documento ya cargado al que se agrega el archivo como versión nueva (null = documento nuevo) */
  const [destino, setDestino] = useState<AnalisisDocumento['parecido']>(null)
  const accion = useAccion()
  const categoria = catalogos.categorias.find((c) => c.id === categoriaId)

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (destino) {
      const r: { doc?: Documento } = {}
      const ok = await accion.ejecutar(async () => {
        r.doc = await api.post<Documento>(`/documentos/${destino.id}/versiones`, await armarVersion(version, destino.requiere_vencimiento))
      })
      if (ok && r.doc) onCreado(r.doc, 'Versión nueva guardada; la anterior quedó en el historial')
      return
    }
    if (!empresaId) return accion.setError('Elige la empresa')
    if (!categoria) return accion.setError('Elige la categoría')
    const r: { doc?: Documento } = {}
    const ok = await accion.ejecutar(async () => {
      r.doc = await api.post<Documento>('/documentos', {
        categoria_id: categoria.id,
        empresa_id: empresaId,
        seccion,
        titulo: titulo.trim(),
        codigo: codigo.trim() || null,
        version: await armarVersion(version, !!categoria.requiere_vencimiento),
      })
    })
    if (ok && r.doc) onCreado(r.doc, 'Documento guardado')
  }

  const rellenar = (a: AnalisisDocumento) => {
    const p = a.propuesta
    if (!p) return
    if (p.categoria_id) setCategoriaId(p.categoria_id)
    if (p.empresa_id) setEmpresaId(p.empresa_id)
    if (p.seccion) setSeccion(p.seccion)
    if (p.titulo) setTitulo(p.titulo)
    if (p.codigo) setCodigo(p.codigo)
    setVersion((v) => conPropuesta(v, a))
  }

  // El archivo es una versión nueva de un documento que ya existe: se rellenan sus datos y se revisan antes de guardar
  const comoVersionDe = (a: AnalisisDocumento) => {
    setDestino(a.parecido)
    setVersion((v) => conPropuesta(v, a))
  }
  const reiniciar = () => {
    setDestino(null)
    setVersion((v) => ({ ...v, fecha_emision: '', fecha_vencimiento: '', certificado: null }))
  }

  return (
    <Modal abierto titulo={destino ? 'Versión nueva de un documento fijo' : 'Nuevo documento fijo'} onCerrar={onCerrar} ancho="max-w-3xl">
      <form onSubmit={guardar} className="space-y-4">
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Queda guardado de inmediato, sin aprobación. Los documentos fijos no van por sucursal: se ordenan por sección.
        </p>
        <ArchivoConLectura valor={version} onCambio={setVersion} onRellenar={rellenar} onVersionDe={comoVersionDe}
          onReiniciar={reiniciar} />
        {destino ? (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Documento</dt><dd className="font-semibold text-slate-900">{destino.titulo}</dd></div>
            {destino.codigo && <div><dt className="text-xs text-slate-500">Código</dt><dd className="font-mono">{destino.codigo}</dd></div>}
            {version.certificado && (
              <>
                <div><dt className="text-xs text-slate-500">Norma</dt><dd>{version.certificado.protocolo}{version.certificado.norma_version ? ` · ${version.certificado.norma_version}` : ''}</dd></div>
                {version.certificado.numero && <div><dt className="text-xs text-slate-500">N° de certificado</dt><dd>{version.certificado.numero}</dd></div>}
                {version.certificado.vigente_desde && <div><dt className="text-xs text-slate-500">Vigente desde</dt><dd>{fecha(version.certificado.vigente_desde)}</dd></div>}
              </>
            )}
          </dl>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo etiqueta="Sección">
              <Selector className={claseEntrada} value={seccion} onChange={(e) => setSeccion(e.target.value as SeccionDoc)}>
                {(Object.keys(SECCIONES) as SeccionDoc[]).map((s) => <option key={s} value={s}>{SECCIONES[s].etiqueta}</option>)}
              </Selector>
            </Campo>
            <Campo etiqueta="Empresa">
              <Selector className={claseEntrada} value={empresaId ?? ''} onChange={(e) => setEmpresaId(Number(e.target.value) || undefined)}>
                {catalogos.empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </Selector>
            </Campo>
            <Campo etiqueta="Categoría">
              <Selector className={claseEntrada} value={categoriaId ?? ''} required
                onChange={(e) => setCategoriaId(Number(e.target.value) || undefined)}>
                <option value="" disabled>Elige una categoría</option>
                {catalogos.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Selector>
            </Campo>
            <Campo etiqueta="Código" ayuda={seccion === 'empresarial' ? 'Ej.: P OC CE 29 (códigos OC, nivel empresarial)' : 'Opcional'}>
              <input className={`${claseEntrada} font-mono uppercase`} maxLength={40} value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </Campo>
            <Campo etiqueta="Título" className="sm:col-span-2">
              <input className={claseEntrada} required minLength={2} maxLength={250} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </Campo>
          </div>
        )}
        <CamposVersion valor={version} onCambio={setVersion}
          conVencimiento={destino ? destino.requiere_vencimiento : !!categoria?.requiere_vencimiento} />
        <MensajeError error={accion.error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton type="button" variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" ocupado={accion.ocupado} icono={<Upload className="h-4 w-4" />}>
            {destino ? 'Guardar versión nueva' : 'Guardar documento'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}

// ---------- Carpeta para el auditor ----------

function CarpetaAuditor({ onCerrar }: { onCerrar: () => void }) {
  const { catalogos, filtros, esCertificaciones } = useSesionActiva()
  const [protocoloId, setProtocoloId] = useState<number | undefined>(filtros.protocolo_id ?? catalogos.protocolos[0]?.id)
  const [empresaId, setEmpresaId] = useState<number | undefined>(
    filtros.empresa_id ?? catalogos.unidades.find((u) => u.id === filtros.unidad_id)?.empresa_id ?? catalogos.empresas[0]?.id,
  )
  const [unidadId, setUnidadId] = useState<number | undefined>(filtros.unidad_id)
  const [temporadaId, setTemporadaId] = useState<number | undefined>(
    filtros.temporada_id ?? catalogos.temporadas.find((t) => t.actual)?.id,
  )
  const accion = useAccion()
  const unidades = catalogos.unidades.filter((u) => u.empresa_id === empresaId)
  // El protocolo depende de la sucursal (o de las sucursales de la empresa si no se elige una)
  const protocolos = catalogos.protocolos.filter((p) =>
    unidadId ? p.unidades_aplica.includes(unidadId) : unidades.some((u) => p.unidades_aplica.includes(u.id)),
  )
  const protocoloValido = protocolos.some((p) => p.id === protocoloId)

  const generar = async (e: FormEvent) => {
    e.preventDefault()
    if (!protocoloId || !protocoloValido || !empresaId || !temporadaId) return accion.setError('Elige protocolo, empresa y temporada')
    if (!esCertificaciones && !unidadId) return accion.setError('Indica una de tus sucursales')
    await accion.ejecutar(() =>
      descargarArchivo('/carpeta-auditor', {
        protocolo_id: protocoloId,
        empresa_id: empresaId,
        unidad_id: unidadId,
        temporada_id: temporadaId,
      }, 'carpeta-auditor.zip'),
    )
  }

  return (
    <Modal abierto titulo="Carpeta para el auditor" onCerrar={onCerrar}>
      <form onSubmit={generar} className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Genera un ZIP con:
          <ul className="mt-1 list-disc pl-5">
            <li>los documentos aprobados (versión vigente), en carpetas por categoría;</li>
            <li>un índice Excel;</li>
            <li>los checklists de auditoría interna y las no conformidades.</li>
          </ul>
          Los nombres de archivo dentro del ZIP van sin tildes.
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo etiqueta="Empresa">
            <Selector className={claseEntrada} value={empresaId ?? ''} required onChange={(e) => { setEmpresaId(Number(e.target.value) || undefined); setUnidadId(undefined) }}>
              {catalogos.empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta={esCertificaciones ? 'Sucursal (opcional)' : 'Sucursal (obligatoria)'}>
            <Selector className={claseEntrada} value={unidadId ?? ''} required={!esCertificaciones} onChange={(e) => setUnidadId(Number(e.target.value) || undefined)}>
              <option value="">{esCertificaciones ? 'Todas las sucursales' : 'Elige una sucursal'}</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.tipo})</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta="Protocolo">
            <Selector className={claseEntrada} value={protocoloValido ? protocoloId : ''} required onChange={(e) => setProtocoloId(Number(e.target.value) || undefined)}>
              <option value="" disabled>Elige un protocolo</option>
              {protocolos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta="Temporada">
            <Selector className={claseEntrada} value={temporadaId ?? ''} required onChange={(e) => setTemporadaId(Number(e.target.value) || undefined)}>
              {catalogos.temporadas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </Selector>
          </Campo>
        </div>
        <MensajeError error={accion.error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton type="button" variante="secundario" onClick={onCerrar}>Cerrar</Boton>
          <Boton type="submit" ocupado={accion.ocupado} icono={<FolderArchive className="h-4 w-4" />}>Descargar ZIP</Boton>
        </div>
      </form>
    </Modal>
  )
}
