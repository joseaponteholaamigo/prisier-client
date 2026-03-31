import Plotly from 'plotly.js-dist-min'
// eslint-disable-next-line @typescript-eslint/no-require-imports
import factoryModule from 'react-plotly.js/factory'

const createPlotlyComponent = (factoryModule as unknown as { default: typeof factoryModule }).default ?? factoryModule
const Plot = createPlotlyComponent(Plotly)

export default Plot
