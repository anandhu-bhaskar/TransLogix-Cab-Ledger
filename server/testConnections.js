require("dotenv").config();

const mongoose = require("mongoose");
const { v2: cloudinary } = require("cloudinary");

async function testMongo() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("Missing MONGODB_URI");

  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGODB_DB_NAME || undefined,
    serverSelectionTimeoutMS: 8000
  });

  const admin = mongoose.connection.db.admin();
  const info = await admin.serverStatus();
  await mongoose.disconnect();

  return {
    ok: true,
    host: mongoose.connection?.host,
    version: info.version
  };
}

async function testCloudinary() {
  const url = process.env.CLOUDINARY_URL;
  if (!url) throw new Error("Missing CLOUDINARY_URL");

  cloudinary.config({ cloudinary_url: url });
  const res = await cloudinary.api.ping();
  return { ok: true, status: res.status };
}

async function run() {
  const result = { mongo: null, cloudinary: null };

  try {
    result.mongo = await testMongo();
  } catch (e) {
    result.mongo = { ok: false, error: e.message };
  }

  try {
    result.cloudinary = await testCloudinary();
  } catch (e) {
    result.cloudinary = { ok: false, error: e.message };
  }

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.mongo.ok && result.cloudinary.ok ? 0 : 1);
}

run();

