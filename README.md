# Mint Lane Cards

A lightweight ecommerce-style trading card storefront built with Next.js, local JSON products, and a localStorage cart.

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

Edit `data/products.json`.

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

## Notes

- Cart data is stored in the shopper's browser localStorage.
- Checkout is manual and shows a fake success message, with no backend or payment gateway.
- Product images use Next image optimization and lazy loading.
