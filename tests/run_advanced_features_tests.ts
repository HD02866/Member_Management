import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 4BAYE ADVANCED COMMUNITY, MESSAGING & LIFECYCLE TESTS');
  console.log('======================================================\n');

  try {
    // 1. Verify 4B Organization Exists
    console.log('--- 1. Tenant Verification ---');
    const org = await prisma.organization.findUnique({
      where: { slug: '4b' },
    });
    assert(!!org, 'Organization 4B exists in database');
    const orgId = org!.id;

    // 2. Member Lifecycle & Status Check
    console.log('--- 2. Member Lifecycle Management ---');
    const ownerUser = await prisma.user.findFirst({
      where: { email: 'owner.test@4baye.local' },
    });
    assert(!!ownerUser, 'Test Owner account exists');

    const memberUser = await prisma.user.findFirst({
      where: { email: 'member.test@4baye.local' },
    });
    assert(!!memberUser, 'Test Member account exists');

    // Create a temporary applicant to test approval/suspension lifecycle
    const applicantEmail = `applicant_${Date.now()}@4baye.test`;
    const passwordHash = await argon2.hash('TestPass123!');
    const applicant = await prisma.user.create({
      data: {
        email: applicantEmail,
        passwordHash,
        firstName: 'TestApplicant',
        lastName: 'Lifecycle',
        status: 'ACTIVE',
      },
    });

    const pendingProfile = await prisma.memberProfile.create({
      data: {
        organizationId: orgId,
        userId: applicant.id,
        memberNumber: `TEST-${Date.now().toString().slice(-4)}`,
        firstName: applicant.firstName,
        lastName: applicant.lastName,
        email: applicant.email,
        status: 'PENDING_APPROVAL',
      },
    });
    assert(pendingProfile.status === 'PENDING_APPROVAL', 'New applicant created with PENDING_APPROVAL status');

    // Approve the applicant
    const approvedProfile = await prisma.memberProfile.update({
      where: { id: pendingProfile.id },
      data: {
        status: 'ACTIVE',
        approvedAt: new Date(),
        approvedByUserId: ownerUser!.id,
      },
    });
    assert(approvedProfile.status === 'ACTIVE', 'Applicant successfully approved to ACTIVE status');
    assert(!!approvedProfile.approvedAt, 'Approved timestamp recorded');

    // Suspend the member
    const suspendedProfile = await prisma.memberProfile.update({
      where: { id: approvedProfile.id },
      data: {
        status: 'SUSPENDED',
        suspendedAt: new Date(),
        suspendedByUserId: ownerUser!.id,
        suspensionReason: 'Terms violation test',
      },
    });
    assert(suspendedProfile.status === 'SUSPENDED', 'Member successfully suspended');
    assert(suspendedProfile.suspensionReason === 'Terms violation test', 'Suspension reason recorded');

    // Reinstate the member
    const reinstatedProfile = await prisma.memberProfile.update({
      where: { id: suspendedProfile.id },
      data: {
        status: 'ACTIVE',
        suspendedAt: null,
        suspendedByUserId: null,
        suspensionReason: null,
      },
    });
    assert(reinstatedProfile.status === 'ACTIVE', 'Member successfully reinstated to ACTIVE');

    // 3. Private Messaging System
    console.log('--- 3. Private Messaging System ---');
    // Create direct conversation between Owner and Member
    let conversation = await prisma.conversation.findFirst({
      where: {
        organizationId: orgId,
        AND: [
          { participants: { some: { userId: ownerUser!.id } } },
          { participants: { some: { userId: memberUser!.id } } },
        ],
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          organizationId: orgId,
          type: 'DIRECT',
          participants: {
            create: [
              { userId: ownerUser!.id },
              { userId: memberUser!.id },
            ],
          },
        },
      });
    }
    assert(!!conversation, 'Direct conversation between Owner and Member created/found');

    // Send a message from Owner to Member
    const testMsgContent = `Hello member! Verified at ${new Date().toISOString()}`;
    const sentMsg = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderUserId: ownerUser!.id,
        content: testMsgContent,
      },
      include: {
        sender: true,
      },
    });
    assert(sentMsg.content === testMsgContent, 'Message persisted in database');
    assert(sentMsg.senderUserId === ownerUser!.id, 'Sender identity verified');

    // Read receipts
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId: memberUser!.id,
        },
      },
    });
    assert(!!participant, 'Member is verified participant in conversation');

    // 4. Telegram-style Community Groups
    console.log('--- 4. Community Groups & Channels ---');
    let group = await prisma.group.findFirst({
      where: { organizationId: orgId, name: '4Baye General Community' },
    });

    if (!group) {
      group = await prisma.group.create({
        data: {
          organizationId: orgId,
          name: '4Baye General Community',
          description: 'Official community channel for all 4Baye members',
          type: 'COMMUNITY',
          isPublic: true,
          createdByUserId: ownerUser!.id,
          members: {
            create: [
              { userId: ownerUser!.id, role: 'OWNER' },
              { userId: memberUser!.id, role: 'MEMBER' },
            ],
          },
        },
      });
    }
    assert(!!group, 'Community group created/found');

    const groupMsgContent = `Community announcement at ${new Date().toISOString()}`;
    const groupMsg = await prisma.groupMessage.create({
      data: {
        groupId: group.id,
        senderUserId: ownerUser!.id,
        content: groupMsgContent,
      },
      include: { sender: true },
    });
    assert(groupMsg.content === groupMsgContent, 'Group message persisted in database');

    // 5. Rich Announcements with Cover Images
    console.log('--- 5. Rich Announcements with Cover Images ---');
    const richAnnouncement = await prisma.announcement.create({
      data: {
        organizationId: orgId,
        authorUserId: ownerUser!.id,
        title: { en: '4Baye Annual Conference 2026', am: 'የ4ባዬ ዓመታዊ ጉባኤ 2026' },
        content: { en: 'Welcome all 4Baye members to our annual celebration.', am: 'እንኳን ደህና መጣችሁ' },
        summary: 'Annual gathering of all 4Baye members.',
        coverImageUrl: '/uploads/sample-conference-cover.jpg',
        audience: 'PUBLIC',
        status: 'PUBLISHED',
        isPinned: true,
        publishedAt: new Date(),
      },
    });
    assert(!!richAnnouncement.id, 'Rich announcement created with coverImageUrl');
    assert(richAnnouncement.coverImageUrl === '/uploads/sample-conference-cover.jpg', 'Cover image URL stored');
    assert(richAnnouncement.audience === 'PUBLIC', 'Audience targeting correctly set to PUBLIC');

    // Clean up temporary applicant and test announcement
    await prisma.memberProfile.delete({ where: { id: pendingProfile.id } });
    await prisma.user.delete({ where: { id: applicant.id } });
    await prisma.announcement.delete({ where: { id: richAnnouncement.id } });

    console.log('\n======================================================');
    console.log('🎉 ALL ADVANCED FEATURE DATABASE & LOGIC TESTS PASSED!');
    console.log('======================================================\n');
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
