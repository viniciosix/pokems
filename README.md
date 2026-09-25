# PokeMS

Radar pessoal experimental para visualizar detecções de Pokémon em um mapa de Campo Grande/MS.

## Já está no repositório

- mapa web em Leaflet/OpenStreetMap;
- API Node.js + Socket.IO;
- scanner Python via ADB;
- reconhecimento visual da tela "Por perto";
- rota de varredura em grade;
- helper Android de localização de teste;
- frontend em `docs/` preparado para GitHub Pages.

## Site

O workflow `.github/workflows/pages.yml` publica automaticamente o conteúdo de `docs/` no GitHub Pages.

Quando o Pages estiver ativo, o endereço esperado é:

`https://viniciosix.github.io/pokems/`

A página estática pede a URL pública do backend na primeira abertura e salva essa URL no navegador.

## Rodar o backend

```bash
cp .env.example .env
# troque RADARMS_TOKEN no arquivo .env
docker compose up -d --build
```

Sem Docker:

```bash
cd server
npm install
RADARMS_TOKEN=seu-token npm start
```

A API abre na porta `8787`.

## Scanner

```bash
cd scanner
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp config.example.yaml config.yaml
python radar_scanner.py --config config.yaml --dry-run
```

Depois ajuste o IP/URL do backend, token e calibração da tela em `scanner/config.yaml`.

## Estrutura

```text
server/                 API + site ao vivo
scanner/                ADB + rota + reconhecimento visual
android-mock-location/  app auxiliar Android
docs/                   frontend publicado no GitHub Pages
```

> Projeto experimental. Localização simulada pode ser recusada pelo cliente do jogo e pode colocar uma conta secundária em risco.
