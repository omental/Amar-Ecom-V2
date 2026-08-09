import { cloneElement, useId, type ReactElement } from "react";

export function FormField({ label, description, error, required, children }: { label: string; description?: string; error?: string; required?: boolean; children: ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean; required?: boolean }> }) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  return <div className="space-y-1.5">
    <label htmlFor={id} className="block text-sm font-semibold text-[var(--color-txt-pri)]">{label}{required ? <span aria-hidden="true" className="ml-1 text-rose-600">*</span> : null}{required ? <span className="sr-only"> (required)</span> : null}</label>
    {description ? <p id={descriptionId} className="text-xs leading-5 text-[var(--color-txt-mut)]">{description}</p> : null}
    {cloneElement(children, { id, required: required || children.props.required, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
    {error ? <p id={errorId} role="alert" className="text-xs font-medium text-rose-600">{error}</p> : null}
  </div>;
}

export type FormFieldErrors = Record<string, string | undefined>;
