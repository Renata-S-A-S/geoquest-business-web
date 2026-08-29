export function RoutePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center rounded-md bg-surface-mint">
      <span className="font-mono text-xs text-muted">{label}</span>
    </div>
  )
}
