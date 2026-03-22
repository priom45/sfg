import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export default function LegalPageLayout({
  eyebrow,
  title,
  summary,
  updatedAt,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-brand-bg min-h-screen">
      <section className="relative overflow-hidden border-b border-brand-border">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.16),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.05),_transparent_28%)]" />
        <div className="relative section-padding py-16 lg:py-20">
          <div className="max-w-3xl">
            <span className="section-label">{eyebrow}</span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mt-3 mb-5 leading-tight">
              {title}
            </h1>
            <p className="text-brand-text-muted text-base sm:text-lg leading-relaxed max-w-2xl">
              {summary}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-brand-text-dim">
              <span>Last updated: {updatedAt}</span>
              <Link to="/" className="text-brand-gold hover:text-brand-gold-soft transition-colors">
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding py-10 lg:py-14">
        <div className="max-w-4xl space-y-6">
          {children}
        </div>
      </section>
    </div>
  );
}
