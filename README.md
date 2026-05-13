# Freaking Collectibles

A premium ecommerce-style trading card storefront built with Next.js, Firebase Authentication, Firestore, and admin-managed catalog data.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
npm run start
```

## Update products

Use the admin panel for product updates in production. The local `data/products.json` file is used as fallback demo data.

Each product supports:

```json
{
  "id": "single-001",
  "name": "Holo Dragon V Star",
  "category": "Singles",
  "price": 1299,
  "stock": 6,
  "image": "/images/hero-cards.png",
  "tag": "Near Mint"
}
```

Place new images in `public/images`, then update the `image` path.

## Firebase project

Production uses Firebase project `ecommerce-web-7fc55`. Keep the public Firebase config and Firebase Admin credentials pointed at that same project.
