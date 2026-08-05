# 🐺 狼人杀项目模块总结

本文档详细描述了狼人杀项目的每个模块的功能和实现方式。

---

## 目录

- [🐺 狼人杀项目模块总结](#-狼人杀项目模块总结)
  - [目录](#目录)
  - [后端模块](#后端模块)
    - [1. 应用入口 (`app.js`)](#1-应用入口-appjs)
    - [2. 数据库配置 (`config/db.js`)](#2-数据库配置-configdbjs)
    - [2.1 Redis 配置 (`config/redis.js`)](#21-redis-配置-configredisjs)
    - [3. 认证中间件 (`middleware/auth.js`)](#3-认证中间件-middlewareauthjs)
    - [4. 用户模型 (`models/User.js`)](#4-用户模型-modelsuserjs)
    - [5. 游戏记录模型 (`models/GameRecord.js`)](#5-游戏记录模型-modelsgamerecordjs)
    - [6. 认证路由 (`routes/auth.js`)](#6-认证路由-routesauthjs)
    - [7. AI智能体路由 (`routes/aiAgentRoutes.js`)](#7-ai智能体路由-routesaiagentroutesjs)
    - [8. Socket.IO入口 (`socket/index.js`)](#8-socketio入口-socketindexjs)
    - [9. 房间管理器 (`socket/roomHandler.js`)](#9-房间管理器-socketroomhandlerjs)
    - [10. 游戏事件处理器 (`socket/gameHandler.js`)](#10-游戏事件处理器-socketgamehandlerjs)
    - [11. 游戏引擎 (`game/GameEngine.js`)](#11-游戏引擎-gamegameenginejs)
    - [12. AI游戏处理器 (`game/AIGameHandler.js`)](#12-ai游戏处理器-gameaigamehandlerjs)
    - [13. 角色配置 (`game/RoleConfig.js`)](#13-角色配置-gameroleconfigjs)
    - [14. 游戏常量 (`game/constants.js`)](#14-游戏常量-gameconstantsjs)
    - [15. AI智能体管理器 (`ai/AIAgentManager.js`)](#15-ai智能体管理器-aiaiagentmanagerjs)
    - [16. 缓存工具 (`utils/cache.js`)](#16-缓存工具-utilscachejs)
    - [17. 自定义错误类 (`utils/AppError.js`)](#17-自定义错误类-utilsapperrorjs)
    - [18. 用户Socket映射 (`utils/userSocketMap.js`)](#18-用户socket映射-utilsusersocketmapjs)
  - [前端模块](#前端模块)
    - [1. 应用入口 (`main.js` / `App.vue`)](#1-应用入口-mainjs--appvue)
    - [2. 路由配置 (`router/index.js`)](#2-路由配置-routerindexjs)
    - [3. API封装 (`api.js`)](#3-api封装-apijs)
    - [4. Socket封装 (`socket.js`)](#4-socket封装-socketjs)
    - [5. 用户状态 (`stores/user.js`)](#5-用户状态-storesuserjs)
    - [6. 房间状态 (`stores/room.js`)](#6-房间状态-storesroomjs)
    - [7. 游戏状态 (`stores/game.js`)](#7-游戏状态-storesgamejs)
    - [8. 主题状态 (`stores/theme.js`)](#8-主题状态-storesthemejs)
    - [9. 确认对话框逻辑 (`composables/useConfirm.js`)](#9-确认对话框逻辑-composablesuseconfirmjs)
    - [10. 登录页 (`views/LoginView.vue`)](#10-登录页-viewsloginviewvue)
    - [11. 大厅页 (`views/LobbyView.vue`)](#11-大厅页-viewslobbyviewvue)
    - [12. 房间页 (`views/RoomView.vue`)](#12-房间页-viewsroomviewvue)
    - [13. 游戏页 (`views/GameView.vue`)](#13-游戏页-viewsgameviewvue)
    - [14. AI工坊 (`views/AIAgentWorkshop.vue`)](#14-ai工坊-viewsaiagentworkshopvue)
    - [15. 个人中心 (`views/ProfileView.vue`)](#15-个人中心-viewsprofileviewvue)
    - [16. 游戏组件](#16-游戏组件)
      - [ConfirmDialog.vue - 确认对话框组件](#confirmdialogvue---确认对话框组件)
      - [ChatBox.vue - 聊天组件](#chatboxvue---聊天组件)
      - [Countdown.vue - 倒计时组件](#countdownvue---倒计时组件)
      - [NightPanel.vue - 夜晚行动面板](#nightpanelvue---夜晚行动面板)
      - [DayPanel.vue - 白天发言面板](#daypanelvue---白天发言面板)
      - [VotePanel.vue - 投票面板](#votepanelvue---投票面板)
      - [HunterPanel.vue - 猎人开枪面板](#hunterpanelvue---猎人开枪面板)
      - [PlayerList.vue - 玩家列表组件](#playerlistvue---玩家列表组件)
      - [RoleReveal.vue - 身份揭示组件](#rolerevealvue---身份揭示组件)
      - [GameResult.vue - 游戏结果组件](#gameresultvue---游戏结果组件)
  - [数据流图](#数据流图)
  - [关键技术实现](#关键技术实现)
    - [实时通信架构](#实时通信架构)
    - [AI 智能体架构](#ai-智能体架构)
    - [游戏状态管理](#游戏状态管理)
    - [错误处理](#错误处理)
    - [主题系统](#主题系统)
    - [弹窗系统](#弹窗系统)

---

## 后端模块

### 1. 应用入口 (`app.js`)

**功能**：整个后端应用的入口文件，负责初始化 Express 服务、Socket.IO、中间件和路由。

**实现方式**：
- 创建 Express 应用和 HTTP 服务器
- 配置 CORS（支持通过 `CORS_ORIGINS` 环境变量自定义允许的源）
- 初始化 Socket.IO 并配置 CORS
- 配置请求体大小限制（1MB）
- 配置接口限流：认证接口 20次/分钟，通用 API 100次/分钟
- 注册 REST 路由：`/api/auth`、`/api/ai-agents`、`/api/rooms`、`/api/room/:code`、`/api/health`
- 全局错误处理（支持 AppError 自定义错误、CORS 错误、请求体过大错误）
- 启动时自动初始化数据库、初始化 Redis，并监听端口

**关键设计**：
- 使用 `app.getIO()` 方法将 Socket.IO 实例暴露给其他模块，避免循环依赖
- `/api/health` 返回服务状态和 Redis 连接状态
- 启动时清空 `roomCache` 确保干净状态，房间仍按临时大厅语义处理

---

### 2. 数据库配置 (`config/db.js`)

**功能**：MySQL 数据库连接池配置和自动初始化。

**实现方式**：
- 使用 `mysql2/promise` 创建连接池（最大 10 连接）
- `initDB()` 函数自动完成：
  1. 创建数据库（如不存在）
  2. 创建 `users` 表（含 api_key、api_url、model_name 扩展字段）
  3. 创建 `game_records` 表
  4. 创建 `game_players` 表（外键关联）
- 字符集统一使用 `utf8mb4`

**表结构**：
```
users: id, username, password, api_key, api_url, model_name, created_at
game_records: id, room_code, winner, player_count, duration, created_at
game_players: id, game_id, user_id, role, is_winner
ai_agents: id, name, avatar, personality(JSON), speaking_style, strategy(JSON), language(JSON), created_at_ms, updated_at_ms
```

---

### 2.1 Redis 配置 (`config/redis.js`)

**功能**：管理 Redis 客户端连接、连接状态、失败降级和进程退出时的关闭逻辑。

**实现方式**：
- 使用官方 `redis` 客户端创建连接
- 优先读取 `REDIS_URL`，也支持 `REDIS_HOST`、`REDIS_PORT`、`REDIS_DB` 组合配置
- `initRedis()` 在后端启动时执行；连接失败时不会阻塞服务启动，而是降级为内存缓存
- `getRedisClient()` 只在客户端 ready 时返回实例，缓存层据此决定是否同步 Redis
- `getRedisStatus()` 用于 `/api/health` 返回当前 Redis 状态
- `shutdownRedis()` 在 SIGINT/SIGTERM 时关闭连接

**关键环境变量**：
- `REDIS_URL`：Redis 连接地址，Docker 环境为 `redis://redis:6379/0`
- `REDIS_KEY_PREFIX`：Redis key 前缀，默认 `werewolf`
- `REDIS_DISABLED=true`：禁用 Redis，完全使用内存缓存
- `REDIS_RECONNECT_RETRIES`：初始连接失败时的重试次数，默认 5

---

### 3. 认证中间件 (`middleware/auth.js`)

**功能**：验证 JWT Token，保护需要登录的接口。

**实现方式**：
- 从 `Authorization: Bearer <token>` 头提取 token
- 使用 `jsonwebtoken` 验证 token 有效性
- 验证通过后将解码的用户信息挂载到 `req.user`
- 验证失败返回 401 错误

---

### 4. 用户模型 (`models/User.js`)

**功能**：用户数据的 CRUD 操作。

**实现方式**：
- `create(username, password)` - 使用 bcrypt（10轮）加密密码后创建用户
- `findByUsername(username)` - 按用户名查找（返回密码哈希，用于登录验证）
- `findById(id)` - 按 ID 查找（不返回密码哈希，用于信息展示）
- `verifyPassword(input, hashed)` - 使用 bcrypt.compare 验证密码
- `updateProfile(userId, data)` - 动态构建 UPDATE 语句更新用户名/密码
- `updateApiConfig(userId, config)` - 更新用户的 AI API 配置

---

### 5. 游戏记录模型 (`models/GameRecord.js`)

**功能**：游戏结果的持久化存储。

**实现方式**：
- `create(roomCode, winner, playerCount, duration)` - 创建游戏记录
- `addPlayer(gameId, userId, role, isWinner)` - 记录每个玩家的角色和胜负

---

### 6. 认证路由 (`routes/auth.js`)

**功能**：用户注册、登录、个人信息管理、API 配置管理。

**实现方式**：
- `POST /register` - 注册（验证用户名2-20字符、密码≥6位、用户名唯一性）
- `POST /login` - 登录（验证用户名和密码，返回 JWT token）
- `GET /me` - 获取当前用户信息（需认证）
- `PUT /me` - 更新用户资料（需验证旧密码才能改密码）
- `GET /api-config` - 获取用户的 AI API 配置
- `PUT /api-config` - 更新用户的 AI API 配置

**JWT 配置**：token 有效期默认 7 天，可通过 `JWT_EXPIRES_IN` 环境变量配置。

---

### 7. AI智能体路由 (`routes/aiAgentRoutes.js`)

**功能**：AI 智能体的 CRUD 操作。

**实现方式**：
- 所有路由都需要认证（`authMiddleware`）
- `GET /` - 获取所有智能体
- `GET /:id` - 获取单个智能体
- `POST /` - 创建智能体
- `PUT /:id` - 更新智能体
- `DELETE /:id` - 删除智能体
- 错误处理使用 `return res.status(404).json(...)` 模式

---

### 8. Socket.IO入口 (`socket/index.js`)

**功能**：Socket.IO 的初始化和所有事件监听器的注册。

**实现方式**：
- **认证中间件**：连接时验证 JWT token，将 `userId` 和 `username` 挂载到 socket 对象
- **多设备踢出**：同一用户新连接时自动踢出旧连接（发送 `force_logout` 事件）
- **事件绑定**：
  - 房间事件：`create_room`、`join_room`、`leave_room`、`player_ready`
  - AI 事件：`add_ai_player`、`remove_ai_player`
  - 游戏事件：`start_game`、`night_action`、`vote`、`hunter_shoot`、`skip_day`
  - 发言事件：`chat`、`next_speaker`、`skip_speaking`
  - 重置事件：`reset_game`
  - 断线处理：`disconnect`

**关键设计**：
- 使用 `socketCache` 存储每个 socket 的用户信息和房间信息
- 通过 `socket.kicked` 标记防止被踢出的 socket 继续操作

---

### 9. 房间管理器 (`socket/roomHandler.js`)

**功能**：房间的创建、加入、离开、准备、聊天等核心逻辑。

**实现方式**：
- **房间码生成**：6位大写字母+数字（排除 I/O/0/1 避免混淆）
- **座位系统**：每个玩家分配一个座位号，支持查找空座位
- **创建房间**：生成唯一房间码，创建者自动准备，广播 `room_created`
- **加入房间**：检查房间是否存在、是否已满、游戏是否已开始
- **断线重连**：通过 `userId` 匹配已有玩家，恢复 socketId 和游戏状态
- **离开房间**：
  - 游戏未开始：直接移除玩家
  - 游戏进行中：标记为断线（socketId=null），30秒后如未重连则移除
  - 房主离开：自动转让房主
  - 房间无人或只剩 AI：自动销毁房间
- **AI 玩家管理**：房主可添加/移除 AI 玩家
- **聊天消息**：游戏中显示座位号，游戏外显示用户名

**关键设计**：
- `buildSeats()` 构建包含空座位的完整座位数组，用于前端渲染
- `broadcastRoomUpdate()` 统一广播房间状态更新

---
 
### 10. 游戏事件处理器 (`socket/gameHandler.js`)

**功能**：处理游戏开始、夜晚行动、投票、猎人开枪等游戏事件。

**实现方式**：
- **startGame**：
  - 验证房主权限和准备人数
  - 创建 `GameEngine` 实例
  - 设置 emit 回调（处理 `__game_result`、`__game_replay`、`phase_change` 等特殊事件）
  - 调用 `engine.start()` 开始游戏
- **handleNightAction**：验证玩家身份和行动合法性，转发给 GameEngine
- **handleHunterShoot**：验证猎人身份，执行开枪，继续游戏流程
- **handleVote**：转发投票给 GameEngine
- **skipDay**：跳过白天讨论直接进入投票
- **resetGame**：清理游戏状态，重置玩家准备状态
- **handleGameResult**：将游戏结果持久化到数据库

**关键设计**：
- emit 回调是一个中间层，用于拦截特殊事件（如游戏结果持久化、复盘消息广播）
- `phase_change` 事件会同时触发 AI 的阶段处理

---

### 11. 游戏引擎 (`game/GameEngine.js`)

**功能**：狼人杀游戏的核心逻辑引擎，管理整个游戏生命周期。

**实现方式**：
- 继承 `EventEmitter`，通过事件机制与外部通信
- **游戏状态**：
  - `phase`：当前阶段（WAITING/NIGHT/LAST_WILL/DISCUSSION/DAY/VOTE/END）
  - `roles`：角色分配表 `{socketId: role}`（同时持久化到 `p.role` 便于重连恢复）
  - `nightActions`：夜晚行动记录
  - `votes`：投票记录
  - `speakingOrder`：发言顺序
  - `gameHistory`：游戏历史记录（用于复盘）
  - `pkCandidates`：PK 加赛候选人列表

- **夜晚阶段** (`startNight` → `runNightSequence`)：
  1. 守卫守护（30秒，不能连续两晚守护同一人）
  2. 狼人杀人（30秒，多狼投票多数决，平票取第一个）
  3. 预言家查验（30秒）
  4. 女巫行动（30秒，每晚三选一：救人/毒人/跳过，解药毒药各限用一次）
  5. 解析夜晚结果 (`resolveNight`)
  - 整个夜晚有 150 秒总时间预算，超时强制结算

- **夜晚结果解析** (`resolveNight`)：
  - 应用守卫保护和女巫解药
  - 同守同救规则：守卫守护 + 女巫解药 = 死亡；只守或只救则存活
  - 应用女巫毒药（被毒者无条件死亡）
  - 检查猎人死亡触发（被毒杀时不可开枪，只广播提示）

- **白天阶段** (`startDay`)：
  - 若夜晚有人死亡，先进入 `LAST_WILL`（死亡遗言，每人 15 秒，死者依次发言）
  - 遗言结束后进入 `DISCUSSION`（自由讨论，45 秒，所有人可发言，AI 并行发言 1-2 次）
  - 讨论结束后进入 `DAY`（按座位号顺序轮流发言，每人 30 秒）
  - 支持跳过发言、下一位发言
  - 所有人发言完毕自动进入投票
  - 若夜晚平安夜（无人死亡），跳过遗言直接进入自由讨论

- **投票阶段** (`startVote` → `resolveVote`)：
  - 计票并处理平票情况
  - 平票时进入 PK 加赛（`_startPKVote`）：仅限平票候选人投票，30 秒
  - PK 轮再次平票则无人出局，进入下一夜晚
  - 非平票时最高票数者被放逐

- **胜负判定** (`checkWinCondition`)：
  - 狼人全灭 → 村民获胜
  - 狼人数量 ≥ 村民数量 → 狼人获胜

- **游戏结束** (`endGame`)：
  - 广播 `game_over` 事件
  - `generateReplayMessage` 生成结构化复盘 JSON（roles 各角色身份、result 胜负方和输赢玩家、history 按夜分组的事件详情）
  - 通过 `__game_replay` 事件下发，前端 ChatBox 以复盘卡片渲染
  - 触发游戏结果持久化

- **AI 集成**：
  - `_waitForAINightActions`：等待 AI 夜晚行动（3秒超时）
  - `_waitForAIVotes`：等待 AI 投票（3秒超时）
  - `_triggerAISpeaking`：触发 AI 发言（5秒超时）
  - `_triggerAIFreeDiscussion`：自由讨论阶段并行触发所有 AI 发言（每 AI 1-2 次，随机延迟）
  - `_generateAILastWill`：AI 死亡遗言生成
  - `_ensureMessageLength`：确保 AI 消息在 30-50 字之间

**关键设计**：
- 使用 Promise + 事件监听实现异步等待（如 `_waitForRoleActions`）
- 超时机制确保游戏不会因玩家不操作而卡住
- 猎人死亡时进入 10 秒开枪决策窗口（`pendingHunterId` 标记），超时自动随机带走一人
- 断线重连通过 `socketId=null` + `disconnectTime` 标记保留玩家，不直接删除

---

### 12. AI游戏处理器 (`game/AIGameHandler.js`)

**功能**：AI 玩家的决策逻辑，包括夜晚行动、投票和发言。

**实现方式**：
- **LLM 集成**：使用 LangChain + ChatOpenAI，默认接入小米 mimo-v2-flash 模型（`XIAOMI_API_KEY`/`XIAOMI_API_URL`/`XIAOMI_MODEL_NAME`），也兼容 DeepSeek 等 OpenAI 兼容 API
- **Fallback 机制**：LLM 不可用或未配置 API Key 时使用随机/模板逻辑
- **用户自定义 API**：支持每个用户配置自己的 API Key、URL 和模型名称
- **并发控制**：`pLimit` 限制最多 5 个并行 AI LLM 调用，避免突发请求过多

- **夜晚决策** (`_decideNightAction`)：
  - 构建游戏状态提示词（角色、能力、存活玩家、队友、可疑玩家）
  - 使用 `StructuredOutputParser` 强制输出结构化 JSON
  - 验证目标合法性，不合法时使用 fallback

- **投票决策** (`_decideVote`)：
  - 根据阵营确定目标（狼人投好人，好人投狼人）
  - 包含策略描述（白天策略、身份暴露时机）

- **发言生成** (`_generateChatMessage`)：
  - 构建丰富的上下文（游戏状态、聊天记录、游戏事件、性格特征、发言风格、语言习惯）
  - 详细的提示词工程（角色发言规则、正确/错误示例）
  - Fallback 模板：每个角色 10+ 个预设发言模板

- **Fallback 逻辑** (`_getFallback*`)：
  - 夜晚：随机选择目标
  - 投票：根据阵营选择对立阵营的随机目标
  - 发言：从角色模板中随机选择并替换 XX 为随机玩家名

**关键设计**：
- AI 玩家的 socketId 格式为 `ai_${roomCode}_${counter}`
- 性格参数（激进度、谨慎度等）影响发言生成的提示词
- 策略配置影响夜晚行动和投票的决策逻辑

---

### 13. 角色配置 (`game/RoleConfig.js`)

**功能**：角色分配和角色名称映射。

**实现方式**：
- `getRolesForGame(playerCount)`：根据玩家数量返回打乱的角色列表
  - 6人：2狼人、预言家、女巫、猎人、村民
  - 8人：3狼人、预言家、女巫、守卫、2村民
  - 12人：4狼人、预言家、女巫、守卫、猎人、4村民
  - 其他数量：动态计算角色分配
- `shuffle(arr)`：Fisher-Yates 洗牌算法
- `getRoleName(role)`：角色英文名 → 中文名映射

---

### 14. 游戏常量 (`game/constants.js`)

**功能**：定义游戏中使用的所有常量。

**常量列表**：
- `PHASE`：游戏阶段（WAITING/NIGHT/LAST_WILL/DISCUSSION/DAY/VOTE/END）
- `ROLE`：角色类型（werewolf/villager/seer/witch/hunter/guard）
- `TIMERS`：阶段计时器（NIGHT:25s, LAST_WILL:15s/人, DISCUSSION:45s, DAY:30s/人, VOTE:30s, END:15s）
- `ROLE_NAMES`：角色中文名称映射
- `TEAM`：角色所属阵营映射
- `GAME_MODES`：支持的游戏模式（6/8/12人）
- `ROLE_DISTRIBUTION`：各模式的角色分配

---

### 15. AI智能体管理器 (`ai/AIAgentManager.js`)

**功能**：AI 智能体的 CRUD 和持久化。

**实现方式**：
- 数据存储在 MySQL 的 `ai_agents` 表中
- 初始化时如果表为空，则写入默认智能体（10个预设）
- 所有修改操作自动保存到数据库
- **智能体属性**：
  - 基本信息：name、avatar
  - 性格参数：aggressiveness、caution、cunning、honesty、talkativeness（0-100）
  - 发言风格：humorous/serious/aggressive/calm/mysterious
  - 策略配置：nightAction、dayStrategy、revealIdentity
  - 语言习惯：prefixes、suffixes、favoriteWords

**默认智能体**：精明的预言家、冷静的村民、狡猾的狼人、神秘的女巫、强势的猎人、幽默的平民、新手小白、话痨侦探、沉默的守卫、暴躁老哥

---

### 16. 缓存工具 (`utils/cache.js`)

**功能**：基于 `node-cache` 的进程内热缓存，并将可同步数据异步写入 Redis。

**实现方式**：
- `roomCache`：房间数据缓存（TTL 2小时）
- `gameCache`：游戏引擎实例缓存（TTL 2小时），Redis 中保存可序列化的游戏快照
- `socketCache`：Socket 连接信息缓存（TTL 4小时）
- `cache`：通用缓存（TTL 10分钟）
- 房间过期时自动清理关联的 socket 缓存
- 读写接口保持同步，避免大面积改造 Socket 业务代码
- Redis 可用时写入 `werewolf:rooms:*`、`werewolf:games:*`、`werewolf:sockets:*`、`werewolf:general:*`
- Redis 不可用时自动退回纯内存缓存，不影响当前单进程游戏流程
- `clear()` 会同时清理进程内缓存和对应 Redis key 前缀

---

### 17. 自定义错误类 (`utils/AppError.js`)

**功能**：统一的错误处理基类和常用错误子类。

**实现方式**：
- `AppError(message, statusCode)`：基类，标记 `isOperational = true`
- `NotFoundError`：404 错误
- `BadRequestError`：400 错误
- `UnauthorizedError`：401 错误
- `ForbiddenError`：403 错误

---

### 18. 用户Socket映射 (`utils/userSocketMap.js`)

**功能**：管理用户 ID 和 Socket ID 的映射关系，支持多设备踢出。

**实现方式**：
- `userToSocket`：`Map<userId, socketId>` 存储用户当前的 socket 连接
- `kickOldSocket(io, userId, newSocketId)`：
  1. 查找用户的旧 socket 连接
  2. 清理旧 socket 在房间中的状态
  3. 发送 `force_logout` 事件给旧 socket
  4. 标记旧 socket 为 `kicked`
  5. 500ms 后断开旧连接
- `cleanUpOldSocketRoom(io, oldSocketId)`：清理旧 socket 在房间和游戏中的状态

---

## 前端模块

### 1. 应用入口 (`main.js` / `App.vue`)

**功能**：Vue 应用的初始化和根组件。

**实现方式**：
- `main.js`：
  - 创建 Vue 应用，注册 Pinia 和 Vue Router
  - 初始化主题设置（从 localStorage 读取保存的主题偏好）
  - 应用主题到 `documentElement`
- `App.vue`：
  - 条件渲染顶部导航栏（登录页不显示）
  - 导航栏包含：品牌标识、大厅/AI工坊标签页、主题切换按钮、用户信息
  - 全局 ConfirmDialog 组件（替换浏览器原生 alert/confirm）
  - 使用 `router-view` 渲染当前路由组件
  - 使用 composable 模式管理确认对话框状态

---

### 2. 路由配置 (`router/index.js`)

**功能**：定义前端路由和导航守卫。

**实现方式**：
- 路由表：
  - `/login` - 登录页
  - `/lobby` - 大厅页（需认证）
  - `/room/:code` - 房间页（需认证）
  - `/game/:code` - 游戏页（需认证）
  - `/workshop` - AI工坊（需认证）
  - `/profile` - 个人中心（需认证）
- **导航守卫**：
  - 未登录时访问需认证页面 → 重定向到 `/login`
  - 已登录时访问 `/login` → 重定向到 `/lobby`

---

### 3. API封装 (`api.js`)

**功能**：Axios 实例的创建和拦截器配置。

**实现方式**：
- baseURL 设为 `/api`（通过 Vite 代理到后端）
- **请求拦截器**：自动添加 `Authorization: Bearer <token>` 头
- **响应拦截器**：401 错误时自动清除登录状态并跳转到登录页

---

### 4. Socket封装 (`socket.js`)

**功能**：Socket.IO 客户端的初始化和认证。

**实现方式**：
- 配置：`autoConnect: false`，支持 WebSocket 和 Polling 传输
- **connect 方法重写**：连接时自动从 localStorage 获取 token 并设置到 `socket.auth`
- **错误处理**：
  - `AUTH_REQUIRED` / `AUTH_FAILED`：清除登录状态，跳转登录页
  - `force_logout`：多设备登录被踢出时跳转登录页（携带提示信息）
- `authenticate()`：返回 Promise，等待 `authenticated` 事件

---

### 5. 用户状态 (`stores/user.js`)

**功能**：Pinia store，管理用户登录状态。

**实现方式**：
- **State**：`user`（用户信息）、`token`（JWT token）
- **Getters**：`isLoggedIn`（是否已登录）
- **Actions**：
  - `login(username, password)`：调用登录 API，保存 token 和用户信息到 localStorage
  - `register(username, password)`：调用注册 API
  - `logout()`：清除 token 和用户信息

---

### 6. 房间状态 (`stores/room.js`)

**功能**：Pinia store，管理房间状态和 Socket 事件。

**实现方式**：
- **State**：roomCode、players、seats、hostId、chat、maxPlayers
- **事件绑定**：`room_joined`、`room_update`、`chat_message`
- **Actions**：
  - `createRoom(mode)`：创建房间
  - `joinRoom(code)`：加入房间
  - `leaveRoom()`：离开房间并重置状态
  - `toggleReady()`：切换准备状态
  - `startGame()`：开始游戏
  - `sendChat(message)`：发送聊天消息
  - `addAIPlayer(agentId)`：添加 AI 玩家
  - `removeAIPlayer(aiSocketId)`：移除 AI 玩家
  - `isHost()`：判断当前用户是否为房主
  - `allReady()`：判断是否所有玩家都已准备

---

### 7. 游戏状态 (`stores/game.js`)

**功能**：Pinia store，管理游戏状态和 Socket 事件。

**实现方式**：
- **State**：phase、myRole、players、timeout、candidates、gameOver、seerResult、nightActionPrompt、hunterPrompt、currentSpeaker 等
- **事件绑定**：`game_started`、`phase_change`、`night_action_prompt`、`seer_result`、`night_result`、`hunter_trigger`、`hunter_result`、`vote_update`、`vote_result`、`game_over`、`speaker_change` 等
- **Actions**：
  - `submitNightAction({action, targetId})`：提交夜晚行动
  - `submitHunterShoot(targetId)`：猎人开枪
  - `submitVote(targetId)`：提交投票
  - `skipDay()`：跳过白天
  - `sendChat(message)`：发送聊天
  - `nextSpeaker()` / `skipSpeaking()`：发言控制

---

### 8. 主题状态 (`stores/theme.js`)

**功能**：Pinia store，管理暗色/亮色主题切换。

**实现方式**：
- **State**：
  - `theme`：当前主题（'light' 或 'dark'）
  - `isDark`：是否为暗色模式
- **Actions**：
  - `toggleTheme()`：切换主题
  - `setTheme(newTheme)`：设置指定主题
  - `applyTheme()`：将主题应用到 `documentElement`（设置 `data-theme` 属性）
- **持久化**：主题偏好存储在 localStorage 中，key 为 `werewolf_theme`
- **响应式**：通过 watch 监听主题变化，自动更新 DOM

---

### 9. 确认对话框逻辑 (`composables/useConfirm.js`)

**功能**：可复用的确认对话框 composable，替换浏览器原生 alert/confirm。

**实现方式**：
- **State**：
  - `visible`：对话框是否可见
  - `state`：对话框状态（标题、消息、按钮文字、类型）
- **方法**：
  - `showConfirm(options)`：显示确认对话框，返回 Promise
    - options 包含：title、message、confirmText、cancelText、showCancel、type
    - type 可选：success/warning/error/info
  - `onConfirm()`：确认回调，resolve Promise
  - `onCancel()`：取消回调，reject Promise
- **使用示例**：
  ```js
  const { showConfirm } = useConfirm()
  const confirmed = await showConfirm({
    title: '删除确认',
    message: '确定要删除吗？',
    type: 'warning'
  })
  if (confirmed) { /* 执行删除 */ }
  ```

---

### 10. 登录页 (`views/LoginView.vue`)

**功能**：用户登录和注册。

**实现方式**：
- 登录/注册表单切换
- 支持确认密码（注册时）
- 显示强制下线提示（从 URL 参数读取 `forceLogout`）
- 调用 userStore 的 login/register 方法
- 成功后跳转到大厅
- **主题支持**：背景渐变、输入框样式随主题切换

---

### 11. 大厅页 (`views/LobbyView.vue`)

**功能**：游戏大厅，展示房间列表和创建房间。

**实现方式**：
- **分区展示**：6人专区、8人专区、12人专区
- 每个分区显示对应模式的房间列表
- 支持创建房间和加入房间
- 使用 REST API 获取房间列表
- Socket 事件监听：`room_joined`（跳转房间）、`room_created`（添加到列表）、`room_deleted`（从列表移除）
- 定期刷新房间列表
- **主题支持**：卡片、徽章、按钮样式随主题切换

---

### 12. 房间页 (`views/RoomView.vue`)

**功能**：房间等待界面，管理玩家和准备状态。

**实现方式**：
- 显示房间信息（房间号、模式、玩家数）
- 座位网格展示所有玩家（含头像、昵称、状态标签）
- 准备/取消准备按钮
- 房主功能：添加/移除 AI 玩家、开始游戏
- AI 智能体选择下拉框
- 房间聊天面板
- 复制房间号功能
- 游戏开始时自动跳转到游戏页
- **主题支持**：座位卡片、选择框、按钮样式随主题切换

---

### 13. 游戏页 (`views/GameView.vue`)

**功能**：游戏主界面，整合所有游戏组件。

**实现方式**：
- **顶部信息栏**：阶段指示器、角色信息、倒计时
- **左侧面板**：玩家列表 + 行动面板（夜晚/白天/投票/猎人）
- **右侧面板**：聊天面板
- **角色揭示**：游戏开始时显示角色信息（5秒后自动关闭）
- **断线重连**：通过 Socket 事件恢复游戏状态
- **游戏结束**：显示 GameResult 组件

---

### 14. AI工坊 (`views/AIAgentWorkshop.vue`)

**功能**：AI 智能体的创建、编辑、删除和详情查看。

**实现方式**：
- **左侧列表**：显示所有智能体，支持选择查看详情
- **右侧详情**：显示智能体的性格参数（进度条）、策略配置、语言习惯
- **创建/编辑弹窗**：
  - 基本信息：名称、头像选择
  - 性格参数：5个滑块（0-100）
  - 发言风格：5个按钮选择
  - 策略配置：3个下拉选择
  - 语言习惯：3个文本输入（逗号分隔）
- 使用 REST API 进行 CRUD 操作
- **主题支持**：卡片、表单、滑块样式随主题切换
- **自定义弹窗**：删除操作使用 ConfirmDialog 确认

---

### 15. 个人中心 (`views/ProfileView.vue`)

**功能**：用户资料编辑、AI API 配置和主题设置。

**实现方式**：
- **用户信息卡片**：显示用户名首字母头像和 ID
- **编辑资料表单**：修改用户名、修改密码（需旧密码验证）
- **AI API 配置表单**：配置 API Key、API URL、模型名称
  - 用于 AI 智能体的 LLM 调用
  - 支持自定义 OpenAI 兼容 API
- **退出登录按钮**（使用自定义确认对话框）
- **表单样式**：支持暗色/亮色主题切换

---

### 16. 游戏组件

#### ConfirmDialog.vue - 确认对话框组件
- 全局确认对话框，替换浏览器原生 alert/confirm
- 支持多种类型：success/warning/error/info
- 玻璃拟态效果（Glassmorphism）
- 平滑动画过渡
- 通过 useConfirm composable 使用

#### ChatBox.vue - 聊天组件
- 显示聊天消息列表（支持系统消息、AI 消息样式）
- 消息输入框和发送按钮
- 新消息自动滚动到底部
- **主题支持**：消息气泡、输入框、滚动条样式随主题切换

#### Countdown.vue - 倒计时组件
- 进度条倒计时显示
- 颜色随剩余时间变化（安全→警告→危险）

#### NightPanel.vue - 夜晚行动面板
- 根据角色显示不同的行动界面
- 狼人：选择击杀目标
- 预言家：选择查验目标
- 女巫：解药/毒药模式切换，选择目标
- 守卫：选择守护目标
- 行动完成后显示确认信息
- 内置倒计时
- **主题支持**：面板、按钮、计时器样式随主题切换

#### DayPanel.vue - 白天发言面板
- 显示当前发言者信息
- 当前玩家发言时显示"结束发言"和"跳过发言"按钮
- 死亡玩家显示"已死亡"提示
- **主题支持**：面板、按钮样式随主题切换

#### VotePanel.vue - 投票面板
- 显示候选人列表和投票进度
- 选择候选人并确认投票
- 投票完成后显示确认信息

#### HunterPanel.vue - 猎人开枪面板
- 显示可选择的目标
- 选择目标并确认开枪
- 开枪完成后显示确认信息

#### PlayerList.vue - 玩家列表组件
- 按座位号排序显示所有玩家
- 显示状态标签：房主👑、AI🤖、已准备✅、已死亡💀
- 游戏结束时显示角色信息
- **主题支持**：玩家卡片、头像、徽章样式随主题切换

#### RoleReveal.vue - 身份揭示组件
- 全屏遮罩显示角色信息
- 角色图标、名称、能力描述
- 玻璃拟态效果 + 角色专属颜色

#### GameResult.vue - 游戏结果组件
- 全屏遮罩显示游戏结果
- 获胜阵营、游戏时长
- 所有玩家的角色和胜负状态
- 返回房间/返回大厅按钮
- 玻璃拟态效果 + 胜利/失败状态样式

---

## 数据流图

```
用户操作 → Vue组件 → Pinia Store → Socket.IO/REST API
                                        ↓
                                    Express服务器
                                        ↓
                              Socket Handler / Route Handler
                                        ↓
                              GameEngine / AIGameHandler
                                        ↓
                              MySQL / node-cache / Redis
```

## 关键技术实现

### 实时通信架构
- 使用 Socket.IO 实现双向实时通信
- 客户端通过 JWT 认证连接
- 服务器通过房间机制广播消息
- 支持断线重连和状态恢复

### AI 智能体架构
- LangChain + OpenAI API 实现 LLM 调用
- StructuredOutputParser 强制结构化输出
- 多层 fallback 机制确保 AI 始终可用
- 支持用户自定义 API 配置

### 游戏状态管理
- 服务器端：GameEngine 实例（内存 + node-cache，Redis 同步快照）
- 客户端：Pinia store（响应式状态）
- 同步机制：Socket.IO 事件驱动
- Redis 负责缓存数据的跨进程可观测与后续扩展基础，当前实时游戏逻辑仍以内存中的 GameEngine 实例为准

### 错误处理
- 后端：AppError 自定义错误类 + Express 全局错误处理
- 前端：Axios 拦截器 + try-catch + 用户友好提示

### 主题系统
- CSS 变量驱动的主题切换机制
- 通过 `data-theme` 属性应用主题到 `documentElement`
- 亮色主题：浅灰背景 + 深色文字 + 白色毛玻璃卡片
- 暗色主题：深色背景 + 浅色文字 + 深色毛玻璃卡片
- 所有组件样式使用 CSS 变量，确保主题响应一致性
- 主题偏好持久化到 localStorage

### 弹窗系统
- 自定义 ConfirmDialog 组件替换浏览器原生 alert/confirm
- 通过 useConfirm composable 实现 Promise 化调用
- 支持 success/warning/error/info 四种类型
- 玻璃拟态效果 + 平滑动画
- 统一的交互体验和视觉风格
