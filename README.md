# Sleeperapp

This repository contains a [Fresh](https://fresh.deno.dev) web application built
with Deno that renders data from the [Sleeper](https://sleeper.com) fantasy
football API. The home page lists rosters for league `1248432621554237440`.
Additional routes expose more league information:

- `/players` – alphabetical list of NFL players
- `/league` – basic info about the league
- `/matchups` – week 1 matchups for the league

Most Sleeper API endpoints are proxied through `/api/sleeper/*` which forwards
requests to `https://api.sleeper.app/v1/`.

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
