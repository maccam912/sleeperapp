# Sleeperapp

This repository contains a minimal [Fresh](https://fresh.deno.dev) web
application built with Deno.

## Development

Run the development server:

```sh
deno task start
```

## Docker

Build and run the application with Docker:

```sh
docker build -t sleeperapp .
docker run -p 8000:8000 sleeperapp
```

## GitHub Container Registry

Pushes to the `main` branch trigger a GitHub Actions workflow that builds the
Docker image and publishes it to the GitHub Container Registry.
