import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SCOOTERS = [
  { name: "Trottinette Électrique Teverun Space 52V 18AH", sku: "TEVERUN-SPACE-52V", price: 1082.50, image: "https://www.trottistore.fr/wp-content/uploads/2025/07/TEVERUNSPACE52V18A-TROTTINETTE-ELECTRIQUE-TEVERUN-SPACE-52V-18AH-300x300.png", brand: "Teverun" },
  { name: "Trottinette Électrique Teverun Blade Mini Ultra 60V 27A", sku: "TEVERUN-BLADE-MINI", price: 1415.83, image: "https://www.trottistore.fr/wp-content/uploads/2025/07/TEVERUNBLADEMINIULTRA-TROTTINETTE-ELECTRIQUE-TEVERUN-BLADE-MINI-ULTRA-60V-27A-300x300.jpg", brand: "Teverun" },
  { name: "Trottinette Électrique Dualtron Forever 60V 18,2A 2025 EY4", sku: "DUALTRON-FOREVER-60V", price: 1165.83, image: "https://www.trottistore.fr/wp-content/uploads/2025/07/MMDUALTRONFOREVER60V18A2025-TROTTINETTE-ELECTRIQUE-DUALTRON-FOREVER-60V-182A-2025-EY4-300x300.jpg", brand: "Dualtron" },
  { name: "Trottinette Kuickwheel S9 36V 15,6 Ah", sku: "KUICKWHEEL-S9", price: 665.83, image: "https://www.trottistore.fr/wp-content/uploads/2025/07/KUICKWHEELS9-TROTTINETTE-KUICKWHEEL-S9-36V-156-Ah-300x300.jpg", brand: "Kuickwheel" },
  { name: "Trottinette Électrique Dualtron X LTD", sku: "DUALTRON-X-LTD", price: 5824.17, image: "https://www.trottistore.fr/wp-content/uploads/2025/07/MMDUALTRONXLTD-TROTTINETTE-ELECTRIQUE-DUALTRON-X-LTD-300x300.jpg", brand: "Dualtron" },
  { name: "Trottinette Électrique Dualtron Achilleus 60V 35AH Rouge 2024", sku: "DUALTRON-ACHILLEUS-R", price: 2332.50, image: "https://www.trottistore.fr/wp-content/uploads/2025/07/MMDUALTRONACHILLEUSR2023-TROTTINETTE-ELECTRIQUE-DUALTRON-ACHILLEUS-60V-35AH-ROUGE-2024-300x300.jpg", brand: "Dualtron" },
  { name: "Trottinette Électrique Dualtron Achilleus 60V 35AH 2024", sku: "DUALTRON-ACHILLEUS", price: 2332.50, image: "https://www.trottistore.fr/wp-content/uploads/2025/07/MMDUALTRONACHILLEUS2023-TROTTINETTE-ELECTRIQUE-DUALTRON-ACHILLEUS-60V-35AH-2024-300x300.jpg", brand: "Dualtron" },
  { name: "Trottinette Électrique Teverun Fighter 7260R Édition 2024", sku: "TEVERUN-FIGHTER-7260R", price: 2915.83, image: "https://www.trottistore.fr/wp-content/uploads/2025/07/TEVERUNSUPREME602024-TROTTINETTE-ELECTRIQUE-TEVERUN-FIGHTER-7260R-EDITION-2024-V3-300x300.jpg", brand: "Teverun" },
  { name: "Trottinette Électrique Teverun Tetra 4 Moteurs", sku: "TEVERUN-TETRA", price: 4165.83, image: "https://www.trottistore.fr/wp-content/uploads/2025/07/TEVERUNTETRA-TROTTINETTE-ELECTRIQUE-TEVERUN-TETRA-4-MOTEURS-300x300.jpg", brand: "Teverun" },
  { name: "Trottinette Électrique Dualtron Aminia Special 52V 17,5Ah IPX5", sku: "DUALTRON-AMINIA", price: 832.50, image: "https://www.trottistore.fr/wp-content/uploads/2025/07/MMDUALTRONAMINIA5217-TROTTINETTE-ELECTRIQUE-DUALTRON-AMINIA-SPECIAL-52V-175Ah-IPX5-300x300.jpg", brand: "Dualtron" },
  { name: "Trottinette Électrique Dualtron Togo Plus 48V15A", sku: "DUALTRON-TOGO-PLUS", price: 665.83, image: "https://www.trottistore.fr/wp-content/uploads/2025/07/MMDUALTRONTOGO48V15A-TROTTINETTE-ELECTRIQUE-DUALTRON-TOGO-PLUS-48V15A-300x300.jpg", brand: "Dualtron" },
  { name: "Trottinette Électrique Dualtron New Storm LTD 84V45AH EY4", sku: "DUALTRON-STORM-LTD", price: 3999.17, image: "https://www.trottistore.fr/wp-content/uploads/2025/07/MMDUALTRONNEWSTORMLTD-TROTTINETTE-ELECTRIQUE-DUALTRON-NEW-STORM-LTD-84V45AH-EY4-300x300.jpg", brand: "Dualtron" },
];

async function main() {
  console.log("Seeding electric scooters...\n");

  // 1. Create or find the category
  const category = await prisma.category.upsert({
    where: { slug: "trottinettes-electriques" },
    update: {},
    create: {
      name: "Trottinettes Électriques",
      slug: "trottinettes-electriques",
      description: "Découvrez notre sélection de trottinettes électriques des meilleures marques : Dualtron, Teverun, Kuickwheel et plus encore.",
      isActive: true,
      position: 0,
      metaTitle: "Trottinettes Électriques | TrottiStore",
      metaDesc: "Achetez votre trottinette électrique parmi notre sélection Dualtron, Teverun, Kuickwheel. Livraison rapide, paiement en 2x 3x 4x sans frais.",
    },
  });
  console.log(`Category: "${category.name}" (${category.id})`);

  // 2. Create or find brands
  const brandNames = [...new Set(SCOOTERS.map((s) => s.brand))];
  const brandMap: Record<string, string> = {};

  for (const brandName of brandNames) {
    const brand = await prisma.brand.upsert({
      where: { slug: slugify(brandName) },
      update: {},
      create: {
        name: brandName,
        slug: slugify(brandName),
        isActive: true,
      },
    });
    brandMap[brandName] = brand.id;
    console.log(`Brand: "${brand.name}" (${brand.id})`);
  }

  // 3. Create products
  console.log("\nCreating products...\n");

  for (const scooter of SCOOTERS) {
    const slug = slugify(scooter.name);
    const randomStock = Math.floor(Math.random() * 5) + 1;

    // Upsert product
    const product = await prisma.product.upsert({
      where: { sku: scooter.sku },
      update: {
        name: scooter.name,
        slug,
        priceHt: scooter.price,
        tvaRate: 20,
        brandId: brandMap[scooter.brand],
        isFeatured: true,
        status: "ACTIVE",
      },
      create: {
        sku: scooter.sku,
        name: scooter.name,
        slug,
        priceHt: scooter.price,
        tvaRate: 20,
        brandId: brandMap[scooter.brand],
        isFeatured: true,
        status: "ACTIVE",
        shortDescription: `${scooter.name} - Marque ${scooter.brand}. Disponible chez TrottiStore avec garantie 2 ans.`,
      },
    });

    // Link product to category (upsert via deleteMany + create)
    await prisma.productCategory.upsert({
      where: {
        productId_categoryId: {
          productId: product.id,
          categoryId: category.id,
        },
      },
      update: {},
      create: {
        productId: product.id,
        categoryId: category.id,
      },
    });

    // Create or update primary image
    const existingImage = await prisma.productImage.findFirst({
      where: { productId: product.id, isPrimary: true },
    });

    if (existingImage) {
      await prisma.productImage.update({
        where: { id: existingImage.id },
        data: { url: scooter.image, alt: scooter.name },
      });
    } else {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: scooter.image,
          alt: scooter.name,
          position: 0,
          isPrimary: true,
        },
      });
    }

    // Create or update default variant
    const variantSku = `${scooter.sku}-DEFAULT`;
    await prisma.productVariant.upsert({
      where: { sku: variantSku },
      update: {
        stockQuantity: randomStock,
      },
      create: {
        productId: product.id,
        sku: variantSku,
        name: "Standard",
        stockQuantity: randomStock,
        lowStockThreshold: 3,
        isActive: true,
      },
    });

    const priceTTC = (scooter.price * 1.2).toFixed(2);
    console.log(
      `  [OK] ${scooter.name}\n` +
      `       SKU: ${scooter.sku} | HT: ${scooter.price}EUR | TTC: ${priceTTC}EUR | Stock: ${randomStock}`
    );
  }

  console.log(`\nDone! Seeded ${SCOOTERS.length} scooters in category "${category.name}".`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
