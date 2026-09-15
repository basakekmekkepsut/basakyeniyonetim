import { NavLink, Outlet } from 'react-router-dom'

const SEKMELER = [
  { yol: '/ayarlar/musteriler', etiket: 'Müşteriler' },
  { yol: '/ayarlar/urunler', etiket: 'Ürünler' },
  { yol: '/ayarlar/kullanicilar', etiket: 'Kullanıcılar' },
  { yol: '/ayarlar/telegram', etiket: 'Telegram' },
  { yol: '/ayarlar/log', etiket: 'Haftalık Log' }
]

export default function AyarlarLayout() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-bakery-coffee-900">Ayarlar</h1>
      <nav className="flex gap-1 overflow-x-auto border-b border-bakery-cream-200">
        {SEKMELER.map((s) => (
          <NavLink
            key={s.yol}
            to={s.yol}
            className={({ isActive }) =>
              `shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'border-bakery-amber-600 text-bakery-amber-600'
                  : 'border-transparent text-bakery-coffee-500 hover:text-bakery-coffee-700'
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
