require("dotenv").config();

const mongoose = require("mongoose");

const Worker = require("./server/models/Worker");
const Route = require("./server/models/Route");
const Trip = require("./server/models/Trip");
const BusinessClient = require("./server/models/BusinessClient");
const IndividualClient = require("./server/models/IndividualClient");
const Payment = require("./server/models/Payment");
const Settings = require("./server/models/Settings");

function parseDmy(dmy) {
  // Expect "YYYY-MM-DD"
  const [y, m, d] = dmy.split("-").map((v) => Number(v));
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error("Missing MONGODB_URI");

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME || undefined
  });

  await Promise.all([
    Worker.deleteMany({}),
    Route.deleteMany({}),
    Trip.deleteMany({}),
    BusinessClient.deleteMany({}),
    IndividualClient.deleteMany({}),
    Payment.deleteMany({}),
    Settings.deleteMany({})
  ]);

  const workers = await Worker.insertMany(
    ["Sulvin", "Shana", "Reshma", "Ratheesh", "Prachethan", "Aravind", "Shinas", "Aparna"].map((name) => ({
      name
    }))
  );
  const workerByName = new Map(workers.map((w) => [w.name, w]));

  const routes = await Route.insertMany([
    { name: "Ocado", variants: ["morning", "evening", "morning+evening"] },
    { name: "FedEx", variants: ["morning", "evening", "night"] },
    { name: "Airport", variants: [] },
    { name: "Oxford", variants: [] },
    { name: "FedEx Kingsbury", variants: [] },
    { name: "FedEx Atherstone", variants: [] }
  ]);
  const routeByName = new Map(routes.map((r) => [r.name, r]));

  // Seed some business clients based on sample payment payer names
  const businessClients = await BusinessClient.insertMany([
    { name: "Sajith", runningBalance: 407 },
    { name: "D Thamaraparampil", runningBalance: 0 },
    { name: "Sreedhar Panikkassery R", runningBalance: 0 },
    { name: "Preeja Mathew", runningBalance: 0 },
    { name: "Mohammed Rafi", runningBalance: 0 }
  ]);
  const businessByName = new Map(businessClients.map((c) => [c.name, c]));

  // Individual clients (example)
  const individuals = await IndividualClient.insertMany([
    { name: "Reshma", whatsappNumber: "", amountOwed: 0, status: "unpaid" },
    { name: "Shana", whatsappNumber: "", amountOwed: 0, status: "unpaid" }
  ]);
  const individualByName = new Map(individuals.map((c) => [c.name, c]));

  function makeTrip({ date, routeName, variant, workerNames, totalAmount, notes, payer }) {
    const ws = workerNames
      .map((n) => workerByName.get(n))
      .filter(Boolean)
      .map((w) => w._id);
    const amountPerPerson = ws.length ? Number((totalAmount / ws.length).toFixed(2)) : 0;
    const participants = ws.map((workerId) => ({ worker: workerId, shareAmount: amountPerPerson }));

    const base = {
      date: parseDmy(date),
      route: routeByName.get(routeName)._id,
      variant: variant || "",
      workers: ws,
      totalAmount,
      amountPerPerson,
      notes: notes || "",
      participants
    };

    if (payer.type === "business") {
      return {
        ...base,
        payerType: "business",
        businessClient: businessByName.get(payer.name)._id
      };
    }
    return {
      ...base,
      payerType: "individual",
      individualClient: individualByName.get(payer.name)._id
    };
  }

  const trips = [
    makeTrip({
      date: "2026-03-18",
      routeName: "FedEx Kingsbury",
      variant: "",
      workerNames: ["Sulvin", "Shana", "Reshma", "Ratheesh", "Prachethan", "Aravind"],
      totalAmount: 30,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-03-18",
      routeName: "Ocado",
      variant: "evening",
      workerNames: ["Shana", "Reshma", "Sulvin", "Prachethan", "Aravind"],
      totalAmount: 30,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-03-19",
      routeName: "Ocado",
      variant: "morning+evening",
      workerNames: ["Ratheesh", "Sulvin", "Aravind", "Reshma"],
      totalAmount: 40,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-03-20",
      routeName: "Ocado",
      variant: "morning+evening",
      workerNames: ["Ratheesh", "Prachethan", "Reshma", "Aravind", "Sulvin"],
      totalAmount: 50,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-03-21",
      routeName: "Ocado",
      variant: "morning+evening",
      workerNames: ["Shana", "Reshma", "Ratheesh", "Prachethan"],
      totalAmount: 50,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-03-22",
      routeName: "Ocado",
      variant: "evening",
      workerNames: ["Shana", "Ratheesh", "Prachethan", "Aravind"],
      totalAmount: 20,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-03-25",
      routeName: "Airport",
      variant: "",
      workerNames: ["Sulvin", "Shana", "Reshma", "Ratheesh", "Prachethan", "Aravind"],
      totalAmount: 108,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-03-26",
      routeName: "FedEx",
      variant: "morning",
      workerNames: ["Sulvin", "Shana", "Reshma", "Ratheesh", "Prachethan", "Aravind"],
      totalAmount: 30,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-03-26",
      routeName: "Ocado",
      variant: "morning",
      workerNames: ["Sulvin", "Prachethan", "Reshma", "Shana", "Ratheesh", "Aravind"],
      totalAmount: 30,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-03-27",
      routeName: "Ocado",
      variant: "morning+evening",
      workerNames: ["Sulvin", "Prachethan", "Reshma", "Shana", "Ratheesh", "Aravind"],
      totalAmount: 60,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-03-28",
      routeName: "Ocado",
      variant: "morning",
      workerNames: ["Sulvin", "Aravind"],
      totalAmount: 10,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-03-28",
      routeName: "Ocado",
      variant: "evening",
      workerNames: ["Sulvin", "Reshma", "Ratheesh", "Aravind"],
      totalAmount: 20,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-03-29",
      routeName: "Ocado",
      variant: "morning+evening",
      workerNames: ["Sulvin", "Prachethan"],
      totalAmount: 20,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-03-30",
      routeName: "FedEx",
      variant: "night",
      workerNames: ["Sulvin", "Shana", "Reshma", "Ratheesh", "Prachethan"],
      totalAmount: 25,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-03-31",
      routeName: "FedEx",
      variant: "morning",
      workerNames: ["Sulvin", "Shana", "Reshma", "Ratheesh", "Prachethan"],
      totalAmount: 25,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-03-31",
      routeName: "Ocado",
      variant: "evening",
      workerNames: ["Shinas", "Aparna"],
      totalAmount: 20,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-04-01",
      routeName: "Ocado",
      variant: "morning+evening",
      workerNames: ["Aravind", "Reshma", "Ratheesh", "Sulvin", "Shana"],
      totalAmount: 50,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-04-02",
      routeName: "Ocado",
      variant: "morning+evening",
      workerNames: ["Shana", "Prachethan", "Sulvin", "Ratheesh", "Reshma"],
      totalAmount: 50,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-04-03",
      routeName: "Ocado",
      variant: "morning+evening",
      workerNames: ["Shana", "Reshma", "Sulvin", "Ratheesh", "Aravind"],
      totalAmount: 50,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-04-04",
      routeName: "Ocado",
      variant: "morning",
      workerNames: ["Sulvin"],
      totalAmount: 5,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-04-04",
      routeName: "Ocado",
      variant: "evening",
      workerNames: ["Shana", "Sulvin", "Prachethan", "Ratheesh", "Aravind"],
      totalAmount: 25,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-04-08",
      routeName: "FedEx Atherstone",
      variant: "morning",
      workerNames: ["Sulvin", "Shana", "Reshma", "Ratheesh"],
      totalAmount: 20,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-04-08",
      routeName: "Ocado",
      variant: "morning",
      workerNames: ["Sulvin", "Shana", "Reshma"],
      totalAmount: 20,
      notes: "no shift",
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-04-08",
      routeName: "Oxford",
      variant: "",
      workerNames: ["Sulvin", "Shana", "Reshma", "Ratheesh", "Prachethan", "Aravind"],
      totalAmount: 60,
      payer: { type: "business", name: "Sajith" }
    }),
    makeTrip({
      date: "2026-04-09",
      routeName: "FedEx Kingsbury",
      variant: "",
      workerNames: ["Sulvin", "Shana", "Reshma", "Ratheesh"],
      totalAmount: 20,
      payer: { type: "business", name: "Sajith" }
    })
  ];

  await Trip.insertMany(trips);

  await Payment.insertMany([
    {
      payerName: "Sajith",
      amount: 50,
      date: parseDmy("2026-03-26"),
      method: "Bank Transfer",
      linkedType: "business",
      businessClient: businessByName.get("Sajith")._id
    },
    {
      payerName: "Sajith",
      amount: 300,
      date: parseDmy("2026-03-31"),
      method: "Revolut",
      linkedType: "business",
      businessClient: businessByName.get("Sajith")._id
    },
    {
      payerName: "D Thamaraparampil",
      amount: 196,
      date: parseDmy("2026-03-31"),
      method: "Bank Transfer",
      linkedType: "business",
      businessClient: businessByName.get("D Thamaraparampil")._id
    },
    {
      payerName: "Sreedhar Panikkassery R",
      amount: 115,
      date: parseDmy("2026-04-07"),
      method: "Bank Transfer",
      linkedType: "business",
      businessClient: businessByName.get("Sreedhar Panikkassery R")._id
    },
    {
      payerName: "Sajith",
      amount: 80,
      date: parseDmy("2026-04-08"),
      method: "Revolut",
      linkedType: "business",
      businessClient: businessByName.get("Sajith")._id
    },
    {
      payerName: "Cash",
      amount: 300,
      date: parseDmy("2026-04-08"),
      method: "Cash",
      linkedType: "business",
      businessClient: businessByName.get("Sajith")._id
    },
    {
      payerName: "Preeja Mathew",
      amount: 120,
      date: parseDmy("2026-03-20"),
      method: "Bank Transfer",
      linkedType: "business",
      businessClient: businessByName.get("Preeja Mathew")._id
    },
    {
      payerName: "Mohammed Rafi",
      amount: 46.66,
      date: parseDmy("2026-03-22"),
      method: "Bank Transfer",
      linkedType: "business",
      businessClient: businessByName.get("Mohammed Rafi")._id
    }
  ]);

  await Settings.create({
    bankName: "",
    accountNumber: "",
    sortCode: "",
    whatsappBusinessNumber: ""
  });

  console.log("Seed complete.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

