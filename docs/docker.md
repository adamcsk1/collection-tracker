# Docker Deployment

The Docker image serves the built Angular applications with Nginx and runs the built Node server in the same container.

## Runtime Layout

- Nginx listens on port `3001`.
- The login application is served from `/login/`.
- The client application is served from `/client/`.
- `/api/` is proxied to the Node server on `127.0.0.1:3000`.
- `/data` is the writable volume for `.env`, flat-file databases, logs, and stored Markdown entries.

## Build Prerequisites

The image expects existing build artifacts:

- `dist/apps/client/browser`
- `dist/apps/login/browser`
- `dist/apps/server`

## Build And Run

```powershell
npm run build
docker buildx build --load -t collection-tracker .
docker run --rm -p 3001:3001 -v ${PWD}/.data:/data collection-tracker
```

## Docker Compose (Recommended for VPS)

A simple `docker-compose.yml` is included in the repo root. After building the app (`npm run build`), start the container with:

```bash
docker compose up -d
```

This will:
- Build the image if it doesn't exist (or run `docker compose up -d --build` to force a rebuild)
- Map host port `3001` (override with `APP_PORT` env var, e.g. `APP_PORT=8080 docker compose up -d`)
- Mount `./.data` on the host to `/data` in the container
- Automatically restart the container unless you stop it manually

To stop:

```bash
docker compose down
```

### One-shot VPS deploy example

```bash
# 1. Build locally (or on the VPS if node is installed)
npm run build

# 2. Start with Compose
docker compose up -d

# 3. View logs
docker compose logs -f
```

## Production Recommendation

Do not expose the container directly on the public internet in production. Put it behind an HTTPS reverse proxy such as Nginx, Caddy, or Traefik, terminate TLS at that layer, and forward traffic to the container on its internal HTTP port.

A typical setup is:

- public `https://your-domain.example` on the reverse proxy
- reverse proxy forwards requests to `http://127.0.0.1:3001`
- the container port stays private to the host or internal network

This is the recommended deployment model for secure cookie handling, TLS certificates, and standard production traffic management.

## Helper Scripts

The repository also includes shell helpers in [`docker/scripts`](../docker/scripts):

- [`docker/scripts/build.sh`](../docker/scripts/build.sh): builds the `collection-tracker` image from the current directory. Run it from the repo root or from a release folder that contains the copied Docker assets.
- [`docker/scripts/start.sh`](../docker/scripts/start.sh): starts the container in detached mode. Accepts three positional arguments: `DATA_FOLDER` (default `${PWD}/.data`), `IMAGE` (default `collection-tracker`), and `HOST_PORT` (default `3000`). Maps `HOST_PORT` on the host to container port `3001` (Nginx).
- [`docker/scripts/stop.sh`](../docker/scripts/stop.sh): stops any running container from the given image (default `collection-tracker`).

Example:

```bash
./docker/scripts/build.sh
./docker/scripts/start.sh .data collection-tracker 3001
./docker/scripts/stop.sh
```

## Operational Notes

- The runtime image is based on `node:24-alpine`.
- [`docker/entrypoint.sh`](../docker/entrypoint.sh) prepares the mounted `/data` volume and then drops privileges to the non-root `app` user.
- `npm run release:create` packages a release folder with the Docker assets copied in and ready for image creation.
