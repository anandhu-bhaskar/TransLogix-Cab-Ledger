require("dotenv").config();

const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo").default || require("connect-mongo");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const User = require("./models/User");
const requireAuth = require("./middleware/requireAuth");

const workersRouter = require("./routes/workers");
const routesRouter = require("./routes/routes");
const tripsRouter = require("./routes/trips");
const businessClientsRouter = require("./routes/businessClients");
const individualClientsRouter = require("./routes/individualClients");
const paymentsRouter = require("./routes/payments");
const invoiceRouter = require("./routes/invoice");
const settingsRouter = require("./routes/settings");
const userSmsRouter = require("./routes/userSms");
const authRouter = require("./routes/auth");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      dbName: process.env.MONGODB_DB_NAME || undefined,
      ttl: 7 * 24 * 60 * 60 // 7 days
    }),
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
  })
);

// Passport
passport.use(
  new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
      const user = await User.findOne({ email });
      if (!user) return done(null, false, { message: "No account found with that email." });
      if (!user.password) return done(null, false, { message: "This account uses Google sign-in." });
      const ok = await user.verifyPassword(password);
      if (!ok) return done(null, false, { message: "Incorrect password." });
      return done(null, user);
    } catch (e) {
      return done(e);
    }
  })
);

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (googleClientId && googleClientId !== "YOUR_GOOGLE_CLIENT_ID") {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: "/auth/google/callback"
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ googleId: profile.id });
          if (!user) {
            const email = profile.emails?.[0]?.value;
            user = await User.findOne({ email });
            if (user) {
              user.googleId = profile.id;
              user.avatar = profile.photos?.[0]?.value;
              await user.save();
            } else {
              user = await User.create({
                name: profile.displayName,
                email,
                googleId: profile.id,
                avatar: profile.photos?.[0]?.value
              });
            }
          }
          return done(null, user);
        } catch (e) {
          return done(e);
        }
      }
    )
  );
}

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (e) {
    done(e);
  }
});

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Root redirect
app.get("/", (req, res) => {
  if (req.isAuthenticated()) res.redirect("/pages/index.html");
  else res.redirect("/pages/login.html");
});

// Auth routes (public)
app.use("/auth", authRouter);

// All API routes require authentication
app.use("/api/workers", requireAuth, workersRouter);
app.use("/api/routes", requireAuth, routesRouter);
app.use("/api/trips", requireAuth, tripsRouter);
app.use("/api/business-clients", requireAuth, businessClientsRouter);
app.use("/api/individual-clients", requireAuth, individualClientsRouter);
app.use("/api/payments", requireAuth, paymentsRouter);
app.use("/api/invoice", requireAuth, invoiceRouter);
app.use("/api/settings", requireAuth, settingsRouter);
app.use("/api/user", requireAuth, userSmsRouter);

async function start() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("Missing MONGODB_URI in environment");

  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGODB_DB_NAME || undefined
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
