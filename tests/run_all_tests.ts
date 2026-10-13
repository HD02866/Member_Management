import { spawn } from 'child_process';

function runScript(scriptPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Executing Test Suite: ${scriptPath} ...`);
    const child = spawn('npx', ['tsx', scriptPath], {
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Test script ${scriptPath} exited with status ${code}`));
      }
    });
  });
}

async function runAll() {
  console.log('========================================================');
  console.log('WAANOFII COMPLETE END-TO-END MASTER TEST SUITE');
  console.log('========================================================');

  // Step 1: Run Phase 2 Database, RLS, and Anti-Fraud Tests
  await runScript('tests/run_database_tests.ts');

  // Step 2: Run Phase 3 NestJS Backend, Auth, Tenant, and Security Tests
  await runScript('tests/run_backend_tests.ts');

  // Step 3: Run Phase 4 Member Experience, Onboarding, and Cross-Tenant Tests
  await runScript('tests/run_phase4_tests.ts');

  // Step 4: Run Phase 5 Payments, Proofs, Activation, and Digital ID Tests
  await runScript('tests/run_phase5_tests.ts');

  // Step 5: Run Phase 6 External Payments, Webhooks, Reconciliation, and Reversal Tests
  await runScript('tests/run_phase6_tests.ts');

  // Step 6: Run Phase 7 Org Operations, CMS, Notifications, Entitlements & SaaS Billing Tests
  await runScript('tests/run_phase7_tests.ts');

  // Step 7: Run Phase 8 Production Readiness, Security, Concurrency & Release Gate Tests
  await runScript('tests/run_phase8_tests.ts');

  // Step 8: Run Multi-Tenant Staff Experience & Roster Tests
  await runScript('tests/test_staff_and_multitenant.ts');

  // Step 9: Run Three Distinct User Experiences & Role Boundaries Tests
  await runScript('tests/test_three_user_experiences.ts');

  // Step 10: Run Platform Admin Experience & Cross-Tenant Oversight Tests
  await runScript('tests/test_platform_admin_experience.ts');

  // Step 11: Run Dedicated 4Baye Institutional Experience Verification
  await runScript('tests/test_4baye_experience.ts');

  // Step 12: Run 4Baye Images, Chat Attachments, Digital ID & PDF Verification
  await runScript('tests/test_image_lifecycle_suite.ts');

  console.log('\n========================================================');
  console.log('🎉 ALL SUITES PASSED! ALL PHASES & DISTINCT EXPERIENCES VERIFIED CLEAN.');
  console.log('========================================================\n');
}


runAll().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err.message);
  process.exit(1);
});
