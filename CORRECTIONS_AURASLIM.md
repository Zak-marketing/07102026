# Corrections v3 — 5 octobre 2026

- Photo de nouvelle pesée : suppression de l’overlay blanc qui recouvrait l’aperçu en thème clair ; image entière visible ; actions sous la photo.
- Caméra : capture refusée tant que la vidéo n’est pas prête. Image décodée et redimensionnée avant enregistrement ; fichiers illisibles refusés et URL temporaires libérées.
- Objectif IA : commandes et case de consentement retirées de l’inscription et de l’évolution photos. Route désactivée par défaut, sans faux résultat. Photos initiale et actuelle, comparaisons et historique conservés.
- Composer vos plats : suppression des photos génériques et de l’historique inférieur en double. 180 recettes courtes adaptées aux plats. Champ de quantité prérempli avec un nombre, bordure visible, unité et explication du recalcul automatique.
- Partage vidéo : plus de faux lien pointant vers la page d’accueil. Export MP4 si le navigateur le permet, sinon WebM. Partage du fichier uniquement si disponible. Téléchargement pour WhatsApp, Viber, Facebook, Instagram et Snapchat. Lien vers la véritable vidéo disponible sur une adresse publique configurée, avec consentement, expiration et suppression.
- Paramètres : section montre et activité retirée. Couleurs foncées sur les surfaces claires. Boutons de test de rappel disponibles uniquement lorsque les notifications sont possibles ; une erreur n’est plus présentée comme un envoi réussi.
- Notifications : canal Android créé avant les tests ; notification du navigateur par service worker si disponible. Les rappels web restent limités au fonctionnement de la page ouverte ; les applications natives utilisent les notifications locales.
- Paiement : résolution des prix mensuels depuis les identifiants configurés ou les liens Stripe fournis. Le prix réel est affiché avant le clic. Si le prix change, un nouveau choix est demandé. Validation d’un paiement terminé et payé, abonnement actif et appareil correspondant. Retour à l’onglet et à la position sauvegardés.
- Traductions : 20 langues sélectionnées conservées. Stabilisation en arabe : « تثبيت الوزن ». Catalogue complémentaire couvrant textes directs, recettes, descriptions, attributs, boutons et fenêtres. Dictionnaires complets vérifiés avant application, paramètres des textes préservés, cache persistant et aucune valeur personnelle envoyée au traducteur.
- PDF : traduction aussi appliquée aux textes directement écrits dans le générateur ; photos et miniatures conservées.
- Mobile : labels longs repliés et troncatures supprimées sur les petits écrans.

## Validation et limites concrètes

Compilation TypeScript et production, routes API, gestion des photos, historique Jour 1/Jour 2, redirections Stripe, refus des paiements non confirmés, schémas complets des 20 langues, recettes, stockage/suppression/expiration des liens vidéo et génération PDF vérifiés par les scripts inclus.

Les réponses Google et Stripe des tests sont simulées. Les clés de votre déploiement ne sont pas accessibles dans cet environnement. Le règlement réel, la qualité linguistique des traductions fournies par Google, les autorisations des téléphones et le résultat de génération Gemini nécessitent un essai avec vos comptes/appareils. Cette version ne présente pas la génération objectif comme validée.
