#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use local_ip_address::local_ip;
use serde::Serialize;
use std::io::BufReader;
use std::time::Duration;
use sysinfo::System;
use tauri::Emitter;
use tauri::{AppHandle, Manager, WindowEvent};
use rodio::{Decoder, OutputStreamBuilder, Sink};
use std::sync::atomic::{AtomicBool, Ordering};

static WAS_MAXIMIZED: AtomicBool = AtomicBool::new(false);

#[derive(Serialize, Clone)]
struct SystemInfo {
    os_name: String,
    os_version: String,
    host_name: String,
    cpu_name: String,
    cpu_cores: usize,
    total_memory: u64,
    used_memory: u64,
    internet_available: bool,
    local_ip: String,
    public_ip: Option<String>,
}

#[derive(Serialize)]
struct NetworkInfo {
    internet_available: bool,
    local_ip: String,
    public_ip: Option<String>,
}

// ============ STRUCTURES POUR LES NOTIFICATIONS ============

#[derive(Serialize, Clone)]
struct NotificationPayload {
    title: String,
    message: String,
    notification_type: String,
}

// ============ STRUCTURES POUR LES IMPRIMANTES ============

#[derive(Serialize, Clone, Debug)]
pub struct PrinterInfo {
    pub name: String,
    pub connection_type: PrinterConnectionType,
    pub status: PrinterStatus,
    pub is_default: bool,
    pub model: Option<String>,
    pub location: Option<String>,
    pub port: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub enum PrinterConnectionType {
    USB,
    WiFi,
    Bluetooth,
    Network,
    Parallel,
    Serial,
    Unknown,
}

impl std::fmt::Display for PrinterConnectionType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PrinterConnectionType::USB => write!(f, "USB"),
            PrinterConnectionType::WiFi => write!(f, "WiFi"),
            PrinterConnectionType::Bluetooth => write!(f, "Bluetooth"),
            PrinterConnectionType::Network => write!(f, "Réseau"),
            PrinterConnectionType::Parallel => write!(f, "Parallèle"),
            PrinterConnectionType::Serial => write!(f, "Série"),
            PrinterConnectionType::Unknown => write!(f, "Inconnu"),
        }
    }
}

#[derive(Serialize, Clone, Debug)]
pub enum PrinterStatus {
    Ready,
    Paused,
    Error,
    PendingDeletion,
    PaperJam,
    PaperOut,
    ManualFeed,
    PaperProblem,
    Offline,
    IOActive,
    Busy,
    Printing,
    OutputBinFull,
    NotAvailable,
    NoToner,
    NoPaper,
    UserIntervention,
    OutOfMemory,
    DoorOpen,
    ServerUnknown,
    PowerSave,
    Unknown,
}


#[derive(serde::Deserialize)]
struct FactureItem {
    designation: String,
    quantite: u32,
    prix_unitaire: f64,
}

#[derive(serde::Deserialize)]
struct FactureData {
    numero_facture: String,
    client: String,
    date: String,
    items: Vec<FactureItem>,
    total: f64,
    moyen_paiement: String,
    printer_name: String, // 👈 Nom de l'imprimante choisie
}


// ============ COMMANDES ============

#[tauri::command]
fn get_system_info() -> SystemInfo {
    let mut system = System::new_all();
    system.refresh_all();

    SystemInfo {
        os_name: System::name().unwrap_or_default(),
        os_version: System::os_version().unwrap_or_default(),
        host_name: System::host_name().unwrap_or_default(),
        cpu_name: system.cpus()[0].brand().to_string(),
        cpu_cores: system.cpus().len(),
        total_memory: system.total_memory(),
        used_memory: system.used_memory(),
        internet_available: check_internet_connection(),
        local_ip: get_local_ip(),
        public_ip: get_public_ip(),
    }
}

#[tauri::command]
fn check_network_status() -> NetworkInfo {
    NetworkInfo {
        internet_available: check_internet_connection(),
        local_ip: get_local_ip(),
        public_ip: get_public_ip(),
    }
}

fn check_internet_connection() -> bool {
    use std::net::TcpStream;
    use std::time::Duration;

    // Essai 1 : TCP connect (rapide, pas de droits admin)
    if TcpStream::connect_timeout(
        &"8.8.8.8:53".parse().unwrap(),
        Duration::from_secs(2),
    ).is_ok() {
        return true;
    }

    // Essai 2 : TCP connect sur Cloudflare
    if TcpStream::connect_timeout(
        &"1.1.1.1:53".parse().unwrap(),
        Duration::from_secs(2),
    ).is_ok() {
        return true;
    }

    false
}

fn get_local_ip() -> String {
    if let Ok(ip) = local_ip() {
        return ip.to_string();
    }
    "Unknown".to_string()
}


fn get_public_ip() -> Option<String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .ok()?;

    if let Ok(response) = client.get("https://api.ipify.org").send() {
        if response.status().is_success() {
            if let Ok(ip) = response.text() {
                return Some(ip.trim().to_string());
            }
        }
    }

    None
}


// ============ COMMANDE D'IMPRESSION DE FACTURE ============

#[cfg(target_os = "windows")]
fn envoyer_a_imprimante_windows(printer_name: &str, bytes: &[u8]) -> Result<(), String> {
    use windows::core::PSTR;
    use windows::Win32::Graphics::Printing::{
        ClosePrinter, EndDocPrinter, EndPagePrinter,
        OpenPrinterA, StartDocPrinterA, StartPagePrinter,
        WritePrinter, DOC_INFO_1A,
    };
    use windows::Win32::Foundation::HANDLE;  // ← Utiliser HANDLE

    let printer_cstr = std::ffi::CString::new(printer_name)
        .map_err(|e| format!("Nom imprimante invalide : {}", e))?;

    unsafe {
        let mut h_printer = HANDLE::default();  // ← HANDLE au lieu de PRINTER_HANDLE

        // Ouvrir l'imprimante
        if OpenPrinterA(
            windows::core::PCSTR(printer_cstr.as_ptr() as *const u8),
            &mut h_printer,
            None,
        ).is_err() {
            return Err(format!("Impossible d'ouvrir l'imprimante '{}'", printer_name));
        }

        // Démarrer le document
        let doc_name = std::ffi::CString::new("Facture ESC/POS").unwrap();
        let data_type = std::ffi::CString::new("RAW").unwrap();

        let doc_info = DOC_INFO_1A {
            pDocName: PSTR(doc_name.as_ptr() as *mut u8),
            pOutputFile: PSTR(std::ptr::null_mut()),
            pDatatype: PSTR(data_type.as_ptr() as *mut u8),
        };

        // StartDocPrinterA retourne un DWORD (0 = échec)
        if StartDocPrinterA(h_printer, 1, &doc_info) == 0 {
            let _ = ClosePrinter(h_printer);
            return Err("Impossible de démarrer le document".to_string());
        }

        // StartPagePrinter retourne un BOOL
        if StartPagePrinter(h_printer).as_bool() == false {
            let _ = EndDocPrinter(h_printer);
            let _ = ClosePrinter(h_printer);
            return Err("Impossible de démarrer la page".to_string());
        }

        // Envoyer les octets
        let mut written = 0u32;
        let result = WritePrinter(
            h_printer,
            bytes.as_ptr() as *const _,
            bytes.len() as u32,
            &mut written,
        );

        let _ = EndPagePrinter(h_printer);
        let _ = EndDocPrinter(h_printer);
        let _ = ClosePrinter(h_printer);

        if result.as_bool() == false {
            return Err("Échec de l'envoi des données".to_string());
        }
    }

    Ok(())
}

#[tauri::command]
fn imprimer_facture(data: FactureData) -> Result<String, String> {
    let bytes = build_facture_bytes(&data)?;

    #[cfg(target_os = "windows")]
    {
        envoyer_a_imprimante_windows(&data.printer_name, &bytes)?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        // macOS/Linux : `lp` est natif, pas de problème de perf
        let temp_path = std::env::temp_dir().join("facture_escpos.bin");
        std::fs::write(&temp_path, &bytes)
            .map_err(|e| format!("Erreur écriture : {}", e))?;

        let output = std::process::Command::new("lp")
            .arg("-d").arg(&data.printer_name)
            .arg("-o").arg("raw")
            .arg(&temp_path)
            .output()
            .map_err(|e| format!("Erreur lp : {}", e))?;

        let _ = std::fs::remove_file(&temp_path);

        if !output.status.success() {
            return Err(format!("Échec impression : {}",
                String::from_utf8_lossy(&output.stderr)));
        }
    }

    Ok(format!("✅ Facture imprimée sur '{}'", data.printer_name))
}

fn build_facture_bytes(data: &FactureData) -> Result<Vec<u8>, String> {
    let mut bytes: Vec<u8> = Vec::new();
    const ESC: u8 = 0x1B;
    const GS: u8 = 0x1D;

    // Initialiser
    bytes.extend_from_slice(&[ESC, 0x40]);
    // Code page 850 (accents FR)
    bytes.extend_from_slice(&[ESC, 0x74, 0x02]);

    // En-tête centré + double taille
    bytes.extend_from_slice(&[ESC, 0x61, 0x01]);
    bytes.extend_from_slice(&[GS, 0x21, 0x11]);
    bytes.extend_from_slice(&encoder_cp850("N IKIGAI RESTO BAR\n"));
    bytes.extend_from_slice(&[GS, 0x21, 0x00]);
    bytes.extend_from_slice(&encoder_cp850("Tél : +257 22 000 000\n"));
    bytes.extend_from_slice(&encoder_cp850("Bujumbura, Burundi\n"));
    bytes.extend_from_slice(&encoder_cp850("--------------------------------\n"));

    // Infos facture (aligné à gauche)
    bytes.extend_from_slice(&[ESC, 0x61, 0x00]);
    bytes.extend_from_slice(&encoder_cp850(&format!("Facture N° : {}\n", data.numero_facture)));
    bytes.extend_from_slice(&encoder_cp850(&format!("Date       : {}\n", data.date)));
    bytes.extend_from_slice(&encoder_cp850(&format!("Client     : {}\n", data.client)));
    bytes.extend_from_slice(&encoder_cp850("--------------------------------\n"));
    bytes.extend_from_slice(&encoder_cp850("Désignation        Qté   P.U.    Total\n"));
    bytes.extend_from_slice(&encoder_cp850("--------------------------------\n"));

    for item in &data.items {
        let ligne = format!(
            "{:<18} {:>3} {:>7.0} {:>8.0}\n",
            tronquer(&item.designation, 18),
            item.quantite,
            item.prix_unitaire,
            item.prix_unitaire * item.quantite as f64
        );
        bytes.extend_from_slice(&encoder_cp850(&ligne));
    }

    bytes.extend_from_slice(&encoder_cp850("--------------------------------\n"));

    // Total en gras
    bytes.extend_from_slice(&[ESC, 0x45, 0x01]);
    bytes.extend_from_slice(&[GS, 0x21, 0x01]);
    bytes.extend_from_slice(&encoder_cp850(&format!("TOTAL : {:.0} BIF\n", data.total)));
    bytes.extend_from_slice(&[GS, 0x21, 0x00]);
    bytes.extend_from_slice(&[ESC, 0x45, 0x00]);

    bytes.extend_from_slice(&encoder_cp850(&format!("Paiement : {}\n", data.moyen_paiement)));
    bytes.extend_from_slice(b"\n");

    // Remerciements centrés
    bytes.extend_from_slice(&[ESC, 0x61, 0x01]);
    bytes.extend_from_slice(&encoder_cp850("Merci de votre visite !\n"));
    bytes.extend_from_slice(&encoder_cp850("À bientôt !\n"));
    bytes.extend_from_slice(b"\n\n\n");

    // Couper
    bytes.extend_from_slice(&[GS, 0x56, 0x00]);

    Ok(bytes)
}

fn tronquer(s: &str, max: usize) -> String {
    if s.chars().count() <= max { s.to_string() }
    else { s.chars().take(max).collect() }
}

fn encoder_cp850(s: &str) -> Vec<u8> {
    s.chars().map(|c| match c {
        // Accents français
        'é' => 0x82, 'É' => 0x90,
        'è' => 0x8A, 'È' => 0xD4,
        'ê' => 0x88, 'Ê' => 0x88,
        'ë' => 0x89, 'Ë' => 0x89,
        'à' => 0x85, 'À' => 0xB7,
        'â' => 0x83, 'Â' => 0x83,
        'ä' => 0x84, 'Ä' => 0x8E,
        'ç' => 0x87, 'Ç' => 0x80,
        'ô' => 0x93, 'Ô' => 0x93,
        'ö' => 0x94, 'Ö' => 0x99,
        'î' => 0x8C, 'Î' => 0x8C,
        'ï' => 0x8B, 'Ï' => 0x8B,
        'û' => 0x96, 'Û' => 0x96,
        'ù' => 0x97, 'Ù' => 0xEB,
        'ü' => 0x81, 'Ü' => 0x9A,
        'ÿ' => 0x98, 'Ÿ' => 0x98,
        'ñ' => 0xA4, 'Ñ' => 0xA5,
        
        // Caractères spéciaux
        '°' => 0xF8,  // degré
        'œ' => 0x9C,  // oe minuscule
        'Œ' => 0x8C,  // OE majuscule (attention : conflit avec î)
        '€' => 0xD5,  // euro
        '£' => 0x9C,  // livre
        '§' => 0xF5,  // paragraphe
        'µ' => 0xE6,  // micro
        '²' => 0xFD,  // carré
        '³' => 0xFC,  // cube
        '«' => 0xAE,  // guillemet gauche
        '»' => 0xAF,  // guillemet droit
        '–' => 0x2D,  // tiret demi-cadratin → tiret simple
        '—' => 0x2D,  // tiret cadratin → tiret simple
        '’' => 0x27,  // apostrophe courbe → apostrophe droite
        '‘' => 0x27,
        '“' => 0x22,  // guillemets courbes
        '”' => 0x22,
        
        // Sauts de ligne et tabulations
        '\n' => 0x0A,
        '\r' => 0x0D,
        '\t' => 0x09,
        
        // ASCII standard
        _ => if (c as u32) < 128 { c as u8 } else { b'?' },
    }).collect()
}


#[tauri::command] 
fn send_native_notification( app: AppHandle, title: String, body: String, ) -> Result<(), String> { 
    #[cfg(target_os = "windows")] {
         envoyer_notification_clickable( &app, &title, &body, ) .map_err(|error| error.to_string())?; 
        } 
         Ok(())
         }

#[cfg(target_os = "windows")]

// ============================================================
// SON PERSONNALISÉ
// ============================================================

#[cfg(target_os = "windows")]
fn jouer_son_notification(
    app: &AppHandle,
) {
    let resource_path = app
        .path()
        .resource_dir()
        .ok()
        .map(|path| {
            path.join("resources")
                .join("notification_sound.wav")
        });

    let fallback_path =
        std::path::PathBuf::from(
            env!("CARGO_MANIFEST_DIR"),
        )
        .join("resources")
        .join("notification_sound.wav");

    let sound_path = resource_path
        .filter(|path| path.exists())
        .unwrap_or(fallback_path);

    if !sound_path.exists() {
        eprintln!(
            "❌ Fichier notification introuvable : {:?}",
            sound_path
        );

        return;
    }

    std::thread::spawn(
        move || {
            let stream =
                match OutputStreamBuilder::open_default_stream()
                {
                    Ok(stream) => stream,
                    Err(error) => {
                        eprintln!(
                            "❌ Impossible d'ouvrir la sortie audio : {}",
                            error
                        );

                        return;
                    }
                };

            let file =
                match std::fs::File::open(
                    &sound_path,
                ) {
                    Ok(file) => file,
                    Err(error) => {
                        eprintln!(
                            "❌ Impossible d'ouvrir le WAV : {}",
                            error
                        );

                        return;
                    }
                };

            let source =
                match Decoder::try_from(
                    BufReader::new(file),
                ) {
                    Ok(source) => source,
                    Err(error) => {
                        eprintln!(
                            "❌ Impossible de décoder notification_sound.wav : {}",
                            error
                        );

                        return;
                    }
                };

            let sink =
                Sink::connect_new(
                    stream.mixer(),
                );

            sink.append(source);

            sink.sleep_until_end();
        },
    );
}


fn envoyer_notification_clickable(
    app: &AppHandle,
    title: &str,
    body: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_winrt_notification::{Duration, Toast};

    println!("🔔 Création notification Windows...");
    println!("   Title : {}", title);
    println!("   Body  : {}", body);

    // Son personnalisé
    jouer_son_notification(app);

    // Clone AppHandle pour le clic
    let app_handle = app.clone();

    Toast::new("com.kumeza.desktop")
        .title(title)
        .text1(body)
        .sound(None)
        .duration(Duration::Short)
        .on_activated(move |_| {
    println!("🔔 Notification Ku Meza activée");

    if let Some(window) = app_handle.get_webview_window("main") {
        // Restaurer si minimisée
        if window.is_minimized().unwrap_or(false) {
            let _ = window.unminimize();
        }

        // Afficher si cachée
        if !window.is_visible().unwrap_or(true) {
            let _ = window.show();
        }

        // Restaurer l'état maximisé si nécessaire (PAS de unsafe)
        if WAS_MAXIMIZED.load(Ordering::SeqCst) {
            let _ = window.maximize();
        }

        // Donner le focus
        let _ = window.set_focus();

        #[cfg(target_os = "windows")]
        {
            use windows::Win32::Foundation::HWND;
            use windows::Win32::UI::WindowsAndMessaging::{
                SetForegroundWindow,
                ShowWindow,
                SW_RESTORE,
                SW_MAXIMIZE,
            };

            if let Ok(hwnd) = window.hwnd() {
                unsafe {
                    if WAS_MAXIMIZED.load(Ordering::SeqCst) {
                        let _ = ShowWindow(HWND(hwnd.0), SW_MAXIMIZE);
                    } else {
                        let _ = ShowWindow(HWND(hwnd.0), SW_RESTORE);
                    }

                    let _ = SetForegroundWindow(HWND(hwnd.0));
                }
            }
        }

        println!("✅ Fenêtre Ku Meza restaurée");
    } else {
        println!("⚠️ Fenêtre Ku Meza introuvable");
    }

    Ok(())
})
        .show()
        .map_err(|error| {
            eprintln!(
                "❌ ÉCHEC Toast Windows : {}",
                error
            );
            Box::new(error) as Box<dyn std::error::Error>
        })?;

    println!("✅ Toast Windows envoyé");

    Ok(())
}

// ============ POINT D'ENTRÉE ============

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {

    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        /*
         * IMPORTANT :
         * single-instance doit être enregistré avant les autres plugins.
         */
        builder = builder.plugin(
            tauri_plugin_single_instance::init(
                |app, argv, _cwd| {
                    println!("Nouvelle instance demandée.");
                    println!("Arguments : {:?}", argv);

                         // ─────────────────────────────────
            // Récupérer la fenêtre principale
            // ─────────────────────────────────
           if let Some(window) = app.get_webview_window("main") {
    println!("🪟 Fenêtre Ku Meza trouvée");

    let _ = window.show();

    if window.is_minimized().unwrap_or(false) {
        let _ = window.unminimize();
    }

    // Restaurer l'état maximisé
    if WAS_MAXIMIZED.load(Ordering::SeqCst) {
        let _ = window.maximize();
    }

    let _ = window.set_focus();

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{
            SetForegroundWindow, ShowWindow, SW_RESTORE, SW_MAXIMIZE,
        };

        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                if WAS_MAXIMIZED.load(Ordering::SeqCst) {
                    let _ = ShowWindow(HWND(hwnd.0), SW_MAXIMIZE);
                } else {
                    let _ = ShowWindow(HWND(hwnd.0), SW_RESTORE);
                }
                let _ = SetForegroundWindow(HWND(hwnd.0));
            }
        }
    }

    println!("✅ Ku Meza réaffiché");
} else {
                println!("⚠️ Fenêtre principale introuvable");
            }



                    if let Some(url) = argv.iter().find(|argument| {
                        argument.starts_with("kumeza://")
                    }) {
                        println!("Deep link reçu : {}", url);

                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }

                        let _ = app.emit("kumeza-deep-link", url.clone());
                    }
                },
            )
        );
    }

   
    builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_thermal_printer::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            check_network_status,
            imprimer_facture,
            send_native_notification
            
        ])
        .setup(|app| {

            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
            }


            // ✅ Autostart : activer via le manager, SANS réenregistrer le plugin
            #[cfg(desktop)]
            {
                use tauri_plugin_autostart::ManagerExt;

                let autostart_manager = app.autolaunch();

                if let Err(e) = autostart_manager.enable() {
                    eprintln!("⚠️ Impossible d'activer l'autostart : {e}");
                }

                match autostart_manager.is_enabled() {
                    Ok(true)  => println!("✅ Autostart activé"),
                    Ok(false) => println!("❌ Autostart désactivé"),
                    Err(e)    => eprintln!("⚠️ is_enabled() a échoué : {e}"),
                }
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
   if let Some(window) =
        app.get_webview_window("main")
    {
        let app_handle = app.handle().clone();

       window.on_window_event(move |event| {
    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();

        if let Some(window) = app_handle.get_webview_window("main") {
            // Sauvegarder l'état maximisé avant de cacher
            let was_maximized = window.is_maximized().unwrap_or(false);

            // Stocker l'état (PAS de unsafe, PAS de =)
            WAS_MAXIMIZED.store(was_maximized, Ordering::SeqCst);

            let _ = window.hide();
        }
    }
});
    }
    
            let app_handle = app.handle().clone();



std::thread::spawn(move || {
    let mut previous_status = check_internet_connection();
    let mut notification_count = 0;
    let mut last_notification_time = std::time::Instant::now();

    loop {
        let current_status = check_internet_connection();

        // ==================================================
        // CHANGEMENT DE STATUT INTERNET
        // ==================================================

        if current_status != previous_status {
            previous_status = current_status;

            // --------------------------------------------------
            // Notification Windows native
            // --------------------------------------------------

            #[cfg(target_os = "windows")]
            {
                let (title, message) = if current_status {
                    (
                        "✅ Connexion Internet rétablie",
                        "La connexion Internet est de nouveau disponible !",
                    )
                } else {
                    (
                        "❌ Connexion Internet perdue",
                        "La connexion Internet a été interrompue. Vérifiez votre réseau.",
                    )
                };

                let _ = envoyer_notification_clickable(
                    &app_handle,
                    title,
                    message,
                );
            }

            // --------------------------------------------------
            // Notification pour React
            // --------------------------------------------------

            let custom_notification = if current_status {
                NotificationPayload {
                    title: "✅ Connexion Internet rétablie".to_string(),
                    message: "La connexion Internet est de nouveau disponible !".to_string(),
                    notification_type: "success".to_string(),
                }
            } else {
                NotificationPayload {
                    title: "❌ Connexion Internet perdue".to_string(),
                    message: "La connexion Internet a été interrompue. Vérifiez votre réseau.".to_string(),
                    notification_type: "error".to_string(),
                }
            };

            // Envoyer le statut à React
            let _ = app_handle.emit(
                "internet-status",
                current_status,
            );

            // Envoyer la notification à React
            let _ = app_handle.emit(
                "network-notification",
                custom_notification,
            );

            // Réinitialiser le compteur
            notification_count = 0;

            last_notification_time =
                std::time::Instant::now();
        }

        // ==================================================
        // RAPPEL SI INTERNET TOUJOURS ABSENT
        // ==================================================

        if !current_status
            && last_notification_time.elapsed()
                > Duration::from_secs(30)
        {
            // --------------------------------------------------
            // Notification Windows native
            // --------------------------------------------------

            #[cfg(target_os = "windows")]
            {
                let minutes =
                    notification_count * 30 / 60;

                let message = format!(
                    "Toujours hors ligne depuis {} minutes",
                    minutes
                );

                let _ = envoyer_notification_clickable(
                    &app_handle,
                    "⚠️ Pas de connexion Internet",
                    &message,
                );
            }

            // --------------------------------------------------
            // Notification pour React
            // --------------------------------------------------

            let reminder = NotificationPayload {
                title: "⚠️ Pas de connexion Internet"
                    .to_string(),

                message: format!(
                    "Toujours hors ligne depuis {} minutes",
                    notification_count * 30 / 60
                ),

                notification_type: "warning"
                    .to_string(),
            };

            let _ = app_handle.emit(
                "network-notification",
                reminder,
            );

            // Réinitialiser le timer
            last_notification_time =
                std::time::Instant::now();

            notification_count += 1;
        }

        // ==================================================
        // ATTENDRE 5 SECONDES
        // ==================================================

        std::thread::sleep(
            Duration::from_secs(5)
        );
    }
});

            Ok(())
        });   // ⚠️⚠️⚠️ POINT-VIRGULE QUI MANQUAIT

    // ⚠️ .run() séparé — c'est ICI que l'app démarre vraiment
    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
