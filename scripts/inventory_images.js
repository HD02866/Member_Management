const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const files = await prisma.uploadedFile.findMany({ take: 10 });
  console.log('UPLOADED FILES COUNT:', files.length);
  console.log(files.map(f => ({ id: f.id, purpose: f.purpose, url: f.url })));

  const members = await prisma.memberProfile.findMany({
    where: { photoUrl: { not: null } },
    select: { id: true, firstName: true, photoUrl: true }
  });
  console.log('MEMBERS WITH PHOTO:', members);

  const anns = await prisma.announcement.findMany({
    where: { coverImageUrl: { not: null } },
    select: { id: true, coverImageUrl: true }
  });
  console.log('ANNOUNCEMENTS WITH COVER:', anns);

  const msgAtts = await prisma.messageAttachment.findMany({ take: 5 });
  console.log('MSG ATTACHMENTS:', msgAtts);

  const grpAtts = await prisma.groupMessageAttachment.findMany({ take: 5 });
  console.log('GRP ATTACHMENTS:', grpAtts);
}

main().finally(() => prisma.$disconnect());
