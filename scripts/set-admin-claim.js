// سكربت لمرة واحدة: يمنح صلاحية "admin: true" (custom claim) لحساب مسؤول محدد بالبريد الإلكتروني.
// يشتغل فقط يدوياً عبر GitHub Actions (workflow_dispatch)، باستخدام نفس مفتاح حساب الخدمة
// المخزّن كسرّ FIREBASE_SERVICE_ACCOUNT_KEY.

const admin = require('firebase-admin');

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const email = process.env.ADMIN_EMAIL;

if (!raw) {
  console.error('خطأ: متغيّر FIREBASE_SERVICE_ACCOUNT_KEY غير موجود.');
  process.exit(1);
}
if (!email) {
  console.error('خطأ: لازم تمرّر البريد الإلكتروني عبر مدخل (input) اسمه admin_email عند تشغيل الـAction.');
  process.exit(1);
}

const serviceAccount = JSON.parse(raw);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function main() {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  console.log(`تم منح صلاحية admin:true للحساب: ${email} (uid: ${user.uid})`);
  console.log('ملاحظة: لازم يسجّل خروج ثم دخول من جديد (أو تسجّل الخروج فعلياً) عشان يحصل على توكن محدّث فيه الصلاحية الجديدة.');
}

main().catch((err) => {
  console.error('فشلت العملية:', err.message);
  process.exit(1);
});
