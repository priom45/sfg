import type { ReactNode } from 'react';
import LegalPageLayout from '../components/LegalPageLayout';

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-brand-surface rounded-2xl border border-brand-border p-6 sm:p-7">
      <h2 className="text-white text-xl font-bold mb-3">{title}</h2>
      <div className="space-y-3 text-brand-text-muted leading-relaxed text-[15px]">
        {children}
      </div>
    </section>
  );
}

export default function TermsOfService() {
  return (
    <LegalPageLayout
      eyebrow="Terms Of Service"
      title="The basic rules for using The Supreme Waffle website"
      summary="These terms govern use of the public website, account features, and ordering experience offered through The Supreme Waffle."
      updatedAt="March 14, 2026"
    >
      <Section title="1. Use of the service">
        <p>
          By using this website, you agree to use it only for lawful purposes and in a way that does
          not interfere with the service, our operations, or other users.
        </p>
      </Section>

      <Section title="2. Accounts and authentication">
        <p>
          You are responsible for the accuracy of the information you provide during sign-in,
          registration, or checkout. You are also responsible for maintaining the security of your
          account access methods and for activity carried out through your account.
        </p>
      </Section>

      <Section title="3. Orders, pricing, and availability">
        <p>
          Menu items, offers, prices, preparation times, and delivery availability may change without
          notice. We may limit, reject, or cancel an order if an item is unavailable, an offer is
          misused, or operational constraints prevent fulfillment.
        </p>
      </Section>

      <Section title="4. Acceptable use">
        <p>
          You must not misuse the service, attempt unauthorized access, interfere with the platform,
          automate abusive requests, submit false information, or use the website in violation of any
          applicable law.
        </p>
      </Section>

      <Section title="5. Intellectual property">
        <p>
          Website content, branding, logos, designs, text, and media associated with The Supreme
          Waffle remain the property of their respective owners and may not be copied or reused
          without permission, except as allowed by law.
        </p>
      </Section>

      <Section title="6. Service changes and termination">
        <p>
          We may update, suspend, or discontinue any part of the service at any time. We may also
          restrict access where needed for security, maintenance, abuse prevention, or legal
          compliance.
        </p>
      </Section>

      <Section title="7. Liability">
        <p>
          To the extent permitted by law, The Supreme Waffle is not liable for indirect, incidental,
          special, or consequential losses arising from use of the service, temporary unavailability,
          or inaccurate information supplied by users or third parties.
        </p>
      </Section>

      <Section title="8. Contact">
        <p>
          For questions about these terms, contact thesupremewafflee@gmail.com or use the contact form on
          the About page.
        </p>
      </Section>
    </LegalPageLayout>
  );
}
