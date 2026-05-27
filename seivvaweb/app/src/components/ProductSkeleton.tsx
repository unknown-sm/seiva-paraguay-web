interface ProductSkeletonProps {
  count?: number
  className?: string
}

export default function ProductSkeleton({ count = 8, className = '' }: ProductSkeletonProps) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl overflow-hidden animate-pulse"
          style={{ backgroundColor: 'var(--theme-surface, #FFFFFF)' }}
        >
          <div
            className="w-full aspect-square"
            style={{ backgroundColor: 'var(--theme-border, #E8E0D5)' }}
          />
          <div className="p-3 sm:p-4 space-y-2">
            <div className="h-4 w-3/4 rounded" style={{ backgroundColor: 'var(--theme-border, #E8E0D5)' }} />
            <div className="h-3 w-1/2 rounded" style={{ backgroundColor: 'var(--theme-border, #E8E0D5)' }} />
            <div className="flex items-center justify-between pt-1">
              <div className="h-4 w-16 rounded" style={{ backgroundColor: 'var(--theme-border, #E8E0D5)' }} />
              <div className="h-8 w-20 rounded-full" style={{ backgroundColor: 'var(--theme-border, #E8E0D5)' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
