// ─── Store en memoria (se resetea al recargar la página) ─────────────────────
import {
  SEED_SKUS,
  SEED_COMPETIDORES,
  SEED_PRECIOS_MERCADO,
  SEED_PRECIOS_COMPETIDOR,
  SEED_ELASTICIDADES,
  SEED_CATEGORIA_ATRIBUTOS,
  SEED_CANALES_MARGENES,
  SEED_REGLAS,
  type Sku,
  type PrecioMercado,
} from './data'

export interface CargaHistorialRow {
  id: string
  tipoArchivo: string
  nombreArchivo: string
  estado: string
  registrosProcesados: number
  totalErrores: number
  subidoPor: string
  fechaCarga: string
}

export interface ListaPrecioEditado {
  skuId: string
  pvpEditado: number
}

export const store = {
  skus: structuredClone(SEED_SKUS) as Sku[],
  competidores: structuredClone(SEED_COMPETIDORES),
  preciosMercado: structuredClone(SEED_PRECIOS_MERCADO) as PrecioMercado[],
  preciosCompetidor: structuredClone(SEED_PRECIOS_COMPETIDOR),
  elasticidades: structuredClone(SEED_ELASTICIDADES),
  categoriaAtributos: structuredClone(SEED_CATEGORIA_ATRIBUTOS),
  canalesMargenesConfig: structuredClone(SEED_CANALES_MARGENES),
  reglas: structuredClone(SEED_REGLAS),
  cargasHistorial: [] as CargaHistorialRow[],
  preciosEditados: {} as Record<string, number>, // skuId → pvpEditado
  _uploadCounter: 0,
}
