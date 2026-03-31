import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Plot from '../lib/plotly'
import { TrendingUp, TrendingDown, AlertTriangle, Box, Store } from 'lucide-react'
import api from '../lib/api'
import type { DashboardKpis, BrandExecution, DetailRow, ProfitPoolItem } from '../lib/types'

type Tab = 'dashboard' | 'detalle' | 'profit-pool'

export default function EjecucionPage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [marca, setMarca] = useState('')
  const [retailer, setRetailer] = useState('')

  const { data: filterOptions } = useQuery({
    queryKey: ['execution-filters'],
    queryFn: () => api.get<{ marcas: string[]; retailers: string[] }>('/execution/filters').then(r => r.data),
  })

  const filters = `marca=${marca}&retailer=${retailer}`

  return (
    <div>
      {/* Filters row */}
      <div className="flex items-center gap-4 mb-6">
        <select
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          className="glass-select"
        >
          <option value="">Todas las marcas</option>
          {filterOptions?.marcas.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={retailer}
          onChange={(e) => setRetailer(e.target.value)}
          className="glass-select"
        >
          <option value="">Todos los retailers</option>
          {filterOptions?.retailers.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-4 border-b border-p-border mb-6">
        {([['dashboard', 'Dashboard'], ['detalle', 'Detalle por SKU y Retailer'], ['profit-pool', 'Priorización por Profit Pool']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`sub-tab ${tab === key ? 'sub-tab-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab filters={filters} />}
      {tab === 'detalle' && <DetalleTab filters={filters} />}
      {tab === 'profit-pool' && <ProfitPoolTab filters={filters} />}
    </div>
  )
}

const BRAND_PAGE_SIZE = 10

function DashboardTab({ filters }: { filters: string }) {
  const [brandPage, setBrandPage] = useState(1)

  useEffect(() => { setBrandPage(1) }, [filters])

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['execution-dashboard', filters],
    queryFn: () => api.get<DashboardKpis>(`/execution/dashboard?${filters}`).then(r => r.data),
  })

  const { data: brands = [] } = useQuery({
    queryKey: ['execution-brand', filters],
    queryFn: () => api.get<BrandExecution[]>(`/execution/brand?${filters}`).then(r => r.data),
  })

  if (kpisLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-p-lime border-t-transparent" />
      </div>
    )
  }

  const desviacion = kpis?.desviacionPromedio ?? 100
  const desviacionDiff = desviacion - 100

  return (
    <div className="space-y-6">
      {/* KPI Cards - 4 columns */}
      <div className="grid grid-cols-4 gap-5">
        <KpiCard
          label="Índice Ejecución Total"
          value={`${desviacion}%`}
          icon={desviacionDiff >= 0 ? TrendingUp : TrendingDown}
          color={Math.abs(desviacionDiff) <= 5 ? 'text-p-lime' : 'text-p-red'}
          sub={`${desviacionDiff >= 0 ? '+' : ''}${desviacionDiff.toFixed(0)}% ${desviacionDiff >= 0 ? 'por encima del sugerido' : 'por debajo del sugerido'}`}
          subColor={Math.abs(desviacionDiff) <= 5 ? 'text-p-lime' : 'text-p-red'}
        />
        <KpiCard
          label="SKUs Monitoreados"
          value={String(kpis?.totalSkus ?? 0)}
          icon={Box}
          color="text-p-blue"
          sub={`— Cobertura del 100%`}
          subColor="text-p-muted"
        />
        <KpiCard
          label="SKUs Desfasados (>5%)"
          value={String(kpis?.skusCriticos ?? 0)}
          icon={AlertTriangle}
          color="text-p-red"
          sub="Urge revisión con key accounts"
          subColor="text-p-red"
          alert={!!kpis?.skusCriticos}
        />
        <KpiCard
          label="Mayor Desviación"
          value={kpis?.retailerMayorDesviacion?.retailer ?? '—'}
          icon={Store}
          color="text-p-blue"
          sub={kpis?.retailerMayorDesviacion
            ? `Promedio ${kpis.retailerMayorDesviacion.desviacion > 100 ? '+' : ''}${(kpis.retailerMayorDesviacion.desviacion - 100).toFixed(0)}% vs Sugerido`
            : undefined}
          subColor="text-p-red"
        />
      </div>

      {/* Brand Chart + Table (paginated together) */}
      {brands.length > 0 && (() => {
        const brandTotalPages = Math.ceil(brands.length / BRAND_PAGE_SIZE)
        const pagedBrands = brands.slice((brandPage - 1) * BRAND_PAGE_SIZE, brandPage * BRAND_PAGE_SIZE)

        return (
          <>
            <div className="glass-panel p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Índice de Ejecución por Marca</h3>
                {brands.length > BRAND_PAGE_SIZE && (
                  <span className="text-xs text-p-muted">{brandPage} / {brandTotalPages} — {brands.length} marcas</span>
                )}
              </div>
              <Plot
                data={[
                  {
                    x: pagedBrands.map(b => b.marca),
                    y: pagedBrands.map(b => b.desviacionPct),
                    type: 'bar',
                    marker: {
                      color: pagedBrands.map(b =>
                        b.desviacionPct > 105 ? '#FF5757'
                        : b.desviacionPct < 95 ? '#F4CD29'
                        : '#AEC911'
                      ),
                      borderRadius: 4,
                    },
                    text: pagedBrands.map(b => `${b.desviacionPct}%`),
                    textposition: 'outside' as const,
                    textfont: { color: '#D5D5D7', size: 12 },
                    hovertemplate: '%{x}<br>Ejecución: %{y}%<extra></extra>',
                  },
                ]}
                layout={{
                  height: 280,
                  margin: { t: 30, b: 60, l: 50, r: 20 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  xaxis: {
                    color: '#8e919e',
                    gridcolor: 'transparent',
                    tickfont: { size: 13, color: '#D5D5D7' },
                  },
                  yaxis: {
                    color: '#8e919e',
                    gridcolor: 'rgba(255,255,255,0.05)',
                    range: [80, 120],
                    ticksuffix: '%',
                  },
                  shapes: [{
                    type: 'line',
                    x0: -0.5,
                    x1: pagedBrands.length - 0.5,
                    y0: 100,
                    y1: 100,
                    line: { color: 'rgba(255,255,255,0.5)', width: 1, dash: 'dash' },
                  }],
                  annotations: [{
                    x: pagedBrands.length - 0.5,
                    y: 100,
                    text: 'Sugerido (100%)',
                    showarrow: false,
                    font: { size: 11, color: 'rgba(255,255,255,0.6)' },
                    xanchor: 'right',
                    yanchor: 'bottom',
                  }],
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full"
              />
            </div>

            <div className="glass-panel overflow-hidden">
              <div className="px-6 py-4 border-b border-p-border flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">Detalle de Ejecución por SKU y Retailer</h3>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '20%' }}>Marca</th>
                    <th style={{ width: '20%' }} className="text-right">PVP Sugerido Prom.</th>
                    <th style={{ width: '25%' }} className="text-right">Precio Observado Prom.</th>
                    <th style={{ width: '20%' }} className="text-right">Desviación</th>
                    <th style={{ width: '15%' }} className="text-right">SKUs</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedBrands.map(b => (
                    <tr key={b.marca}>
                      <td className="font-medium text-white" title={b.marca}>{b.marca}</td>
                      <td className="text-right text-p-gray-light">${b.pvpSugeridoPromedio.toLocaleString()}</td>
                      <td className="text-right text-p-gray-light">${b.precioObservadoPromedio.toLocaleString()}</td>
                      <td className="text-right">
                        <DesviacionBadge value={b.desviacionPct} />
                      </td>
                      <td className="text-right text-p-gray-light">{b.skuCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {brandTotalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-p-muted">{brands.length} marcas</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBrandPage(p => Math.max(1, p - 1))}
                    disabled={brandPage === 1}
                    className="px-4 py-2 rounded-lg border border-p-border text-sm text-p-gray-light
                               disabled:opacity-30 hover:bg-white/5 transition-colors"
                  >
                    Anterior
                  </button>
                  <span className="px-4 py-2 text-sm text-p-muted">{brandPage} / {brandTotalPages}</span>
                  <button
                    onClick={() => setBrandPage(p => Math.min(brandTotalPages, p + 1))}
                    disabled={brandPage === brandTotalPages}
                    className="px-4 py-2 rounded-lg border border-p-border text-sm text-p-gray-light
                               disabled:opacity-30 hover:bg-white/5 transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )
      })()}
    </div>
  )
}

function DetalleTab({ filters }: { filters: string }) {
  const [page, setPage] = useState(1)

  useEffect(() => { setPage(1) }, [filters])

  const { data, isLoading } = useQuery({
    queryKey: ['execution-detail', filters, page],
    queryFn: async () => {
      const res = await api.get<DetailRow[]>(`/execution/detail?${filters}&page=${page}&pageSize=25`)
      return {
        rows: res.data,
        total: parseInt(res.headers['x-total-count'] || '0'),
      }
    },
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-p-lime border-t-transparent" />
      </div>
    )
  }

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 25)

  return (
    <div>
      <div className="glass-panel overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '10%' }}>SKU</th>
              <th style={{ width: '20%' }}>Producto</th>
              <th style={{ width: '12%' }}>Marca</th>
              <th style={{ width: '13%' }} className="text-right">PVP Sugerido</th>
              <th style={{ width: '10%' }}>Retailer</th>
              <th style={{ width: '13%' }} className="text-right">Precio Obs.</th>
              <th style={{ width: '12%' }} className="text-right">Desviación</th>
              <th style={{ width: '10%' }}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.skuId}-${r.retailer}-${i}`}>
                <td className="font-mono text-p-muted text-xs" title={r.codigoSku}>{r.codigoSku}</td>
                <td className="font-medium text-white" title={r.nombre}>{r.nombre}</td>
                <td className="text-p-gray-light" title={r.marca}>{r.marca}</td>
                <td className="text-right text-p-lime font-semibold">${r.pvpSugerido.toLocaleString()}</td>
                <td className="text-p-gray-light">{r.retailer}</td>
                <td className="text-right text-white font-semibold">${r.precioObservado.toLocaleString()}</td>
                <td className="text-right">
                  <DesviacionBadge value={r.desviacionPct} />
                </td>
                <td className="text-p-muted text-xs">{r.fechaScraping}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-p-muted">
                  Aún no hay datos de precios para este periodo
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-p-muted">{total} registros</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg border border-p-border text-sm text-p-gray-light
                         disabled:opacity-30 hover:bg-white/5 transition-colors"
            >
              Anterior
            </button>
            <span className="px-4 py-2 text-sm text-p-muted">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-lg border border-p-border text-sm text-p-gray-light
                         disabled:opacity-30 hover:bg-white/5 transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const PROFIT_PAGE_SIZE = 25
const PROFIT_CHART_TOP = 15

function ProfitPoolTab({ filters }: { filters: string }) {
  const [page, setPage] = useState(1)

  useEffect(() => { setPage(1) }, [filters])

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['execution-profit-pool', filters],
    queryFn: () => api.get<ProfitPoolItem[]>(`/execution/profit-pool?${filters}`).then(r => r.data),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-p-lime border-t-transparent" />
      </div>
    )
  }

  const chartItems = items.slice(0, PROFIT_CHART_TOP)
  const totalPages = Math.ceil(items.length / PROFIT_PAGE_SIZE)
  const pagedItems = items.slice((page - 1) * PROFIT_PAGE_SIZE, page * PROFIT_PAGE_SIZE)

  return (
    <div className="space-y-6">
      {chartItems.length > 0 && (
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Priorización por Profit Pool</h3>
            {items.length > PROFIT_CHART_TOP && (
              <span className="text-xs text-p-muted">Top {PROFIT_CHART_TOP} de {items.length} SKUs</span>
            )}
          </div>
          <Plot
            data={[{
              x: chartItems.map(i => i.nombre),
              y: chartItems.map(i => i.pesoProfitPool),
              type: 'bar',
              marker: {
                color: chartItems.map(i =>
                  Math.abs(i.desviacionActual - 100) > 5 ? '#FF5757' : '#AEC911'
                ),
              },
              text: chartItems.map(i => `${i.pesoProfitPool}%`),
              textposition: 'outside' as const,
              textfont: { color: '#D5D5D7', size: 11 },
            }]}
            layout={{
              height: 280,
              margin: { t: 20, b: 100, l: 50, r: 20 },
              xaxis: {
                tickangle: -45,
                color: '#8e919e',
                gridcolor: 'transparent',
                tickfont: { size: 11, color: '#D5D5D7' },
              },
              yaxis: {
                title: { text: 'Peso (%)', font: { color: '#8e919e', size: 12 } },
                color: '#8e919e',
                gridcolor: 'rgba(255,255,255,0.05)',
              },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
            }}
            config={{ responsive: true, displayModeBar: false }}
            className="w-full"
          />
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-p-muted">{items.length} SKUs</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg border border-p-border text-sm text-p-gray-light
                         disabled:opacity-30 hover:bg-white/5 transition-colors"
            >
              Anterior
            </button>
            <span className="px-4 py-2 text-sm text-p-muted">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-lg border border-p-border text-sm text-p-gray-light
                         disabled:opacity-30 hover:bg-white/5 transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      <div className="glass-panel overflow-hidden">
        <div className="max-h-[65vh] overflow-y-auto">
          <table className="data-table">
            <thead className="sticky top-0 z-10">
              <tr>
                <th style={{ width: '25%' }}>Producto</th>
                <th style={{ width: '15%' }}>Marca</th>
                <th style={{ width: '15%' }} className="text-right">Peso (%)</th>
                <th style={{ width: '15%' }} className="text-right">PVP Sugerido</th>
                <th style={{ width: '15%' }} className="text-right">Desviación</th>
                <th style={{ width: '15%' }} className="text-center">Prioridad</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map(i => (
                <tr key={i.skuId}>
                  <td className="font-medium text-white" title={i.nombre}>{i.nombre}</td>
                  <td className="text-p-gray-light" title={i.marca}>{i.marca}</td>
                  <td className="text-right text-p-blue font-semibold">{i.pesoProfitPool}%</td>
                  <td className="text-right text-p-gray-light">${i.pvpSugerido.toLocaleString()}</td>
                  <td className="text-right">
                    <DesviacionBadge value={i.desviacionActual} />
                  </td>
                  <td className="text-center">
                    <PrioridadBadge value={i.prioridad} />
                  </td>
                </tr>
              ))}
              {pagedItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-p-muted">
                    No hay datos de profit pool
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon: Icon, color, sub, subColor, alert }: {
  label: string; value: string; icon: React.ElementType; color: string
  sub?: string; subColor?: string; alert?: boolean
}) {
  return (
    <div className={`metric-card ${alert ? 'metric-card-alert' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm text-p-gray-light font-medium">{label}</h3>
        <Icon size={20} className={color} />
      </div>
      <p className={`text-[32px] font-bold leading-none ${color}`}>{value}</p>
      {sub && <p className={`text-[13px] mt-2 ${subColor || 'text-p-muted'}`}>{sub}</p>}
    </div>
  )
}

function DesviacionBadge({ value }: { value: number }) {
  const diff = Math.abs(value - 100)
  const cls = diff > 5 ? 'badge badge-red'
    : diff > 3 ? 'badge badge-yellow'
    : 'badge badge-green'

  return <span className={cls}>{value.toFixed(1)}%</span>
}

function PrioridadBadge({ value }: { value: string }) {
  const cls = value === 'Alta' ? 'badge badge-red'
    : value === 'Media' ? 'badge badge-yellow'
    : 'badge badge-green'

  return <span className={cls}>{value}</span>
}
