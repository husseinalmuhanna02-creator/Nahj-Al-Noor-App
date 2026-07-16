const admin = require('firebase-admin');

// المبادرة بـ Firebase Admin
// تأكد من إضافة المتغيرات البيئية في Vercel
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // معالجة السطور الجديدة في المفتاح الخاص
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      }),
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

const db = admin.firestore();

module.exports = async (req, res) => {
  // يجب أن يكون الطلب POST من تلجرام
  if (req.method !== 'POST') {
    return res.status(200).send('Nahj al-Nur Bot is running!');
  }

  const { message } = req.body;

  // التحقق من أن الرسالة هي رد (Reply) على رسالة سابقة
  if (!message || !message.reply_to_message) {
    return res.status(200).send('OK');
  }

  const replyToId = message.reply_to_message.message_id.toString();
  const answerText = message.text;
  const userId = message.from.id;
  const chatId = message.chat.id;

  // إذا لم يكن هناك نص في الرد (مثلاً ملصق أو صورة فقط)
  if (!answerText) {
    return res.status(200).send('OK');
  }

  try {
    // التحقق من رتبة المستخدم في المجموعة
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
    const checkUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${chatId}&user_id=${userId}`;
    const axios = require('axios');
    const { data: memberStatus } = await axios.get(checkUrl);

    if (!memberStatus.ok || !['creator', 'administrator'].includes(memberStatus.result.status)) {
      console.log(`Unauthorized reply from user ${userId} status: ${memberStatus.result?.status}`);
      return res.status(200).send('Unauthorized');
    }

    // البحث عن السؤال المرتبط بالـ telegramMessageId
    const querySnapshot = await db.collection('fatwa_questions')
      .where('telegramMessageId', '==', replyToId)
      .limit(1)
      .get();

    if (!querySnapshot.empty) {
      const questionDoc = querySnapshot.docs[0];
      
      // تحديث المستند بالإجابة وتغيير الحالة
      await questionDoc.ref.update({
        answer: answerText,
        status: 'answered',
        answeredAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Successfully updated question ${questionDoc.id} with answer.`);
    } else {
      console.log(`No question found with telegramMessageId: ${replyToId}`);
    }
  } catch (error) {
    console.error('Error updating Firestore:', error);
  }

  // دائماً نرد بـ 200 لتجنب إعادة إرسال الـ Webhook من تلجرام
  res.status(200).send('OK');
};
