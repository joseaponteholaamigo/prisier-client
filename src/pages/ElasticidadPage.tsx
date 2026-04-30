import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, BarChart3, AlertTriangle, X, RotateCcw, FileSpreadsheet, Image as ImageIcon } from 'lucide-react'
import api from '../lib/api'
import type { ElasticidadKpis, ElasticidadSummaryRow, SkuElasticidadDetail } from '../lib/types'
import { SkeletonKpiCards, SkeletonTable } from '../components/Skeleton'
import QueryErrorState from '../components/QueryErrorState'
import Drawer from '../components/Drawer'
import ValueMapPanel from '../components/ValueMapPanel'
import { exportToExcel, todayStamp } from '../lib/exportExcel'
import { exportElementAsPng } from '../lib/exportImage'

type TabKey = 'resumen' | 'simulador'

type RowOverride = { volumenBase?: number; precioRecomendado?: number }
type OverridesMap = Map<string, RowOverride>

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024)
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 1024)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return isMobile
}

export default function ElasticidadPage() {
  const [marca, setMarca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [tab, setTab] = useState<TabKey>('resumen')
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null)
  const [simuladorSkuId, setSimuladorSkuId] = useState<string | null>(null)
  const isMobile = useIsMobile()

  const { data: filterOptions } = useQuery({
    queryKey: ['elasticidad-filters'],
    queryFn: () => api.get<{ marcas: string[]; categorias: string[] }>('/elasticidad/filters').then(r => r.data),
  })

  const filters = `marca=${marca}&categoria=${categoria}`

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <select value={marca} onChange={(e) => setMarca(e.target.value)} className="glass-select">
          <option value="">Todas las marcas</option>
          {filterOptions?.marcas.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="glass-select">
          <option value="">Todas las categorías</option>
          {filterOptions?.categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="flex gap-4 border-b border-p-border mb-6">
        {([['resumen', 'Resumen de Impacto'], ['simulador', 'Simulador por SKU']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`sub-tab ${tab === key ? 'sub-tab-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <ResumenTab
          filters={filters}
          selectedSkuId={selectedSkuId}
          onSkuClick={setSelectedSkuId}
          isMobile={isMobile}
        />
      )}
      {tab === 'simulador' && (
        <SimuladorTab
          filters={filters}
          selectedSkuId={simuladorSkuId}
          onSelectSku={setSimuladorSkuId}
        />
      )}
    </div>
  )
}

// ─── Resumen Tab ─────────────────────────────────────────────

function ResumenTab({
  filters,
  selectedSkuId,
  onSkuClick,
  isMobile,
}: {
  filters: string
  selectedSkuId: string | null
  onSkuClick: (skuId: string | null) => void
  isMobile: boolean
}) {
  const [overrides, setOverrides] = useState<OverridesMap>(new Map())

  const { data: kpis, isLoading: kpisLoading, isError: kpisError, refetch: refetchKpis } = useQuery({
    queryKey: ['elasticidad-kpis', filters],
    queryFn: () => api.get<ElasticidadKpis>(`/elasticidad/kpis?${filters}`).then(r => r.data),
  })

  const { data: rows = [], isLoading: rowsLoading, isError: rowsError, refetch: refetchRows } = useQuery({
    queryKey: ['elasticidad-summary', filters],
    queryFn: () => api.get<ElasticidadSummaryRow[]>(`/elasticidad/summary?${filters}`).then(r => r.data),
  })

  // Limpiar selección y overrides cuando cambian los filtros
  useEffect(() => { onSkuClick(null) }, [filters, onSkuClick])

  const setOverride = (skuId: string, patch: RowOverride) => {
    setOverrides(prev => {
      const next = new Map(prev)
      const current = next.get(skuId) ?? {}
      next.set(skuId, { ...current, ...patch })
      return next
    })
  }

  const resetOverrides = () => setOverrides(new Map())

  // Calcula los impactos en vivo aplicando overrides
  const computeRow = (r: ElasticidadSummaryRow) => {
    const ov = overrides.get(r.skuId) ?? {}
    const volumenBase = ov.volumenBase ?? r.volumenBase
    const precioRec = ov.precioRecomendado ?? r.precioRecomendado
    const variacionPct = r.precioActual > 0 ? ((precioRec - r.precioActual) / r.precioActual) * 100 : 0
    const cambio = variacionPct / 100
    const impactoVolPct = r.coeficiente * cambio * 100
    const nuevoVolumen = Math.max(0, volumenBase * (1 + r.coeficiente * cambio))
    const volumenDelta = nuevoVolumen - volumenBase
    const ingresosBase = r.precioActual * volumenBase
    const ingresosNuevos = precioRec * nuevoVolumen
    const ingresosDelta = ingresosNuevos - ingresosBase
    const impactoIngPct = ingresosBase > 0 ? (ingresosDelta / ingresosBase) * 100 : 0
    const margenBase = (r.precioActual - r.costoVariable) * volumenBase
    const margenNuevo = (precioRec - r.costoVariable) * nuevoVolumen
    const margenDelta = margenNuevo - margenBase
    const impactoMargenPct = margenBase !== 0 ? (margenDelta / margenBase) * 100 : 0
    const isOverridden = ov.volumenBase != null || ov.precioRecomendado != null
    return {
      volumenBase, precioRec, variacionPct,
      impactoVolPct, volumenDelta,
      impactoIngPct, ingresosDelta,
      impactoMargenPct, margenDelta,
      isOverridden,
    }
  }

  const hasOverrides = overrides.size > 0

  const handleExportExcel = () => {
    const data = rows.map(r => {
      const c = computeRow(r)
      return {
        'SKU': r.codigoSku,
        'Producto': r.nombre,
        'Marca': r.marca,
        'Unidades base': c.volumenBase,
        'Precio actual': r.precioActual,
        'Precio recomendado': c.precioRec,
        'Variación de precio (%)': Number(c.variacionPct.toFixed(2)),
        'Impacto volumen (uds)': Math.round(c.volumenDelta),
        'Impacto volumen (%)': Number(c.impactoVolPct.toFixed(2)),
        'Impacto ingresos ($)': Math.round(c.ingresosDelta),
        'Impacto ingresos (%)': Number(c.impactoIngPct.toFixed(2)),
        'Impacto margen ($)': Math.round(c.margenDelta),
        'Impacto margen (%)': Number(c.impactoMargenPct.toFixed(2)),
        'Editado': c.isOverridden ? 'Sí' : 'No',
      }
    })
    exportToExcel(data, {
      sheetName: 'Escenario Elasticidad',
      fileName: `elasticidad-escenario-${todayStamp()}.xlsx`,
    })
  }

  if (kpisLoading || rowsLoading) {
    return (
      <div className="space-y-6">
        <SkeletonKpiCards count={2} />
        <div className="glass-panel overflow-x-auto">
          <table className="data-table">
            <tbody><SkeletonTable rows={8} columns={8} /></tbody>
          </table>
        </div>
      </div>
    )
  }

  if (kpisError || rowsError) {
    return (
      <div className="glass-panel">
        <QueryErrorState
          onRetry={() => { void refetchKpis(); void refetchRows() }}
          message="No se pudo cargar el análisis de elasticidad."
        />
      </div>
    )
  }

  const tableSection = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-5">
        <KpiCard
          label="SKUs con sensibilidad al precio"
          value={String(kpis?.totalSkusConElasticidad ?? 0)}
          icon={Activity}
          color="text-p-blue"
          sub={`${kpis?.totalSkusConElasticidad ?? 0} de ${(kpis as unknown as { totalSkus?: number })?.totalSkus ?? '—'} productos activos`}
          subColor="text-p-muted"
        />
        <KpiCard
          label="Producto más sensible al precio"
          value={kpis?.skuMasElastico?.nombre ?? '—'}
          icon={BarChart3}
          color="text-p-red"
          sub={kpis?.skuMasElastico ? 'Alta sensibilidad — pequeños ajustes mueven mucho el volumen' : undefined}
          subColor="text-p-red"
        />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-p-muted text-sm">
          Edita Unidades base o Precio recomendado para simular escenarios. Haz clic en una fila para ver el Mapa de Valor.
        </p>
        <div className="flex items-center gap-2">
          {hasOverrides && (
            <button
              onClick={resetOverrides}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-p-border text-p-muted hover:text-white hover:border-p-muted transition-colors text-xs"
            >
              <RotateCcw size={13} aria-hidden /> Resetear escenario
            </button>
          )}
          <button
            onClick={handleExportExcel}
            disabled={rows.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-p-lime/40 bg-p-lime/10 text-p-lime hover:bg-p-lime/20 transition-colors text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet size={13} aria-hidden /> Exportar escenario a Excel
          </button>
        </div>
      </div>

      <div className="glass-panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU / Producto</th>
              <th className="text-right">Unidades base</th>
              <th className="text-right">Precio actual</th>
              <th className="text-right">Precio recomendado</th>
              <th className="text-right">Variación</th>
              <th className="text-right">Impacto volumen</th>
              <th className="text-right">Impacto ingresos</th>
              <th className="text-right">Impacto margen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const c = computeRow(r)
              const isSelected = selectedSkuId === r.skuId
              return (
                <tr
                  key={r.skuId}
                  className={`cursor-pointer transition-colors ${isSelected ? 'bg-p-lime/10 border-l-2 border-l-p-lime' : 'hover:bg-white/5'}`}
                  onClick={() => onSkuClick(isSelected ? null : r.skuId)}
                >
                  <td>
                    <div className="font-medium">{r.nombre}</div>
                    <div className="text-p-muted text-xs">{r.codigoSku} · {r.marca}</div>
                  </td>
                  <td className="text-right">
                    <input
                      type="number"
                      value={c.volumenBase}
                      onClick={e => e.stopPropagation()}
                      onChange={e => {
                        const v = parseFloat(e.target.value)
                        setOverride(r.skuId, { volumenBase: isNaN(v) ? r.volumenBase : v })
                      }}
                      className="w-24 px-2 py-1 text-right text-sm bg-p-bg/40 border border-p-border rounded focus:border-p-lime focus:outline-none"
                      min={0}
                      step={1}
                      aria-label={`Unidades base de ${r.nombre}`}
                    />
                  </td>
                  <td className="text-right">${r.precioActual.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</td>
                  <td className="text-right">
                    <input
                      type="number"
                      value={c.precioRec}
                      onClick={e => e.stopPropagation()}
                      onChange={e => {
                        const v = parseFloat(e.target.value)
                        setOverride(r.skuId, { precioRecomendado: isNaN(v) ? r.precioRecomendado : v })
                      }}
                      className="w-28 px-2 py-1 text-right text-sm bg-p-bg/40 border border-p-border rounded focus:border-p-lime focus:outline-none text-p-lime"
                      min={0}
                      step={1}
                      aria-label={`Precio recomendado de ${r.nombre}`}
                    />
                  </td>
                  <td className={`text-right text-sm ${c.variacionPct > 0 ? 'text-p-lime' : c.variacionPct < 0 ? 'text-p-red' : 'text-p-muted'}`}>
                    {c.variacionPct > 0 ? '+' : ''}{c.variacionPct.toFixed(1)}%
                  </td>
                  <td className="text-right">
                    <DualImpactCell pct={c.impactoVolPct} abs={`${c.volumenDelta >= 0 ? '+' : ''}${Math.round(c.volumenDelta).toLocaleString('es-CO')} uds`} />
                  </td>
                  <td className="text-right">
                    <DualImpactCell pct={c.impactoIngPct} abs={`${c.ingresosDelta >= 0 ? '+' : ''}${formatMillones(c.ingresosDelta)}`} />
                  </td>
                  <td className="text-right">
                    <DualImpactCell pct={c.impactoMargenPct} abs={`${c.margenDelta >= 0 ? '+' : ''}${formatMillones(c.margenDelta)}`} />
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-p-muted py-8">
                  No hay SKUs con elasticidad configurada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <>
      <div className="flex gap-6 items-start">
        <div className={`min-w-0 transition-all duration-200 ${selectedSkuId && !isMobile ? 'w-3/5' : 'w-full'}`}>
          {tableSection}
        </div>
        {selectedSkuId && !isMobile && (
          <div className="w-2/5 min-w-0 sticky top-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white">Mapa de Valor</span>
              <button
                onClick={() => onSkuClick(null)}
                className="text-p-muted hover:text-white transition-colors"
                aria-label="Cerrar Mapa de Valor"
              >
                <X size={16} />
              </button>
            </div>
            <ValueMapPanel skuId={selectedSkuId} />
          </div>
        )}
      </div>

      <Drawer
        isOpen={!!selectedSkuId && isMobile}
        title="Mapa de Valor"
        onClose={() => onSkuClick(null)}
      >
        {selectedSkuId && isMobile && <ValueMapPanel skuId={selectedSkuId} />}
      </Drawer>
    </>
  )
}

// ─── Simulador Tab ───────────────────────────────────────────

function SimuladorTab({
  filters,
  selectedSkuId,
  onSelectSku,
}: {
  filters: string
  selectedSkuId: string | null
  onSelectSku: (skuId: string) => void
}) {
  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['elasticidad-summary', filters],
    queryFn: () => api.get<ElasticidadSummaryRow[]>(`/elasticidad/summary?${filters}`).then(r => r.data),
  })

  useEffect(() => {
    if (!selectedSkuId && rows.length > 0) {
      onSelectSku(rows[0].skuId)
    }
  }, [rows, selectedSkuId, onSelectSku])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <div className="glass-panel p-4 space-y-2" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white/10 rounded-lg h-12 w-full" />
          ))}
        </div>
        <div className="glass-panel p-6 space-y-4" aria-hidden="true">
          <div className="animate-pulse bg-white/10 rounded-lg h-6 w-1/2" />
          <div className="animate-pulse bg-white/10 rounded-lg h-28 w-full" />
          <div className="animate-pulse bg-white/10 rounded-lg h-40 w-full" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="glass-panel">
        <QueryErrorState onRetry={refetch} message="No se pudo cargar la lista de productos." />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="glass-panel p-12 text-center text-p-muted">
        <AlertTriangle size={48} className="mx-auto mb-4 opacity-40" />
        <p className="text-lg">No hay SKUs con elasticidad configurada</p>
      </div>
    )
  }

  const activeSkuId = selectedSkuId ?? rows[0].skuId

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
      <div className="glass-panel p-4">
        <h3 className="text-sm font-semibold text-p-text mb-3">Seleccionar SKU</h3>
        <ul className="space-y-1 max-h-[640px] overflow-y-auto">
          {rows.map(r => {
            const isActive = r.skuId === activeSkuId
            return (
              <li key={r.skuId}>
                <button
                  type="button"
                  onClick={() => onSelectSku(r.skuId)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-p-blue/15 border border-p-blue/40 text-p-text'
                      : 'border border-transparent text-p-gray-light hover:bg-p-bg-hover'
                  }`}
                  aria-pressed={isActive}
                >
                  <Activity size={16} className={isActive ? 'text-p-blue' : 'text-p-muted'} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-mono text-p-muted truncate">{r.codigoSku}</div>
                    <div className="text-sm font-medium truncate">{r.nombre}</div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="glass-panel p-6">
        <SimuladorContent skuId={activeSkuId} row={rows.find(r => r.skuId === activeSkuId)} />
      </div>
    </div>
  )
}

// ─── Simulador Content ───────────────────────────────────────

function SimuladorContent({ skuId, row }: { skuId: string; row?: ElasticidadSummaryRow }) {
  const [sliderValue, setSliderValue] = useState(0)
  const [volumenBaseEdit, setVolumenBaseEdit] = useState<number | null>(null)
  const [precioRecEdit, setPrecioRecEdit] = useState<number | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  const { data: detail, isLoading, isError, refetch } = useQuery({
    queryKey: ['elasticidad-sku', skuId],
    queryFn: () => api.get<SkuElasticidadDetail>(`/elasticidad/sku/${skuId}`).then(r => r.data),
    enabled: !!skuId,
  })

  useEffect(() => {
    setSliderValue(0)
    setVolumenBaseEdit(null)
    setPrecioRecEdit(null)
  }, [skuId])

  if (isLoading) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <div className="animate-pulse bg-white/10 rounded-lg h-6 w-1/2" />
        <div className="animate-pulse bg-white/10 rounded-lg h-28 w-full" />
        <div className="animate-pulse bg-white/10 rounded-lg h-5 w-3/4" />
        <div className="animate-pulse bg-white/10 rounded-lg h-40 w-full" />
      </div>
    )
  }

  if (isError) {
    return <QueryErrorState onRetry={refetch} message="No se pudo cargar el detalle de elasticidad." />
  }

  if (!detail) {
    return (
      <div className="text-center text-p-muted py-12">
        <AlertTriangle size={48} className="mx-auto mb-4 opacity-40" />
        <p className="text-lg">No se encontró elasticidad para este SKU</p>
      </div>
    )
  }

  const volumenBase = volumenBaseEdit ?? detail.volumenBase
  const precioRec = precioRecEdit ?? detail.precioRecomendado
  const precioPct = sliderValue / 100
  const precioSimulado = precioRec * (1 + precioPct)
  // Cambio total de precio respecto al precio actual (referencia para elasticidad)
  const cambioVsActualPct = detail.precioActual > 0 ? (precioSimulado - detail.precioActual) / detail.precioActual : 0
  const cambioVolPct = detail.coeficiente * cambioVsActualPct
  const nuevoVolumen = Math.max(0, volumenBase * (1 + cambioVolPct))
  const volumenDelta = nuevoVolumen - volumenBase
  const volumenDeltaPct = volumenBase > 0 ? (volumenDelta / volumenBase) * 100 : 0

  const ingresosActuales = detail.precioActual * volumenBase
  const ingresosSimulados = precioSimulado * nuevoVolumen
  const ingresosDelta = ingresosSimulados - ingresosActuales
  const ingresosDeltaPct = ingresosActuales > 0 ? (ingresosDelta / ingresosActuales) * 100 : 0

  const titulo = row ? `${row.nombre} (${row.codigoSku})` : detail.nombre
  const variacionVsActual = detail.precioActual > 0 ? ((precioSimulado - detail.precioActual) / detail.precioActual) * 100 : 0

  const handleExportImage = async () => {
    if (!panelRef.current) return
    try {
      setExporting(true)
      await exportElementAsPng(
        panelRef.current,
        `simulacion-elasticidad-${detail.codigoSku}-${todayStamp()}.png`,
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div ref={panelRef} className="space-y-5">
      <div className="border-b border-p-border pb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-p-text">Simulador de Impacto: {titulo}</h2>
          <p className="text-sm text-p-muted mt-1">
            Edita el Volumen base y el Precio recomendado, o usa el deslizador para simular un nuevo precio.
          </p>
        </div>
        <button
          onClick={handleExportImage}
          disabled={exporting}
          data-html2canvas-ignore
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-p-blue/40 bg-p-blue/10 text-p-blue hover:bg-p-blue/20 transition-colors text-xs disabled:opacity-40 shrink-0"
        >
          <ImageIcon size={13} aria-hidden /> {exporting ? 'Generando...' : 'Exportar como imagen'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="glass-panel p-5">
          <label className="text-sm text-p-muted mb-1 block">Volumen Base Mensual</label>
          <input
            type="number"
            value={volumenBase}
            onChange={e => {
              const v = parseFloat(e.target.value)
              setVolumenBaseEdit(isNaN(v) ? detail.volumenBase : v)
            }}
            min={0}
            step={1}
            className="w-full text-2xl font-bold text-p-text bg-transparent border-b border-p-border focus:border-p-lime focus:outline-none"
            aria-label="Volumen Base Mensual"
          />
          <p className="text-xs text-p-muted mt-1">uds</p>
        </div>
        <div className="glass-panel p-5">
          <label className="text-sm text-p-muted mb-1 block">Precio Recomendado</label>
          <input
            type="number"
            value={precioRec}
            onChange={e => {
              const v = parseFloat(e.target.value)
              setPrecioRecEdit(isNaN(v) ? detail.precioRecomendado : v)
            }}
            min={0}
            step={1}
            className="w-full text-2xl font-bold text-p-lime bg-transparent border-b border-p-border focus:border-p-lime focus:outline-none"
            aria-label="Precio Recomendado"
          />
          <p className="text-xs text-p-muted mt-1">Sugerido por módulo de Precio Óptimo</p>
        </div>
        <div className="glass-panel p-5">
          <p className="text-sm text-p-muted mb-1">Precio Actual</p>
          <p className="text-2xl font-bold text-p-text">${detail.precioActual.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-p-muted mt-1">Referencia (no editable)</p>
        </div>
      </div>

      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-medium text-p-gray-light">Ajusta el precio simulado sobre el Precio Recomendado</h3>
          <div className="text-right">
            <span className="text-2xl font-bold text-p-text">
              ${precioSimulado.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
            </span>
            <span className={`ml-2 text-sm font-medium ${variacionVsActual >= 0 ? 'text-p-lime' : 'text-p-red'}`}>
              ({variacionVsActual >= 0 ? '+' : ''}{variacionVsActual.toFixed(1)}% vs. precio actual)
            </span>
          </div>
        </div>
        <input
          type="range"
          min={-50}
          max={50}
          step={1}
          value={sliderValue}
          onChange={(e) => setSliderValue(Number(e.target.value))}
          className="w-full accent-p-lime h-2 bg-p-border rounded-lg cursor-pointer"
        />
        <div className="flex justify-between text-xs text-p-muted mt-2">
          <span>-50% sobre recomendado</span>
          <span className="cursor-pointer hover:text-p-text" onClick={() => setSliderValue(0)}>
            0% (precio recomendado)
          </span>
          <span>+50% sobre recomendado</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="glass-panel p-5">
          <p className="text-sm text-p-muted mb-2">Nuevo Volumen Proyectado</p>
          <p className={`text-2xl font-bold ${volumenDelta >= 0 ? 'text-p-lime' : 'text-p-red'}`}>
            {Math.round(nuevoVolumen).toLocaleString('es-CO')} uds
          </p>
          {volumenDelta !== 0 && (
            <p className={`text-sm mt-1 ${volumenDelta >= 0 ? 'text-p-lime' : 'text-p-red'}`}>
              {volumenDelta >= 0 ? '+' : ''}{Math.round(volumenDelta).toLocaleString('es-CO')} uds ({volumenDeltaPct >= 0 ? '+' : ''}{volumenDeltaPct.toFixed(1)}%)
            </p>
          )}
          {detail.coeficiente === 0 && (
            <p className="text-xs text-p-muted mt-1">Sin sensibilidad al precio — el volumen no cambia</p>
          )}
        </div>

        <div className="glass-panel p-5">
          <p className="text-sm text-p-muted mb-2">Nuevos Ingresos Proyectados</p>
          <p className={`text-2xl font-bold ${ingresosDelta >= 0 ? 'text-p-lime' : 'text-p-red'}`}>
            {formatMillones(ingresosSimulados)}
          </p>
          {ingresosDelta !== 0 && (
            <p className={`text-sm mt-1 ${ingresosDelta >= 0 ? 'text-p-lime' : 'text-p-red'}`}>
              {ingresosDelta >= 0 ? '+' : ''}{formatMillones(ingresosDelta)} ({ingresosDeltaPct >= 0 ? '+' : ''}{ingresosDeltaPct.toFixed(1)}%)
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Shared Components ───────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color, sub, subColor }: {
  label: string; value: string; icon: React.ElementType; color: string
  sub?: string; subColor?: string
}) {
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm text-p-gray-light font-medium">{label}</h3>
        <Icon size={20} className={color} />
      </div>
      <p className={`text-[32px] font-bold leading-none ${color}`}>{value}</p>
      {sub && <p className={`text-[13px] mt-2 ${subColor || 'text-p-muted'}`}>{sub}</p>}
    </div>
  )
}

function DualImpactCell({ pct, abs }: { pct: number; abs: string }) {
  const cls = pct > 0 ? 'text-p-lime' : pct < 0 ? 'text-p-red' : 'text-p-muted'
  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <span className={`text-sm font-medium ${cls}`}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>
      <span className={`text-xs ${cls} opacity-80`}>{abs}</span>
    </div>
  )
}

function formatMillones(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    const m = value / 1_000_000
    return `$${m.toFixed(2)}M`
  }
  if (abs >= 1_000) {
    const k = value / 1_000
    return `$${k.toFixed(0)}K`
  }
  return `$${value.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}
