/*!
 * Widget de contact - bulle flottante
 * Usage : <script src="https://VOTRE-BACKEND.netlify.app/widget.js" data-site="Nom du site" async></script>
 *
 * Attributs optionnels sur la balise <script> :
 *   data-api    -> URL du backend si différente de l'URL du script (rare)
 *   data-site   -> nom affiché dans le tableau de bord (par défaut : nom de domaine du site)
 *   data-color  -> couleur d'accent en hexadécimal, ex: "#1a73e8"
 *   data-notify -> identifiant Telegram à notifier POUR CE SITE précis (remplace celui par défaut)
 */
(function () {
  "use strict";

  var currentScript = document.currentScript;
  if (!currentScript) {
    // Repli pour les anciens navigateurs / chargement asynchrone tardif
    var scripts = document.getElementsByTagName("script");
    currentScript = scripts[scripts.length - 1];
  }

  var API_BASE = currentScript.getAttribute("data-api") || new URL(currentScript.src).origin;
  var SITE_NAME = currentScript.getAttribute("data-site") || window.location.hostname;
  var ACCENT = currentScript.getAttribute("data-color") || "#1a56db";
  var SITE_NOTIFY_OVERRIDE = currentScript.getAttribute("data-notify") || "";

  // Évite les doublons si le script est chargé deux fois par erreur
  if (window.__contactWidgetLoaded) return;
  window.__contactWidgetLoaded = true;

  var host = document.createElement("div");
  host.id = "contact-widget-host";
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent = [
    ":host, *{box-sizing:border-box;}",
    ".cw-wrap{position:fixed;bottom:20px;right:20px;z-index:2147483000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}",
    ".cw-bubble{width:58px;height:58px;border-radius:50%;background:" + ACCENT + ";box-shadow:0 4px 14px rgba(0,0,0,.25);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s ease;}",
    ".cw-bubble:hover{transform:scale(1.06);}",
    ".cw-bubble svg{width:26px;height:26px;fill:#fff;}",
    ".cw-panel{position:absolute;bottom:72px;right:0;width:300px;max-width:calc(100vw - 32px);background:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.2);overflow:hidden;display:none;flex-direction:column;border:1px solid #eee;}",
    ".cw-panel.open{display:flex;}",
    ".cw-header{background:" + ACCENT + ";color:#fff;padding:14px 16px;font-weight:600;font-size:15px;display:flex;align-items:center;justify-content:space-between;}",
    ".cw-close{background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;opacity:.85;padding:2px 4px;}",
    ".cw-close:hover{opacity:1;}",
    ".cw-body{padding:16px;}",
    ".cw-question{font-size:14px;color:#222;margin:0 0 12px;line-height:1.4;}",
    ".cw-choices{display:flex;gap:10px;}",
    ".cw-choice-btn{flex:1;padding:10px 0;border-radius:10px;border:1.5px solid " + ACCENT + ";background:#fff;color:" + ACCENT + ";font-size:14px;font-weight:600;cursor:pointer;transition:background .15s;}",
    ".cw-choice-btn:hover{background:" + ACCENT + "1a;}",
    ".cw-choice-btn.primary{background:" + ACCENT + ";color:#fff;}",
    ".cw-choice-btn.primary:hover{filter:brightness(1.08);}",
    "label.cw-label{display:block;font-size:12.5px;color:#555;margin-bottom:6px;font-weight:500;}",
    ".cw-input,.cw-textarea{width:100%;border:1.5px solid #ddd;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;margin-bottom:12px;outline:none;color:#111;}",
    ".cw-input:focus,.cw-textarea:focus{border-color:" + ACCENT + ";}",
    ".cw-textarea{resize:vertical;min-height:72px;}",
    ".cw-send{width:100%;padding:11px 0;border-radius:10px;border:none;background:" + ACCENT + ";color:#fff;font-size:14px;font-weight:600;cursor:pointer;}",
    ".cw-send:hover{filter:brightness(1.08);}",
    ".cw-send:disabled{opacity:.6;cursor:default;}",
    ".cw-back{background:none;border:none;color:#888;font-size:12.5px;cursor:pointer;margin-bottom:10px;padding:0;}",
    ".cw-success{text-align:center;padding:8px 0 4px;}",
    ".cw-success svg{width:40px;height:40px;fill:#22c55e;margin-bottom:8px;}",
    ".cw-success p{font-size:14px;color:#333;margin:0;line-height:1.4;}",
    ".cw-small{font-size:11.5px;color:#999;margin-top:4px;}",
    "input.cw-hp{position:absolute;left:-9999px;top:-9999px;}"
  ].join("\n");
  root.appendChild(style);

  var wrap = document.createElement("div");
  wrap.className = "cw-wrap";
  wrap.innerHTML =
    '<button class="cw-bubble" type="button" aria-label="Nous contacter">' +
      '<svg viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-5 4V6a2 2 0 0 1 2-2z"/></svg>' +
    "</button>" +
    '<div class="cw-panel"><div class="cw-header"><span>Une question ?</span><button class="cw-close" type="button" aria-label="Fermer">&#10005;</button></div><div class="cw-body" id="cw-body"></div></div>';
  root.appendChild(wrap);

  var bubble = wrap.querySelector(".cw-bubble");
  var panel = wrap.querySelector(".cw-panel");
  var closeBtn = wrap.querySelector(".cw-close");
  var body = wrap.querySelector("#cw-body");

  bubble.addEventListener("click", function () {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) renderStep1();
  });
  closeBtn.addEventListener("click", function () {
    panel.classList.remove("open");
  });

  function renderStep1() {
    body.innerHTML =
      '<p class="cw-question">Souhaitez-vous être contacté(e) ?</p>' +
      '<div class="cw-choices">' +
        '<button class="cw-choice-btn primary" id="cw-yes" type="button">Oui</button>' +
        '<button class="cw-choice-btn" id="cw-no" type="button">Non</button>' +
      "</div>";
    body.querySelector("#cw-yes").addEventListener("click", renderPhoneForm);
    body.querySelector("#cw-no").addEventListener("click", renderQuestionForm);
  }

  function renderPhoneForm() {
    body.innerHTML =
      '<button class="cw-back" type="button">&#8592; Retour</button>' +
      '<label class="cw-label">Votre numéro de téléphone</label>' +
      '<input class="cw-input" id="cw-phone" type="tel" placeholder="06 12 34 56 78" autocomplete="tel" />' +
      '<input class="cw-hp" id="cw-hp1" tabindex="-1" autocomplete="off" />' +
      '<button class="cw-send" id="cw-send-phone" type="button">Envoyer</button>' +
      '<p class="cw-small">Nous vous rappelons dans les meilleurs délais.</p>';
    body.querySelector(".cw-back").addEventListener("click", renderStep1);
    body.querySelector("#cw-send-phone").addEventListener("click", function () {
      var phone = body.querySelector("#cw-phone").value.trim();
      var hp = body.querySelector("#cw-hp1").value;
      if (!phone) {
        body.querySelector("#cw-phone").focus();
        return;
      }
      submit({ type: "call", phone: phone, hp: hp }, this);
    });
  }

  function renderQuestionForm() {
    body.innerHTML =
      '<button class="cw-back" type="button">&#8592; Retour</button>' +
      '<label class="cw-label">Votre question</label>' +
      '<textarea class="cw-textarea" id="cw-question" placeholder="Écrivez votre question ici..."></textarea>' +
      '<label class="cw-label">Votre téléphone (facultatif, pour qu\u2019on puisse vous répondre)</label>' +
      '<input class="cw-input" id="cw-phone2" type="tel" placeholder="06 12 34 56 78" autocomplete="tel" />' +
      '<input class="cw-hp" id="cw-hp2" tabindex="-1" autocomplete="off" />' +
      '<button class="cw-send" id="cw-send-question" type="button">Envoyer</button>';
    body.querySelector(".cw-back").addEventListener("click", renderStep1);
    body.querySelector("#cw-send-question").addEventListener("click", function () {
      var question = body.querySelector("#cw-question").value.trim();
      var phone = body.querySelector("#cw-phone2").value.trim();
      var hp = body.querySelector("#cw-hp2").value;
      if (!question) {
        body.querySelector("#cw-question").focus();
        return;
      }
      submit({ type: "question", question: question, phone: phone, hp: hp }, this);
    });
  }

  function renderSuccess(message) {
    body.innerHTML =
      '<div class="cw-success">' +
        '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>' +
        "<p>" + message + "</p>" +
      "</div>";
  }

  function submit(payload, btnEl) {
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.textContent = "Envoi...";
    }
    payload.site = SITE_NAME;
    if (SITE_NOTIFY_OVERRIDE) payload.notifyChatId = SITE_NOTIFY_OVERRIDE;
    payload.pageUrl = window.location.href;

    fetch(API_BASE + "/.netlify/functions/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        if (!r.ok) throw new Error("bad status");
        return r.json();
      })
      .then(function () {
        renderSuccess(
          payload.type === "call"
            ? "Merci ! Nous allons vous contacter très rapidement."
            : "Merci ! Votre question a bien été envoyée, nous vous répondrons rapidement."
        );
      })
      .catch(function () {
        renderSuccess("Une erreur est survenue. Merci de réessayer un peu plus tard.");
      });
  }
})();
