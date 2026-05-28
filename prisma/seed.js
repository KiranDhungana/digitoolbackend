require("dotenv").config();
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const npr = (amount) => Math.round((amount * 133) / 50) * 50;

const categories = [
  {
    slug: "gaming",
    name: "Gaming",
    icon: "gamepad",
    gradient: "from-violet-500 to-purple-700",
    sortOrder: 1,
  },
  {
    slug: "software",
    name: "Software",
    icon: "monitor",
    gradient: "from-sky-500 to-indigo-700",
    sortOrder: 2,
  },
];

const brands = [
  { slug: "pubg", name: "PUBG", gradient: "from-amber-600 to-stone-900", sortOrder: 1 },
  { slug: "apple", name: "Apple", gradient: "from-sky-400 to-indigo-700", sortOrder: 2 },
  { slug: "google-play", name: "Google Play", gradient: "from-emerald-500 to-teal-700", sortOrder: 3 },
  { slug: "xbox", name: "Xbox", gradient: "from-green-600 to-green-900", sortOrder: 4 },
  { slug: "roblox", name: "Roblox", gradient: "from-red-500 to-red-800", sortOrder: 5 },
];

const products = [
  {
    slug: "roblox-25",
    name: "Roblox Gift Card",
    brandSlug: "roblox",
    categorySlug: "gaming",
    price: npr(24.5),
    badge: "bestseller",
    gradient: "from-red-500 to-red-800",
    description: "Redeem for Robux or premium membership on Roblox.",
    denominations: [npr(10), npr(25), npr(50), npr(100)],
  },
  {
    slug: "pubg-50",
    name: "PUBG Mobile UC",
    brandSlug: "pubg",
    categorySlug: "gaming",
    price: npr(48.99),
    originalPrice: npr(54.99),
    badge: "promo",
    gradient: "from-amber-600 to-stone-900",
    description: "Unknown Cash for PUBG Mobile purchases.",
    denominations: [npr(25), npr(50), npr(100)],
  },
  {
    slug: "xbox-25",
    name: "Xbox Gift Card",
    brandSlug: "xbox",
    categorySlug: "gaming",
    price: npr(24.99),
    gradient: "from-green-600 to-green-900",
    description: "Games and Game Pass on Xbox and Windows.",
    denominations: [npr(15), npr(25), npr(50), npr(100)],
  },
  {
    slug: "apple-100",
    name: "Apple Gift Card",
    brandSlug: "apple",
    categorySlug: "software",
    price: npr(98.5),
    badge: "official",
    gradient: "from-sky-400 to-indigo-700",
    description: "Use on App Store, iTunes, Apple Music, and more.",
    denominations: [npr(25), npr(50), npr(100), npr(200)],
  },
  {
    slug: "google-play-25",
    name: "Google Play Gift Card",
    brandSlug: "google-play",
    categorySlug: "software",
    price: npr(24.5),
    gradient: "from-emerald-500 to-teal-700",
    description: "Apps, games, movies, and books on Google Play.",
    denominations: [npr(10), npr(25), npr(50)],
  },
];

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@digitoolera.local";
  const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.admin.upsert({
    where: { email },
    update: { passwordHash, name: "Super Admin" },
    create: { email, passwordHash, name: "Super Admin", role: "SUPERADMIN" },
  });

  const categorySlugs = categories.map((c) => c.slug);
  const brandSlugs = brands.map((b) => b.slug);
  const productSlugs = products.map((p) => p.slug);

  const categoryMap = {};
  for (const c of categories) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { ...c, isActive: true },
      create: c,
    });
    categoryMap[c.slug] = cat.id;
  }

  const brandMap = {};
  for (const b of brands) {
    const brand = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: { ...b, isActive: true },
      create: b,
    });
    brandMap[b.slug] = brand.id;
  }

  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        price: p.price,
        originalPrice: p.originalPrice ?? null,
        currency: "NPR",
        gradient: p.gradient,
        badge: p.badge ?? null,
        denominations: p.denominations,
        isActive: true,
        brandId: brandMap[p.brandSlug],
        categoryId: categoryMap[p.categorySlug],
      },
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        price: p.price,
        originalPrice: p.originalPrice ?? null,
        currency: "NPR",
        gradient: p.gradient,
        badge: p.badge ?? null,
        denominations: p.denominations,
        brandId: brandMap[p.brandSlug],
        categoryId: categoryMap[p.categorySlug],
      },
    });
  }

  await prisma.product.deleteMany({
    where: { slug: { notIn: productSlugs } },
  });

  await prisma.category.deleteMany({
    where: { slug: { notIn: categorySlugs } },
  });

  await prisma.brand.deleteMany({
    where: { slug: { notIn: brandSlugs } },
  });

  console.log("Seed complete.");
  console.log(`Categories: ${categorySlugs.join(", ")}`);
  console.log(`Brands: ${brandSlugs.join(", ")}`);
  console.log(`Products: ${productSlugs.join(", ")}`);
  console.log(`Superadmin login: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
