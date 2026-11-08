// Harry Potter Theater - Service Worker
// 앱 파일을 한 번 받아두고 오프라인에서도 열리게 합니다. (영상은 기기 저장소에 있어 여기서 다루지 않음)
const VERSION = 'v1';
const SHELL = `hp-shell-${VERSION}`;
const RUNTIME = `hp-runtime-${VERSION}`;
const SHELL_FILES = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, RUNTIME].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // 영상/오디오(범위 요청 포함)는 SW가 건드리지 않음
  if (req.destination === 'video' || req.destination === 'audio' || req.headers.has('range')) return;

  const url = new URL(req.url);

  // 페이지 이동: 네트워크 우선, 실패하면 저장된 index.html
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 같은 출처 파일: 캐시 우선
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(SHELL).then((c) => c.put(req, copy));
      return res;
    })));
    return;
  }

  // 외부 라이브러리·폰트(Tailwind, Lucide, 폰트 등): 캐시 먼저 보여주고 뒤에서 갱신
  e.respondWith(
    caches.open(RUNTIME).then((cache) =>
      cache.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    )
  );
});
