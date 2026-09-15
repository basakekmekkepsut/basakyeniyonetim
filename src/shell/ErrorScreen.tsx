export default function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bakery-cream-50 px-4">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-lg shadow-bakery-coffee-900/10">
        <h1 className="mb-2 text-lg font-semibold text-bakery-danger">Bir sorun oluştu</h1>
        <p className="text-sm text-bakery-coffee-600">{message}</p>
      </div>
    </div>
  )
}
