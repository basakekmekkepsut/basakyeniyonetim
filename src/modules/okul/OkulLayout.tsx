import { NavLink, Outlet } from 'react-router-dom'
import { isAdmin, useSession } from '../../lib/session'

export default function OkulLayout() {
  const session = useSession()
  if (session.status !== 'signed-in') return null
  const { profile } = session
  const admin = isAdmin(profile)
  const izin = profile.permissions.okul

  const sekmeler = [
    { yol: '/okul', etiket: 'Üretim', gorunur: true },
    { yol: '/okul/siparis', etiket: 'Sipariş', gorunur: admin || izin.siparis },
    { yol: '/okul/okullar', etiket: 'Okullar', gorunur: admin || izin.okullar },
    { yol: '/okul/firmalar', etiket: 'Firmalar', gorunur: admin || izin.okullar },
    { yol: '/okul/ekstre', etiket: 'Ekstre', gorunur: admin || izin.ekstre },
    { yol: '/okul/urunler', etiket: 'Ürünler', gorunur: admin || izin.urunler },
    { yol: '/okul/mesaj', etiket: 'Mesaj', gorunur: admin || izin.mesaj }
  ].filter((s) => s.gorunur)

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 overflow-x-auto border-b border-bakery-cream-200">
        {sekmeler.map((s) => (
          <NavLink
            key={s.yol}
            to={s.yol}
            end={s.yol === '/okul'}
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
