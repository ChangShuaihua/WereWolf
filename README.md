# 🐺 狼人杀 (Werewolf)

一款基于 WebSocket 的多人实时狼人杀游戏，支持 AI 智能体，可在 AI 工坊中创建自定义 AI 角色。

## 🛠️ 技术栈

### 后端
- **Node.js** + **Express** - Web 服务
- **Socket.IO** - 实时通信
- **MySQL** - 数据存储
- **node-cache** - 内存缓存
- **bcryptjs** - 密码加密
- **JWT** - 用户认证
- **LangChain** + **OpenAI API** - AI 智能体集成

### 前端
- **Vue 3** + **Vite** - 前端框架与构建
- **Pinia** - 状态管理
- **Vue Router** - 路由
- **Socket.IO Client** - 实时通信
- **Axios** - HTTP 请求

## 📁 项目结构

```
Newwerewolf/
├── backend/
│   ├── src/
│   │   ├── app.js                    # 应用入口
│   │   ├── config/
│   │   │   └── db.js                 # 数据库配置与初始化
│   │   ├── ai/
│   │   │   └── AIAgentManager.js     # AI 智能体管理
│   │   ├── game/
│   │   │   ├── GameEngine.js         # 游戏引擎核心
│   │   │   ├── AIGameHandler.js      # AI 游戏处理
│   │   │   ├── RoleConfig.js         # 角色配置
│   │   │   └── constants.js          # 常量定义
│   │   ├── middleware/
│   │   │   └── auth.js               # 认证中间件
│   │   ├── models/
│   │   │   ├── User.js               # 用户模型
│   │   │   └── GameRecord.js         # 游戏记录模型
│   │   ├── routes/
│   │   │   ├── auth.js               # 认证路由
│   │   │   └── aiAgentRoutes.js      # AI 智能体路由
│   │   ├── socket/
│   │   │   ├── index.js              # Socket.IO 入口
│   │   │   ├── roomHandler.js        # 房间管理
│   │   │   └── gameHandler.js        # 游戏事件处理
│   │   └── utils/
│   │       ├── AppError.js           # 自定义错误类
│   │       ├── cache.js              # 缓存工具
│   │       └── userSocketMap.js      # 用户-Socket映射
│   ├── data/
│   │   └── aiAgents.json             # AI 智能体数据
│   ├── .env                          # 环境变量
│   ├── .env.example                  # 环境变量示例
│   ├── Dockerfile                    # 后端 Docker 镜像
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   │   └── style.css             # 全局样式
│   │   ├── components/
│   │   │   ├── ChatBox.vue           # 聊天组件
│   │   │   ├── ConfirmDialog.vue    # 全局确认对话框
│   │   │   ├── Countdown.vue         # 倒计时组件
│   │   │   ├── DayPanel.vue          # 白天发言面板
│   │   │   ├── NightPanel.vue        # 夜晚行动面板
│   │   │   ├── VotePanel.vue         # 投票面板
│   │   │   ├── HunterPanel.vue       # 猎人开枪面板
│   │   │   ├── PlayerList.vue        # 玩家列表
│   │   │   ├── RoleReveal.vue        # 身份揭示
│   │   │   └── GameResult.vue        # 游戏结果
│   │   ├── composables/
│   │   │   └── useConfirm.js         # 确认对话框逻辑
│   │   ├── views/
│   │   │   ├── LoginView.vue         # 登录页
│   │   │   ├── LobbyView.vue         # 大厅页
│   │   │   ├── RoomView.vue          # 房间页
│   │   │   ├── GameView.vue          # 游戏页
│   │   │   ├── ProfileView.vue       # 个人中心
│   │   │   └── AIAgentWorkshop.vue   # AI 工坊
│   │   ├── stores/
│   │   │   ├── user.js               # 用户状态
│   │   │   ├── room.js               # 房间状态
│   │   │   ├── game.js               # 游戏状态
│   │   │   └── theme.js              # 主题状态（暗色/亮色切换）
│   │   ├── router/
│   │   │   └── index.js              # 路由配置
│   │   ├── api.js                    # API 封装
│   │   ├── socket.js                 # Socket 封装
│   │   ├── App.vue                   # 应用根组件
│   │   └── main.js                   # 应用入口
│   ├── index.html
│   ├── Dockerfile                    # 前端 Docker 镜像（含 Nginx）
│   ├── nginx.conf                    # Nginx 配置（SPA + 反向代理）
│   ├── vite.config.js
│   └── package.json
├── .gitignore
├── .dockerignore
├── docker-compose.yml         # Docker 编排配置
└── README.md
```

## 🚀 快速开始

### 方式一：Docker 一键部署（推荐）

> 环境要求：[Docker Desktop](https://www.docker.com/products/docker-desktop/)

```bash
# 克隆项目
git clone <your-repo-url>
cd Newwerewolf

# 一键启动（前端 + 后端 + MySQL）
docker-compose up -d --build
```

启动后访问 **http://localhost** 即可开始游戏。

```bash
# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 停止并清空数据库
docker-compose down -v
```

#### Docker 架构

```
浏览器 (http://localhost)
    │
    ▼
┌──────────────┐
│   frontend   │  Nginx :80
│  (Vue + Nginx)│
└──────┬───────┘
       │ /api/* 和 /socket.io/* 反向代理
       ▼
┌──────────────┐
│   backend    │  Node.js :3001
│  (Express)   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    mysql     │  MySQL 8.0 :3306
│  (数据库)    │
└──────────────┘
```

### 方式二：本地开发

#### 环境要求
- Node.js >= 18.x
- MySQL >= 8.0

#### 1. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

#### 2. 配置环境变量

复制 `backend/.env.example` 为 `backend/.env` 并修改配置：

```bash
cp backend/.env.example backend/.env
```

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=werewolf

# JWT 配置
JWT_SECRET=please_generate_a_strong_secret_key
JWT_EXPIRES_IN=7d

# 服务端口
PORT=3000

# AI API 配置（可选，不配置则使用 fallback 逻辑）
DEEPSEEK_API_KEY=your_api_key

# CORS 允许的源（逗号分隔）
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

#### 3. 启动项目

```bash
# 启动后端
cd backend
npm run dev

# 启动前端（新终端）
cd frontend
npm run dev
```

访问 http://localhost:5173 即可开始游戏。

## 🎮 游戏功能

### 核心玩法
- 🔄 支持 6 / 8 / 12 人游戏模式
- 🐺 6 种角色：狼人、村民、预言家、女巫、猎人、守卫
- 🌙 **夜晚阶段**：狼人杀人、预言家查验身份、女巫使用解药/毒药、守卫守护玩家
- ☀️ **白天阶段**：顺序发言、讨论分析
- 🗳️ **投票阶段**：放逐投票、决出胜负
- 🔫 **猎人机制**：猎人死亡时可开枪带走一名玩家（被毒杀时不可开枪）

### 房间系统
- 🆔 创建/加入房间（6位房间码）
- ✅ 准备/取消准备
- 💬 实时聊天
- 📊 玩家状态同步
- 🎮 开始游戏 / 返回房间
- 🔄 断线自动重连（60秒宽限期）

### AI 智能体
- 🤖 AI 工坊：创建、编辑、删除 AI 智能体
- 🎭 自定义 AI 角色人设（激进度、谨慎度、狡猾度、诚实度、话多程度）
- 🗣️ 自定义发言风格（幽默、严肃、激进、冷静、神秘）
- 📝 自定义语言习惯（口头禅前缀/后缀、常用词）
- 🧠 自定义策略（夜间策略、白天策略、身份暴露时机）
- 👥 AI 玩家可加入房间参与游戏
- 💡 AI 自动发言和决策（支持 LLM 或 fallback 模板）

### 特色功能
- 🌓 **暗色/亮色主题切换**：一键切换界面主题，偏好自动保存
- 📜 游戏结束自动复盘（身份揭晓、行动记录）
- 🔄 断线重连保持游戏状态
- 📱 响应式布局，支持移动端
- 🔐 JWT 认证 + Socket.IO 认证中间件
- 🛡️ 接口限流保护
- 🤝 同一账号多设备登录自动踢出旧连接
- 💬 自定义弹窗系统：替换浏览器原生 alert/confirm，提供统一美观的对话框体验

## 📡 API 接口

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| GET  | `/api/auth/me` | 获取当前用户信息 |
| PUT  | `/api/auth/me` | 更新用户资料 |
| GET  | `/api/auth/api-config` | 获取 API 配置 |
| PUT  | `/api/auth/api-config` | 更新 API 配置 |

### AI 智能体
| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/ai-agents` | 获取智能体列表 |
| GET  | `/api/ai-agents/:id` | 获取单个智能体 |
| POST | `/api/ai-agents` | 创建智能体 |
| PUT  | `/api/ai-agents/:id` | 更新智能体 |
| DELETE | `/api/ai-agents/:id` | 删除智能体 |

### 房间
| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/rooms` | 获取活跃房间列表 |
| GET  | `/api/room/:code` | 获取房间详情 |
| GET  | `/api/health` | 健康检查 |

## 🔌 Socket 事件

### 房间事件
| 事件名 | 方向 | 说明 |
|--------|------|------|
| `create_room` | 客户端→服务器 | 创建房间 |
| `join_room` | 客户端→服务器 | 加入房间 |
| `leave_room` | 客户端→服务器 | 离开房间 |
| `player_ready` | 客户端→服务器 | 切换准备状态 |
| `add_ai_player` | 客户端→服务器 | 添加 AI 玩家 |
| `remove_ai_player` | 客户端→服务器 | 移除 AI 玩家 |
| `room_joined` | 服务器→客户端 | 已加入房间 |
| `room_update` | 服务器→客户端 | 房间信息更新 |
| `room_created` | 服务器→客户端 | 新房间创建通知 |
| `room_deleted` | 服务器→客户端 | 房间删除通知 |
| `chat` | 客户端→服务器 | 发送聊天消息 |
| `chat_message` | 服务器→客户端 | 收到聊天消息 |

### 游戏事件
| 事件名 | 方向 | 说明 |
|--------|------|------|
| `start_game` | 客户端→服务器 | 开始游戏 |
| `game_started` | 服务器→客户端 | 游戏已开始（含角色信息） |
| `phase_change` | 服务器→客户端 | 阶段变化 |
| `night_action` | 客户端→服务器 | 夜晚行动 |
| `night_action_prompt` | 服务器→客户端 | 夜晚行动提示 |
| `night_role_turn` | 服务器→客户端 | 当前夜晚角色行动阶段 |
| `night_role_done` | 服务器→客户端 | 当前夜晚角色行动结束 |
| `seer_result` | 服务器→客户端 | 预言家查验结果 |
| `night_result` | 服务器→客户端 | 夜晚结果（死亡信息） |
| `hunter_shoot` | 客户端→服务器 | 猎人开枪 |
| `hunter_trigger` | 服务器→客户端 | 猎人触发提示 |
| `hunter_result` | 服务器→客户端 | 猎人开枪结果 |
| `vote` | 客户端→服务器 | 提交投票 |
| `vote_update` | 服务器→客户端 | 投票进度更新 |
| `vote_result` | 服务器→客户端 | 投票结果 |
| `speaker_change` | 服务器→客户端 | 发言者切换 |
| `next_speaker` | 客户端→服务器 | 下一位发言 |
| `skip_speaking` | 客户端→服务器 | 跳过发言 |
| `skip_day` | 客户端→服务器 | 跳过白天讨论 |
| `game_over` | 服务器→客户端 | 游戏结束 |
| `reset_game` | 客户端→服务器 | 重置游戏返回房间 |
| `force_logout` | 服务器→客户端 | 强制下线（多设备登录） |

## 🎯 游戏流程

```
等待阶段 → 夜晚阶段 → 白天发言 → 投票阶段 → (循环) → 游戏结束
   ↓           ↓           ↓           ↓
 准备开始   夜晚行动    轮流发言    放逐投票
```

### 夜晚行动顺序
1. 🛡️ 守卫守护（30秒）
2. 🐺 狼人杀人（30秒）
3. 🔮 预言家查验（30秒）
4. 🧪 女巫行动（30秒）

### 角色说明

| 角色 | 阵营 | 能力 |
|------|------|------|
| 🐺 狼人 | 狼人 | 每晚选择击杀一名玩家 |
| 👨‍🌾 村民 | 村民 | 无特殊能力，通过推理找出狼人 |
| 🔮 预言家 | 村民 | 每晚查验一名玩家的身份 |
| 🧪 女巫 | 村民 | 拥有一瓶解药和一瓶毒药（各限用一次） |
| 🏹 猎人 | 村民 | 被淘汰时可开枪带走一人（被毒杀时不可） |
| 🛡️ 守卫 | 村民 | 每晚守护一名玩家（不能连续守护同一人） |

### 角色分配

| 模式 | 狼人 | 预言家 | 女巫 | 守卫 | 猎人 | 村民 |
|------|------|--------|------|------|------|------|
| 6人 | 2 | 1 | 1 | - | 1 | 1 |
| 8人 | 3 | 1 | 1 | 1 | - | 2 |
| 12人 | 4 | 1 | 1 | 1 | 1 | 4 |

## 🛠️ 开发说明

### 开发模式
```bash
# 后端 - 自动重启
cd backend
npm run dev

# 前端 - HMR 热更新
cd frontend
npm run dev
```

### 生产构建
```bash
# 前端构建
cd frontend
npm run build

# 后端启动
cd backend
npm start
```

### 数据库自动初始化
后端首次启动时会自动创建数据库和表结构：
- `users` - 用户表（id, username, password, api_key, api_url, model_name, created_at）
- `game_records` - 游戏记录表（id, room_code, winner, player_count, duration, created_at）
- `game_players` - 游戏玩家表（id, game_id, user_id, role, is_winner）

## 📄 License

MIT License
