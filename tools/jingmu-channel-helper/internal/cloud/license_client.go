package cloud

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"wx_channel/internal/config"
	"wx_channel/internal/utils"
)

// LicenseStatus SaaS 返回的会员状态
type LicenseStatus struct {
	IsMember       bool   `json:"isMember"`
	PlanID         string `json:"planId"`
	ExpiresAt      int64  `json:"expiresAt"`
	TrialLimit     int    `json:"trialLimit"`
	TrialUsed      int    `json:"trialUsed"`
	TrialRemaining int    `json:"trialRemaining"`
	CanDownload    bool   `json:"canDownload"`
}

// ConsumeResult consume 接口返回
type ConsumeResult struct {
	Allowed bool          `json:"allowed"`
	Error   string        `json:"error,omitempty"`
	License LicenseStatus `json:"license"`
}

// LicenseClient 与 SaaS helper-license 接口的客户端
type LicenseClient struct {
	cfg    *config.Config
	client *http.Client
}

// NewLicenseClient 创建客户端
func NewLicenseClient(cfg *config.Config) *LicenseClient {
	return &LicenseClient{
		cfg: cfg,
		client: &http.Client{
			Timeout: 8 * time.Second, // 严格模式需要快速失败
		},
	}
}

// IsEnabled 是否启用 SaaS 会员校验
func (c *LicenseClient) IsEnabled() bool {
	return c.cfg != nil && c.cfg.HelperEnabled && c.cfg.HelperAPIBase != ""
}

// IsLoggedIn 是否已登录（持有有效 token）
func (c *LicenseClient) IsLoggedIn() bool {
	return c.IsEnabled() && c.cfg.HelperToken != ""
}

// DeviceID 上报给 SaaS 的 deviceId
func (c *LicenseClient) DeviceID() string {
	if c.cfg.HelperDeviceID != "" {
		return c.cfg.HelperDeviceID
	}
	return c.cfg.MachineID
}

// Status 查询会员状态（不消耗配额）
func (c *LicenseClient) Status() (*LicenseStatus, error) {
	if !c.IsLoggedIn() {
		return nil, fmt.Errorf("未登录 SaaS 会员账号")
	}
	body := map[string]string{"deviceId": c.DeviceID()}
	var status LicenseStatus
	if err := c.post("/api/helper-license/status", body, &status); err != nil {
		return nil, err
	}
	return &status, nil
}

// Consume 消费下载配额。严格模式：任何错误（网络、401、402）都阻断下载。
// videoCount 为本次下载消耗的视频条数，单视频下载传 1。
func (c *LicenseClient) Consume(videoCount int) (*ConsumeResult, error) {
	if !c.IsLoggedIn() {
		return nil, fmt.Errorf("未登录 SaaS 会员账号，无法校验下载权限")
	}
	if videoCount < 1 {
		videoCount = 1
	}
	body := map[string]interface{}{
		"deviceId":   c.DeviceID(),
		"videoCount": videoCount,
	}
	var result ConsumeResult
	if err := c.post("/api/helper-license/consume", body, &result); err != nil {
		// 严格模式：SaaS 不可达时直接阻断
		utils.Warn("SaaS license 校验失败：%v", err)
		return nil, fmt.Errorf("会员校验服务不可达：%v", err)
	}
	if !result.Allowed {
		return &result, fmt.Errorf("%s", result.Error)
	}
	return &result, nil
}

// post 发送 POST 请求并解析 JSON
func (c *LicenseClient) post(path string, body interface{}, out interface{}) error {
	url := c.cfg.HelperAPIBase + path
	payload, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("序列化请求失败：%w", err)
	}
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("构造请求失败：%w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.cfg.HelperToken)
	// 助手端标识，便于 SaaS 端识别来源
	req.Header.Set("X-Helper-Client", "jingmu-channel-helper")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("请求 SaaS 失败：%w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("读取响应失败：%w", err)
	}

	switch resp.StatusCode {
	case http.StatusOK:
		if err := json.Unmarshal(raw, out); err != nil {
			return fmt.Errorf("解析响应失败：%w", err)
		}
		return nil
	case http.StatusUnauthorized:
		return fmt.Errorf("登录已失效，请重新登录会员账号")
	case http.StatusPaymentRequired:
		// 402 时 SaaS 仍返回 JSON，解析后让上层展示具体配额信息
		if err := json.Unmarshal(raw, out); err == nil && out != nil {
			return fmt.Errorf("配额不足")
		}
		return fmt.Errorf("配额不足")
	case http.StatusForbidden:
		return fmt.Errorf("操作被拒绝（HTTP 403）")
	default:
		return fmt.Errorf("SaaS 异常状态码：%d", resp.StatusCode)
	}
}
