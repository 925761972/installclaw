import Link from "next/link";

export function Logo({ showOperator = false }: { showOperator?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="净幕首页">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
      <span>净幕</span>
      {showOperator ? <small className="brand-operator">铭锦澜泽</small> : null}
    </Link>
  );
}
