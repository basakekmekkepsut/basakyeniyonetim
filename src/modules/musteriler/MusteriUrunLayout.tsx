import { NavLink, Outlet } from 'react-router-dom'

// Müşteri ve ürün kartları sık kullanıldığı için Ayarlar'dan çıkarılıp alt
// gezinme çubuğunda kendi sekmesine taşındı.
const SEKMELER = [
  { yol: '/musteriler', etiket: 'Müşteriler', end: true },
  { yol: '/musteriler/urunler', etiket: 'Ürünler', end: false }
]

export default function MusteriUrunLayout() {
  return (
    <div className="space-y-4">
      <nav className="flex gap-1 overflow-x-auto border-b border-bakery-cream-200">
        {SEKMELER.map((s) => (
          <NavLink
            key={s.yol}
            to={s.yol}
            end={s.end}
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
