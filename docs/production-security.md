# Freaking Collectibles Production Security Notes

## App Check rollout

Keep `FIREBASE_APPCHECK_ENFORCE=false` until the deployed domain is registered in Firebase App Check and the client site key is deployed. After the production site loads without App Check errors, enable enforcement in Firebase Console and then set `FIREBASE_APPCHECK_ENFORCE=true` in Vercel.

## Admin authorization

Admin APIs accept Firebase custom claim `admin: true` first. `ADMIN_EMAILS` is a temporary fallback. After every owner account has the custom claim, set `REQUIRE_ADMIN_CLAIM=true` in Vercel.

## Browser storage policy

Browser storage is for safe UX state only:

- cart items
- currently applied coupon code
- non-sensitive order summary fallback
- product display cache

Customer profiles, order ownership, emails, addresses, billing totals, UTR numbers, payment screenshots, coupons, and admin state must stay in Firebase/server-side systems.

## Backups

Use scheduled Firestore exports for these collections:

- `orders`
- `customers`
- `products`
- `coupons`

Recommended schedule: daily export to a locked Google Cloud Storage bucket with object versioning and restricted IAM. Keep at least 30 days of restore points.

## Storage paths

Future uploads should use these paths:

- `payment-screenshots/{uid}/{orderId}/{fileName}`
- `product-images/{fileName}`

The matching `storage.rules` file restricts payment screenshots to the owner/admin and product image writes to admins.
