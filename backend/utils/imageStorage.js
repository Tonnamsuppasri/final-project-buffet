const fs = require('fs');
const path = require('path');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
const SUBFOLDERS = ['menus', 'shop', 'users', 'misc'];

SUBFOLDERS.forEach((folder) => {
  fs.mkdirSync(path.join(UPLOADS_ROOT, folder), { recursive: true });
});

const isUploadPathBuffer = (buf) => {
  if (!buf) return false;
  if (typeof buf === 'string') {
    return buf.startsWith('/uploads/') || buf.startsWith('http://') || buf.startsWith('https://');
  }
  if (Buffer.isBuffer(buf)) {
    const prefix = buf.subarray(0, 16).toString('utf8');
    return prefix.startsWith('/uploads/') || prefix.startsWith('http://') || prefix.startsWith('https://');
  }
  return false;
};

const detectExtension = (buffer) => {
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
    return 'jpg';
  }
  return 'png';
};

/**
 * Resolves a stored DB image value (either a `/uploads/...` path or a legacy LONGBLOB buffer)
 * into a public URL path string, writing legacy BLOBs to disk on demand.
 */
const resolveImage = (bufferOrString, subfolder = 'misc', identifier = 'img') => {
  if (!bufferOrString || bufferOrString.length === 0) return null;

  if (isUploadPathBuffer(bufferOrString)) {
    return Buffer.isBuffer(bufferOrString)
      ? bufferOrString.toString('utf8')
      : bufferOrString;
  }

  if (Buffer.isBuffer(bufferOrString)) {
    const ext = detectExtension(bufferOrString);
    const filename = `${identifier}.${ext}`;
    const folderPath = path.join(UPLOADS_ROOT, subfolder);
    fs.mkdirSync(folderPath, { recursive: true });
    const filePath = path.join(folderPath, filename);

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, bufferOrString);
    }

    return `/uploads/${subfolder}/${filename}`;
  }

  return bufferOrString.toString('base64');
};

/**
 * Saves an incoming base64 image string to `backend/uploads/<subfolder>/`
 * and returns a UTF-8 Buffer of its URL path for compact DB storage.
 */
const saveImage = (base64OrPath, subfolder = 'misc', prefix = 'img') => {
  if (!base64OrPath) return null;

  if (typeof base64OrPath === 'string' && base64OrPath.startsWith('/uploads/')) {
    return Buffer.from(base64OrPath, 'utf8');
  }

  const cleanBase64 = String(base64OrPath).replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  const imgBuffer = Buffer.from(cleanBase64, 'base64');
  if (imgBuffer.length === 0) return null;

  const ext = detectExtension(imgBuffer);
  const filename = `${prefix}_${Date.now()}.${ext}`;
  const folderPath = path.join(UPLOADS_ROOT, subfolder);
  fs.mkdirSync(folderPath, { recursive: true });
  fs.writeFileSync(path.join(folderPath, filename), imgBuffer);

  return Buffer.from(`/uploads/${subfolder}/${filename}`, 'utf8');
};

/**
 * Migrates any legacy binary LONGBLOB images in MySQL to disk files under `uploads/`
 * and replaces the DB column value with the compact `/uploads/...` path string.
 */
const migrateExistingBlobsToDisk = async (db) => {
  try {
    let migratedCount = 0;

    // 1. Menu images
    const [menus] = await db.query('SELECT menu_id, menu_image FROM menu WHERE menu_image IS NOT NULL');
    for (const item of menus) {
      if (Buffer.isBuffer(item.menu_image) && item.menu_image.length > 0 && !isUploadPathBuffer(item.menu_image)) {
        const urlPath = resolveImage(item.menu_image, 'menus', `menu_${item.menu_id}`);
        if (urlPath) {
          await db.query('UPDATE menu SET menu_image = ? WHERE menu_id = ?', [Buffer.from(urlPath, 'utf8'), item.menu_id]);
          migratedCount++;
        }
      }
    }

    // 2. Shop logo & payment QR code
    const [shops] = await db.query('SELECT id, shop_logo, payment_qr_code FROM shop');
    for (const shop of shops) {
      if (Buffer.isBuffer(shop.shop_logo) && shop.shop_logo.length > 0 && !isUploadPathBuffer(shop.shop_logo)) {
        const urlPath = resolveImage(shop.shop_logo, 'shop', 'shop_logo');
        if (urlPath) {
          await db.query('UPDATE shop SET shop_logo = ? WHERE id = ?', [Buffer.from(urlPath, 'utf8'), shop.id]);
          migratedCount++;
        }
      }
      if (Buffer.isBuffer(shop.payment_qr_code) && shop.payment_qr_code.length > 0 && !isUploadPathBuffer(shop.payment_qr_code)) {
        const urlPath = resolveImage(shop.payment_qr_code, 'shop', 'payment_qr');
        if (urlPath) {
          await db.query('UPDATE shop SET payment_qr_code = ? WHERE id = ?', [Buffer.from(urlPath, 'utf8'), shop.id]);
          migratedCount++;
        }
      }
    }

    // 3. User profile images
    const [users] = await db.query('SELECT id, image FROM users WHERE image IS NOT NULL');
    for (const user of users) {
      if (Buffer.isBuffer(user.image) && user.image.length > 0 && !isUploadPathBuffer(user.image)) {
        const urlPath = resolveImage(user.image, 'users', `user_${user.id}`);
        if (urlPath) {
          await db.query('UPDATE users SET image = ? WHERE id = ?', [Buffer.from(urlPath, 'utf8'), user.id]);
          migratedCount++;
        }
      }
    }

    if (migratedCount > 0) {
      console.log(`🖼️ Migrated ${migratedCount} legacy BLOB image(s) to disk under /uploads`);
    }
  } catch (err) {
    console.warn('⚠️ Image BLOB migration skipped or failed:', err.message);
  }
};

module.exports = {
  UPLOADS_ROOT,
  isUploadPathBuffer,
  resolveImage,
  saveImage,
  migrateExistingBlobsToDisk
};
