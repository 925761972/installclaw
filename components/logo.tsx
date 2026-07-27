import Link from "next/link";

export function Logo() {
  return (
    <Link className="brand" href="/" aria-label="净幕首页">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
      <span>净幕</span>
    </Link>
  );
}
