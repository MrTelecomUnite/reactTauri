/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { list_thermal_printers } from "tauri-plugin-thermal-printer";

function FactureTest() {
    const [printers, setPrinters] = useState<string[]>([]);
    const [selectedPrinter, setSelectedPrinter] = useState<string>("");
    const [status, setStatus] = useState("");
    const [loadingPrinters, setLoadingPrinters] = useState(false);

    useEffect(() => {
        const fetchPrinters = async () => {
            setLoadingPrinters(true);
            try {
                const response = await list_thermal_printers();
                let list: string[] = [];
                if (Array.isArray(response)) {
                    list = response.map((p: any) =>
                        typeof p === "string" ? p : p.name ?? JSON.stringify(p)
                    );
                } else if (typeof response === "object" && response !== null) {
                    list = Object.values(response).map((p: any) =>
                        typeof p === "string" ? p : p.name ?? JSON.stringify(p)
                    );
                }
                setPrinters(list);
                const pos = list.find((p) => p.toLowerCase().includes("pos"));
                setSelectedPrinter(pos || list[0] || "");
            } catch (error) {
                setStatus(`❌ Impossible de récupérer les imprimantes : ${error}`);
            } finally {
                setLoadingPrinters(false);
            }
        };
        fetchPrinters();
    }, []);

    const imprimerFacture = async () => {
        if (!selectedPrinter) {
            setStatus("❌ Veuillez sélectionner une imprimante");
            return;
        }
        try {
            setStatus(`⏳ Impression vers "${selectedPrinter}"...`);

       
            // 👇 Appel à la commande Rust qui fait TOUT (build + envoi)
            const message = await invoke<string>("imprimer_facture", {

                data: {
                    numero_facture: "FAC-2026-0001",
                    client: "Jean-Pierre Ndayishimiye",
                    date: new Date().toLocaleString("fr-FR"),
                    items: [
                        { designation: "Igisiniya", quantite: 2, prix_unitaire: 100000 },
                        { designation: "Café Crème", quantite: 3, prix_unitaire: 2500 },
                        { designation: "Brochettes de bœuf", quantite: 5, prix_unitaire: 3000 },
                        { designation: "Jus d'ananas frais", quantite: 4, prix_unitaire: 1500 },
                    ],
                    total: 212500,
                    moyen_paiement: "Lumicash",
                    printer_name: selectedPrinter, // 👈 On passe le nom à Rust
                },
            });
            setStatus(message);
        } catch (error) {
            console.error(error);
            setStatus(`❌ Erreur : ${error}`);
        }
    };

    return (
        <div style={{ padding: 20, background: '#1a1a2e', borderRadius: 8, color: '#e0e0e0', maxWidth: 700, margin: '20px auto' }}>
            <h3 style={{ color: '#ce93d8' }}>🖨️ Impression de facture</h3>

            {/* Sélection imprimante */}
            <div style={{ background: '#16213e', padding: 15, borderRadius: 8, marginBottom: 15, border: '1px solid #2a3a6a' }}>
                <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 8, fontWeight: 'bold' }}>
                    🖨️ Sélectionner l'imprimante :
                </label>
                <select
                    value={selectedPrinter}
                    onChange={(e) => setSelectedPrinter(e.target.value)}
                    disabled={loadingPrinters || printers.length === 0}
                    style={{ width: '100%', padding: '10px 12px', background: '#1a1a2e', color: '#e0e0e0', border: '1px solid #3a3a5a', borderRadius: 6 }}
                >
                    {loadingPrinters ? <option>⏳ Chargement...</option>
                        : printers.length === 0 ? <option>Aucune imprimante trouvée</option>
                            : printers.map((p) => (
                                <option key={p} value={p}>
                                    {p.toLowerCase().includes("pos") ? "⭐ " : ""}{p}
                                </option>
                            ))
                    }
                </select>
            </div>

            <button
                onClick={imprimerFacture}
                disabled={!selectedPrinter || loadingPrinters}
                style={{
                    padding: '12px 24px',
                    background: selectedPrinter ? 'linear-gradient(135deg, #4a148c, #6a1b9a)' : '#333',
                    color: '#ce93d8',
                    border: '1px solid #7b1fa2',
                    borderRadius: 8,
                    cursor: selectedPrinter ? 'pointer' : 'not-allowed',
                    fontWeight: 'bold',
                    opacity: selectedPrinter ? 1 : 0.5
                }}
            >
                🧾 Imprimer la facture
            </button>

            {status && (
                <p style={{
                    marginTop: 15,
                    padding: 10,
                    background: status.startsWith('❌') ? '#3a1a1a' : '#1b3a2a',
                    border: `1px solid ${status.startsWith('❌') ? '#f44336' : '#4caf50'}`,
                    borderRadius: 6,
                    color: status.startsWith('❌') ? '#e57373' : '#81c784',
                    fontSize: 13
                }}>
                    {status}
                </p>
            )}
        </div>
    );
}

export default FactureTest;