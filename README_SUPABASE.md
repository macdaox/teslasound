# Supabase 集成说明

## 1. 创建 Supabase 项目

1. 访问 https://supabase.com 并注册/登录
2. 创建新项目
3. 记录项目 URL 和 API Key

## 2. 运行数据库迁移

在 Supabase Dashboard 中：
1. 进入 **SQL Editor**
2. 复制 `supabase/schema.sql` 的内容
3. 粘贴并执行，创建所有表

或者使用 Supabase CLI：
```bash
supabase db push
```

## 3. 配置环境变量

在 `.env` 文件中添加：

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# 可选：使用 Service Role Key 以获得完整权限（仅服务器端使用）
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## 4. 数据库表结构

### subscriptions
- 存储用户订阅记录
- 包含 Stripe 会话 ID、支付状态、邮件发送状态等

### email_logs
- 记录所有邮件发送历史
- 包含发送状态、错误信息等

### download_logs
- 记录所有下载活动
- 包含 IP 地址、User-Agent 等

## 5. 功能说明

- ✅ 自动保存订阅记录（创建支付会话时）
- ✅ 自动更新支付状态（支付成功后）
- ✅ 记录邮件发送日志（成功/失败）
- ✅ 记录下载活动日志
- ✅ 支持查询订阅历史

## 6. 查询示例

在 Supabase Dashboard 的 SQL Editor 中：

```sql
-- 查看所有完成的订阅
SELECT * FROM subscriptions WHERE status = 'completed' ORDER BY created_at DESC;

-- 查看邮件发送失败记录
SELECT * FROM email_logs WHERE status = 'failed';

-- 查看下载统计
SELECT email, COUNT(*) as download_count 
FROM download_logs 
GROUP BY email 
ORDER BY download_count DESC;
```

## 7. 注意事项

- 如果未配置 Supabase，应用会继续运行，但不会保存数据
- 所有数据库操作都是非阻塞的，不会影响用户体验
- 建议在生产环境使用 `SUPABASE_SERVICE_ROLE_KEY` 以获得完整权限

