# Serpentina: site no subdomínio com HTML no Drive, via Apps Script e Google Sites

```
site.seudominio.com ──CNAME──▶ ghs.googlehosted.com (Google Sites, HTTPS automático)
                                 └─ "Incorporar → Código" com serpentina.html
                                      ├─ mostra a tela de carregamento
                                      └─ fetch ──▶ App da Web serpentina.gs (/exec)
                                                    └─ acha o .html no Drive pelo nome e o devolve como texto
                                      └─ document.write: o site substitui a tela de carregamento
```

O Drive não serve HTML: quem abre o arquivo vê o código. O [serpentina.gs](apps-script/serpentina.gs) lê o
arquivo e o entrega como texto. O [serpentina.html](apps-script/serpentina.html), colado no Sites, escreve esse
texto no quadro, onde o navegador renderiza. Para atualizar o site, basta reenviar o arquivo ao
Drive com o mesmo nome.

Troque `site.seudominio.com` pelo subdomínio real em todos os passos.

## Caminho recomendado: subdomínio direto, sem Google Sites

```
serpentina.lonelas.com ──CNAME──▶ GitHub Pages (index.html, HTTPS automático)
                                    └─ fetch ──▶ serpentina.gs /exec?texto=1 ──▶ .html no Drive
                                    └─ document.write: o oráculo vira a própria página
```

O Apps Script não aceita domínio próprio. Por isso o subdomínio aponta para uma página carregadora
estática, a [index.html](index.html), que busca o HTML e o escreve como página
inteira: sem quadro, com altura normal e com o `<title>`/`<meta>` do próprio HTML. O conteúdo
continua vindo do Drive: para atualizar o site, basta reenviar o arquivo.

1. Faça o passo 2 abaixo (Apps Script) e confira que `.../exec?texto=1` devolve o HTML.
2. Repositório **público** [MarceloFerrante/serpentina](https://github.com/MarceloFerrante/serpentina) (já criado) com os arquivos da
   raiz deste repositório: o `index.html` (com `URL_EXEC` apontando para a sua implantação) e o `CNAME`
   (`serpentina.lonelas.com`).
3. No repositório: *Settings → Pages → Source: Deploy from a branch → main / (root)*. Em *Custom
   domain*, coloque `serpentina.lonelas.com`.
4. No DNS do `lonelas.com` (Squarespace Domains → *DNS* → *Custom records*), crie:

   | Tipo  | Nome         | Valor                       |
   |-------|--------------|-----------------------------|
   | CNAME | `serpentina` | `MarceloFerrante.github.io` |

5. Quando o GitHub mostrar o domínio como verificado, marque *Enforce HTTPS* (o certificado pode
   levar de minutos a algumas horas).

### Mais rápido: API do Drive

O Apps Script parado há um tempo leva de 30 a 60 s para entregar 5 MB. Por isso a página busca
primeiro pela API do Drive (servida pela rede do Google, em segundos) e só usa o Apps Script como
reserva. Para ligar:

1. **Compartilhamento do arquivo:** *Compartilhar → Acesso geral → Qualquer pessoa com o link →
   **Leitor***. Nunca *Editor*: o ID fica visível no código da página, e qualquer pessoa poderia
   trocar o site.
2. **Chave de API:** no [Google Cloud Console](https://console.cloud.google.com/):
   1. Crie ou escolha um projeto e ative a **Google Drive API** (*APIs e serviços → Biblioteca*).
   2. Em *APIs e serviços → Credenciais → Criar credenciais → Chave de API*, crie a chave.
   3. Edite a chave e restrinja:
      - *Restrições de aplicativos → Referenciadores HTTP*: `https://serpentina.lonelas.com/*`;
      - *Restrições de API → Google Drive API*.
3. Em `index.html`, preencha `API_KEY` (o `DRIVE_ID` já está preenchido) e publique no
   repositório `serpentina`.

A chave fica pública no código da página, e é assim mesmo: as restrições acima fazem com que ela só
funcione a partir do site e só para ler arquivos públicos do Drive.

Para atualizar o site por esse caminho, use *Gerenciar versões → Enviar nova versão*, que mantém o
ID. Se apagar e reenviar o arquivo, o ID muda: a página continua funcionando pela reserva (que acha
pelo nome), só que mais devagar, até o `DRIVE_ID` ser atualizado.

### Pasta do Drive como raiz (Service Worker)

```
serpentina.lonelas.com/assets/x.webp ──▶ sw.js ──▶ pasta do Drive/assets/x.webp (API do Drive)
```

O site deixa de ser um HTML só. O [sw.js](sw.js) lista a pasta do Drive
(`PASTA_ID`) e serve cada caminho do domínio com o arquivo de mesmo caminho na pasta, subpastas
incluídas. `/` vira `index.html`. Na primeira visita, a carregadora mostra a % enquanto baixa tudo
para o cache, e depois recarrega. Nas visitas seguintes, o site abre direto do cache, e só o que
mudou no Drive é baixado de novo. Mudanças aparecem na visita seguinte.

1. Divida o HTML monolítico: `python3 dividir.py oraculo_standalone.html saida/`. Ele tira as
   imagens e fontes em base64 para `saida/assets/` e gera `saida/index.html`.
2. Envie o conteúdo de `saida/` para a pasta do Drive: o `index.html` na raiz e a pasta `assets`
   dentro dela. A pasta precisa estar como *Qualquer pessoa com o link → Leitor*.
3. No repositório `serpentina`: `index.html`, `404.html` (cópia do index), `sw.js` e `CNAME`.

Enquanto a pasta não tiver `index.html`, o `sw.js` serve o `.html` que estiver na raiz. Sem
Service Worker (janela privada do Firefox, por exemplo), a carregadora usa o monolítico
(`DRIVE_ID`) ou o Apps Script. Por isso vale manter o `oraculo_standalone.html` na pasta.

### Outro site com subdomínio

Passo a passo em [NOVO_SITE.md](NOVO_SITE.md).

Os passos 3 e 4 (Google Sites e domínio no Sites) abaixo só valem se quiser usar o Sites.

## 1. Drive

Envie o `.html` para o Drive (não converta para Documentos Google). Ele não precisa ser
compartilhado.

O script acha o arquivo pelo nome. Ele ignora a lixeira e, se houver mais de um arquivo com o mesmo
nome, usa o modificado por último. Então pode apagar e reenviar, ou usar *Gerenciar versões*.

## 2. Apps Script: [serpentina.gs](apps-script/serpentina.gs)

1. Acesse [script.google.com](https://script.google.com) → *Novo projeto* → cole o `serpentina.gs`.
   Ajuste em `CONFIG`:
   - `NOME`: o nome do arquivo no Drive;
   - `CACHE_SECONDS`: por quanto tempo o HTML fica em cache;
   - `LINKS_EXTERNOS`: como os links para fora abrem.
2. *Configurações do projeto* (engrenagem) → marque *Mostrar o arquivo de manifesto
   "appsscript.json"*. Depois substitua o conteúdo dele pelo de [appsscript.json](apps-script/appsscript.json),
   que pede só leitura do Drive.
3. Selecione `testar` → *Executar* → autorize. O log deve mostrar `OK: <nome> (... bytes ...)`.
4. *Implantar* → *Nova implantação* → *App da Web*:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**

   Copie a URL `https://script.google.com/macros/s/.../exec`. Aberta direto, ela mostra a página
   (pelo `HtmlService`, com a faixa do Apps Script). Com `?texto=1` no fim, ela devolve o HTML como
   texto, que é o que o `serpentina.html` usa no Sites.

**Ao mudar o HTML:** ele passa a valer em até `CACHE_SECONDS` (padrão 5 min). Para valer na hora,
rode `limparCache` no editor.

**Ao mudar o código:** *Implantar* → *Gerenciar implantações* → lápis → *Versão: nova versão*.
Assim a URL continua a mesma. Uma "Nova implantação" gera outra URL.

## 3. Google Sites: [serpentina.html](apps-script/serpentina.html)

1. Acesse [sites.google.com](https://sites.google.com) → site em branco.
2. Em `serpentina.html`, troque `URL_EXEC` pela URL `/exec`. Se quiser, troque também o `TEXTO` de
   carregamento e as cores.
3. *Inserir* → *Incorporar* → aba **Código** → cole o arquivo inteiro → *Avançar* → *Inserir*.
4. Arraste as alças do quadro até a largura toda e a altura desejada (ver "Altura" abaixo).
5. Para deixar o Sites "invisível":
   - remova o cabeçalho;
   - use uma página só, para não aparecer menu de navegação;
   - em *Temas*, escolha *Simples*;
   - na engrenagem → *Marca*, defina o favicon;
   - o título da aba vem do nome da página/site no Sites.
6. *Publicar* → em *Quem pode ver*, deixe **Público**. O domínio próprio só funciona com o site
   publicado e público.

### Altura

O Sites não deixa a página de dentro mudar a altura do quadro. Ela é a que você arrastar no editor.
Para parecer uma página normal:

- **Site tipo app ou tela única:** deixe o quadro com mais ou menos uma tela de altura. No HTML, use
  `html, body { height: 100%; margin: 0; overflow: auto; }` para a rolagem acontecer dentro do
  quadro.
- **Página longa:** deixe o quadro mais alto que o conteúdo, para a rolagem ser a do Sites.

## 4. Subdomínio próprio

**Provar que o domínio é seu** (uma vez por domínio): no
[Google Search Console](https://search.google.com/search-console) → *Adicionar propriedade* →
**Domínio** → `seudominio.com`. Crie o registro TXT que ele mostrar e clique em *Verificar*.

**Apontar o subdomínio:** no DNS do domínio, crie:

| Tipo  | Nome   | Valor                                 |
|-------|--------|---------------------------------------|
| TXT   | `@`    | `google-site-verification=...`        |
| CNAME | `site` | `ghs.googlehosted.com.`               |

- Remova qualquer registro A ou AAAA que já exista para `site`.
- **Cloudflare:** deixe a nuvem **cinza (Somente DNS)**. Com proxy ligado, o Google não consegue
  emitir o certificado.

**Ligar no Sites:** *Publicar* (seta) → *Configurações de publicação* → *Domínios personalizados* →
*Iniciar configuração* → `site.seudominio.com`.

O HTTPS sai sozinho, em até 24 h. Numa conta Workspace sem essa opção, o admin mapeia em
*Admin console → Apps → Google Workspace → Sites → Mapeamento de endereços*.

**Conferir:**

```bash
dig +short CNAME site.seudominio.com
```

Deve responder `ghs.googlehosted.com.`.

## Limitações

- **Quadro do Sites:** o site roda dentro do quadro de incorporação do Sites (`*.googleusercontent.com`).
  - Links externos abrem em nova aba (`LINKS_EXTERNOS`). Âncoras `#secao` funcionam.
  - Links relativos para outros arquivos não funcionam, por isso o HTML precisa ser um arquivo só.
  - `localStorage` e cookies ficam separados do site principal.
  - Tela cheia, câmera e clipboard podem ser bloqueados.
- **Escala no celular:** quem decide é o Sites. O `<meta viewport>` do HTML não vale dentro do quadro.
- **Cotas:** contas pessoais têm limite diário de execuções do Apps Script, então isso serve para
  tráfego baixo ou médio.
- **Domínio raiz:** o Sites só aceita subdomínio (`site.`, `www.`), não `seudominio.com` puro.
- **Erros:** se o `/exec` falhar 3 vezes (até 90 s cada), a tela de carregamento mostra
  "NÃO FOI POSSÍVEL CARREGAR" e um botão para tentar de novo.
