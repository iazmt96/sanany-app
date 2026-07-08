import { ListingDetailsShell } from "../../../../src/components/listing-details-shell";

type ListingDetailsPageProps = {
  params: Promise<{ lang: string; id: string }>;
};

export default async function ListingDetailsPage({ params }: ListingDetailsPageProps) {
  const { lang, id } = await params;
  return <ListingDetailsShell language={lang} listingId={id} />;
}

