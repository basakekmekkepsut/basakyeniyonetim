import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import {
  useSiparisler,
  siparisEkle,
  siparisGuncelle,
  siparisDurumGuncelle,
  siparisOdemeDurumuGuncelle,
  siparisCopeTasi,
  siparisGeriYukle,
  siparisKaliciSil,
  siparisPlanlananiAktifEt,
  usePlanlananSiparisler
} from './data'
import SiparisFormModal from './SiparisFormModal'
import DonemFiltre, { donemAraligiHesapla, type DonemAnahtari } from '../../shared/DonemFiltre'
import BosDurum from '../../shared/BosDurum'
import ConfirmModal from '../../shared/ConfirmModal'
import TutarGoster from '../../shared/TutarGoster'
import { useToast } from '../../shared/Toast'
import { useUrunler } from '../urunler/data'
import { useSession, isAdmin } from '../../lib/session'
import type { Siparis, SiparisDurumu, SiparisFormVerisi } from '../../lib/types'

const DURUM_ETIKETI: Record<SiparisDurumu, string> = {
  planlandi: 'Planlandı',
  yeni: 'Yeni',
  hazirlaniyor: 'Hazırlanıyor',
  teslim_edildi: 'Teslim Edildi',
  iptal: 'İptal'
}

const DURUM_RENGI: Record<SiparisDurumu, string> = {
  planlandi: 'bg-bakery-coffee-100 text-bakery-ink-500',
  yeni: 'bg-bakery-amber-500/15 text-bakery-amber-600',
  hazirlaniyor: 'bg-blue-500/15 text-blue-600',
  teslim_edildi: 'bg-bakery-success/10 text-bakery-success',
  iptal: 'bg-bakery-danger/10 text-bakery-danger'
}

function bugunStr() {
  return new Date().toISOString().slice(0, 10)
}

function yarinStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export default function SiparislerPage() {
  const session = useSession()
  const toast = useToast()

  const [donem, setDonem] = useState<DonemAnahtari>('yaklasan')
  const [ozelBaslangic, setOzelBaslangic] = useState(bugunStr())
  const [ozelBitis, setOzelBitis] = useState(yarinStr())
  const [arama, setArama] = useState('')
  const [urunFiltre, setUrunFiltre] = useState<string>('hepsi')
  const [copKutusu, setCopKutusu] = useState(false)
  const [formAcik, setFormAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<Siparis | undefined>()
  const [kopyaKaynagi, setKopyaKaynagi] = useState<Siparis | undefined>()
  const [kaliciSilinecek, setKaliciSilinecek] = useState<Siparis | undefined>()

  const { baslangic, bitis } = donemAraligiHesapla(donem, ozelBaslangic, ozelBitis)
  const signedIn = session.status === 'signed-in'
  const canViewAll = signedIn && (isAdmin(session.profile) || session.profile.permissions.siparis.orderViewAll)

  const { siparisler, yukleniyor, hata } = useSiparisler({
    baslangic,
    bitis,
    silindi: copKutusu,
    sadeceKendi: signedIn && !canViewAll ? session.user.uid : null
  })
  const { urunler } = useUrunler()
  const siparisUrunleri = useMemo(() => urunler.filter((u) => u.aktif && u.modules.includes('siparis')), [urunler])
  const planlananlar = usePlanlananSiparisler(canViewAll)

  // Teslimat günü gelmiş (veya geçmiş) 'planlandi' siparişleri otomatik olarak
  // 'yeni'ye çevirip veresiyeye yansıtır. Görünürdeki tarih filtresinden bağımsız,
  // ayrı bir sorgu (usePlanlananSiparisler) kullanılır — böylece "Yaklaşan" gibi
  // yalnızca bugünden ileriyi gösteren bir görünüm, gün değiştiğinde teslimat tarihi
  // geçmişte kalmış bir siparişi listeden düşürüp aktivasyonu atlamasına engel olunur.
  // siparisPlanlananiAktifEt kendi transaction'ı içinde durumu taze kontrol ettiği
  // için birden fazla istemcide aynı anda tetiklenmesi güvenlidir; aktifleEdilenler
  // ref'i yalnızca aynı oturumda gereksiz tekrar denemeleri önler.
  const aktifleEdilenler = useRef(new Set<string>())
  useEffect(() => {
    if (session.status !== 'signed-in' || urunler.length === 0) return
    const bugun = bugunStr()
    const gelmisOlanlar = planlananlar.filter(
      (s) => s.teslimatTarihi <= bugun && !aktifleEdilenler.current.has(s.id)
    )
    for (const s of gelmisOlanlar) {
      aktifleEdilenler.current.add(s.id)
      siparisPlanlananiAktifEt(s.id, urunler, { uid: session.user.uid }).catch(() => {
        aktifleEdilenler.current.delete(s.id)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planlananlar, urunler, session.status])

  if (session.status !== 'signed-in') return null
  const { profile, user } = session
  const kullanici = { uid: user.uid, ad: profile.ad }
  const admin = isAdmin(profile)
  const canAdd = admin || profile.permissions.siparis.orderAdd

  const filtrelenmis = useMemo(() => {
    let liste = siparisler
    if (urunFiltre !== 'hepsi') liste = liste.filter((s) => s.items.some((it) => it.productId === urunFiltre))
    const q = arama.trim().toLocaleLowerCase('tr-TR')
    if (q) liste = liste.filter((s) => s.musteriAdi.toLocaleLowerCase('tr-TR').includes(q))
    return liste
  }, [siparisler, urunFiltre, arama])

  async function handleKaydet(veri: SiparisFormVerisi) {
    if (duzenlenen) {
      await siparisGuncelle(duzenlenen, veri, kullanici)
      toast.basari('Sipariş güncellendi.')
    } else {
      await siparisEkle(veri, kullanici)
      toast.basari('Sipariş eklendi ve veresiye hesabına yansıtıldı.')
    }
  }

  async function handleKaliciSil() {
    if (!kaliciSilinecek) return
    try {
      await siparisKaliciSil(kaliciSilinecek.id)
      toast.basari('Sipariş kalıcı olarak silindi.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Silinemedi.')
    } finally {
      setKaliciSilinecek(undefined)
    }
  }

  if (hata) {
    return <p className="rounded-lg bg-bakery-danger/10 px-4 py-3 text-sm text-bakery-danger">{hata}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DonemFiltre
            secili={donem}
            onSeciliDegis={setDonem}
            ozelBaslangic={ozelBaslangic}
            ozelBitis={ozelBitis}
            onOzelBaslangicDegis={setOzelBaslangic}
            onOzelBitisDegis={setOzelBitis}
            tumunuGoster
            tekTarihSecici
          />
          {canAdd && !copKutusu && (
            <button
              onClick={() => {
                setDuzenlenen(undefined)
                setKopyaKaynagi(undefined)
                setFormAcik(true)
              }}
              className="flex items-center gap-1.5 rounded-lg bg-bakery-amber-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-bakery-amber-500"
            >
              <Plus size={16} />
              Yeni Sipariş
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bakery-ink-400" />
            <input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Müşteri ara…"
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
            />
          </div>
          <select
            value={urunFiltre}
            onChange={(e) => setUrunFiltre(e.target.value)}
            className="rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2.5 py-2 text-sm outline-none focus:border-bakery-amber-500"
          >
            <option value="hepsi">Tüm Ürünler</option>
            {siparisUrunleri.map((u) => (
              <option key={u.id} value={u.id}>
                {u.ad}
              </option>
            ))}
          </select>
          <button
            onClick={() => setCopKutusu((v) => !v)}
            className={`ml-auto rounded-lg px-3 py-2 text-sm font-medium ${
              copKutusu ? 'bg-bakery-danger/10 text-bakery-danger' : 'text-bakery-ink-500 hover:bg-bakery-cream-100'
            }`}
          >
            {copKutusu ? 'Çöp Kutusundan Çık' : 'Çöp Kutusu'}
          </button>
        </div>
      </div>

      {yukleniyor ? (
        <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>
      ) : filtrelenmis.length === 0 ? (
        <BosDurum
          baslik={copKutusu ? 'Çöp kutusu boş' : 'Bu aralıkta sipariş yok'}
          aciklama={!copKutusu && canAdd ? 'Yeni bir sipariş eklemek için yukarıdaki butonu kullanın.' : undefined}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrelenmis.map((s) => (
            <div key={s.id} className="rounded-xl bg-bakery-surface p-4 shadow-sm shadow-bakery-coffee-900/5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-bakery-ink-900">{s.musteriAdi}</p>
                    {s.musteriGecici && (
                      <span className="rounded-full bg-bakery-coffee-100 px-2 py-0.5 text-xs font-medium text-bakery-ink-500">
                        Geçici Müşteri
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-bakery-ink-500">{s.teslimatTarihi}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${DURUM_RENGI[s.durum]}`}>
                  {DURUM_ETIKETI[s.durum]}
                </span>
              </div>

              <ul className="mb-2 space-y-0.5 text-sm text-bakery-ink-600">
                {s.items.map((it, i) => (
                  <li key={i} className="flex justify-between">
                    <span>
                      {it.adet}× {it.urunAdi}
                    </span>
                    <span>{formatCurrencyShort(it.adet * it.birimFiyat)}</span>
                  </li>
                ))}
              </ul>

              {s.adres && <p className="mb-1 text-xs text-bakery-ink-400">{s.adres}</p>}
              {s.not && <p className="mb-2 text-xs italic text-bakery-ink-400">"{s.not}"</p>}

              <div className="mb-3 flex items-center justify-between border-t border-bakery-cream-100 pt-2">
                <span className="text-sm font-semibold text-bakery-ink-900">
                  <TutarGoster tutar={s.toplamTutar} />
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.odemeSekli === 'nakit'
                      ? 'bg-blue-500/10 text-blue-600'
                      : s.odemeDurumu === 'odendi'
                        ? 'bg-bakery-success/10 text-bakery-success'
                        : 'bg-bakery-danger/10 text-bakery-danger'
                  }`}
                >
                  {s.odemeSekli === 'nakit' ? 'Nakit' : s.odemeDurumu === 'odendi' ? 'Ödendi' : 'Veresiye'}
                </span>
              </div>

              {copKutusu ? (
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => siparisGeriYukle(s, kullanici).then(() => toast.basari('Sipariş geri yüklendi.'))}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-bakery-ink-600 hover:bg-bakery-cream-100"
                  >
                    <RotateCcw size={14} />
                    Geri Yükle
                  </button>
                  {admin && (
                    <button
                      onClick={() => setKaliciSilinecek(s)}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-bakery-danger hover:bg-bakery-danger/10"
                    >
                      <Trash2 size={14} />
                      Kalıcı Sil
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <select
                    value={s.durum}
                    onChange={(e) => siparisDurumGuncelle(s, e.target.value as SiparisDurumu, kullanici)}
                    className="rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2 py-1 text-xs outline-none"
                  >
                    {(Object.keys(DURUM_ETIKETI) as SiparisDurumu[]).map((d) => (
                      <option key={d} value={d}>
                        {DURUM_ETIKETI[d]}
                      </option>
                    ))}
                  </select>

                  {s.odemeSekli === 'veresiye' && (
                    <button
                      onClick={() =>
                        siparisOdemeDurumuGuncelle(s, s.odemeDurumu === 'odendi' ? 'odenmedi' : 'odendi', kullanici)
                      }
                      className="rounded-lg px-2 py-1 text-xs font-medium text-bakery-ink-500 hover:bg-bakery-cream-100"
                    >
                      {s.odemeDurumu === 'odendi' ? 'Ödenmedi işaretle' : 'Ödendi işaretle'}
                    </button>
                  )}

                  <div className="ml-auto flex gap-1">
                    <button
                      onClick={() => {
                        setKopyaKaynagi(s)
                        setDuzenlenen(undefined)
                        setFormAcik(true)
                      }}
                      className="rounded-lg p-1.5 text-bakery-ink-500 hover:bg-bakery-cream-100"
                      aria-label="Kopyala"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setDuzenlenen(s)
                        setKopyaKaynagi(undefined)
                        setFormAcik(true)
                      }}
                      className="rounded-lg p-1.5 text-bakery-ink-500 hover:bg-bakery-cream-100"
                      aria-label="Düzenle"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => siparisCopeTasi(s, kullanici).then(() => toast.basari('Sipariş çöp kutusuna taşındı.'))}
                      className="rounded-lg p-1.5 text-bakery-danger hover:bg-bakery-danger/10"
                      aria-label="Sil"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {formAcik && (
        <SiparisFormModal
          mevcut={duzenlenen ?? kopyaKaynagi}
          baslik={!duzenlenen && kopyaKaynagi ? 'Siparişi Kopyala' : undefined}
          varsayilanTarih={
            donem === 'bugun'
              ? bugunStr()
              : donem === 'ozel' && ozelBaslangic
                ? ozelBaslangic
                : yarinStr()
          }
          onKaydet={handleKaydet}
          onKapat={() => {
            setFormAcik(false)
            setKopyaKaynagi(undefined)
          }}
        />
      )}

      {kaliciSilinecek && (
        <ConfirmModal
          baslik="Siparişi kalıcı sil"
          mesaj={`"${kaliciSilinecek.musteriAdi}" siparişini kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
          onayEtiketi="Kalıcı Sil"
          tehlikeli
          onOnayla={handleKaliciSil}
          onVazgec={() => setKaliciSilinecek(undefined)}
        />
      )}
    </div>
  )
}

function formatCurrencyShort(n: number) {
  return `₺${n.toFixed(2).replace('.', ',')}`
}
