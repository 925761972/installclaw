import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { PricingInviteBanner } from "@/components/pricing-invite-banner";

export default function InvitePage() {
  return (
    <>
      <Header />
      <main className="invite-page">
        <PricingInviteBanner />
      </main>
      <Footer />
    </>
  );
}