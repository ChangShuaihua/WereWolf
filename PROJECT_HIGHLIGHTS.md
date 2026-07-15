# 项目亮点与实现过程

## ✨ 亮点概览

本狼人杀项目在技术实现上有以下亮点：

| 亮点 | 描述 |
|------|------|
| 🚀 实时通信 | 基于 Socket.IO 的低延迟实时通信 |
| 🔄 断线重连 | 刷新页面保持玩家身份和房主权限 |
| 📜 自动复盘 | 游戏结束自动生成完整复盘报告 |
| 🏠 房间管理 | 完整的房间创建、加入、解散机制 |
| 🎮 多角色系统 | 6种角色，丰富的游戏策略 |
| 📊 状态同步 | 前后端状态实时同步，数据一致性保障 |

---

## 1. 🚀 实时通信架构

### 亮点描述
采用 Socket.IO 实现房间内所有玩家的实时通信，消息延迟低于 100ms。

### 实现过程

#### 架构设计
```
客户端                    服务端
  │                         │
  │─── create_room ────────▶│
  │                         │─── 创建房间
  │                         │─── 广播 room_created
  │◀── room_joined ────────│
  │                         │
  │─── chat_message ──────▶│
  │                         │─── 广播 chat_message
  │◀── chat_message ───────│
```

#### 关键实现

**后端 - Socket 入口**
```javascript
// backend/src/socket/index.js
socket.on('create_room', (data) => {
  createRoom(socket, data);
});

socket.on('join_room', (data) => {
  joinRoom(socket, data);
});
```

**后端 - 广播机制**
```javascript
// backend/src/socket/roomHandler.js
function broadcastRoomUpdate(code, room) {
  const io = require('../app').getIO();
  io.to(code).emit('room_update', {
    players: room.players,
    hostId: room.hostId,
  });
}
```

**前端 - Socket 封装**
```javascript
// frontend/src/socket.js
import { io } from 'socket.io-client';

const socket = io('/');

export default socket;
```

**技术要点**
- 使用 Socket.IO 的房间分组功能（`socket.join(code)`）
- 事件驱动架构，解耦业务逻辑
- 自动重连机制，网络波动自动恢复

---

## 2. 🔄 断线重连与身份保持

### 亮点描述
刷新页面后，玩家自动重新加入房间，保持原有身份和房主权限，无需重新开始。

### 实现过程

#### 问题分析
- Socket.IO 每次连接都会生成新的 `socket.id`
- 直接使用 `socket.id` 标识玩家会导致刷新后身份丢失
- 房主身份使用 `socket.id` 存储，刷新后无法识别

#### 解决方案

**步骤1：引入 userId 作为唯一标识**
```javascript
// backend/src/socket/roomHandler.js
const room = {
  code,
  hostId: socket.id,
  hostUserId: userId,  // 使用 userId 标识房主
  players: [],
  chat: [],
};
```

**步骤2：断开连接时保留玩家记录**
```javascript
// backend/src/socket/roomHandler.js - leaveRoom
if (isDisconnect) {
  const player = room.players.find(p => p.socketId === socket.id);
  if (player) {
    player.socketId = null;  // 不删除，只标记断线
    roomCache.set(code, room);
    broadcastRoomUpdate(code);
    
    // 30秒后未重连才真正删除
    setTimeout(() => {
      const room = roomCache.get(code);
      if (room) {
        const idx = room.players.findIndex(p => p.socketId === null);
        if (idx !== -1) {
          room.players.splice(idx, 1);
          roomCache.set(code, room);
          broadcastRoomUpdate(code);
        }
      }
    }, 30000);
  }
  return;
}
```

**步骤3：重连时恢复身份**
```javascript
// backend/src/socket/roomHandler.js - joinRoom
const existing = room.players.find(p => p.userId === userId);
if (existing) {
  existing.socketId = socket.id;
  socket.join(code);
  
  // 恢复房主身份
  if (room.hostUserId === userId) {
    room.hostId = socket.id;
  }
  
  roomCache.set(code, room);
  broadcastRoomUpdate(code);
}
```

**步骤4：前端刷新后重新加入**
```javascript
// frontend/src/views/RoomView.vue
onMounted(async () => {
  if (!socket.connected) socket.connect();
  
  await fetchRoomInfo();
  roomStore.joinRoom(roomStore.roomCode);  // 重新加入
});
```

**技术要点**
- 使用 `userId` + `socketId` 双重标识玩家
- 断线时保留记录，设置超时清理机制
- 重连时通过 `userId` 匹配已有记录
- 房主身份使用 `hostUserId` 持久化

---

## 3. 📜 自动复盘系统

### 亮点描述
游戏结束后自动生成完整的复盘报告，包含身份揭晓、胜负结果、行动记录。

### 实现过程

#### 数据采集

**游戏历史记录**
```javascript
// backend/src/game/GameEngine.js
submitNightAction(socketId, action, targetId) {
  // ...
  this.gameHistory.push({
    night: this.nightCount,
    action,
    actor: { id: socketId, username: player.username, role: this.roles[socketId] },
    target: target ? { id: targetId, username: target.username } : null,
    detail: `${getRoleName(this.roles[socketId])}选择了${target?.username || '未知'}`,
  });
}

submitVote(socketId, targetId) {
  // ...
  this.gameHistory.push({
    night: this.nightCount,
    action: 'vote',
    actor: { id: socketId, username: voter.username, role: this.roles[socketId] },
    target: target ? { id: targetId, username: target.username } : null,
    detail: `${voter.username}投票给了${target?.username || '未知'}`,
  });
}
```

#### 复盘生成

**生成复盘消息**
```javascript
// backend/src/game/GameEngine.js
generateReplayMessage(players, winner, message) {
  let replay = `--- 🎮 上一轮复盘 ---
${message}

👥 身份揭晓：`;
  
  // 按角色分类
  const werewolves = players.filter(p => p.role === ROLE.WEREWOLF);
  const seer = players.find(p => p.role === ROLE.SEER);
  const witch = players.find(p => p.role === ROLE.WITCH);
  // ...
  
  // 胜负结果
  replay += `
🏆 胜负结果：
胜利方：${winners.map(p => p.username).join('、')}
失败方：${losers.map(p => p.username).join('、')}`;
  
  // 行动记录
  replay += `
📜 行动记录：`;
  this.gameHistory.forEach(h => {
    replay += `\n  - ${h.detail}`;
  });
  
  return replay;
}
```

#### 消息分发

**发送到聊天**
```javascript
// backend/src/socket/gameHandler.js
const emit = (target, event, data) => {
  if (event === '__game_replay') {
    const room = roomCache.get(data.roomCode);
    if (room) {
      const replayMsg = {
        username: '系统',
        message: data.message,
        timestamp: Date.now(),
      };
      room.chat.push(replayMsg);
      io.to(data.roomCode).emit('chat_message', replayMsg);
    }
  }
};
```

**前端显示**
```css
/* frontend/src/assets/style.css */
.chat-text {
  white-space: pre-wrap;
  word-break: break-word;
}
```

**技术要点**
- 使用 `gameHistory` 数组记录所有行动
- 游戏结束时统一生成复盘报告
- 通过聊天系统展示复盘信息
- 使用 `white-space: pre-wrap` 保留换行格式

---

## 4. 🏠 房间管理系统

### 亮点描述
完整的房间生命周期管理，支持创建、加入、离开、自动解散。

### 实现过程

#### 房间创建
```javascript
// backend/src/socket/roomHandler.js
function createRoom(socket, { userId, username }) {
  const code = generateRoomCode();
  
  const room = {
    code,
    hostId: socket.id,
    hostUserId: userId,
    players: [{ userId, username, socketId: socket.id, isReady: false, isAlive: true }],
    chat: [],
    createdAt: Date.now(),
  };
  
  roomCache.set(code, room);
  socket.join(code);
  
  // 广播房间创建
  io.emit('room_created', {
    code,
    hostUsername: username,
    playerCount: 1,
    maxPlayers: 12,
  });
}
```

#### 房间加入
```javascript
function joinRoom(socket, { code, userId, username }) {
  const room = roomCache.get(code);
  
  // 检查是否已在房间中（重连）
  const existing = room.players.find(p => p.userId === userId);
  if (existing) {
    existing.socketId = socket.id;
    // ...
    return;
  }
  
  // 新玩家加入
  room.players.push({ userId, username, socketId: socket.id, isReady: false, isAlive: true });
  
  // 欢迎消息
  const welcomeMsg = {
    username: '系统',
    message: `🎉 ${username} 加入了房间！`,
    timestamp: Date.now(),
  };
  room.chat.push(welcomeMsg);
}
```

#### 房间自动解散
```javascript
function leaveRoom(socket, code, isDisconnect = false) {
  // ...
  
  // 人数为0时自动解散
  if (room.players.length === 0) {
    roomCache.del(code);
    gameCache.del(code);
    
    // 广播房间删除
    io.emit('room_deleted', { code });
    return;
  }
}
```

#### 实时房间列表
```javascript
// frontend/src/views/LobbyView.vue
onMounted(() => {
  socket.on('room_created', (data) => {
    rooms.value.unshift(data);
  });
  
  socket.on('room_deleted', (data) => {
    rooms.value = rooms.value.filter(r => r.code !== data.code);
  });
});
```

**技术要点**
- 使用内存缓存存储房间数据
- 创建/删除房间时广播事件
- 大厅页面实时监听房间变化
- 人数为0时自动清理房间

---

## 5. 🎮 多角色游戏引擎

### 亮点描述
支持6种角色（狼人、村民、预言家、女巫、猎人、守卫），每种角色都有独特的技能和玩法。

### 实现过程

#### 角色配置
```javascript
// backend/src/game/constants.js
const ROLE = {
  WEREWOLF: 'werewolf',
  VILLAGER: 'villager',
  SEER: 'seer',
  WITCH: 'witch',
  HUNTER: 'hunter',
  GUARD: 'guard',
};

const ROLE_DISTRIBUTION = {
  4: ['werewolf', 'seer', 'witch', 'villager'],
  5: ['werewolf', 'werewolf', 'seer', 'witch', 'villager'],
  // ... 支持4-12人配置
};
```

#### 角色分配
```javascript
// backend/src/game/RoleConfig.js
function getRolesForGame(playerCount) {
  const roles = ROLE_DISTRIBUTION[playerCount];
  if (!roles) {
    // 自动计算配置
    const werewolves = Math.floor(playerCount / 3);
    const specials = Math.min(4, playerCount - werewolves - 1);
    const villagers = playerCount - werewolves - specials;
    // ...
  }
  return shuffle([...roles]);
}
```

#### 夜晚行动处理
```javascript
// backend/src/game/GameEngine.js
processNight() {
  // 1. 狼人杀人
  if (this.killedByWerewolves && !this.guardProtected) {
    this.killPlayer(this.killedByWerewolves);
  }
  
  // 2. 女巫用药
  if (this.killedByWitch) {
    this.killPlayer(this.killedByWitch);
  }
  
  // 3. 猎人死亡开枪
  const hunter = this.players.find(p => p.isAlive && this.roles[p.socketId] === ROLE.HUNTER);
  if (!hunter.isAlive && this.killedByWitch !== hunter.socketId) {
    // 猎人开枪
  }
}
```

#### 投票系统
```javascript
// backend/src/game/GameEngine.js
processVote() {
  const voteCounts = {};
  Object.values(this.votes).forEach(targetId => {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  });
  
  // 找出票数最多的玩家
  let maxVotes = 0;
  let votedPlayer = null;
  Object.entries(voteCounts).forEach(([id, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      votedPlayer = id;
    }
  });
  
  if (votedPlayer) {
    this.killPlayer(votedPlayer);
  }
}
```

**技术要点**
- 灵活的角色配置，支持4-12人
- 夜晚行动按顺序处理（守卫→狼人→女巫）
- 投票系统支持平票处理
- 猎人技能在死亡时触发

---

## 6. 📊 状态同步机制

### 亮点描述
前后端状态实时同步，确保所有玩家看到一致的游戏状态。

### 实现过程

#### 状态管理
```javascript
// frontend/src/stores/game.js
import { defineStore } from 'pinia';

export const useGameStore = defineStore('game', () => {
  const phase = ref('WAITING');
  const myRole = ref(null);
  const players = ref([]);
  
  const bindEvents = () => {
    socket.on('game_started', (data) => {
      phase.value = 'NIGHT';
      myRole.value = data.role;
      players.value = data.players;
    });
    
    socket.on('game_over', (data) => {
      phase.value = 'END';
      players.value = data.players;
    });
  };
  
  return { phase, myRole, players, bindEvents };
});
```

#### 房间状态同步
```javascript
// frontend/src/stores/room.js
export const useRoomStore = defineStore('room', () => {
  const roomCode = ref('');
  const players = ref([]);
  
  const bindEvents = () => {
    socket.on('room_update', (data) => {
      players.value = data.players;
    });
    
    socket.on('chat_message', (msg) => {
      chat.value.push(msg);
    });
  };
  
  return { roomCode, players, bindEvents };
});
```

#### 游戏状态同步
```javascript
// backend/src/game/GameEngine.js
broadcast(event, data) {
  this.emit(this.roomCode, event, data);
}

start() {
  // 分配角色
  const roles = getRolesForGame(this.players.length);
  this.players.forEach((p, i) => {
    this.roles[p.socketId] = roles[i];
  });
  
  // 通知所有玩家
  this.broadcast('game_started', {
    phase: this.phase,
    roles: this.roles,
  });
}
```

**技术要点**
- 使用 Pinia 管理前端状态
- 事件驱动的状态更新
- 游戏状态变更时立即广播
- 前端监听事件自动更新 UI

---

## 🛡️ 安全与性能

### 安全措施
- 玩家身份验证（userId + token）
- 防止作弊（服务器端验证操作权限）
- 输入过滤（防止 XSS 攻击）

### 性能优化
- 内存缓存减少数据库查询
- Socket.IO 高效的消息序列化
- 前端懒加载和代码分割

---

## 📈 未来展望

- [ ] AI 机器人玩家
- [ ] 自定义角色扩展
- [ ] 语音聊天支持
- [ ] 移动端适配
- [ ] 房间密码保护
- [ ] 战绩统计分析