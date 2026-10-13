import { PrismaClient, UserStatus, MemberStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Ensuring Three Distinct Experience Test Accounts...');

  // Set PostgreSQL session variable so RLS permits provisioning
  await prisma.$executeRawUnsafe(`SET app.is_platform_admin = 'true';`);

  // 1. Resolve 4B Association and ADMIN Role
  const org4b = await prisma.organization.findUnique({
    where: { slug: '4b' },
  });

  if (!org4b) {
    throw new Error('Organization "4b" not found! Please check seeded organizations.');
  }

  const adminRole = await prisma.role.findFirst({
    where: { code: 'ADMIN' },
  });

  if (!adminRole) {
    throw new Error('System Role "ADMIN" not found! Please check seeded roles.');
  }

  // -------------------------------------------------------------
  // Account 1: Platform / All-Organization Admin
  // -------------------------------------------------------------
  const platformAdminEmail = 'platform.admin@test.waanofii.local';
  const platformAdminPassword = 'WaanOfii.Platform.Admin.2026!';
  const platformAdminHash = await argon2.hash(platformAdminPassword, { type: argon2.argon2id });

  const platformAdmin = await prisma.user.upsert({
    where: { email: platformAdminEmail },
    update: {
      passwordHash: platformAdminHash,
      isPlatformAdmin: true,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: platformAdminEmail,
      firstName: 'Platform',
      lastName: 'Admin',
      passwordHash: platformAdminHash,
      isPlatformAdmin: true,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`✅ Platform Admin provisioned: ${platformAdmin.email} (ID: ${platformAdmin.id})`);

  // -------------------------------------------------------------
  // Account 2: Single-Organization Admin (4B Association)
  // -------------------------------------------------------------
  const orgAdminEmail = 'org.admin.4b@test.waanofii.local';
  const orgAdminPassword = 'WaanOfii.Org.Admin.2026!';
  const orgAdminHash = await argon2.hash(orgAdminPassword, { type: argon2.argon2id });

  const orgAdmin = await prisma.user.upsert({
    where: { email: orgAdminEmail },
    update: {
      passwordHash: orgAdminHash,
      isPlatformAdmin: false,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: orgAdminEmail,
      firstName: 'OrgAdmin',
      lastName: '4B',
      passwordHash: orgAdminHash,
      isPlatformAdmin: false,
      status: UserStatus.ACTIVE,
    },
  });

  // Ensure StaffMembership for Org Admin
  const existingStaff = await prisma.staffMembership.findFirst({
    where: {
      organizationId: org4b.id,
      userId: orgAdmin.id,
    },
  });

  if (!existingStaff) {
    await prisma.staffMembership.create({
      data: {
        organizationId: org4b.id,
        userId: orgAdmin.id,
        roleId: adminRole.id,
        isActive: true,
      },
    });
  } else {
    await prisma.staffMembership.update({
      where: { id: existingStaff.id },
      data: {
        roleId: adminRole.id,
        isActive: true,
      },
    });
  }

  // Ensure Org Admin also has a MemberProfile in 4B
  const existingAdminMemberProfile = await prisma.memberProfile.findFirst({
    where: {
      organizationId: org4b.id,
      userId: orgAdmin.id,
    },
  });

  if (!existingAdminMemberProfile) {
    await prisma.memberProfile.create({
      data: {
        organizationId: org4b.id,
        userId: orgAdmin.id,
        memberNumber: '4B-ADM01',
        firstName: orgAdmin.firstName,
        lastName: orgAdmin.lastName,
        email: orgAdmin.email,
        status: MemberStatus.ACTIVE,
      },
    });
  }
  console.log(`✅ Single-Org Admin provisioned: ${orgAdmin.email} (ID: ${orgAdmin.id}, Staff Role: ADMIN)`);

  // -------------------------------------------------------------
  // Account 3: Organization Member (4B Association)
  // -------------------------------------------------------------
  const memberEmail = 'member.4b@test.waanofii.local';
  const memberPassword = 'WaanOfii.Member.2026!';
  const memberHash = await argon2.hash(memberPassword, { type: argon2.argon2id });

  const memberUser = await prisma.user.upsert({
    where: { email: memberEmail },
    update: {
      passwordHash: memberHash,
      isPlatformAdmin: false,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: memberEmail,
      firstName: 'Member',
      lastName: '4B',
      passwordHash: memberHash,
      isPlatformAdmin: false,
      status: UserStatus.ACTIVE,
    },
  });

  // Ensure ZERO staff memberships exist for memberUser
  await prisma.staffMembership.deleteMany({
    where: { userId: memberUser.id },
  });

  // Ensure MemberProfile exists in 4B
  const existingMemberProfile = await prisma.memberProfile.findFirst({
    where: {
      organizationId: org4b.id,
      userId: memberUser.id,
    },
  });

  if (!existingMemberProfile) {
    await prisma.memberProfile.create({
      data: {
        organizationId: org4b.id,
        userId: memberUser.id,
        memberNumber: '4B-MEM01',
        firstName: memberUser.firstName,
        lastName: memberUser.lastName,
        email: memberUser.email,
        status: MemberStatus.ACTIVE,
      },
    });
  } else {
    await prisma.memberProfile.update({
      where: { id: existingMemberProfile.id },
      data: {
        status: MemberStatus.ACTIVE,
      },
    });
  }
  console.log(`✅ Organization Member provisioned: ${memberUser.email} (ID: ${memberUser.id}, No Staff Membership)`);

  console.log('\n🎉 Successfully provisioned all 3 test accounts idempotently!');
}

main()
  .catch((e) => {
    console.error('❌ Failed to provision test accounts:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
