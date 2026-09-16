export default function ConfigMissing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bakery-cream-50 px-4">
      <div className="max-w-md rounded-2xl bg-bakery-surface p-8 text-center shadow-lg shadow-bakery-coffee-900/10">
        <h1 className="mb-2 text-lg font-semibold text-bakery-ink-900">Firebase yapılandırması eksik</h1>
        <p className="text-sm text-bakery-ink-600">
          Proje kökünde bir <code className="rounded bg-bakery-cream-100 px-1.5 py-0.5">.env</code> dosyası
          bulunamadı ya da eksik. <code className="rounded bg-bakery-cream-100 px-1.5 py-0.5">.env.example</code>{' '}
          dosyasını <code className="rounded bg-bakery-cream-100 px-1.5 py-0.5">.env</code> olarak kopyalayıp
          Firebase Console'daki <strong>basakyeniyonetim</strong> projesinin bilgilerini girin.
        </p>
      </div>
    </div>
  )
}
