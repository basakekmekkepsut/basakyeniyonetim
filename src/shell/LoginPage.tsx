import { useState, type FormEvent } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { requireAuth } from '../lib/firebase'

const HATA_MESAJLARI: Record<string, string> = {
  'auth/invalid-credential': 'E-posta veya şifre hatalı.',
  'auth/invalid-email': 'Geçersiz e-posta adresi.',
  'auth/user-disabled': 'Bu hesap devre dışı bırakılmış.',
  'auth/user-not-found': 'Bu e-posta ile bir hesap bulunamadı.',
  'auth/wrong-password': 'E-posta veya şifre hatalı.',
  'auth/too-many-requests': 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.',
  'auth/network-request-failed': 'İnternet bağlantınızı kontrol edin.'
}

function hataMesaji(err: unknown): string {
  const code = (err as { code?: string })?.code
  if (code && HATA_MESAJLARI[code]) return HATA_MESAJLARI[code]
  return 'Giriş yapılamadı. Lütfen tekrar deneyin.'
}

export default function LoginPage() {
  const [eposta, setEposta] = useState('')
  const [sifre, setSifre] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [gonderiliyor, setGonderiliyor] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setHata(null)
    setGonderiliyor(true)
    try {
      await signInWithEmailAndPassword(requireAuth(), eposta.trim(), sifre)
    } catch (err) {
      setHata(hataMesaji(err))
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bakery-cream-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg shadow-bakery-coffee-900/10">
        <div className="mb-6 text-center">
          <img src="/logo.webp" alt="Başak Ekmek" className="mx-auto mb-3 h-16 w-44 rounded-lg object-cover object-center" />
          <h1 className="text-xl font-semibold text-bakery-coffee-900">Başak Ekmek Yönetim</h1>
          <p className="mt-1 text-sm text-bakery-coffee-600">Devam etmek için giriş yapın</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-coffee-800" htmlFor="eposta">
              E-posta
            </label>
            <input
              id="eposta"
              type="email"
              required
              autoComplete="username"
              value={eposta}
              onChange={(e) => setEposta(e.target.value)}
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2.5 text-bakery-coffee-900 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-coffee-800" htmlFor="sifre">
              Şifre
            </label>
            <input
              id="sifre"
              type="password"
              required
              autoComplete="current-password"
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2.5 text-bakery-coffee-900 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
            />
          </div>

          {hata && (
            <p className="rounded-lg bg-bakery-danger/10 px-3 py-2 text-sm text-bakery-danger">{hata}</p>
          )}

          <button
            type="submit"
            disabled={gonderiliyor}
            className="w-full rounded-lg bg-bakery-amber-600 py-2.5 font-medium text-white transition hover:bg-bakery-amber-500 disabled:opacity-60"
          >
            {gonderiliyor ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  )
}
