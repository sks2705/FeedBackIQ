import { execSync } from 'child_process';
import readline from 'readline';

function askConfirmation(query: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: Database reset is strictly forbidden when NODE_ENV is production!');
    process.exit(1);
  }

  console.log('⚠️ WARNING: This action will DROP all tables, re-run all migrations, and re-seed the database.');
  const confirmed = await askConfirmation('Are you sure you want to reset the database? (y/N): ');

  if (!confirmed) {
    console.log('Database reset cancelled.');
    process.exit(0);
  }

  console.log('Executing `prisma migrate reset --force`...');
  try {
    execSync('npx prisma migrate reset --force', { stdio: 'inherit', cwd: process.cwd() });
    console.log('✅ Database reset and re-seeded successfully!');
  } catch (error: any) {
    console.error('❌ Reset failed:', error.message);
    process.exit(1);
  }
}

main();
