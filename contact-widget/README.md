# Widget de contact "Oui / Non" — version 100% gratuite

Une bulle flottante en bas à droite du site. Le visiteur clique, on lui demande s'il veut être
contacté :

- **Oui** → il laisse son numéro → notification immédiate et gratuite à l'agent avec le numéro.
- **Non** → « avez-vous une question ? » → il tape sa question (+ numéro facultatif) →
  notification à l'agent avec la question. L'agent voit tout dans un petit tableau de bord (PC ou
  téléphone).

## Important : pourquoi Telegram et pas des SMS

Vous m'avez demandé que ce soit **vraiment gratuit, pas 1 centime**. Or envoyer un vrai SMS à un
vrai numéro de téléphone coûte toujours de l'argent à quelqu'un (Twilio, et tous les services
sérieux équivalents, font payer chaque SMS). Il n'existe pas de service fiable qui fasse ça
gratuitement et sans limite.

La solution réellement gratuite, illimitée, et qui fait le même travail (prévenir l'agent
instantanément, consultable sur téléphone ET sur PC), c'est **Telegram** :

- C'est gratuit à 100 %, sans carte bancaire, sans limite de messages.
- L'agent reçoit une **notification push sur son téléphone**, exactement comme un SMS.
- Elle peut aussi l'ouvrir sur **PC** (appli Telegram Desktop ou simplement web.telegram.org).
- **Seule l'agent a besoin de Telegram.** Les visiteurs du site, eux, n'utilisent que la bulle sur
  le site — ils n'ont rien à installer, rien à savoir sur Telegram.

Conséquence sur le fonctionnement : comme le système n'envoie plus de SMS automatique, la
**réponse au visiteur se fait manuellement**, par l'agent elle-même, avec son propre téléphone
(appel, SMS personnel ou WhatsApp) — exactement ce qu'elle aurait fait de toute façon en recevant
un appel. Le tableau de bord sert à garder une trace de qui a été recontacté.

## Comment ça marche, en une image

```
Site du client A ──┐
Site du client B ──┼──►  widget.js (bulle)  ──►  votre backend Netlify (gratuit)
Site du client C ──┘                                       │
                                        ┌────────────────────┴───────────────────┐
                                        ▼                                        ▼
                          Notification Telegram (gratuite)          Tableau de bord (dashboard.html)
                          sur le téléphone/PC de l'agent             historique + suivi, PC ou téléphone
```

**Un seul backend** (hébergé une fois sur Netlify, gratuit) sert **tous vos sites clients**. Sur
chaque site, vous ne collez qu'une seule ligne de code qui pointe vers ce backend. Pour changer
qui reçoit les notifications, vous modifiez **une seule variable** dans Netlify — aucun code à
toucher, et ça s'applique à tous les sites d'un coup.

## Ce dont vous avez besoin (tout est gratuit)

1. Un compte **Netlify** (gratuit) — [netlify.com](https://www.netlify.com). Le plan gratuit
   couvre très largement l'usage d'un petit nombre de sites clients (largement plus de 100 000
   requêtes par mois incluses).
2. Un compte **Telegram** (gratuit) pour l'agent — juste l'appli qu'on installe normalement.
3. Un compte **GitHub** (gratuit) — la façon la plus simple de déployer sur Netlify.

Vous ne faites tout ça **qu'une seule fois** : ce backend sert ensuite pour tous les sites de
toutes vos clientes.

---

## Étape 1 — Créer un bot Telegram gratuit (2 minutes)

1. Ouvrez Telegram, cherchez le compte **@BotFather** (le bot officiel qui crée des bots).
2. Envoyez-lui `/newbot`, donnez un nom à votre bot (ex : "Notifs Agence Dupont"), puis un
   identifiant unique se terminant par "bot" (ex : `agencedupont_notif_bot`).
3. BotFather vous donne un **jeton (token)** du type `123456789:AAxxxxxxxxxxxxxxxxx` — copiez-le,
   c'est votre `TELEGRAM_BOT_TOKEN`.

## Étape 2 — Récupérer l'identifiant Telegram de l'agent

1. Dans Telegram, l'agent cherche votre bot (par le nom que vous lui avez donné) et lui envoie
   n'importe quel message (ex : "bonjour") pour "l'activer" auprès d'elle.
2. Pour connaître son identifiant de discussion (`chat_id`), le plus simple : cherchez le bot
   **@userinfobot** sur Telegram, envoyez-lui un message, il répond immédiatement avec votre
   identifiant numérique. C'est ce nombre qu'il faut utiliser comme `TELEGRAM_CHAT_ID` — à
   condition que ce soit bien la personne qui a aussi démarré une conversation avec VOTRE bot à
   l'étape précédente.

## Étape 3 — Déployer le backend sur Netlify

**Option simple (recommandée) : via GitHub**

1. Créez un nouveau dépôt GitHub et déposez-y tous les fichiers de ce projet (vous pouvez
   glisser-déposer le dossier directement sur github.com si vous ne connaissez pas encore Git).
2. Sur Netlify : **Add new site → Import an existing project → GitHub**, choisissez ce dépôt.
3. Netlify détecte automatiquement `netlify.toml` (dossier `public` publié, fonctions dans
   `netlify/functions`). Laissez les réglages par défaut et cliquez sur **Deploy**.

**Option alternative : sans GitHub, avec Netlify CLI**

```bash
npm install -g netlify-cli
cd contact-widget
netlify deploy --prod
```

Suivez les instructions à l'écran (connexion à votre compte, création d'un nouveau site).

## Étape 4 — Configurer les variables (l'identifiant à changer facilement, etc.)

Dans Netlify : **Site settings → Environment variables**, ajoutez :

| Variable | Exemple | Rôle |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `123456789:AAxxxx...` | Le jeton du bot créé à l'étape 1 |
| `TELEGRAM_CHAT_ID` | `123456789` | **Qui reçoit les notifications.** C'est ce que vous changez quand vous voulez notifier quelqu'un d'autre. |
| `ADMIN_PASSWORD` | *(choisissez un mot de passe solide)* | Protège le tableau de bord |
| `DASHBOARD_URL` | `https://votre-site.netlify.app/dashboard.html` | Facultatif, pour un lien cliquable dans la notification |
| `TELEGRAM_WEBHOOK_SECRET` | *(une chaîne aléatoire de votre choix)* | Facultatif mais recommandé, sécurise la fonction "Répondre" (voir étape 4bis) |

Après avoir ajouté ces variables, cliquez sur **Trigger deploy → Deploy site** une fois pour
qu'elles soient prises en compte.

**Pour changer qui reçoit les notifications plus tard :** revenez dans cette page, modifiez
`TELEGRAM_CHAT_ID` (avec l'identifiant de la nouvelle personne, récupéré via @userinfobot comme à
l'étape 2 — elle doit avoir démarré une conversation avec votre bot au préalable), redéployez (un
clic). Ça prend 30 secondes, aucun code à modifier.

## Étape 4bis — Activer la fonction "Répondre" de Telegram (IMPORTANT, à ne pas sauter)

Sans cette étape, quand l'agent utilise "Répondre" sur une notification Telegram, **rien ne se
passe** : Telegram ne sait pas encore qu'il doit prévenir votre backend. Il faut le lui dire
**une seule fois** (et à refaire seulement si vous changez `TELEGRAM_BOT_TOKEN`) :

1. Ouvrez dans votre navigateur :
   `https://VOTRE-SITE.netlify.app/.netlify/functions/setup-webhook?pw=VOTRE_ADMIN_PASSWORD`
2. Vous devez voir un message `"✅ Webhook Telegram enregistré..."`.
3. (Facultatif mais recommandé) Ajoutez une variable d'environnement
   `TELEGRAM_WEBHOOK_SECRET` (une chaîne aléatoire de votre choix, ex. générée sur
   [randomkeygen.com](https://randomkeygen.com)) **avant** de faire l'étape 1 ci-dessus, puis
   redéployez. Ça empêche n'importe qui de faire semblant d'être Telegram et d'injecter de faux
   messages "agent" dans les conversations.
4. Pour vérifier à tout moment que le webhook est bien actif, sans rien changer :
   `https://VOTRE-SITE.netlify.app/.netlify/functions/setup-webhook?pw=VOTRE_ADMIN_PASSWORD&check=1`

## Étape 5 — Récupérer votre lien widget et votre lien tableau de bord

Une fois déployé, votre site Netlify a une adresse du type `https://mon-backend.netlify.app`.
Vous avez alors :

- **Le widget à coller sur les sites clients** : `https://mon-backend.netlify.app/widget.js`
- **Le tableau de bord pour l'agent** : `https://mon-backend.netlify.app/dashboard.html`

---

## Étape 6 — Installer la bulle sur un site client

Sur **n'importe quel site**, collez cette ligne juste avant la balise `</body>` (ou dans une zone
« code personnalisé / HTML » si le site ne vous laisse pas éditer le code directement) :

```html
<script src="https://mon-backend.netlify.app/widget.js" data-site="Nom de la cliente" async></script>
```

C'est tout — une seule ligne, aucun autre fichier à copier. Elle fonctionne sur n'importe quel
type de site (HTML classique, WordPress, Netlify, etc.) car le widget est isolé visuellement du
reste de la page (il ne peut pas casser le design existant, et le design existant ne peut pas le
déformer).

Attributs facultatifs sur cette même balise :

- `data-site="Nom"` — nom affiché dans le tableau de bord pour savoir de quel site vient le
  message (sinon, le nom de domaine est utilisé automatiquement).
- `data-color="#1a56db"` — couleur de la bulle, pour l'assortir à la charte du site.
- `data-notify="123456789"` — si **ce site précis** doit notifier un identifiant Telegram
  différent de celui par défaut (rare, à utiliser seulement si vous gérez plusieurs agents).

### Sur un site hébergé sur Netlify

Exactement la même chose : ouvrez le fichier HTML de la page (ou le composant commun / layout si
c'est un site généré), collez la ligne `<script>` ci-dessus, puis redéployez ce site normalement.
Le fait que votre backend soit *aussi* sur Netlify ne change rien : ce sont deux sites Netlify
indépendants, comme deux sites indépendants sur n'importe quel autre hébergeur.

### Sur WordPress

Extensions comme « Insert Headers and Footers » (ou dans votre thème : Apparence → Éditeur de
thème → footer.php), collez la balise juste avant `</body>`.

### Sur Wix / Squarespace / Webflow

Ces plateformes ont toutes une section **« Code personnalisé / Custom code / Embed »** dans les
réglages du site, où l'on colle exactement ce type de balise `<script>`.

### Sur un site créé par Apimo™

Bonne nouvelle : les offres de sites Apimo (« Website » et les offres sur-mesure) indiquent
explicitement qu'il est possible d'incorporer un widget externe via un script ou une iframe.
Concrètement :

1. Dans le back-office du site Apimo de votre cliente, cherchez le module **« Widget externe »**
   (ou « Code personnalisé » selon les versions).
2. Collez-y la même balise `<script>` que ci-dessus.
3. Si Apimo ne propose que l'option « iframe » et refuse le `<script>` direct, dites-le-moi : il
   est possible d'adapter le widget pour qu'il tourne dans une iframe, mais la version script est
   préférable (meilleure intégration visuelle, bulle vraiment flottante).

Comme chaque back-office évolue et que je n'ai pas un accès direct à celui de votre cliente, si
le nom exact du module diffère de ce que je décris, contactez le support Apimo en leur demandant
littéralement « comment ajouter un script/widget externe sur mon site », leur documentation
confirme que c'est une fonctionnalité prévue.

---

## Utiliser le tableau de bord (PC et téléphone)

Rien à installer : c'est une simple page web, donc elle marche pareil sur ordinateur et sur
mobile.

1. Ouvrez `https://mon-backend.netlify.app/dashboard.html`.
2. Entrez le mot de passe défini dans `ADMIN_PASSWORD`.
3. La liste des messages apparaît, triée du plus récent au plus ancien, avec un bandeau rouge sur
   les nouveaux. Elle se rafraîchit toute seule toutes les 15 secondes.
4. L'agent recontacte le visiteur elle-même (appel, SMS ou WhatsApp personnel) grâce au numéro
   affiché, puis note ce qu'elle a répondu dans le champ prévu et clique sur « Enregistrer et
   marquer comme traité » — ça garde un historique propre.

**La vraie notification instantanée, c'est Telegram** : l'agent la reçoit directement sur son
téléphone dès qu'un visiteur envoie quelque chose, sans avoir besoin de garder le tableau de bord
ouvert. Le tableau de bord sert surtout à consulter l'historique complet et à savoir ce qui a déjà
été traité.

**Astuce pratique** : sur téléphone, ouvrez le lien du tableau de bord dans le navigateur puis
utilisez « Ajouter à l'écran d'accueil » (Safari/Chrome) — ça crée une icône qui s'ouvre comme une
application, sans rien installer de spécial.

---

## Combien ça coûte : 0 €

- **Netlify** : gratuit (hébergement, fonctions serveur et stockage des messages sont tous dans
  la limite du plan gratuit pour ce type d'usage).
- **Telegram** : gratuit, illimité, pas de carte bancaire.
- **Total : 0 centime**, tant que le volume reste raisonnable pour une PME (le plan gratuit
  Netlify autorise largement plus de messages que ce qu'un site de petite agence reçoit).

---

## Sécurité et bon sens

- Changez `ADMIN_PASSWORD` pour quelque chose de vraiment solide, et ne le partagez qu'avec les
  personnes qui doivent consulter les messages.
- Ce système stocke des numéros de téléphone et des messages de visiteurs : pensez à informer vos
  clientes que ces données doivent être traitées conformément au RGPD (ne les conserver que le
  temps nécessaire, ne pas les réutiliser à d'autres fins que répondre au visiteur).
- Le mot de passe du tableau de bord est volontairement simple (protection basique). Si une
  cliente a besoin d'un vrai système multi-utilisateurs avec comptes séparés, ça se fait, mais
  c'est un cran de complexité en plus — dites-le-moi si besoin.
- Ne partagez jamais votre `TELEGRAM_BOT_TOKEN` publiquement : avec ce jeton, n'importe qui peut
  envoyer des messages "au nom" de votre bot.

## Limites actuelles (et pistes d'amélioration si besoin un jour)

- La réponse au visiteur n'est pas automatisée (pas de SMS sortant) : c'est le prix de la
  gratuité totale. L'agent répond avec son propre téléphone.
- Un seul mot de passe partagé pour le tableau de bord (pas de comptes individuels).
- Le tableau de bord se rafraîchit toutes les 15 secondes plutôt qu'en temps réel instantané (la
  notification Telegram, elle, est instantanée).
- Si un jour vous changez d'avis et acceptez un petit coût pour des SMS automatiques envoyés
  directement au visiteur, je peux réintégrer Twilio en quelques minutes — l'architecture s'y
  prête, ce n'est qu'une fonction à modifier.

---

## Récapitulatif express

1. Créer un bot Telegram gratuit via @BotFather → noter le token.
2. Récupérer l'identifiant Telegram de l'agent via @userinfobot.
3. Déployer ce dossier sur Netlify (via GitHub, le plus simple).
4. Renseigner les variables d'environnement dans Netlify (token + chat id en premier).
5. Coller `<script src="https://VOTRE-SITE.netlify.app/widget.js" data-site="..." async></script>`
   sur chaque site client (HTML, WordPress, Netlify, Apimo, etc. — même balise partout).
6. Donner l'adresse `https://VOTRE-SITE.netlify.app/dashboard.html` + le mot de passe à l'agent,
   et lui dire d'installer Telegram si elle ne l'a pas déjà.
