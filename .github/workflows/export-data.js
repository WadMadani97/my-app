// يقرأ بيانات "دليل ود مدني" من Firestore ويصدّرها كملفات JSON ثابتة تحت مجلد data/.
// الهدف: الزوار العاديين يقرؤون هذي الملفات مباشرة من GitHub Pages بدل الاتصال بـFirestore،
// وبالتالي زيارات الموقع ما تستهلك أي شيء تقريباً من حصة Firestore المجانية اليومية.
//
// يشتغل هذا السكربت فقط عبر GitHub Actions (انظر .github/workflows/export-data.yml)،
// باستخدام مفتاح حساب خدمة Firebase (Service Account) المخزّن كسرّ GitHub باسم
// FIREBASE_SERVICE_ACCOUNT_KEY. لا يُكتب أي مفتاح أو رمز سري داخل هذا الملف نفسه.

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!raw) {
  console.error('خطأ: متغيّر FIREBASE_SERVICE_ACCOUNT_KEY غير موجود. أضفه كسرّ (Secret) بمستودع GitHub.');
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
    return null; // أول تصدير على الإطلاق، أو الملف تالف/غير موجود
  }
}

async function main() {
  const versionDoc = await db.collection('kv').doc(VERSION_DOC).get();
  const currentVersion = versionDoc.exists ? (versionDoc.data().version || null) : null;
  const prevVersion = readPrevVersion();

  // لو الإصدار نفسه ما تغيّر منذ آخر تصدير، نتوقف بدون كتابة أي ملف —
  // يمنع commits فارغة متكررة من الجدولة التلقائية كل ما ما فيه تعديل فعلي.
  if (currentVersion !== null && prevVersion !== null && currentVersion === prevVersion) {
    console.log('لا يوجد تغيير بالبيانات منذ آخر تصدير (الإصدار: ' + currentVersion + ') — تخطّي.');
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
    const value = data.value; // مخزّن كنص JSON بواسطة sSet() بكود الموقع
    if (value === undefined) return; // مستند غير متوقع (مثلاً __meta_data_version)، تجاهله بأمان

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

  // حذف ملفات منشآت قديمة حُذفت من Firestore ولم تعد موجودة، حتى لا تبقى يتيمة على الموقع.
  if (fs.existsSync(BIZ_DIR)) {
    for (const f of fs.readdirSync(BIZ_DIR)) {
      if (!seenBizFiles.has(f)) fs.unlinkSync(path.join(BIZ_DIR, f));
    }
  }

  fs.writeFileSync(
    VERSION_FILE,
    JSON.stringify({ version: currentVersion, exportedAt: new Date().toISOString() }, null, 2)
  );

  console.log(
    `تم التصدير بنجاح — sections: ${sectionsFound ? 'نعم' : 'لا'}, businesses-index: ${indexFound ? 'نعم' : 'لا'}, عدد المنشآت: ${bizCount}`
  );
}

main().catch((err) => {
  console.error('فشل التصدير:', err);
  process.exit(1);
});
