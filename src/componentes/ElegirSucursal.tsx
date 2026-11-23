import { useState, type FormEvent, type ReactNode } from 'react'
import { Download } from 'lucide-react'
import { useSesionActiva } from '../contexto/Sesion'
import { Boton, Campo, Modal, claseEntrada } from './ui'
import { Selector } from './Desplegable'

type Descarga = (unidadId: number) => void

/**
 * Toda descarga corresponde a una sucursal: si el filtro está en "Todas" y el usuario tiene varias,
 * pregunta cuál antes de descargar (solo ofrece las habilitadas en el portal web).
 */
export function useSucursalDescarga(): { pedir: (descargar: Descarga) => void; modal: ReactNode } {
  const { catalogos, filtros } = useSesionActiva()
  const [pendiente, setPendiente] = useState<Descarga | null>(null)
  const delFiltro = catalogos.unidades.filter((u) => !filtros.empresa_id || u.empresa_id === filtros.empresa_id)
  const opciones = delFiltro.length ? delFiltro : catalogos.unidades

  const pedir = (descargar: Descarga) => {
    if (filtros.unidad_id) return descargar(filtros.unidad_id)
    if (opciones.length === 1) return descargar(opciones[0].id)
    setPendiente(() => descargar)
  }

  const modal = pendiente && (
    <ModalSucursal
      opciones={opciones}
      onCerrar={() => setPendiente(null)}
      onElegir={(id) => { setPendiente(null); pendiente(id) }}
    />
  )
  return { pedir, modal }
}

function ModalSucursal({ opciones, onElegir, onCerrar }: {
  opciones: { id: number; nombre: string; tipo: string }[]
  onElegir: (unidadId: number) => void
  onCerrar: () => void
}) {
  const [unidadId, setUnidadId] = useState<number | undefined>()
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (unidadId) onElegir(unidadId)
  }
  return (
    <Modal abierto titulo="¿A qué sucursal corresponde?" onCerrar={onCerrar} ancho="max-w-md">
      <form onSubmit={enviar} className="space-y-4">
        {opciones.length ? (
          <Campo etiqueta="Sucursal">
            <Selector className={claseEntrada} value={unidadId ?? ''} required onChange={(e) => setUnidadId(Number(e.target.value) || undefined)}>
              <option value="" disabled>Elige una sucursal</option>
              {opciones.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.tipo})</option>)}
            </Selector>
          </Campo>
        ) : (
          <p className="text-sm text-slate-600">No tienes sucursales habilitadas. Pídelas a TI en el portal web.</p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton type="button" variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          {opciones.length > 0 && (
            <Boton type="submit" disabled={!unidadId} icono={<Download className="h-4 w-4" />}>Descargar</Boton>
          )}
        </div>
      </form>
    </Modal>
  )
}
