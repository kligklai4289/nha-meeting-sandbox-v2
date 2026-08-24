export function Loading({ label = 'กำลังโหลดข้อมูล...' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex items-center gap-3 text-sm text-slate-600"
    >
      <span className="size-5 animate-spin rounded-full border-2 border-blue-700 border-r-transparent" />
      {label}
    </div>
  )
}
