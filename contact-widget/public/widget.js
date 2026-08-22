/*!
 * Widget de contact - bulle flottante + chat en direct
 * Usage normal : <script src="https://VOTRE-BACKEND.netlify.app/widget.js" data-site="Nom du site" async></script>
 * Usage en iframe : ajoutez data-embed="iframe" (voir widget-frame.html)
 *
 * Attributs optionnels sur la balise <script> :
 *   data-api    -> URL du backend si différente de l'URL du script (rare)
 *   data-site   -> nom affiché dans le tableau de bord (par défaut : nom de domaine du site)
 *   data-color  -> couleur d'accent en hexadécimal, ex: "#5DA9DA" (par défaut, bleu ciel)
 *   data-beige  -> couleur secondaire (beige) en hexadécimal
 *   data-avatar -> URL d'une image d'avatar pour la bulle (par défaut : avatar.png sur le backend)
 *   data-notify -> identifiant Telegram à notifier POUR CE SITE précis (remplace celui par défaut)
 *   data-embed  -> mettre "iframe" pour un affichage encastré, sans bulle flottante, toujours ouvert
 */
(function () {
  "use strict";

  var currentScript = document.currentScript;
  if (!currentScript) {
    var scripts = document.getElementsByTagName("script");
    currentScript = scripts[scripts.length - 1];
  }

  var API_BASE = currentScript.getAttribute("data-api") || new URL(currentScript.src).origin;
  var SITE_NAME = currentScript.getAttribute("data-site") || window.location.hostname;
  var ACCENT = currentScript.getAttribute("data-color") || "#5DA9DA"; // bleu ciel
  var BEIGE = currentScript.getAttribute("data-beige") || "#EFE1CB"; // beige
  var AVATAR_URL = currentScript.getAttribute("data-avatar") || API_BASE + "/avatar.png";
  var SITE_NOTIFY_OVERRIDE = currentScript.getAttribute("data-notify") || "";
  var EMBED_MODE = currentScript.getAttribute("data-embed") === "iframe";
  var POLL_INTERVAL = 4000;

  if (window.__contactWidgetLoaded) return;
  window.__contactWidgetLoaded = true;

  // ---------- Identité visiteur + conversation en cours (locale, privée) ----------

  function safeStorage(storage) {
    try {
      var k = "__cw_test";
      storage.setItem(k, "1");
      storage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }
  var HAS_STORAGE = safeStorage(window.localStorage);
  var HAS_SESSION = safeStorage(window.sessionStorage);

  function getVisitorId() {
    if (!HAS_STORAGE) {
      if (!window.__cwVisitorIdMem) {
        window.__cwVisitorIdMem = "v" + Date.now().toString(36) + Math.random().toString(36).slice(2);
      }
      return window.__cwVisitorIdMem;
    }
    var id = localStorage.getItem("__cw_visitor_id");
    if (!id) {
      id = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : "v" + Date.now().toString(36) + Math.random().toString(36).slice(2);
      localStorage.setItem("__cw_visitor_id", id);
    }
    return id;
  }
  var VISITOR_ID = getVisitorId();

  function getSavedConversation() {
    if (!HAS_STORAGE) return null;
    try {
      var raw = localStorage.getItem("__cw_conversation");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function saveConversation(id) {
    if (!HAS_STORAGE) return;
    try {
      localStorage.setItem("__cw_conversation", JSON.stringify({ id: id, visitorId: VISITOR_ID }));
    } catch (e) {}
  }
  function clearSavedConversation() {
    if (!HAS_STORAGE) return;
    try {
      localStorage.removeItem("__cw_conversation");
    } catch (e) {}
  }

  function wasDismissedThisSession() {
    if (EMBED_MODE) return false; // en iframe, toujours ouvert, pas de mémoire de fermeture
    if (!HAS_SESSION) return false;
    return sessionStorage.getItem("__cw_dismissed") === "1";
  }
  function markDismissed() {
    if (!HAS_SESSION) return;
    try {
      sessionStorage.setItem("__cw_dismissed", "1");
    } catch (e) {}
  }

  // ---------- Structure visuelle ----------

  var host = document.createElement("div");
  host.id = "contact-widget-host";
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent = [
    ":host, *{box-sizing:border-box;}",
    ":host{display:block;" + (EMBED_MODE ? "width:100%;height:100%;" : "") + "}",
    ".cw-wrap{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}",
    ".cw-wrap:not(.embed){position:fixed;bottom:20px;right:20px;z-index:2147483000;}",
    ".cw-wrap.embed{position:static;width:100%;height:100%;}",
    ".cw-bubble{width:60px;height:60px;border-radius:50%;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.25);border:2.5px solid " + ACCENT + ";cursor:pointer;padding:0;overflow:hidden;position:relative;transition:transform .15s ease;}",
    ".cw-bubble:hover{transform:scale(1.06);}",
    ".cw-bubble img{width:100%;height:100%;object-fit:cover;display:block;}",
    ".cw-dot{position:absolute;top:0;right:0;width:15px;height:15px;border-radius:50%;background:#ef4444;border:2px solid #fff;display:none;}",
    ".cw-dot.show{display:block;}",
    ".cw-panel{background:#fff;overflow:hidden;display:none;flex-direction:column;}",
    ".cw-panel:not(.embed){position:absolute;bottom:74px;right:0;width:310px;max-width:calc(100vw - 32px);border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.2);border:1px solid " + BEIGE + ";}",
    ".cw-panel.embed{position:static;width:100%;height:100%;border-radius:0;box-shadow:none;border:none;}",
    ".cw-panel.open{display:flex;}",
    ".cw-header{background:linear-gradient(135deg, " + ACCENT + ", " + ACCENT + "cc);color:#fff;padding:14px 16px;font-weight:600;font-size:15px;display:flex;align-items:center;gap:10px;justify-content:space-between;flex-shrink:0;}",
    ".cw-header-left{display:flex;align-items:center;gap:10px;}",
    ".cw-header-avatar{width:30px;height:30px;border-radius:50%;overflow:hidden;flex-shrink:0;border:1.5px solid #fff;}",
    ".cw-header-avatar img{width:100%;height:100%;object-fit:cover;display:block;}",
    ".cw-close{background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;opacity:.85;padding:2px 4px;}",
    ".cw-close:hover{opacity:1;}",
    ".cw-close.hidden{display:none;}",
    ".cw-body{padding:16px;background:#fff;flex:1;display:flex;flex-direction:column;min-height:0;}",
    ".cw-question{font-size:14px;color:#3a3226;margin:0 0 12px;line-height:1.4;}",
    ".cw-choices{display:flex;gap:10px;}",
    ".cw-choice-btn{flex:1;padding:10px 0;border-radius:10px;border:1.5px solid " + ACCENT + ";background:#fff;color:" + ACCENT + ";font-size:14px;font-weight:600;cursor:pointer;transition:background .15s;}",
    ".cw-choice-btn:hover{background:" + BEIGE + "80;}",
    ".cw-choice-btn.primary{background:" + ACCENT + ";color:#fff;}",
    ".cw-choice-btn.primary:hover{filter:brightness(1.06);}",
    "label.cw-label{display:block;font-size:12.5px;color:#6b5f4d;margin-bottom:6px;font-weight:500;}",
    ".cw-input,.cw-textarea{width:100%;border:1.5px solid " + BEIGE + ";border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;margin-bottom:12px;outline:none;color:#2c2418;background:#fffdf9;}",
    ".cw-input:focus,.cw-textarea:focus{border-color:" + ACCENT + ";}",
    ".cw-textarea{resize:vertical;min-height:72px;}",
    ".cw-send{width:100%;padding:11px 0;border-radius:10px;border:none;background:" + ACCENT + ";color:#fff;font-size:14px;font-weight:600;cursor:pointer;}",
    ".cw-send:hover{filter:brightness(1.06);}",
    ".cw-send:disabled{opacity:.6;cursor:default;}",
    ".cw-back{background:none;border:none;color:#8a7c66;font-size:12.5px;cursor:pointer;margin-bottom:10px;padding:0;}",
    ".cw-small{font-size:11.5px;color:#a89a82;margin-top:4px;}",
    "input.cw-hp{position:absolute;left:-9999px;top:-9999px;}",
    ".cw-chat{flex:1;min-height:120px;overflow-y:auto;padding:4px 2px;margin-bottom:10px;display:flex;flex-direction:column;gap:8px;background:#fff;}",
    ".cw-panel:not(.embed) .cw-chat{height:260px;flex:none;}",
    ".cw-msg{max-width:80%;padding:8px 12px;border-radius:14px;font-size:13.5px;line-height:1.35;word-wrap:break-word;white-space:pre-wrap;}",
    ".cw-msg-visitor{align-self:flex-end;background:" + ACCENT + ";color:#fff;border-bottom-right-radius:4px;}",
    ".cw-msg-agent{align-self:flex-start;background:" + BEIGE + ";color:#3a3226;border-bottom-left-radius:4px;}",
    ".cw-chat-input-row{display:flex;gap:8px;align-items:center;flex-shrink:0;}",
    ".cw-chat-input{flex:1;border:1.5px solid " + BEIGE + ";border-radius:20px;padding:9px 14px;font-size:13.5px;font-family:inherit;outline:none;color:#2c2418;background:#fffdf9;}",
    ".cw-chat-input:focus{border-color:" + ACCENT + ";}",
    ".cw-chat-send{width:36px;height:36px;border-radius:50%;border:none;background:" + ACCENT + ";color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}",
    ".cw-chat-send:hover{filter:brightness(1.06);}",
    ".cw-restart{display:block;text-align:center;font-size:11px;color:#b3a68f;margin-top:8px;cursor:pointer;text-decoration:underline;background:none;border:none;width:100%;flex-shrink:0;}"
  ].join("\n");
  root.appendChild(style);

  var wrap = document.createElement("div");
  wrap.className = "cw-wrap" + (EMBED_MODE ? " embed" : "");
  wrap.innerHTML =
    (EMBED_MODE
      ? ""
      : '<button class="cw-bubble" type="button" aria-label="Nous contacter">' +
          '<img src="' + AVATAR_URL + '" alt="" />' +
          '<span class="cw-dot" id="cw-dot"></span>' +
        "</button>") +
    '<div class="cw-panel' + (EMBED_MODE ? " embed" : "") + '">' +
      '<div class="cw-header">' +
        '<div class="cw-header-left">' +
          '<span class="cw-header-avatar"><img src="' + AVATAR_URL + '" alt="" /></span>' +
          "<span>Une question ?</span>" +
        "</div>" +
        '<button class="cw-close' + (EMBED_MODE ? " hidden" : "") + '" type="button" aria-label="Fermer">&#10005;</button>' +
      "</div>" +
      '<div class="cw-body" id="cw-body"></div>' +
    "</div>";
  root.appendChild(wrap);

  var bubble = wrap.querySelector(".cw-bubble");
  var panel = wrap.querySelector(".cw-panel");
  var closeBtn = wrap.querySelector(".cw-close");
  var body = wrap.querySelector("#cw-body");
  var dot = wrap.querySelector("#cw-dot");

  function openPanel() {
    panel.classList.add("open");
    if (dot) dot.classList.remove("show");
    var saved = getSavedConversation();
    if (saved && saved.id) {
      loadConversationAndRenderChat(saved.id);
    } else {
      renderStep1();
    }
  }
  function closePanel() {
    if (EMBED_MODE) return; // pas de fermeture en mode iframe
    panel.classList.remove("open");
    markDismissed();
  }

  if (bubble) {
    bubble.addEventListener("click", function () {
      if (panel.classList.contains("open")) {
        closePanel();
      } else {
        openPanel();
      }
    });
  }
  if (closeBtn) closeBtn.addEventListener("click", closePanel);

  // ---------- Étape 1 : Oui / Non ----------

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

  function submit(payload, btnEl) {
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.textContent = "Envoi...";
    }
    payload.site = SITE_NAME;
    payload.visitorId = VISITOR_ID;
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
      .then(function (res) {
        saveConversation(res.id);
        var firstMsg = payload.type === "call"
          ? "Je souhaite être rappelé(e) au " + payload.phone
          : payload.question;
        renderChat(res.id, [{ from: "visitor", text: firstMsg, at: new Date().toISOString() }]);
      })
      .catch(function () {
        body.innerHTML =
          '<div class="cw-question" style="text-align:center;">Une erreur est survenue. Merci de réessayer un peu plus tard.</div>';
      });
  }

  // ---------- Chat en direct ----------

  var pollTimer = null;
  var lastMessageCount = 0;

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function renderMessages(messages) {
    var list = body.querySelector("#cw-chat");
    if (!list) return;
    list.innerHTML = messages
      .map(function (m) {
        var cls = m.from === "agent" ? "cw-msg cw-msg-agent" : "cw-msg cw-msg-visitor";
        return '<div class="' + cls + '">' + escapeHtml(m.text) + "</div>";
      })
      .join("");
    list.scrollTop = list.scrollHeight;
    lastMessageCount = messages.length;
  }

  function renderChat(conversationId, initialMessages) {
    body.innerHTML =
      '<div class="cw-chat" id="cw-chat"></div>' +
      '<div class="cw-chat-input-row">' +
        '<input class="cw-chat-input" id="cw-chat-input" type="text" placeholder="Écrire un message..." />' +
        '<button class="cw-chat-send" id="cw-chat-send" type="button" aria-label="Envoyer">&#10148;</button>' +
      "</div>" +
      '<button class="cw-restart" id="cw-restart" type="button">Nouvelle demande</button>';
    renderMessages(initialMessages || []);

    var input = body.querySelector("#cw-chat-input");
    var sendBtn = body.querySelector("#cw-chat-send");

    function doSend() {
      var text = input.value.trim();
      if (!text) return;
      input.value = "";
      input.disabled = true;
      sendBtn.disabled = true;
      fetch(API_BASE + "/.netlify/functions/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: conversationId, visitorId: VISITOR_ID, text: text })
      })
        .then(function (r) {
          if (!r.ok) throw new Error("bad status");
          return r.json();
        })
        .then(function (data) {
          input.disabled = false;
          sendBtn.disabled = false;
          input.focus();
          if (data.messages) renderMessages(data.messages);
        })
        .catch(function () {
          input.disabled = false;
          sendBtn.disabled = false;
        });
    }

    sendBtn.addEventListener("click", doSend);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        doSend();
      }
    });

    body.querySelector("#cw-restart").addEventListener("click", function () {
      clearSavedConversation();
      renderStep1();
    });

    startPolling(conversationId);
  }

  function loadConversationAndRenderChat(conversationId) {
    body.innerHTML = '<p class="cw-question">Chargement...</p>';
    fetch(
      API_BASE +
        "/.netlify/functions/messages?id=" +
        encodeURIComponent(conversationId) +
        "&visitorId=" +
        encodeURIComponent(VISITOR_ID)
    )
      .then(function (r) {
        if (!r.ok) throw new Error("bad status");
        return r.json();
      })
      .then(function (data) {
        renderChat(conversationId, data.messages || []);
      })
      .catch(function () {
        clearSavedConversation();
        renderStep1();
      });
  }

  function startPolling(conversationId) {
    stopPolling();
    pollTimer = setInterval(function () {
      fetch(
        API_BASE +
          "/.netlify/functions/messages?id=" +
          encodeURIComponent(conversationId) +
          "&visitorId=" +
          encodeURIComponent(VISITOR_ID)
      )
        .then(function (r) {
          if (!r.ok) throw new Error("bad status");
          return r.json();
        })
        .then(function (data) {
          if (data.messages && data.messages.length !== lastMessageCount) {
            var isPanelOpen = panel.classList.contains("open");
            renderMessages(data.messages);
            if (!isPanelOpen && dot) dot.classList.add("show");
          }
        })
        .catch(function () {});
    }, POLL_INTERVAL);
  }
  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // ---------- Ouverture automatique ----------
  // En mode iframe : toujours ouvert, pas de bulle à afficher.
  // En mode normal : ouvert à l'arrivée, sauf si le visiteur l'a fermé durant cette visite.

  if (EMBED_MODE || !wasDismissedThisSession()) {
    openPanel();
  } else {
    var savedOnLoad = getSavedConversation();
    if (savedOnLoad && savedOnLoad.id) {
      startPolling(savedOnLoad.id);
    }
  }
})();
