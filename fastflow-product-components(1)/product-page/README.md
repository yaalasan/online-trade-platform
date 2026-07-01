# Fastflow product page — component set

Drop-in Next.js components for the product detail page. Presentational: they take a
`Product` object as props, so your data fetching stays yours. Same look as the mockup.

## Files

```
components/
  types.ts               data model + a sort helper
  product-detail.css     all styles (design tokens at the top)
  ProductGallery.tsx     media gallery: video/image, hover-zoom, thumbnail rail, upload tiles
  BuyPanel.tsx           price, MOQ, tiers, variant chips, quantity, CTAs, trust block
  SpecTable.tsx          per-product specs — read-only OR editable (add/edit/delete/reorder)
  DescriptionBlocks.tsx  text / banner / image-grid / video blocks in order
  FaqAndInquiry.tsx      FaqAccordion + InquiryForm (with client-side validation)
  MediaUploader.tsx      R2 presigned upload widget
  ProductDetail.tsx      page-level component composing all of the above
backend/
  product_uploads.py     Flask blueprint: R2 presigned URL endpoint (auth + allowlist)
```

## Wiring it up

Buyer view (read-only):

```tsx
// app/products/[id]/page.tsx  (server component)
import ProductDetail from "@/components/ProductDetail";
import { getProduct } from "@/lib/products";

export default async function Page({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);   // your data layer -> Product
  return <ProductDetail product={product} />;
}
```

Supplier/admin edit view (media upload + spec editing):

```tsx
"use client";
<ProductDetail
  product={product}
  editable
  onUploadMedia={(type) => openUploader(type)}      // render <MediaUploader/> in a modal
  onAddDescBlock={() => openBlockPicker()}
  onSpecsChange={(specs) => saveSpecs(product.id, specs)}  // debounce / save on blur
/>
```

## Key points

- **Nothing about specs is hardcoded.** `SpecTable` renders whatever `product.specs[]`
  contains and, in `editable` mode, lets you add/rename/reorder rows per product. A carport
  and a fabric roll just carry different rows.
- **Reorder** uses ↑/↓ buttons (zero dependencies). For true drag-and-drop later, swap the
  `move()` handler for `@dnd-kit/sortable` — the `sortOrder` field already supports it.
- **Gallery is data-driven** by `product.media[]`. Video renders as `<video>`, images get
  hover-zoom. In `editable` mode the rail ends with + Photo / + Video / + 360° tiles.
- **Uploads never touch your server.** Flask signs a URL; the browser PUTs straight to R2.
  Mime type is bound into the signature, and both frontend and backend enforce the same
  allowlist + size cap (spec C6).
- **Persistence is yours.** Components call back with new data; wire the callbacks to your
  Flask endpoints (`/media/presign`, spec save, inquiry). Always re-validate server-side.

## Backend deps

```
pip install boto3
```
Env: `R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET R2_PUBLIC_BASE`.
Replace `current_user()` and `user_owns_product()` in `product_uploads.py` with your real
auth — those two stubs are the IDOR guard from spec C1.

## Thumbnails
`presign` returns `thumbUrl = url` as a placeholder. Add a Celery task that, after upload,
fetches the object, resizes to ~200px, writes `<media_id>_thumb.webp`, and patches `thumbUrl`
so the 64px rail isn't loading full-res files.
