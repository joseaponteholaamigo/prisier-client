import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { BarChart3, Swords, Target, Activity, ListTree, Upload, Bell, LogOut } from 'lucide-react'
import { useAuth } from '../lib/auth'

const navSections = [
  {
    title: 'Ejecución y Mercado',
    items: [
      { label: 'Ejecución de Precios', icon: BarChart3, path: '/' },
      { label: 'Análisis Competencia', icon: Swords, path: '/competencia' },
    ],
  },
  {
    title: 'Estrategia Comercial',
    items: [
      { label: 'Cálculo Precio Óptimo', icon: Target, path: '/pricing' },
      { label: 'Elasticidad y Volumen', icon: Activity, path: '/elasticidad' },
      { label: 'Generador Listas', icon: ListTree, path: '/listas' },
    ],
  },
  {
    title: 'Gestión de Datos',
    items: [
      { label: 'Cargar Archivos', icon: Upload, path: '/ingesta' },
    ],
  },
]

export default function ClientLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()

  const currentPage = navSections
    .flatMap(s => s.items)
    .find(i => i.path === location.pathname)

  return (
    <div className="flex h-screen bg-p-bg">
      {/* Sidebar */}
      <aside className="w-[280px] flex flex-col p-6 bg-p-sidebar-bg border-r border-p-border rounded-r-3xl z-10">
        {/* Logo */}
        <div className="flex flex-col items-start gap-1 mb-10">
          <img
            src="/logo.jpg"
            alt="Prisier"
            className="h-[44px] object-contain bg-white px-2.5 py-1 rounded-lg"
          />
          <span className="text-[10px] uppercase tracking-[2px] font-bold text-p-blue ml-0.5 px-1.5 py-0.5 bg-p-blue/10 border border-p-blue/20 rounded">
            para {user?.email?.split('@')[1]?.split('.')[0] || 'Cliente'}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-6">
          {navSections.map(section => (
            <div key={section.title}>
              <p className="text-[11px] font-semibold text-p-muted uppercase tracking-wider mb-2 px-4">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? 'nav-item-active' : ''}`
                    }
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-p-border pt-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-p-lime flex items-center justify-center text-p-bg font-bold text-sm">
              {user?.nombreCompleto?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.nombreCompleto}</p>
              <p className="text-xs text-p-muted truncate capitalize">{user?.rol?.replace('_', ' ')}</p>
            </div>
            <button
              onClick={logout}
              className="text-p-muted hover:text-p-red transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-10 pt-8 pb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[28px] font-bold bg-gradient-to-r from-white to-p-gray-light bg-clip-text text-transparent">
              {currentPage?.label || 'Dashboard'}
            </h2>
            <p className="text-sm text-p-muted mt-1">
              Monitoreo de precios sugeridos vs reales en Retailers
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <button className="btn-icon relative">
              <Bell size={18} />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-p-red rounded-full text-[10px] font-bold flex items-center justify-center">
                3
              </span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto px-10 pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
