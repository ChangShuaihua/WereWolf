# 阿里云 ECS 生产部署说明

适用服务器：

- 公网 IP：`121.196.239.144`
- 地域：华东 1（杭州）
- 规格：2 vCPU / 2 GiB

## 1. 开放安全组

在阿里云 ECS 控制台安全组入方向放行：

- TCP `22`：SSH 远程登录
- TCP `80`：浏览器访问游戏

生产环境不需要公网开放 `3001`、`3306`、`6379`。后端端口在 `docker-compose.yml` 中只绑定到服务器本机 `127.0.0.1`，MySQL 和 Redis 只在 Docker 内网访问。

## 2. 登录服务器

```bash
ssh root@121.196.239.144
```

如果服务器使用密钥：

```bash
ssh -i /path/to/your-key.pem root@121.196.239.144
```

## 3. 安装 Docker

Ubuntu / Debian：

```bash
apt update
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
```

Alibaba Cloud Linux / CentOS：

```bash
yum install -y yum-utils
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
```

验证：

```bash
docker --version
docker compose version
```

## 4. 上传项目

方式一：从本机上传当前目录到服务器。

```bash
scp -r ./Newwerewolf root@121.196.239.144:/opt/Newwerewolf
```

方式二：如果代码已经在 Git 仓库，服务器上拉取仓库。

```bash
mkdir -p /opt
cd /opt
git clone <your-repo-url> Newwerewolf
```

## 5. 创建生产环境变量

```bash
cd /opt/Newwerewolf
cp .env.production.example .env
nano .env
```

至少修改：

```env
MYSQL_ROOT_PASSWORD=换成强密码
JWT_SECRET=换成很长的随机字符串
CORS_ORIGINS=http://121.196.239.144
```

生成随机 `JWT_SECRET`：

```bash
openssl rand -hex 64
```

如果以后绑定域名，例如 `https://game.example.com`，把 `CORS_ORIGINS` 改成：

```env
CORS_ORIGINS=https://game.example.com
```

## 6. 启动服务

```bash
cd /opt/Newwerewolf
docker compose up -d --build
```

查看状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

健康检查：

```bash
curl http://127.0.0.1/api/health
curl http://121.196.239.144/api/health
```

浏览器访问：

```text
http://121.196.239.144
```

## 7. 常用运维命令

更新代码后重新部署：

```bash
cd /opt/Newwerewolf
git pull
docker compose up -d --build
```

重启：

```bash
docker compose restart
```

停止但保留数据：

```bash
docker compose down
```

停止并删除数据库与 Redis 数据：

```bash
docker compose down -v
```

不要在生产环境执行 `docker compose down -v`，除非确认要清空用户、游戏记录和 AI 智能体数据。

## 8. 数据持久化

MySQL 和 Redis 数据保存在 Docker volumes：

- `newwerewolf_mysql_data`
- `newwerewolf_redis_data`

备份 MySQL：

```bash
docker exec werewolf-mysql mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" werewolf > werewolf-backup.sql
```

恢复 MySQL：

```bash
docker exec -i werewolf-mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" werewolf < werewolf-backup.sql
```

## 9. 低配服务器建议

这台 ECS 是 2 GiB 内存，部署时可能会因为构建镜像占用内存较高而变慢。建议：

- 只运行这一套应用，不要同时运行其他数据库或占内存服务。
- 构建失败时先执行 `docker compose down`，再重新 `docker compose up -d --build`。
- 如果经常内存不足，可以给服务器加 1-2 GiB swap。
