require("dotenv").config();
const mongoose = require("mongoose");

const User            = require("./server/models/User");
const Worker          = require("./server/models/Worker");
const Route           = require("./server/models/Route");
const Trip            = require("./server/models/Trip");
const BusinessClient  = require("./server/models/BusinessClient");
const IndividualClient = require("./server/models/IndividualClient");
const Payment         = require("./server/models/Payment");
const Settings        = require("./server/models/Settings");
const Place           = require("./server/models/Place");

// ── Test user credentials ─────────────────────────────────
const TEST_EMAIL    = "demo@translogix.com";
const TEST_PASSWORD = "Demo@1234";
const TEST_NAME     = "Demo User";

function d(str) {
  return new Date(str + "T08:00:00.000Z");
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error("Missing MONGODB_URI");

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME || undefined
  });
  console.log("Connected to MongoDB");

  // ── 1. Create / keep test user ────────────────────────────
  let testUser = await User.findOne({ email: TEST_EMAIL });
  if (!testUser) {
    testUser = new User({ name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASSWORD });
    await testUser.save();
    console.log("Created test user");
  } else {
    console.log("Test user already exists — keeping it");
  }

  // ── 2. Delete all other users ─────────────────────────────
  const del = await User.deleteMany({ _id: { $ne: testUser._id } });
  if (del.deletedCount) console.log(`Deleted ${del.deletedCount} other user(s)`);

  // ── 3. Clear all collections ──────────────────────────────
  await Promise.all([
    Worker.deleteMany({}),
    Route.deleteMany({}),
    Trip.deleteMany({}),
    BusinessClient.deleteMany({}),
    IndividualClient.deleteMany({}),
    Payment.deleteMany({}),
    Settings.deleteMany({}),
    Place.deleteMany({})
  ]);
  console.log("Cleared all data");

  // ── 4. Places ─────────────────────────────────────────────
  await Place.insertMany([
    "Coventry", "Oxford", "Birmingham", "London",
    "Leicester", "Stratford", "Warwick"
  ].map(name => ({ name })));

  // ── 5. Individual clients ─────────────────────────────────
  const clientDefs = [
    { name: "Reshma Patel",   whatsappNumber: "447911100001", clientType: "direct",  organisation: "Ocado",     postcode: "CV1 2AB" },
    { name: "Mohammed Ali",   whatsappNumber: "447911100002", clientType: "direct",  organisation: "Amazon",    postcode: "CV2 3CD" },
    { name: "James Wilson",   whatsappNumber: "447911100003", clientType: "direct",  organisation: "",          postcode: "CV1 4EF" },
    { name: "David Brown",    whatsappNumber: "447911100004", clientType: "direct",  organisation: "FedEx",     postcode: "CV3 5GH" },
    { name: "Sarah Johnson",  whatsappNumber: "447911100005", clientType: "direct",  organisation: "",          postcode: "CV4 6IJ" },
    { name: "Raj Kumar",      whatsappNumber: "447911100006", clientType: "direct",  organisation: "Ocado",     postcode: "CV2 1KL" },
    { name: "Ahmed Khan",     whatsappNumber: "447911100007", clientType: "direct",  organisation: "",          postcode: "CV5 7MN" },
    { name: "Maria Garcia",   whatsappNumber: "447911100008", clientType: "direct",  organisation: "FedEx",     postcode: "CV3 8OP" },
    { name: "Tom Henderson",  whatsappNumber: "447911100009", clientType: "direct",  organisation: "",          postcode: "CV1 9QR" },
    { name: "Anita Sharma",   whatsappNumber: "447911100010", clientType: "direct",  organisation: "Amazon",    postcode: "CV6 2ST" },
    { name: "Priya Singh",    whatsappNumber: "447911100011", clientType: "partner", organisation: "Carehome",  carehomeLocation: "Coventry", postcode: "CV7 3UV" },
    { name: "Fatima Hassan",  whatsappNumber: "447911100012", clientType: "partner", organisation: "Carehome",  carehomeLocation: "Oxford",   postcode: "OX1 1WX" }
  ];

  const clients = await IndividualClient.insertMany(
    clientDefs.map(c => ({ ...c, amountOwed: 0, status: "unpaid" }))
  );
  const cByName = new Map(clients.map(c => [c.name, c]));
  console.log(`Seeded ${clients.length} individual clients`);

  // ── 6. Business clients ───────────────────────────────────
  const bizDefs = [
    { name: "Amazon Logistics",  runningBalance: 0 },
    { name: "Carehome Coventry", runningBalance: 0 },
    { name: "Carehome Oxford",   runningBalance: 0 }
  ];
  const bizClients = await BusinessClient.insertMany(bizDefs);
  const bByName = new Map(bizClients.map(c => [c.name, c]));
  console.log(`Seeded ${bizClients.length} business clients`);

  // ── 7. Trip helpers ───────────────────────────────────────
  function direct(dateStr, from, to, variant, names, total) {
    const payers = names.map(n => cByName.get(n)).filter(Boolean);
    const share  = Number((total / payers.length).toFixed(2));
    return {
      date: d(dateStr), origin: from, destination: to, variant,
      paymentMethod: "direct", totalAmount: total,
      amountPerPerson: share,
      payers: payers.map(c => ({ client: c._id, amount: share })),
      numberOfPeople: payers.length,
      workers: [], customWorkerNames: [], unspecifiedWorkers: false
    };
  }

  function partner(dateStr, from, to, variant, bizName, total, people) {
    return {
      date: d(dateStr), origin: from, destination: to, variant,
      paymentMethod: "partner", totalAmount: total,
      amountPerPerson: Number((total / people).toFixed(2)),
      businessClient: bByName.get(bizName)._id,
      numberOfPeople: people,
      payers: [], workers: [], customWorkerNames: [], unspecifiedWorkers: false
    };
  }

  // ── 8. Trips (40 across Jan–Apr 2026) ────────────────────
  const tripDocs = [
    // ── January ──
    direct ("2026-01-06","Coventry","Oxford",    "Morning", ["Reshma Patel","Mohammed Ali","James Wilson"],             36),
    partner("2026-01-08","Coventry","Birmingham","Morning",  "Amazon Logistics", 20, 4),
    direct ("2026-01-10","Coventry","London",    "",         ["Sarah Johnson","Tom Henderson"],                          50),
    direct ("2026-01-13","Coventry","Oxford",    "Evening",  ["Reshma Patel","Raj Kumar","David Brown","Anita Sharma"],  40),
    direct ("2026-01-15","Oxford",  "Coventry",  "",         ["Mohammed Ali","James Wilson"],                            30),
    partner("2026-01-20","Coventry","Leicester", "",         "Carehome Coventry", 24, 3),
    direct ("2026-01-22","Coventry","Birmingham","",         ["Sarah Johnson","Ahmed Khan","Maria Garcia"],               30),
    direct ("2026-01-27","Coventry","Oxford",    "Morning",  ["Reshma Patel","Raj Kumar","Tom Henderson"],               36),

    // ── February ──
    direct ("2026-02-03","Coventry","Oxford",    "Morning",  ["Reshma Patel","Mohammed Ali","James Wilson","David Brown"],40),
    direct ("2026-02-05","Coventry","London",    "",         ["Sarah Johnson","Anita Sharma"],                            50),
    partner("2026-02-07","Coventry","Birmingham","Morning",   "Amazon Logistics", 25, 5),
    direct ("2026-02-10","Oxford",  "Coventry",  "",         ["Raj Kumar","Ahmed Khan"],                                 30),
    partner("2026-02-12","Coventry","Stratford", "",         "Carehome Oxford", 20, 4),
    direct ("2026-02-14","Coventry","Oxford",    "Evening",  ["Reshma Patel","Mohammed Ali","Maria Garcia"],             33),
    direct ("2026-02-17","Coventry","Leicester", "",         ["James Wilson","Tom Henderson","Sarah Johnson","David Brown"],48),
    direct ("2026-02-19","Birmingham","Coventry","",         ["Ahmed Khan","Anita Sharma"],                               24),
    direct ("2026-02-24","Coventry","Oxford",    "Morning",  ["Reshma Patel","Raj Kumar","Mohammed Ali","James Wilson"],  40),
    partner("2026-02-26","Coventry","Birmingham","",         "Amazon Logistics", 25, 4),

    // ── March ──
    direct ("2026-03-03","Coventry","Oxford",    "Morning",  ["Reshma Patel","David Brown","Maria Garcia"],              36),
    direct ("2026-03-05","Coventry","London",    "",         ["Mohammed Ali","James Wilson","Sarah Johnson"],             60),
    partner("2026-03-07","Coventry","Birmingham","Morning",   "Amazon Logistics", 20, 4),
    direct ("2026-03-10","Coventry","Oxford",    "Evening",  ["Reshma Patel","Raj Kumar","Tom Henderson","Anita Sharma"],44),
    direct ("2026-03-12","Oxford",  "Coventry",  "",         ["Ahmed Khan","David Brown","Maria Garcia"],                 36),
    partner("2026-03-14","Coventry","Leicester", "",         "Carehome Coventry", 24, 3),
    direct ("2026-03-17","Coventry","Stratford", "",         ["Reshma Patel","Mohammed Ali"],                             24),
    direct ("2026-03-19","Coventry","Oxford",    "Morning",  ["James Wilson","Sarah Johnson","Tom Henderson","Raj Kumar"],44),
    partner("2026-03-21","Coventry","Birmingham","",         "Amazon Logistics", 20, 4),
    direct ("2026-03-24","Coventry","London",    "",         ["Ahmed Khan","Anita Sharma"],                               48),
    direct ("2026-03-26","Oxford",  "Coventry",  "",         ["Reshma Patel","Mohammed Ali","David Brown"],               33),
    direct ("2026-03-28","Coventry","Oxford",    "Evening",  ["James Wilson","Maria Garcia","Tom Henderson"],             36),

    // ── April ──
    direct ("2026-04-01","Coventry","Oxford",    "Morning",  ["Reshma Patel","Raj Kumar","Mohammed Ali","Sarah Johnson"], 44),
    partner("2026-04-03","Coventry","Birmingham","",         "Amazon Logistics", 25, 5),
    direct ("2026-04-04","Coventry","London",    "",         ["James Wilson","David Brown","Anita Sharma"],               60),
    direct ("2026-04-07","Coventry","Oxford",    "Evening",  ["Reshma Patel","Ahmed Khan","Maria Garcia"],                36),
    direct ("2026-04-08","Birmingham","Coventry","",         ["Tom Henderson","Raj Kumar"],                               24),
    partner("2026-04-09","Coventry","Leicester", "",         "Carehome Oxford", 20, 4),
    direct ("2026-04-10","Coventry","Stratford", "",         ["Mohammed Ali","Sarah Johnson"],                            24),
    direct ("2026-04-11","Coventry","Oxford",    "Morning",  ["Reshma Patel","James Wilson","David Brown","Anita Sharma"],44),
    direct ("2026-04-12","Oxford",  "Coventry",  "",         ["Raj Kumar","Ahmed Khan","Maria Garcia"],                   30),
    partner("2026-04-14","Coventry","Birmingham","",         "Amazon Logistics", 20, 4)
  ];

  await Trip.insertMany(tripDocs);
  console.log(`Seeded ${tripDocs.length} trips`);

  // ── 9. Compute trip balances per client ───────────────────
  const balances = {};
  clients.forEach(c => { balances[c._id.toString()] = 0; });
  tripDocs.forEach(t => {
    if (t.paymentMethod === "direct") {
      t.payers.forEach(p => {
        const id = p.client.toString();
        balances[id] = (balances[id] || 0) + p.amount;
      });
    }
  });

  // ── 10. Payments ──────────────────────────────────────────
  const payDefs = [
    { name: "Reshma Patel",  amt: 20,  date: "2026-01-15", method: "Bank Transfer" },
    { name: "Mohammed Ali",  amt: 15,  date: "2026-01-20", method: "Cash"          },
    { name: "James Wilson",  amt: 30,  date: "2026-02-01", method: "Revolut"       },
    { name: "David Brown",   amt: 20,  date: "2026-02-05", method: "Bank Transfer" },
    { name: "Sarah Johnson", amt: 25,  date: "2026-02-10", method: "Cash"          },
    { name: "Reshma Patel",  amt: 25,  date: "2026-02-15", method: "Revolut"       },
    { name: "Raj Kumar",     amt: 20,  date: "2026-02-20", method: "Bank Transfer" },
    { name: "Tom Henderson", amt: 30,  date: "2026-02-25", method: "Bank Transfer" },
    { name: "Mohammed Ali",  amt: 30,  date: "2026-03-01", method: "Revolut"       },
    { name: "Anita Sharma",  amt: 20,  date: "2026-03-05", method: "Bank Transfer" },
    { name: "Ahmed Khan",    amt: 15,  date: "2026-03-10", method: "Cash"          },
    { name: "Maria Garcia",  amt: 20,  date: "2026-03-15", method: "Bank Transfer" },
    { name: "Reshma Patel",  amt: 30,  date: "2026-03-18", method: "Revolut"       },
    { name: "James Wilson",  amt: 30,  date: "2026-03-22", method: "Bank Transfer" },
    { name: "David Brown",   amt: 25,  date: "2026-03-26", method: "Cash"          },
    { name: "Sarah Johnson", amt: 20,  date: "2026-04-01", method: "Revolut"       },
    { name: "Mohammed Ali",  amt: 25,  date: "2026-04-05", method: "Bank Transfer" },
    { name: "Raj Kumar",     amt: 20,  date: "2026-04-08", method: "Cash"          },
    { name: "Tom Henderson", amt: 25,  date: "2026-04-10", method: "Bank Transfer" },
    { name: "Anita Sharma",  amt: 15,  date: "2026-04-12", method: "Revolut"       }
  ];

  await Payment.insertMany(payDefs.map(p => ({
    payerName: p.name,
    amount: p.amt,
    date: d(p.date),
    method: p.method,
    linkedType: "direct",
    individualClient: cByName.get(p.name)._id,
    thirdPartyPayer: false
  })));

  // Subtract payments from balances
  payDefs.forEach(p => {
    const c = cByName.get(p.name);
    if (c) balances[c._id.toString()] -= p.amt;
  });
  console.log(`Seeded ${payDefs.length} payments`);

  // ── 11. Update amountOwed on each client ──────────────────
  for (const [id, owed] of Object.entries(balances)) {
    const finalOwed = Math.max(0, Number(owed.toFixed(2)));
    await IndividualClient.findByIdAndUpdate(id, {
      amountOwed: finalOwed,
      status: finalOwed <= 0 ? "paid" : "unpaid"
    });
  }
  console.log("Updated client balances");

  // ── 12. Settings ──────────────────────────────────────────
  await Settings.create({
    businessName:    "TransLogix Transport",
    businessAddress: "12 Warwick Road\nCoventry CV1 2EY",
    bankName:        "Monzo",
    accountNumber:   "12345678",
    sortCode:        "04-00-04",
    whatsappBusinessNumber: ""
  });

  // ── Done ──────────────────────────────────────────────────
  console.log("\n✅  Seed complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(" Test user credentials");
  console.log(`   Email   : ${TEST_EMAIL}`);
  console.log(`   Password: ${TEST_PASSWORD}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(` ${tripDocs.length} trips · ${payDefs.length} payments · ${clients.length} clients`);

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
