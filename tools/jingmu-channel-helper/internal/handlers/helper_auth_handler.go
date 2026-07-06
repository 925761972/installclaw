package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"wx_channel/internal/cloud"
	"wx_channel/internal/config"
)

// HelperLoginRequest 登录请求
type HelperLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// HelperRegisterRequest 注册请求
type HelperRegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// helperAPIResponse SaaS 返回的原始结构
type helperAPIResponse struct {
	Token string `json:"token"`
	User  struct {
		ID    string `json:"id"`
		Email string `json:"email"`
	} `json:"user"`
}

// HandleHelperLogin POST /api/helper/login
// 转发到 SaaS /api/helper-auth/login，并把返回的 token 持久化到本地配置文件
func (h *ConsoleAPIHandler) HandleHelperLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.sendError(w, r, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	cfg := h.getConfig()
	if cfg == nil {
		h.sendError(w, r, http.StatusInternalServerError, "config not loaded")
		return
	}
	if cfg.HelperAPIBase == "" {
		h.sendError(w, r, http.StatusBadRequest, "未配置 helper_api_base，无法登录")
		return
	}

	var req HelperLoginRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, maxJSONBodyBytes)).Decode(&req); err != nil {
		h.sendError(w, r, http.StatusBadRequest, "请求体格式错误")
		return
	}
	if req.Email == "" || req.Password == "" {
		h.sendError(w, r, http.StatusBadRequest, "邮箱或密码不能为空")
		return
	}

	deviceID := cfg.MachineID
	if cfg.HelperDeviceID != "" {
		deviceID = cfg.HelperDeviceID
	}

	// 转发到 SaaS
	payload := map[string]string{
		"email":    req.Email,
		"password": req.Password,
		"deviceId": deviceID,
	}
	var resp helperAPIResponse
	if err := postToSaaS(cfg.HelperAPIBase+"/api/helper-auth/login", payload, &resp); err != nil {
		h.sendError(w, r, http.StatusUnauthorized, fmt.Sprintf("登录失败：%v", err))
		return
	}

	// 持久化到配置文件
	if err := persistHelperCredentials(cfg, resp.Token, resp.User.ID, resp.User.Email); err != nil {
		// 持久化失败不阻断登录，仅提示
		_ = err
	}

	h.sendSuccess(w, r, map[string]interface{}{
		"email":   resp.User.Email,
		"userId":  resp.User.ID,
		"message": "登录成功",
	})
}

// HandleHelperRegister POST /api/helper/register
func (h *ConsoleAPIHandler) HandleHelperRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.sendError(w, r, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	cfg := h.getConfig()
	if cfg == nil || cfg.HelperAPIBase == "" {
		h.sendError(w, r, http.StatusBadRequest, "未配置 helper_api_base")
		return
	}

	var req HelperRegisterRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, maxJSONBodyBytes)).Decode(&req); err != nil {
		h.sendError(w, r, http.StatusBadRequest, "请求体格式错误")
		return
	}
	if req.Email == "" || len(req.Password) < 8 {
		h.sendError(w, r, http.StatusBadRequest, "邮箱不能为空且密码至少 8 位")
		return
	}

	deviceID := cfg.MachineID
	if cfg.HelperDeviceID != "" {
		deviceID = cfg.HelperDeviceID
	}
	payload := map[string]string{
		"email":    req.Email,
		"password": req.Password,
		"deviceId": deviceID,
	}
	var resp helperAPIResponse
	if err := postToSaaS(cfg.HelperAPIBase+"/api/helper-auth/register", payload, &resp); err != nil {
		h.sendError(w, r, http.StatusBadRequest, fmt.Sprintf("注册失败：%v", err))
		return
	}
	if err := persistHelperCredentials(cfg, resp.Token, resp.User.ID, resp.User.Email); err != nil {
		_ = err
	}
	h.sendSuccess(w, r, map[string]interface{}{
		"email":   resp.User.Email,
		"userId":  resp.User.ID,
		"message": "注册并登录成功",
	})
}

// HandleHelperLogout POST /api/helper/logout
func (h *ConsoleAPIHandler) HandleHelperLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.sendError(w, r, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	cfg := h.getConfig()
	if cfg == nil {
		h.sendSuccess(w, r, map[string]interface{}{"message": "已清空本地凭据"})
		return
	}
	// 尽力通知 SaaS 注销 token，失败不阻断本地清理
	if cfg.HelperToken != "" && cfg.HelperAPIBase != "" {
		_, _ = postToSaaSWithToken(cfg.HelperAPIBase+"/api/helper-auth/logout", nil, cfg.HelperToken, nil)
	}
	// 清空本地持久化
	_ = persistHelperCredentials(cfg, "", "", "")
	h.sendSuccess(w, r, map[string]interface{}{"message": "已退出登录"})
}

// HandleHelperStatus GET /api/helper/status
// 返回本地 license 客户端状态（不查 SaaS），前端用此判断是否已登录
func (h *ConsoleAPIHandler) HandleHelperStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.sendError(w, r, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	cfg := h.getConfig()
	if cfg == nil {
		h.sendError(w, r, http.StatusInternalServerError, "config not loaded")
		return
	}
	client := cloud.NewLicenseClient(cfg)
	h.sendSuccess(w, r, map[string]interface{}{
		"enabled":   client.IsEnabled(),
		"loggedIn":  client.IsLoggedIn(),
		"apiBase":   cfg.HelperAPIBase,
		"email":     cfg.HelperEmail,
		"userId":    cfg.HelperUserID,
		"deviceId":  client.DeviceID(),
		"machineId": cfg.MachineID,
	})
}

// HandleHelperLicense GET /api/helper/license
// 实时查询 SaaS 会员状态（不消耗配额）
func (h *ConsoleAPIHandler) HandleHelperLicense(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.sendError(w, r, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	cfg := h.getConfig()
	if cfg == nil {
		h.sendError(w, r, http.StatusInternalServerError, "config not loaded")
		return
	}
	client := cloud.NewLicenseClient(cfg)
	if !client.IsLoggedIn() {
		h.sendError(w, r, http.StatusUnauthorized, "未登录会员账号")
		return
	}
	status, err := client.Status()
	if err != nil {
		h.sendError(w, r, http.StatusBadGateway, fmt.Sprintf("查询会员状态失败：%v", err))
		return
	}
	h.sendSuccess(w, r, status)
}

// HandleHelperAPI 路由 /api/helper/* 子路径
func (h *ConsoleAPIHandler) HandleHelperAPI(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/helper")
	switch path {
	case "/login", "":
		h.HandleHelperLogin(w, r)
	case "/register":
		h.HandleHelperRegister(w, r)
	case "/logout":
		h.HandleHelperLogout(w, r)
	case "/status":
		h.HandleHelperStatus(w, r)
	case "/license":
		h.HandleHelperLicense(w, r)
	default:
		h.sendError(w, r, http.StatusNotFound, "helper endpoint not found")
	}
}

// postToSaaS 发送 POST 给 SaaS，不带 token
func postToSaaS(url string, payload interface{}, out interface{}) error {
	return postToSaaSWithToken(url, payload, "", out)
}

// postToSaaSWithToken 发送 POST 给 SaaS，可选 Bearer Token
func postToSaaSWithToken(url string, payload interface{}, token string, out interface{}) error {
	var bodyReader io.Reader
	if payload != nil {
		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("序列化请求失败：%w", err)
		}
		bodyReader = strings.NewReader(string(bodyBytes))
	}
	req, err := http.NewRequest(http.MethodPost, url, bodyReader)
	if err != nil {
		return fmt.Errorf("构造请求失败：%w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Helper-Client", "jingmu-channel-helper")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	httpClient := &http.Client{Timeout: 10 * time.Second}
	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("请求 SaaS 失败：%w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		var errBody struct {
			Error string `json:"error"`
		}
		_ = json.Unmarshal(raw, &errBody)
		if errBody.Error != "" {
			return fmt.Errorf("%s", errBody.Error)
		}
		return fmt.Errorf("SaaS 状态码 %d", resp.StatusCode)
	}
	if out != nil {
		if err := json.Unmarshal(raw, out); err != nil {
			return fmt.Errorf("解析响应失败：%w", err)
		}
	}
	return nil
}

// persistHelperCredentials 把 token / user_id / email 持久化到 config.yaml
// 同时更新内存中的 globalConfig，避免重启才能生效
func persistHelperCredentials(cfg *config.Config, token, userID, email string) error {
	cfg.HelperToken = token
	cfg.HelperUserID = userID
	cfg.HelperEmail = email

	configFile := "config.yaml"
	if viper := configFileUsed(); viper != "" {
		configFile = viper
	}

	content, err := os.ReadFile(configFile)
	if err != nil {
		// 配置文件不存在，创建精简版
		newContent := fmt.Sprintf("# 视频号助手配置\n\nhelper_enabled: true\nhelper_api_base: %q\nhelper_token: %q\nhelper_user_id: %q\nhelper_email: %q\n",
			cfg.HelperAPIBase, token, userID, email)
		return os.WriteFile(configFile, []byte(newContent), 0644)
	}

	lines := strings.Split(string(content), "\n")
	setKey := func(key, value string) {
		found := false
		for i, line := range lines {
			trimmed := strings.TrimSpace(line)
			if strings.HasPrefix(trimmed, key+":") {
				lines[i] = fmt.Sprintf("%s: %q", key, value)
				found = true
				break
			}
		}
		if !found {
			lines = append(lines, fmt.Sprintf("%s: %q", key, value))
		}
	}
	setKey("helper_token", token)
	setKey("helper_user_id", userID)
	setKey("helper_email", email)

	// 确保 helper_enabled 和 helper_api_base 也在
	ensureKeyPresent(lines, "helper_enabled", "true")
	ensureKeyPresent(lines, "helper_api_base", cfg.HelperAPIBase)

	return os.WriteFile(configFile, []byte(strings.Join(lines, "\n")), 0644)
}

// ensureKeyPresent 确保配置文件中存在某键，不存在则追加
func ensureKeyPresent(lines []string, key, value string) {
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, key+":") {
			return
		}
	}
	lines = append(lines, fmt.Sprintf("%s: %q", key, value))
}

// configFileUsed 返回当前使用的配置文件路径（避免引入 viper 依赖）
func configFileUsed() string {
	// 简单从当前目录找 config.yaml
	if _, err := os.Stat("config.yaml"); err == nil {
		return "config.yaml"
	}
	return ""
}
