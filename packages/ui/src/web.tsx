import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren } from "react";

function clsx(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

type ClassNameProps = { className?: string };

export function Card({ className, children }: PropsWithChildren<ClassNameProps>) {
  return <div className={clsx("rounded-xl border border-slate-200 bg-white p-5 shadow-sm", className)}>{children}</div>;
}

export function Badge({ children }: PropsWithChildren<ClassNameProps>) {
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{children}</span>;
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

