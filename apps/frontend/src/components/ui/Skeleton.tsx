interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-[#F3F0ED] ${className}`}
      aria-hidden="true"
    />
  );
}
