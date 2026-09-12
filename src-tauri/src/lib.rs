use local_ip_address::local_ip;
use serde::Serialize;
use std::time::Duration;
use sysinfo::System;
use tauri::Emitter;
use tauri_plugin_notification::NotificationExt; // ← IMPORTANT




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
    let ping_result = std::process::Command::new("ping")
        .arg("-n")
        .arg("1")
        .arg("8.8.8.8")
        .output();

    if let Ok(output) = ping_result {
        return output.status.success();
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

// ============ FONCTION PRINCIPALE ============

#[tauri::command]
fn get_printers() -> Result<Vec<PrinterInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        get_printers_windows()
    }

    #[cfg(target_os = "macos")]
    {
        get_printers_macos()
    }

    #[cfg(target_os = "linux")]
    {
        get_printers_linux()
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Système d'exploitation non supporté".to_string())
    }
}

// ============ IMPLÉMENTATION WINDOWS ============

#[cfg(target_os = "windows")]
fn get_printers_windows() -> Result<Vec<PrinterInfo>, String> {
    use std::process::Command;

    let output = Command::new("powershell")
        .args([
            "-Command",
            "Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus, Default, Location | ConvertTo-Json"
        ])
        .output()
        .map_err(|e| format!("Erreur PowerShell: {}", e))?;

    if !output.status.success() {
        return Err("Échec de l'exécution PowerShell".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    if stdout.trim().is_empty() || stdout.trim() == "null" {
        return Ok(Vec::new());
    }

    let mut printers = Vec::new();
    let lines: Vec<&str> = stdout.lines().collect();
    let json_str = lines.join("");

    if let Some(printers_json) = parse_printers_json(&json_str) {
        printers = printers_json;
    }

    Ok(printers)
}

#[cfg(target_os = "windows")]
fn parse_printers_json(json: &str) -> Option<Vec<PrinterInfo>> {
    let mut printers = Vec::new();

    if json.starts_with('[') {
        let objects = json.trim_start_matches('[').trim_end_matches(']');
        let mut current_obj = String::new();
        let mut in_string = false;
        let mut brace_count = 0;

        for ch in objects.chars() {
            if ch == '"' {
                in_string = !in_string;
            }

            if !in_string {
                if ch == '{' {
                    brace_count += 1;
                } else if ch == '}' {
                    brace_count -= 1;
                }
            }

            current_obj.push(ch);

            if brace_count == 0 && !current_obj.is_empty() {
                if let Some(printer) = parse_single_printer(&current_obj) {
                    printers.push(printer);
                }
                current_obj.clear();
            }
        }
    } else if json.starts_with('{') {
        if let Some(printer) = parse_single_printer(json) {
            printers.push(printer);
        }
    }

    Some(printers)
}

#[cfg(target_os = "windows")]
fn parse_single_printer(obj: &str) -> Option<PrinterInfo> {
    let get_field = |field: &str| -> Option<String> {
        let pattern = format!("\"{}\":", field);
        if let Some(start) = obj.find(&pattern) {
            let start = start + pattern.len();
            let rest = &obj[start..].trim_start();
            if rest.starts_with('"') {
                let end = rest[1..].find('"')? + 1;
                return Some(rest[1..end].to_string());
            } else {
                let end = rest.find(',').or_else(|| rest.find('}'))?;
                return Some(rest[..end].trim().to_string());
            }
        }
        None
    };

    let name = get_field("Name")?;
    if name == "null" || name.is_empty() {
        return None;
    }

    let driver = get_field("DriverName").filter(|s| s != "null");
    let port = get_field("PortName").filter(|s| s != "null");
    let location = get_field("Location").filter(|s| s != "null");
    let is_default = get_field("Default").map(|s| s == "true").unwrap_or(false);

    let connection_type = if let Some(port_ref) = &port {
        detect_connection_type_windows(port_ref)
    } else {
        PrinterConnectionType::Unknown
    };

    let status = if let Some(status_str) = get_field("PrinterStatus") {
        match status_str.as_str() {
            "0" | "Normal" => PrinterStatus::Ready,
            "1" | "Paused" => PrinterStatus::Paused,
            "2" | "Error" => PrinterStatus::Error,
            "3" | "PendingDeletion" => PrinterStatus::PendingDeletion,
            "4" | "PaperJam" => PrinterStatus::PaperJam,
            "5" | "PaperOut" => PrinterStatus::PaperOut,
            "8" | "Offline" => PrinterStatus::Offline,
            "11" | "Printing" => PrinterStatus::Printing,
            _ => PrinterStatus::Unknown,
        }
    } else {
        PrinterStatus::Unknown
    };

    Some(PrinterInfo {
        name,
        connection_type,
        status,
        is_default,
        model: driver,
        location,
        port,
    })
}

#[cfg(target_os = "windows")]
fn detect_connection_type_windows(port: &str) -> PrinterConnectionType {
    let port_lower = port.to_lowercase();

    if port_lower.contains("usb") {
        PrinterConnectionType::USB
    } else if port_lower.contains("wifi") || port_lower.contains("wireless") {
        PrinterConnectionType::WiFi
    } else if port_lower.contains("bluetooth") || port_lower.contains("bt") {
        PrinterConnectionType::Bluetooth
    } else if port_lower.contains("network")
        || port_lower.contains("tcp")
        || port_lower.contains("ip")
    {
        PrinterConnectionType::Network
    } else if port_lower.contains("parallel") || port_lower.contains("lpt") {
        PrinterConnectionType::Parallel
    } else if port_lower.contains("serial") || port_lower.contains("com") {
        PrinterConnectionType::Serial
    } else {
        PrinterConnectionType::Unknown
    }
}

// ============ IMPLÉMENTATION MACOS ============

#[cfg(target_os = "macos")]
fn get_printers_macos() -> Result<Vec<PrinterInfo>, String> {
    use std::process::Command;

    let output = Command::new("lpinfo")
        .args(["-v"])
        .output()
        .map_err(|e| format!("Erreur lpinfo: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut printers = Vec::new();

    for line in stdout.lines() {
        if line.contains("direct") || line.contains("network") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let connection_type = if line.contains("usb") {
                    PrinterConnectionType::USB
                } else if line.contains("bluetooth") {
                    PrinterConnectionType::Bluetooth
                } else if line.contains("network") || line.contains("http") || line.contains("ipp")
                {
                    PrinterConnectionType::Network
                } else if line.contains("wifi") || line.contains("wireless") {
                    PrinterConnectionType::WiFi
                } else {
                    PrinterConnectionType::Unknown
                };

                let name = parts[1..].join(" ");

                printers.push(PrinterInfo {
                    name: name.clone(),
                    connection_type,
                    status: PrinterStatus::Ready,
                    is_default: false,
                    model: Some(name),
                    location: None,
                    port: None,
                });
            }
        }
    }

    if let Ok(output) = Command::new("lpstat").args(["-d"]).output() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Some(default_line) = stdout.lines().next() {
            if let Some(printer_name) = default_line.split(' ').last() {
                for printer in &mut printers {
                    if printer.name.contains(printer_name) {
                        printer.is_default = true;
                        break;
                    }
                }
            }
        }
    }

    Ok(printers)
}

// ============ IMPLÉMENTATION LINUX ============

#[cfg(target_os = "linux")]
fn get_printers_linux() -> Result<Vec<PrinterInfo>, String> {
    use std::process::Command;

    let output = Command::new("lpinfo")
        .args(["-v"])
        .output()
        .map_err(|e| format!("Erreur lpinfo: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut printers = Vec::new();

    for line in stdout.lines() {
        if line.contains("direct") || line.contains("network") {
            let connection_type = if line.contains("usb") {
                PrinterConnectionType::USB
            } else if line.contains("bluetooth") {
                PrinterConnectionType::Bluetooth
            } else if line.contains("network") || line.contains("http") || line.contains("ipp") {
                PrinterConnectionType::Network
            } else if line.contains("wifi") || line.contains("wireless") {
                PrinterConnectionType::WiFi
            } else {
                PrinterConnectionType::Unknown
            };

            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let name = parts[1..].join(" ");
                printers.push(PrinterInfo {
                    name: name.clone(),
                    connection_type,
                    status: PrinterStatus::Ready,
                    is_default: false,
                    model: Some(name),
                    location: None,
                    port: None,
                });
            }
        }
    }

    if let Ok(output) = Command::new("lpstat").args(["-d"]).output() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Some(default_line) = stdout.lines().next() {
            if let Some(printer_name) = default_line.split(' ').last() {
                for printer in &mut printers {
                    if printer.name.contains(printer_name) {
                        printer.is_default = true;
                        break;
                    }
                }
            }
        }
    }

    Ok(printers)
}

// ============ COMMANDE TAURI POUR LE STATUT ============

#[tauri::command]
fn get_printer_status(printer_name: String) -> Result<PrinterStatus, String> {
    #[cfg(target_os = "windows")]
    {
        get_printer_status_windows(&printer_name)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(PrinterStatus::Ready)
    }
}

#[cfg(target_os = "windows")]
fn get_printer_status_windows(printer_name: &str) -> Result<PrinterStatus, String> {
    use std::process::Command;

    let output = Command::new("powershell")
        .args([
            "-Command",
            &format!("(Get-Printer -Name '{}').PrinterStatus", printer_name),
        ])
        .output()
        .map_err(|e| format!("Erreur PowerShell: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let status_str = stdout.trim();

    match status_str {
        "0" | "Normal" => Ok(PrinterStatus::Ready),
        "1" | "Paused" => Ok(PrinterStatus::Paused),
        "2" | "Error" => Ok(PrinterStatus::Error),
        "3" | "PendingDeletion" => Ok(PrinterStatus::PendingDeletion),
        "4" | "PaperJam" => Ok(PrinterStatus::PaperJam),
        "5" | "PaperOut" => Ok(PrinterStatus::PaperOut),
        "8" | "Offline" => Ok(PrinterStatus::Offline),
        "11" | "Printing" => Ok(PrinterStatus::Printing),
        _ => Ok(PrinterStatus::Unknown),
    }
}


// ============ COMMANDE D'IMPRESSION DE FACTURE ============

#[tauri::command]
fn imprimer_facture(data: FactureData) -> Result<String, String> {
    // 1. Construire les octets ESC/POS
    let bytes = build_facture_bytes(&data)?;

    // 2. Écrire les octets dans un fichier temporaire
    let temp_path = std::env::temp_dir().join("facture_escpos.bin");
    std::fs::write(&temp_path, &bytes)
        .map_err(|e| format!("Erreur écriture fichier temporaire : {}", e))?;

    // 3. Envoyer le fichier à l'imprimante via PowerShell
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        // Échapper le chemin et le nom de l'imprimante
        let temp_path_str = temp_path.display().to_string().replace('\\', "/");
        let printer_name_escaped = data.printer_name.replace('\'', "''");

        // Script PowerShell pour envoyer les octets bruts à l'imprimante
        let script = format!(
            r#"
            $bytes = [System.IO.File]::ReadAllBytes('{}');
            $printerName = '{}';
            Add-Type -TypeDefinition @"
                using System;
                using System.Runtime.InteropServices;
                public class RawPrinterHelper {{
                    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
                    public class DOCINFOA {{
                        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
                        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
                        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
                    }}
                    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true)]
                    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
                    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true)]
                    public static extern bool ClosePrinter(IntPtr hPrinter);
                    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true)]
                    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
                    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true)]
                    public static extern bool EndDocPrinter(IntPtr hPrinter);
                    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true)]
                    public static extern bool StartPagePrinter(IntPtr hPrinter);
                    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true)]
                    public static extern bool EndPagePrinter(IntPtr hPrinter);
                    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true)]
                    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
                    public static bool SendBytesToPrinter(string printerName, byte[] bytes) {{
                        IntPtr hPrinter;
                        DOCINFOA di = new DOCINFOA();
                        di.pDocName = "Facture ESC/POS";
                        di.pDataType = "RAW";
                        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
                        if (!StartDocPrinter(hPrinter, 1, di)) {{ ClosePrinter(hPrinter); return false; }}
                        if (!StartPagePrinter(hPrinter)) {{ EndDocPrinter(hPrinter); ClosePrinter(hPrinter); return false; }}
                        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                        int dwWritten;
                        bool success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                        Marshal.FreeCoTaskMem(pUnmanagedBytes);
                        EndPagePrinter(hPrinter);
                        EndDocPrinter(hPrinter);
                        ClosePrinter(hPrinter);
                        return success;
                    }}
                }}
"@;
            $success = [RawPrinterHelper]::SendBytesToPrinter($printerName, $bytes);
            if ($success) {{ Write-Output "OK" }} else {{ Write-Error "Échec de l'impression" }}
            "#,
            temp_path_str, printer_name_escaped
        );

        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("Erreur PowerShell : {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(format!(
                "Échec impression (code {}):\nSTDOUT: {}\nSTDERR: {}",
                output.status, stdout, stderr
            ));
        }
    }

    // macOS / Linux : utiliser la commande `lp`
    #[cfg(not(target_os = "windows"))]
    {
        let output = std::process::Command::new("lp")
            .arg("-d")
            .arg(&data.printer_name)
            .arg("-o")
            .arg("raw")
            .arg(&temp_path)
            .output()
            .map_err(|e| format!("Erreur lp : {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Échec impression : {}", stderr));
        }
    }

    // Nettoyer le fichier temporaire
    let _ = std::fs::remove_file(&temp_path);

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

// ============ POINT D'ENTRÉE ============

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_thermal_printer::init())
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            check_network_status,
            get_printers,
            get_printer_status,
            imprimer_facture,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let app_handle = app.handle().clone();

            std::thread::spawn(move || {
                let mut previous_status = false;
                let mut notification_count = 0;
                let mut last_notification_time = std::time::Instant::now();

                loop {
                    let current_status = check_internet_connection();

                    if current_status != previous_status {
                        previous_status = current_status;

                        if current_status {
                            // Notification avec son
                            let _ = app_handle.notification()
                                .builder()
                                .title("✅ Connexion rétablie")
                                .body("La connexion Internet est de nouveau disponible !")
                                .sound("notification_sound") // ← Nom du son
                                .show();
                        } else {
                            // Notification avec son
                            let _ = app_handle.notification()
                                .builder()
                                .title("❌ Connexion perdue")
                                .body("La connexion Internet a été interrompue. Vérifiez votre réseau.")
                                .sound("notification_sound") // ← Nom du son
                                .show();
                        }

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

                        let _ = app_handle.emit("internet-status", current_status);
                        let _ = app_handle.emit("network-notification", custom_notification);

                        notification_count = 0;
                        last_notification_time = std::time::Instant::now();
                    }

                    if !current_status && last_notification_time.elapsed() > Duration::from_secs(30) {
                        let _ = app_handle.notification()
                            .builder()
                            .title("⚠️ Pas de connexion Internet")
                            .body(&format!(
                                "Toujours hors ligne depuis {} minutes",
                                notification_count * 30 / 60
                            ))
                            .sound("notification_sound.wav") // ← Nom du son
                            .show();

                        let reminder = NotificationPayload {
                            title: "⚠️ Pas de connexion Internet".to_string(),
                            message: format!(
                                "Toujours hors ligne depuis {} minutes",
                                notification_count * 30 / 60
                            ),
                            notification_type: "warning".to_string(),
                        };
                        let _ = app_handle.emit("network-notification", reminder);

                        last_notification_time = std::time::Instant::now();
                        notification_count += 1;
                    }

                    std::thread::sleep(Duration::from_secs(5));
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
