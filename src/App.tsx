import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './lib/auth'
import ProtectedRoute from './components/ProtectedRoute'
import ClientLayout from './layouts/ClientLayout'
import LoginPage from './pages/LoginPage'
import EjecucionPage from './pages/EjecucionPage'
import CompetenciaPage from './pages/CompetenciaPage'
import ElasticidadPage from './pages/ElasticidadPage'
import ListasPage from './pages/ListasPage'
import PricingPage from './pages/PricingPage'
import IngestaPage from './pages/IngestaPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/pricer-client/">
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute allowedRoles={['cliente_comercial', 'cliente_educacion']} />}>
              <Route element={<ClientLayout />}>
                <Route path="/" element={<EjecucionPage />} />
                <Route path="/competencia" element={<CompetenciaPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/elasticidad" element={<ElasticidadPage />} />
                <Route path="/listas" element={<ListasPage />} />
                <Route path="/ingesta" element={<IngestaPage />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
