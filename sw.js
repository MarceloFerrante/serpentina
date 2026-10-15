/*
 * Serpentina: Service Worker que serve uma pasta do Google Drive como raiz do site.
 *
 * Cada pedido deste domínio (página, imagem, fonte, script) vira o arquivo de
 * mesmo caminho na pasta: /assets/foto.webp → pasta/assets/foto.webp. O mapa
 * caminho → ID vem da listagem da pasta pela API do Drive. Os arquivos ficam no
 * Cache Storage, guardados pelo checksum: só são baixados de novo quando mudam.
 *
 * A pasta e os arquivos precisam estar como "Qualquer pessoa com o link: Leitor".
 */
const PASTA_ID = '1rIBigQhlN4aba7mTcAj7ZFkXoEpKk8r-';
const API_KEY = 'AIzaSyCBRKDIAk6BwPZmxECFh8tf42pSOnD3Pow';
// Por quanto tempo a listagem vale antes de ser refeita (em segundo plano).
const INDICE_MS = 30000;

const API = 'https://www.googleapis.com/drive/v3/files';
const PASTA_MIME = 'application/vnd.google-apps.folder';
const CACHE = 'serpentina-1';
const CHAVE_INDICE = '/__serpentina/indice';
const TIPOS = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8', json: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8', xml: 'application/xml', svg: 'image/svg+xml',
  webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', avif: 'image/avif', ico: 'image/x-icon',
  woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm',
  pdf: 'application/pdf', wasm: 'application/wasm', webmanifest: 'application/manifest+json',
};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const nome of await caches.keys()) if (nome !== CACHE) await caches.delete(nome);
  await self.clients.claim();
})()));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname === '/sw.js') return;
  e.respondWith(servir(url, e.request.mode === 'navigate').catch((err) => {
    console.error('serpentina:', err);
    return new Response('<!doctype html><meta charset="utf-8"><title>Erro</title>' +
      '<body style="background:#080806;color:#c4a76a;font:12px monospace;padding:2em">' +
      'NÃO FOI POSSÍVEL CARREGAR. <a style="color:inherit" href="">TENTAR DE NOVO</a>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }));
});

/* ── Primeira visita: a carregadora pede para baixar tudo e mostra a % ─────── */
self.addEventListener('message', (e) => {
  if (!e.data || e.data.tipo !== 'preparar' || !e.source) return;
  const avisar = (m) => e.source.postMessage(Object.assign({ serpentina: true }, m));
  e.waitUntil(preparar(avisar).then(
    () => avisar({ tipo: 'pronto' }),
    (err) => { console.error('serpentina:', err); avisar({ tipo: 'erro' }); }));
});

async function preparar(avisar) {
  const indice = await atualizarIndice();
  const cache = await caches.open(CACHE);
  const faltam = [];
  for (const [caminho, f] of Object.entries(indice)) {
    // Outros .html na raiz (como o monolítico de reserva) não fazem parte do site.
    if (/^[^/]+\.html?$/i.test(caminho) && caminho !== 'index.html' && indice['index.html']) continue;
    if (!(await cache.match(chaveDe(f)))) faltam.push(f);
  }
  const total = faltam.reduce((t, f) => t + (Number(f.size) || 0), 0) || 1;
  let feito = 0;
  let ultimo = 0;
  avisar({ tipo: 'progresso', feito, total });
  await Promise.all(faltam.map(async (f) => {
    const r = await fetch(API + '/' + f.id + '?alt=media&key=' + API_KEY);
    if (!r.ok) throw new Error(f.name + ': HTTP ' + r.status);
    const leitor = r.body.getReader();
    const partes = [];
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      partes.push(value);
      feito += value.length;
      if (Date.now() - ultimo > 100) {
        ultimo = Date.now();
        avisar({ tipo: 'progresso', feito, total });
      }
    }
    await cache.put(chaveDe(f), new Response(new Blob(partes)));
  }));
}

function chaveDe(f) {
  return '/__serpentina/arquivo/' + f.id + '/' + (f.md5Checksum || f.modifiedTime);
}

async function servir(url, navegacao) {
  const indice = await obterIndice();
  const f = acharArquivo(indice, decodeURIComponent(url.pathname));
  if (!f) {
    const erro = indice['404.html'];
    if (erro && navegacao) return arquivo(erro, 404);
    return new Response('Não encontrado', { status: 404 });
  }
  return arquivo(f, 200);
}

/** /  → index.html;  /a/ → a/index.html;  /a → a, a.html ou a/index.html. */
function acharArquivo(indice, caminho) {
  let c = caminho.replace(/^\/+/, '');
  if (c === '' || c.endsWith('/')) c += 'index.html';
  const f = indice[c] || indice[c + '.html'] || indice[c + '/index.html'];
  if (f || c !== 'index.html') return f || null;
  // Pasta sem index.html (ainda só com o monolítico): usa o .html da raiz.
  const html = Object.keys(indice).find((k) => /^[^/]+\.html?$/i.test(k) && k !== '404.html');
  return html ? indice[html] : null;
}

async function arquivo(f, status) {
  const cache = await caches.open(CACHE);
  const chave = chaveDe(f);
  let r = await cache.match(chave);
  if (!r) {
    r = await fetch(API + '/' + f.id + '?alt=media&key=' + API_KEY);
    if (!r.ok) throw new Error(f.name + ': HTTP ' + r.status);
    await cache.put(chave, r.clone());
    limparVersoesAntigas(cache, f.id, chave);
  }
  const ext = f.name.split('.').pop().toLowerCase();
  return new Response(r.body, {
    status,
    headers: { 'Content-Type': TIPOS[ext] || f.mimeType || 'application/octet-stream' },
  });
}

async function limparVersoesAntigas(cache, id, atual) {
  const prefixo = location.origin + '/__serpentina/arquivo/' + id + '/';
  for (const req of await cache.keys()) {
    if (req.url.startsWith(prefixo) && req.url !== location.origin + atual) cache.delete(req);
  }
}

/* ── Índice caminho → arquivo ───────────────────────────────────────────────
   Em memória enquanto o worker vive e no Cache Storage entre reinícios. Com um
   índice salvo, responde na hora e atualiza em segundo plano se estiver velho:
   uma mudança no Drive aparece no máximo na visita seguinte. */
let indiceMem = null;
let indiceEm = 0;
let atualizando = null;

async function obterIndice() {
  if (!indiceMem) {
    const salvo = await (await caches.open(CACHE)).match(CHAVE_INDICE);
    if (salvo) {
      const j = await salvo.json();
      indiceMem = j.indice;
      indiceEm = j.em;
    }
  }
  if (!indiceMem) return atualizarIndice();
  if (Date.now() - indiceEm > INDICE_MS) atualizarIndice().catch((err) => console.warn('serpentina:', err));
  return indiceMem;
}

function atualizarIndice() {
  if (!atualizando) {
    atualizando = listar(PASTA_ID, '', {})
      .then(async (indice) => {
        indiceMem = indice;
        indiceEm = Date.now();
        await (await caches.open(CACHE)).put(CHAVE_INDICE,
          new Response(JSON.stringify({ indice, em: indiceEm })));
        return indice;
      })
      .finally(() => { atualizando = null; });
  }
  return atualizando;
}

/** Lista a pasta e as subpastas. Com nomes repetidos, vale o modificado por último. */
async function listar(pastaId, prefixo, indice) {
  const subpastas = [];
  let pagina = '';
  do {
    const q = encodeURIComponent("'" + pastaId + "' in parents and trashed = false");
    const r = await fetch(API + '?q=' + q + '&pageSize=1000&key=' + API_KEY +
      '&fields=nextPageToken,files(id,name,mimeType,md5Checksum,modifiedTime,size)' +
      (pagina ? '&pageToken=' + pagina : ''));
    if (!r.ok) throw new Error('listagem da pasta: HTTP ' + r.status);
    const j = await r.json();
    for (const f of j.files) {
      const caminho = prefixo + f.name;
      if (f.mimeType === PASTA_MIME) {
        subpastas.push(listar(f.id, caminho + '/', indice));
      } else if (!indice[caminho] || f.modifiedTime > indice[caminho].modifiedTime) {
        indice[caminho] = f;
      }
    }
    pagina = j.nextPageToken;
  } while (pagina);
  await Promise.all(subpastas);
  return indice;
}
