import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function run4BayeExperienceTests() {
  console.log('\n========================================================');
  console.log('🏛️  4BAYE DEDICATED INSTITUTIONAL PLATFORM VERIFICATION');
  console.log('========================================================\n');

  try {
    // -------------------------------------------------------------
    // SUITE 1: 4Baye Organization & Identity in Database
    // -------------------------------------------------------------
    console.log('--- 1. 4Baye Database Presence & Seeding ---');
    const fourBOrg = await prisma.organization.findFirst({
      where: { slug: '4b' },
    });
    assert(!!fourBOrg, '4Baye Association exists in database with slug "4b"');
    assert(fourBOrg!.name === '4B Association' || fourBOrg!.name.includes('4B'), 'Organization name identifies 4B');

    const memberCount = await prisma.memberProfile.count({
      where: { organizationId: fourBOrg!.id },
    });
    assert(memberCount > 50, `4Baye has robust seeded membership (found ${memberCount} members)`);

    const programsCount = await prisma.program.count({
      where: { organizationId: fourBOrg!.id },
    });
    assert(programsCount > 0, `4Baye has active institutional programs (found ${programsCount})`);

    const benefitsCount = await prisma.benefit.count({
      where: { organizationId: fourBOrg!.id },
    });
    assert(benefitsCount > 0, `4Baye has active institutional benefits (found ${benefitsCount})`);

    const announcementsCount = await prisma.announcement.count({
      where: { organizationId: fourBOrg!.id },
    });
    assert(announcementsCount > 0, `4Baye has published announcements (found ${announcementsCount})`);

    // -------------------------------------------------------------
    // SUITE 2: Exactly Two Customer-Facing Experiences
    // -------------------------------------------------------------
    console.log('\n--- 2. Dual User Experience Roles & Boundaries ---');
    // Experience 1: 4Baye Owner/Admin (Kebede)
    const adminUser = await prisma.user.findFirst({
      where: { email: 'kebede.admin@4bassociation.org' },
    });
    assert(!!adminUser, '4Baye Admin user (Kebede) exists');
    const adminStaff = await prisma.staffMembership.findFirst({
      where: { userId: adminUser!.id, organizationId: fourBOrg!.id, isActive: true },
      include: { role: true },
    });
    assert(!!adminStaff && adminStaff.role.code === 'ADMIN', 'Kebede holds ADMIN staff role in 4Baye');
    assert(!adminUser!.isPlatformAdmin, 'Kebede is NOT a platform admin (pure 4Baye Admin)');

    // Experience 2: 4Baye Member (Abebe)
    const memberUser = await prisma.user.findFirst({
      where: { email: 'abebe.member@example.com' },
    });
    assert(!!memberUser, '4Baye Member user (Abebe) exists');
    const memberProfile = await prisma.memberProfile.findFirst({
      where: { userId: memberUser!.id, organizationId: fourBOrg!.id },
    });
    assert(!!memberProfile, 'Abebe has active MemberProfile in 4Baye');
    assert(!memberUser!.isPlatformAdmin, 'Abebe is NOT a platform admin');

    const memberStaff = await prisma.staffMembership.findFirst({
      where: { userId: memberUser!.id, organizationId: fourBOrg!.id, isActive: true },
    });
    assert(!memberStaff, 'Abebe has NO staff membership in 4Baye (Pure Member)');

    // -------------------------------------------------------------
    // SUITE 3: Absence of Customer-Facing SaaS & Platform Admin Leaks
    // -------------------------------------------------------------
    console.log('\n--- 3. Clean Branding & Route Redirection ---');
    const webRoot = path.resolve(__dirname, '../apps/web/src');

    // Check navbar doesn't link to platform admin or SaaS
    const navbarContent = fs.readFileSync(path.join(webRoot, 'components/ui/Navbar.tsx'), 'utf-8');
    assert(!navbarContent.includes('/admin/'), 'Navbar contains no links to Platform Admin (/admin/)');
    assert(!navbarContent.includes('/pricing'), 'Navbar contains no links to SaaS Pricing');
    assert(!navbarContent.includes('OrganizationSwitcher'), 'Navbar has removed OrganizationSwitcher component');
    assert(navbarContent.includes('4Baye'), 'Navbar prominently displays 4Baye branding');

    // Check footer is branded 4Baye
    const footerContent = fs.readFileSync(path.join(webRoot, 'components/ui/Footer.tsx'), 'utf-8');
    assert(footerContent.includes('4Baye Association'), 'Footer displays 4Baye Association');
    assert(!footerContent.includes('WaanOfii Platform'), 'Footer does not mention generic WaanOfii Platform');

    // Check redirects exist for old SaaS routes
    const pricingContent = fs.readFileSync(path.join(webRoot, 'app/pricing/page.tsx'), 'utf-8');
    assert(pricingContent.includes('/membership'), '/pricing redirects to /membership');

    const featuresContent = fs.readFileSync(path.join(webRoot, 'app/features/page.tsx'), 'utf-8');
    assert(featuresContent.includes('/programs'), '/features redirects to /programs');

    const orgsContent = fs.readFileSync(path.join(webRoot, 'app/organizations/page.tsx'), 'utf-8');
    assert(orgsContent.includes('/about'), '/organizations redirects to /about');

    // Check login & register pages
    const loginContent = fs.readFileSync(path.join(webRoot, 'app/login/page.tsx'), 'utf-8');
    assert(loginContent.includes('4Baye') || loginContent.includes('4B'), 'Login page branded as 4Baye');

    const registerContent = fs.readFileSync(path.join(webRoot, 'app/register/page.tsx'), 'utf-8');
    assert(!registerContent.includes('<select') && !registerContent.includes('organizationId'), 'Registration does not offer organization dropdown');

    // -------------------------------------------------------------
    // SUITE 4: Localization Key Parity (EN, OM, AM)
    // -------------------------------------------------------------
    console.log('\n--- 4. Trilingual Localization Parity (EN, OM, AM) ---');
    const en = JSON.parse(fs.readFileSync(path.join(webRoot, 'locales/en.json'), 'utf-8'));
    const om = JSON.parse(fs.readFileSync(path.join(webRoot, 'locales/om.json'), 'utf-8'));
    const am = JSON.parse(fs.readFileSync(path.join(webRoot, 'locales/am.json'), 'utf-8'));

    function getKeys(obj: any, prefix = ''): string[] {
      return Object.keys(obj).reduce((acc: string[], k: string) => {
        const pre = prefix.length ? prefix + '.' : '';
        if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
          acc.push(...getKeys(obj[k], pre + k));
        } else {
          acc.push(pre + k);
        }
        return acc;
      }, []);
    }

    const enKeys = new Set(getKeys(en));
    const omKeys = new Set(getKeys(om));
    const amKeys = new Set(getKeys(am));

    const missingInOm = [...enKeys].filter((k) => !omKeys.has(k));
    const missingInAm = [...enKeys].filter((k) => !amKeys.has(k));

    assert(missingInOm.length === 0, `Afaan Oromoo has 100% key parity with English (0 missing)`);
    assert(missingInAm.length === 0, `Amharic has 100% key parity with English (0 missing)`);
    assert(en.common.appName === '4Baye' || en.common.appName.includes('4B'), 'English appName is 4Baye');
    assert(om.common.appName === '4Baye' || om.common.appName.includes('4B'), 'Afaan Oromoo appName is 4Baye');
    assert(am.common.appName === '4Baye' || am.common.appName.includes('4B'), 'Amharic appName is 4Baye');

    // -------------------------------------------------------------
    // SUITE 5: PostgreSQL Row Level Security & Isolation
    // -------------------------------------------------------------
    console.log('\n--- 5. Security & PostgreSQL RLS Enforcement ---');
    const rlsRoleCheck = await prisma.$queryRawUnsafe<any[]>(
      `SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'waanofii_app';`,
    );
    assert(rlsRoleCheck.length > 0, 'Database role waanofii_app exists');
    assert(rlsRoleCheck[0].rolbypassrls === false, 'waanofii_app has rolbypassrls = false (NOBYPASSRLS active)');

    console.log('\n========================================================');
    console.log('🎉 4BAYE INSTITUTIONAL EXPERIENCE: ALL CRITERIA VERIFIED!');
    console.log('========================================================\n');
  } finally {
    await prisma.$disconnect();
  }
}

run4BayeExperienceTests().catch((err) => {
  console.error('\n❌ 4BAYE TEST RUN FAILED:', err.message);
  process.exit(1);
});
