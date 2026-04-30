export interface DashboardKpis {
  desviacionPromedio: number
  totalSkus: number
  skusCriticos: number
  retailerMayorDesviacion: { retailer: string; desviacion: number } | null
  totalRetailers: number
}

export interface BrandExecution {
  marca: string
  pvpSugeridoPromedio: number
  precioObservadoPromedio: number
  desviacionPct: number
  skuCount: number
}

export interface DetailRow {
  skuId: string
  codigoSku: string
  nombre: string
  marca: string
  categoria: string
  pvpSugerido: number
  retailer: string
  precioObservado: number
  desviacionPct: number
  fechaScraping: string
}

export interface ProfitPoolItem {
  skuId: string
  codigoSku: string
  nombre: string
  marca: string
  pesoProfitPool: number
  pvpSugerido: number
  desviacionActual: number
  prioridad: string
}

// Módulo 2 — Análisis de Competencia

export interface CompetitionKpis {
  diferencialPromedio: number
  totalSkusComparados: number
  skuMasCaro: SkuExtremo | null
  skuMasBarato: SkuExtremo | null
  totalCompetidores: number
}

export interface SkuExtremo {
  nombre: string
  diferencialPct: number
}

export interface BrandComparison {
  marca: string
  precioPromedioCliente: number
  precioPromedioCompetidor: number
  diferencialPct: number
  skuCount: number
}

export interface CompetitionDetailRow {
  skuId: string
  codigoSku: string
  nombre: string
  marca: string
  precioPromedioCliente: number
  competidorPrincipal: string
  precioCompetidor: number
  diferencialAbsoluto: number
  diferencialPct: number
}

export interface ScatterPoint {
  nombreProducto: string
  tipo: 'cliente' | 'competidor'
  retailer: string
  precio: number
  skuClienteNombre: string
}

export interface BoxPlotSeries {
  nombre: string
  retailer: string
  precios: number[]
}

// Módulo 3b — Elasticidad y Volumen

export interface ElasticidadKpis {
  totalSkusConElasticidad: number
  coeficientePromedio: number
  confianzaPromedio: number
  skuMasElastico: { nombre: string; coeficiente: number } | null
}

export interface ElasticidadSummaryRow {
  skuId: string
  codigoSku: string
  nombre: string
  marca: string
  volumenBase: number
  coeficiente: number
  precioActual: number
  precioRecomendado: number
  costoVariable: number
  impactoVolumenPct: number
  impactoIngresosPct: number
  impactoMargenPct: number
  nivelConfianza: number
}

export interface SkuElasticidadDetail {
  skuId: string
  codigoSku: string
  nombre: string
  precioActual: number
  precioRecomendado: number
  costoVariable: number
  volumenBase: number
  coeficiente: number
  confianza: number
}

// Módulo 3a — Cálculo de Precio Óptimo

export interface PortfolioRow {
  skuId: string
  codigoSku: string
  nombre: string
  marca: string
  categoria: string
  precioActual: number
  precioOptimo: number
  variacionPct: number
  recomendacion: string
  tieneCompetidores: boolean
  precioOptimoValido: boolean
}

export interface ValueMapData {
  producto: ValueMapPoint
  precioOptimoPunto: ValueMapPoint
  competidores: ValueMapPoint[]
  lineaValorJusto: LineaRegresion
  precioOptimoValor: number
  variacionPct: number
  recomendacion: string
  precioOptimoValido: boolean
}

export interface ValueMapPoint {
  nombre: string
  valorPercibido: number
  precio: number
  tipo: 'producto' | 'optimo' | 'competidor'
}

export interface LineaRegresion {
  slope: number
  intercept: number
  xMin: number
  xMax: number
}

// Módulo 3c — Generador de Listas de Precios

export interface ListaSkuRow {
  skuId: string
  codigoSku: string
  nombre: string
  marca: string
  categoria: string
  pvpSugerido: number
}

// Módulo 1 — Pivot SKU × Retailer

export interface PivotCell {
  precioObservado: number | null
  desviacionPct: number | null
}

export interface PivotRow {
  skuId: string
  codigoSku: string
  nombre: string
  marca: string
  categoria: string
  pvpSugerido: number
  retailers: Record<string, PivotCell>
}

export interface PivotResponse {
  retailers: string[]
  rows: PivotRow[]
}

// Ingesta de Datos

export type EstadoCarga = 'procesando' | 'exitoso' | 'con_advertencias' | 'fallido'
export type TipoCargaCliente = 'portafolio' | 'competidores'

export interface PreviewError {
  fila: number
  columna?: string | null
  mensaje: string
}

export interface PreviewResult {
  previewId: string
  resumen: {
    nuevas: number
    actualizadas: number
    omitidas: number
  }
  errores: PreviewError[]
}

export interface CargaHistorialRow {
  id: string
  tipoArchivo: TipoCargaCliente
  nombreArchivo: string
  estado: EstadoCarga
  filasNuevas: number
  filasActualizadas: number
  totalErrores: number
  subidoPor: string | null
  fechaCarga: string
}
