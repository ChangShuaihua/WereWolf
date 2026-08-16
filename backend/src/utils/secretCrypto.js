const crypto = require('crypto');

const PREFIX = 'enc:v1:';

function getEncryptionKey() {
  const secret = process.env.LLM_CONFIG_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('LLM_CONFIG_ENCRYPTION_KEY or JWT_SECRET is required');
  }
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

function encryptSecret(value) {
  if (!value || value.startsWith(PREFIX)) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

function decryptSecret(value) {
  if (!value || !value.startsWith(PREFIX)) return value || '';

  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted secret format');

  const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

module.exports = { encryptSecret, decryptSecret };
