#!/usr/bin/env python3
"""Serpentina: divide um HTML monolítico numa pasta de site.

Tira as imagens e fontes embutidas como data: URI (base64) e as grava como
arquivos em assets/, trocando cada uma pelo caminho relativo. O resultado vai
para o Drive como pasta raiz do site (ver README, "Pasta do Drive como raiz").

Uso:
    python3 dividir.py oraculo_standalone.html saida/

Gera saida/index.html e saida/assets/*. Arquivos iguais viram um só.
"""
import base64
import hashlib
import re
import sys
from pathlib import Path

EXTENSOES = {
    'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
    'image/svg+xml': 'svg', 'image/avif': 'avif', 'image/x-icon': 'ico',
    'font/woff2': 'woff2', 'font/woff': 'woff', 'font/ttf': 'ttf', 'font/otf': 'otf',
    'application/font-woff': 'woff', 'application/font-woff2': 'woff2',
    'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'video/mp4': 'mp4',
}
GRUPOS = {'image': 'imagem', 'audio': 'audio', 'video': 'video'}
DATA_URI = re.compile(r'data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)')
# Abaixo disso, deixar embutido sai mais barato que um pedido a mais.
MINIMO = 4096


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    origem, saida = Path(sys.argv[1]), Path(sys.argv[2])
    html = origem.read_text(encoding='utf-8')
    (saida / 'assets').mkdir(parents=True, exist_ok=True)

    nomes = {}  # sha1 -> caminho relativo
    contagem = {}

    def trocar(m):
        tipo, b64 = m.group(1), m.group(2)
        ext = EXTENSOES.get(tipo)
        if not ext or len(b64) < MINIMO:
            return m.group(0)
        dados = base64.b64decode(b64)
        chave = hashlib.sha1(dados).hexdigest()
        if chave not in nomes:
            grupo = 'fonte' if tipo.startswith(('font/', 'application/font')) else GRUPOS[tipo.split('/')[0]]
            contagem[grupo] = contagem.get(grupo, 0) + 1
            nomes[chave] = 'assets/%s-%d.%s' % (grupo, contagem[grupo], ext)
            (saida / nomes[chave]).write_bytes(dados)
        return nomes[chave]

    novo = DATA_URI.sub(trocar, html)
    (saida / 'index.html').write_text(novo, encoding='utf-8')

    print('index.html: %d KB (era %d KB)' % (len(novo.encode()) // 1024, len(html.encode()) // 1024))
    for caminho in sorted(nomes.values()):
        print('%s: %d KB' % (caminho, (saida / caminho).stat().st_size // 1024))


if __name__ == '__main__':
    main()
