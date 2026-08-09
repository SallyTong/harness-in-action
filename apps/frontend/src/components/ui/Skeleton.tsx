interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-brand-hover ${className}`}
      aria-hidden="true"
    />
  );
}
