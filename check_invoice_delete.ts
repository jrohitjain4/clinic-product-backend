import { PrismaClient } from "./src/generated/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Checking invoices...");
  const invoices = await prisma.invoice.findMany({
    include: { items: true }
  });
  console.log(`Found ${invoices.length} invoices.`);
  if (invoices.length === 0) {
    console.log("No invoices found to delete.");
    return;
  }
  const target = invoices[0];
  console.log("Target invoice for deletion:", target.id, target.invoiceCode);
  try {
    const deleted = await prisma.invoice.delete({
      where: { id: target.id }
    });
    console.log("Invoice deleted successfully!", deleted);
  } catch (err: any) {
    console.error("Prisma Deletion Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
