import { redirect } from "next/navigation";

type MyAdsPageProps = {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{ tap_id?: string; tapId?: string; listingId?: string; section?: string }>;
};

export default async function MyAdsPage({ params, searchParams }: MyAdsPageProps) {
  const { lang } = await params;
  const sp = searchParams ? await searchParams : {};
  const query = new URLSearchParams({ tab: "ads" });
  if (sp.tap_id) query.set("tap_id", sp.tap_id);
  if (sp.tapId) query.set("tapId", sp.tapId);
  if (sp.listingId) query.set("listingId", sp.listingId);
  if (sp.section) query.set("section", sp.section);
  redirect(`/${lang}/profile?${query.toString()}`);
}
