// Работа без интернета: приложение, картинки и озвучка сохраняются в телефоне.
// Открывается сохранённая версия, а в фоне подтягивается свежая — правки приходят сами.
const CACHE = "katya-tracker-v1";   // после переозвучки или новых картинок — увеличить номер
const FILES = [
  "./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png",
  "./img/girl-autumn.png", "./img/girl-winter.png", "./img/girl-spring.png", "./img/girl-summer.png",
  "./img/hedgehog.png", "./img/squirrel.png",
];

async function precache() {
  const cache = await caches.open(CACHE);
  // по одному: если какой-то картинки ещё нет, остальное всё равно сохранится
  await Promise.all(FILES.map(f => cache.add(f).catch(() => {})));
  try {
    const res = await fetch("./audio/index.json", { cache: "no-cache" });
    if (res.ok) {
      await cache.put("./audio/index.json", res.clone());
      const ids = await res.json();
      for (let i = 0; i < ids.length; i += 20) {
        await Promise.all(ids.slice(i, i + 20).map(id => cache.add("./audio/" + id + ".mp3").catch(() => {})));
      }
    }
  } catch (e) {}
}

self.addEventListener("install", e => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("katya-tracker") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const isAudio = e.request.url.includes("/audio/") && e.request.url.endsWith(".mp3");
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      if (cached && isAudio) return cached;           // озвучка не меняется — сеть не нужна
      const fresh = fetch(e.request)
        .then(res => {
          // сохраняем только целые ответы (200); кусочки файла (206) сохранять нельзя
          if (res && (res.status === 200 || res.type === "opaque")) cache.put(e.request, res.clone()).catch(() => {});
          return res;
        })
        .catch(() => null);
      if (cached) { e.waitUntil(fresh); return cached; }
      const res = await fresh;
      if (res) return res;
      if (e.request.mode === "navigate") return cache.match("./index.html");
      return Response.error();
    })
  );
});
