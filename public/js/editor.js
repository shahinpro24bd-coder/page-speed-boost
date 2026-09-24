/* Editor overlay. Loaded only when the page is opened from the admin panel.
   It never rewrites the page structure: it highlights what is editable and
   edits text nodes / image sources in place, so the design stays identical. */
(function () {
  "use strict";
  if (!window.__SITE_EDIT__) return;

  var style = document.createElement("style");
  style.textContent =
    "[data-ck]:hover,[data-ck-attr]:hover{outline:2px dashed #2563eb!important;outline-offset:2px;cursor:text}" +
    "[data-ik]:hover,[data-ik-bg]:hover{outline:3px solid #16a34a!important;outline-offset:2px;cursor:pointer}" +
    ".cms-panel{position:fixed;top:16px;right:16px;z-index:2147483647;width:340px;max-height:80vh;overflow:auto;" +
    "background:#fff;color:#0f172a;border-radius:12px;box-shadow:0 20px 45px rgba(15,23,42,.28);padding:14px;" +
    "font:14px/1.45 system-ui,sans-serif}" +
    ".cms-panel h4{margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#64748b}" +
    ".cms-panel textarea{width:100%;min-height:80px;border:1px solid #cbd5e1;border-radius:8px;padding:8px;" +
    "font:inherit;resize:vertical;box-sizing:border-box}" +
    ".cms-panel label{display:block;font-size:11px;color:#64748b;margin:10px 0 4px}" +
    ".cms-panel button{margin-top:10px;border:0;border-radius:8px;padding:8px 12px;background:#0f172a;color:#fff;" +
    "cursor:pointer;font:inherit}" +
    ".cms-panel .cms-close{background:#e2e8f0;color:#0f172a;margin-left:8px}";
  document.head.appendChild(style);

  function send(message) {
    window.parent.postMessage(Object.assign({ source: "cms-editor" }, message), "*");
  }

  function textNodes(el) {
    var out = [];
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) out.push(n);
    }
    return out;
  }

  var panel = null;
  function closePanel() {
    if (panel) panel.remove();
    panel = null;
  }

  function openTextPanel(el) {
    closePanel();
    panel = document.createElement("div");
    panel.className = "cms-panel";
    var title = document.createElement("h4");
    title.textContent = "Metni düzenle";
    panel.appendChild(title);

    var fields = [];
    var keys = (el.getAttribute("data-ck") || "").split("|").filter(Boolean);
    var nodes = textNodes(el);
    keys.forEach(function (key, i) {
      if (!nodes[i]) return;
      fields.push({ key: key, node: nodes[i], attr: null, label: "Metin" });
    });
    (el.getAttribute("data-ck-attr") || "")
      .split(";")
      .filter(Boolean)
      .forEach(function (pair) {
        var at = pair.indexOf(":");
        if (at < 0) return;
        fields.push({
          key: pair.slice(at + 1),
          node: null,
          attr: pair.slice(0, at),
          label: pair.slice(0, at),
        });
      });

    fields.forEach(function (field) {
      var label = document.createElement("label");
      label.textContent = field.label;
      var area = document.createElement("textarea");
      area.value = field.attr
        ? el.getAttribute(field.attr) || ""
        : (field.node.nodeValue || "").trim();
      area.addEventListener("input", function () {
        if (field.attr) {
          el.setAttribute(field.attr, area.value);
        } else {
          var raw = field.node.nodeValue || "";
          field.node.nodeValue =
            raw.match(/^\s*/)[0] + area.value + raw.match(/\s*$/)[0];
        }
        send({ type: "text", key: field.key, value: area.value });
      });
      panel.appendChild(label);
      panel.appendChild(area);
    });

    var done = document.createElement("button");
    done.textContent = "Kapat";
    done.className = "cms-close";
    done.addEventListener("click", closePanel);
    panel.appendChild(done);
    document.body.appendChild(panel);
    var first = panel.querySelector("textarea");
    if (first) first.focus();
  }

  var picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/*";
  picker.style.display = "none";
  document.body.appendChild(picker);
  var pendingSlot = null;
  var pendingTargets = [];

  picker.addEventListener("change", function () {
    var file = picker.files && picker.files[0];
    picker.value = "";
    if (!file || !pendingSlot) return;
    send({ type: "image", slot: pendingSlot, file: file });
  });

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.source !== "cms-admin") return;
    if (data.type === "image-saved") {
      document
        .querySelectorAll('[data-ik="' + data.slot + '"]')
        .forEach(function (img) {
          img.setAttribute("src", data.url);
        });
      document.querySelectorAll("[data-ik-bg]").forEach(function (el) {
        var slots = (el.getAttribute("data-ik-bg") || "").split("|");
        if (slots.indexOf(data.slot) < 0) return;
        var i = slots.indexOf(data.slot);
        var seen = -1;
        el.setAttribute(
          "style",
          (el.getAttribute("style") || "").replace(
            /url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi,
            function (full, quote, url) {
              seen++;
              return seen === i ? "url(" + quote + data.url + quote + ")" : full;
            },
          ),
        );
      });
    }
  });

  document.addEventListener(
    "click",
    function (event) {
      var target = event.target;
      var image = target.closest("[data-ik],[data-ik-bg]");
      var text = target.closest("[data-ck],[data-ck-attr]");
      if (panel && panel.contains(target)) return;

      if (image && (image.hasAttribute("data-ik") || !text || image.contains(text))) {
        event.preventDefault();
        event.stopPropagation();
        pendingSlot = image.hasAttribute("data-ik")
          ? image.getAttribute("data-ik")
          : (image.getAttribute("data-ik-bg") || "").split("|")[0];
        picker.click();
        return;
      }
      if (text) {
        event.preventDefault();
        event.stopPropagation();
        openTextPanel(text);
      }
    },
    true,
  );

  /* Links and buttons must not navigate away while editing. */
  document.addEventListener(
    "submit",
    function (e) {
      e.preventDefault();
    },
    true,
  );

  function collectImages() {
    var seen = {};
    var list = [];
    document.querySelectorAll("[data-ik]").forEach(function (img) {
      var slot = img.getAttribute("data-ik");
      if (!slot || seen[slot]) return;
      seen[slot] = 1;
      list.push({ slot: slot, url: img.currentSrc || img.getAttribute("src") || "" });
    });
    document.querySelectorAll("[data-ik-bg]").forEach(function (el) {
      var slots = (el.getAttribute("data-ik-bg") || "").split("|");
      var urls = [];
      (el.getAttribute("style") || "").replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi, function (f, q, u) {
        urls.push(u);
        return f;
      });
      slots.forEach(function (slot, i) {
        if (!slot || seen[slot]) return;
        seen[slot] = 1;
        list.push({ slot: slot, url: urls[i] || "" });
      });
    });
    return list;
  }

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.source !== "cms-admin") return;
    if (data.type === "image-saved") send({ type: "images", images: collectImages() });
    if (data.type === "scroll-to") {
      var el = document.querySelector('[data-ik="' + data.slot + '"]');
      if (!el) {
        document.querySelectorAll("[data-ik-bg]").forEach(function (b) {
          if (!el && (b.getAttribute("data-ik-bg") || "").split("|").indexOf(data.slot) >= 0) el = b;
        });
      }
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  send({ type: "ready" });
  send({ type: "images", images: collectImages() });
})();
