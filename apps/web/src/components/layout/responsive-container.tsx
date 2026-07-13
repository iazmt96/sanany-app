import { PropsWithChildren } from "react";

type ResponsiveContainerProps = PropsWithChildren<{
  className?: string;
}>;

export function ResponsiveContainer({ className, children }: ResponsiveContainerProps) {
  return <div className={`mx-auto w-full max-w-[1440px] px-3 sm:px-4 lg:px-6 ${className ?? ""}`}>{children}</div>;
}

