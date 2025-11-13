# Supabase Storage 配置指南

## 问题说明

ZIP 文件（77MB）太大，无法上传到 GitHub，也无法部署到 Vercel。解决方案是使用 **Supabase Storage** 来存储文件。

## 快速开始

### 1. 创建 Storage Bucket（手动）

在 Supabase Dashboard 中：

1. 进入 **Storage**
2. 点击 **New bucket**
3. 名称：`sound-packs`
4. 设置为 **Private**（不公开）
5. 点击 **Create bucket**

### 2. 获取 Service Role Key（用于上传）

1. 进入 **Settings** → **API**
2. 复制 **service_role** key（⚠️ 保密，不要提交到 Git）
3. 添加到 `.env`：
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

### 3. 上传文件到 Supabase Storage

运行上传脚本：

```bash
node scripts/upload-to-supabase.js [本地文件路径]
```

如果不指定路径，默认使用 `public/assets/tesla_sounds.zip`

**示例：**
```bash
node scripts/upload-to-supabase.js public/assets/tesla_sounds.zip
```

**注意：** 如果使用 ANON_KEY 上传失败，请使用 SERVICE_ROLE_KEY。

### 4. 配置环境变量

在 `.env` 文件中添加（可选，有默认值）：

```bash
# Supabase Storage 配置
SUPABASE_STORAGE_BUCKET=sound-packs
SUPABASE_STORAGE_FILE_PATH=tesla_sounds.zip

# 可选：Service Role Key（用于上传脚本，不要提交到 Git）
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 5. 设置 Supabase Storage 权限（可选）

bucket 创建后，默认权限已足够。如果需要更细粒度控制：

1. 进入 **Storage** → `sound-packs` bucket
2. 点击 **Policies**
3. 可以设置 RLS（Row Level Security）策略

**注意：** 代码使用 signed URL，不需要公开 bucket。

### 6. 重启服务器

```bash
npm run start
```

## 工作原理

### 自动回退机制

代码会按以下顺序尝试获取文件：

1. **Supabase Storage** - 如果配置了 Supabase
2. **本地文件** - 如果 Storage 不可用（开发环境）

### 邮件发送

- 如果文件 < 20MB：作为附件发送
- 如果文件 > 20MB：生成下载链接（24小时有效）

### 下载链接

- **优先使用**：Supabase Storage 的 signed URL（更安全、更快）
- **回退方案**：Token-based 下载链接（通过服务器代理）

## 手动上传（可选）

如果脚本无法运行，可以手动上传：

1. 登录 Supabase Dashboard
2. 进入 **Storage**
3. 创建 bucket：`sound-packs`（设置为 private）
4. 上传文件：`tesla_sounds.zip`

## 验证

上传成功后，测试下载：

```bash
# 测试支付流程
# 1. 访问 http://localhost:3000
# 2. 完成支付
# 3. 检查邮件中的下载链接是否可用
```

## 故障排除

### 问题：上传失败

**解决方案：**
- 检查 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 是否正确
- 尝试使用 `SUPABASE_SERVICE_ROLE_KEY`（有完整权限）

### 问题：下载失败

**解决方案：**
- 检查 bucket 名称和文件路径是否正确
- 确认 Storage 权限设置正确
- 查看服务器日志中的错误信息

### 问题：文件太大

**解决方案：**
- Supabase 免费版限制：1GB 存储空间
- 如果超过限制，考虑：
  1. 压缩 ZIP 文件
  2. 升级 Supabase 计划
  3. 使用其他云存储（AWS S3、Cloudflare R2）

## 成本

- **Supabase 免费版**：1GB 存储空间，2GB 带宽/月
- **77MB 文件**：可以存储约 13 个文件
- **每月下载**：约 26 次（2GB ÷ 77MB）

如果超出免费额度，可以考虑：
- 压缩文件
- 使用 CDN（Cloudflare）
- 升级 Supabase 计划

