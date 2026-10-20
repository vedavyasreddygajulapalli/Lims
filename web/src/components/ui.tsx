import { tw } from "../styles/utilities";
import {
  useEffect,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
} from "react";
import {
  X,
  AlertCircle,
  Inbox,
  LoaderCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button className={tw(`btn btn-${variant} ${className}`)} {...props} />
  );
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={tw(`card ${className}`)}>{children}</section>;
}
export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
}) {
  return (
    <label className={tw("field")}>
      <span>{label}</span>
      <input {...props} />
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
}) {
  return (
    <label className={tw("field")}>
      <span>{label}</span>
      <select {...props}>{children}</select>
    </label>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
}) {
  return (
    <span className={tw(`badge badge-${tone}`)}>
      <span />
      {children}
    </span>
  );
}
export function Notice({
  children,
  tone = "amber",
}: {
  children: ReactNode;
  tone?: "amber" | "red" | "green";
}) {
  return (
    <div
      className={tw(`notice notice-${tone}`)}
      role={tone === "red" ? "alert" : "status"}
    >
      {tone === "green" ? (
        <CheckCircle2 size={16} />
      ) : (
        <AlertCircle size={16} />
      )}
      <div>{children}</div>
    </div>
  );
}
export function Loading() {
  return (
    <div className={tw("empty")}>
      <LoaderCircle className={tw("spin")} size={25} />
      <p>Loading your workspace…</p>
    </div>
  );
}
export function Empty({
  title = "No records found",
  description = "Try another search or add your first record.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className={tw("empty")}>
      <span className={tw("empty-icon")}>
        <Inbox size={26} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function PageHeader({
  eyebrow = "WORKSPACE",
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className={tw("page-heading")}>
      <div>
        <p className={tw("eyebrow")}>{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className={tw("pagination")}>
      <span>
        {total
          ? `${(page - 1) * 50 + 1}–${Math.min(page * 50, total)} of ${total} records`
          : "0 records"}
      </span>
      <div>
        <Button
          variant="secondary"
          disabled={page === 1}
          aria-label="Previous page"
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={15} />
        </Button>
        <span>
          Page {page} of {Math.max(1, Math.ceil(total / 50))}
        </span>
        <Button
          variant="secondary"
          disabled={page * 50 >= total}
          aria-label="Next page"
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={15} />
        </Button>
      </div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const elements = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
          ) ?? [],
        );
        if (!elements.length) {
          e.preventDefault();
          return;
        }
        const first = elements[0],
          last = elements[elements.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className={tw("overlay")}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={tw(`modal ${wide ? "modal-wide" : ""}`)}
      >
        <div className={tw("modal-title")}>
          <div>
            <p className={tw("eyebrow")}>LABORATORY RECORD</p>
            <h2>{title}</h2>
          </div>
          <Button variant="ghost" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
