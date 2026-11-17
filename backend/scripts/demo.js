// Zero-setup demo: in-memory MongoDB + demo city + admin account + simulated buses.
// Usage: npm run demo [-- --city=chandigarh]   (default Indore; data is lost when you stop it)
// Admin: admin@demo.local / Demo@1234   Drivers: demo.driver1..12@transit.local / Demo@1234 (1..4 for Chandigarh)
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri('transit');
process.env.JWT_SECRET ||= 'demo-secret-change-me';

const { ready } = await import('../server.js');
await ready;
const { seed, cityArg } = await import('./seed.js');
const Admin = (await import('../models/Admin.js')).default;
const { drivers } = await seed({ city: cityArg(), log: (m) => console.log(`  seed: ${m}`) });
if (!(await Admin.exists({ email: 'admin@demo.local' }))) {
  await Admin.create({ username: 'admin', email: 'admin@demo.local', password: 'Demo@1234' });
}
console.log('\nDemo ready. Admin: admin@demo.local / Demo@1234');

if (!process.argv.includes('--no-sim')) {
  const { simulate } = await import('./simulate.js');
  simulate({ api: `http://localhost:${process.env.PORT || 5000}/api`, drivers, log: (m) => console.log(`  sim: ${m}`) });
}

const stop = async () => { await mongo.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
