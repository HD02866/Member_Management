import {
  PrismaClient,
  OrganizationStatus,
  SubscriptionStatus,
  UserStatus,
  MemberStatus,
  BillingInterval,
  MembershipStatus,
  PaymentMethodType,
  PaymentStatus,
  PaymentType,
  ReviewDecision,
  CardStatus,
  VerificationResult,
  ContentStatus,
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting WaanOfii Database Seed...');

  // Set PostgreSQL session variable so that RLS permits seeding
  await prisma.$executeRawUnsafe(`SET app.is_platform_admin = 'true';`);

  // 1. Clean existing seed data (idempotency)
  console.log('🧹 Purging existing data for clean idempotent seed...');
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.verificationLog.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.digitalMembershipCard.deleteMany();
  await prisma.paymentReview.deleteMany();
  await prisma.paymentProof.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.membershipPeriod.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.membershipPlan.deleteMany();
  await prisma.memberProfile.deleteMany();
  await prisma.staffMembership.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.session.deleteMany();
  await prisma.organizationProfile.deleteMany();
  await prisma.organizationDomain.deleteMany();
  await prisma.organizationSubscription.deleteMany();
  await prisma.saasPlan.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.rule.deleteMany();
  await prisma.benefit.deleteMany();
  await prisma.program.deleteMany();
  await prisma.leader.deleteMany();
  await prisma.leadershipPosition.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  // 2. Global SaaS Plans
  console.log('📦 Creating SaaS Subscription Plans...');
  const pilotPlan = await prisma.saasPlan.create({
    data: {
      name: 'Free Pilot',
      code: 'FREE_PILOT',
      description: 'Pilot plan for testing and early launch associations',
      price: 0,
      currency: 'USD',
      maxMembers: 100,
      maxStaff: 2,
      storageLimitMb: 1024,
      features: { customDomain: false, automatedGateways: false },
    },
  });

  const growthPlan = await prisma.saasPlan.create({
    data: {
      name: 'Professional Growth',
      code: 'PROFESSIONAL_GROWTH',
      description: 'Ideal for established associations and organizations',
      price: 49.99,
      currency: 'USD',
      maxMembers: 10000,
      maxStaff: 15,
      storageLimitMb: 51200,
      features: { customDomain: true, automatedGateways: true },
    },
  });

  // 3. Global Permissions
  console.log('🔐 Creating RBAC Permissions...');
  const permissionsList = [
    { code: 'tenant:members:read', module: 'members', description: 'View members roster' },
    { code: 'tenant:members:approve', module: 'members', description: 'Approve new applicants' },
    { code: 'tenant:members:suspend', module: 'members', description: 'Suspend members' },
    { code: 'tenant:payments:read', module: 'payments', description: 'View payment records' },
    { code: 'tenant:payments:approve', module: 'payments', description: 'Approve/reject payment slips' },
    { code: 'tenant:cards:issue', module: 'cards', description: 'Issue digital membership cards' },
    { code: 'tenant:cards:revoke', module: 'cards', description: 'Revoke digital membership cards' },
    { code: 'tenant:cards:verify', module: 'cards', description: 'Scan and verify member QR codes' },
    { code: 'tenant:content:manage', module: 'content', description: 'Manage programs, rules, announcements' },
    { code: 'tenant:staff:manage', module: 'staff', description: 'Manage staff roles' },
    { code: 'tenant:settings:manage', module: 'settings', description: 'Manage organization settings' },
    { code: 'tenant:audit:view', module: 'audit', description: 'View tenant audit logs' },
  ];

  const permissions: Record<string, string> = {};
  for (const p of permissionsList) {
    const created = await prisma.permission.create({ data: p });
    permissions[p.code] = created.id;
  }

  // 4. System Roles
  console.log('🛡️ Creating Predefined System Roles...');
  const ownerRole = await prisma.role.create({
    data: {
      name: 'Organization Owner',
      code: 'OWNER',
      description: 'Full administrative ownership over the organization',
      isSystem: true,
    },
  });

  const adminRole = await prisma.role.create({
    data: {
      name: 'Organization Admin',
      code: 'ADMIN',
      description: 'Operational manager with member and content management authority',
      isSystem: true,
    },
  });

  const financeRole = await prisma.role.create({
    data: {
      name: 'Finance Officer',
      code: 'FINANCE_OFFICER',
      description: 'Treasury specialist managing payments and reconciliations',
      isSystem: true,
    },
  });

  const verifierRole = await prisma.role.create({
    data: {
      name: 'Organization Verifier',
      code: 'VERIFIER',
      description: 'Field agent with QR scanner verification rights only',
      isSystem: true,
    },
  });

  // Assign permissions to roles
  for (const permId of Object.values(permissions)) {
    await prisma.rolePermission.create({ data: { roleId: ownerRole.id, permissionId: permId } });
  }

  const adminPermCodes = [
    'tenant:members:read', 'tenant:members:approve', 'tenant:members:suspend',
    'tenant:cards:issue', 'tenant:cards:revoke', 'tenant:cards:verify',
    'tenant:content:manage', 'tenant:staff:manage', 'tenant:audit:view'
  ];
  for (const code of adminPermCodes) {
    await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: permissions[code] } });
  }

  const financePermCodes = [
    'tenant:members:read', 'tenant:payments:read', 'tenant:payments:approve', 'tenant:cards:verify'
  ];
  for (const code of financePermCodes) {
    await prisma.rolePermission.create({ data: { roleId: financeRole.id, permissionId: permissions[code] } });
  }

  await prisma.rolePermission.create({
    data: { roleId: verifierRole.id, permissionId: permissions['tenant:cards:verify'] },
  });

  // 5. Global Users (Credentials)
  console.log('👥 Creating Global Users...');
  const mockPasswordHash = await argon2.hash('Password123!', { type: argon2.argon2id });

  const superAdminUser = await prisma.user.create({
    data: {
      email: 'admin@waanofii.com',
      phoneNumber: '+251911000001',
      firstName: 'Dawit',
      lastName: 'PlatformAdmin',
      passwordHash: mockPasswordHash,
      isPlatformAdmin: true,
      status: UserStatus.ACTIVE,
    },
  });

  const selamOwner = await prisma.user.create({
    data: {
      email: 'selam.owner@4bassociation.org',
      phoneNumber: '+251911000002',
      firstName: 'Selam',
      lastName: 'Bekele',
      passwordHash: mockPasswordHash,
      status: UserStatus.ACTIVE,
    },
  });

  const kebedeAdmin = await prisma.user.create({
    data: {
      email: 'kebede.admin@4bassociation.org',
      phoneNumber: '+251911000003',
      firstName: 'Kebede',
      lastName: 'Tadesse',
      passwordHash: mockPasswordHash,
      status: UserStatus.ACTIVE,
    },
  });

  const asterFinance = await prisma.user.create({
    data: {
      email: 'aster.finance@4bassociation.org',
      phoneNumber: '+251911000004',
      firstName: 'Aster',
      lastName: 'Girma',
      passwordHash: mockPasswordHash,
      status: UserStatus.ACTIVE,
    },
  });

  const tigistVerifier = await prisma.user.create({
    data: {
      email: 'tigist.verifier@4bassociation.org',
      phoneNumber: '+251911000005',
      firstName: 'Tigist',
      lastName: 'Alemu',
      passwordHash: mockPasswordHash,
      status: UserStatus.ACTIVE,
    },
  });

  const abebeMember = await prisma.user.create({
    data: {
      email: 'abebe.member@example.com',
      phoneNumber: '+251911000006',
      firstName: 'Abebe',
      lastName: 'Bikila',
      passwordHash: mockPasswordHash,
      status: UserStatus.ACTIVE,
    },
  });

  const hannaApplicant = await prisma.user.create({
    data: {
      email: 'hanna.applicant@example.com',
      phoneNumber: '+251911000007',
      firstName: 'Hanna',
      lastName: 'Tesfaye',
      passwordHash: mockPasswordHash,
      status: UserStatus.ACTIVE,
    },
  });

  const dawitExpired = await prisma.user.create({
    data: {
      email: 'dawit.expired@example.com',
      phoneNumber: '+251911000008',
      firstName: 'Dawit',
      lastName: 'Mengistu',
      passwordHash: mockPasswordHash,
      status: UserStatus.ACTIVE,
    },
  });

  const chalaSuspended = await prisma.user.create({
    data: {
      email: 'chala.suspended@example.com',
      phoneNumber: '+251911000009',
      firstName: 'Chala',
      lastName: 'Gutema',
      passwordHash: mockPasswordHash,
      status: UserStatus.ACTIVE,
    },
  });

  const yohannesMedOwner = await prisma.user.create({
    data: {
      email: 'yohannes.owner@ethiomed.org',
      phoneNumber: '+251911000010',
      firstName: 'Dr. Yohannes',
      lastName: 'Worku',
      passwordHash: mockPasswordHash,
      status: UserStatus.ACTIVE,
    },
  });

  // 6. Tenant 1: 4B Association
  console.log('🏛️ Creating Tenant 1: 4B Association...');
  const org4B = await prisma.organization.create({
    data: {
      name: '4B Association',
      slug: '4b',
      status: OrganizationStatus.ACTIVE,
      contactEmail: 'info@4bassociation.org',
      contactPhone: '+251115500000',
      address: 'Bole Sub-City, Woreda 03, Addis Ababa, Ethiopia',
      timezone: 'Africa/Addis_Ababa',
      defaultLanguage: 'am',
      supportedLanguages: ['en', 'am'],
      currency: 'ETB',
    },
  });

  await prisma.organizationSubscription.create({
    data: {
      organizationId: org4B.id,
      saasPlanId: growthPlan.id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.organizationProfile.create({
    data: {
      organizationId: org4B.id,
      mission: {
        en: 'To foster community solidarity, mutual assistance, and cultural preservation.',
        am: 'የማህበረሰባችንን አንድነት፣ የጋራ መረዳዳት እና ባህላዊ እሴቶችን ማጎልበት።',
      },
      vision: {
        en: 'A thriving, digitally connected, and self-sufficient community.',
        am: 'የበለጸገ፣ በቴክኖሎጂ የተሳሰረ እና ራሱን የቻለ ጠንካራ ማህበረሰብ።',
      },
      history: {
        en: 'Founded to unite members and modernize community welfare.',
        am: 'አባላትን ለማስተባበር እና የማህበረሰብ ደህንነት አገልግሎቶችን ለማዘመን የተመሰረተ።',
      },
      brandingConfig: {
        primaryColor: '#1e3a8a',
        secondaryColor: '#f59e0b',
        fontFamily: 'Noto Sans Ethiopic',
      },
      socialLinks: {
        telegram: 'https://t.me/association4b',
        facebook: 'https://facebook.com/association4b',
      },
    },
  });

  // Assign 4B Staff
  await prisma.staffMembership.createMany({
    data: [
      { organizationId: org4B.id, userId: selamOwner.id, roleId: ownerRole.id },
      { organizationId: org4B.id, userId: kebedeAdmin.id, roleId: adminRole.id },
      { organizationId: org4B.id, userId: asterFinance.id, roleId: financeRole.id },
      { organizationId: org4B.id, userId: tigistVerifier.id, roleId: verifierRole.id },
    ],
  });

  // 4B Membership Plans
  const plan4BMonthly = await prisma.membershipPlan.create({
    data: {
      organizationId: org4B.id,
      name: 'ወርሃዊ መደበኛ አባልነት',
      code: '4B_MONTHLY',
      description: { en: 'Standard monthly contribution', am: 'መደበኛ የወርሃዊ አባልነት ክፍያ' },
      price: 100.0,
      currency: 'ETB',
      billingInterval: BillingInterval.MONTHLY,
      durationCount: 1,
      isActive: true,
    },
  });

  const plan4BAnnual = await prisma.membershipPlan.create({
    data: {
      organizationId: org4B.id,
      name: 'ዓመታዊ መደበኛ አባልነት',
      code: '4B_ANNUAL',
      description: { en: 'Full annual membership with discount', am: 'የሙሉ ዓመት መደበኛ አባልነት' },
      price: 1000.0,
      currency: 'ETB',
      billingInterval: BillingInterval.ANNUAL,
      durationCount: 1,
      isActive: true,
    },
  });

  // 4B Payment Methods
  const methodCbe = await prisma.paymentMethod.create({
    data: {
      organizationId: org4B.id,
      type: PaymentMethodType.BANK_TRANSFER,
      name: 'የኢትዮጵያ ንግድ ባንክ (CBE)',
      accountName: '4B Association Main Account',
      accountNumber: '1000123456789',
      bankName: 'Commercial Bank of Ethiopia',
      branchName: 'Finfine Branch',
      instructions: {
        en: 'Transfer via CBE Mobile App or Branch and enter the FT reference code.',
        am: 'በCBE ሞባይል ባንኪንግ ወይም በቅርንጫፍ በማስገባት የFT ቁጥሩን ያስገቡ።',
      },
    },
  });

  const methodTelebirr = await prisma.paymentMethod.create({
    data: {
      organizationId: org4B.id,
      type: PaymentMethodType.TELEBIRR,
      name: 'Telebirr SuperApp',
      accountNumber: '849201',
      instructions: {
        en: 'Pay to Merchant Code 849201 and upload the transaction receipt screenshot.',
        am: 'ወደ የነጋዴ ቁጥር 849201 ከፍለው የደረሰኝ ስክሪንሾት ይላኩ።',
      },
    },
  });

  // 4B Member 1: Active Member (Abebe Bikila)
  const profileAbebe = await prisma.memberProfile.create({
    data: {
      organizationId: org4B.id,
      userId: abebeMember.id,
      memberNumber: '4B-2026-00101',
      firstName: 'Abebe',
      lastName: 'Bikila',
      email: abebeMember.email,
      phoneNumber: abebeMember.phoneNumber,
      status: MemberStatus.ACTIVE,
    },
  });

  const membershipAbebe = await prisma.membership.create({
    data: {
      organizationId: org4B.id,
      memberProfileId: profileAbebe.id,
      membershipPlanId: plan4BAnnual.id,
      status: MembershipStatus.ACTIVE,
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      renewalCount: 0,
    },
  });

  const paymentAbebe = await prisma.payment.create({
    data: {
      organizationId: org4B.id,
      membershipId: membershipAbebe.id,
      memberProfileId: profileAbebe.id,
      paymentMethodId: methodCbe.id,
      amount: 1000.0,
      currency: 'ETB',
      status: PaymentStatus.VERIFIED,
      paymentType: PaymentType.MEMBERSHIP_DUES,
      transactionReference: 'FT26274901CBE',
      paidAt: new Date(),
      reviewedByUserId: asterFinance.id,
      reviewedAt: new Date(),
      notes: 'Verified against CBE statement',
    },
  });

  await prisma.digitalMembershipCard.create({
    data: {
      organizationId: org4B.id,
      membershipId: membershipAbebe.id,
      memberProfileId: profileAbebe.id,
      cardNumber: '4B-CARD-00101',
      cardVersion: 1,
      status: CardStatus.ACTIVE,
      issueDate: new Date(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      verificationToken: {
        create: {
          organizationId: org4B.id,
          token: 'tok_4b_abebe_verified_2026',
          tokenHash: crypto.createHash('sha256').update('tok_4b_abebe_verified_2026').digest('hex'),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });

  // 4B Member 2: Pending Member (Hanna Tesfaye)
  const profileHanna = await prisma.memberProfile.create({
    data: {
      organizationId: org4B.id,
      userId: hannaApplicant.id,
      memberNumber: '4B-2026-00102',
      firstName: 'Hanna',
      lastName: 'Tesfaye',
      email: hannaApplicant.email,
      phoneNumber: hannaApplicant.phoneNumber,
      status: MemberStatus.PENDING_APPROVAL,
    },
  });

  const membershipHanna = await prisma.membership.create({
    data: {
      organizationId: org4B.id,
      memberProfileId: profileHanna.id,
      membershipPlanId: plan4BMonthly.id,
      status: MembershipStatus.UNDER_REVIEW,
    },
  });

  const paymentHanna = await prisma.payment.create({
    data: {
      organizationId: org4B.id,
      membershipId: membershipHanna.id,
      memberProfileId: profileHanna.id,
      paymentMethodId: methodTelebirr.id,
      amount: 100.0,
      currency: 'ETB',
      status: PaymentStatus.UNDER_REVIEW,
      paymentType: PaymentType.MEMBERSHIP_DUES,
      transactionReference: 'TB260930102',
      reviewedByUserId: asterFinance.id,
    },
  });

  await prisma.paymentProof.create({
    data: {
      organizationId: org4B.id,
      paymentId: paymentHanna.id,
      fileUrl: 'https://storage.waanofii.com/tenants/4b/receipts/proof_hanna_102.jpg',
      fileType: 'image/jpeg',
      fileSize: 245120,
      originalFileName: 'telebirr_slip.jpg',
    },
  });

  // 4B Member 3: Expired Member (Dawit Mengistu)
  const profileDawit = await prisma.memberProfile.create({
    data: {
      organizationId: org4B.id,
      userId: dawitExpired.id,
      memberNumber: '4B-2026-00055',
      firstName: 'Dawit',
      lastName: 'Mengistu',
      status: MemberStatus.ACTIVE,
    },
  });

  const membershipDawit = await prisma.membership.create({
    data: {
      organizationId: org4B.id,
      memberProfileId: profileDawit.id,
      membershipPlanId: plan4BAnnual.id,
      status: MembershipStatus.EXPIRED,
      startDate: new Date(Date.now() - 395 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Expired 30 days ago
    },
  });

  await prisma.digitalMembershipCard.create({
    data: {
      organizationId: org4B.id,
      membershipId: membershipDawit.id,
      memberProfileId: profileDawit.id,
      cardNumber: '4B-CARD-00055',
      status: CardStatus.EXPIRED,
      issueDate: new Date(Date.now() - 395 * 24 * 60 * 60 * 1000),
      expirationDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      verificationToken: {
        create: {
          organizationId: org4B.id,
          token: 'tok_4b_dawit_expired_2025',
          tokenHash: crypto.createHash('sha256').update('tok_4b_dawit_expired_2025').digest('hex'),
          expiresAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });

  // 4B Member 4: Suspended Member (Chala Gutema)
  const profileChala = await prisma.memberProfile.create({
    data: {
      organizationId: org4B.id,
      userId: chalaSuspended.id,
      memberNumber: '4B-2026-00088',
      firstName: 'Chala',
      lastName: 'Gutema',
      status: MemberStatus.SUSPENDED,
    },
  });

  const membershipChala = await prisma.membership.create({
    data: {
      organizationId: org4B.id,
      memberProfileId: profileChala.id,
      membershipPlanId: plan4BAnnual.id,
      status: MembershipStatus.SUSPENDED,
      suspendedAt: new Date(),
      suspensionReason: 'Bylaw code of conduct violation pending board review',
    },
  });

  await prisma.digitalMembershipCard.create({
    data: {
      organizationId: org4B.id,
      membershipId: membershipChala.id,
      memberProfileId: profileChala.id,
      cardNumber: '4B-CARD-00088',
      status: CardStatus.REVOKED,
      issueDate: new Date(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      revokedAt: new Date(),
      revocationReason: 'Administrative suspension',
      verificationToken: {
        create: {
          organizationId: org4B.id,
          token: 'tok_4b_chala_revoked_2026',
          tokenHash: crypto.createHash('sha256').update('tok_4b_chala_revoked_2026').digest('hex'),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          isRevoked: true,
        },
      },
    },
  });

  // 4B Content (Leadership, Programs, Benefits, Rules, Announcements)
  const posChair = await prisma.leadershipPosition.create({
    data: {
      organizationId: org4B.id,
      title: { en: 'Association Chairman', am: 'የማህበሩ ሊቀመንበር' },
      code: 'CHAIRMAN',
      displayOrder: 1,
    },
  });

  await prisma.leader.create({
    data: {
      organizationId: org4B.id,
      positionId: posChair.id,
      name: 'Dr. Selam Bekele',
      bio: { en: 'Over 15 years in civic leadership and community welfare development.', am: 'ከ15 ዓመት በላይ በማህበረሰብ አመራር ልምድ ያላት።' },
      email: 'selam.bekele@4bassociation.org',
      displayOrder: 1,
    },
  });

  await prisma.program.create({
    data: {
      organizationId: org4B.id,
      title: { en: 'Annual Community Assembly 2026', am: 'ዓመታዊ የማህበረሰብ ጉባኤ 2026' },
      description: { en: 'Discussion of community development projects and budget approval.', am: 'የማህበረሰብ ልማት ፕሮጀክቶች ውይይት እና የፋይናንስ ሪፖርት ማፅደቅ።' },
      category: 'General Assembly',
      status: ContentStatus.PUBLISHED,
      startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.benefit.create({
    data: {
      organizationId: org4B.id,
      title: { en: 'Emergency Mutual Aid Fund', am: 'የድንገተኛ አደጋ መረዳጃ ፈንድ' },
      description: { en: 'Financial grant support in times of family bereavement or medical emergency.', am: 'በቤተሰብ ሐዘን ወይም በድንገተኛ ሕመም ጊዜ የሚደረግ የገንዘብ ድጋፍ።' },
      icon: 'ShieldCheck',
      displayOrder: 1,
    },
  });

  await prisma.rule.create({
    data: {
      organizationId: org4B.id,
      title: { en: '4B Association Constitution & Bylaws', am: 'የ4B ማህበር መተዳደሪያ ደንብ' },
      contentMarkdown: {
        en: '### Article 1: Membership Obligations\nAll active members must contribute dues by the 10th of each calendar month.',
        am: '### አንቀጽ 1፡ የአባላት ግዴታ\nማንኛውም አባል ወርሃዊ ክፍያውን እስከ እያንዳንዱ ወር 10ኛ ቀን ማጠናቀቅ አለበት።',
      },
      displayOrder: 1,
    },
  });

  await prisma.announcement.create({
    data: {
      organizationId: org4B.id,
      title: { en: 'Welcome to the WaanOfii Digital Portal', am: 'ወደ አዲሱ የ4B ማህበር ዲጂታል ፖርታል እንኳን በደህና መጡ' },
      content: {
        en: 'We are thrilled to launch our new digital membership management platform with mobile QR verification.',
        am: 'የአባላት ምዝገባ እና ዲጂታል መታወቂያ አገልግሎታችንን በዘመናዊ ቴክኖሎጂ ማስጀመራችንን በደስታ እናበስራለን።',
      },
      isPinned: true,
      status: ContentStatus.PUBLISHED,
    },
  });

  // 7. Tenant 2: Ethiopian Medical Association (Demonstrating multi-tenancy & cross-membership)
  console.log('🏛️ Creating Tenant 2: Ethiopian Medical Association (Multi-tenancy demo)...');
  const orgMed = await prisma.organization.create({
    data: {
      name: 'Ethiopian Medical Association',
      slug: 'ethio-med',
      status: OrganizationStatus.ACTIVE,
      contactEmail: 'contact@ethiomed.org',
      contactPhone: '+251115512345',
      address: 'Churchill Road, Addis Ababa',
      timezone: 'Africa/Addis_Ababa',
      defaultLanguage: 'en',
      supportedLanguages: ['en', 'am'],
      currency: 'ETB',
    },
  });

  await prisma.organizationSubscription.create({
    data: {
      organizationId: orgMed.id,
      saasPlanId: growthPlan.id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.staffMembership.create({
    data: {
      organizationId: orgMed.id,
      userId: yohannesMedOwner.id,
      roleId: ownerRole.id,
    },
  });

  const planMedSpecialist = await prisma.membershipPlan.create({
    data: {
      organizationId: orgMed.id,
      name: 'Specialist Physician Membership',
      code: 'MED_SPECIALIST',
      description: { en: 'Annual licensing credentialing and journal access', am: 'የስፔሻሊስት ሐኪሞች ዓመታዊ አባልነት' },
      price: 2500.0,
      currency: 'ETB',
      billingInterval: BillingInterval.ANNUAL,
      durationCount: 1,
    },
  });

  // MULTI-TENANCY AFFILIATION: Abebe Bikila is ALSO a member in EthioMed!
  const profileAbebeMed = await prisma.memberProfile.create({
    data: {
      organizationId: orgMed.id,
      userId: abebeMember.id, // SAME GLOBAL USER
      memberNumber: 'EMA-2026-8842',
      firstName: 'Abebe',
      lastName: 'Bikila',
      email: abebeMember.email,
      phoneNumber: abebeMember.phoneNumber,
      status: MemberStatus.ACTIVE,
    },
  });

  const membershipAbebeMed = await prisma.membership.create({
    data: {
      organizationId: orgMed.id,
      memberProfileId: profileAbebeMed.id,
      membershipPlanId: planMedSpecialist.id,
      status: MembershipStatus.ACTIVE,
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.digitalMembershipCard.create({
    data: {
      organizationId: orgMed.id,
      membershipId: membershipAbebeMed.id,
      memberProfileId: profileAbebeMed.id,
      cardNumber: 'EMA-CARD-8842',
      status: CardStatus.ACTIVE,
      issueDate: new Date(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      verificationToken: {
        create: {
          organizationId: orgMed.id,
          token: 'tok_ema_abebe_specialist_2026',
          tokenHash: crypto.createHash('sha256').update('tok_ema_abebe_specialist_2026').digest('hex'),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });

  console.log('✅ Seed completed successfully:');
  console.log(`   - Organizations: 2 (4B Association, Ethiopian Medical Association)`);
  console.log(`   - Global Users: 10`);
  console.log(`   - Cross-Tenant Member: Abebe Bikila active in both 4B and EMA`);
  console.log(`   - Membership States Tested: ACTIVE, UNDER_REVIEW, EXPIRED, SUSPENDED`);
}

main()
  .catch((e) => {
    console.error('❌ Error executing seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
