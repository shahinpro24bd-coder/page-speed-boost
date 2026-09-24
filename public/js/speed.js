/* Instant navigation helper: warms up internal pages before the user clicks. */
(function () {
  if (window.top !== window.self) return; // never run inside the admin preview frame

  var prefetched = Object.create(null);
  var supportsPrefetch = (function () {
    try {
      var l = document.createElement("link");
      return l.relList && l.relList.supports && l.relList.supports("prefetch");
    } catch (e) {
      return false;
    }
  })();

  function internal(href) {
    if (!href) return null;
    var url;
    try {
      url = new URL(href, location.href);
    } catch (e) {
      return null;
    }
    if (url.origin !== location.origin) return null;
    if (url.pathname === location.pathname) return null;
    if (!/\.html$|\/$/.test(url.pathname)) return null;
    return url.href;
  }

  function prefetch(href) {
    var url = internal(href);
    if (!url || prefetched[url]) return;
    prefetched[url] = true;
    if (supportsPrefetch) {
      var link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "document";
      link.href = url;
      document.head.appendChild(link);
    } else {
      fetch(url, { credentials: "same-origin" }).catch(function () {});
    }
  }

  function onHover(event) {
    var a = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (a) prefetch(a.getAttribute("href"));
  }

  document.addEventListener("mouseover", onHover, { passive: true });
  document.addEventListener("touchstart", onHover, { passive: true });

  function warmVisibleLinks() {
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          prefetch(entry.target.getAttribute("href"));
        });
      },
      { rootMargin: "300px" },
    );
    var links = document.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) io.observe(links[i]);
  }

  if ("requestIdleCallback" in window) requestIdleCallback(warmVisibleLinks, { timeout: 2000 });
  else setTimeout(warmVisibleLinks, 1200);

  // After this page is fully loaded, quietly download every menu page and its
  // photos so the very first click on any menu item is already cached.
  function warmAllPages() {
    var seen = Object.create(null);
    var navs = document.querySelectorAll("a.nav-link[href]");
    for (var i = 0; i < navs.length; i++) {
      var url = internal(navs[i].getAttribute("href"));
      if (!url || seen[url.split("#")[0]]) continue;
      url = url.split("#")[0];
      seen[url] = true;
      prefetched[url] = true;
      fetch(url, { credentials: "same-origin" })
        .then(function (r) { return r.text(); })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, "text/html");
          var imgs = doc.querySelectorAll("img[src]");
          for (var j = 0; j < imgs.length && j < 40; j++) {
            var im = new Image();
            im.decoding = "async";
            im.src = new URL(imgs[j].getAttribute("src"), location.href).href;
          }
        })
        .catch(function () {});
    }
  }
  function scheduleWarm() {
    setTimeout(function () {
      if ("requestIdleCallback" in window) requestIdleCallback(warmAllPages, { timeout: 3000 });
      else warmAllPages();
    }, 800);
  }
  if (document.readyState === "complete") scheduleWarm();
  else window.addEventListener("load", scheduleWarm);
})();
