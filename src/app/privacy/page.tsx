import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/landing/legal-shell";

export const metadata: Metadata = { title: "Privacy Policy — Vantage" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="15 June 2026">
      <p>This Privacy Policy explains how iAutomateDev (&ldquo;Vantage&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, shares and protects personal information in connection with the Vantage platform (the &ldquo;Service&rdquo;). It is written to align with the South African Protection of Personal Information Act, 2013 (&ldquo;POPIA&rdquo;) and, where applicable, the EU General Data Protection Regulation (&ldquo;GDPR&rdquo;).</p>
      <p>For data you connect or upload (&ldquo;Customer Data&rdquo;), your organisation is the <b>responsible party / controller</b> and Vantage acts as an <b>operator / processor</b>, handling that data only on your documented instructions.</p>

      <LegalSection heading="1. Who we are & how to contact us">
        <p>iAutomateDev is the responsible party for personal information processed about visitors and account holders. Our <b>Information Officer</b> can be reached at <b>privacy@iautomatedev.com</b> for any privacy question, access request, or to exercise the rights described below. You may also use the contact form on our website.</p>
      </LegalSection>

      <LegalSection heading="2. Personal information we collect">
        <p>We collect only what we need:</p>
        <p><b>Account &amp; enquiry data</b> — name, work email, company, role, team size and any message you send us. <b>Usage &amp; technical data</b> — log data, IP address, browser/device type and approximate location, collected to operate and secure the Service. <b>Customer Data</b> — the business data your organisation connects from its sources, which remains under your control. We do not deliberately collect special-category data or data relating to children; please do not upload it without a lawful basis.</p>
      </LegalSection>

      <LegalSection heading="3. Why we process it (lawful basis)">
        <p><b>Performance of a contract</b> — to provide the Service, run system updates and handle billing. <b>Legitimate interests</b> — analytics, error monitoring, platform security and product improvement, balanced against your rights. <b>Consent</b> — for non-essential marketing or telemetry, which you may withdraw at any time. <b>Legal obligation</b> — to meet tax, accounting and lawful-request requirements.</p>
      </LegalSection>

      <LegalSection heading="4. Cookies & tracking">
        <p>We use <b>essential cookies</b> to authenticate sessions and keep the Service secure. Any non-essential analytics cookies are used only where permitted, and you can manage non-essential cookies without losing access to the app. We honour browser &ldquo;do not track&rdquo; signals where required.</p>
      </LegalSection>

      <LegalSection heading="5. How we share information & our sub-processors">
        <p>We do not sell personal information. We share it only with vetted sub-processors who help us run the Service under binding data-processing agreements, including our hosting and application platform (Vercel), our database and authentication provider (Supabase), and our automation/notification provider (n8n). We will give reasonable notice before adding or changing a material sub-processor, and may also disclose information where required by law.</p>
      </LegalSection>

      <LegalSection heading="6. International transfers">
        <p>Your information may be processed outside South Africa or the EU. Where it is, we rely on lawful transfer mechanisms — such as transfers to countries with adequate protection, EU Standard Contractual Clauses, or the conditions for cross-border transfer under POPIA section 72 — to ensure an equivalent level of protection.</p>
      </LegalSection>

      <LegalSection heading="7. How long we keep it">
        <p>We keep account and Customer Data for as long as your organisation uses the Service. After termination, Customer Data is deleted or securely anonymised within <b>90 days</b>, except where we must retain certain records (for example financial and tax records, typically for <b>5–7 years</b>) to meet legal obligations.</p>
      </LegalSection>

      <LegalSection heading="8. Your rights">
        <p>Subject to applicable law, you may <b>access</b> the personal information we hold, request a <b>correction</b> or <b>deletion</b>, <b>object to</b> or <b>restrict</b> certain processing, <b>withdraw consent</b>, and request a portable <b>export</b> of your data. To exercise any right, contact privacy@iautomatedev.com. You also have the right to lodge a complaint with the <b>South African Information Regulator</b> or, in the EU, your local supervisory authority.</p>
      </LegalSection>

      <LegalSection heading="9. Security & breach notification">
        <p>We protect data with organisation-scoped access, role-based permissions, row-level security and encryption in transit. No system is perfectly secure; if a breach affecting your personal information occurs, we will notify the relevant regulator and affected users as soon as reasonably possible (and, where GDPR applies, the supervisory authority within 72 hours of becoming aware), in line with POPIA section 22.</p>
      </LegalSection>

      <LegalSection heading="10. Children">
        <p>The Service is intended for business use and is not directed at children. We do not knowingly collect personal information from children.</p>
      </LegalSection>

      <LegalSection heading="11. Changes & contact">
        <p>We may update this Policy and will revise the date above; material changes will be notified to account holders. For any privacy matter, contact <b>privacy@iautomatedev.com</b>.</p>
      </LegalSection>
    </LegalShell>
  );
}
