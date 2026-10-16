const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const AVATAR_DIR = path.resolve(process.env.AVATAR_DIR || path.join(__dirname, '../../uploads/avatars'));
const MAX_BYTES = 400 * 1024;
const STORED_NAME = /^[0-9]+-[a-f0-9]{16}\.(jpg|png|webp)$/;

function avatarError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function detectImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', type: 'image/jpeg' };
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { ext: 'png', type: 'image/png' };
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', type: 'image/webp' };
  }
  return null;
}

function decodeAvatarPayload(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw avatarError('请选择一张图片');
  }
  if (input.length > 800000) {
    throw avatarError('图片太大，请换一张小一些的');
  }
  const payload = input.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s/g, '');
  const buffer = Buffer.from(payload, 'base64');
  if (!buffer.length || buffer.length > MAX_BYTES) {
    throw avatarError('图片太大，请换一张小一些的');
  }
  const kind = detectImage(buffer);
  if (!kind) {
    throw avatarError('只支持 JPG、PNG 或 WebP');
  }
  return { buffer, kind };
}

async function saveUserAvatar(userId, input) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) throw avatarError('用户无效');
  const { buffer, kind } = decodeAvatarPayload(input);
  await fs.mkdir(AVATAR_DIR, { recursive: true });
  const filename = `${id}-${crypto.randomBytes(8).toString('hex')}.${kind.ext}`;
  const fullPath = path.join(AVATAR_DIR, filename);
  if (!fullPath.startsWith(AVATAR_DIR + path.sep)) throw avatarError('头像保存失败');
  await fs.writeFile(fullPath, buffer);
  return `/api/avatars/${filename}`;
}

async function removeStoredAvatar(url) {
  if (typeof url !== 'string' || !url.startsWith('/api/avatars/')) return;
  const filename = path.basename(url);
  if (!STORED_NAME.test(filename)) return;
  const fullPath = path.join(AVATAR_DIR, filename);
  if (!fullPath.startsWith(AVATAR_DIR + path.sep)) return;
  await fs.unlink(fullPath).catch(() => {});
}

module.exports = {
  AVATAR_DIR,
  detectImage,
  decodeAvatarPayload,
  saveUserAvatar,
  removeStoredAvatar,
};
