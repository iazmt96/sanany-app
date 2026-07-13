import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren } from "react";

function clsx(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

type ClassNameProps = { className?: string };

export function Card({ className, children }: PropsWithChildren<ClassNameProps>) {
  return <div className={clsx("rounded-xl border border-slate-200 bg-white p-5 shadow-sm", className)}>{children}</div>;
}

type BadgeVariant = "default" | "available" | "reserved" | "draft" | "inactive";

export function Badge({ children, className, variant = "default" }: PropsWithChildren<ClassNameProps & { variant?: BadgeVariant }>) {
  const variantClassName =
    variant === "available"
      ? "bg-emerald-100 text-emerald-800"
      : variant === "reserved"
        ? "bg-amber-100 text-amber-800"
        : variant === "draft"
          ? "bg-sky-100 text-sky-800"
          : variant === "inactive"
            ? "bg-slate-200 text-slate-700"
        : "bg-slate-100 text-slate-700";

  return <span className={clsx("rounded-full px-2 py-1 text-xs font-semibold", variantClassName, className)}>{children}</span>;
}

export function Button({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark",
        className
      )}
    >
      {children}
    </button>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand focus:ring-2",
        className
      )}
    />
  );
}
