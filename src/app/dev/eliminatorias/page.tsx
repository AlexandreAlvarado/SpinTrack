import { notFound } from "next/navigation";
import { KnockoutLocalDemo } from "@/components/knockout-local-demo";

export const dynamic = "force-dynamic";

export default function LocalEliminationDemoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <KnockoutLocalDemo />;
}
