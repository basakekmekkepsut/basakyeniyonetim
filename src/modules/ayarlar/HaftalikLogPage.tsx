import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { Download, RefreshCw } from 'lucide-react'
import { requireDb } from '../../lib/firebase'
import { useKullanicilar } from './kullanicilar/data'
import { formatTutar } from '../../shared/TutarGoster'
import type { OkulPayment, OkulTeslimat, Siparis, VeresiyeKaydi, VeresiyeOdeme, VeresiyeUnGirisi } from '../../lib/types'

const VARSAYILAN_GUN_SAYISI = 7
const GUN_SECENEKLERI = [7, 14, 30]

type Modul = 'veresiye' | 'siparis' | 'okul'
type HareketTuru = 'kayit' | 'odeme' | 'un' | 'siparis' | 'teslimat'

interface Hareket {
  tarih: string
  modul: Modul
  tur: HareketTuru
  aciklama: string
  tutar: number
  musteriAdi: string
  olusturanUid: string
}

const MODUL_ETIKET: Record<Modul, string> = { veresiye: 'Veresiye', siparis: 'Sipariş', okul: 'Okul' }
const TUR_ETIKET: Record<HareketTuru, string> = { kayit: 'Kayıt', odeme: 'Ödeme', un: 'Un', siparis: 'Sipariş', teslimat: 'Teslimat' }
const TUR_STIL: Record<HareketTuru, string> = {
  kayit: 'bg-bakery-coffee-100 text-bakery-ink-700',
  odeme: 'bg-green-500/10 text-green-700',
  un: 'bg-blue-500/10 text-blue-700',
  siparis: 'bg-bakery-amber-500/10 text-bakery-amber-600',
  teslimat: 'bg-purple-500/10 text-purple-700'
}
const DURUM_ETIKET: Record<string, string> = {
  veresiye: 'veresiye',
  odendi: 'ödendi',
  nakit: 'nakit',
  un_odemeli: 'un ile ödendi',
  yeni: 'yeni',
  hazirlaniyor: 'hazırlanıyor',
  teslim_edildi: 'teslim edildi',
  iptal: 'İPTAL'
}

function baslangicTarihi(gunSayisi: number) {
  const d = new Date()
  d.setDate(d.getDate() - gunSayisi)
  return d.toISOString().slice(0, 10)
}

export default function HaftalikLogPage() {
  const { kullanicilar } = useKullanicilar()
  const [gunSayisi, setGunSayisi] = useState(VARSAYILAN_GUN_SAYISI)
  const [modulFiltre, setModulFiltre] = useState<Modul | 'tumu'>('tumu')
  const [hareketler, setHareketler] = useState<Hareket[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  const kullaniciAdi = useMemo(() => {
    const map = new Map(kullanicilar.map((k) => [k.uid, k.ad]))
    return (uid: string) => (uid === 'otomatik' ? 'Otomatik' : (map.get(uid) ?? uid))
  }, [kullanicilar])

  async function yukle() {
    setYukleniyor(true)
    setHata(null)
    try {
      const db = requireDb()
      const bas = baslangicTarihi(gunSayisi)

      const [kayitSnap, odemeSnap, unSnap, siparisSnap, teslimatSnap, okulOdemeSnap, okullarSnap] = await Promise.all([
        getDocs(query(collection(db, 'veresiye_kayitlar'), where('tarih', '>=', bas), orderBy('tarih', 'desc'))),
        getDocs(query(collection(db, 'veresiye_odemeler'), where('tarih', '>=', bas), orderBy('tarih', 'desc'))),
        getDocs(query(collection(db, 'veresiye_unGirisleri'), where('tarih', '>=', bas), orderBy('tarih', 'desc'))),
        getDocs(query(collection(db, 'siparis_orders'), where('teslimatTarihi', '>=', bas), orderBy('teslimatTarihi', 'desc'))),
        getDocs(query(collection(db, 'okul_teslimatlar'), where('tarih', '>=', bas), orderBy('tarih', 'desc'))),
        getDocs(query(collection(db, 'okul_payments'), where('tarih', '>=', bas), orderBy('tarih', 'desc'))),
        getDocs(collection(db, 'okul_schools'))
      ])
      const okulAdi = new Map(okullarSnap.docs.map((d) => [d.id, d.data().ad as string]))

      // Sipariş ve Okul modüllerinin veresiyeye yansıttığı kayıtlar (girisYontemi
      // 'siparis' / 'okul') kendi modüllerinin satırı olarak aşağıda zaten
      // listeleniyor — burada da gösterilirse aynı hareket iki kez görünür.
      const veresiyeHareketleri: Hareket[] = kayitSnap.docs
        .map((d) => d.data() as VeresiyeKaydi)
        .filter((v) => v.girisYontemi !== 'siparis' && v.girisYontemi !== 'okul')
        .map((v) => ({
          tarih: v.tarih,
          modul: 'veresiye',
          tur: 'kayit',
          aciklama: `${v.adet}× ${v.urunAdi} (${DURUM_ETIKET[v.durum] ?? v.durum})`,
          tutar: v.tutar,
          musteriAdi: v.musteriAdi,
          olusturanUid: v.olusturanUid
        }))

      const odemeHareketleri: Hareket[] = odemeSnap.docs.map((d) => {
        const v = d.data() as VeresiyeOdeme
        return {
          tarih: v.tarih,
          modul: 'veresiye',
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
          modul: 'veresiye',
          tur: 'un',
          aciklama: `${v.cuvalSayisi} çuval un teslimi (${v.esdegerAdet} adet eşdeğer)`,
          tutar: 0,
          musteriAdi: v.musteriAdi,
          olusturanUid: v.olusturanUid
        }
      })

      // Tekrarlayan şablondan ileriye dönük üretilmiş ('planlandi') siparişler
      // henüz bir hareket değil — teslim günü gelince 'yeni'ye döner ve o zaman görünür.
      const siparisHareketleri: Hareket[] = siparisSnap.docs
        .map((d) => d.data() as Siparis)
        .filter((s) => s.durum !== 'planlandi')
        .map((s) => {
          const urunler = s.items.map((it) => `${it.adet}× ${it.urunAdi}`).join(', ')
          const durum = s.silindi ? 'SİLİNDİ' : (DURUM_ETIKET[s.durum] ?? s.durum)
          return {
            tarih: s.teslimatTarihi,
            modul: 'siparis',
            tur: 'siparis',
            aciklama: `${urunler} (${durum}, ${s.odemeSekli === 'nakit' ? 'nakit' : 'veresiye'})`,
            tutar: s.toplamTutar,
            musteriAdi: s.musteriAdi,
            olusturanUid: s.olusturanUid
          }
        })

      const teslimatHareketleri: Hareket[] = teslimatSnap.docs.map((d) => {
        const v = d.data() as OkulTeslimat
        return {
          tarih: v.tarih,
          modul: 'okul',
          tur: 'teslimat',
          aciklama: `${v.adet}× ${v.urunAdi} (₺${v.birimFiyat.toLocaleString('tr-TR')})`,
          tutar: v.tutar,
          musteriAdi: okulAdi.get(v.schoolId) ?? '—',
          olusturanUid: v.kapatanUid
        }
      })

      const okulOdemeHareketleri: Hareket[] = okulOdemeSnap.docs.map((d) => {
        const v = d.data() as OkulPayment
        return {
          tarih: v.tarih,
          modul: 'okul',
          tur: 'odeme',
          aciklama: v.not ? `Ödeme — ${v.not}` : 'Ödeme',
          tutar: v.tutar,
          musteriAdi: okulAdi.get(v.hedefId) ?? '—',
          olusturanUid: v.olusturanUid
        }
      })

      const tumu = [
        ...veresiyeHareketleri,
        ...odemeHareketleri,
        ...unHareketleri,
        ...siparisHareketleri,
        ...teslimatHareketleri,
        ...okulOdemeHareketleri
      ].sort((a, b) => b.tarih.localeCompare(a.tarih) || a.modul.localeCompare(b.modul) || a.musteriAdi.localeCompare(b.musteriAdi, 'tr-TR'))
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

  const gorunen = useMemo(
    () => (modulFiltre === 'tumu' ? hareketler : hareketler.filter((h) => h.modul === modulFiltre)),
    [hareketler, modulFiltre]
  )

  const modulSayilari = useMemo(() => {
    const sayi: Record<Modul, number> = { veresiye: 0, siparis: 0, okul: 0 }
    for (const h of hareketler) sayi[h.modul] += 1
    return sayi
  }, [hareketler])

  function csvIndir() {
    const basliklar = ['Tarih', 'Modül', 'Tür', 'Müşteri / Okul', 'Açıklama', 'Tutar', 'Kullanıcı']
    const satirlar = gorunen.map((h) => [
      h.tarih,
      MODUL_ETIKET[h.modul],
      TUR_ETIKET[h.tur],
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

  const filtreSecenekleri: { key: Modul | 'tumu'; etiket: string }[] = [
    { key: 'tumu', etiket: `Tümü (${hareketler.length})` },
    { key: 'veresiye', etiket: `Veresiye (${modulSayilari.veresiye})` },
    { key: 'siparis', etiket: `Sipariş (${modulSayilari.siparis})` },
    { key: 'okul', etiket: `Okul (${modulSayilari.okul})` }
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-bakery-ink-900">Haftalık Log Kaydı</h2>
          <p className="text-sm text-bakery-ink-500">Son {gunSayisi} güne ait Veresiye, Sipariş ve Okul hareketleri.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={gunSayisi}
            onChange={(e) => setGunSayisi(Number(e.target.value))}
            className="rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2.5 py-2 text-sm outline-none focus:border-bakery-amber-500"
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
            className="flex items-center gap-1.5 rounded-lg bg-bakery-cream-100 px-3 py-2 text-sm font-medium text-bakery-ink-600 hover:bg-bakery-cream-200 disabled:opacity-60"
          >
            <RefreshCw size={14} className={yukleniyor ? 'animate-spin' : ''} />
            Yenile
          </button>
          <button
            onClick={csvIndir}
            disabled={gorunen.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-bakery-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-bakery-amber-500 disabled:opacity-50"
          >
            <Download size={14} />
            CSV İndir
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg bg-bakery-cream-100 p-1">
        {filtreSecenekleri.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setModulFiltre(s.key)}
            className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
              modulFiltre === s.key ? 'bg-bakery-surface text-bakery-ink-900 shadow-sm' : 'text-bakery-ink-500 hover:text-bakery-ink-700'
            }`}
          >
            {s.etiket}
          </button>
        ))}
      </div>

      {hata && <p className="rounded-lg bg-bakery-danger/10 px-3 py-2 text-sm text-bakery-danger">{hata}</p>}

      {yukleniyor ? (
        <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>
      ) : gorunen.length === 0 ? (
        <p className="rounded-xl bg-bakery-surface p-6 text-center text-sm text-bakery-ink-500 shadow-sm shadow-bakery-coffee-900/5">
          Son {gunSayisi} günde herhangi bir hareket bulunamadı.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-bakery-surface shadow-sm shadow-bakery-coffee-900/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bakery-cream-100 text-left text-xs font-medium uppercase text-bakery-ink-400">
                <th className="px-3 py-2.5">Tarih</th>
                <th className="px-3 py-2.5">Modül</th>
                <th className="px-3 py-2.5">Tür</th>
                <th className="px-3 py-2.5">Müşteri / Okul</th>
                <th className="px-3 py-2.5">Açıklama</th>
                <th className="px-3 py-2.5 text-right">Tutar</th>
                <th className="px-3 py-2.5">Kullanıcı</th>
              </tr>
            </thead>
            <tbody>
              {gorunen.map((h, i) => (
                <tr key={i} className="border-b border-bakery-cream-50 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-bakery-ink-600">{h.tarih}</td>
                  <td className="px-3 py-2 text-xs font-medium text-bakery-ink-500">{MODUL_ETIKET[h.modul]}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TUR_STIL[h.tur]}`}>{TUR_ETIKET[h.tur]}</span>
                  </td>
                  <td className="px-3 py-2 font-medium text-bakery-ink-900">{h.musteriAdi}</td>
                  <td className="px-3 py-2 text-bakery-ink-600">{h.aciklama}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-bakery-ink-900">{h.tutar ? formatTutar(h.tutar) : '—'}</td>
                  <td className="px-3 py-2 text-xs text-bakery-ink-500">{kullaniciAdi(h.olusturanUid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
