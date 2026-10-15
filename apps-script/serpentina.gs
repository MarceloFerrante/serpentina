/**
 * Serpentina: serve um HTML monolítico do Google Drive num site do Google Sites.
 *
 * Com ?texto=1, este App da Web devolve o HTML como texto (ContentService). O
 * trecho serpentina.html, colado em "Incorporar → Código" no Sites, mostra a
 * tela de carregamento, busca esse texto e o escreve no quadro, onde o navegador
 * o renderiza. Assim não há faixa do Apps Script nem quadros a mais.
 * Sem parâmetro (link aberto direto), mostra a página pelo HtmlService.
 *
 * Implantar: Implantar → Nova implantação → App da Web
 *   Executar como: Eu  |  Quem pode acessar: Qualquer pessoa
 * Antes, rode testar() uma vez no editor para autorizar o acesso ao Drive.
 * O arquivo no Drive não precisa ser público: o script lê com a sua conta.
 */

const CONFIG = {
  // Nome do arquivo no Drive. Ignora a lixeira; se houver mais de um com esse
  // nome, usa o modificado por último. Para atualizar o site, basta reenviar.
  NOME: 'oraculo_standalone.html',
  // Segundos que o HTML fica em cache (0 = lê do Drive a cada acesso; máx. 21600).
  // Depois de atualizar o arquivo, rode limparCache() para valer na hora.
  CACHE_SECONDS: 300,
  // Só para quando o site roda dentro do quadro do Google Sites: '_blank' faz os
  // links para fora abrirem em nova aba. Na página própria (pagina/index.html) deixe ''.
  LINKS_EXTERNOS: '',
};

// Marca que o trecho do Sites reconhece como erro (ContentService não muda o status HTTP).
const ERRO_ = '<!--serpentina:erro-->';
// Valores do CacheService têm limite de 100 KB; 30k unidades UTF-16 cabem mesmo
// no pior caso (3 bytes cada em UTF-8).
const CHUNK_ = 30000;
const CACHE_KEY_ = 'serpentina:' + CONFIG.NOME;

function doGet(e) {
  const modoTexto = e && e.parameter && e.parameter.texto;
  let html;
  try {
    html = ajustarLinks_(carregarHtml_());
  } catch (err) {
    console.error(err);
    if (modoTexto) return texto_(ERRO_);
    html = '<p style="font-family:sans-serif">Não foi possível carregar o site. Tente novamente em instantes.</p>';
  }

  // ?texto=1: o que o serpentina.html (no Sites) busca e renderiza.
  if (modoTexto) return texto_(html);

  // Aberto direto no navegador (ou incorporado "Por URL"): mostra a página.
  return HtmlService.createHtmlOutput(html)
    .setTitle(extrairTitulo_(html) || 'Site')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function texto_(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT);
}

/** Rode no editor uma vez: autoriza o acesso ao Drive e confere se o arquivo é achado. */
function testar() {
  const file = buscarArquivo_();
  console.log('OK: ' + file.getName() + ' (' + file.getSize() + ' bytes, modificado em ' +
    file.getLastUpdated() + ')');
}

/** Rode no editor depois de atualizar o arquivo no Drive, para não esperar o cache vencer. */
function limparCache() {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get(CACHE_KEY_ + ':n')) || 0;
  cache.removeAll(chaves_(n).concat(CACHE_KEY_ + ':n'));
  console.log('cache limpo (' + n + ' pedaços)');
}

function buscarArquivo_() {
  const nome = CONFIG.NOME.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const files = DriveApp.searchFiles('title = "' + nome + '" and trashed = false');
  let file = null;
  while (files.hasNext()) {
    const f = files.next();
    if (!file || f.getLastUpdated() > file.getLastUpdated()) file = f;
  }
  if (!file) throw new Error('Arquivo não encontrado no Drive: ' + CONFIG.NOME);
  return file;
}

/** Lê o HTML do Drive, usando o cache em pedaços quando disponível. */
function carregarHtml_() {
  const cache = CacheService.getScriptCache();

  if (CONFIG.CACHE_SECONDS > 0) {
    const n = Number(cache.get(CACHE_KEY_ + ':n'));
    if (n > 0) {
      const keys = chaves_(n);
      const parts = cache.getAll(keys);
      if (keys.every((k) => k in parts)) return keys.map((k) => parts[k]).join('');
    }
  }

  const html = buscarArquivo_().getBlob().getDataAsString('UTF-8');

  if (CONFIG.CACHE_SECONDS > 0) {
    const chunks = {};
    let n = 0;
    for (let i = 0; i < html.length; ) {
      let end = Math.min(i + CHUNK_, html.length);
      // Não cortar um par substituto (emoji etc.) ao meio.
      const c = html.charCodeAt(end - 1);
      if (end < html.length && c >= 0xd800 && c <= 0xdbff) end--;
      chunks[CACHE_KEY_ + ':' + n++] = html.slice(i, end);
      i = end;
    }
    chunks[CACHE_KEY_ + ':n'] = String(n);
    try {
      cache.putAll(chunks, Math.min(CONFIG.CACHE_SECONDS, 21600));
    } catch (err) {
      // HTML grande demais para o cache: segue servindo direto do Drive.
      console.warn('cache não gravado: ' + err);
    }
  }
  return html;
}

function extrairTitulo_(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : '';
}

function chaves_(n) {
  const keys = [];
  for (let i = 0; i < n; i++) keys.push(CACHE_KEY_ + ':' + i);
  return keys;
}

/** Insere, antes de </body>, o script que faz links externos saírem do quadro. */
function ajustarLinks_(html) {
  if (!CONFIG.LINKS_EXTERNOS) return html;
  const script =
    '<script>document.addEventListener("click",function(e){' +
    'var a=e.target.closest&&e.target.closest("a[href]");' +
    'if(!a||a.target)return;' +
    'var h=a.getAttribute("href");' +
    'if(!h||h.charAt(0)==="#"||/^javascript:/i.test(h))return;' +
    'a.target=' + JSON.stringify(CONFIG.LINKS_EXTERNOS) + ';' +
    '},true);</script>';
  const i = html.toLowerCase().lastIndexOf('</body>');
  return i >= 0 ? html.slice(0, i) + script + html.slice(i) : html + script;
}
