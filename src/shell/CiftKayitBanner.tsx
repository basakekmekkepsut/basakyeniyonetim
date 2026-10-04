import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, query, where, writeBatch } from 'firebase/firestore'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { requireDb } from '../lib/firebase'
import { ciftKayitlariBul, KAYNAK_ETIKETI, KONTROL_GUN_SAYISI, type CiftKayitGrubu } from '../shared/ciftKayit'
import { veresiyeKaydiSil } from '../modules/veresiye/data'
import { formatTutar } from '../shared/TutarGoster'
import { useToast } from '../shared/Toast'
import ConfirmModal from '../shared/ConfirmModal'
import type { VeresiyeKaydi } from '../lib/types'

function baslangicStr() {
  const d = new Date()
  d.setDate(d.getDate() - KONTROL_GUN_SAYISI)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function tarihTr(tarih: string) {
  return tarih.split('-').reverse().join('.')
}

/** Son 14 günde aynı müşteriye aynı ürünün hem elle hem otomatik (Sipariş/Okul)
 * yazıldığı şüpheli kayıtları uygulamanın üstünde uyarı olarak gösterir. */
export default function CiftKayitBanner() {
  const toast = useToast()
  const [kayitlar, setKayitlar] = useState<VeresiyeKaydi[]>([])
  const [acik, setAcik] = useState(false)
  const [silinecek, setSilinecek] = useState<VeresiyeKaydi | null>(null)
  const [isleniyor, setIsleniyor] = useState(false)

  useEffect(() => {
    const q = query(collection(requireDb(), 'veresiye_kayitlar'), where('tarih', '>=', baslangicStr()))
    return onSnapshot(
      q,
      (snap) => setKayitlar(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VeresiyeKaydi)),
      () => setKayitlar([])
    )
  }, [])

  const gruplar = useMemo(() => ciftKayitlariBul(kayitlar), [kayitlar])
  if (gruplar.length === 0) return null

  async function sorunDegil(grup: CiftKayitGrubu) {
    setIsleniyor(true)
    try {
      const db = requireDb()
      const batch = writeBatch(db)
      grup.kayitlar.forEach((k) => batch.update(doc(db, 'veresiye_kayitlar', k.id), { ciftKayitOnay: true }))
      await batch.commit()
      toast.basari('Uyarı kaldırıldı.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'İşlem yapılamadı.')
    } finally {
      setIsleniyor(false)
    }
  }

  async function sil() {
    if (!silinecek) return
    setIsleniyor(true)
    try {
      await veresiyeKaydiSil(silinecek)
      toast.basari('Elle girilen kayıt silindi, bakiye düzeltildi.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Silinemedi.')
    } finally {
      setIsleniyor(false)
      setSilinecek(null)
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-bakery-amber-500/40 bg-bakery-amber-500/10">
      <button onClick={() => setAcik((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <AlertTriangle size={18} className="shrink-0 text-bakery-amber-600" />
        <span className="flex-1 text-sm font-semibold text-bakery-ink-900">
          {gruplar.length} olası çift kayıt — aynı ürün hem elle hem otomatik yazılmış
        </span>
        <ChevronDown size={16} className={`shrink-0 text-bakery-ink-500 transition ${acik ? 'rotate-180' : ''}`} />
      </button>
      {acik && (
        <ul className="space-y-2 px-3 pb-3">
          {gruplar.map((g) => (
            <li key={g.anahtar} className="rounded-lg bg-bakery-surface p-2.5 text-sm shadow-sm">
              <p className="font-medium text-bakery-ink-900">
                {g.musteriAdi} · {tarihTr(g.tarih)} · {g.urunAdi}
              </p>
              <ul className="mt-1 space-y-1">
                {g.kayitlar.map((k) => (
                  <li key={k.id} className="flex items-center justify-between gap-2 text-bakery-ink-600">
                    <span>
                      {k.adet} adet — {formatTutar(k.tutar)} <span className="text-xs text-bakery-ink-400">({KAYNAK_ETIKETI[k.girisYontemi]})</span>
                    </span>
                    {k.girisYontemi === 'manuel' && (
                      <button
                        onClick={() => setSilinecek(k)}
                        disabled={isleniyor}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-bakery-danger hover:bg-bakery-danger/10"
                      >
                        Elle gireni sil
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => sorunDegil(g)}
                disabled={isleniyor}
                className="mt-1.5 rounded-lg bg-bakery-cream-100 px-2.5 py-1 text-xs font-medium text-bakery-ink-600 hover:bg-bakery-cream-200"
              >
                Sorun değil, ikisi de doğru
              </button>
            </li>
          ))}
        </ul>
      )}
      {silinecek && (
        <ConfirmModal
          baslik="Elle girilen kaydı sil"
          mesaj={`${silinecek.musteriAdi} — ${tarihTr(silinecek.tarih)}: ${silinecek.adet} × ${silinecek.urunAdi} (${formatTutar(silinecek.tutar)}) silinecek ve bakiyeden düşülecek. Emin misiniz?`}
          onayEtiketi={isleniyor ? 'Siliniyor…' : 'Sil'}
          tehlikeli
          onOnayla={sil}
          onVazgec={() => setSilinecek(null)}
        />
      )}
    </div>
  )
}
