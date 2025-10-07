import { useEffect, useState } from 'react'
import { requestNotificationPermission } from "./firebase"
import { Sheet } from 'react-modal-sheet';
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  const [isOpen, setOpen] = useState(false);
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);

  const [showSheet, setShowSheet] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [inStandalone, setInStandalone] = useState(false);

  const handleActivate = async () => {
    try {
      const fcmToken = await requestNotificationPermission();
      if (fcmToken) {
        setToken(fcmToken);
        setShowSheet(false);
        const apiUrl = import.meta.env.VITE_API_URL;
        const apiKey = import.meta.env.VITE_API_KEY;


          const payload = {
            token: fcmToken
          };

          try {
            const response = await fetch(apiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
              },
              body: JSON.stringify(payload),
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log("✅ Réponse API:", data);
          } catch (err) {
            console.error("❌ Erreur POST:", err);
          }
      } else {
        setError("Permission refusée ou aucune clé obtenue.");
      }
    } catch (err) {
      setError("Erreur : " + err.message);
    }
  };

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    const standalone = "standalone" in window.navigator && window.navigator.standalone;

    setIsIos(ios);
    setInStandalone(standalone);

    if (ios && !standalone) {
      setShowSheet(true);
    }
  }, []);

  return (
    <>
      <div style={{ textAlign: "center", marginTop: "3rem" }}>
        <h1>🔥 Notifications Firebase PWA</h1>

        {!token && (
          <button
            onClick={handleActivate}
            style={{
              padding: "12px 24px",
              borderRadius: "12px",
              border: "none",
              backgroundColor: "#0d9488",
              color: "#fff",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            Activer les notifications
          </button>
        )}

        {token && (
          <>
            <p>✅ Notifications activées !</p>
            <textarea
              readOnly
              value={token}
              style={{
                width: "90%",
                height: "100px",
                marginTop: "1rem",
                fontSize: "12px",
              }}
            />
          </>
        )}

        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
      <button onClick={() => setOpen(true)}>Open sheet</button>

      <Sheet detent='content' isOpen={isOpen} onClose={() => setOpen(false)}>
        <Sheet.Container>
          <Sheet.Header />
          <Sheet.Content>
            {isIos && !inStandalone ? (
              <p>
                Pour installer la PWA sur iOS, appuyez sur <strong>Partager → Sur l’écran d’accueil</strong> dans Safari.
              </p>
            ) : (
              <>
                <p>Activez les notifications pour rester informé !</p>
                <button onClick={handleActivate}>
                  🔔 Activer les notifications
                </button>
              </>
            )}
          </Sheet.Content>
        </Sheet.Container>
        <Sheet.Backdrop />
      </Sheet>
    </>
  )
}

export default App
