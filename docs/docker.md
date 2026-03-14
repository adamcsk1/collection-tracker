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
- [`docker/scripts/start.sh`](../docker/scripts/start.sh): starts the container in detached mode, stores the container id in `./.container_id`, and mounts `${PWD}/.data` to `/data`.
- [`docker/scripts/stop.sh`](../docker/scripts/stop.sh): stops the container recorded in `./.container_id` and removes that file.

Example:

```bash
./docker/scripts/build.sh
./docker/scripts/start.sh 3001
./docker/scripts/stop.sh
```

Use `3001` with `start.sh`. The script maps the same host and container port, and the image serves traffic on port `3001`.

## Operational Notes

- The runtime image is based on `node:24-alpine`.
- [`docker/entrypoint.sh`](../docker/entrypoint.sh) prepares the mounted `/data` volume and then drops privileges to the non-root `app` user.
- `npm run release:create` packages a release folder with the Docker assets copied in and ready for image creation.
