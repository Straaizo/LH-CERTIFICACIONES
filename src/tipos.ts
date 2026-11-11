export type Rol = 'certificaciones' | 'encargado' | 'lectura'

/** Permisos de la aplicación en el portal web (usuario_dim_permiso). El rol se deriva de ellos. */
export type Permiso =
  | 'CERTIFICACIONES_ADMIN'
  | 'REGISTROS_EDITAR'
  | 'NC_EDITAR'
  | 'LABORATORIO_EDITAR'
  | 'AMBIENTE_EDITAR'
  | 'CERTIFICACIONES_VER'
  | 'CERTIFICACIONES_HISTORIAL'
  | 'REGISTROS_VER'
  | 'NC_VER'
  | 'LABORATORIO_VER'
  | 'AMBIENTE_VER'
  | 'AUDITORIAS_VER'
  | 'DOCUMENTOS_VER'

/** Módulos que el usuario puede ver (permiso _VER o _EDITAR, o ADMIN / CERTIFICACIONES_VER). Lo calcula la API. */
export type Modulo = 'REGISTROS' | 'DOCUMENTOS' | 'LABORATORIO' | 'AUDITORIAS' | 'NC' | 'AMBIENTE'

/** Sucursal de general_dim_sucursal. tipo: ámbito de normas y plantillas (packing = planta). */
export interface UnidadRef {
  id: number
  nombre: string
  tipo: 'campo' | 'planta' | 'otro'
  /** Tipo de la tabla general: Campo, Packing, Oficina… */
  tipo_nombre: string
  empresa_id: number
}

export interface Usuario {
  /** UUID de general_dim_usuario */
  id: string
  nombre: string
  usuario: string
  email: string
  rol: Rol
  permisos: Permiso[]
  modulos: Modulo[]
  unidades: UnidadRef[]
}

export interface Catalogos {
  empresas: { id: number; codigo: string; nombre: string }[]
  unidades: UnidadRef[]
  areas: { id: string; nombre: string; unidad_id: number }[]
  temporadas: { id: number; nombre: string; inicio: string; fin: string; actual: boolean }[]
  protocolos: {
    id: string
    codigo: string
    nombre: string
    ambito: 'campo' | 'planta' | 'ambos'
    /** Unidades visibles a las que aplica el protocolo */
    unidades_aplica: number[]
    /** Si no está vacío, el protocolo solo aplica a estas unidades (p. ej. PrimusGFS) */
    solo_unidades: number[]
    versiones: { id: string; nombre: string; vigente: boolean; requisitos: number; cargada_en: string | null; archivo: string | null }[]
  }[]
  categorias: { id: string; nombre: string; ambito: string; requiere_vencimiento: boolean; requiere_codigo: boolean }[]
  tipos_analisis: { id: string; nombre: string; ambito: string; usa_fuente_agua: boolean; usa_especie: boolean }[]
  limites: {
    id: string
    tipo_analisis_id: string
    parametro: string
    unidad_medida: string | null
    minimo: number | null
    maximo: number | null
    norma: string | null
  }[]
  fuentes_agua: { id: string; nombre: string; unidades: number[] }[]
  especies: { id: string; nombre: string }[]
  materiales_reciclaje: { id: string; nombre: string }[]
  usuarios: { id: string; nombre: string; rol: Rol }[]
}

export interface Filtros {
  empresa_id?: number
  unidad_id?: number
  temporada_id?: number
  protocolo_id?: string
}

export interface VersionDoc {
  id: string
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
  subido_por_id: string
  subido_en: string
  revisado_en: string | null
  certificado: FichaCertificado | null
}

/** Ficha de un certificado de protocolo (una por versión: renovar = versión nueva). */
export interface FichaCertificado {
  protocolo: { id: string; codigo: string; nombre: string }
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
  protocolo_id: string
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
    categoria_id: string | null
    empresa_id: number | null
    seccion: SeccionDoc | null
    titulo: string | null
    codigo: string | null
    fecha_emision: string | null
    fecha_vencimiento: string | null
    certificado: PropuestaCertificado | null
  } | null
  /** Documento ya cargado al que se parece (mismo código o mismo certificado) */
  parecido: { id: string; titulo: string; codigo: string | null; motivo: string; requiere_vencimiento: boolean } | null
}

export interface Documento {
  id: string
  titulo: string
  codigo: string | null
  categoria: { id: string; nombre: string }
  empresa_id: number
  seccion: SeccionDoc
  vigente: VersionDoc | null
  ultima: VersionDoc | null
  versiones_total: number
  versiones?: VersionDoc[]
}

/** Documentos fijos: no van por sucursal sino por sección. */
export type SeccionDoc = 'empresarial' | 'campo' | 'planta'

/** Certificado subido como documento fijo, con la fecha de vencimiento de su versión vigente. */
export interface Vencimiento {
  tipo: 'certificado'
  id: string
  titulo: string
  codigo: string | null
  detalle: string
  seccion: SeccionDoc
  /** Sección legible: Campo, Planta o Empresarial (OC) */
  unidad: string
  empresa_id: number
  empresa: string | null
  version: string
  emision: string | null
  vence: string
  dias: number
  /** vencido | 7 | 30 | 60 | vigente */
  grupo: string
  certificado: FichaCertificado | null
}

export interface ResultadoAnalisis {
  id: string
  parametro: string
  valor: number | null
  valor_texto: string | null
  unidad_medida: string | null
  limite_min: number | null
  limite_max: number | null
  cumple: boolean | null
}

export interface Analisis {
  id: string
  tipo: { id: string; nombre: string; ambito: string }
  unidad: UnidadRef
  fuente_agua: string | null
  especie: { id: string; nombre: string } | null
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
  id: string
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
  protocolo: { id: string; codigo: string; nombre: string }
  version: { id: string; nombre: string }
  unidad: UnidadRef
  resumen: ResumenAuditoria
  no_conformidades: number
}

export interface ItemChecklist {
  requisito: {
    id: string
    codigo: string
    texto: string
    nivel: string | null
    seccion: string
    seccion_titulo: string | null
  }
  resultado: 'si' | 'no' | 'na' | null
  comentario: string | null
  area_id: string | null
  advertencia: string | null
  no_conformidad: { id: string; estado: string; repetida?: boolean; reincidencias: number } | null
  historial: { auditoria_id: string; fecha: string; resultado: string; comentario: string | null }[]
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
  areas: { id: string; nombre: string }[]
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
  id: string
  descripcion: string
  tipo: 'infraestructura' | 'documental' | 'operacional' | null
  clasificacion: 'menor' | 'mayor' | 'critica' | null
  estado: 'abierta' | 'en_proceso' | 'cerrada'
  plazo: string | null
  fecha_deteccion: string
  dias_abierta: number
  vencida: boolean
  requisito: { id: string; codigo: string; nivel: string | null; texto?: string }
  protocolo: { id: string; codigo: string }
  auditoria: { id: string; fecha: string; titulo: string; emitida_en: string | null }
  clausula: string
  clausula_titulo: string | null
  dias_para_plazo: number | null
  plan: PlanNc
  unidad: UnidadRef
  area: { id: string; nombre: string } | null
  responsable: { id: string; nombre: string } | null
  reincidente: boolean
  reincidencias: number
  ultima_revision: RevisionNc | null
  revisiones?: RevisionNc[]
  repetida?: boolean
  repetida_de?: { id: string; fecha: string } | null
  acciones: number | AccionCorrectiva[]
  cerrada_en: string | null
  historial_repeticiones?: { id: string; fecha: string; estado: string; descripcion: string }[]
}

export interface AccionCorrectiva {
  id: string
  descripcion: string
  nombre_archivo: string | null
  tiene_evidencia: boolean
  creada_por: string
  creada_en: string
}
