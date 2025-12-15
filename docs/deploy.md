# 智能体评测平台部署文档

## 1. 概述

智能体评测平台是一个用于评测智能体（AI Agent）能力的综合性平台，支持百度千帆、Dify 等主流智能体平台的接入与评测。本文档详细介绍平台的部署方式、配置说明和运维指南。

## 2. 系统要求

### 2.1 硬件要求

| 配置项 | 最低要求 | 推荐配置 |
|--------|----------|----------|
| CPU | 2 核 | 4 核及以上 |
| 内存 | 4 GB | 8 GB 及以上 |
| 磁盘 | 20 GB | 50 GB 及以上（SSD） |
| 网络 | 100 Mbps | 1 Gbps |

### 2.2 软件要求

| 软件 | 版本要求 |
|------|----------|
| Docker | 20.10+ |
| Docker Compose | 2.0+ |
| Node.js | 22.x（开发环境） |
| MySQL | 8.0+（或使用 Docker 容器） |

## 3. 快速部署

### 3.1 Docker Compose 一键部署

```bash
# 1. 克隆项目
git clone https://github.com/your-org/agent-eval-platform.git
cd agent-eval-platform

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填写必要的配置

# 3. 启动服务
docker-compose up -d

# 4. 查看服务状态
docker-compose ps

# 5. 查看日志
docker-compose logs -f
```

### 3.2 Docker Compose 配置文件

```yaml
# docker-compose.yml
version: '3.8'

services:
  # 主应用服务
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - mysql
      - redis
    restart: unless-stopped
    networks:
      - agent-eval-network

  # MySQL 数据库
  mysql:
    image: mysql:8.0
    ports:
      - "3306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=agent_eval
      - MYSQL_USER=${MYSQL_USER}
      - MYSQL_PASSWORD=${MYSQL_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped
    networks:
      - agent-eval-network

  # Redis 缓存/队列
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - agent-eval-network

volumes:
  mysql_data:
  redis_data:

networks:
  agent-eval-network:
    driver: bridge
```

### 3.3 Dockerfile

```dockerfile
# Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# 构建应用
COPY . .
RUN pnpm build

# 生产镜像
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

## 4. 环境变量配置

### 4.1 必需环境变量

| 变量名 | 描述 | 示例值 |
|--------|------|--------|
| `DATABASE_URL` | MySQL 数据库连接字符串 | `mysql://user:pass@localhost:3306/agent_eval` |
| `JWT_SECRET` | JWT 签名密钥 | 随机 32 位字符串 |
| `REDIS_URL` | Redis 连接字符串 | `redis://localhost:6379` |

### 4.2 可选环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `LOG_LEVEL` | 日志级别 | `info` |
| `MAX_CONCURRENT_TASKS` | 最大并发评测任务数 | `10` |
| `TASK_TIMEOUT` | 任务超时时间（秒） | `3600` |

### 4.3 智能体平台配置

**百度千帆配置：**

| 变量名 | 描述 |
|--------|------|
| `QIANFAN_API_KEY` | 千帆 API Key |
| `QIANFAN_SECRET_KEY` | 千帆 Secret Key |
| `QIANFAN_BASE_URL` | 千帆 API 基础 URL |

**Dify 配置：**

| 变量名 | 描述 |
|--------|------|
| `DIFY_API_KEY` | Dify API Key |
| `DIFY_BASE_URL` | Dify API 基础 URL |

### 4.4 环境变量示例文件

```bash
# .env.example

# 数据库配置
DATABASE_URL=mysql://root:password@localhost:3306/agent_eval
MYSQL_ROOT_PASSWORD=your_root_password
MYSQL_USER=agent_eval_user
MYSQL_PASSWORD=your_password

# 应用配置
JWT_SECRET=your_jwt_secret_key_at_least_32_chars
PORT=3000
NODE_ENV=production

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
```

## 5. 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 3000 | 主应用 | Web 界面和 API |
| 3306 | MySQL | 数据库服务 |
| 6379 | Redis | 缓存和任务队列 |

## 6. 数据备份与恢复

### 6.1 数据库备份

```bash
# 备份数据库
docker exec agent-eval-platform-mysql-1 mysqldump -u root -p agent_eval > backup_$(date +%Y%m%d_%H%M%S).sql

# 定时备份（添加到 crontab）
0 2 * * * docker exec agent-eval-platform-mysql-1 mysqldump -u root -p${MYSQL_ROOT_PASSWORD} agent_eval > /backup/agent_eval_$(date +\%Y\%m\%d).sql
```

### 6.2 数据库恢复

```bash
# 恢复数据库
docker exec -i agent-eval-platform-mysql-1 mysql -u root -p agent_eval < backup.sql
```

### 6.3 完整数据备份

```bash
# 备份所有数据（数据库 + Redis + 上传文件）
#!/bin/bash
BACKUP_DIR=/backup/$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# 备份 MySQL
docker exec agent-eval-platform-mysql-1 mysqldump -u root -p${MYSQL_ROOT_PASSWORD} agent_eval > $BACKUP_DIR/mysql.sql

# 备份 Redis
docker exec agent-eval-platform-redis-1 redis-cli BGSAVE
docker cp agent-eval-platform-redis-1:/data/dump.rdb $BACKUP_DIR/redis.rdb

# 备份上传文件
docker cp agent-eval-platform-app-1:/app/uploads $BACKUP_DIR/uploads

# 压缩
tar -czvf $BACKUP_DIR.tar.gz $BACKUP_DIR
rm -rf $BACKUP_DIR

echo "Backup completed: $BACKUP_DIR.tar.gz"
```

### 6.4 完整数据恢复

```bash
# 恢复所有数据
#!/bin/bash
BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./restore.sh <backup_file.tar.gz>"
    exit 1
fi

# 解压
tar -xzvf $BACKUP_FILE
BACKUP_DIR=${BACKUP_FILE%.tar.gz}

# 停止服务
docker-compose stop app

# 恢复 MySQL
docker exec -i agent-eval-platform-mysql-1 mysql -u root -p${MYSQL_ROOT_PASSWORD} agent_eval < $BACKUP_DIR/mysql.sql

# 恢复 Redis
docker cp $BACKUP_DIR/redis.rdb agent-eval-platform-redis-1:/data/dump.rdb
docker-compose restart redis

# 恢复上传文件
docker cp $BACKUP_DIR/uploads agent-eval-platform-app-1:/app/

# 启动服务
docker-compose start app

# 清理
rm -rf $BACKUP_DIR

echo "Restore completed"
```

## 7. 离线/内网部署

### 7.1 导出镜像

```bash
# 在有网络的环境中构建并导出镜像
docker-compose build
docker save agent-eval-platform-app:latest -o agent-eval-app.tar
docker save mysql:8.0 -o mysql.tar
docker save redis:7-alpine -o redis.tar
```

### 7.2 导入镜像

```bash
# 在离线环境中导入镜像
docker load -i agent-eval-app.tar
docker load -i mysql.tar
docker load -i redis.tar
```

### 7.3 离线部署

```bash
# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 启动服务
docker-compose up -d
```

## 8. 运维指南

### 8.1 日志查看

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f app
docker-compose logs -f mysql
docker-compose logs -f redis
```

### 8.2 服务管理

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 重启特定服务
docker-compose restart app
```

### 8.3 健康检查

```bash
# 检查服务状态
docker-compose ps

# 检查应用健康状态
curl http://localhost:3000/api/health

# 检查数据库连接
docker exec agent-eval-platform-mysql-1 mysqladmin -u root -p ping
```

### 8.4 性能监控

```bash
# 查看容器资源使用
docker stats

# 查看特定容器资源
docker stats agent-eval-platform-app-1
```

## 9. 升级指南

### 9.1 升级步骤

```bash
# 1. 备份数据
./backup.sh

# 2. 拉取最新代码
git pull origin main

# 3. 重新构建镜像
docker-compose build

# 4. 停止旧服务
docker-compose down

# 5. 启动新服务
docker-compose up -d

# 6. 运行数据库迁移（如有）
docker exec agent-eval-platform-app-1 pnpm db:push

# 7. 验证服务
curl http://localhost:3000/api/health
```

### 9.2 回滚步骤

```bash
# 1. 停止服务
docker-compose down

# 2. 恢复代码
git checkout <previous_version>

# 3. 重新构建
docker-compose build

# 4. 恢复数据
./restore.sh <backup_file.tar.gz>

# 5. 启动服务
docker-compose up -d
```

## 10. 故障排查

### 10.1 常见问题

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 无法连接数据库 | 数据库未启动或配置错误 | 检查 MySQL 容器状态和连接字符串 |
| 服务启动失败 | 端口被占用 | 检查端口占用，修改配置 |
| 评测任务超时 | 网络问题或智能体响应慢 | 增加超时时间，检查网络 |
| 内存不足 | 并发任务过多 | 减少并发数，增加内存 |

### 10.2 日志分析

```bash
# 查找错误日志
docker-compose logs app | grep -i error

# 查找特定时间段的日志
docker-compose logs --since="2025-01-01T00:00:00" --until="2025-01-02T00:00:00" app
```

## 11. 安全建议

1. **修改默认密码**：部署后立即修改所有默认密码
2. **限制网络访问**：使用防火墙限制对数据库和 Redis 端口的访问
3. **启用 HTTPS**：在生产环境中使用 HTTPS
4. **定期备份**：设置自动备份计划
5. **更新依赖**：定期更新依赖包以修复安全漏洞

## 12. 联系支持

如遇到部署问题，请通过以下方式获取支持：

- **文档**：查阅本文档和 API 文档
- **Issue**：在 GitHub 仓库提交 Issue
- **邮件**：support@example.com

---

*文档版本：1.0 | 更新日期：2025-12-15*
