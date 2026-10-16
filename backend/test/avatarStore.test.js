const test = require('node:test');
const assert = require('node:assert/strict');
const { detectImage, decodeAvatarPayload } = require('../src/utils/avatarStore');

test('avatar payload accepts a real jpeg and rejects other files', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(detectImage(jpeg).ext, 'jpg');
  const decoded = decodeAvatarPayload(`data:image/jpeg;base64,${jpeg.toString('base64')}`);
  assert.equal(decoded.kind.type, 'image/jpeg');

  assert.equal(detectImage(Buffer.from('<svg></svg>')), null);
  assert.throws(() => decodeAvatarPayload(Buffer.from('not-an-image').toString('base64')), /JPG、PNG 或 WebP/);
});
