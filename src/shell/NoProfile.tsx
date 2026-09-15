import { signOut } from 'firebase/auth'
import { requireAuth } from '../lib/firebase'

export default function NoProfile() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bakery-cream-50 px-4">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-lg shadow-bakery-coffee-900/10">
        <h1 className="mb-2 text-lg font-semibold text-bakery-coffee-900">Hesabınız henüz tanımlanmadı</h1>
        <p className="mb-4 text-sm text-bakery-coffee-600">
          Giriş yaptınız ancak size ait bir kullanıcı profili bulunamadı. Lütfen yöneticinizden{' '}
          <code className="rounded bg-bakery-cream-100 px-1.5 py-0.5">users</code> koleksiyonunda hesabınızı
          oluşturmasını isteyin.
        </p>
        <button
          onClick={() => signOut(requireAuth())}
          className="rounded-lg bg-bakery-coffee-700 px-4 py-2 text-sm font-medium text-white hover:bg-bakery-coffee-600"
        >
          Çıkış Yap
        </button>
      </div>
    </div>
  )
}
