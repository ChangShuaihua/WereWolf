# Bug 修复总结

## 1. 游戏结束后返回房间/返回大厅

### 问题描述
游戏结束后无法选择返回房间或返回大厅。

### 解决方案

**前端 - GameResult.vue**
- 添加"返回房间"和"返回大厅"两个按钮

**前端 - GameView.vue**
- `goToLobby()`: 发送 `leave_room` 事件，导航到大厅
- `returnToRoom()`: 发送 `reset_game` 事件，导航回房间

**后端 - gameHandler.js**
- 添加 `resetGame()` 函数：删除游戏缓存，重置玩家状态（isReady=false, isAlive=true），广播 `room_reset` 事件

**后端 - socket/index.js**
- 添加 `reset_game` 事件监听

### 关键文件
- `frontend/src/components/GameResult.vue`
- `frontend/src/views/GameView.vue`
- `backend/src/socket/gameHandler.js`
- `backend/src/socket/index.js`

---

## 2. 房间自动解散

### 问题描述
所有玩家都退出房间后，房间仍然显示在大厅列表中。

### 解决方案

**后端 - roomHandler.js**
- 在 `leaveRoom()` 函数中，当房间人数为0时，广播 `room_deleted` 事件

**前端 - LobbyView.vue**
- 添加 `room_deleted` 事件监听，实时从列表中移除已删除的房间

### 关键文件
- `backend/src/socket/roomHandler.js`
- `frontend/src/views/LobbyView.vue`

---

## 3. 返回房间后无法重新开始游戏

### 问题描述
玩家返回房间后准备完毕，但房主无法开始游戏。

### 解决方案

**后端 - roomHandler.js**
- `joinRoom()`: 添加通过 userId 查找已有玩家的逻辑，支持重连场景
- `toggleReady()`: 添加通过 userId 查找玩家的逻辑，支持 socket.id 变化场景

**后端 - gameHandler.js**
- `startGame()`: 添加通过 userId 验证房主身份的逻辑

### 关键文件
- `backend/src/socket/roomHandler.js`
- `backend/src/socket/gameHandler.js`

---

## 4. 房间列表实时更新

### 问题描述
有人创建房间后，其他人只有刷新页面才能看到。

### 解决方案

**后端 - roomHandler.js**
- 在 `createRoom()` 函数中，创建房间后广播 `room_created` 事件

**前端 - LobbyView.vue**
- 添加 `room_created` 事件监听，实时将新房间添加到列表顶部

### 关键文件
- `backend/src/socket/roomHandler.js`
- `frontend/src/views/LobbyView.vue`

---

## 5. 刷新页面自动退出房间

### 问题描述
在房间内刷新页面会自动退出房间。

### 解决方案

**前端 - RoomView.vue**
- 在 `onMounted` 中，获取房间信息后调用 `roomStore.joinRoom()` 重新加入房间

**后端 - roomHandler.js**
- `joinRoom()`: 通过 userId 识别已在房间中的玩家，更新 socketId 并重新加入 socket 房间组

### 关键文件
- `frontend/src/views/RoomView.vue`
- `backend/src/socket/roomHandler.js`

---

## 6. 房主刷新页面房主身份丢失

### 问题描述
房主刷新页面后，房间没有房主或房主身份被转移。

### 解决方案

**后端 - roomHandler.js**
- 房间对象添加 `hostUserId` 字段，用 userId 标识房主
- `leaveRoom()`: 断开连接时（`isDisconnect=true`）不删除玩家，只将 `socketId` 设为 `null`
- `leaveRoom()`: 添加 30 秒超时清理机制，超时未重连才真正删除玩家
- `joinRoom()`: 重连时检查 `hostUserId`，恢复房主身份
- `broadcastRoomUpdate()`: 广播时过滤掉 `socketId` 为 `null` 的断线玩家

**后端 - app.js**
- 房间列表和详情 API 过滤掉断线玩家

### 关键文件
- `backend/src/socket/roomHandler.js`
- `backend/src/app.js`

---

## 7. 房主缺少准备按钮

### 问题描述
返回房间后，房主没有准备按钮。

### 解决方案

**前端 - RoomView.vue**
- 修改按钮布局，所有玩家（包括房主）都显示"准备"按钮
- 房主额外显示"开始游戏"按钮

### 关键文件
- `frontend/src/views/RoomView.vue`

---

## 通用设计模式

### 重连机制
- 使用 `userId` 作为玩家唯一标识，而非 `socket.id`
- 断开连接时保留玩家记录，30秒后才真正清理
- 重连时通过 `userId` 找到已有记录，恢复状态和身份

### 事件广播
- 创建房间：`room_created`
- 删除房间：`room_deleted`
- 房间更新：`room_update`
- 游戏重置：`room_reset`

### 状态同步
- 前端通过 socket 事件实时同步房间状态
- 后端通过 `broadcastRoomUpdate()` 统一广播更新