const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!raw) {
  console.error('خطأ: متغيّر FIREBASE_SERVICE_ACCOUNT_KEY غير موجود.');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(raw);
} catch (e) {
  console.error('خطأ: محتوى FIREBASE_SERVICE_ACCOUNT_KEY ليس JSON صالحاً.', e.message);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const OUT_DIR = path.join(__dirname, '..', 'data');
const BIZ_DIR = path.join(OUT_DIR, 'biz');
const VERSION_FILE = path.join(OUT_DIR, 'version.json');
const VERSION_DOC = '__meta_data_version';

function readPrevVersion() {
  try {
    const parsed = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
    return parsed.version || null;
  } catch (e) {
    return null;
  }
}

async function main() {
  const versionDoc = await db.collection('kv').doc(VERSION_DOC).get();
  const currentVersion = versionDoc.exists ? (versionDoc.data().version || null) : null;
  const prevVersion = readPrevVersion();

  if (currentVersion !== null && prevVersion !== null && currentVersion === prevVersion) {
    console.log('لا يوجد تغيير بالبيانات منذ آخر تصدير — تخطّي.');
    return;
  }

  fs.mkdirSync(BIZ_DIR, { recursive: true });

  const snapshot = await db.collection('kv').get();
  let sectionsFound = false;
  let indexFound = false;
  let bizCount = 0;
  const seenBizFiles = new Set();

  snapshot.forEach((doc) => {
    const id = doc.id;
    const data = doc.data();
    const value = data.value;
    if (value === undefined) return;

    if (id === 'sections') {
      fs.writeFileSync(path.join(OUT_DIR, 'sections.json'), value);
      sectionsFound = true;
    } else if (id === 'businesses-index') {
      fs.writeFileSync(path.join(OUT_DIR, 'businesses-index.json'), value);
      indexFound = true;
    } else if (id.startsWith('biz:')) {
      const bizId = id.slice(4);
      const fileName = encodeURIComponent(bizId) + '.json';
      fs.writeFileSync(path.join(BIZ_DIR, fileName), value);
      seenBizFiles.add(fileName);
      bizCount++;
    }
  });

  if (fs.existsSync(BIZ_DIR)) {
    for (const f of fs.readdirSync(BIZ_DIR)) {
      if (!seenBizFiles.has(f)) fs.unlinkSync(path.join(BIZ_DIR, f));
    }
  }

  fs.writeFileSync(
    VERSION_FILE,
    JSON.stringify({ version: currentVersion, exportedAt: new Date().toISOString() }, null, 2)
  );

  console.log(`تم التصدير — sections: ${sectionsFound}, index: ${indexFound}, منشآت: ${bizCount}`);
}

main().catch((err) => {
  console.error('فشل التصدير:', err);
  process.exit(1);
});
