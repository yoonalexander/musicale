import Link from "next/link";
import type { Route } from "next";

interface ModeCardProps {
  href: Route;
  title: string;
  eyebrow: string;
  description: string;
  cta: string;
}

export function ModeCard({
  href,
  title,
  eyebrow,
  description,
  cta,
}: ModeCardProps) {
  return (
    <article className="mode-card">
      <span className="eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      <Link className="primary-button" href={href}>
        {cta}
      </Link>
    </article>
  );
}
