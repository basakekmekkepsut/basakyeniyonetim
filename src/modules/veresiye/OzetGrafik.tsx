import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface Props {
  veri: { tarih: string; borc: number; tahsilat: number }[]
}

// Ayrı dosyada tutuluyor ve OzetPage'den lazy import ediliyor — recharts
// yalnızca kullanıcı "Grafiksel Özet"i açtığında indirilsin diye (bkz.
// OzetPage.tsx grafikAcik): bu kütüphane tek başına ana Özet sayfasının
// ilk yüklenme süresini ciddi oranda uzatıyordu (bkz. App.tsx Suspense).
export default function OzetGrafik({ veri }: Props) {
  return (
    <div className="rounded-xl bg-bakery-surface p-4 shadow-sm shadow-bakery-coffee-900/5">
      <h3 className="mb-3 text-sm font-semibold text-bakery-ink-800">Borç / Tahsilat Trend</h3>
      {veri.length === 0 ? (
        <p className="text-sm text-bakery-ink-400">Bu aralıkta veri yok.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={veri}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ddbc" />
            <XAxis dataKey="tarih" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="borc" name="Borç" fill="#c9711f" radius={[4, 4, 0, 0]} />
            <Bar dataKey="tahsilat" name="Tahsilat" fill="#3f7d4a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
