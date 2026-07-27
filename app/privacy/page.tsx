import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="legal-page">
        <div className="legal-container">
          <h1>隐私政策</h1>
          <p className="legal-date">更新日期：2026年7月8日</p>

          <section>
            <h2>一、信息收集</h2>
            <p>我们仅收集提供服务所必需的信息：</p>
            <ul>
              <li><strong>账户信息：</strong>您注册时提供的邮箱地址，用于登录和账号管理。</li>
              <li><strong>支付信息：</strong>充值时通过支付宝等支付渠道完成交易，我们不会存储您的支付密码或银行卡信息。</li>
              <li><strong>使用数据：</strong>您处理的视频任务记录、积分变动记录，用于提供服务和问题排查。</li>
              <li><strong>上传内容：</strong>您上传的视频文件仅用于本次处理任务，处理完成后会按规则在服务端定期清理，不会用于其他用途。</li>
            </ul>
          </section>

          <section>
            <h2>二、信息使用</h2>
            <ul>
              <li>我们使用收集的信息为您提供、维护和改进服务。</li>
              <li>我们不会向第三方出售、出租您的个人信息。</li>
              <li>仅在以下情况下会共享信息：法律要求、为完成支付交易、保护我们和用户的合法权益。</li>
            </ul>
          </section>

          <section>
            <h2>三、数据存储</h2>
            <ul>
              <li>您的个人信息和账户数据安全存储在服务器中，采用加密措施保护。</li>
              <li>处理完成的视频文件会在服务器保留24小时供您下载，之后自动删除。</li>
            </ul>
          </section>

          <section>
            <h2>四、您的权利</h2>
            <ul>
              <li>您可以随时登录账号查看您的账户信息和任务记录。</li>
              <li>您可以申请注销账号，注销后您的个人信息将依法删除。</li>
            </ul>
          </section>

          <section>
            <h2>五、Cookie 使用</h2>
            <p>我们使用 Cookie 来维持您的登录状态，不会用于跨网站追踪。您可以在浏览器设置中管理Cookie。</p>
          </section>

          <section>
            <h2>六、政策更新</h2>
            <p>我们可能会更新本隐私政策，更新后将在网站公布，重大变更会通过适当方式通知您。</p>
          </section>

          <section>
            <h2>七、联系我们</h2>
            <p>如有隐私相关问题，请联系我们。</p>
          </section>

          <div className="legal-footer">
            <Link href="/">返回首页</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
