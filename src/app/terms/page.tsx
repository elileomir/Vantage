import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/landing/legal-shell";

export const metadata: Metadata = { title: "Terms of Service — Vantage" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="15 June 2026">
      <p>These Terms of Service (&ldquo;Terms&rdquo;) are a binding agreement between iAutomateDev (&ldquo;Vantage&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) and the organisation that subscribes to the Vantage platform and related services (the &ldquo;Service&rdquo;). By accessing or using the Service you agree to these Terms. How we handle personal information is described in our Privacy Policy.</p>

      <LegalSection heading="1. The Service & licence">
        <p>Vantage is a subscription reporting and analytics workspace that connects to your business data, models it into dashboards and reports, and provides assisted analysis and delivery features. We grant your organisation a <b>revocable, non-exclusive, non-transferable subscription licence</b> to access the Service during your subscription. This is a licence to use the Service, not a sale of software. Features available to you depend on your plan.</p>
      </LegalSection>

      <LegalSection heading="2. Accounts & organisations">
        <p>The Service is provided to an organisation. The organisation owner may invite users and assign roles, and is responsible for their use. You must keep credentials confidential and notify us promptly of any unauthorised access. You are responsible for all activity under your account.</p>
      </LegalSection>

      <LegalSection heading="3. Acceptable use">
        <p>You agree not to: reverse-engineer, decompile or scan the Service for vulnerabilities; scrape, overload or flood our APIs; resell or sublicense access without authorisation; or upload unlawful, infringing, malicious or defamatory content. We may suspend access for material breach.</p>
      </LegalSection>

      <LegalSection heading="4. Subscriptions, fees & billing">
        <p>Access is provided on a per-organisation subscription with the limits of your plan (users, data-refresh cadence and assisted-analysis usage). Pricing is provided on enquiry. Fees may be billed in advance and renew automatically unless cancelled; applicable taxes (such as South African or EU VAT on electronic services) are added where required. If an account falls into arrears, we may, after a reasonable grace period, suspend access and ultimately remove data.</p>
      </LegalSection>

      <LegalSection heading="5. Service availability">
        <p>We aim to keep the Service available and to schedule maintenance considerately, but we do not guarantee uninterrupted or error-free operation. Any service-level commitments, where offered, will be set out in a separate order or service-level agreement.</p>
      </LegalSection>

      <LegalSection heading="6. Your data & intellectual property">
        <p>You retain all rights to the data you connect or upload (&ldquo;Customer Data&rdquo;). You grant us a limited licence to host and process Customer Data solely to provide and improve the Service to you. We retain all rights to the Vantage platform, software, models and brand. Aggregated, de-identified statistics that cannot identify you or your organisation may be used to operate and improve the Service.</p>
      </LegalSection>

      <LegalSection heading="7. Third-party integrations & sub-processors">
        <p>The Service connects to third-party systems (such as your data sources and messaging channels) and relies on sub-processors to operate (see our Privacy Policy). Your use of third-party services is governed by their own terms, and we are not responsible for their availability or content.</p>
      </LegalSection>

      <LegalSection heading="8. Confidentiality">
        <p>Each party may receive confidential information from the other. Each agrees to protect the other&apos;s confidential information with reasonable care and to use it only to perform under these Terms.</p>
      </LegalSection>

      <LegalSection heading="9. Disclaimers & limitation of liability">
        <p>The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. To the fullest extent permitted by law, we disclaim implied warranties and are not liable for indirect, incidental or consequential losses, or for lost profits or data. Analytics and assisted-analysis outputs support — they do not replace — your own judgement. Nothing in these Terms excludes liability that cannot lawfully be excluded.</p>
      </LegalSection>

      <LegalSection heading="10. Suspension & termination">
        <p>You may cancel your subscription at any time, effective at the end of the current billing period. We may suspend or terminate access for breach of these Terms or non-payment. On termination, your data is handled as described in our Privacy Policy.</p>
      </LegalSection>

      <LegalSection heading="11. Governing law">
        <p>These Terms are governed by the laws of the Republic of South Africa, and the parties submit to the jurisdiction of its courts, without prejudice to any mandatory consumer or data-protection rights you may have in your own jurisdiction.</p>
      </LegalSection>

      <LegalSection heading="12. Changes & contact">
        <p>We may update these Terms and will revise the date above; we will give reasonable notice of material changes that adversely affect you. Questions about these Terms can be sent through the contact form on our website or to <b>privacy@iautomatedev.com</b>.</p>
      </LegalSection>
    </LegalShell>
  );
}
