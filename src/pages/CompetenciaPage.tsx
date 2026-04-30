import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Plot from '../lib/plotly'
import { TrendingUp, TrendingDown, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import api from '../lib/api'
import { fmtCOP } from '../lib/format'
import SeverityBadge from '../components/SeverityBadge'
import Drawer from '../components/Drawer'
import SearchInput from '../components/SearchInput'
import { useTableSearch } from '../components/useTableSearch'
import type { CompetitionKpis, BrandComparison, CompetitionDetailRow, ScatterPoint, BoxPlotSeries } from '../lib/types'
import { SkeletonKpiCards, SkeletonTable } from '../components/Skeleton'
import QueryErrorState from '../components/QueryErrorState'

type Tab = 'dashboard' | 'detalle' | 'por-marca'

export default function CompetenciaPage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [marca, setMarca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [retailer, setRetailer] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const { data: filterOptions } = useQuery({
    queryKey: ['competition-filters'],
    queryFn: () => api.get<{ marcas: string[]; categorias: string[]; retailers: string[] }>('/competition/filters').then(r => r.data),
  })

  const filters = `marca=${marca}&categoria=${categoria}&retailer=${retailer}&fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`

  return (
    <div>
      {/* Filters row */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <select
          value={categoria}
          onChange={(e) => { setCategoria(e.target.value); setMarca('') }}
          className="glass-select"
        >
          <option value="">Todas las categorías</option>
          {filterOptions?.categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={marca} onChange={(e) => setMarca(e.target.value)} className="glass-select">
          <option value="">Todas las marcas</option>
          {filterOptions?.marcas.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={retailer} onChange={(e) => setRetailer(e.target.value)} className="glass-select">
          <option value="">Todos los retailers</option>
          {filterOptions?.retailers.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input
          type="date"
          value={fechaDesde}
          onChange={(e) => setFechaDesde(e.target.value)}
          className="glass-select text-sm"
          title="Desde"
        />
        <input
          type="date"
          value={fechaHasta}
          onChange={(e) => setFechaHasta(e.target.value)}
          className="glass-select text-sm"
          title="Hasta"
        />
        {(fechaDesde || fechaHasta) && (
          <button
            onClick={() => { setFechaDesde(''); setFechaHasta('') }}
            className="text-xs text-p-muted hover:text-white transition-colors"
          >
            Limpiar fechas
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-4 border-b border-p-border mb-6">
        {([['dashboard', 'Dashboard'], ['por-marca', 'Tu precio vs. competidor por marca'], ['detalle', 'Detalle por SKU']] as const).map(([key, label]) => (
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
      {tab === 'por-marca' && <PorMarcaTab filters={filters} />}
    </div>
  )
}

function DashboardTab({ filters }: { filters: string }) {
  const { data: kpis, isLoading: kpisLoading, isError: kpisError, refetch: refetchKpis } = useQuery({
    queryKey: ['competition-dashboard', filters],
    queryFn: () => api.get<CompetitionKpis>(`/competition/dashboard?${filters}`).then(r => r.data),
  })

  const { data: scatterData = [] } = useQuery({
    queryKey: ['competition-scatter', filters],
    queryFn: () => api.get<ScatterPoint[]>(`/competition/scatter?${filters}`).then(r => r.data),
  })

  const { data: boxData = [] } = useQuery({
    queryKey: ['competition-boxplot', filters],
    queryFn: () => api.get<BoxPlotSeries[]>(`/competition/boxplot?${filters}`).then(r => r.data),
  })

  if (kpisLoading) {
    return (
      <div className="space-y-6">
        <SkeletonKpiCards count={4} />
        <div className="glass-panel p-6 space-y-3" aria-hidden="true">
          <div className="animate-pulse bg-white/10 rounded-lg h-4 w-1/4" />
          <div className="animate-pulse bg-white/10 rounded-lg h-52 w-full" />
        </div>
      </div>
    )
  }

  if (kpisError) {
    return (
      <div className="glass-panel">
        <QueryErrorState onRetry={refetchKpis} message="No se pudo cargar el dashboard de competencia." />
      </div>
    )
  }

  const diff = kpis?.diferencialPromedio ?? 0

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-5">
        <KpiCard
          label="Diferencia de precio vs. competencia"
          value={`${diff >= 0 ? '+' : ''}${diff}%`}
          icon={diff >= 0 ? TrendingUp : TrendingDown}
          color={diff > 0 ? 'text-p-red' : 'text-p-lime'}
          sub={diff > 0
            ? `${Math.abs(diff)}% por encima del mercado`
            : diff < 0
              ? `${Math.abs(diff)}% por debajo del mercado`
              : 'Alineados con el mercado'}
          subColor={diff > 0 ? 'text-p-red' : 'text-p-lime'}
        />
        <KpiCard
          label="Productos con precio de referencia"
          value={String(kpis?.totalSkusComparados ?? 0)}
          icon={Users}
          color="text-p-blue"
          sub={`Comparado con ${kpis?.totalCompetidores ?? 0} competidores`}
          subColor="text-p-muted"
        />
        <KpiCard
          label="Producto más caro que su competidor"
          value={kpis?.skuMasCaro?.nombre ?? '—'}
          icon={ArrowUpRight}
          color="text-p-red"
          sub={kpis?.skuMasCaro ? `${kpis.skuMasCaro.diferencialPct}% sobre el precio de referencia` : undefined}
          subColor="text-p-red"
        />
        <KpiCard
          label="Producto más barato que su competidor"
          value={kpis?.skuMasBarato?.nombre ?? '—'}
          icon={ArrowDownRight}
          color="text-p-lime"
          sub={kpis?.skuMasBarato ? `${Math.abs(kpis.skuMasBarato.diferencialPct)}% por debajo del precio de referencia` : undefined}
          subColor="text-p-lime"
        />
      </div>

      {/* Scatter Plot — Top N by highest differential */}
      {scatterData.length > 0 && (() => {
        const SCATTER_TOP = 20

        // Group by client SKU name, calculate avg differential
        const bySkuCliente = new Map<string, { client: number[]; comp: number[] }>()
        for (const p of scatterData) {
          const key = p.skuClienteNombre
          if (!bySkuCliente.has(key)) bySkuCliente.set(key, { client: [], comp: [] })
          const entry = bySkuCliente.get(key)!
          if (p.tipo === 'cliente') entry.client.push(p.precio)
          else entry.comp.push(p.precio)
        }

        const diffs = [...bySkuCliente.entries()]
          .filter(([, v]) => v.client.length > 0 && v.comp.length > 0)
          .map(([name, v]) => {
            const avgClient = v.client.reduce((a, b) => a + b, 0) / v.client.length
            const avgComp = v.comp.reduce((a, b) => a + b, 0) / v.comp.length
            return { name, absDiff: Math.abs(avgClient - avgComp) }
          })
          .sort((a, b) => b.absDiff - a.absDiff)

        const topSkuNames = new Set(diffs.slice(0, SCATTER_TOP).map(d => d.name))
        const filtered = scatterData.filter(p => topSkuNames.has(p.skuClienteNombre))
        const clientPoints = filtered.filter(p => p.tipo === 'cliente')
        const compPoints = filtered.filter(p => p.tipo === 'competidor')
        const totalProducts = bySkuCliente.size

        const truncate = (s: string, max = 18) => s.length > max ? s.slice(0, max) + '...' : s

        return (
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Comparación de precios por producto</h3>
              {totalProducts > SCATTER_TOP && (
                <span className="text-xs text-p-muted">Mostrando los {SCATTER_TOP} productos con mayor diferencia (de {totalProducts} totales)</span>
              )}
            </div>
            <Plot
              data={[
                {
                  x: clientPoints.map(p => truncate(p.skuClienteNombre)),
                  y: clientPoints.map(p => p.precio),
                  customdata: clientPoints.map(p => [p.nombreProducto, p.retailer]),
                  type: 'scatter',
                  mode: 'markers',
                  name: 'Cliente',
                  marker: { color: '#60CAFF', size: 10, symbol: 'circle' },
                  hovertemplate: '<b>%{customdata[0]}</b><br>$%{y:,.0f} — %{customdata[1]}<extra>Cliente</extra>',
                },
                {
                  x: compPoints.map(p => truncate(p.skuClienteNombre)),
                  y: compPoints.map(p => p.precio),
                  customdata: compPoints.map(p => [p.nombreProducto, p.retailer]),
                  type: 'scatter',
                  mode: 'markers',
                  name: 'Competidores',
                  marker: { color: '#FF5757', size: 10, symbol: 'diamond' },
                  hovertemplate: '<b>%{customdata[0]}</b><br>$%{y:,.0f} — %{customdata[1]}<extra>Competidor</extra>',
                },
              ]}
              layout={{
                height: 320,
                margin: { t: 30, b: 100, l: 70, r: 20 },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                xaxis: {
                  color: '#8e919e',
                  gridcolor: 'rgba(255,255,255,0.05)',
                  tickangle: -45,
                  tickfont: { size: 11, color: '#D5D5D7' },
                },
                yaxis: {
                  color: '#8e919e',
                  gridcolor: 'rgba(255,255,255,0.05)',
                  title: { text: 'Precio ($)', font: { color: '#8e919e', size: 12 } },
                  tickprefix: '$',
                },
                legend: {
                  font: { color: '#D5D5D7' },
                  bgcolor: 'transparent',
                },
                showlegend: true,
              }}
              config={{ responsive: true, displayModeBar: false }}
              className="w-full"
            />
          </div>
        )
      })()}

      {/* Box Plot */}
      {boxData.length > 0 && (
        <div className="glass-panel p-6">
          <h3 className="text-base font-semibold text-white mb-4">Distribución de Precios por Retailer</h3>
          {(() => {
            const clientSeries = boxData.filter(b => b.nombre === 'Cliente')
            const compSeries = boxData.filter(b => b.nombre === 'Competidores')

            const traces: Plotly.Data[] = []

            if (clientSeries.length > 0) {
              traces.push({
                y: clientSeries.flatMap(s => s.precios),
                x: clientSeries.flatMap(s => s.precios.map(() => s.retailer)),
                type: 'box',
                name: 'Cliente',
                marker: { color: '#60CAFF' },
                boxpoints: false,
              })
            }
            if (compSeries.length > 0) {
              traces.push({
                y: compSeries.flatMap(s => s.precios),
                x: compSeries.flatMap(s => s.precios.map(() => s.retailer)),
                type: 'box',
                name: 'Competidores',
                marker: { color: '#FF5757' },
                boxpoints: false,
              })
            }

            return (
              <Plot
                data={traces}
                layout={{
                  height: 320,
                  margin: { t: 30, b: 60, l: 70, r: 20 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  boxmode: 'group',
                  xaxis: {
                    color: '#8e919e',
                    gridcolor: 'transparent',
                    tickfont: { size: 13, color: '#D5D5D7' },
                  },
                  yaxis: {
                    color: '#8e919e',
                    gridcolor: 'rgba(255,255,255,0.05)',
                    title: { text: 'Precio ($)', font: { color: '#8e919e', size: 12 } },
                    tickprefix: '$',
                  },
                  legend: {
                    font: { color: '#D5D5D7' },
                    bgcolor: 'transparent',
                  },
                  showlegend: true,
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full"
              />
            )
          })()}
        </div>
      )}

      {scatterData.length === 0 && !kpisLoading && (
        <div className="glass-panel p-12 text-center text-p-muted">
          No hay datos de competencia para los filtros seleccionados
        </div>
      )}
    </div>
  )
}

type DetalleChip = 'todos' | 'mas-caro' | 'mas-barato' | 'sin-competidor'

function DetalleTab({ filters }: { filters: string }) {
  const [page, setPage] = useState(1)
  const [chip, setChip] = useState<DetalleChip>('todos')
  const [drawerRow, setDrawerRow] = useState<CompetitionDetailRow | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['competition-detail', filters, page],
    queryFn: async () => {
      const res = await api.get<CompetitionDetailRow[]>(`/competition/detail?${filters}&page=${page}&pageSize=25`)
      return {
        rows: res.data,
        total: parseInt(res.headers['x-total-count'] || '0'),
      }
    },
  })

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 25)

  const [searchFiltered, search, setSearch] = useTableSearch(rows, ['nombre', 'codigoSku'])

  if (isLoading) {
    return (
      <div className="glass-panel overflow-x-auto">
        <table className="data-table">
          <tbody><SkeletonTable rows={10} columns={8} /></tbody>
        </table>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="glass-panel">
        <QueryErrorState onRetry={refetch} message="No se pudo cargar el detalle de competencia." />
      </div>
    )
  }

  const chipFiltered = searchFiltered.filter(r => {
    if (chip === 'mas-caro') return r.diferencialPct > 0
    if (chip === 'mas-barato') return r.diferencialPct < 0
    if (chip === 'sin-competidor') return !r.competidorPrincipal
    return true
  })

  return (
    <div>
      {/* Search + chips */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar producto o código..." />
        {(['todos', 'mas-caro', 'mas-barato', 'sin-competidor'] as DetalleChip[]).map(c => (
          <button
            key={c}
            onClick={() => setChip(c)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              chip === c
                ? 'bg-p-lime/20 text-p-lime border border-p-lime/40'
                : 'border border-p-border text-p-muted hover:text-white'
            }`}
          >
            {c === 'todos' ? 'Todos' : c === 'mas-caro' ? 'Más caro que competencia' : c === 'mas-barato' ? 'Más barato que competencia' : 'Sin competidor'}
          </button>
        ))}
      </div>

      <div className="glass-panel overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '9%' }}>SKU</th>
              <th style={{ width: '17%' }}>Producto</th>
              <th style={{ width: '10%' }}>Marca</th>
              <th style={{ width: '13%' }} className="text-right">Precio Cliente</th>
              <th style={{ width: '17%' }}>Competidor Principal</th>
              <th style={{ width: '14%' }} className="text-right">Precio Competidor</th>
              <th style={{ width: '10%' }} className="text-right">Diferencia ($)</th>
              <th style={{ width: '10%' }} className="text-right">Diferencia (%)</th>
            </tr>
          </thead>
          <tbody>
            {chipFiltered.map((r) => {
              const abs = Math.abs(r.diferencialPct)
              const rowBg = abs > 5
                ? 'rgba(255,107,107,0.06)'
                : abs > 3 ? 'rgba(245,197,24,0.05)' : undefined
              return (
              <tr
                key={r.skuId}
                style={{ ...(rowBg ? { backgroundColor: rowBg } : {}), cursor: 'pointer' }}
                onClick={() => setDrawerRow(r)}
                className="hover:bg-white/5 transition-colors"
              >
                <td className="font-mono text-p-muted text-xs" title={r.codigoSku}>{r.codigoSku}</td>
                <td className="font-medium text-white" title={r.nombre}>{r.nombre}</td>
                <td className="text-p-gray-light" title={r.marca}>{r.marca}</td>
                <td className="text-right text-p-blue font-semibold">{fmtCOP(r.precioPromedioCliente)}</td>
                <td className="text-p-gray-light">{r.competidorPrincipal}</td>
                <td className="text-right text-white font-semibold">{fmtCOP(r.precioCompetidor)}</td>
                <td className="text-right">
                  <span className={r.diferencialAbsoluto > 0 ? 'text-p-red' : 'text-p-lime'}>
                    {r.diferencialAbsoluto > 0 ? '+' : ''}{fmtCOP(r.diferencialAbsoluto)}
                  </span>
                </td>
                <td className="text-right">
                  <SeverityBadge value={r.diferencialPct} />
                </td>
              </tr>
              )
            })}
            {chipFiltered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-p-muted">
                  No hay competidores configurados para los productos mostrados
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

      {/* Competitor Drawer — M2-3 */}
      <Drawer
        isOpen={drawerRow !== null}
        onClose={() => setDrawerRow(null)}
        title={drawerRow?.nombre ?? ''}
        subtitle={drawerRow ? `${drawerRow.codigoSku} · ${drawerRow.marca} · tu precio: ${fmtCOP(drawerRow.precioPromedioCliente)}` : undefined}
      >
        {drawerRow && <CompetidorDrawerContent row={drawerRow} />}
      </Drawer>
    </div>
  )
}

function CompetidorDrawerContent({ row }: { row: CompetitionDetailRow }) {
  if (!row.competidorPrincipal) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
        <p className="text-[15px] font-medium text-p-gray-light">Sin competidores registrados</p>
        <p className="text-[13px] text-p-muted max-w-xs">No se encontraron competidores para este producto.</p>
      </div>
    )
  }

  const diff = row.diferencialPct
  const isMoreExpensive = diff > 0
  const analysis = isMoreExpensive
    ? `Eres más caro que ${row.competidorPrincipal} en un ${Math.abs(diff).toFixed(1)}%.`
    : diff < 0
      ? `Eres más barato que ${row.competidorPrincipal} en un ${Math.abs(diff).toFixed(1)}%.`
      : `Tus precios están alineados con ${row.competidorPrincipal}.`

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-xs font-semibold text-p-muted uppercase tracking-wide mb-3">Competidores observados</h4>
        <div className="rounded-lg border border-p-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-p-border bg-white/3">
                <th className="text-left py-2 px-4 text-p-muted font-medium">Competidor</th>
                <th className="text-right py-2 px-4 text-p-muted font-medium">Precio</th>
                <th className="text-right py-2 px-4 text-p-muted font-medium">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-3 px-4 text-white">{row.competidorPrincipal}</td>
                <td className="py-3 px-4 text-right text-white font-semibold">{fmtCOP(row.precioCompetidor)}</td>
                <td className="py-3 px-4 text-right">
                  <SeverityBadge value={row.diferencialPct} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg bg-white/5 border border-p-border px-4 py-3">
        <p className="text-sm text-p-gray-light">{analysis}</p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-p-muted">Tu precio promedio</span>
          <span className="text-p-blue font-semibold">{fmtCOP(row.precioPromedioCliente)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-p-muted">Precio competidor</span>
          <span className="text-white font-semibold">{fmtCOP(row.precioCompetidor)}</span>
        </div>
        <div className="flex justify-between text-sm border-t border-p-border pt-2 mt-2">
          <span className="text-p-muted">Diferencia absoluta</span>
          <span className={row.diferencialAbsoluto > 0 ? 'text-p-red font-semibold' : 'text-p-lime font-semibold'}>
            {row.diferencialAbsoluto > 0 ? '+' : ''}{fmtCOP(row.diferencialAbsoluto)}
          </span>
        </div>
      </div>
    </div>
  )
}

const BRAND_COMP_PAGE_SIZE = 10

function PorMarcaTab({ filters }: { filters: string }) {
  const [page, setPage] = useState(1)

  useEffect(() => { setPage(1) }, [filters])

  const { data: brands = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['competition-brand', filters],
    queryFn: () => api.get<BrandComparison[]>(`/competition/brand?${filters}`).then(r => r.data),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="glass-panel p-6 space-y-3" aria-hidden="true">
          <div className="animate-pulse bg-white/10 rounded-lg h-4 w-1/3" />
          <div className="animate-pulse bg-white/10 rounded-lg h-52 w-full" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="glass-panel">
        <QueryErrorState onRetry={refetch} message="No se pudo cargar la comparativa por marca." />
      </div>
    )
  }

  const totalPages = Math.ceil(brands.length / BRAND_COMP_PAGE_SIZE)
  const pagedBrands = brands.slice((page - 1) * BRAND_COMP_PAGE_SIZE, page * BRAND_COMP_PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Grouped bar chart — paginated */}
      {pagedBrands.length > 0 && (
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Precio promedio tuyo vs. competidor principal, por marca</h3>
            {brands.length > BRAND_COMP_PAGE_SIZE && (
              <span className="text-xs text-p-muted">{page} / {totalPages} — {brands.length} marcas</span>
            )}
          </div>
          <Plot
            data={[
              {
                x: pagedBrands.map(b => b.marca),
                y: pagedBrands.map(b => b.precioPromedioCliente),
                type: 'bar',
                name: 'Cliente',
                marker: { color: '#60CAFF' },
                text: pagedBrands.map(b => fmtCOP(b.precioPromedioCliente)),
                textposition: 'outside' as const,
                textfont: { color: '#D5D5D7', size: 11 },
              },
              {
                x: pagedBrands.map(b => b.marca),
                y: pagedBrands.map(b => b.precioPromedioCompetidor),
                type: 'bar',
                name: 'Competidor Principal',
                marker: { color: 'rgba(142, 145, 158, 0.6)' },
                text: pagedBrands.map(b => fmtCOP(b.precioPromedioCompetidor)),
                textposition: 'outside' as const,
                textfont: { color: '#D5D5D7', size: 11 },
              },
            ]}
            layout={{
              height: 300,
              margin: { t: 30, b: 60, l: 70, r: 20 },
              barmode: 'group',
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
                tickprefix: '$',
              },
              legend: {
                font: { color: '#D5D5D7' },
                bgcolor: 'transparent',
              },
              showlegend: true,
            }}
            config={{ responsive: true, displayModeBar: false }}
            className="w-full"
          />
        </div>
      )}

      {/* Brand table — synced with chart page */}
      <div className="glass-panel overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '18%' }}>Marca</th>
              <th style={{ width: '18%' }} className="text-right">Precio prom. tuyo</th>
              <th style={{ width: '18%' }} className="text-right">Precio prom. competidor</th>
              <th style={{ width: '15%' }} className="text-right">Variación</th>
              <th style={{ width: '12%' }} className="text-right">SKUs</th>
              <th style={{ width: '19%' }} className="text-right" title="Diferencia de precio multiplicada por el número de productos propios de la marca. Indica el potencial de ajuste en términos monetarios.">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {pagedBrands.map(b => (
              <tr key={b.marca}>
                <td className="font-medium text-white" title={b.marca}>{b.marca}</td>
                <td className="text-right text-p-blue font-semibold">{fmtCOP(b.precioPromedioCliente)}</td>
                <td className="text-right text-p-gray-light">{fmtCOP(b.precioPromedioCompetidor)}</td>
                <td className="text-right">
                  <SeverityBadge value={b.diferencialPct} />
                </td>
                <td className="text-right text-p-gray-light">{b.skuCount}</td>
                <td className="text-right text-p-muted">
                  {b.skuCount > 0 ? `$${(Math.abs(b.precioPromedioCompetidor - b.precioPromedioCliente) * b.skuCount).toLocaleString('es-CO', { maximumFractionDigits: 0 })}` : '—'}
                </td>
              </tr>
            ))}
            {pagedBrands.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-p-muted">
                  No hay datos de competencia para los filtros seleccionados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-p-muted">{brands.length} marcas</p>
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

