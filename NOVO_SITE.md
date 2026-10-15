# Outro site com subdomínio

Cada site novo é uma pasta no Drive, um repositório no GitHub e um registro no DNS. A chave de
API pode ser a mesma para todos. Exemplo: `novo.lonelas.com`.

1. **Drive:**
   - Crie uma pasta com o site: o `index.html` na raiz e os outros arquivos com caminhos relativos
     (`assets/...`).
   - Se o site for um HTML monolítico, divida antes com `python3 dividir.py site.html saida/` e
     envie o conteúdo de `saida/`.
   - Compartilhe a pasta: *Qualquer pessoa com o link → **Leitor***.
   - Copie o ID da pasta, que é o trecho depois de `/folders/` na URL.
2. **Chave de API:** no Cloud Console, na mesma chave, acrescente o referenciador
   `https://novo.lonelas.com/*`.
3. **GitHub:** crie um repositório **público** (ex.: `novo`) com 4 arquivos copiados da
   raiz deste repositório:
   - **`sw.js`:** troque o `PASTA_ID` pelo ID da pasta nova.
   - **`index.html`:**
     - troque o `<title>` e o `TEXTO` de carregamento.
     - A reserva sem Service Worker é opcional. Se não quiser usá-la, deixe `DRIVE_ID = ''`, e
       o navegador sem Service Worker vai mostrar "NÃO FOI POSSÍVEL CARREGAR". Se quiser, ponha
       em `DRIVE_ID` o ID de um HTML monolítico da pasta.
     - Em `URL_EXEC`, apague a URL ou ponha a de um Apps Script próprio do site. O valor atual é
       o do oráculo.
   - **`404.html`:** cópia exata do `index.html`.
   - **`CNAME`:** uma linha só, `novo.lonelas.com`.

   Em *Settings → Pages*: *Deploy from a branch → main / (root)*, e em *Custom domain* coloque
   `novo.lonelas.com`.
4. **DNS** (Squarespace Domains → `lonelas.com` → *DNS* → *Custom records*):

   | Tipo  | Nome   | Valor                       |
   |-------|--------|-----------------------------|
   | CNAME | `novo` | `marceloferrante.github.io` |

5. **HTTPS:** quando o GitHub mostrar o domínio como verificado (de minutos a algumas horas),
   marque *Enforce HTTPS*.

Para conferir, abra `https://novo.lonelas.com`. A primeira visita mostra a %, recarrega e abre o
site.
