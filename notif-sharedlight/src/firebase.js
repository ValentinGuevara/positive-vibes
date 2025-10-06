import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCOfseo4v0dI_hSwJzA0xHFInU89KY51ZI",
  authDomain: "shared-light-29dc5.firebaseapp.com",
  projectId: "shared-light-29dc5",
  storageBucket: "shared-light-29dc5.firebasestorage.app",
  messagingSenderId: "100449386545",
  appId: "1:100449386545:web:4fc00bf79aa4b23b1f5510"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const requestNotificationPermission = async () => {
  try {
    const token = await getToken(messaging, {
      vapidKey: "BLTHoGjmVxyPN6bakDU-AiU9umGfQESCWr5RxRwLIMkh0scSZhilICz5-6cZY9-crBBetQfDuvFPI2LWpj3xN5U",
    });
    console.log("FCM token:", token);
    return token;
  } catch (error) {
    console.error("Permission refusée ou erreur:", error);
  }
};

onMessage(messaging, (payload) => {
  console.log("Message reçu en premier plan:", payload);
});

export { messaging };
