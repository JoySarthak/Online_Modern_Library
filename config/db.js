const mongoose = require('mongoose');

let cachedDb = null;

async function connectToDatabase(uri) {
  if (cachedDb && cachedDb.readyState === 1) {
    console.log('✅ Using cached database connection');
    return cachedDb;
  }
  try {
    const db = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      maxPoolSize: 5
    });
    cachedDb = db;
    console.log('✅ New database connection');
    return db;
  } catch (err) {
    console.error('❌ Connection error:', err);
    throw err;
  }
}

module.exports = { connectToDatabase }; 