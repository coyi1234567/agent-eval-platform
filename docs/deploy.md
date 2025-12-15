# .env.example

# 数据库配置
DATABASE_URL=mysql://root:password@localhost:3306/agent_eval
MYSQL_ROOT_PASSWORD=your_root_password
MYSQL_USER=agent_eval_user
MYSQL_PASSWORD=your_password

# 应用配置
JWT_SECRET=your_jwt_secret_key_at_least_32_chars
# 必须配置，且长度 >= 32 字符
ENCRYPTION_KEY=replace_with_a_secure_random_string_at_least_32_chars
PORT=3000
NODE_ENV=production

# 认证模式: local 或 oauth
AUTH_MODE=local
LOCAL_ADMIN_PASSWORD=admin123

# LLM 评测模型配置 (必需)
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-proj-xxxxxx
LLM_MODEL=gpt-4o

# Redis 配置
REDIS_URL=redis://localhost:6379

# 日志配置
LOG_LEVEL=info

# 评测配置
MAX_CONCURRENT_TASKS=10
TASK_TIMEOUT=3600

# 百度千帆配置（可选）
QIANFAN_API_KEY=
QIANFAN_SECRET_KEY=
QIANFAN_BASE_URL=https://qianfan.baidubce.com

# Dify 配置（可选）
DIFY_API_KEY=
DIFY_BASE_URL=https://api.dify.ai/v1
