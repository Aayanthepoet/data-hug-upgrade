import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function EmptyModule({
  eyebrow,
  title,
  description,
  cta,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  cta?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="eyebrow inline-flex">
        <span className="eyebrow-dot" />
        {eyebrow}
      </div>
      <h1 className="h-display text-[clamp(28px,4vw,44px)] mt-4">{title}</h1>
      <p className="text-[var(--w55)] mt-3 max-w-xl">{description}</p>

      <div className="surface mt-10 p-10 text-center">
        <div className="text-5xl mb-4">✨</div>
        <div className="font-semibold">{t("empty.nothingYet")}</div>
        <div className="text-sm text-[var(--w45)] mt-2 max-w-md mx-auto">
          {t("empty.description")}
        </div>
        {cta && <div className="mt-6">{cta}</div>}
      </div>
    </div>
  );
}
