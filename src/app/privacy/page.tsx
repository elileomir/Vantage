import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/landing/legal-shell";

export const metadata: Metadata = { title: "Privacy Policy — Vantage" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="14 June 2026">
      <p>This Privacy Policy explains how iAutomateDev (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses and protects information in connection with the Vantage platform (the &ldquo;Service&rdquo;).</p>

      <LegalSection heading="1. Information we collect">
        <p>We collect: (a) <b>account information</b> you provide (name, work email, company, role); (b) <b>enquiry information</b> you submit through our contact form; and (c) <b>Customer Data</b> from the sources your organisation connects to the Service. We also collect basic usage and device information to operate and secure the Service.</p>
      </LegalSection>

      <LegalSection heading="2. How we use information">
        <p>We use information to provide, secure and improve the Service, to respond to your enquiries, to administer your subscription, and to communicate with you about the Service. We process Customer Data only to deliver the Service to your organisation.</p>
      </LegalSection>

      <LegalSection heading="3. Legal bases & consent">
        <p>Where required, we rely on your consent, the performance of a contract with you, and our legitimate interests in operating the Service. You may withdraw consent for non-essential communications at any time.</p>
      </LegalSection>

      <LegalSection heading="4. Sharing">
        <p>We do not sell personal data. We share information only with service providers who help us operate the Service (such as hosting and database providers) under appropriate confidentiality and data-protection obligations, and where required by law.</p>
      </LegalSection>

      <LegalSection heading="5. Data security">
        <p>We use organisation-scoped access controls, role-based permissions and row-level security to protect data, alongside encryption in transit. No system is perfectly secure, but we work to protect your information using reasonable safeguards.</p>
      </LegalSection>

      <LegalSection heading="6. Retention">
        <p>We retain account and Customer Data for as long as your organisation uses the Service, and thereafter only as needed to meet legal obligations or resolve disputes. You may request deletion subject to those obligations.</p>
      </LegalSection>

      <LegalSection heading="7. Your rights">
        <p>Depending on your location, you may have rights to access, correct, export or delete your personal data, and to object to or restrict certain processing. Contact us to exercise these rights.</p>
      </LegalSection>

      <LegalSection heading="8. International processing">
        <p>Your information may be processed in countries other than your own. Where we transfer data internationally, we take steps to ensure an appropriate level of protection.</p>
      </LegalSection>

      <LegalSection heading="9. Contact">
        <p>For privacy questions or requests, please use the contact form on our website.</p>
      </LegalSection>
    </LegalShell>
  );
}
