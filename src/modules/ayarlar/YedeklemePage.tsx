import { useRef, useState, type ChangeEvent } from 'react'
import { httpsCallable } from 'firebase/functions'
import { Download, Upload } from 'lucide-react'
import { requireFunctions } from '../../lib/firebase'
import ConfirmModal from '../../shared/ConfirmModal'
import { useToast } from '../../shared/Toast'

interface YedekSonucu {
  yedek: Record<string, Record<string, unknown>>
  olusturmaTarihi: string
}

interface YukleSonucu {
  basarili: boolean
  yazilanBelge: number
}

function bugunStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function YedeklemePage() {
  const toast = useToast()
  const [yedekAliniyor, setYedekAliniyor] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [seciliDosya, setSeciliDosya] = useState<File | null>(null)
  const dosyaInputRef = useRef<HTMLInputElement>(null)

  async function handleYedekAl() {
    setYedekAliniyor(true)
    try {
      const cagir = httpsCallable<void, YedekSonucu>(requireFunctions(), 'manuelYedekOlustur')
      const sonuc = await cagir()
      const icerik = JSON.stringify(sonuc.data.yedek, null, 2)
      const blob = new Blob([icerik], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `basak-yedek-${bugunStr()}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.basari('Yedek indirildi.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Yedek alınamadı.')
    } finally {
      setYedekAliniyor(false)
    }
  }

  function handleDosyaSec(e: ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0]
    if (!dosya) return
    setSeciliDosya(dosya)
  }

  function inputSifirla() {
    if (dosyaInputRef.current) dosyaInputRef.current.value = ''
  }

  async function handleYukleOnayla() {
    if (!seciliDosya || yukleniyor) return
    setYukleniyor(true)
    try {
      const metin = await seciliDosya.text()
      const yedek = JSON.parse(metin)
      const cagir = httpsCallable<{ yedek: unknown }, YukleSonucu>(requireFunctions(), 'manuelYedekYukle')
      const sonuc = await cagir({ yedek })
      toast.basari(`Geri yükleme tamamlandı — ${sonuc.data.yazilanBelge} belge yazıldı.`)
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Geri yükleme başarısız — dosyanın bozuk olmadığından emin olun.')
    } finally {
      setYukleniyor(false)
      setSeciliDosya(null)
      inputSifirla()
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <div className="space-y-3 rounded-xl bg-bakery-surface p-5 shadow-sm shadow-bakery-coffee-900/5">
        <h2 className="text-lg font-semibold text-bakery-ink-900">Yedek Al</h2>
        <p className="text-sm text-bakery-ink-500">
          Tüm veritabanının (müşteriler, siparişler, veresiye kayıtları, okullar vb.) anlık bir JSON yedeğini
          indirir. Ayrıca her sabah 07:50'de otomatik olarak Telegram'a da gönderilir.
        </p>
        <button
          onClick={handleYedekAl}
          disabled={yedekAliniyor}
          className="flex items-center gap-1.5 rounded-lg bg-bakery-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-bakery-amber-500 disabled:opacity-60"
        >
          <Download size={16} />
          {yedekAliniyor ? 'Hazırlanıyor…' : 'Yedek Al (.json)'}
        </button>
      </div>

      <div className="space-y-3 rounded-xl bg-bakery-surface p-5 shadow-sm shadow-bakery-coffee-900/5">
        <h2 className="text-lg font-semibold text-bakery-ink-900">Yedekten Yükle</h2>
        <p className="text-sm text-bakery-ink-500">
          Daha önce indirilen bir yedek dosyasını seçin. Yedekteki her kayıt kendi kimliğiyle üzerine yazılır;
          yedekte olmayan, sonradan eklenmiş kayıtlar silinmez.
        </p>
        <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-bakery-cream-200 bg-bakery-surface px-4 py-2 text-sm font-medium text-bakery-ink-700 hover:bg-bakery-cream-100">
          <Upload size={16} />
          Dosya Seç
          <input ref={dosyaInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleDosyaSec} />
        </label>
      </div>

      {seciliDosya && (
        <ConfirmModal
          baslik="Yedekten geri yükle"
          mesaj={`"${seciliDosya.name}" dosyasındaki veriler veritabanının üzerine yazılacak. Bu işlem geri alınamaz. Devam etmek istediğinize emin misiniz?`}
          onayEtiketi={yukleniyor ? 'Yükleniyor…' : 'Üzerine Yaz'}
          tehlikeli
          onOnayla={handleYukleOnayla}
          onVazgec={() => {
            setSeciliDosya(null)
            inputSifirla()
          }}
        />
      )}
    </div>
  )
}
