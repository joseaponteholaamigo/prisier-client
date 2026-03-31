import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, BarChart3, TrendingDown, AlertTriangle, Percent } from 'lucide-react'
import api from '../lib/api'
import type { ElasticidadKpis, ElasticidadSummaryRow, SkuElasticidadDetail } from '../lib/types'

type Tab = 'resumen' | 'simulador'

export default function ElasticidadPage() {
  const [tab, setTab] = useState<Tab>('resumen')
  const [marca, setMarca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null)

  const { data: filterOptions } = useQuery({
    queryKey: ['elasticidad-filters'],
    queryFn: () => api.get<{ marcas: string[]; categorias: string[] }>('/elasticidad/filters').then(r => r.data),
  })

  const filters = `marca=${marca}&categoria=${categoria}`

  const handleSkuClick = (skuId: string) => {
    setSelectedSkuId(skuId)
    setTab('simulador')
  }

  return (
    <div>
      {/* Filters row */}
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

      {/* Sub-tabs */}
      <div className="flex gap-4 border-b border-p-border mb-6">
        {([['resumen', 'Resumen'], ['simulador', 'Simulador por SKU']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`sub-tab ${tab === key ? 'sub-tab-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && <ResumenTab filters={filters} onSkuClick={handleSkuClick} />}
      {tab === 'simulador' && <SimuladorTab skuId={selectedSkuId} filters={filters} />}
    </div>
  )
}

// ─── Resumen Tab ─────────────────────────────────────────────

function ResumenTab({ filters, onSkuClick }: { filters: string; onSkuClick: (skuId: string) => void }) {
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['elasticidad-kpis', filters],
    queryFn: () => api.get<ElasticidadKpis>(`/elasticidad/kpis?${filters}`).then(r => r.data),
  })

  const { data: rows = [], isLoading: rowsLoading } = useQuery({
    queryKey: ['elasticidad-summary', filters],
    queryFn: () => api.get<ElasticidadSummaryRow[]>(`/elasticidad/summary?${filters}`).then(r => r.data),
  })

  if (kpisLoading || rowsLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-p-lime border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-5">
        <KpiCard
          label="SKUs con Elasticidad"
          value={String(kpis?.totalSkusConElasticidad ?? 0)}
          icon={Activity}
          color="text-p-blue"
          sub="Productos configurados"
          subColor="text-p-muted"
        />
        <KpiCard
          label="Coeficiente Promedio"
          value={String(kpis?.coeficientePromedio ?? 0)}
          icon={TrendingDown}
          color="text-p-yellow"
          sub="Sensibilidad promedio al precio"
          subColor="text-p-muted"
        />
        <KpiCard
          label="Confianza Promedio"
          value={`${kpis?.confianzaPromedio ?? 0}%`}
          icon={Percent}
          color={(kpis?.confianzaPromedio ?? 0) >= 70 ? 'text-p-lime' : 'text-p-yellow'}
          sub={
            (kpis?.confianzaPromedio ?? 0) >= 70 ? 'Nivel aceptable' : 'Revisar datos'
          }
          subColor={(kpis?.confianzaPromedio ?? 0) >= 70 ? 'text-p-lime' : 'text-p-yellow'}
        />
        <KpiCard
          label="SKU Más Elástico"
          value={kpis?.skuMasElastico?.nombre ?? '—'}
          icon={BarChart3}
          color="text-p-red"
          sub={kpis?.skuMasElastico ? `Coef: ${kpis.skuMasElastico.coeficiente}` : undefined}
          subColor="text-p-red"
        />
      </div>

      {/* Summary subtitle */}
      <p className="text-p-muted text-sm">
        Impacto proyectado con un cambio de +5% en precio — Haz clic en una fila para simular
      </p>

      {/* Summary Table */}
      <div className="glass-panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="text-right">Vol. Base</th>
              <th className="text-right">Coeficiente</th>
              <th className="text-right">Precio Actual</th>
              <th className="text-right">Impacto Vol%</th>
              <th className="text-right">Impacto Ingr%</th>
              <th className="text-right">Impacto Margen%</th>
              <th className="text-center">Confianza</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.skuId}
                className="cursor-pointer hover:bg-p-bg-hover transition-colors"
                onClick={() => onSkuClick(r.skuId)}
              >
                <td>
                  <div className="font-medium">{r.nombre}</div>
                  <div className="text-p-muted text-xs">{r.codigoSku} · {r.marca}</div>
                </td>
                <td className="text-right">{r.volumenBase.toLocaleString('es-CO')}</td>
                <td className="text-right">{r.coeficiente.toFixed(2)}</td>
                <td className="text-right">${r.precioActual.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</td>
                <td className="text-right">
                  <ImpactBadge value={r.impactoVolumenPct} />
                </td>
                <td className="text-right">
                  <ImpactBadge value={r.impactoIngresosPct} />
                </td>
                <td className="text-right">
                  <ImpactBadge value={r.impactoMargenPct} />
                </td>
                <td className="text-center">
                  <ConfianzaBadge value={r.nivelConfianza} />
                </td>
              </tr>
            ))}
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
}

// ─── Simulador Tab ───────────────────────────────────────────

function SimuladorTab({ skuId, filters }: { skuId: string | null; filters: string }) {
  const { data: summaryRows = [] } = useQuery({
    queryKey: ['elasticidad-summary', filters],
    queryFn: () => api.get<ElasticidadSummaryRow[]>(`/elasticidad/summary?${filters}`).then(r => r.data),
  })

  const [currentSkuId, setCurrentSkuId] = useState<string | null>(skuId)
  const [sliderValue, setSliderValue] = useState(0) // -50 to +50

  useEffect(() => {
    if (skuId) setCurrentSkuId(skuId)
  }, [skuId])

  useEffect(() => {
    setSliderValue(0)
  }, [currentSkuId])

  const { data: detail, isLoading } = useQuery({
    queryKey: ['elasticidad-sku', currentSkuId],
    queryFn: () => api.get<SkuElasticidadDetail>(`/elasticidad/sku/${currentSkuId}`).then(r => r.data),
    enabled: !!currentSkuId,
  })

  if (!currentSkuId) {
    return (
      <div className="glass-panel p-12 text-center text-p-muted">
        <Activity size={48} className="mx-auto mb-4 opacity-40" />
        <p className="text-lg">Selecciona un SKU para simular</p>
        <p className="text-sm mt-2">Puedes elegir uno de la lista o del dropdown arriba</p>
        {summaryRows.length > 0 && (
          <div className="mt-6">
            <select
              onChange={(e) => setCurrentSkuId(e.target.value || null)}
              className="glass-select"
            >
              <option value="">Elige un producto...</option>
              {summaryRows.map(r => (
                <option key={r.skuId} value={r.skuId}>{r.nombre} ({r.codigoSku})</option>
              ))}
            </select>
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-p-lime border-t-transparent" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="glass-panel p-12 text-center text-p-muted">
        <AlertTriangle size={48} className="mx-auto mb-4 opacity-40" />
        <p className="text-lg">No se encontró elasticidad para este SKU</p>
      </div>
    )
  }

  // ─── Calculations (client-side) ───
  const precioPct = sliderValue / 100
  const precioSimulado = detail.precioActual * (1 + precioPct)
  const cambioVolPct = detail.coeficiente * precioPct
  const nuevoVolumen = Math.max(0, detail.volumenBase * (1 + cambioVolPct))
  const volumenDelta = nuevoVolumen - detail.volumenBase
  const volumenDeltaPct = detail.volumenBase > 0 ? (volumenDelta / detail.volumenBase) * 100 : 0

  const ingresosActuales = detail.precioActual * detail.volumenBase
  const ingresosSimulados = precioSimulado * nuevoVolumen
  const ingresosDelta = ingresosSimulados - ingresosActuales
  const ingresosDeltaPct = ingresosActuales > 0 ? (ingresosDelta / ingresosActuales) * 100 : 0

  const margenActual = (detail.precioActual - detail.costoVariable) * detail.volumenBase
  const margenSimulado = (precioSimulado - detail.costoVariable) * nuevoVolumen
  const margenDelta = margenSimulado - margenActual
  const margenDeltaPct = margenActual > 0 ? (margenDelta / margenActual) * 100 : 0

  const confianzaPct = detail.confianza * 100
  const margenNegativo = margenSimulado < 0

  return (
    <div className="space-y-6">
      {/* SKU Selector */}
      <div className="flex items-center gap-4">
        <select
          value={currentSkuId}
          onChange={(e) => setCurrentSkuId(e.target.value)}
          className="glass-select"
        >
          {summaryRows.map(r => (
            <option key={r.skuId} value={r.skuId}>{r.nombre} ({r.codigoSku})</option>
          ))}
        </select>
      </div>

      {/* Alerts */}
      {confianzaPct < 50 && (
        <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3">
          <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0" />
          <span className="text-yellow-300 text-sm">
            Confianza baja ({confianzaPct.toFixed(0)}%) — Los resultados pueden ser poco confiables
          </span>
        </div>
      )}
      {margenNegativo && sliderValue !== 0 && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
          <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
          <span className="text-red-300 text-sm">
            El margen proyectado es negativo — El precio simulado no cubre el costo variable
          </span>
        </div>
      )}

      {/* Base Data Cards */}
      <div className="grid grid-cols-3 gap-5">
        <div className="glass-panel p-5">
          <p className="text-sm text-p-muted mb-1">Volumen Base</p>
          <p className="text-2xl font-bold text-p-text">{detail.volumenBase.toLocaleString('es-CO')} uds</p>
        </div>
        <div className="glass-panel p-5">
          <p className="text-sm text-p-muted mb-1">Precio Actual</p>
          <p className="text-2xl font-bold text-p-text">${detail.precioActual.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="glass-panel p-5">
          <p className="text-sm text-p-muted mb-1">Coeficiente de Elasticidad</p>
          <p className="text-2xl font-bold text-p-yellow">{detail.coeficiente.toFixed(2)}</p>
          <p className="text-xs text-p-muted mt-1">Confianza: <ConfianzaBadge value={confianzaPct} /></p>
        </div>
      </div>

      {/* Price Slider */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-p-gray-light">Ajuste de Precio</h3>
          <div className="text-right">
            <span className="text-2xl font-bold text-p-text">
              ${precioSimulado.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
            </span>
            <span className={`ml-2 text-sm font-medium ${sliderValue >= 0 ? 'text-p-lime' : 'text-p-red'}`}>
              ({sliderValue >= 0 ? '+' : ''}{sliderValue}%)
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
          <span>-50%</span>
          <span className="cursor-pointer hover:text-p-text" onClick={() => setSliderValue(0)}>0%</span>
          <span>+50%</span>
        </div>
      </div>

      {/* Result Cards */}
      <div className="grid grid-cols-3 gap-5">
        {/* Volumen */}
        <div className="glass-panel p-5">
          <p className="text-sm text-p-muted mb-2">Volumen Proyectado</p>
          <p className={`text-2xl font-bold ${volumenDelta >= 0 ? 'text-p-lime' : 'text-p-red'}`}>
            {Math.round(nuevoVolumen).toLocaleString('es-CO')} uds
          </p>
          {sliderValue !== 0 && (
            <p className={`text-sm mt-1 ${volumenDelta >= 0 ? 'text-p-lime' : 'text-p-red'}`}>
              {volumenDelta >= 0 ? '+' : ''}{Math.round(volumenDelta).toLocaleString('es-CO')} uds ({volumenDeltaPct >= 0 ? '+' : ''}{volumenDeltaPct.toFixed(1)}%)
            </p>
          )}
          {sliderValue !== 0 && detail.coeficiente === 0 && (
            <p className="text-xs text-p-muted mt-1">Elasticidad = 0 — Volumen no cambia</p>
          )}
        </div>

        {/* Ingresos */}
        <div className="glass-panel p-5">
          <p className="text-sm text-p-muted mb-2">Ingresos Proyectados</p>
          <p className={`text-2xl font-bold ${ingresosDelta >= 0 ? 'text-p-lime' : 'text-p-red'}`}>
            {formatMillones(ingresosSimulados)}
          </p>
          {sliderValue !== 0 && (
            <p className={`text-sm mt-1 ${ingresosDelta >= 0 ? 'text-p-lime' : 'text-p-red'}`}>
              {ingresosDelta >= 0 ? '+' : ''}{formatMillones(ingresosDelta)} ({ingresosDeltaPct >= 0 ? '+' : ''}{ingresosDeltaPct.toFixed(1)}%)
            </p>
          )}
        </div>

        {/* Margen */}
        <div className="glass-panel p-5">
          <p className="text-sm text-p-muted mb-2">Margen Proyectado</p>
          <p className={`text-2xl font-bold ${margenSimulado < 0 ? 'text-p-red' : margenDelta >= 0 ? 'text-p-lime' : 'text-p-red'}`}>
            {formatMillones(margenSimulado)}
          </p>
          {sliderValue !== 0 && (
            <p className={`text-sm mt-1 ${margenDelta >= 0 ? 'text-p-lime' : 'text-p-red'}`}>
              {margenDelta >= 0 ? '+' : ''}{formatMillones(margenDelta)} ({margenDeltaPct >= 0 ? '+' : ''}{margenDeltaPct.toFixed(1)}%)
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

function ImpactBadge({ value }: { value: number }) {
  const cls = value > 0 ? 'badge badge-green' : value < 0 ? 'badge badge-red' : 'badge badge-yellow'
  return <span className={cls}>{value > 0 ? '+' : ''}{value.toFixed(1)}%</span>
}

function ConfianzaBadge({ value }: { value: number }) {
  const cls = value >= 70 ? 'badge badge-green' : value >= 50 ? 'badge badge-yellow' : 'badge badge-red'
  return <span className={cls}>{value.toFixed(0)}%</span>
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
