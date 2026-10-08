# Preço Perto

Preço Perto: o menor preço perto de você. Digite qualquer produto (mercado, padaria, farmácia, pet, construção, autopeças, eletrônicos) e veja as lojas próximas, o menor preço, a distância e se entregam. Mobile-first, em português.

- **Nichos**: `src/lib/categories.ts` classifica a busca (ex.: dipirona → farmácia, ração → pet, cimento → construção) e escolhe os tipos de loja do OSM e as redes online do nicho.

- **Preços dos sites**: adaptadores por rede (`src/lib/chains`) — Zona Sul, Prezunic e Atacadão (APIs públicas VTEX) e Pão de Açúcar (API pública de busca do GPA). Cache de 15 min, timeout por rede.
- **Preços da comunidade**: formulário "Registrar preço" com foto opcional, confirmação "ainda vale", rate limit por IP.
- **Mercados**: OpenStreetMap via Overpass (cache por célula de ~5 km por 7 dias). Mapa Leaflet + tiles OSM.
- **Entrega**: simulação de frete pública da VTEX para o CEP aproximado (Nominatim); senão "consultar".

Stack: Next.js 14 (App Router), Prisma, Postgres (Neon), Vercel.

```bash
npm install
cp .env.example .env   # DATABASE_URL / DIRECT_URL
npx prisma db push
npm run dev
```
