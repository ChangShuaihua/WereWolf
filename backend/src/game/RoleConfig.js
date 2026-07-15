const { ROLE_DISTRIBUTION, ROLE_NAMES } = require('./constants');

/**
 * Get role list for given player count.
 * Returns a shuffled copy.
 */
function getRolesForGame(playerCount) {
  const roles = ROLE_DISTRIBUTION[playerCount];
  if (!roles) {
    // Fallback for unsupported counts
    const werewolves = Math.floor(playerCount / 3);
    const specials = Math.min(4, playerCount - werewolves - 1);
    const villagers = playerCount - werewolves - specials;
    const allRoles = [
      ...Array(werewolves).fill('werewolf'),
      'seer', 'witch', 'guard', 'hunter',
      ...Array(Math.max(1, villagers)).fill('villager'),
    ].slice(0, playerCount);
    return shuffle(allRoles);
  }
  return shuffle([...roles]);
}

/**
 * Fisher-Yates shuffle
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Get a human-readable role name
 */
function getRoleName(role) {
  return ROLE_NAMES[role] || role;
}

module.exports = { getRolesForGame, shuffle, getRoleName };
