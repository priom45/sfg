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

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      eyebrow="Privacy Policy"
      title="How The Supreme Waffle handles customer data"
      summary="This page explains what information we collect through our website and ordering experience, how we use it, and how customers can contact us about their data."
      updatedAt="March 14, 2026"
    >
      <Section title="1. Information we collect">
        <p>
          We may collect your name, phone number, email address, delivery details, account profile
          information, order history, and any message you send through our contact forms.
        </p>
        <p>
          We also collect technical information needed to operate the website, such as device,
          browser, log, and session data.
        </p>
      </Section>

      <Section title="2. How we use your information">
        <p>
          We use your information to create and manage your account, verify logins, process orders,
          provide delivery and support, respond to inquiries, improve the service, and protect the
          platform from fraud or misuse.
        </p>
      </Section>

      <Section title="3. Google and third-party sign-in">
        <p>
          If we enable Google sign-in or another OAuth provider, we will only access the account
          details you explicitly authorize, such as your name, email address, and profile image.
        </p>
        <p>
          We do not sell Google user data and we use third-party account data only to authenticate
          users, support account creation, and operate requested features.
        </p>
      </Section>

      <Section title="4. Storage and sharing">
        <p>
          Account and order information may be stored using service providers that help us run the
          app infrastructure, authentication, and database systems.
        </p>
        <p>
          We may share information with vendors or partners only when it is necessary to operate the
          service, comply with law, or protect our business, customers, or users.
        </p>
      </Section>

      <Section title="5. Data retention">
        <p>
          We retain personal data for as long as needed to provide the service, maintain required
          business records, resolve disputes, and meet legal obligations. When data is no longer
          needed, we aim to delete or anonymize it within a reasonable period.
        </p>
      </Section>

      <Section title="6. Your choices">
        <p>
          You may contact us to update or delete account information, request a copy of your data,
          or ask questions about how your information is used. Some data may still be retained where
          required for legal, security, or operational reasons.
        </p>
      </Section>

      <Section title="7. Contact">
        <p>
          For privacy-related questions, contact The Supreme Waffle at hello@supremewaffle.com or
          visit our contact page at /about.
        </p>
      </Section>
    </LegalPageLayout>
  );
}
