import type { ReactNode } from "react";

type Props = {
  label: string;
  children: ReactNode;
  error?: string;
  hint?: string;
};

export function Field({ label, children, error, hint }: Props) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

export function FormStatus({ error, success }: { error?: string; success?: string }) {
  if (error) return <p className="form-alert form-alert-error">{error}</p>;
  if (success) return <p className="form-alert form-alert-ok">{success}</p>;
  return null;
}
