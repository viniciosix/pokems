# PokeMS

Radar pessoal experimental de Pokémon para Mato Grosso do Sul, com frontend e backend preparados para rodar no mesmo projeto Netlify.

## Interface

A nova interface é mobile-first e inspirada em mapas de rastreamento:

- mapa grande em cartão claro;
- identidade azul/amarela inspirada em Pokémon;
- busca por espécie;
- favoritos persistidos no navegador;
- filtro "somente favoritos";
- filtro de sinais recentes;
- distância máxima usando o GPS do navegador;
- confiança mínima;
- status do scanner;
- botão para abrir rota;
- alertas locais para espécies favoritas;
- sprites obtidos pela PokéAPI quando disponíveis.

## Backend no Netlify

O backend foi convertido para Netlify Functions:

- `GET /api/health`
- `GET /api/spawns`
- `GET|POST /api/status`
- `POST /api/detections`
- `POST /api/clear`

Os dados persistem em **Netlify Blobs**, então não dependem do filesystem temporário das Functions.

### Variáveis de ambiente

No Netlify, configure:

```
RADARMS_TOKEN=coloque-um-token-longo-aqui
SPAWN_TTL_MINUTES=25
```

O token deve ser o mesmo usado em `scanner/config.yaml`.

## Deploy

O projeto já contém `netlify.toml`:

- publish: `public/`
- functions: `netlify/functions/`

Conecte o repositório `viniciosix/pokems` a um projeto Netlify e ele fica full-stack no mesmo domínio.

## Scanner

```bash
cd scanner
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp config.example.yaml config.yaml
```

Edite `config.yaml` com o domínio Netlify e o mesmo `RADARMS_TOKEN`.

Teste primeiro a rota sem mover o aparelho:

```bash
python radar_scanner.py --config config.yaml --dry-run
```

## Estrutura

```text
public/                  frontend Netlify
netlify/functions/       API serverless + Netlify Blobs
scanner/                 ADB + rota + reconhecimento visual
android-mock-location/   helper Android
server/                  backend Node legado/local
```

> Projeto experimental. Localização simulada pode ser recusada pelo cliente do jogo e pode colocar uma conta secundária em risco.
