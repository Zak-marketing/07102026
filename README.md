# AuraSlim — version corrigée du 6 octobre 2026 (v4)

Application React/Vite avec serveur Express, projets Android et iOS Capacitor, et interface adaptée aux téléphones.

## Démarrer et tester

Avec Node.js 24 LTS :

```bash
npm ci
cp .env.example .env
npm run dev
```

Ouvrir l’adresse du serveur (port 3000 par défaut). Pour la version compilée : `npm run build`, puis `npm start`. Le serveur Node doit rester actif : un hébergement de fichiers statiques seul ne suffit pas pour les API, les traductions et Stripe.

## Configuration serveur

- `GEMINI_API_KEY` : scan de repas et InBody. `GEMINI_MODEL` : modèle texte/vision accessible sur ce compte.
- `GOOGLE_CLOUD_TRANSLATE_API_KEY` : traduction de tous les écrans dans les 20 langues proposées. Si cette clé est absente, Gemini peut traduire avec sa clé. Une traduction incomplète est refusée ; le choix précédent reste conservé.
- `STRIPE_SECRET_KEY` : clé secrète du compte contenant vos offres. Le mode test ou réel doit correspondre aux liens/prix utilisés.
- `STRIPE_PRICE_SCAN_MEALS`, `STRIPE_PRICE_PROGRESS_VIDEO`, `STRIPE_PRICE_COMPLETE_PACK` : facultatifs si les trois liens de paiement fournis sont toujours présents dans ce compte. L’application résout alors leurs prix automatiquement. Le montant mensuel EUR réel est affiché avant paiement ; aucun changement automatique de prix Stripe.
- `APP_URL` : adresse HTTPS publique de cette application. Elle doit correspondre à son origine dans le navigateur. Nécessaire pour les liens vidéo publics et recommandé pour le retour de Stripe.
- `AURASLIM_DATA_DIR` : chemin privé et persistant, par exemple `/data/auraslim`. Ne pas le placer dans `dist` ou `public`.
- `ENABLE_VIDEO_LINKS=true` : permet de publier une vidéo par lien après l’accord de son utilisateur. Liens valables 7 jours, fichiers WebM/MP4 de 20 Mo maximum, suppression possible par leur créateur.
- `AURASLIM_ADMIN_PASSWORD` : facultatif ; au moins 20 caractères pour activer l’administration.

Les secrets restent exclusivement sur le serveur et ne sont pas inclus dans le ZIP. Conserver vos variables déjà renseignées lors du remplacement du code.

## Objectifs et navigation simplifiés

Une alerte rouge apparaît si les calories de la journée dépassent le repère. Lors de l’ajout d’un repas, elle reste visible même lorsque le résumé est hors écran. Le bouton « Terminer ma journée » affiche une félicitation si l’hydratation est atteinte et les calories sont entre 90 % et 100 % du repère. Une journée très peu nourrie n’est pas récompensée. Le bilan reste modifiable et suit la date locale du téléphone.

Les périodes Matin, Midi, Pause après-midi et Soir défilent horizontalement, avec des boutons qui gardent une largeur lisible et un accès au clavier. Les quantités restent modifiables. Les portions de départ tiennent compte du budget estimé lorsque l’activité est renseignée ; vos saisies manuelles restent prioritaires.

L’inscription et les paramètres proposent le sexe de calcul facultatif, les déplacements hors sport, le temps de sport hebdomadaire et les situations nécessitant un suivi professionnel. Ces réponses adaptent les calories, le repère d’eau, les repas et le programme d’activité. L’objectif d’eau défini manuellement reste prioritaire. Une photo est facultative pour commencer.

Le métabolisme de repos utilise le dernier relevé InBody disponible, sinon Mifflin–St Jeor. Sans sexe de calcul, l’estimation utilise un point intermédiaire et indique sa précision limitée. Les facteurs de mouvement 1,20 / 1,35 / 1,50 / 1,65 et l’ajout d’exercice modéré sont des hypothèses de départ, pas une mesure du métabolisme. L’exercice est ajouté séparément aux déplacements habituels. Perte : réduction au plus de 300 kcal/jour ou 15 % de la dépense ; prise : environ +300 kcal ; stabilisation : dépense estimée. Un plancher prudent de 1500 kcal et du métabolisme au repos s’applique. Ces choix ne constituent pas un régime exact ni une prescription médicale.

Le repère de boisson est ajustable selon le poids, les mouvements et le sport, entre 1,75 et 3 L en mode automatique. Il s’agit d’un guide de départ ; chaleur, transpiration, soif et consignes médicales peuvent nécessiter un autre objectif. Grossesse, allaitement, restrictions médicales ou objectif de perte vers un IMC inférieur à 18,5 bloquent le programme automatique de déficit/surplus. Les macros InBody sont une répartition indicative des calories, pas des mesures physiologiques ni un diagnostic hormonal.

## Retour Stripe et conservation du suivi

Scan Repas revient au calculateur/scanner. Galerie & Vidéo revient aux photos et ouvre la vidéo lorsqu’au moins deux photos sont disponibles. Le Pack complet revient à la fonctionnalité d’origine ; depuis les offres du compte, il ouvre le tableau de bord. Une annulation revient à l’écran de départ.

Avant de quitter l’application, le profil, les photos, les pesées, les repas, l’eau, les rappels, les bilans InBody et les fins de journée sont sauvegardés sous forme chiffrée AES-GCM. Un secret de reprise se trouve dans le fragment de l’URL de retour, pas dans les paramètres envoyés au serveur par le navigateur. Ce lien doit rester privé. Le serveur lie la reprise à la session Stripe ; il vérifie le paiement séparément avant d’accorder Premium. Restaurer les données ne suffit jamais à activer une offre. Le profil n’est pas remplacé s’il est déjà présent, pour conserver les ajouts faits pendant le paiement.

La sauvegarde expire après 24 heures et est supprimée après confirmation de reprise. Si la reprise échoue, un écran permet de réessayer ; l’application ne renvoie pas automatiquement vers une nouvelle inscription.

**Cloud Run : un dossier local de conteneur n’est pas un stockage partagé ou persistant.** Pour un retour pouvant arriver sur une autre instance, choisissez l’une de ces configurations avant le test Stripe :

- Monter un volume privé partagé et renseigner son chemin dans `AURASLIM_DATA_DIR`.
- Renseigner `AURASLIM_BACKUP_BUCKET` avec un bucket Cloud Storage privé existant. Le compte de service Cloud Run doit pouvoir créer, lire et supprimer ses objets (rôle `roles/storage.objectUser` sur ce bucket). L’authentification utilise le compte de service, sans nouvelle clé API dans le navigateur. Garder le bucket privé, sans accès public, et appliquer une règle de cycle de vie supprimant les objets `auraslim-checkout/` âgés d’au moins un jour. Aucune création de bucket ni modification IAM n’est effectuée par l’application.

Le fichier `cloud-storage-lifecycle.json` contient cette règle pour un bucket dédié. Le ZIP n’installe pas un volume ou un bucket dans votre compte. Conserver `APP_URL` identique à l’origine publique de l’application et tester à cette adresse. Les données déjà enregistrées à une autre adresse de navigateur ne migrent pas simplement en changeant de domaine : utiliser l’export/import des paramètres si nécessaire.

## Photos et objectif IA

Les photos personnelles et les pesées restent disponibles. La génération de photo objectif a été retirée des écrans pour cette version, comme demandé : un appel réel avec votre compte Gemini n’a pas pu être validé ici. `ENABLE_GOAL_PHOTO=false` conserve aussi la route serveur désactivée par défaut. Modifier uniquement ce paramètre ne rétablit pas les boutons retirés.

L’intégration serveur conservée utilise `GEMINI_IMAGE_MODEL=gemini-3.1-flash-image` et l’API Interactions Google. Le cadrage complet ne concerne que la génération ; une photo partielle est acceptée pour le suivi normal. Une future réactivation exige un test réel de perte, prise et stabilisation, après consentement, avec contrôle de l’image renvoyée. L’image serait une illustration hypothétique, jamais une prédiction de l’apparence future.

## Vérifications

```bash
npm run lint
node --import tsx scripts/verify-api.mts
node --import tsx scripts/verify-followup.mts
node --import tsx scripts/verify-current.mts
node --import tsx scripts/verify-v4.mts
node scripts/verify-pdf.mjs
npm run build
npx cap sync
```

Pour une modification de texte : régénérer le catalogue avec `node --import tsx scripts/extract-ui-catalog.mts` avant de compiler. Le cache de traduction change automatiquement lorsque les sources changent. Les tests de Google et Stripe sont simulés ; aucun paiement réel n’a été effectué pour ces vérifications.

Sources des intégrations : [Google image generation](https://ai.google.dev/gemini-api/docs/image-generation), [Stripe Checkout](https://docs.stripe.com/api/checkout/sessions/create), [Web Share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share).

Sources des repères : [Mifflin–St Jeor, 1990](https://pubmed.ncbi.nlm.nih.gov/2305711/), [CDC : activité des adultes](https://www.cdc.gov/physical-activity-basics/guidelines/adults.html), [NHS : prise de poids progressive](https://www.nhs.uk/live-well/healthy-weight/managing-your-weight/healthy-ways-to-gain-weight/), [NHS : hydratation](https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/water-drinks-nutrition/), [National Academies : répartition des macronutriments](https://www.nationalacademies.org/read/27957/chapter/5). Les formules d’activité et de boisson sont des choix d’implémentation explicitement estimatifs.
