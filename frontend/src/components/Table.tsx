import type { ReactNode } from "react";

type TableProps = {
  children: ReactNode;
  className?: string;
};

export function Table({ children, className = "" }: TableProps) {
  return (
    <div className={`w-full overflow-x-auto rounded-2xl shadow bg-white/10 ${className}`}>
      <table className="min-w-full text-sm">{children}</table>
    </div>
  );
}
