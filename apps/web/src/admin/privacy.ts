export function maskPhone(value: string | null): string {
  if (!value || value.trim().length < 4) {
    return "—";
  }
  const digits = value.replace(/\D+/g, "");
  if (digits.length < 4) {
    return "—";
  }
  const tail = digits.slice(-3);
  return `*** *** ${tail}`;
}

export function maskEmail(value: string | null): string {
  if (!value || !value.includes("@")) {
    return "—";
  }
  const [name, domain] = value.split("@");
  if (!name || !domain) {
    return "—";
  }
  const visible = name.slice(0, 2);
  return `${visible}***@${domain}`;
}
