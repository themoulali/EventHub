const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const User = require('../models/User');

async function verifyPasswordHash() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const user = await User.findOne({
      email: 'eventhub.test.20261029@example.com',
    }).select('+password');

    if (!user) {
      console.log('FAIL: Test user not found');
      return;
    }

    const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(user.password);
    const passwordMatches = await bcrypt.compare(
      'EventHubTest123!',
      user.password
    );

    console.log('User found:', true);
    console.log('Stored value is a bcrypt hash:', isBcryptHash);
    console.log('Original password matches hash:', passwordMatches);
    console.log(
      'Password verification:',
      isBcryptHash && passwordMatches ? 'PASSED' : 'FAILED'
    );
  } catch (error) {
    console.error('Verification error:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

verifyPasswordHash();
