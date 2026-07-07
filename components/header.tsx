import Link from "next/link";
import { Coins } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";

export async function Header() {
  const user = await getCurrentUser();
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Logo />
        <nav className="main-nav" aria-label="主导航">
          <Link href="/#how">怎么用</Link>
          <Link href="/pricing">价格</Link>
          <Link href="/#quality">效果说明</Link>
        </nav>
        <div className="nav-actions">
          {user ? (
            <>
              <Link className="balance-pill" href="/pricing"><Coins size={15} />{user.points_balance.toLocaleString()} 积分</Link>
              <Link className="button button-dark button-small" href="/dashboard">工作台</Link>
            </>
          ) : (
            <>
              <Link className="login-link" href="/login">登录</Link>
              <Link className="button button-primary button-small" href="/register">免费开始</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
