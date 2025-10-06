// index.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const registrationToken = "eWOdNGV5HvYHluiTcLlIe5:APA91bFtXab-ySHyDyivPQ2dCz427AZb9q7ujs667_-OdDwyH5P4nC7fY_VIsHBFjhy2s0e5rAXD56ZMdGERCH-bCKaijYsn_iVD6nEVnwfKAlCjMd5jTI8";

const message = {
  token: registrationToken,
  notification: {
    title: '🚀 Test Notification',
    body: 'Hello depuis Node.js et Firebase Admin!',
  },
  webpush: {
    fcmOptions: {
      link: 'https://google.com',
    },
  },
};

admin.messaging().send(message)
  .then((response) => {
    console.log('✅ Notification envoyée avec succès:', response);
  })
  .catch((error) => {
    console.error('❌ Erreur lors de l’envoi:', error);
  });
