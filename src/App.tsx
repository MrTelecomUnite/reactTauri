/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { invoke } from "@tauri-apps/api/core";
import { listen } from '@tauri-apps/api/event';
import "./App.css"
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import PlatsList from './PlatsList';

// ============ TYPES ============

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


interface NotificationPayload {
  title: string;
  message: string;
  notification_type: 'success' | 'error' | 'warning' | 'info';
}

// ============ COMPOSANT PRINCIPAL ============

function App() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [internetStatus, setInternetStatus] = useState<boolean | null>(null);
  const [notificationTestStatus, setNotificationTestStatus] = useState<string>('');
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);


  // ===== DEMANDER LES PERMISSIONS =====
  useEffect(() => {
    const setupPermissions = async () => {
      try {
        let granted = await isPermissionGranted();
        console.log('Permission initiale:', granted);

        if (!granted) {
          const permission = await requestPermission();
          granted = permission === 'granted';
          console.log('Permission après demande:', granted);
        }

        setPermissionGranted(granted);
        setNotificationTestStatus(
          granted ? '✅ Permissions accordées ✅' : '❌ Permissions refusées ❌'
        );

        // Test de notification au démarrage (sans catch car sendNotification retourne void)
        if (granted) {
          sendNotification({
            title: '🔔 Notifications activées',
            body: 'Les notifications système sont prêtes !',
            sound: "notification_sound.wav"
          });
        }
      } catch (error) {
        console.error('Erreur de permission:', error);
        setNotificationTestStatus('❌ Erreur de permission');
      }
    };
    setupPermissions();
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

      // Écouter les notifications réseau
      const unlistenNotification = await listen<NotificationPayload>('network-notification', (event) => {
        const { title, message } = event.payload;

        // === NOTIFICATION SYSTÈME UNIQUEMENT ===
        if (permissionGranted) {
          sendNotification({
            title: title,
            body: message,
            sound: "notification_sound.wav"
          });
        } else {
          console.warn('Permissions non accordées, notification non envoyée');
        }
      });

      return () => {
        if (unlistenInternet) {
          unlistenInternet();
        }
        if (unlistenNotification) {
          unlistenNotification();
        }
      };
    };

    setupListeners();
  }, [permissionGranted]);

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

  // ============ FONCTIONS POUR LES IMPRIMANTES ============


  // ============ FONCTIONS DE TEST DE NOTIFICATION ============

  const testNotification = async (type: 'success' | 'error' | 'warning' | 'info') => {
    const messages = {
      success: { title: '✅ Succès !', message: 'La notification de succès fonctionne parfaitement.' },
      error: { title: '❌ Erreur !', message: 'Ceci est une notification d\'erreur de test.' },
      warning: { title: '⚠️ Attention !', message: 'Ceci est une notification d\'avertissement.' },
      info: { title: 'ℹ️ Information', message: 'Ceci est une notification d\'information.' },
    };

    const { title, message } = messages[type];

    // Vérifier les permissions avant d'envoyer
    if (!permissionGranted) {
      alert('⚠️ Permissions non accordées. Demande en cours...');
      try {
        const newPermission = await requestPermission();
        const granted = newPermission === 'granted';
        setPermissionGranted(granted);
        setNotificationTestStatus(granted ? '✅ Permissions accordées ✅' : '❌ Permissions refusées ❌');

        if (!granted) {
          alert('❌ Permission refusée par l\'utilisateur');
          return;
        }
      } catch (error) {
        alert(`Erreur lors de la demande de permission:, ${error}`);
        return;
      }
    }

    try {
      console.log(`📤 Envoi notification ${type}:`, { title, message });

      // sendNotification retourne void, pas de catch
      sendNotification({
        title: title,
        body: message,
        sound: "notification_sound.wav"
      });

      console.log(`✅ Notification ${type} envoyée avec succès`);

      // Afficher un message de succès
      setNotificationTestStatus(`✅ Notification "${title}" envoyée !`);
      setTimeout(() => {
        setNotificationTestStatus(permissionGranted ? '✅ Permissions accordées ✅' : '❌ Permissions refusées ❌');
      }, 3000);

    } catch (error) {
      console.error(`❌ Erreur lors de l'envoi de la notification ${type}:`, error);
      setNotificationTestStatus(`❌ Erreur: ${error}`);
    }
  };

  const testAllNotifications = async () => {
    const types: ('success' | 'error' | 'warning' | 'info')[] = ['success', 'info', 'warning', 'error'];

    if (!permissionGranted) {
      try {
        const newPermission = await requestPermission();
        const granted = newPermission === 'granted';
        setPermissionGranted(granted);
        setNotificationTestStatus(granted ? '✅ Permissions accordées ✅' : '❌ Permissions refusées ❌');

        if (!granted) {
          console.error('❌ Permission refusée');
          return;
        }
      } catch (error) {
        console.error('Erreur:', error);
        return;
      }
    }

    setNotificationTestStatus('⏳ Envoi des notifications en cours...');

    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const messages = {
        success: { title: '✅ Succès !', message: `Notification ${i + 1}/${types.length}` },
        error: { title: '❌ Erreur !', message: `Notification ${i + 1}/${types.length}` },
        warning: { title: '⚠️ Attention !', message: `Notification ${i + 1}/${types.length}` },
        info: { title: 'ℹ️ Information', message: `Notification ${i + 1}/${types.length}` },
      };

      const { title, message } = messages[type];

      try {
        sendNotification({
          title: title,
          body: message,
          sound: 'notification_sound.wav'
        });
        console.log(`✅ Notification ${i + 1}/${types.length} envoyée`);
      } catch (error) {
        console.error(`❌ Erreur notification ${i + 1}:`, error);
      }

      // Attendre entre chaque notification
      if (i < types.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    setNotificationTestStatus('✅ Toutes les notifications ont été envoyées !');
    setTimeout(() => {
      setNotificationTestStatus(permissionGranted ? '✅ Permissions accordées ✅' : '❌ Permissions refusées ❌');
    }, 3000);
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

      {/* ===== STATUT DES PERMISSIONS ===== */}
      <div style={{
        padding: '15px',
        background: permissionGranted ? '#1b3a2a' : '#3a1a1a',
        borderRadius: '8px',
        marginBottom: '20px',
        border: permissionGranted ? '2px solid #4caf50' : '2px solid #f44336'
      }}>
        <h3 style={{ color: '#e0e0e0' }}>🔔 Statut des notifications système</h3>
        <p style={{ margin: 0, color: '#b0b0b0', fontSize: '18px' }}>
          <strong>{notificationTestStatus}</strong>
        </p>
        <p style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
          {permissionGranted
            ? '✅ Les notifications apparaîtront dans le centre de notification'
            : '❌ Cliquez sur "Tester" pour demander les permissions'}
        </p>
      </div>

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



      {/* ============ SECTION TEST NOTIFICATION ============ */}
      <div style={{
        padding: '20px',
        background: 'linear-gradient(135deg, #1a1a3e 0%, #2a1a4e 100%)',
        borderRadius: '12px',
        marginTop: '20px',
        border: '2px solid #4a2a8a',
        boxShadow: '0 4px 20px rgba(74, 42, 138, 0.3)'
      }}>
        <h2 style={{ marginTop: 0, color: '#ce93d8' }}>🔔 Test de notifications système</h2>

        <div style={{
          padding: '10px',
          background: '#1a1a2e',
          borderRadius: '8px',
          marginBottom: '15px',
          border: '1px solid #3a3a5a'
        }}>
          <p style={{ margin: 0, color: '#b0b0b0' }}>
            <strong style={{ color: '#888' }}>Statut :</strong> {notificationTestStatus}
          </p>
          <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#666' }}>
            💡 Ouvrez le centre de notification (Win+N) pour voir les notifications
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => testNotification('success')}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #1b5e20, #2e7d32)',
              color: '#a5d6a7',
              border: '1px solid #388e3c',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 2px 8px rgba(46, 125, 50, 0.3)',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            ✅ Succès
          </button>

          <button
            onClick={() => testNotification('info')}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #0d47a1, #1565c0)',
              color: '#90caf9',
              border: '1px solid #1976d2',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 2px 8px rgba(21, 101, 192, 0.3)',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            ℹ️ Information
          </button>

          <button
            onClick={() => testNotification('warning')}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #e65100, #f57c00)',
              color: '#ffcc80',
              border: '1px solid #fb8c00',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 2px 8px rgba(245, 124, 0, 0.3)',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            ⚠️ Avertissement
          </button>

          <button
            onClick={() => testNotification('error')}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #b71c1c, #c62828)',
              color: '#ef9a9a',
              border: '1px solid #d32f2f',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 2px 8px rgba(198, 40, 40, 0.3)',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            ❌ Erreur
          </button>
        </div>

        <div style={{ marginTop: '15px' }}>
          <button
            onClick={testAllNotifications}
            style={{
              padding: '14px 30px',
              background: 'linear-gradient(135deg, #4a148c, #6a1b9a)',
              color: '#ce93d8',
              border: '1px solid #7b1fa2',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '16px',
              boxShadow: '0 4px 15px rgba(106, 27, 154, 0.4)',
              transition: 'transform 0.2s',
              width: '100%'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            🚀 Tester toutes les notifications (4 types)
          </button>
        </div>

        <div style={{
          marginTop: '15px',
          padding: '10px',
          background: 'rgba(26, 26, 46, 0.8)',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#888'
        }}>
          <p style={{ margin: 0 }}>
            💡 Les notifications apparaissent dans le centre de notification de Windows (Win+N)
            <br />
            <span style={{ color: '#666' }}>
              Mode : 📱 Notifications système uniquement
            </span>
          </p>
        </div>
      </div>

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
            <p><strong style={{ color: '#6a6a8a' }}>Permissions:</strong> {permissionGranted ? '✅ Accordées' : '❌ Refusées'}</p>
            <pre style={{ color: '#888' }}>{JSON.stringify(systemInfo, null, 2)}</pre>
          </div>
        </details>
      </div>
    </div>
  )
}

export default App