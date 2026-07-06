const JINGMU_SITE_URL_KEY = 'jingmu_site_url';
const JINGMU_DEVICE_ID_KEY = 'jingmu_helper_device_id';
const JINGMU_HELPER_TOKEN_KEY = 'jingmu_helper_access_token';
const JINGMU_DEFAULT_SITE_URL = 'http://127.0.0.1:3000';

var HelperLicense = {
    status: null,
    authMode: 'login',

    getSiteUrl() {
        try { return (localStorage.getItem(JINGMU_SITE_URL_KEY) || JINGMU_DEFAULT_SITE_URL).replace(/\/$/, ''); }
        catch (_) { return JINGMU_DEFAULT_SITE_URL; }
    },
    getToken() { try { return localStorage.getItem(JINGMU_HELPER_TOKEN_KEY) || ''; } catch (_) { return ''; } },
    saveToken(token) { localStorage.setItem(JINGMU_HELPER_TOKEN_KEY, token); },
    clearToken() { localStorage.removeItem(JINGMU_HELPER_TOKEN_KEY); },
    getDeviceId() {
        try {
            let id = localStorage.getItem(JINGMU_DEVICE_ID_KEY);
            if (!id) { id = 'device_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12); localStorage.setItem(JINGMU_DEVICE_ID_KEY, id); }
            return id;
        } catch (_) { return 'device_fallback_' + Math.random().toString(36).slice(2, 12); }
    },
    async request(endpoint, body, needsAuth = true) {
        const headers = { 'Content-Type': 'application/json' };
        if (needsAuth && this.getToken()) headers.Authorization = `Bearer ${this.getToken()}`;
        const response = await fetch(`${this.getSiteUrl()}${endpoint}`, { method: 'POST', headers, body: JSON.stringify(body || {}) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) { const error = new Error(data.error || '请求失败'); error.status = response.status; error.data = data; throw error; }
        return data;
    },
    async refresh() {
        if (!this.getToken()) { this.status = null; this.renderAll(); return null; }
        try {
            this.status = await this.request('/api/helper-license/status', { deviceId: this.getDeviceId() });
        } catch (error) {
            if (error.status === 401) this.clearToken();
            this.status = null;
        }
        this.renderAll();
        return this.status;
    },
    async submitAuth(event) {
        event.preventDefault();
        const email = document.getElementById('helperAuthEmail').value.trim();
        const password = document.getElementById('helperAuthPassword').value;
        const button = document.getElementById('helperAuthSubmit');
        button.disabled = true; button.textContent = '处理中...';
        try {
            const data = await this.request(`/api/helper-auth/${this.authMode}`, { email, password, deviceId: this.getDeviceId() }, false);
            this.saveToken(data.token);
            showMessage(this.authMode === 'register' ? '注册成功，已赠送 3 条免费下载体验' : '登录成功', 'success');
            await this.refresh();
        } catch (error) { showMessage(error.message || '操作失败', 'error'); }
        finally { button.disabled = false; this.renderAccount(); }
    },
    setAuthMode(mode) { this.authMode = mode; this.renderAccount(); },
    async logout() {
        try { await this.request('/api/helper-auth/logout', {}); } catch (_) {}
        this.clearToken(); this.status = null; this.authMode = 'login'; this.renderAll();
        showMessage('已退出登录', 'success');
    },
    async activateMock(planId) {
        if (!this.getToken()) { this.openAccount('login'); showMessage('请先注册或登录', 'error'); return; }
        try {
            await this.request('/api/helper-license/mock-activate', { planId });
            await this.refresh();
            showMessage('会员已开通（本地测试模式）', 'success');
        } catch (error) { showMessage(error.message || '开通失败', 'error'); }
    },
    async consume(videoCount) {
        if (!this.getToken()) { this.openAccount('login'); return { allowed: false, error: '请先注册或登录，首次注册可免费体验 3 条' }; }
        try {
            const data = await this.request('/api/helper-license/consume', { deviceId: this.getDeviceId(), videoCount: videoCount || 1 });
            this.status = { user: this.status?.user, license: data.license }; this.renderAll();
            return { allowed: true };
        } catch (error) { this.openAccount(); return { allowed: false, error: error.message || '请开通会员后继续下载' }; }
    },
    defaultPlans() {
        return [
            { id: 'helper_monthly', name: '月度会员', priceYuan: 39, description: '适合短期剪辑和临时素材处理' },
            { id: 'helper_quarterly', name: '季度会员', priceYuan: 99, description: '比月付更划算，适合稳定创作' },
            { id: 'helper_yearly', name: '年度会员', priceYuan: 299, description: '长期素材处理首选' }
        ];
    },
    installAccountPage() {
        if (!document.querySelector('[data-page="account"]')) {
            const settings = document.querySelector('[data-page="settings"]');
            if (settings) {
                settings.insertAdjacentHTML('beforebegin', `<a class="nav-item" data-page="account"><span class="helper-nav-icon">¥</span><span>账号与会员</span></a>`);
                const accountNav = document.querySelector('[data-page="account"]');
                if (accountNav) accountNav.addEventListener('click', () => this.openAccount());
            }
        }
        if (!document.getElementById('page-account')) {
            const dashboard = document.getElementById('page-dashboard');
            if (dashboard) dashboard.insertAdjacentHTML('beforebegin', '<div class="page-view" id="page-account"><div id="helperAccountRoot"></div></div>');
        }
    },
    openAccount(mode) {
        if (mode) this.authMode = mode;
        this.installAccountPage();
        document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === 'account'));
        document.querySelectorAll('.page-view').forEach(view => view.classList.toggle('active', view.id === 'page-account'));
        if (window.location.hash !== '#account') history.pushState({ page: 'account' }, '账号与会员', '#account');
        const title = document.getElementById('pageTitle'); if (title) title.textContent = '账号与会员';
        this.renderAccount();
    },
    renderAccount() {
        this.installAccountPage();
        const root = document.getElementById('helperAccountRoot'); if (!root) return;
        const user = this.status?.user;
        const license = this.status?.license;
        if (!user) {
            root.innerHTML = `<div class="helper-account-shell"><section class="helper-auth-panel"><div class="helper-brand-mark">净</div><p class="helper-eyebrow">净幕视频号助手</p><h2>${this.authMode === 'register' ? '创建助手账号' : '登录助手账号'}</h2><p class="helper-muted">所有操作都在助手内完成。新账号可免费下载 3 条视频。</p><div class="helper-auth-tabs"><button class="${this.authMode === 'login' ? 'active' : ''}" onclick="HelperLicense.setAuthMode('login')">登录</button><button class="${this.authMode === 'register' ? 'active' : ''}" onclick="HelperLicense.setAuthMode('register')">注册</button></div><form onsubmit="HelperLicense.submitAuth(event)"><label>邮箱</label><input id="helperAuthEmail" type="email" placeholder="请输入邮箱" required><label>密码</label><input id="helperAuthPassword" type="password" minlength="8" placeholder="至少 8 位" required><button id="helperAuthSubmit" class="btn btn-primary helper-auth-submit" type="submit">${this.authMode === 'register' ? '注册并领取 3 条体验' : '登录'}</button></form><p class="helper-security">账号令牌仅保存在这台电脑，不会读取你的微信密码。</p></section><section class="helper-auth-benefits"><span class="helper-pill">独立账号体系</span><h2>登录后即可下载</h2><div class="helper-benefit"><b>01</b><span>注册即送 3 条视频下载体验</span></div><div class="helper-benefit"><b>02</b><span>月度、季度、年度会员任选</span></div><div class="helper-benefit"><b>03</b><span>Windows 与 Mac 共用同一账号</span></div></section></div>`;
            return;
        }
        const plans = license?.plans || this.defaultPlans();
        const expires = license?.expiresAt ? new Date(license.expiresAt).toLocaleDateString('zh-CN') : '—';
        root.innerHTML = `<div class="helper-account-header"><div><p class="helper-eyebrow">账号中心</p><h2>${escapeHtml(user.email)}</h2><p class="helper-muted">${license?.isMember ? `会员有效期至 ${expires}` : `免费体验剩余 ${license?.trialRemaining ?? 0} 条`}</p></div><button class="btn btn-secondary" onclick="HelperLicense.logout()">退出登录</button></div><div class="helper-membership-summary"><div><span>当前状态</span><strong>${license?.isMember ? '会员已开通' : '免费体验'}</strong></div><div><span>剩余体验</span><strong>${license?.trialRemaining ?? 0} 条</strong></div><div><span>到期时间</span><strong>${expires}</strong></div></div><div class="helper-plan-heading"><div><p class="helper-eyebrow">会员充值</p><h2>选择适合你的套餐</h2></div><span>会员期内不限下载条数</span></div><div class="helper-account-plans">${plans.map((plan, i) => `<article class="helper-account-plan ${i === 1 ? 'recommended' : ''}">${i === 1 ? '<i>推荐</i>' : ''}<h3>${escapeHtml(plan.name)}</h3><div class="helper-account-price"><small>¥</small>${plan.priceYuan}</div><p>${escapeHtml(plan.description || '')}</p><ul><li>不限下载条数</li><li>支持批量下载</li><li>同账号跨系统使用</li></ul><button class="btn btn-primary" onclick="HelperLicense.activateMock('${plan.id}')">${license?.isMember ? '续费此套餐' : '立即开通'}</button></article>`).join('')}</div><p class="helper-payment-note">当前为本地测试模式，按钮会模拟支付成功；正式上线时接入微信支付后即可收款。</p>`;
    },
    renderDashboard() {
        let container = document.getElementById('helperLicenseCard');
        const dashboard = document.getElementById('page-dashboard'); if (!dashboard) return;
        if (!container) { container = document.createElement('div'); container.id = 'helperLicenseCard'; container.className = 'helper-license-card'; dashboard.insertBefore(container, dashboard.firstChild); }
        const user = this.status?.user, license = this.status?.license;
        container.innerHTML = `<div class="helper-license-main"><div><div class="helper-license-kicker">视频号下载助手会员</div><h3>${user ? (license?.isMember ? '会员已开通' : `免费体验剩余 ${license?.trialRemaining ?? 0} 条`) : '注册即送 3 条免费下载'}</h3><p>${user ? escapeHtml(user.email) : '注册、登录、充值均可在助手内完成'}</p></div><div class="helper-license-actions"><button class="btn btn-primary" onclick="HelperLicense.openAccount('${user ? '' : 'register'}')">${user ? '账号与会员' : '注册 / 登录'}</button></div></div>`;
    },
    renderAll() { this.renderDashboard(); this.renderAccount(); }
};

async function ensureHelperDownloadAllowed(videoCount) {
    const result = await HelperLicense.consume(videoCount || 1);
    if (!result.allowed) { showMessage(result.error || '请开通会员后继续下载', 'error'); return false; }
    return true;
}

window.HelperLicense = HelperLicense;
window.ensureHelperDownloadAllowed = ensureHelperDownloadAllowed;
document.addEventListener('DOMContentLoaded', () => { HelperLicense.installAccountPage(); HelperLicense.renderAll(); setTimeout(() => HelperLicense.refresh(), 300); });
