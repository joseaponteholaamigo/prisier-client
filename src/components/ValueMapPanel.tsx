import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import Plot from '../lib/plotly'
import api from '../lib/api'
import type { ValueMapData } from '../lib/types'
import QueryErrorState from './QueryErrorState'

export function AlertaConfiguracion() {
  const adminUrl = import.meta.env.VITE_ADMIN_URL || 'http://localhost:5173'
  const targetUrl = `${adminUrl.replace(/\/$/, '')}/reglas?tab=atributos`
  return (
    <div className="bg-yellow-900/20 border border-yellow-600/40 rounded-lg p-4 mb-3 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-100">
          <p className="font-semibold mb-1">No es posible calcular el precio óptimo para este SKU</p>
          <p className="text-xs text-yellow-200/80">
            La pendiente del ajuste es negativa, lo que sugiere un problema de configuración (atributos del SKU, calificaciones VP o precios de competencia).
          </p>
        </div>
      </div>
      <a
        href={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-200 hover:bg-yellow-500/30 transition-colors text-xs"
      >
        Ir a configuraciones <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  )
}

export function RecomendacionBadge({ rec }: { rec: string; variacion: number }) {
  if (rec === 'Subir') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-900/40 text-green-300 border border-green-700/40">
        <TrendingUp className="w-3 h-3" /> Aumentar precio
      </span>
    )
  }
  if (rec === 'Bajar') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-900/40 text-red-300 border border-red-700/40">
        <TrendingDown className="w-3 h-3" /> Reducir precio
      </span>
    )
  }
  if (rec === 'Mantener') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800/40 text-gray-400 border border-gray-700/40">
        <Minus className="w-3 h-3" /> Mantener precio
      </span>
    )
  }
  return <span className="text-xs text-p-muted">{rec}</span>
}

export default function ValueMapPanel({ skuId }: { skuId: string }) {
  const navigate = useNavigate()

  const { data: mapData, isLoading, isError, refetch } = useQuery({
    queryKey: ['pricing-valuemap', skuId],
    queryFn: () => api.get<ValueMapData>(`/pricing/valuemap/${skuId}`).then(r => r.data),
    enabled: !!skuId,
  })

  if (isLoading) {
    return (
      <div className="glass-panel p-4 space-y-3" aria-hidden="true">
        <div className="animate-pulse bg-white/10 rounded-lg h-4 w-1/2" />
        <div className="animate-pulse bg-white/10 rounded-lg h-52 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="glass-panel">
        <QueryErrorState onRetry={refetch} message="No se pudo cargar el Mapa de Valor." />
      </div>
    )
  }

  if (!mapData) {
    return (
      <div className="glass-panel p-8 text-center">
        <p className="text-p-muted">No se pudo generar el Mapa de Valor para este producto</p>
        <p className="text-p-muted text-sm mt-2">Se necesitan competidores con precios configurados</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel p-4">
        <h3 className="text-sm font-semibold text-white mb-3">{mapData.producto.nombre}</h3>

        {!mapData.precioOptimoValido && (
          <AlertaConfiguracion />
        )}

        {mapData.precioOptimoValido && mapData.competidores.length < 2 && (
          <div className="flex items-center gap-2 bg-yellow-900/30 border border-yellow-600/40 rounded px-3 py-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-yellow-200">Solo {mapData.competidores.length} competidor(es) — se recomienda mínimo 2</span>
          </div>
        )}

        <Plot
          data={[
            {
              x: [mapData.lineaValorJusto.xMin, mapData.lineaValorJusto.xMax],
              y: [
                mapData.lineaValorJusto.slope * mapData.lineaValorJusto.xMin + mapData.lineaValorJusto.intercept,
                mapData.lineaValorJusto.slope * mapData.lineaValorJusto.xMax + mapData.lineaValorJusto.intercept,
              ],
              type: 'scatter',
              mode: 'lines',
              name: 'Valor Justo',
              line: { color: 'rgba(255,255,255,0.2)', width: 2, dash: 'dash' },
              hoverinfo: 'skip',
            },
            {
              x: mapData.competidores.map(c => c.valorPercibido),
              y: mapData.competidores.map(c => c.precio),
              text: mapData.competidores.map(c => c.nombre),
              type: 'scatter',
              mode: 'markers+text',
              name: 'Competidores',
              marker: { color: '#8e919e', size: 8, symbol: 'circle' },
              textposition: 'top center',
              textfont: { color: '#8e919e', size: 9 },
              hovertemplate: '<b>%{text}</b><br>$%{y:,.0f}<extra>Competidor</extra>',
            },
            {
              x: [mapData.producto.valorPercibido],
              y: [mapData.producto.precio],
              type: 'scatter',
              mode: 'markers',
              name: 'Mi Producto',
              marker: { color: '#FF5757', size: 14, symbol: 'circle' },
              hovertemplate: `<b>${mapData.producto.nombre}</b><br>$%{y:,.0f}<extra>Mi Producto</extra>`,
            },
            ...(mapData.precioOptimoValido ? [{
              x: [mapData.precioOptimoPunto.valorPercibido],
              y: [mapData.precioOptimoPunto.precio],
              type: 'scatter' as const,
              mode: 'markers' as const,
              name: 'Precio Óptimo',
              marker: { color: '#AEC911', size: 14, symbol: 'star' },
              hovertemplate: `<b>Precio Óptimo</b><br>$%{y:,.0f}<extra>Recomendado</extra>`,
            }] : []),
          ]}
          layout={{
            height: 300,
            margin: { t: 20, b: 50, l: 70, r: 20 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            xaxis: {
              title: { text: 'Índice de Valor', font: { color: '#8e919e', size: 11 } },
              color: '#8e919e',
              gridcolor: 'rgba(255,255,255,0.05)',
              zeroline: false,
            },
            yaxis: {
              title: { text: 'Precio ($)', font: { color: '#8e919e', size: 11 } },
              color: '#8e919e',
              gridcolor: 'rgba(255,255,255,0.05)',
              tickprefix: '$',
              zeroline: false,
            },
            legend: {
              font: { color: '#D5D5D7', size: 10 },
              bgcolor: 'transparent',
              orientation: 'h',
              y: -0.18,
            },
            showlegend: true,
          }}
          config={{ responsive: true, displayModeBar: false }}
          className="w-full"
        />
      </div>

      {mapData.precioOptimoValido && (
        <div className="glass-panel p-4 space-y-3">
          <p className="text-xs text-p-muted">Precio Óptimo Recomendado</p>
          <p className="text-2xl font-bold text-white">
            ${mapData.precioOptimoValor.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <RecomendacionBadge rec={mapData.recomendacion} variacion={mapData.variacionPct} />
            <span className={`text-xs ${mapData.variacionPct >= 0 ? 'text-p-lime' : 'text-p-red'}`}>
              {mapData.variacionPct > 0 ? '+' : ''}{mapData.variacionPct}% vs. precio actual
            </span>
          </div>
          <button
            onClick={() => navigate('/elasticidad')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-p-blue/20 text-p-blue hover:bg-p-blue/30 transition-colors text-xs w-full justify-center"
          >
            Ver Simulador de Elasticidad <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {mapData.competidores.length > 0 && (
        <div className="glass-panel overflow-x-auto">
          <div className="px-4 py-2 border-b border-p-border">
            <h3 className="text-xs font-semibold text-white">Competidores en el Mapa</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-p-border text-p-muted">
                <th className="text-left py-2 px-4">Competidor</th>
                <th className="text-right py-2 px-4">Precio</th>
                <th className="text-right py-2 px-4">Índice</th>
              </tr>
            </thead>
            <tbody>
              {mapData.competidores.map((comp, i) => (
                <tr key={i} className="border-b border-p-border/50">
                  <td className="py-2 px-4 text-white">{comp.nombre}</td>
                  <td className="py-2 px-4 text-right text-white">${comp.precio.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</td>
                  <td className="py-2 px-4 text-right text-p-muted">{comp.valorPercibido.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
