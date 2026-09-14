/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { invoke } from "@tauri-apps/api/core";
import { listen } from '@tauri-apps/api/event';
import "./App.css"

import PlatsList from './PlatsList';

// ============ TYPES ============
import {
  getCurrent,
  onOpenUrl,
} from "@tauri-apps/plugin-deep-link";

import FactureTest from './FactureTest';

import UpdateNotification from './UpdateNotification';


interface SystemInfo {
  os_name: string;
  os_version: string;
  host_name: string;
  cpu_name: string;
  cpu_cores: number;
  total_memory: number;
  used_memory: number;
  internet_available: boolean;
  local_ip: string;
  public_ip: string | null;
}

interface NetworkInfo {
  internet_available: boolean;
  local_ip: string;
  public_ip: string | null;
}



// ============ COMPOSANT PRINCIPAL ============

function App() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [internetStatus, setInternetStatus] = useState<boolean | null>(null);


  // ===== DEMANDER LES PERMISSIONS =====



  useEffect(() => {
    const handleInitialDeepLink = async (): Promise<void> => {
      try {
        const urls = await getCurrent();

        if (!urls || urls.length === 0) {
          return;
        }

        console.log(
          "🔗 Deep link initial :",
          urls
        );

        for (const url of urls) {
          if (url.startsWith("kumeza://")) {
            alert(
              `🚀 Ku Meza lancé avec :",
            ${url}
          `);
          }
        }
      } catch (error) {
        console.error(
          "❌ Erreur deep link initial :",
          error
        );
      }
    };

    void handleInitialDeepLink();
  }, []);
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupDeepLink = async (): Promise<void> => {
      try {
        unlisten = await onOpenUrl(
          async (urls) => {
            console.log(
              "🔗 Deep link reçu :",
              urls
            );

            for (const url of urls) {
              if (url.startsWith("kumeza://")) {
                // await focusKuMeza();
              }
            }
          }
        );
      } catch (error) {
        console.error(
          "❌ Erreur écoute deep link :",
          error
        );
      }
    };

    void setupDeepLink();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);
  // ===== ÉCOUTER LES ÉVÉNEMENTS =====
  useEffect(() => {
    const setupListeners = async () => {
      // Écouter les changements de statut Internet
      const unlistenInternet = await listen<boolean>('internet-status', (event) => {
        setInternetStatus(event.payload);

        // Rafraîchir les informations système
        invoke<SystemInfo>("get_system_info")
          .then((info) => setSystemInfo(info))
          .catch(console.error);
      });


      return () => {
        if (unlistenInternet) {
          unlistenInternet();
        }

      };
    };

    setupListeners();
  }, []);

  // ===== CHARGEMENT INITIAL =====
  useEffect(() => {
    invoke<SystemInfo>("get_system_info")
      .then((info) => {
        setSystemInfo(info);
        setInternetStatus(info.internet_available);
      })
      .catch((error) => console.error("Erreur get_system_info:", error));

    invoke<NetworkInfo>("check_network_status")
      .then((info) => {
        console.log("Network info:", info);
        setNetworkInfo(info);
      })
      .catch((error) => console.error("Erreur check_network_status:", error));
  }, []);


  // ============ FONCTIONS DE TEST DE NOTIFICATION ============



  const envoyerNotification = async (
    title: string,
    body: string
  ): Promise<void> => {
    try {
      await invoke("send_native_notification", {
        title,
        body,
      });
    } catch (error) {
      console.error("Erreur notification Windows :", error);
    }
  };



  const testNotification = async (): Promise<void> => {
    await envoyerNotification("🔔 Ku Meza", "Une nouvelle commande vient d'arriver.");
  };

  // ============ RENDU ============

  return (
    <div style={{
      padding: '2px',
      fontFamily: 'Arial, sans-serif',
      margin: '0 auto',
      minHeight: '100vh',
      background: '#1a1a2e',
      color: '#e0e0e0'
    }}>
      <button onClick={testNotification}>
        🔔 Tester la notification Windows
      </button>
      <UpdateNotification />
      <div>
        <FactureTest />
      </div>
      <div><PlatsList /></div>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        * {
          scrollbar-width: thin;
          scrollbar-color: #4a4a6a #2a2a4a;
        }
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #2a2a4a;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb {
          background: #4a4a6a;
          border-radius: 4px;
        }
      `}</style>



      {/* ===== STATUT INTERNET ===== */}
      <div style={{
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '20px',
        background: internetStatus === null ? '#2a2a4a' : internetStatus ? '#1b3a2a' : '#3a1a1a',
        border: internetStatus === null ? '1px solid #4a4a6a' : internetStatus ? '1px solid #4caf50' : '1px solid #f44336',
        transition: 'all 0.3s ease'
      }}>
        <h2 style={{ color: '#e0e0e0' }}>🌐 Statut Internet</h2>
        <p style={{
          fontSize: '18px',
          fontWeight: 'bold',
          color: internetStatus === null ? '#888' : internetStatus ? '#81c784' : '#e57373'
        }}>
          {internetStatus === null ? '⏳ Vérification...' : internetStatus ? '✅ Connecté' : '❌ Déconnecté'}
        </p>
        <p style={{ fontSize: '14px', color: '#b0b0b0' }}>
          {internetStatus ? 'La connexion Internet est active.' : 'Vérifiez votre connexion réseau.'}
        </p>
      </div>

      <h1 style={{ color: '#e0e0e0' }}>📊 Informations Système</h1>

      {systemInfo && (
        <div>
          <div style={{
            padding: '15px',
            background: '#16213e',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #2a3a6a'
          }}>
            <h2 style={{ color: '#8ab4f8' }}>🖥️ Système</h2>
            <p style={{ color: '#b0b0b0' }}><strong style={{ color: '#888' }}>OS:</strong> {systemInfo.os_name} {systemInfo.os_version}</p>
            <p style={{ color: '#b0b0b0' }}><strong style={{ color: '#888' }}>Hôte:</strong> {systemInfo.host_name}</p>
          </div>

          <div style={{
            padding: '15px',
            background: '#16213e',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #2a5a3a'
          }}>
            <h2 style={{ color: '#81c784' }}>⚡ Processeur</h2>
            <p style={{ color: '#b0b0b0' }}><strong style={{ color: '#888' }}>CPU:</strong> {systemInfo.cpu_name}</p>
            <p style={{ color: '#b0b0b0' }}><strong style={{ color: '#888' }}>Cœurs:</strong> {systemInfo.cpu_cores}</p>
          </div>

          <div style={{
            padding: '15px',
            background: '#16213e',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #6a4a2a'
          }}>
            <h2 style={{ color: '#ffb74d' }}>💾 Mémoire</h2>
            <p style={{ color: '#b0b0b0' }}><strong style={{ color: '#888' }}>Total:</strong> {(systemInfo.total_memory / 1024 / 1024 / 1024).toFixed(2)} GB</p>
            <p style={{ color: '#b0b0b0' }}><strong style={{ color: '#888' }}>Utilisée:</strong> {(systemInfo.used_memory / 1024 / 1024 / 1024).toFixed(2)} GB</p>
            <p style={{ color: '#b0b0b0' }}><strong style={{ color: '#888' }}>Libre:</strong> {((systemInfo.total_memory - systemInfo.used_memory) / 1024 / 1024 / 1024).toFixed(2)} GB</p>
          </div>

          <div style={{
            padding: '15px',
            background: '#16213e',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #2a4a6a'
          }}>
            <h2 style={{ color: '#64b5f6' }}>🌐 Réseau</h2>
            <p style={{ color: '#b0b0b0' }}>🌐 <strong style={{ color: '#888' }}>Internet disponible:</strong> {
              systemInfo.internet_available ? '✅ Oui' : '❌ Non'
            }</p>
            <p style={{ color: '#b0b0b0' }}>🏠 <strong style={{ color: '#888' }}>IP Locale:</strong> {systemInfo.local_ip}</p>
            <p style={{ color: '#b0b0b0' }}>🌍 <strong style={{ color: '#888' }}>IP Publique:</strong> {systemInfo.public_ip || 'Non disponible'}</p>
          </div>
        </div>
      )}

      {networkInfo && (
        <div style={{
          padding: '15px',
          background: '#16213e',
          borderRadius: '8px',
          marginTop: '20px',
          border: '1px solid #3a3a5a'
        }}>
          <h2 style={{ color: '#64b5f6' }}>📡 Informations Réseau Détaillées</h2>
          <p style={{ color: '#b0b0b0' }}>🌐 <strong style={{ color: '#888' }}>Internet disponible:</strong> {
            networkInfo.internet_available ? '✅ Oui' : '❌ Non'
          }</p>
          <p style={{ color: '#b0b0b0' }}>🏠 <strong style={{ color: '#888' }}>IP Locale:</strong> {networkInfo.local_ip}</p>
          <p style={{ color: '#b0b0b0' }}>🌍 <strong style={{ color: '#888' }}>IP Publique:</strong> {networkInfo.public_ip || 'Non disponible'}</p>
        </div>
      )}





      {/* ============ DEBUG ============ */}
      <div style={{
        marginTop: '30px',
        padding: '15px',
        background: '#0d0d1a',
        color: '#888',
        borderRadius: '8px',
        fontSize: '12px',
        fontFamily: 'monospace',
        border: '1px solid #2a2a4a'
      }}>
        <h3 style={{ color: '#666' }}>🔧 Debug</h3>
        <details>
          <summary style={{ cursor: 'pointer', color: '#4a4a8a' }}>Afficher les données</summary>
          <div style={{ marginTop: '10px' }}>
            <pre style={{ color: '#888' }}>{JSON.stringify(systemInfo, null, 2)}</pre>
          </div>
        </details>
      </div>
    </div>
  )
}

export default App