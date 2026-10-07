# Essai avant publication

Le ZIP contient l’application complète, sa compilation web et les projets Capacitor. L’importation du code ne copie pas les variables secrètes : conserver vos variables du serveur et suivre README.md.

1. Importer le projet complet dans l’environnement de test, démarrer le serveur Node et recharger l’aperçu.
2. Créer un profil ; essayer perdre, prendre et stabiliser. Insérer une photo depuis la caméra et la galerie, enregistrer une nouvelle pesée, fermer et rouvrir pour vérifier sa conservation. Deux pesées le même jour ont le même numéro de jour.
3. Composer un repas, modifier les grammes ou ml et vérifier calories et nutriments. Les recettes remplacent les photos génériques.
4. Choisir une des 20 langues. Le premier chargement peut prendre du temps : tous les textes sont traduits par le serveur avant application du choix. Vérifier en particulier stabilisation, recettes et détails des carrés d’information. Sans service de traduction valide, l’application refuse un mélange de langues.
5. Générer puis télécharger une vidéo. Le partage du fichier dépend de l’appareil. Importer le fichier téléchargé dans les autres plateformes lorsqu’elles acceptent son format (Instagram et Snapchat privilégient MP4). Pour un lien vidéo réel : APP_URL publique HTTPS, ENABLE_VIDEO_LINKS=true et dossier de données persistant ; accepter la publication, ouvrir le lien sur un autre appareil puis essayer sa suppression.
6. Sur l’offre sélectionnée, vérifier le tarif renvoyé par Stripe. Faire un paiement de test avec le même compte Stripe et le même mode test que ses liens, puis vérifier retour à l’écran d’origine et activation. Les liens fournis actuellement sont des liens de test ; une vente réelle nécessite les liens/prix et la clé du mode réel.
7. Ouvrir l’application hors de l’aperçu intégré pour tester les notifications HTTPS, ou tester l’application Capacitor sur un téléphone. Les boutons non pris en charge ne sont pas affichés dans l’aperçu. Les rappels du navigateur ne sont pas des notifications push lorsque l’application est fermée.

La génération de silhouette objectif est masquée pour cette version. Les photos de suivi et les comparaisons restent actives. Sa réactivation attend un essai réel réussi avec votre accès au modèle Google.

Les données restent sur l’appareil dans IndexedDB/localStorage, sauf partage administrateur explicitement activé et publication explicite d’une vidéo. Exporter les données depuis les paramètres pour les sauvegarder. Les liens vidéo révèlent aux personnes qui les possèdent les photos et mesures visibles dans la vidéo ; ils expirent après 7 jours.
