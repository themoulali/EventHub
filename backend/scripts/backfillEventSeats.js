const dns = require('dns');
const path = require('path');
const mongoose = require('mongoose');

dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
});

const Event = require('../models/Event');
const Seat = require('../models/Seat');
const { buildSeatDocuments } = require('../services/seatGenerationService');

const applyChanges = process.argv.includes('--apply');

const backfillEventSeats = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('MongoDB Atlas connected successfully');
    console.log(applyChanges ? 'MODE: APPLY' : 'MODE: DRY RUN');

    const events = await Event.find()
      .select('_id name capacity')
      .lean();

    console.log(`Events found: ${events.length}`);

    let totalToCreate = 0;

    for (const event of events) {
      const existingSeats = await Seat.find({
        event: event._id,
      })
        .select('seatNumber')
        .lean();

      const existingNumbers = new Set(
        existingSeats.map((seat) => seat.seatNumber)
      );

      const expectedSeats = buildSeatDocuments(event);

      const missingSeats = expectedSeats.filter(
        (seat) => !existingNumbers.has(seat.seatNumber)
      );

      console.log('\nEvent:', event.name);
      console.log('Capacity:', event.capacity);
      console.log('Existing seats:', existingSeats.length);
      console.log('Missing seats:', missingSeats.length);

      if (missingSeats.length > 0) {
        totalToCreate += missingSeats.length;

        if (applyChanges) {
          await Seat.insertMany(missingSeats, { ordered: true });
          console.log('Inserted:', missingSeats.length);
        } else {
          console.log('Preview only — no database changes made');
        }
      }
    }

    console.log('\nTotal seats to create:', totalToCreate);

    if (!applyChanges) {
      console.log('Dry run completed. No database records were changed.');
      console.log('Run with --apply to create the missing seats.');
    } else {
      console.log('Seat backfill completed successfully.');
    }
  } catch (error) {
    console.error('Seat backfill failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

backfillEventSeats();