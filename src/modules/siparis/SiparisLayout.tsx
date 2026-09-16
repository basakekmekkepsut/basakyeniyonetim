import { NavLink, Outlet } from 'react-router-dom'
import { isAdmin, useSession } from '../../lib/session'

export default function SiparisLayout() {
  const session = useSession()
  if (session.status !== 'signed-in') return null
  const { profile } = session
  const admin = isAdmin(profile)
  const canAdd = admin || profile.permissions.siparis.orderAdd
  const canViewAll = admin || profile.permissions.siparis.orderViewAll

  const sekmeler = [
    { yol: '/siparis', etiket: 'Siparişler', gorunur: true },
    { yol: '/siparis/sablonlar', etiket: 'Şablonlar', gorunur: canAdd },
    { yol: '/siparis/rapor', etiket: 'Rapor', gorunur: canViewAll },
    { yol: '/siparis/mesaj', etiket: 'Mesaj', gorunur: canViewAll }
  ].filter((s) => s.gorunur)

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 overflow-x-auto border-b border-bakery-cream-200">
        {sekmeler.map((s) => (
          <NavLink
            key={s.yol}
            to={s.yol}
            end={s.yol === '/siparis'}
            className={({ isActive }) =>
              `shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'border-bakery-amber-600 text-bakery-amber-600'
                  : 'border-transparent text-bakery-ink-500 hover:text-bakery-ink-700'
              }`
            }
          >
            {s.etiket}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
