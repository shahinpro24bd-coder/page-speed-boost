/* Language switcher: modern dropdown with flags.
   Arabic, English, French, German, Turkish — every language is rendered by the
   server (?lang=xx), so choosing one simply navigates to that URL. The design
   of the rest of the page is untouched. */
(function () {
  "use strict";
  /* Read the language at init time — this bundle may load before the
     bootstrap script that publishes window.__SITE_LANG__. */
  function currentLang() {
    return window.__SITE_LANG__ || "tr";
  }
  function currentLangs() {
    return (window.__SITE_LANGS__ || ["ar", "en", "fr", "de", "tr"]).slice();
  }

  var FLAGS = {
    ar:
      '<svg viewBox="0 0 20 14" aria-hidden="true"><rect width="20" height="14" fill="#14653e"/>' +
      '<g fill="none" stroke="#fff" stroke-width=".9" stroke-linecap="round">' +
      '<path d="M3.6 4.9h3.1M8.3 4.4h2.7M12.6 4.9h3.1"/>' +
      '<path d="M4.6 6.3c1-.9 1.9-.9 2.9 0s1.9.9 2.9 0 1.9-.9 2.9 0"/>' +
      '<path d="M5.2 7.6h9.4"/></g>' +
      '<path d="M4.4 10.4h10l1.3-.7-1.3-.7H4.4z" fill="#fff"/></svg>',
    en:
      '<svg viewBox="0 0 20 14" aria-hidden="true"><rect width="20" height="14" fill="#012169"/>' +
      '<path d="M0 0l20 14M20 0L0 14" stroke="#fff" stroke-width="2.8"/>' +
      '<path d="M0 0l20 14M20 0L0 14" stroke="#C8102E" stroke-width="1.2"/>' +
      '<path d="M10 0v14M0 7h20" stroke="#fff" stroke-width="4.6"/>' +
      '<path d="M10 0v14M0 7h20" stroke="#C8102E" stroke-width="2.6"/></svg>',
    fr:
      '<svg viewBox="0 0 20 14" aria-hidden="true"><rect width="20" height="14" fill="#fff"/>' +
      '<rect width="6.67" height="14" fill="#0055A4"/><rect x="13.33" width="6.67" height="14" fill="#EF4135"/></svg>',
    de:
      '<svg viewBox="0 0 20 14" aria-hidden="true"><rect width="20" height="14" fill="#000"/>' +
      '<rect y="4.67" width="20" height="4.67" fill="#DD0000"/><rect y="9.33" width="20" height="4.67" fill="#FFCE00"/></svg>',
    tr:
      '<svg viewBox="0 0 20 14" aria-hidden="true"><rect width="20" height="14" fill="#E30A17"/>' +
      '<circle cx="8" cy="7" r="3.1" fill="#fff"/><circle cx="9.2" cy="7" r="2.5" fill="#E30A17"/>' +
      '<path d="M12.6 4.6l.6 1.2 1.3.2-.95.95.23 1.3-1.18-.62-1.18.62.23-1.3-.95-.95 1.3-.2z" fill="#fff"/></svg>',
  };

  var NAMES = { ar: "العربية", en: "English", fr: "Français", de: "Deutsch", tr: "Türkçe" };

  function flag(code) {
    return FLAGS[code] || "";
  }

  function navigateTo(lang) {
    if (window.__SITE_EDIT__) {
      try {
        window.parent.postMessage({ source: "cms-editor", type: "lang-changed", lang: lang }, "*");
      } catch (e) {}
    }
    var url = new URL(window.location.href);
    if (lang === "tr") url.searchParams.delete("lang");
    else url.searchParams.set("lang", lang);
    try {
      window.localStorage.setItem("site_lang", lang);
      document.cookie = "site_lang=" + lang + ";path=/;max-age=31536000;SameSite=Lax";
    } catch (e) {}
    window.location.assign(url.toString());
  }

  function preserveLanguageAndPrefetch() {
    var lang = currentLang();
    document.querySelectorAll('a[href]').forEach(function (link) {
      var raw = link.getAttribute('href') || '';
      if (!raw || raw[0] === '#' || /^(?:mailto:|tel:|https?:\/\/)/i.test(raw)) return;
      try {
        var url = new URL(raw, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (lang === 'tr') url.searchParams.delete('lang');
        else url.searchParams.set('lang', lang);
        link.href = url.pathname + url.search + url.hash;
      } catch (e) {}
    });

    var warmed = {};
    function warm(link) {
      var href = link && link.href;
      if (!href || warmed[href]) return;
      try {
        var target = new URL(href);
        if (target.origin !== window.location.origin || !(/\/$/.test(target.pathname) || /\.html$/.test(target.pathname))) return;
      } catch (e) {
        return;
      }
      warmed[href] = true;
      fetch(href, { credentials: 'same-origin', priority: 'low' }).catch(function () {});
    }
    document.addEventListener('pointerover', function (event) {
      var link = event.target.closest && event.target.closest('a[href]');
      if (link) warm(link);
    }, { passive: true });
    document.addEventListener('touchstart', function (event) {
      var link = event.target.closest && event.target.closest('a[href]');
      if (link) warm(link);
    }, { passive: true });
  }

  function closeAll(except) {
    document.querySelectorAll(".lang-dropdown.open").forEach(function (d) {
      if (d === except) return;
      d.classList.remove("open");
      var t = d.querySelector(".lang-toggle");
      if (t) t.setAttribute("aria-expanded", "false");
    });
  }

  function build(container) {
    container.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "lang-dropdown";

    var LANGS = currentLangs();
    var current = currentLang();
    if (LANGS.indexOf(current) < 0) current = LANGS[0] || "tr";

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "lang-toggle";
    toggle.setAttribute("aria-haspopup", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Language selector");
    toggle.innerHTML =
      '<span class="lang-flag">' + flag(current) + "</span>" +
      '<span class="lang-name">' + (NAMES[current] || current) + "</span>" +
      '<span class="lang-chevron" aria-hidden="true">' +
      '<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "</span>";

    var menu = document.createElement("ul");
    menu.className = "lang-menu";
    LANGS.forEach(function (code) {
      var item = document.createElement("li");
      var link = document.createElement("a");
      link.href = "#";
      link.setAttribute("data-lang", code);
      link.setAttribute("lang", code);
      if (code === current) link.classList.add("active");
      link.innerHTML =
        '<span class="lang-flag">' + flag(code) + "</span>" +
        '<span class="lang-name">' + (NAMES[code] || code) + "</span>" +
        (code === current ? '<span class="lang-check" aria-hidden="true">✓</span>' : "");
      item.appendChild(link);
      menu.appendChild(item);
    });

    wrap.appendChild(toggle);
    wrap.appendChild(menu);
    container.appendChild(wrap);
  }

  function init() {
    document.querySelectorAll(".navbar-languages").forEach(build);
    preserveLanguageAndPrefetch();

    document.addEventListener("click", function (event) {
      var dropdown = event.target.closest ? event.target.closest(".lang-dropdown") : null;
      if (dropdown) {
        var toggle = event.target.closest(".lang-toggle");
        if (toggle) {
          var open = dropdown.classList.toggle("open");
          toggle.setAttribute("aria-expanded", open ? "true" : "false");
          if (open) closeAll(dropdown);
          return;
        }
        var item = event.target.closest("[data-lang]");
        if (item) {
          event.preventDefault();
          closeAll();
          navigateTo(item.getAttribute("data-lang"));
          return;
        }
        return;
      }
      closeAll();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeAll();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
