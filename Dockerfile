FROM denoland/deno:alpine AS builder
WORKDIR /app
COPY --chown=deno:deno . .
RUN deno task build

FROM denoland/deno:alpine
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 8000
CMD ["run", "-A", "main.ts"]
