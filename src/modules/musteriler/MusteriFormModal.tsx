import { useState, type FormEvent } from 'react'
import { RefreshCw, Share2, X } from 'lucide-react'
import type { HitapSekli, Modul, Musteri, MusteriGirisi } from '../../lib/types'
import { useUrunler } from '../urunler/data'
import { ozelFiyatiGecmiseUygula } from '../veresiye/data'
import { portalSifreYenile } from './data'
import { cuvalGoster } from '../../shared/unHesabi'
import { PORTAL_SITE_URL, portalMesajOlustur } from '../../shared/musteriYardimci'
import ConfirmModal from '../../shared/ConfirmModal'
import { useToast } from '../../shared/Toast'

const MODUL_ETIKETLERI: { key: Modul; etiket: string }[] = [
  { key: 'siparis', etiket: 'Sipariş' },
  { key: 'veresiye', etiket: 'Veresiye' },
  { key: 'okul', etiket: 'Okul' }
]

interface Props {
  mevcut?: Musteri
  onKaydet: (girisi: MusteriGirisi) => Promise<void>
  onKapat: () => void
}

export default function MusteriFormModal({ mevcut, onKaydet, onKapat }: Props) {
  const { urunler } = useUrunler()
  const toast = useToast()

  const [ad, setAd] = useState(mevcut?.ad ?? '')
  const [adSoyad, setAdSoyad] = useState(mevcut?.adSoyad ?? '')
  const [hitapSekli, setHitapSekli] = useState<HitapSekli>(mevcut?.hitapSekli ?? null)
  const [telefon, setTelefon] = useState(mevcut?.telefon ?? '')
  const [adres, setAdres] = useState(mevcut?.adres ?? '')
  const [aktif, setAktif] = useState(mevcut?.aktif ?? true)
  const [gecici, setGecici] = useState(mevcut?.gecici ?? false)
  const [moduller, setModuller] = useState<Modul[]>(mevcut?.moduller ?? [])
  const [acilisBakiyesi, setAcilisBakiyesi] = useState(mevcut?.acilisBakiyesi ?? 0)
  const [ozelFiyatlar, setOzelFiyatlar] = useState<Record<string, number | ''>>(mevcut?.ozelFiyatlar ?? {})
  const [sikUrunler, setSikUrunler] = useState<string[]>(mevcut?.sikUrunler ?? [])

  const [unHesabiAktif, setUnHesabiAktif] = useState(mevcut?.unHesabi?.aktif ?? false)
  const [referansUrunId, setReferansUrunId] = useState(mevcut?.unHesabi?.referansUrunId ?? '')
  const [adetPerCuval, setAdetPerCuval] = useState(mevcut?.unHesabi?.adetPerCuval ?? 140)

  const [portalSifre, setPortalSifre] = useState(mevcut?.portalSifre ?? null)
  const [parolaYenileniyor, setParolaYenileniyor] = useState(false)

  const [gecmiseUygulaUrun, setGecmiseUygulaUrun] = useState<{ id: string; ad: string; fiyat: number } | null>(null)
  const [gecmiseUygulaniyor, setGecmiseUygulaniyor] = useState(false)

  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const veresiyeSecili = moduller.includes('veresiye')
  const veresiyeUrunleri = urunler.filter((u) => u.aktif && u.modules.includes('veresiye'))

  function moduluDegistir(modul: Modul) {
    setModuller((m) => (m.includes(modul) ? m.filter((x) => x !== modul) : [...m, modul]))
  }

  function ozelFiyatDegistir(productId: string, deger: string) {
    setOzelFiyatlar((prev) => ({ ...prev, [productId]: deger === '' ? '' : Number(deger) }))
  }

  function sikUrunDegistir(productId: string) {
    setSikUrunler((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]))
  }

  async function handleGecmiseUygula() {
    if (!mevcut || !gecmiseUygulaUrun) return
    setGecmiseUygulaniyor(true)
    try {
      const sonuc = await ozelFiyatiGecmiseUygula(mevcut.id, gecmiseUygulaUrun.id, gecmiseUygulaUrun.fiyat)
      toast.basari(`${sonuc.guncellenenSayisi} geçmiş kayıt "${gecmiseUygulaUrun.ad}" için ₺${gecmiseUygulaUrun.fiyat} olarak güncellendi.`)
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Geçmişe uygulanamadı.')
    } finally {
      setGecmiseUygulaniyor(false)
      setGecmiseUygulaUrun(null)
    }
  }

  async function handleParolaYenile() {
    if (!mevcut) return
    setParolaYenileniyor(true)
    try {
      const yeniParola = await portalSifreYenile(mevcut.id)
      setPortalSifre(yeniParola)
      toast.basari('Portal şifresi yenilendi.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Şifre yenilenemedi.')
    } finally {
      setParolaYenileniyor(false)
    }
  }

  function portalWhatsappGonder() {
    if (!mevcut) return
    const mesaj = portalMesajOlustur({ ...mevcut, portalSifre })
    if (!mesaj) return toast.hata('Bu müşterinin portal şifresi yok.')
    const numara = telefon.replace(/\D/g, '')
    const waLink = `https://wa.me/${numara}?text=${encodeURIComponent(mesaj)}`
    window.open(waLink, '_blank')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ad.trim()) {
      setHata('Müşteri adı zorunludur.')
      return
    }
    setHata(null)
    setGonderiliyor(true)
    try {
      const temizOzelFiyatlar: Record<string, number> = {}
      for (const [productId, deger] of Object.entries(ozelFiyatlar)) {
        if (deger !== '' && deger > 0) temizOzelFiyatlar[productId] = deger
      }

      const girisi: MusteriGirisi = {
        ad: ad.trim(),
        adSoyad: adSoyad.trim(),
        hitapSekli,
        telefon: telefon.trim(),
        adres: adres.trim(),
        moduller,
        aktif,
        gecici,
        acilisBakiyesi: veresiyeSecili ? Number(acilisBakiyesi) || 0 : 0,
        ozelFiyatlar: temizOzelFiyatlar,
        sikUrunler: veresiyeSecili ? sikUrunler : [],
        unHesabi: veresiyeSecili
          ? {
              aktif: unHesabiAktif,
              referansUrunId: unHesabiAktif ? referansUrunId || null : null,
              adetPerCuval: unHesabiAktif ? Number(adetPerCuval) || null : null,
              birikenEsdegerAdet: mevcut?.unHesabi?.birikenEsdegerAdet ?? 0
            }
          : null
      }
      await onKaydet(girisi)
      onKapat()
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Kaydedilemedi.')
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-bakery-surface p-5 shadow-xl md:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-bakery-ink-900">
            {mevcut ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'}
          </h3>
          <button type="button" onClick={onKapat} className="rounded-full p-1 text-bakery-ink-400 hover:bg-bakery-cream-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Ad *</label>
            <input
              type="text"
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              required
              placeholder="Listelerde görünecek kısa ad (örn. Pansiyon)"
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Ad Soyad</label>
              <input
                type="text"
                value={adSoyad}
                onChange={(e) => setAdSoyad(e.target.value)}
                placeholder="WhatsApp hitabında kullanılır"
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-bakery-ink-800">Hitap Şekli</label>
              <div className="flex gap-1.5">
                {(
                  [
                    [null, 'Yok'],
                    ['bay', 'Bey'],
                    ['hanim', 'Hanım']
                  ] as const
                ).map(([key, etiket]) => (
                  <button
                    type="button"
                    key={etiket}
                    onClick={() => setHitapSekli(key)}
                    className={`flex-1 rounded-lg px-2 py-2 text-sm font-medium transition ${
                      hitapSekli === key ? 'bg-bakery-amber-600 text-white' : 'bg-bakery-cream-100 text-bakery-ink-600 hover:bg-bakery-cream-200'
                    }`}
                  >
                    {etiket}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Telefon</label>
              <input
                type="tel"
                value={telefon}
                onChange={(e) => setTelefon(e.target.value)}
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Adres</label>
              <input
                type="text"
                value={adres}
                onChange={(e) => setAdres(e.target.value)}
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-bakery-ink-800">Hangi modüllerde görünsün?</label>
            <div className="flex flex-wrap gap-2">
              {MODUL_ETIKETLERI.map(({ key, etiket }) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => moduluDegistir(key)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    moduller.includes(key)
                      ? 'bg-bakery-amber-600 text-white'
                      : 'bg-bakery-cream-100 text-bakery-ink-600 hover:bg-bakery-cream-200'
                  }`}
                >
                  {etiket}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-lg bg-bakery-cream-50 px-3 py-2.5 text-sm text-bakery-ink-800">
            <input type="checkbox" checked={gecici} onChange={(e) => setGecici(e.target.checked)} className="mt-0.5" />
            <span>
              <span className="font-medium">Geçici / Düğün Müşterisi</span>
              <br />
              <span className="text-xs text-bakery-ink-500">
                Tek seferlik etkinlik müşterileri — ana müşteri listesinde varsayılan olarak gizlenir.
              </span>
            </span>
          </label>

          {veresiyeSecili && (
            <div className="space-y-3 rounded-lg bg-bakery-cream-50 p-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Geçmiş Bakiye (₺)</label>
                <input
                  type="number"
                  step="0.01"
                  value={acilisBakiyesi}
                  onChange={(e) => setAcilisBakiyesi(Number(e.target.value))}
                  className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-surface px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
                />
                <p className="mt-1 text-xs text-bakery-ink-500">Sisteme geçmeden önceki devreden borç — güncel bakiyeye dahil edilir.</p>
              </div>

              {veresiyeUrunleri.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-bakery-ink-800">Ürüne Özel Fiyatlar</label>
                  <div className="space-y-1.5">
                    {veresiyeUrunleri.map((u) => (
                      <div key={u.id} className="flex items-center gap-2">
                        <span className="flex-1 text-sm text-bakery-ink-600">{u.ad}</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder={`Standart: ₺${u.fiyat}`}
                          value={ozelFiyatlar[u.id] ?? ''}
                          onChange={(e) => ozelFiyatDegistir(u.id, e.target.value)}
                          className="w-28 rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2 py-1.5 text-sm outline-none focus:border-bakery-amber-500"
                        />
                        {mevcut && ozelFiyatlar[u.id] && Number(ozelFiyatlar[u.id]) > 0 && (
                          <button
                            type="button"
                            onClick={() => setGecmiseUygulaUrun({ id: u.id, ad: u.ad, fiyat: Number(ozelFiyatlar[u.id]) })}
                            className="shrink-0 rounded-lg bg-bakery-amber-500/10 px-2 py-1.5 text-xs font-medium text-bakery-amber-600 hover:bg-bakery-amber-500/20"
                          >
                            Geçmişe Uygula
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {veresiyeUrunleri.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-bakery-ink-800">
                    Günlük Girişte Gösterilecek Ürünler
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {veresiyeUrunleri.map((u) => (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => sikUrunDegistir(u.id)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                          sikUrunler.includes(u.id)
                            ? 'bg-bakery-amber-600 text-white'
                            : 'bg-bakery-surface text-bakery-ink-500 ring-1 ring-inset ring-bakery-cream-200 hover:bg-bakery-cream-100'
                        }`}
                      >
                        {u.ad}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-bakery-ink-500">
                    Hiçbiri seçilmezse Günlük Giriş'te tüm ürünler gösterilir. Seçiliyse yalnızca bu ürünler listelenir
                    (o gün farklı bir ürün alırsa "+ Ürün Ekle" ile tek seferlik eklenebilir).
                  </p>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm font-medium text-bakery-ink-800">
                <input type="checkbox" checked={unHesabiAktif} onChange={(e) => setUnHesabiAktif(e.target.checked)} />
                Bu müşteride un hesabını uygula
              </label>
              <p className="-mt-2 text-xs text-bakery-ink-500">
                Aktifse ekmek tamamen ücretsizdir — ödeme yalnızca getirilen un (çuval) ile yapılır, ₺ bakiyesi hiç etkilenmez.
              </p>

              {unHesabiAktif && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs font-medium text-bakery-ink-700">Referans Ürün</label>
                      <select
                        value={referansUrunId}
                        onChange={(e) => setReferansUrunId(e.target.value)}
                        className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-surface px-3 py-2 text-sm outline-none focus:border-bakery-amber-500"
                      >
                        <option value="">Seçin…</option>
                        {urunler.filter((u) => u.aktif).map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.ad}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs font-medium text-bakery-ink-700">
                        Kaç eşdeğer adette 1 çuval un
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={adetPerCuval}
                        onChange={(e) => setAdetPerCuval(Number(e.target.value))}
                        className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-surface px-3 py-2 text-sm outline-none focus:border-bakery-amber-500"
                      />
                    </div>
                  </div>

                  {mevcut?.unHesabi && (
                    <div className="rounded-lg bg-bakery-surface px-3 py-2.5 text-sm">
                      <p className="text-xs text-bakery-ink-500">Güncel un bakiyesi (canlı önizleme)</p>
                      <p className={`font-semibold ${mevcut.unHesabi.birikenEsdegerAdet > 0 ? 'text-bakery-danger' : 'text-bakery-success'}`}>
                        {cuvalGoster(mevcut.unHesabi.birikenEsdegerAdet, adetPerCuval || null)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {mevcut && (
                <div className="space-y-2 rounded-lg bg-bakery-surface p-3">
                  <p className="text-sm font-medium text-bakery-ink-800">Müşteri Portalı</p>
                  <p className="break-all text-xs text-bakery-ink-500">
                    {PORTAL_SITE_URL}/portal.html?kod={mevcut.id}
                  </p>
                  <p className="text-sm text-bakery-ink-700">
                    Şifre: <strong className="font-mono">{portalSifre ?? '—'}</strong>
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleParolaYenile}
                      disabled={parolaYenileniyor}
                      className="flex items-center gap-1.5 rounded-lg bg-bakery-cream-100 px-3 py-1.5 text-xs font-medium text-bakery-ink-600 hover:bg-bakery-cream-200 disabled:opacity-60"
                    >
                      <RefreshCw size={12} />
                      Şifreyi Yenile
                    </button>
                    <button
                      type="button"
                      onClick={portalWhatsappGonder}
                      className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500"
                    >
                      <Share2 size={12} />
                      WhatsApp'tan Gönder
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm font-medium text-bakery-ink-800">
            <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
            Aktif müşteri
          </label>

          {hata && <p className="rounded-lg bg-bakery-danger/10 px-3 py-2 text-sm text-bakery-danger">{hata}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onKapat} className="rounded-lg px-4 py-2 text-sm font-medium text-bakery-ink-600 hover:bg-bakery-cream-100">
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={gonderiliyor}
            className="rounded-lg bg-bakery-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-bakery-amber-500 disabled:opacity-60"
          >
            {gonderiliyor ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </form>

      {gecmiseUygulaUrun && (
        <ConfirmModal
          baslik="Geçmişe Uygula"
          mesaj={`"${gecmiseUygulaUrun.ad}" ürününün bu müşteriye ait TÜM geçmiş veresiye kayıtlarındaki birim fiyatı ₺${gecmiseUygulaUrun.fiyat} olarak güncellenecek ve bakiye buna göre düzeltilecek. Bu işlem geri alınamaz. Emin misiniz?`}
          onayEtiketi={gecmiseUygulaniyor ? 'Uygulanıyor…' : 'Uygula'}
          tehlikeli
          onOnayla={handleGecmiseUygula}
          onVazgec={() => setGecmiseUygulaUrun(null)}
        />
      )}
    </div>
  )
}
