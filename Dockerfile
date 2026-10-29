FROM node:24.18.0-bookworm-slim AS frontend
WORKDIR /build
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY index.html vite.config.js ./
COPY scripts/pyodide-assets.cjs scripts/pages-base.cjs ./scripts/
COPY src ./src
RUN npm run build

FROM node:24.18.0-bookworm-slim
WORKDIR /app
ENV HOST=0.0.0.0 PORT=8000
COPY scripts/serve-static.cjs ./scripts/
COPY --from=frontend /build/dist ./dist
USER node
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "scripts/serve-static.cjs"]
