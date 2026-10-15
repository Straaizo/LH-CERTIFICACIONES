export type Rol = 'certificaciones' | 'encargado' | 'lectura'

export interface UnidadRef {
  id: number
  nombre: string
  tipo: 'campo' | 'planta'
  empresa_id: number
  ubicacion?: string
}

export interface Usuario {
  id: number
  nombre: string
  email: string
  rol: Rol
  unidades: UnidadRef[]
}

export interface Catalogos {
  empresas: { id: number; codigo: string; nombre: string }[]
  unidades: UnidadRef[]
  areas: { id: number; nombre: string; unidad_id: number }[]
  temporadas: { id: number; nombre: string; inicio: string; fin: string; actual: boolean }[]
  protocolos: {
    id: number
    codigo: string
    nombre: string
    ambito: 'campo' | 'planta' | 'ambos'
    /** Unidades visibles a las que aplica el protocolo */
    unidades_aplica: number[]
    /** Si no está vacío, el protocolo solo aplica a estas unidades (p. ej. PrimusGFS) */
    solo_unidades: number[]
    versiones: { id: number; nombre: string; vigente: boolean; requisitos: number; cargada_en: string | null; archivo: string | null }[]
  }[]
  categorias: { id: number; nombre: string; ambito: string; requiere_vencimiento: boolean; requiere_codigo: boolean }[]
  tipos_analisis: { id: number; nombre: string; ambito: string; usa_fuente_agua: boolean; usa_especie: boolean }[]
  limites: {
    id: number
    tipo_analisis_id: number
    parametro: string
    unidad_medida: string | null
    minimo: number | null
    maximo: number | null
    norma: string | null
  }[]
  fuentes_agua: { id: number; nombre: string; unidades: number[] }[]
  especies: { id: number; nombre: string; unidades: number[] }[]
  materiales_reciclaje: { id: number; nombre: string }[]
  usuarios: { id: number; nombre: string; rol: Rol }[]
}

export interface Filtros {
  empresa_id?: number
  unidad_id?: number
  temporada_id?: number
  protocolo_id?: number
}

export interface VersionDoc {
  id: number
  numero: number
  nombre_archivo: string | null
  tipo_contenido: string | null
  version_texto: string | null
  fecha_emision: string | null
  fecha_vencimiento: string | null
  dias_para_vencer: number | null
  estado: 'pendiente' | 'aprobado' | 'rechazado'
  observacion: string | null
  subido_por: string
  subido_por_id: number
  subido_en: string
  revisado_en: string | null
  certificado: FichaCertificado | null
}

/** Ficha de un certificado de protocolo (una por versión: renovar = versión nueva). */
export interface FichaCertificado {
  protocolo: { id: number; codigo: string; nombre: string }
  numero: string | null
  norma_version: string | null
  entidad_certificadora: string | null
  vigente_desde: string | null
  vigente_hasta: string | null
  fecha_auditoria: string | null
  /** Puntaje o grado (PrimusGFS: 98%) */
  resultado: string | null
  productos: string[]
  unidades: { id: number; nombre: string; tipo: string; empresa_id: number }[]
}

/** Ficha propuesta al leer un certificado (se guarda tal cual si certificaciones acepta rellenar). */
export interface PropuestaCertificado {
  protocolo_id: number
  protocolo: string
  numero: string | null
  norma_version: string | null
  entidad_certificadora: string | null
  vigente_desde: string | null
  fecha_auditoria: string | null
  resultado: string | null
  unidad_ids: number[]
  productos: string[]
}

/** Lo que la aplicación interpreta de un documento recién subido; pregunta antes de rellenar. */
export interface AnalisisDocumento {
  texto_leido: boolean
  /** "el certificado GLOBALG.A.P. de Agrícola La Hornilla", "un procedimiento con código P OC CE 29" */
  descripcion: string | null
  propuesta: {
    categoria_id: number | null
    empresa_id: number | null
    seccion: SeccionDoc | null
    titulo: string | null
    codigo: string | null
    fecha_emision: string | null
    fecha_vencimiento: string | null
    certificado: PropuestaCertificado | null
  } | null
  /** Documento ya cargado al que se parece (mismo código o mismo certificado) */
  parecido: { id: number; titulo: string; codigo: string | null; motivo: string; requiere_vencimiento: boolean } | null
}

export interface Documento {
  id: number
  titulo: string
  codigo: string | null
  responsable: string | null
  categoria: { id: number; nombre: string }
  empresa_id: number
  seccion: SeccionDoc
  temporada_id: number | null
  vigente: VersionDoc | null
  ultima: VersionDoc | null
  versiones_total: number
  versiones?: VersionDoc[]
  requisitos?: { id: number; codigo: string; protocolo: string }[]
}

/** Documentos fijos: no van por sucursal sino por sección. */
export type SeccionDoc = 'empresarial' | 'campo' | 'planta'

/** Certificado subido como documento fijo, con la fecha de vencimiento de su versión vigente. */
export interface Vencimiento {
  tipo: 'certificado'
  id: number
  titulo: string
  codigo: string | null
  detalle: string
  seccion: SeccionDoc
  /** Sección legible: Campo, Planta o Empresarial (OC) */
  unidad: string
  empresa_id: number
  empresa: string | null
  responsable: string | null
  version: string
  emision: string | null
  vence: string
  dias: number
  /** vencido | 7 | 30 | 60 | vigente */
  grupo: string
  certificado: FichaCertificado | null
}

export interface ResultadoAnalisis {
  id: number
  parametro: string
  valor: number | null
  valor_texto: string | null
  unidad_medida: string | null
  limite_min: number | null
  limite_max: number | null
  cumple: boolean | null
}

export interface Analisis {
  id: number
  tipo: { id: number; nombre: string; ambito: string }
  unidad: UnidadRef
  fuente_agua: string | null
  especie: { id: number; nombre: string } | null
  punto: string | null
  fecha_muestreo: string
  laboratorio: string | null
  temporada_id: number | null
  nombre_archivo: string | null
  tiene_informe: boolean
  cumple: boolean | null
  fuera_de_norma: string[]
  resultados: ResultadoAnalisis[]
}

export interface ResumenAuditoria {
  si: number
  no: number
  na: number
  sin: number
  cumplimiento: number | null
  por_nivel: Record<string, number>
  aprueba?: boolean
}

export interface Auditoria {
  id: number
  titulo: string
  fecha: string
  fecha_inicio: string
  fecha_fin: string | null
  emitida_en: string | null
  auditor: string | null
  estado: 'planificada' | 'en_curso' | 'cerrada'
  origen: 'app' | 'importada'
  secciones: string[]
  temporada_id: number
  archivo_origen: string | null
  advertencias: string[]
  protocolo: { id: number; codigo: string; nombre: string }
  version: { id: number; nombre: string }
  unidad: UnidadRef
  resumen: ResumenAuditoria
  no_conformidades: number
}

export interface ItemChecklist {
  requisito: {
    id: number
    codigo: string
    texto: string
    nivel: string | null
    seccion: string
    seccion_titulo: string | null
  }
  resultado: 'si' | 'no' | 'na' | null
  comentario: string | null
  area_id: number | null
  advertencia: string | null
  no_conformidad: { id: number; estado: string; repetida?: boolean; reincidencias: number } | null
  historial: { auditoria_id: number; fecha: string; resultado: string; comentario: string | null }[]
}

export interface AvanceClausula {
  codigo: string
  titulo: string
  total: number
  respondidos: number
  no: number
}

export interface AuditoriaDetalle extends Auditoria {
  items: ItemChecklist[]
  clausulas: AvanceClausula[]
  areas: { id: number; nombre: string }[]
}

export interface PlanNc {
  causa_raiz: string[]
  accion_correctiva: string | null
  accion_preventiva: string | null
  por: string | null
  en: string | null
  enviado_en: string | null
}

export interface RevisionNc {
  fecha: string
  por: string
  resultado: 'cumple' | 'no_cumple'
  observacion: string | null
}

export interface NoConformidad {
  id: number
  descripcion: string
  tipo: 'infraestructura' | 'documental' | 'operacional' | null
  clasificacion: 'menor' | 'mayor' | 'critica' | null
  estado: 'abierta' | 'en_proceso' | 'cerrada'
  plazo: string | null
  fecha_deteccion: string
  dias_abierta: number
  vencida: boolean
  requisito: { id: number; codigo: string; nivel: string | null; texto?: string }
  protocolo: { id: number; codigo: string }
  auditoria: { id: number; fecha: string; titulo: string; emitida_en: string | null }
  clausula: string
  clausula_titulo: string | null
  dias_para_plazo: number | null
  plan: PlanNc
  unidad: UnidadRef
  area: { id: number; nombre: string } | null
  responsable: { id: number; nombre: string } | null
  reincidente: boolean
  reincidencias: number
  ultima_revision: RevisionNc | null
  revisiones?: RevisionNc[]
  repetida?: boolean
  repetida_de?: { id: number; fecha: string } | null
  acciones: number | AccionCorrectiva[]
  cerrada_en: string | null
  historial_repeticiones?: { id: number; fecha: string; estado: string; descripcion: string }[]
}

export interface AccionCorrectiva {
  id: number
  descripcion: string
  nombre_archivo: string | null
  tiene_evidencia: boolean
  creada_por: string
  creada_en: string
}
