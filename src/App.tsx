import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './componentes/Layout'
import { useSesion } from './contexto/Sesion'
import { Ambiente } from './paginas/Ambiente'
import { AuditoriaDetalle } from './paginas/AuditoriaDetalle'
import { Auditorias } from './paginas/Auditorias'
import { Bitacora } from './paginas/Bitacora'
import { Configuracion } from './paginas/Configuracion'
import { Importar } from './paginas/Importar'
import { Ingreso } from './paginas/Ingreso'
import { Inicio } from './paginas/Inicio'
import { Laboratorio } from './paginas/Laboratorio'
import { NoConformidadDetalle } from './paginas/NoConformidadDetalle'
import { NoConformidades } from './paginas/NoConformidades'
import { RegistroDetalle } from './paginas/RegistroDetalle'
import { Registros } from './paginas/Registros'
import { Vencimientos } from './paginas/Vencimientos'
import { EsqueletoApp } from './componentes/Esqueletos'

export function App() {
  const { usuario, catalogos, cargando, esCertificaciones } = useSesion()
  if (cargando) return <EsqueletoApp />
  if (!usuario || !catalogos) return <Ingreso />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="registros" element={<Registros />} />
        <Route path="registros/r/:id" element={<RegistroDetalle />} />
        <Route path="documentos" element={<RedireccionDocumentos />} />
        <Route path="vencimientos" element={<Vencimientos />} />
        <Route path="laboratorio" element={<Laboratorio />} />
        <Route path="auditorias" element={<Auditorias />} />
        <Route path="auditorias/:id" element={<AuditoriaDetalle />} />
        <Route path="no-conformidades" element={<NoConformidades />} />
        <Route path="no-conformidades/:id" element={<NoConformidadDetalle />} />
        <Route path="ambiente" element={<Ambiente />} />
        <Route path="configuracion" element={<Configuracion />} />
        {esCertificaciones && <Route path="importar" element={<Importar />} />}
        {esCertificaciones && <Route path="bitacora" element={<Bitacora />} />}
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
