export default function ComingSoon({ title = 'This page' }) {
  return (
    <div>
      <h1 className="text-3xl">{title}</h1>
      <div className="mt-6 rounded-xl border border-line bg-white p-6">
        <p className="text-sm text-muted">This screen is not built yet.</p>
      </div>
    </div>
  )
}
