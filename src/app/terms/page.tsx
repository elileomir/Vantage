import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/landing/legal-shell";

export const metadata: Metadata = { title: "Terms of Service — Vantage" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="14 June 2026">
      <p>These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the Vantage platform and related services (the &ldquo;Service&rdquo;) provided by iAutomateDev (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By accessing or using the Service you agree to these Terms.</p>

      <LegalSection heading="1. The Service">
        <p>Vantage is a subscription-based reporting and analytics workspace that connects to your business data sources, models that data into dashboards and reports, and provides assisted analysis and delivery features. Features available to you depend on your subscription plan.</p>
      </LegalSection>

      <LegalSection heading="2. Accounts & organisations">
        <p>The Service is provided to an organisation. The organisation owner may invite additional users and assign roles. You are responsible for maintaining the confidentiality of your credentials and for all activity under your account. Notify us promptly of any unauthorised use.</p>
      </LegalSection>

      <LegalSection heading="3. Subscriptions & plans">
        <p>Access is provided on a per-organisation subscription. Plan limits (such as the number of users, data-refresh cadence, and assisted-analysis usage) apply as described at the time of purchase. Pricing is provided on enquiry and may change with notice.</p>
      </LegalSection>

      <LegalSection heading="4. Your data">
        <p>You retain all rights to the data you connect or upload (&ldquo;Customer Data&rdquo;). You grant us a limited licence to process Customer Data solely to provide and improve the Service to you. We do not sell Customer Data. Our handling of personal data is described in our Privacy Policy.</p>
      </LegalSection>

      <LegalSection heading="5. Acceptable use">
        <p>You agree not to misuse the Service, including by attempting to breach security, reverse-engineer the platform, resell access without authorisation, or upload unlawful content. We may suspend access for material breach.</p>
      </LegalSection>

      <LegalSection heading="6. Third-party integrations">
        <p>The Service may connect to third-party systems (for example data sources and messaging channels). Your use of those services is governed by their own terms, and we are not responsible for their availability or content.</p>
      </LegalSection>

      <LegalSection heading="7. Availability & changes">
        <p>We aim to keep the Service available but do not guarantee uninterrupted operation. We may update, add or remove features over time. We will give reasonable notice of material changes that adversely affect your use.</p>
      </LegalSection>

      <LegalSection heading="8. Disclaimers & liability">
        <p>The Service is provided on an &ldquo;as is&rdquo; basis. To the fullest extent permitted by law, we disclaim implied warranties and are not liable for indirect or consequential losses. Analytics and assisted-analysis outputs are provided to support — not replace — your own judgement.</p>
      </LegalSection>

      <LegalSection heading="9. Termination">
        <p>You may cancel your subscription at any time, effective at the end of the current billing period. We may suspend or terminate access for breach of these Terms or non-payment.</p>
      </LegalSection>

      <LegalSection heading="10. Contact">
        <p>Questions about these Terms can be sent through the contact form on our website.</p>
      </LegalSection>
    </LegalShell>
  );
}
