// Game phase constants
const PHASE = {
  WAITING: 'WAITING',
  NIGHT: 'NIGHT',
  DAY: 'DAY',
  VOTE: 'VOTE',
  END: 'END',
};

// Role constants
const ROLE = {
  WEREWOLF: 'werewolf',
  VILLAGER: 'villager',
  SEER: 'seer',
  WITCH: 'witch',
  HUNTER: 'hunter',
  GUARD: 'guard',
};

// Phase timers (seconds)
const TIMERS = {
  NIGHT: 25,
  DAY: 60,
  VOTE: 30,
  END: 15,
};

// Role display names
const ROLE_NAMES = {
  werewolf: '狼人',
  villager: '村民',
  seer: '预言家',
  witch: '女巫',
  hunter: '猎人',
  guard: '守卫',
};

// Which team each role belongs to
const TEAM = {
  werewolf: 'werewolf',
  villager: 'villager',
  seer: 'villager',
  witch: 'villager',
  hunter: 'villager',
  guard: 'villager',
};

// Supported game modes
const GAME_MODES = [6, 8, 12];

// Role distribution by player count (only 6, 8, 12 supported)
const ROLE_DISTRIBUTION = {
  6: ['werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'villager'],
  8: ['werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'guard', 'villager', 'villager'],
  12: ['werewolf', 'werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'guard', 'hunter', 'villager', 'villager', 'villager', 'villager'],
};

module.exports = { PHASE, ROLE, TIMERS, ROLE_NAMES, TEAM, ROLE_DISTRIBUTION, GAME_MODES };
