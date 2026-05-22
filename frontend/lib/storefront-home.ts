import type { StoreProduct } from "@/lib/storefront";

export type HomeProduct = {
  id: string;
  name: string;
  image: string;
  price: number;
  oldPrice: number;
  category: string;
  badge?: string;
  slug: string;
};

export type HomeCategoryTile = {
  name: string;
  slug: string;
  image: string;
};

export type HomeHeroSlide = {
  id: string;
  title: string;
  subtitle: string;
  discount: string;
  ctaLabel: string;
  image: string;
  imageAlt: string;
};

const demoCatalog: HomeProduct[] = [
  {
    id: "shirt-classic-white",
    name: "Classic White Formal Shirt",
    image: "/storefront/demo-products/jacket-monogram-3153.jpg",
    price: 1590,
    oldPrice: 1860,
    category: "Shirt",
    slug: "classic-white-formal-shirt",
  },
  {
    id: "pant-slim-black",
    name: "Slim Fit Black Pant",
    image: "/storefront/demo-products/jacket-italian-3154.jpg",
    price: 1590,
    oldPrice: 1860,
    category: "Pant",
    slug: "slim-fit-black-pant",
  },
  {
    id: "polo-clean-charcoal",
    name: "Clean Charcoal Polo",
    image: "/storefront/demo-products/jacket-puffer-3159.jpg",
    price: 1590,
    oldPrice: 1890,
    category: "Polo",
    slug: "clean-charcoal-polo",
  },
  {
    id: "polo-circle-black",
    name: "Circle Black Polo",
    image: "/storefront/demo-products/jacket-italian-3154.jpg",
    price: 1580,
    oldPrice: 1850,
    category: "Polo",
    slug: "circle-black-polo",
  },
  {
    id: "winter-knit-grey",
    name: "Winter Knit Grey Jacket",
    image: "/storefront/demo-products/jacket-puffer-3159.jpg",
    price: 2250,
    oldPrice: 2860,
    category: "Jacket",
    badge: "30% OFF",
    slug: "winter-knit-grey-jacket",
  },
  {
    id: "winter-polo-noir",
    name: "Winter Noir Zip Polo",
    image: "/storefront/demo-products/jacket-monogram-3153.jpg",
    price: 1250,
    oldPrice: 1840,
    category: "Polo",
    badge: "30% OFF",
    slug: "winter-noir-zip-polo",
  },
  {
    id: "winter-shirt-white",
    name: "Winter White Premium Shirt",
    image: "/storefront/demo-products/jacket-italian-3154.jpg",
    price: 2250,
    oldPrice: 2860,
    category: "Shirt",
    badge: "50% OFF",
    slug: "winter-white-premium-shirt",
  },
  {
    id: "winter-polo-redline",
    name: "Redline Winter Polo",
    image: "/storefront/demo-products/jacket-italian-3154.jpg",
    price: 1230,
    oldPrice: 1650,
    category: "Polo",
    badge: "30% OFF",
    slug: "redline-winter-polo",
  },
];

export const HOME_HERO_SLIDES: HomeHeroSlide[] = [
  {
    id: "everyday-style",
    title: "STYLE THAT FITS",
    subtitle: "YOUR EVERYDAY",
    discount: "UP TO 70% OFF",
    ctaLabel: "Shop Now",
    image: "/storefront/demo-products/jacket-monogram-3153.jpg",
    imageAlt: "Fashion promotion for everyday style",
  },
  {
    id: "bd-fashion-deal",
    title: "LIVE SHOPPING",
    subtitle: "FASHION DEALS",
    discount: "UP TO 60% OFF",
    ctaLabel: "Shop Now",
    image: "/storefront/demo-products/jacket-italian-3154.jpg",
    imageAlt: "Bangladesh fashion deal banner",
  },
  {
    id: "winter-picks",
    title: "WINTER READY",
    subtitle: "TOP PICKS",
    discount: "START FROM BDT 990",
    ctaLabel: "Shop Now",
    image: "/storefront/demo-products/jacket-puffer-3159.jpg",
    imageAlt: "Winter collection spotlight",
  },
];

export const HOME_NEW_ARRIVALS = demoCatalog.slice(0, 4);

export const HOME_WINTER_COLLECTION = demoCatalog.slice(4, 8);

export const HOME_CATEGORY_TILES: HomeCategoryTile[] = [
  { name: "Accessories", slug: "accessories", image: "/storefront/demo-products/sneakers-flex-3374.png" },
  { name: "Watch", slug: "watch", image: "/storefront/demo-products/jacket-italian-3154.jpg" },
  { name: "Sunglass", slug: "sunglass", image: "/storefront/demo-products/sneakers-leopard-3772.png" },
  { name: "Tie", slug: "tie", image: "/storefront/demo-products/jacket-monogram-3153.jpg" },
  { name: "Panjabi", slug: "panjabi", image: "/storefront/demo-products/jacket-puffer-3159.jpg" },
  { name: "T-Shirt", slug: "t-shirt", image: "/storefront/demo-products/jacket-italian-3154.jpg" },
  { name: "Shoe", slug: "shoe", image: "/storefront/demo-products/sneakers-flex-3374.png" },
  { name: "Jacket", slug: "jacket", image: "/storefront/demo-products/jacket-puffer-3159.jpg" },
];

export function createStoreProductFromHomeProduct(product: HomeProduct): StoreProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: String(product.oldPrice),
    sale_price: String(product.price),
    image: product.image,
    thumbnail: product.image,
    gallery: [product.image],
    category: {
      id: `${product.category.toLowerCase()}-category`,
      name: product.category,
      slug: product.category.toLowerCase().replace(/\s+/g, "-"),
      description: null,
    },
    brand: null,
    stock_status: "in_stock",
    short_description: `${product.category} collection item for Amar-eCom storefront mock data.`,
    description: null,
    colors: [],
    sizes: [],
    support_notes: [],
    is_demo_reference: true,
    demo_notice: "Homepage mock product",
    is_active: true,
    is_public: true,
  };
}
