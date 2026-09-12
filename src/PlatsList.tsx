/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import axios from 'axios';

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

// ============ COMPOSANT ============

const PlatsList = () => {
  const [plats, setPlats] = useState<Plat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlats = async () => {
      try {
        setLoading(true);
        const response = await axios.get<ApiResponse>('https://kumeza-test-backend.burundientempsreel.com/plats');
        setPlats(response.data.data);
        setError(null);
      } catch (err) {
        console.error('Erreur lors du chargement:', err);
        setError('Erreur de chargement des données');
      } finally {
        setLoading(false);
      }
    };

    fetchPlats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
          <p className="text-gray-400 mt-4">⏳ Chargement...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-900/50 border border-red-600 text-red-300 px-4 py-3 rounded-lg max-w-2xl mx-auto">
          ❌ {error}
        </div>
      </div>
    );
  }

  return (
    <div className="md:p-8">
      <div className="w-full mx-auto">
        {/* En-tête */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-200">
            🍽️ Liste des Plats
          </h1>
          <span className="bg-blue-900/50 text-blue-300 px-3 py-1 rounded-full text-sm border border-blue-700">
            Total: {plats.length} plats
          </span>
        </div>

        {/* Grille des plats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {plats.map((plat) => (
            <div
              key={plat.id}
              className="bg-[#16213e] rounded-xl border border-[#2a3a6a] overflow-hidden hover:border-[#4a6aaa] transition-all duration-300 hover:shadow-xl hover:shadow-blue-900/20"
            >
              {/* Image et titre */}
              <div className="relative">
                <div className="w-20 h-20 object-cover overflow-hidden ">
                  {plat.image && (
                    <img
                      src={`https://kumeza-test-backend.burundientempsreel.com/${plat.image}`}
                      alt={plat.titre}
                      className="object-cover w-full h-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.png';
                      }}
                    />
                  )}

                </div>
                <div className="absolute top-2 right-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${plat.isMenyJours
                    ? 'bg-green-900/80 text-green-300 border border-green-700'
                    : 'bg-red-900/80 text-red-300 border border-red-700'
                    }`}>
                    {plat.isMenyJours ? '📅 Menu du jour' : '🔒 Non disponible'}
                  </span>
                </div>
              </div>

              <div className="p-4">
                {/* Titre et prix */}
                <div className="flex justify-between items-start mb-3">
                  <h2 className="text-xl font-semibold text-blue-300">
                    {plat.titre}
                  </h2>
                  <span className="text-lg font-bold text-green-400">
                    {parseInt(plat.prixPlats).toLocaleString()} BIF
                  </span>
                </div>

                {/* Informations principales */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center text-gray-400">
                    <span className="text-gray-500 w-20">Catégorie:</span>
                    <span className="text-gray-300">{plat.categories}</span>
                  </div>
                  <div className="flex items-center text-gray-400">
                    <span className="text-gray-500 w-20">Cuisine:</span>
                    <span className="text-gray-300">{plat.type_cuisine}</span>
                  </div>
                  <div className="flex items-center text-gray-400">
                    <span className="text-gray-500 w-20">Gastronomie:</span>
                    <span className="text-gray-300">{plat.gastronomique}</span>
                  </div>
                  <div className="flex items-center text-gray-400">
                    <span className="text-gray-500 w-20">Méthode:</span>
                    <span className="text-gray-300">{plat.methodes}</span>
                  </div>
                  <div className="flex items-center text-gray-400 col-span-2">
                    <span className="text-gray-500 w-20">Ingrédients:</span>
                    <span className="text-gray-300">{plat.ingredients}</span>
                  </div>
                </div>

                {/* Restaurant */}
                <div className="mt-4 pt-4 border-t border-[#2a3a6a]">
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-lg">🏪</span>
                    <span className="font-medium text-purple-300">
                      {plat.restaurants.nom}
                    </span>
                  </div>

                  {/* Moyens de paiement */}
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-2">💳 Moyens de paiement:</p>
                    <div className="flex flex-wrap gap-2">
                      {plat.restaurants.moyenPaiement.map((mp) => (
                        <span
                          key={mp.id}
                          className="bg-[#1b3a2a] text-green-300 px-3 py-1 rounded-full text-xs border border-[#2a5a3a]"
                        >
                          {mp.nom}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Détails paiement (accordéon) */}
                  <details className="mt-3">
                    <summary className="text-xs text-blue-400 cursor-pointer hover:text-blue-300">
                      📋 Voir les détails de paiement
                    </summary>
                    <div className="mt-2 space-y-2">
                      {plat.restaurants.moyenPaiement.map((mp) => (
                        <div
                          key={mp.id}
                          className="bg-[#0d0d1a] p-3 rounded-lg border border-[#2a2a4a] text-sm"
                        >
                          <p className="text-blue-300 font-medium">{mp.nom}</p>
                          <p className="text-gray-500 text-xs">
                            Code: <span className="text-gray-400">{mp.code}</span>
                          </p>
                          <p className="text-gray-500 text-xs">
                            Bénéficiaire: <span className="text-gray-400">{mp.nom_beneficiaire}</span>
                          </p>
                          <p className="text-gray-500 text-xs">
                            Statut: {mp.actif ? (
                              <span className="text-green-400">✅ Actif</span>
                            ) : (
                              <span className="text-red-400">❌ Inactif</span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>

                  {/* Date de création */}
                  <p className="text-xs text-gray-600 mt-3">
                    Créé le: {new Date(plat.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Aucun résultat */}
        {plats.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Aucun plat trouvé</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlatsList;