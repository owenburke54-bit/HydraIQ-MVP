import { HTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        "animate-pulse rounded-md bg-zinc-200/70 dark:bg-zinc-800",
        className
      )}
      {...props}
    />
  );
}

export default Skeleton;

