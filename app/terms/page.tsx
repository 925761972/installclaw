import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="legal-page">
        <div className="legal-container">
          <h1>用户服务协议</h1>
          <p className="legal-date">更新日期：2026年7月8日</p>

          <section>
            <h2>一、服务说明</h2>
            <p>净幕（以下简称"本平台"）是由宁波铭锦澜泽科技有限公司运营的在线视频处理工具，为用户提供视频字幕擦除、画面清理等音视频处理服务。</p>
            <p>在使用本平台服务前，请您仔细阅读本协议。您注册账号或使用本平台服务即表示您已充分理解并同意本协议的全部条款。</p>
          </section>

          <section>
            <h2>二、账号注册与使用</h2>
            <ul>
              <li>您需要注册账号并使用真实有效的邮箱地址完成注册，每个邮箱仅限注册一个账号。</li>
              <li>您应妥善保管账号和密码，因您保管不善造成的损失由您自行承担。</li>
              <li>您承诺不得利用本平台服务从事违法违规活动，不得上传、处理您不拥有合法权利的视频内容。</li>
            </ul>
          </section>

          <section>
            <h2>三、服务内容与积分规则</h2>
            <ul>
              <li>新用户注册可获得免费试用积分，可用于体验平台服务。</li>
              <li>本平台采用预付费积分模式，积分充值后不支持退款，除非法律另有规定。</li>
              <li>积分按视频实际处理时长计费，任务处理失败将全额退还已扣除的积分。</li>
              <li>处理完成的视频结果链接保留24小时，请您及时下载保存。</li>
            </ul>
          </section>

          <section>
            <h2>四、知识产权</h2>
            <p>您上传的视频内容知识产权归原权利人所有，本平台仅为您提供处理技术服务，不会将您的内容用于其他用途。您确认您拥有所上传视频的合法处理权利，因版权问题产生的纠纷由您自行承担责任。</p>
            <p>本平台的软件、技术、界面设计等知识产权归宁波铭锦澜泽科技有限公司所有。</p>
          </section>

          <section>
            <h2>五、免责声明</h2>
            <ul>
              <li>本平台按"现状"提供服务，不对服务效果做绝对保证。</li>
              <li>因不可抗力、系统维护、网络故障等原因导致服务中断或数据丢失，本平台不承担责任，但会尽力协助处理。</li>
              <li>您违法违规使用服务导致的一切后果由您自行承担。</li>
            </ul>
          </section>

          <section>
            <h2>六、协议修改</h2>
            <p>本平台有权根据需要修改本协议条款，修改后的协议将在网站公布，继续使用服务即表示您接受修改后的协议。</p>
          </section>

          <section>
            <h2>七、联系我们</h2>
            <p>如有任何问题，请通过平台客服联系我们。</p>
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
