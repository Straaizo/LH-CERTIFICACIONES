import { Building2, CalendarDays, Factory, Globe2, Layers, MapPin, Sprout } from 'lucide-react'
import { useSesionActiva } from '../contexto/Sesion'
import { Desplegable } from './Desplegable'

const numero = (v: string) => (v ? Number(v) : undefined)
const icono = 'h-4 w-4'

/** Encabezado: empresa y sucursal. La sucursal se elige primero; el resto de la app depende de ella.
 *  `enLista`: filas a todo el ancho, para la hoja "Más" del celular. */
export function SelectoresSucursal({ soloSucursal = false, enLista = false }: { soloSucursal?: boolean; enLista?: boolean }) {
  const { catalogos, filtros, setFiltros } = useSesionActiva()
  const empresas = catalogos.empresas.filter((e) => catalogos.unidades.some((u) => u.empresa_id === e.id))
  const unidades = catalogos.unidades.filter((u) => !filtros.empresa_id || u.empresa_id === filtros.empresa_id)
  const codigoEmpresa = (id: number) => catalogos.empresas.find((e) => e.id === id)?.codigo ?? ''

  return (
    <div className={enLista ? 'flex flex-col gap-2' : 'flex min-w-0 flex-wrap items-center gap-2'}>
      {!soloSucursal && empresas.length > 1 && (
        <Desplegable
          tono={enLista ? 'fila' : 'oscuro'}
          icono={enLista ? <Building2 className="h-[18px] w-[18px] text-emerald-700" /> : undefined}
          className={enLista ? '' : 'max-w-[11rem]'}
          titulo="Cambiar empresa"
          etiqueta="Empresa"
          valor={String(filtros.empresa_id ?? '')}
          todas={{ valor: '', etiqueta: 'Todas las empresas', icono: <Globe2 className={icono} /> }}
          opciones={empresas.map((e) => ({
            valor: String(e.id), etiqueta: e.nombre, detalle: e.codigo, icono: <Building2 className={icono} />,
          }))}
          textoBoton={filtros.empresa_id ? codigoEmpresa(filtros.empresa_id) : 'Todas'}
          onCambio={(v) => setFiltros({ ...filtros, empresa_id: numero(v), unidad_id: undefined, protocolo_id: undefined })}
        />
      )}
      <Desplegable
        tono={enLista ? 'fila' : 'oscuro'}
        icono={enLista ? <MapPin className="h-[18px] w-[18px] text-emerald-700" /> : undefined}
        className={enLista ? '' : 'max-w-[16rem]'}
        titulo="Cambiar sucursal"
        etiqueta="Sucursal"
        punto={!enLista}
        valor={String(filtros.unidad_id ?? '')}
        todas={{ valor: '', etiqueta: 'Todas las sucursales', icono: <Globe2 className={icono} /> }}
        opciones={unidades.map((u) => ({
          valor: String(u.id),
          etiqueta: u.nombre,
          detalle: `${u.tipo_nombre} · ${codigoEmpresa(u.empresa_id)}`,
          icono: u.tipo === 'planta' ? <Factory className={icono} /> : <MapPin className={icono} />,
        }))}
        textoBoton={catalogos.unidades.find((u) => u.id === filtros.unidad_id)?.nombre ?? 'Todas'}
        onCambio={(v) => setFiltros({ ...filtros, unidad_id: numero(v) })}
      />
    </div>
  )
}

/** Contexto de la página: la temporada. (El filtro de protocolo se quitó a pedido del cliente.) */
export function BarraContexto() {
  const { catalogos, filtros, setFiltros } = useSesionActiva()
  return (
    <Desplegable
      titulo="Cambiar temporada"
      etiqueta="Temporada"
      tono="claro"
      alinear="derecha"
      icono={<CalendarDays className="h-4 w-4 text-emerald-700" />}
      valor={String(filtros.temporada_id ?? '')}
      todas={{ valor: '', etiqueta: 'Todas las temporadas', icono: <Layers className={icono} /> }}
      opciones={catalogos.temporadas.map((t) => ({
        valor: String(t.id), etiqueta: t.nombre, detalle: t.actual ? 'Temporada actual' : undefined,
        icono: <Sprout className={icono} />,
      }))}
      onCambio={(v) => setFiltros({ ...filtros, temporada_id: numero(v) })}
    />
  )
}
