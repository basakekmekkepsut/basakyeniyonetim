import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { Download, RefreshCw } from 'lucide-react'
import { requireDb } from '../../lib/firebase'
import { useKullanicilar } from './kullanicilar/data'
import { formatTutar } from '../../shared/TutarGoster'
import type { VeresiyeKaydi, VeresiyeOdeme, VeresiyeUnGirisi } from '../../lib/types'

const VARSAYILAN_GUN_SAYISI = 7
const GUN_SECENEKLERI = [7, 14, 30]

type HareketTuru = 'kayit' | 'odeme' | 'un'

interface Hareket {
  tarih: string
  tur: HareketTuru
  aciklama: string
  tutar: number
  musteriAdi: string
  olusturanUid: string
}

function baslangicTarihi(gunSayisi: number) {
  const d = new Date()
  d.setDate(d.getDate() - gunSayisi)
  return d.toISOString().slice(0, 10)
}

export default function HaftalikLogPage() {
  const { kullanicilar } = useKullanicilar()
  const [gunSayisi, setGunSayisi] = useState(VARSAYILAN_GUN_SAYISI)
  const [hareketler, setHareketler] = useState<Hareket[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  const kullaniciAdi = useMemo(() => {
    const map = new Map(kullanicilar.map((k) => [k.uid, k.ad]))
    return (uid: string) => map.get(uid) ?? uid
  }, [kullanicilar])

  async function yukle() {
    setYukleniyor(true)
    setHata(null)
    try {
      const db = requireDb()
      const bas = baslangicTarihi(gunSayisi)

      const [kayitSnap, odemeSnap, unSnap] = await Promise.all([
        getDocs(query(collection(db, 'veresiye_kayitlar'), where('tarih', '>=', bas), orderBy('tarih', 'desc'))),
        getDocs(query(collection(db, 'veresiye_odemeler'), where('tarih', '>=', bas), orderBy('tarih', 'desc'))),
        getDocs(query(collection(db, 'veresiye_unGirisleri'), where('tarih', '>=', bas), orderBy('tarih', 'desc')))
      ])

      const kayitHareketleri: Hareket[] = kayitSnap.docs.map((d) => {
        const v = d.data() as VeresiyeKaydi
        return {
          tarih: v.tarih,
          tur: 'kayit',
          aciklama: `${v.adet}× ${v.urunAdi} (${v.durum === 'un_odemeli' ? 'Un ile Ödendi' : v.durum})`,
          tutar: v.tutar,
          musteriAdi: v.musteriAdi,
          olusturanUid: v.olusturanUid
        }
      })

      const odemeHareketleri: Hareket[] = odemeSnap.docs.map((d) => {
        const v = d.data() as VeresiyeOdeme
        return {
          tarih: v.tarih,
          tur: 'odeme',
          aciklama: v.not ? `Ödeme — ${v.not}` : 'Ödeme',
          tutar: v.tutar,
          musteriAdi: v.musteriAdi,
          olusturanUid: v.olusturanUid
        }
      })

      const unHareketleri: Hareket[] = unSnap.docs.map((d) => {
        const v = d.data() as VeresiyeUnGirisi
        return {
          tarih: v.tarih,
          tur: 'un',
          aciklama: `${v.cuvalSayisi} çuval un teslimi (${v.esdegerAdet} adet eşdeğer)`,
          tutar: 0,
          musteriAdi: v.musteriAdi,
          olusturanUid: v.olusturanUid
        }
      })

      const tumu = [...kayitHareketleri, ...odemeHareketleri, ...unHareketleri].sort((a, b) =>
        b.tarih.localeCompare(a.tarih)
      )
      setHareketler(tumu)
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Yüklenemedi.')
    } finally {
      setYukleniyor(false)
    }
  }

  useEffect(() => {
    yukle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gunSayisi])

  function csvIndir() {
    const basliklar = ['Tarih', 'Tür', 'Müşteri', 'Açıklama', 'Tutar', 'Kullanıcı']
    const turEtiketi: Record<HareketTuru, string> = { kayit: 'Veresiye Kaydı', odeme: 'Ödeme', un: 'Un Teslimi' }
    const satirlar = hareketler.map((h) => [
      h.tarih,
      turEtiketi[h.tur],
      h.musteriAdi,
      h.aciklama,
      h.tutar ? h.tutar.toFixed(2) : '',
      kullaniciAdi(h.olusturanUid)
    ])
    const csv = [basliklar, ...satirlar]
      .map((satir) => satir.map((deger) => `"${String(deger).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `haftalik-log-${bugunStr()}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function bugunStr() {
    return new Date().toISOString().slice(0, 10)
  }

  const TUR_STIL: Record<HareketTuru, string> = {
    kayit: 'bg-bakery-coffee-100 text-bakery-coffee-700',
    odeme: 'bg-green-500/10 text-green-700',
    un: 'bg-blue-500/10 text-blue-700'
  }
  const TUR_ETIKET: Record<HareketTuru, string> = { kayit: 'Kayıt', odeme: 'Ödeme', un: 'Un' }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-bakery-coffee-900">Haftalık Log Kaydı</h2>
          <p className="text-sm text-bakery-coffee-500">Son {gunSayisi} güne ait veresiye hareketleri.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={gunSayisi}
            onChange={(e) => setGunSayisi(Number(e.target.value))}
            className="rounded-lg border border-bakery-cream-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-bakery-amber-500"
          >
            {GUN_SECENEKLERI.map((g) => (
              <option key={g} value={g}>
                Son {g} gün
              </option>
            ))}
          </select>
          <button
            onClick={yukle}
            disabled={yukleniyor}
            className="flex items-center gap-1.5 rounded-lg bg-bakery-cream-100 px-3 py-2 text-sm font-medium text-bakery-coffee-600 hover:bg-bakery-cream-200 disabled:opacity-60"
          >
            <RefreshCw size={14} className={yukleniyor ? 'animate-spin' : ''} />
            Yenile
          </button>
          <button
            onClick={csvIndir}
            disabled={hareketler.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-bakery-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-bakery-amber-500 disabled:opacity-50"
          >
            <Download size={14} />
            CSV İndir
          </button>
        </div>
      </div>

      {hata && <p className="rounded-lg bg-bakery-danger/10 px-3 py-2 text-sm text-bakery-danger">{hata}</p>}

      {yukleniyor ? (
        <p className="text-sm text-bakery-coffee-500">Yükleniyor…</p>
      ) : hareketler.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-bakery-coffee-500 shadow-sm shadow-bakery-coffee-900/5">
          Son {gunSayisi} günde herhangi bir hareket bulunamadı.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm shadow-bakery-coffee-900/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bakery-cream-100 text-left text-xs font-medium uppercase text-bakery-coffee-400">
                <th className="px-3 py-2.5">Tarih</th>
                <th className="px-3 py-2.5">Tür</th>
                <th className="px-3 py-2.5">Müşteri</th>
                <th className="px-3 py-2.5">Açıklama</th>
                <th className="px-3 py-2.5 text-right">Tutar</th>
                <th className="px-3 py-2.5">Kullanıcı</th>
              </tr>
            </thead>
            <tbody>
              {hareketler.map((h, i) => (
                <tr key={i} className="border-b border-bakery-cream-50 last:border-0">
                  <td className="px-3 py-2 text-bakery-coffee-600">{h.tarih}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TUR_STIL[h.tur]}`}>{TUR_ETIKET[h.tur]}</span>
                  </td>
                  <td className="px-3 py-2 font-medium text-bakery-coffee-900">{h.musteriAdi}</td>
                  <td className="px-3 py-2 text-bakery-coffee-600">{h.aciklama}</td>
                  <td className="px-3 py-2 text-right text-bakery-coffee-900">{h.tutar ? formatTutar(h.tutar) : '—'}</td>
                  <td className="px-3 py-2 text-xs text-bakery-coffee-500">{kullaniciAdi(h.olusturanUid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
