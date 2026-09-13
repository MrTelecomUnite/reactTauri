/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import axios from 'axios';

import {
  print_thermal_printer,
  title,
  text,
  line,
  feed,
  cut,
  globalStyles,
  table,
  ENCODE,
  TEXT_ALIGN,
  TEXT_SIZE,

} from "tauri-plugin-thermal-printer";

// ============ TYPES ============

interface MoyenPaiement {
  id: number;
  nom: string;
  code: string;
  nom_beneficiaire: string;
  actif: boolean;
}

interface Boisson {
  id: number;
}

interface Restaurant {
  id: number;
  nom: string;
  payement_info: string | null;
  buffets: any[];
  boissons: Boisson[];
  moyenPaiement: MoyenPaiement[];
}

interface Plat {
  id: number;
  numeroPlats: number;
  image: string;
  titre: string;
  prixPlats: string;
  categories: string;
  type_cuisine: string;
  gastronomique: string;
  quantite: number;
  ingredients: string;
  methodes: string;
  options_personnalisation: string;
  portion: string;
  accomp: string;
  isVisibility: boolean;
  isMenyJours: boolean;
  createdAt: string;
  updatedAt: string;
  restaurants_id: number;
  administrateur_id: number;
  restaurants: Restaurant;
}

interface ApiResponse {
  data: Plat[];
}

interface CartItem extends Plat {
  quantitePanier: number;
}

// ============ COMPOSANT ============

const PlatsList = () => {
  const [plats, setPlats] = useState<Plat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showFacture, setShowFacture] = useState<boolean>(false);

  // ============ CHARGEMENT DES PLATS ============
  useEffect(() => {
    const fetchPlats = async () => {
      try {
        setLoading(true);
        const response = await axios.get<ApiResponse>(
          'https://kumeza-test-backend.burundientempsreel.com/plats'
        );
        setPlats(response.data.data);
        setError(null);
      } catch (err) {
        console.error('Erreur lors du chargement:', err);
        setError(`Erreur de chargement des données ${JSON.stringify(err)}`);
      } finally {
        setLoading(false);
      }
    };

    fetchPlats();
  }, []);

  // ============ GESTION DU PANIER ============
  const ajouterAuPanier = (plat: Plat) => {
    setCart((prev) => {
      const existe = prev.find((item) => item.id === plat.id);
      if (existe) {
        return prev.map((item) =>
          item.id === plat.id
            ? { ...item, quantitePanier: item.quantitePanier + 1 }
            : item
        );
      }
      return [...prev, { ...plat, quantitePanier: 1 }];
    });
  };

  const retirerDuPanier = (id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const modifierQuantite = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? { ...item, quantitePanier: item.quantitePanier + delta }
            : item
        )
        .filter((item) => item.quantitePanier > 0)
    );
  };

  const viderPanier = () => {
    setCart([]);
    setShowFacture(false);
  };

  // ============ CALCULS ============
  const totalPanier = cart.reduce(
    (sum, item) => sum + parseInt(item.prixPlats) * item.quantitePanier,
    0
  );
  const nbArticles = cart.reduce((sum, item) => sum + item.quantitePanier, 0);

  // Générer un numéro de facture unique
  const numeroFacture = `FAC-${new Date().getFullYear()}-${String(
    Math.floor(Math.random() * 9999) + 1
  ).padStart(4, '0')}`;

  const dateFacture = new Date().toLocaleString('fr-FR');

  if (loading) {
    return (
      <div className="plats-loading">
        <div className="plats-spinner"></div>
        <p>⏳ Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="plats-error">
        <div className="plats-error-box">❌ {error}</div>
      </div>
    );
  }

  return (
    <div className="plats-container">
      {/* ===== EN-TÊTE ===== */}
      <div className="plats-header">
        <h1>🍽️ Liste des Plats</h1>
        <div className="plats-header-right">
          <span className="plats-total-badge">Total: {plats.length} plats</span>
          <button
            className="plats-cart-btn"
            onClick={() => setShowFacture(!showFacture)}
          >
            🛒 Panier ({nbArticles})
            {nbArticles > 0 && (
              <span className="plats-cart-total">
                {' '}— {totalPanier.toLocaleString()} BIF
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ===== FACTURE (aperçu du panier) ===== */}
      {showFacture && (
        <div className="facture-overlay" onClick={() => setShowFacture(false)}>
          <div className="facture-modal" onClick={(e) => e.stopPropagation()}>
            {/* En-tête facture */}
            <div className="facture-header">
              <h2>🧾 Aperçu de la facture</h2>
              <button
                className="facture-close"
                onClick={() => setShowFacture(false)}
              >
                ✕
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="facture-empty">
                <p>🛒 Votre panier est vide</p>
                <p className="facture-empty-hint">
                  Ajoutez des plats pour voir la facture
                </p>
              </div>
            ) : (
              <>
                {/* Infos facture */}
                <div className="facture-info">
                  <p>
                    <strong>Facture N° :</strong> {numeroFacture}
                  </p>
                  <p>
                    <strong>Date :</strong> {dateFacture}
                  </p>
                  <p>
                    <strong>Restaurant :</strong>{' '}
                    {cart[0]?.restaurants.nom || 'N/A'}
                  </p>
                </div>

                {/* Tableau des articles */}
                <div className="facture-table-wrapper">
                  <table className="facture-table">
                    <thead>
                      <tr>
                        <th>Désignation</th>
                        <th>Qté</th>
                        <th>P.U.</th>
                        <th>Total</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item) => (
                        <tr key={item.id}>
                          <td className="facture-designation">
                            {item.titre}
                          </td>
                          <td className="facture-qte">
                            <button
                              className="facture-qte-btn"
                              onClick={() => modifierQuantite(item.id, -1)}
                            >
                              −
                            </button>
                            <span>{item.quantitePanier}</span>
                            <button
                              className="facture-qte-btn"
                              onClick={() => modifierQuantite(item.id, 1)}
                            >
                              +
                            </button>
                          </td>
                          <td className="facture-pu">
                            {parseInt(item.prixPlats).toLocaleString()}
                          </td>
                          <td className="facture-total">
                            {(
                              parseInt(item.prixPlats) * item.quantitePanier
                            ).toLocaleString()}
                          </td>
                          <td>
                            <button
                              className="facture-remove"
                              onClick={() => retirerDuPanier(item.id)}
                              title="Retirer"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Total */}
                <div className="facture-total-row">
                  <span>TOTAL :</span>
                  <strong>{totalPanier.toLocaleString()} BIF</strong>
                </div>

                {/* Actions */}
                <div className="facture-actions">
                  <button className="facture-btn vider" onClick={viderPanier}>
                    🗑️ Vider le panier
                  </button>
                  <button
                    className="facture-btn imprimer"
                    onClick={async () => {
                      try {

                        const savedPrinter = localStorage.getItem("selected_printer");

                        await print_thermal_printer({
                          printer: savedPrinter || "Microsoft XPS Document Writer",
                          paper_size: "Mm80",
                          options: {
                            code_page: 6,
                            encode: ENCODE.WINDOWS_1252,
                            use_gbk: false,
                          },
                          sections: [
                            // En-tête
                            globalStyles({ align: TEXT_ALIGN.CENTER }),
                            title("N IKIGAI RESTO BAR"),
                            text("Tél : +257 22 000 000"),
                            text("Bujumbura, Burundi"),

                            line("="),

                            // Infos facture
                            globalStyles({ align: TEXT_ALIGN.LEFT }),
                            text(`Facture N°  : ${numeroFacture}`),
                            text(`Date        : ${new Date().toLocaleString("fr-FR")}`),
                            text(`Client      : NDAYIZEYE Télésphore`),

                            line("-"),

                            table(
                              4,
                              cart.map((item) => [
                                { text: item.titre.substring(0, 15).padEnd(16, ' ') },
                                { text: item.quantitePanier.toString(), align: TEXT_ALIGN.RIGHT },
                                { text: parseInt(item.prixPlats).toLocaleString(""), align: TEXT_ALIGN.RIGHT },
                                {
                                  text: (parseInt(item.prixPlats) * item.quantitePanier).toLocaleString(""),
                                  align: TEXT_ALIGN.RIGHT,
                                },
                              ]),
                              {
                                column_widths: [26, 3, 9, 10],
                                header: [
                                  { text: "Désign", styles: { bold: true } },
                                  { text: "Qté", styles: { bold: true, align: 'left' } },
                                  { text: "P.U.", styles: { bold: true, align: 'right' } },
                                  { text: "Total", styles: { bold: true, align: 'right' } },
                                ],
                                truncate: false,
                              }
                            ),

                            line("-"),

                            // Total
                            text(`TOTAL : ${totalPanier.toLocaleString("")} BIF`, {
                              bold: true,
                              size: TEXT_SIZE.DOUBLE,
                              align: TEXT_ALIGN.RIGHT,
                            }),

                            text(`Paiement : Lumicash`),

                            feed(2),

                            // Remerciements
                            globalStyles({ align: TEXT_ALIGN.CENTER }),
                            text("Merci de votre visite !"),
                            text("À bientôt !"),

                            feed(3),
                            cut(),
                          ],
                        });



                        const receipt: any = {
                          "printer": savedPrinter || "Microsoft XPS Document Writer",
                          "paper_size": "Mm80",
                          "options": {
                            "code_page": 0,
                            "encode": ENCODE.ACCENT_REMOVER,
                            "use_gbk": false,
                          },
                          "sections": [
                            { "Title": { "text": "SUPERMERCADO LA ECONOMÍA", "styles": { "bold": true, "underline": false, "align": "center", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "Double" } } },
                            { "Text": { "text": "Sucursal Centro", "styles": { "bold": false, "underline": false, "align": "center", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } } },
                            { "Text": { "text": "Av. Juárez #1234, Col. Centro", "styles": { "bold": false, "underline": false, "align": "center", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } } },
                            { "Text": { "text": "Tel: (555) 123-4567", "styles": { "bold": false, "underline": false, "align": "center", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } } },
                            { "Text": { "text": "RFC: SUPE850101ABC", "styles": { "bold": false, "underline": false, "align": "center", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } } },
                            { "Line": { "character": "=" } },
                            { "Text": { "text": "TICKET DE COMPRA", "styles": { "bold": true, "underline": false, "align": "center", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } } },
                            { "Text": { "text": "Fecha: 14/10/2025 15:45:30", "styles": { "bold": false, "underline": false, "align": "left", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } } },
                            { "Text": { "text": "Ticket: #0012345", "styles": { "bold": false, "underline": false, "align": "left", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } } },
                            { "Text": { "text": "Cajero: María González", "styles": { "bold": false, "underline": false, "align": "left", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } } },
                            { "Text": { "text": "Caja: 03", "styles": { "bold": false, "underline": false, "align": "left", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } } },
                            { "Line": { "character": "=" } },
                            {
                              "Table": {
                                "columns": 4,
                                "column_widths": [5, 20, 11, 12],
                                "header": [
                                  { "text": "CANT", "styles": { "bold": true, "underline": false, "align": "left", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } },
                                  { "text": "DESCRIPCIÓN", "styles": { "bold": true, "underline": false, "align": "left", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } },
                                  { "text": "P.U.", "styles": { "bold": true, "underline": false, "align": "right", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } },
                                  { "text": "TOTAL", "styles": { "bold": true, "underline": false, "align": "right", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } }
                                ],
                                "body": [
                                  [
                                    { "text": "2", "styles": null },
                                    { "text": "Leche Lala 1L", "styles": null },
                                    { "text": "$22.50", "styles": { "bold": false, "underline": false, "align": "right", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } },
                                    { "text": "$45.00", "styles": { "bold": false, "underline": false, "align": "right", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } }
                                  ],
                                  [
                                    { "text": "1", "styles": null },
                                    { "text": "Pan Bimbo Blanco", "styles": null },
                                    { "text": "$38.00", "styles": { "bold": false, "underline": false, "align": "right", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } },
                                    { "text": "$38.00", "styles": { "bold": false, "underline": false, "align": "right", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } }
                                  ],
                                  [
                                    { "text": "3", "styles": null },
                                    { "text": "Coca Cola 600ml", "styles": null },
                                    { "text": "$16.00", "styles": { "bold": false, "underline": false, "align": "right", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } },
                                    { "text": "$48.00", "styles": { "bold": false, "underline": false, "align": "right", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } }
                                  ],
                                  [
                                    { "text": "1", "styles": null },
                                    { "text": "Cereal Zucaritas", "styles": null },
                                    { "text": "$75.00", "styles": { "bold": false, "underline": false, "align": "right", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } },
                                    { "text": "$75.00", "styles": { "bold": false, "underline": false, "align": "right", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } }
                                  ],
                                  [
                                    { "text": "1", "styles": null },
                                    { "text": "Azúcar 1kg", "styles": null },
                                    { "text": "$25.00", "styles": { "bold": false, "underline": false, "align": "right", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } },
                                    { "text": "$25.00", "styles": { "bold": false, "underline": false, "align": "right", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } }
                                  ]
                                ],
                                "truncate": false
                              }
                            },
                            { "Line": { "character": "=" } },
                            {
                              "Table": {
                                "columns": 2,
                                "column_widths": [32, 16],
                                "header": [],
                                "body": [
                                  [
                                    { "text": "SUBTOTAL:", "styles": { "bold": false, "underline": false, "align": "left", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } },
                                    { "text": "$1,280.00", "styles": { "bold": false, "underline": false, "align": "right", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } }
                                  ],
                                  [
                                    { "text": "IVA (16%):", "styles": { "bold": false, "underline": false, "align": "left", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } },
                                    { "text": "$204.80", "styles": { "bold": false, "underline": false, "align": "right", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } }
                                  ]
                                ],
                                "truncate": false
                              }
                            },
                            { "Line": { "character": "=" } },
                            { "Text": { "text": "TOTAL: $1,484.80", "styles": { "bold": true, "underline": false, "align": "center", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } } },
                            { "Line": { "character": "=" } },
                            { "Text": { "text": "Forma de Pago: EFECTIVO", "styles": { "bold": false, "underline": false, "align": "left", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } } },
                            {
                              "Table": {
                                "columns": 2,
                                "column_widths": [32, 16],
                                "header": [],
                                "body": [
                                  [
                                    { "text": "Pago con:", "styles": null },
                                    { "text": "$1,500.00", "styles": { "bold": false, "underline": false, "align": "right", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } }
                                  ],
                                  [
                                    { "text": "Cambio:", "styles": null },
                                    { "text": "$15.20", "styles": { "bold": false, "underline": false, "align": "right", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } }
                                  ]
                                ],
                                "truncate": false
                              }
                            },
                            { "Line": { "character": "-" } },
                            { "Text": { "text": "Artículos: 25", "styles": { "bold": false, "underline": false, "align": "center", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } } },
                            { "Text": { "text": "Ahorro total: $85.50", "styles": { "bold": false, "underline": false, "align": "center", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } } },
                            { "Line": { "character": "-" } },
                            { "Text": { "text": "¡GRACIAS POR SU COMPRA!", "styles": { "bold": true, "underline": false, "align": "center", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } } },
                            { "Text": { "text": "Vuelva pronto", "styles": { "bold": false, "underline": false, "align": "center", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } } },
                            { "Text": { "text": "www.supereconomia.com", "styles": { "bold": false, "underline": false, "align": "center", "italic": false, "invert": false, "font": "A", "rotate": false, "upside_down": false, "size": "normal" } } },
                            { "Qr": { "data": "https://supereconomia.com/ticket/0012345", "size": 5, "error_correction": "M", "model": 2 } },
                            { "Barcode": { "data": "0012345", "barcode_type": "CODE128", "width": 2, "height": 50, "text_position": "below" } },
                            { "Feed": { "feed_type": "lines", "value": 3 } }
                          ]
                        };

                        await print_thermal_printer(receipt)




                      } catch (error) {
                        console.error(error);
                        alert(`❌ Erreur impression : ${error}`);
                      }
                    }}
                  >
                    🖨️ Imprimer la facture
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )
      }

      {/* ===== GRILLE DES PLATS ===== */}
      <div className="plats-grid">
        {plats.map((plat) => (
          <div key={plat.id} className="plat-card">
            <div className="plat-image-wrapper">
              {plat.image && (
                <img
                  src={`https://kumeza-test-backend.burundientempsreel.com/${plat.image}`}
                  alt={plat.titre}
                  className="plat-image"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.png';
                  }}
                />
              )}
              <div className="plat-status">
                <span
                  className={`plat-status-badge ${plat.isMenyJours ? 'dispo' : 'indispo'
                    }`}
                >
                  {plat.isMenyJours ? '📅 Menu' : '🔒 Indispo'}
                </span>
              </div>
            </div>

            <div className="plat-body">
              <div className="plat-title-row">
                <h2 className="plat-title">{plat.titre}</h2>
                <span className="plat-price">
                  {parseInt(plat.prixPlats).toLocaleString()} BIF
                </span>
              </div>

              <div className="plat-info">
                <span className="plat-info-label">Catégorie:</span>
                <span className="plat-info-value">{plat.categories}</span>

                <span className="plat-info-label">Cuisine:</span>
                <span className="plat-info-value">{plat.type_cuisine}</span>

                <span className="plat-info-label">Ingrédients:</span>
                <span className="plat-info-value">{plat.ingredients}</span>
              </div>

              <div className="plat-restaurant">
                <span className="plat-restaurant-name">
                  🏪 {plat.restaurants.nom}
                </span>

                <div className="plat-paiements">
                  {plat.restaurants.moyenPaiement.map((mp) => (
                    <span key={mp.id} className="plat-paiement-badge">
                      {mp.nom}
                    </span>
                  ))}
                </div>

                <p className="plat-date">
                  Créé le:{' '}
                  {new Date(plat.createdAt).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </p>
              </div>

              <button
                className="plat-add-btn"
                onClick={() => ajouterAuPanier(plat)}
                disabled={!plat.isMenyJours}
              >
                🛒 Ajouter au panier
              </button>
            </div>
          </div>
        ))}
      </div>

      {
        plats.length === 0 && (
          <div className="plats-empty">
            <p>Aucun plat trouvé</p>
          </div>
        )
      }
    </div >
  );
};

export default PlatsList;