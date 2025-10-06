importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCOfseo4v0dI_hSwJzA0xHFInU89KY51ZI",
  authDomain: "shared-light-29dc5.firebaseapp.com",
  projectId: "shared-light-29dc5",
  storageBucket: "shared-light-29dc5.firebasestorage.app",
  messagingSenderId: "100449386545",
  appId: "1:100449386545:web:4fc00bf79aa4b23b1f5510"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("Message reçu en background:", payload);
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/pwa-192x192.png',
  });
});

messaging.onMessage((payload) => {
  console.log("Message reçu en premier plan dans le SW:", payload);
});
