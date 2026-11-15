export default function Logo({ light = true, size = 34 }) {
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="18" fill="#7fd6cf" />
        <circle cx="22" cy="10" r="3" fill="#0b3c44" />
        <path d="M9 27c0-8 5-13 11-13" fill="none" stroke="#0b3c44" strokeWidth="3" strokeLinecap="round" />
        <path d="M14 28c0-5 3-8 8-8" fill="none" stroke="#0b3c44" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className={`font-serif text-xl ${light ? 'text-white' : 'text-brand-deep'}`}>AgapayIsip+</span>
    </div>
  )
}
