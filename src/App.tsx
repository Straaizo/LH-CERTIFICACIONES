import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './componentes/Layout'
import { useSesion } from './contexto/Sesion'
import { lazy, useEffect } from 'react'
import { Ingreso } from './paginas/Ingreso'
import { Inicio } from './paginas/Inicio'

// Cada pantalla es un archivo aparte: el celular solo descarga y ejecuta lo que muestra. El resto se precarga
// en segundo plano cuando el teléfono está libre (precargar), así al tocar una sección ya está lista.
const cargar = {
  Ambiente: () => import('./paginas/Ambiente'),
  AuditoriaDetalle: () => import('./paginas/AuditoriaDetalle'),
  AuditoriasExternas: () => import('./paginas/AuditoriasExternas'),
  Auditorias: () => import('./paginas/Auditorias'),
  Historial: () => import('./paginas/Historial'),
  Configuracion: () => import('./paginas/Configuracion'),
  Importar: () => import('./paginas/Importar'),
  Laboratorio: () => import('./paginas/Laboratorio'),
  LaboratorioResiduos: () => import('./paginas/LaboratorioResiduos'),
  NoConformidadDetalle: () => import('./paginas/NoConformidadDetalle'),
  NoConformidades: () => import('./paginas/NoConformidades'),
  RegistroDetalle: () => import('./paginas/RegistroDetalle'),
  Registros: () => import('./paginas/Registros'),
  Vencimientos: () => import('./paginas/Vencimientos'),
}
const Ambiente = lazy(() => cargar.Ambiente().then((m) => ({ default: m.Ambiente })))
const AuditoriaDetalle = lazy(() => cargar.AuditoriaDetalle().then((m) => ({ default: m.AuditoriaDetalle })))
const AuditoriasExternas = lazy(() => cargar.AuditoriasExternas().then((m) => ({ default: m.AuditoriasExternas })))
const AuditoriaExternaDetalle = lazy(() => cargar.AuditoriasExternas().then((m) => ({ default: m.AuditoriaExternaDetalle })))
const Auditorias = lazy(() => cargar.Auditorias().then((m) => ({ default: m.Auditorias })))
const Historial = lazy(() => cargar.Historial().then((m) => ({ default: m.Historial })))
const Configuracion = lazy(() => cargar.Configuracion().then((m) => ({ default: m.Configuracion })))
const Importar = lazy(() => cargar.Importar().then((m) => ({ default: m.Importar })))
const Laboratorio = lazy(() => cargar.Laboratorio().then((m) => ({ default: m.Laboratorio })))
const ResiduosDestinos = lazy(() => cargar.LaboratorioResiduos().then((m) => ({ default: m.ResiduosDestinos })))
const NoConformidadDetalle = lazy(() => cargar.NoConformidadDetalle().then((m) => ({ default: m.NoConformidadDetalle })))
const NoConformidades = lazy(() => cargar.NoConformidades().then((m) => ({ default: m.NoConformidades })))
const RegistroDetalle = lazy(() => cargar.RegistroDetalle().then((m) => ({ default: m.RegistroDetalle })))
const Registros = lazy(() => cargar.Registros().then((m) => ({ default: m.Registros })))
const Vencimientos = lazy(() => cargar.Vencimientos().then((m) => ({ default: m.Vencimientos })))

/** Precarga las demás pantallas cuando el navegador está desocupado (sin competir con lo que se ve). */
function precargar() {
  const libre = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 1500))
  const pendientes = Object.values(cargar)
  const siguiente = () => {
    const fn = pendientes.shift()
    if (fn) void fn().catch(() => undefined).finally(() => libre(siguiente))
  }
  libre(siguiente)
}
import { EsqueletoApp } from './componentes/Esqueletos'

export function App() {
  const { usuario, catalogos, cargando, esCertificaciones, veHistorial, puedeVer } = useSesion()
  const conSesion = !!usuario && !!catalogos
  useEffect(() => {
    if (conSesion) precargar()
  }, [conSesion])
  if (cargando) return <EsqueletoApp />
  if (!usuario || !catalogos) return <Ingreso />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        {(puedeVer('REGISTROS') || puedeVer('DOCUMENTOS')) && <Route path="registros" element={<Registros />} />}
        {puedeVer('REGISTROS') && <Route path="registros/r/:id" element={<RegistroDetalle />} />}
        {puedeVer('DOCUMENTOS') && <Route path="documentos" element={<RedireccionDocumentos />} />}
        {puedeVer('DOCUMENTOS') && <Route path="vencimientos" element={<Vencimientos />} />}
        {puedeVer('LABORATORIO') && <Route path="laboratorio" element={<Laboratorio />} />}
        {puedeVer('LABORATORIO') && <Route path="laboratorio/residuos" element={<ResiduosDestinos />} />}
        {puedeVer('AUDITORIAS') && <Route path="auditorias" element={<Auditorias />} />}
        {puedeVer('AUDITORIAS') && <Route path="auditorias/:id" element={<AuditoriaDetalle />} />}
        {puedeVer('NC') && <Route path="no-conformidades" element={<NoConformidades />} />}
        {puedeVer('NC') && <Route path="no-conformidades/:id" element={<NoConformidadDetalle />} />}
        {puedeVer('AMBIENTE') && <Route path="ambiente" element={<Ambiente />} />}
        <Route path="configuracion" element={<Configuracion />} />
        {esCertificaciones && <Route path="importar" element={<Importar />} />}
        {veHistorial && <Route path="historial" element={<Historial />} />}
        {esCertificaciones && <Route path="auditorias-externas" element={<AuditoriasExternas />} />}
        {esCertificaciones && <Route path="auditorias-externas/:id" element={<AuditoriaExternaDetalle />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

/** Enlaces antiguos /documentos?doc=ID → /registros?doc=ID */
function RedireccionDocumentos() {
  const { search } = useLocation()
  return <Navigate to={`/registros${search}`} replace />
}
