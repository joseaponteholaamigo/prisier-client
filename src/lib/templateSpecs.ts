// ─── Especificaciones de plantillas Excel — módulo cliente ───────────────────
// Solo portafolio y competidores (el cliente NO sube los otros 6 tipos).
// Headers canónicos sincronizados con src/prisier-admin/src/lib/templateSpecs.ts.

export interface TemplateSpec {
  sheetName: string
  headers: string[]
  label: string
}

export type TipoPlantillaCliente = 'portafolio' | 'competidores'

export const TEMPLATE_SPECS: Record<TipoPlantillaCliente, TemplateSpec> = {
  portafolio: {
    sheetName: 'Portafolio',
    headers: ['EAN', 'SKU', 'Producto', 'Marca', 'Categoría', 'PVP Sugerido', 'Costo Variable', 'Peso Profit Pool', 'IVA'],
    label: 'Portafolio',
  },
  competidores: {
    sheetName: 'Competidores',
    headers: ['EAN Propio', 'EAN Competidor', 'Tipo Competidor', 'Marca Competidor', 'Retailer', 'País', 'Es Principal'],
    label: 'Competidores',
  },
}

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024   // 10 MB
