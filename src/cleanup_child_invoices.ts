import prisma from "./lib/prisma";

async function main() {
  // Find all invoices that belong to child therapy sessions
  const childInvoices = await prisma.invoice.findMany({
    where: {
      appointment: {
        appointmentType: "therapy",
        parentAppointmentId: { not: null }
      }
    }
  });

  console.log(`Found ${childInvoices.length} duplicate child therapy invoices to delete.`);

  // Delete them
  if (childInvoices.length > 0) {
    const ids = childInvoices.map(inv => inv.id);
    // Delete invoice items first (cascade or manual delete if needed)
    await prisma.invoiceItem.deleteMany({
      where: { invoiceId: { in: ids } }
    });
    
    const deleteRes = await prisma.invoice.deleteMany({
      where: { id: { in: ids } }
    });
    console.log(`Deleted ${deleteRes.count} child invoices successfully.`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
