export default function SummaryLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="h-5 w-40 bg-gray-100 rounded-full animate-pulse mb-8" />

      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 text-sm text-gray-400">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Generating your reflection summaries…
        </div>
      </div>

      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="bg-white border border-gray-100 rounded-2xl p-5 mb-4 animate-pulse"
          style={{ animationDelay: `${i * 0.15}s` }}
        >
          <div className="h-3.5 bg-gray-100 rounded-full w-full mb-2.5" />
          <div className="h-3.5 bg-gray-100 rounded-full w-5/6 mb-2.5" />
          <div className="h-3.5 bg-gray-100 rounded-full w-4/6" />
        </div>
      ))}
    </div>
  )
}
