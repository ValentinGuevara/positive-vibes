import { useState } from 'react'
import { requestNotificationPermission } from "./firebase"
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);

    const handleActivate = async () => {
    try {
      const fcmToken = await requestNotificationPermission();
      if (fcmToken) {
        setToken(fcmToken);
      } else {
        setError("Permission refusée ou aucune clé obtenue.");
      }
    } catch (err) {
      setError("Erreur : " + err.message);
    }
  };

  return (
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
  )
}

export default App
