import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export async function checkForUpdates(): Promise<void> {
    try {
        const update = await check();

        if (!update) {
            alert("Ku Meza est à jour.");
            return;
        }

        alert(
            `Nouvelle version trouvée : ${update.version} (${update.date})\n\n${update.body}`
        );

        let downloaded = 0;
        let contentLength = 0;

        await update.downloadAndInstall((event) => {
            switch (event.event) {
                case 'Started':
                    // ✅ CORRECTION : gérer undefined
                    contentLength = event.data.contentLength ?? 0;
                    console.log(`Démarrage du téléchargement : ${contentLength} bytes`);
                    break;

                case 'Progress':
                    downloaded += event.data.chunkLength;
                    console.log(`Téléchargé : ${downloaded} / ${contentLength}`);
                    break;

                case 'Finished':
                   alert('Téléchargement terminé');
                    break;
            }
        });

        console.log('Mise à jour installée');

        // ⚠️ Vous appelez downloadAndInstall DEUX FOIS → supprimez le 2ème appel
        // await update.downloadAndInstall();  // ❌ SUPPRIMER

        await relaunch();
    } catch (error) {
        alert(`Erreur de mise à jour : ${error}`);
    }
}