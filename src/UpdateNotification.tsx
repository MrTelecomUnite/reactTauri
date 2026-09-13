/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

interface UpdateState {
  visible: boolean;
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'done' | 'error';
  version?: string;
  body?: string;
  downloaded: number;
  contentLength: number;
  error?: string;
}

const UpdateNotification = () => {
  const [state, setState] = useState<UpdateState>({
    visible: false,
    status: 'idle',
    downloaded: 0,
    contentLength: 0,
  });

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        setState((s) => ({ ...s, status: 'checking' }));

        const update = await check();

        if (!update) {
          // Pas de mise à jour → cacher après 2s
          setState((s) => ({ ...s, status: 'idle' }));
          return;
        }

        // ✅ Mise à jour disponible → afficher la notification
        setState({
          visible: true,
          status: 'available',
          version: update.version,
          body: update.body || '',
          downloaded: 0,
          contentLength: 0,
        });

        // ✅ Télécharger et installer automatiquement
        let downloaded = 0;
        let contentLength = 0;

        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              contentLength = event.data.contentLength || 0;
              setState((s) => ({
                ...s,
                status: 'downloading',
                contentLength,
                downloaded: 0,
              }));
              console.log(`📥 Démarrage : ${contentLength} bytes`);
              break;

            case 'Progress':
              downloaded += event.data.chunkLength;
              setState((s) => ({
                ...s,
                downloaded,
              }));
              console.log(`📥 ${downloaded} / ${contentLength} bytes`);
              break;

            case 'Finished':
              setState((s) => ({ ...s, status: 'installing' }));
              console.log('✅ Téléchargement terminé');
              break;
          }
        });

        // ✅ Installation terminée
        setState((s) => ({ ...s, status: 'done' }));

        // Attendre 3s puis relancer
        setTimeout(async () => {
          await relaunch();
        }, 3000);
      } catch (error) {
        console.error('❌ Erreur mise à jour:', error);
        setState((s) => ({
          ...s,
          status: 'error',
          error: String(error),
        }));

        // Cacher après 5s en cas d'erreur
        setTimeout(() => {
          setState((s) => ({ ...s, visible: false }));
        }, 5000);
      }
    };

    // Vérifier après 3 secondes (laisser l'app démarrer)
    const timer = setTimeout(checkForUpdates, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Ne pas afficher si pas visible
  if (!state.visible) return null;

  // Calculer le pourcentage
  const progress =
    state.contentLength > 0
      ? Math.round((state.downloaded / state.contentLength) * 100)
      : 0;

  // Formater les octets
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // Icône et couleur selon le statut
  const statusConfig = {
    checking: { icon: '🔍', color: '#64b5f6', text: 'Vérification...' },
    available: { icon: '🎉', color: '#81c784', text: 'Mise à jour disponible' },
    downloading: { icon: '📥', color: '#64b5f6', text: 'Téléchargement...' },
    installing: { icon: '⚙️', color: '#ffb74d', text: 'Installation...' },
    done: { icon: '✅', color: '#81c784', text: 'Mise à jour installée !' },
    error: { icon: '❌', color: '#e57373', text: 'Erreur' },
    idle: { icon: '', color: '#888', text: '' },
  };

  const config = statusConfig[state.status];

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 9999,
        width: 360,
        maxWidth: 'calc(100vw - 40px)',
        background: '#16213e',
        border: `2px solid ${config.color}`,
        borderRadius: 12,
        padding: 16,
        boxShadow: `0 8px 30px rgba(0,0,0,0.5), 0 0 20px ${config.color}33`,
        color: '#e0e0e0',
        fontFamily: 'Arial, sans-serif',
        animation: 'slideInRight 0.3s ease',
      }}
    >
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 24 }}>{config.icon}</span>
        <div style={{ flex: 1 }}>
          <h4
            style={{
              margin: 0,
              fontSize: 15,
              color: config.color,
              fontWeight: 'bold',
            }}
          >
            {config.text}
          </h4>
          {state.version && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>
              Version {state.version}
            </p>
          )}
        </div>
      </div>

      {/* Barre de progression (pendant le téléchargement) */}
      {state.status === 'downloading' && state.contentLength > 0 && (
        <>
          <div
            style={{
              width: '100%',
              height: 8,
              background: '#0d0d1a',
              borderRadius: 4,
              overflow: 'hidden',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${config.color}, #4a6aaa)`,
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: '#888',
            }}
          >
            <span>{progress}%</span>
            <span>
              {formatBytes(state.downloaded)} / {formatBytes(state.contentLength)}
            </span>
          </div>
        </>
      )}

      {/* Message d'installation */}
      {state.status === 'installing' && (
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#b0b0b0' }}>
          ⏳ L'application va redémarrer automatiquement...
        </p>
      )}

      {/* Message de succès */}
      {state.status === 'done' && (
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#81c784' }}>
          🚀 Redémarrage dans quelques secondes...
        </p>
      )}

      {/* Message d'erreur */}
      {state.status === 'error' && state.error && (
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 12,
            color: '#e57373',
            background: '#3a1a1a',
            padding: 8,
            borderRadius: 6,
          }}
        >
          {state.error}
        </p>
      )}

      {/* Notes de version */}
      {state.status === 'available' && state.body && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#888' }}>
          {state.body}
        </p>
      )}

      {/* Bouton fermer (uniquement en cas d'erreur ou idle) */}
      {(state.status === 'error' || state.status === 'done') && (
        <button
          onClick={() => setState((s) => ({ ...s, visible: false }))}
          style={{
            marginTop: 10,
            padding: '6px 12px',
            background: 'transparent',
            color: '#888',
            border: '1px solid #3a3a5a',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
            width: '100%',
          }}
        >
          Fermer
        </button>
      )}

      {/* Animation CSS */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(120%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default UpdateNotification;