# Cloudflare R2 存储配置指南

## 为什么选择 R2？

- ✅ **无单文件大小限制** - 支持任意大小的文件（77MB+ 完全没问题）
- ✅ **免费额度大** - 10GB 存储 + 每月 100 万次读取
- ✅ **全球 CDN 加速** - 自动加速下载
- ✅ **兼容 S3 API** - 易于集成
- ✅ **成本低** - 超出免费额度后也很便宜

## 快速开始

### 1. 创建 Cloudflare R2 Bucket

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **R2** → **Create bucket**
3. 名称：`tesla-sounds`（或自定义）
4. 点击 **Create bucket**

### 2. 获取 Account ID

1. 在 Cloudflare Dashboard 右侧边栏，找到 **Account ID**
2. 或者进入 **R2** 概览页面，Account ID 会显示在页面顶部
3. 复制 Account ID（格式类似：`a1b2c3d4e5f6g7h8i9j0`）

### 3. 创建 API Token

1. 在 R2 页面，点击 **Manage R2 API Tokens**
2. 点击 **Create API Token**
3. 设置权限：
   - **Object Read & Write**（读写权限）
   - 选择你创建的 bucket
4. 点击 **Create API Token**
5. **重要**：复制以下信息（只显示一次）：
   - **访问密钥 ID** (Access Key ID) - 对应 `R2_ACCESS_KEY_ID`
   - **机密访问密钥** (Secret Access Key) - 对应 `R2_SECRET_ACCESS_KEY`
   - **令牌值** (Token Value) - 这个不需要，忽略即可

### 4. 配置环境变量

在 `.env` 文件中添加：

```bash
# Cloudflare R2 配置
# Account ID - 在 Dashboard 右侧边栏或 R2 概览页面
R2_ACCOUNT_ID=你的account-id

# 访问密钥 ID - 从 API Token 页面复制"访问密钥 ID"
R2_ACCESS_KEY_ID=4926df8926b63e1d8cda09e75946c

# 机密访问密钥 - 从 API Token 页面复制"机密访问密钥"
R2_SECRET_ACCESS_KEY=0f9f15b5cb3c3a2422e7bbdf091db

# Bucket 名称
R2_BUCKET_NAME=tesla-sounds

# 文件路径
R2_FILE_PATH=tesla_sounds.zip

# 可选：如果 bucket 是公开的，设置公共 URL
# R2_PUBLIC_URL=https://your-bucket.r2.dev
```

**注意：**
- `R2_ACCOUNT_ID` 在 Dashboard 右侧边栏或 R2 概览页面
- `R2_ACCESS_KEY_ID` 对应界面中的"访问密钥 ID"
- `R2_SECRET_ACCESS_KEY` 对应界面中的"机密访问密钥"
- "令牌值"不需要，可以忽略

### 5. 上传文件

运行上传脚本：

```bash
node scripts/upload-to-r2.js [本地文件路径]
```

如果不指定路径，默认使用 `public/assets/tesla_sounds.zip`

**示例：**
```bash
node scripts/upload-to-r2.js public/assets/tesla_sounds.zip
```

### 6. 重启服务器

```bash
npm run start
```

## 工作原理

### 自动回退机制

代码会按以下顺序尝试获取文件：

1. **Cloudflare R2** - 如果配置了 R2
2. **本地文件** - 如果 R2 不可用（开发环境）

### 邮件发送

- 如果文件 < 20MB：作为附件发送
- 如果文件 > 20MB：生成下载链接（24小时有效）

### 下载链接

- **优先使用**：R2 的 signed URL（安全、快速、CDN 加速）
- **回退方案**：Token-based 下载链接（通过服务器代理）

## 成本

### 免费额度（每月）

- **存储**：10GB
- **Class A 操作**（写入）：100 万次
- **Class B 操作**（读取）：100 万次
- **出站流量**：10GB

### 77MB 文件成本估算

- **存储**：77MB ÷ 10GB = 0.77%（几乎免费）
- **每月下载 1000 次**：
  - 读取操作：1000 次（Class B，免费）
  - 流量：77MB × 1000 = 77GB（超出免费额度）
  - 超出部分：67GB × $0.09/GB = **$6.03/月**

**建议**：如果流量大，考虑：
1. 使用 Cloudflare CDN（免费）
2. 压缩文件
3. 使用 R2 的公共 URL（如果不需要签名）

## 故障排除

### 问题：上传失败 - Bucket 不存在

**解决方案：**
1. 在 Cloudflare Dashboard 创建 bucket
2. 确保 bucket 名称与 `R2_BUCKET_NAME` 一致

### 问题：上传失败 - 认证错误

**解决方案：**
1. 检查 `R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY` 是否正确
2. 确认 API Token 有读写权限
3. 重新创建 API Token

### 问题：下载失败

**解决方案：**
1. 检查文件是否成功上传
2. 确认 `R2_FILE_PATH` 正确
3. 查看服务器日志中的错误信息

## 与 Supabase Storage 对比

| 特性 | Supabase Storage | Cloudflare R2 |
|------|-----------------|---------------|
| 单文件限制 | 50MB | 无限制 |
| 免费存储 | 1GB | 10GB |
| CDN 加速 | ❌ | ✅ |
| 成本 | 中等 | 低 |
| 集成难度 | 简单 | 简单 |

**结论**：对于 77MB 文件，R2 是更好的选择。

