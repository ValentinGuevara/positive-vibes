import { useEffect, useState } from 'react'
import { requestNotificationPermission } from "./firebase"
import Lottie from "lottie-react"
import animationData from './assets/wellbeing.json';
import animationLoading from './assets/loading.json';
import { Sheet } from 'react-modal-sheet';
import './App.css'

function App() {
  const [isOpen, setOpen] = useState(false);
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);

  const [showSheet, setShowSheet] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [inStandalone, setInStandalone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activated, setActivated] = useState(false);
  const [loading, setLoading] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const handleActivate = async () => {
    try {
      setLoading(true);
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
            localStorage.setItem("fcm_token", fcmToken);
            setActivated(true);
          } catch (err) {
            console.error("❌ Erreur POST:", err);
            setError("Erreur lors de l'enregistrement du token.");
            setActivated(false);
          }
      } else {
        setError("Permission refusée ou aucune clé obtenue.");
      }
    } catch (err) {
      setError("Erreur : " + err.message);
    }
    setLoading(false);
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

    const cachedToken = localStorage.getItem("fcm_token");
    if (cachedToken) {
      console.log("📦 Token trouvé dans le cache :", cachedToken);
      setToken(cachedToken);
      setActivated(true);
    }
  }, []);

  return (
    <>
      <div className='flex flex-col items-center justify-between min-h-screen pb-24 pt-12'>
        <div className='flex flex-col items-center justify-center space-y-16'>
          <h1 className='font-wellbeing text-xxl tracking-wider'>🍀 Partageons nos bonnes ondes 🪴</h1>

          <div className="w-64 h-64 flex items-center justify-center">
            <Lottie animationData={animationData} />
          </div>
        </div>

        {
          loading  ? (<div className='p-2 rounded-xl' style={{ backgroundColor: 'rgba(242,242,242,1)' }}><div className="w-12 h-12 flex items-center justify-center bg-white rounded-full">
              <Lottie animationData={animationLoading} autoPlay />
            </div></div>)
          : (<button className={`bg-green-600 hover:bg-green-800 tracking-wide focus:outline-2 focus:outline-offset-2 focus:outline-green-600 border-0 rounded-md px-3 py-2 text-sm font-semibold text-white transition cursor-pointer ${activated && "opacity-40"}`} disabled={activated} onClick={() => {
          if(isIos && !inStandalone) {
            setShowSheet(true);
            setOpen(true);
          } else {
            handleActivate();
          }
        }}>
          <span>{ !activated ? "Activer les notifications" : "En symbiose" }</span>         
        </button>)
        }
      </div>

      <Sheet detent='content' isOpen={isOpen} onClose={() => setOpen(false)}>
        <Sheet.Container unstyled className='bg-green-600'>
          <Sheet.Header className='bg-green-600' />
          <Sheet.Content>
            <div className='flex flex-col items-center justify-center space-y-4 pb-8 text-center text-white-400 bg-green-600 trackind-wide'>
              <p className='font-semibold underline underline-offset-4'>
                Pour les notifications sur iPhone
              </p>
              <p>
                Appuyez sur <strong>Partager → Sur l’écran d’accueil</strong> dans <strong>Safari</strong>.
              </p>
              <button
                onClick={copyUrl}
                className="px-4 py-2 bg-green-100 text-white rounded-lg transition cursor-pointer outline-1 outline-neutral-900"
              >
                <span className='text-neutral-900 font-semibold'>{copied ? "Copié!" : "📋​ Copier URL"}</span>
              </button>
            </div>
          </Sheet.Content>
        </Sheet.Container>
        <Sheet.Backdrop />
      </Sheet>
    </>
  )
}

export default App
