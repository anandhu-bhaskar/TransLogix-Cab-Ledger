require("dotenv").config();

// ── Validate critical env vars at startup ─────────────────────────────────
const REQUIRED_ENV = ["MONGODB_URI", "SESSION_SECRET"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[FATAL] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}
if (process.env.SESSION_SECRET === "change-this-to-a-long-random-string-in-production") {
  console.warn("[WARN] SESSION_SECRET is still the default placeholder — change it before deploying!");
}

const path       = require("path");
const express    = require("express");
const mongoose   = require("mongoose");
const cors       = require("cors");
const session    = require("express-session");
const MongoStore = require("connect-mongo").default || require("connect-mongo");
const passport   = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const helmet     = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const hpp        = require("hpp");

const User        = require("./models/User");
const requireAuth = require("./middleware/requireAuth");
const { apiLimiter } = require("./middleware/rateLimits");
const { log }     = require("./middleware/securityLogger");

const workersRouter         = require("./routes/workers");
const routesRouter          = require("./routes/routes");
const tripsRouter           = require("./routes/trips");
const businessClientsRouter = require("./routes/businessClients");
const individualClientsRouter = require("./routes/individualClients");
const paymentsRouter        = require("./routes/payments");
const invoiceRouter         = require("./routes/invoice");
const settingsRouter        = require("./routes/settings");
const placesRouter          = require("./routes/places");
const authRouter            = require("./routes/auth");

const isProd = process.env.NODE_ENV === "production";

const app = express();

// ── Trust proxy (required for rate limiting behind Render / nginx) ─────────
app.set("trust proxy", 1);

// ── Security headers via Helmet ────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:     ["'self'"],
        scriptSrc:      [
          "'self'",
          // Chart.js CDN — exact version pinned
          "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/"
        ],
        styleSrc:       ["'self'", "'unsafe-inline'"],  // inline styles used by page JS
        imgSrc:         ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
        connectSrc:     ["'self'"],
        fontSrc:        ["'self'"],
        objectSrc:      ["'none'"],
        frameSrc:       ["'none'"],
        frameAncestors: ["'none'"],                      // prevents clickjacking
        baseUri:        ["'self'"],
        formAction:     ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false,   // needed for Cloudinary image loading
    hsts: isProd
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false
  })
);

// ── CORS — locked to same origin in production ─────────────────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : ["http://localhost:3000"];

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server / curl (no origin header) and allowed list
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    log("CORS_BLOCK", { origin });
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// ── Body parsing — strict size limits ─────────────────────────────────────
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

// ── NoSQL injection prevention ────────────────────────────────────────────
// Strips $ and . from req.body, req.query, req.params
app.use(mongoSanitize({
  replaceWith: "_",
  onSanitize: ({ req, key }) => {
    log("NOSQL_SANITIZE", { ip: req.ip, key, path: req.path });
  }
}));

// ── HTTP Parameter Pollution protection ───────────────────────────────────
app.use(hpp());

// ── Sessions ───────────────────────────────────────────────────────────────
app.use(
  session({
    name: "sid",  // rename from default connect.sid to obscure stack
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      dbName: process.env.MONGODB_DB_NAME || undefined,
      ttl: 7 * 24 * 60 * 60,
      touchAfter: 24 * 3600   // only update session once per day unless data changes
    }),
    cookie: {
      httpOnly: true,                    // JS cannot read the cookie
      secure: isProd,                    // HTTPS only in production
      sameSite: isProd ? "strict" : "lax", // CSRF mitigation
      maxAge: 7 * 24 * 60 * 60 * 1000   // 7 days
    }
  })
);

// ── Passport ───────────────────────────────────────────────────────────────
passport.use(
  new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
      const user = await User.findOne({ email });
      if (!user) return done(null, false, { message: "Invalid email or password." });
      if (!user.password) return done(null, false, { message: "This account uses Google sign-in." });
      const ok = await user.verifyPassword(password);
      if (!ok) return done(null, false, { message: "Invalid email or password." });
      return done(null, user);
    } catch (e) {
      return done(e);
    }
  })
);

const googleClientId     = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (googleClientId && googleClientId !== "YOUR_GOOGLE_CLIENT_ID") {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback"
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ googleId: profile.id });
          if (!user) {
            const email = profile.emails?.[0]?.value;
            user = await User.findOne({ email });
            if (user) {
              user.googleId = profile.id;
              user.avatar   = profile.photos?.[0]?.value;
              await user.save();
            } else {
              user = await User.create({
                name:     profile.displayName,
                email,
                googleId: profile.id,
                avatar:   profile.photos?.[0]?.value
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
    const user = await User.findById(id).select("-password -loginAttempts -lockUntil");
    done(null, user);
  } catch (e) {
    done(e);
  }
});

app.use(passport.initialize());
app.use(passport.session());

// ── Static files ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "..", "public"), {
  // Prevent directory listings and dotfile leaks
  dotfiles: "deny",
  index: false
}));

// ── Health check (public, no auth, no rate limit) ─────────────────────────
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ── Root redirect ──────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  if (req.isAuthenticated()) res.redirect("/pages/index.html");
  else res.redirect("/pages/login.html");
});

// ── Auth routes (public — rate limiting applied per-route inside) ──────────
app.use("/auth", authRouter);

// ── Protected API routes — all require auth + general rate limit ───────────
app.use("/api/workers",          requireAuth, apiLimiter, workersRouter);
app.use("/api/routes",           requireAuth, apiLimiter, routesRouter);
app.use("/api/trips",            requireAuth, apiLimiter, tripsRouter);
app.use("/api/business-clients", requireAuth, apiLimiter, businessClientsRouter);
app.use("/api/individual-clients", requireAuth, apiLimiter, individualClientsRouter);
app.use("/api/payments",         requireAuth, apiLimiter, paymentsRouter);
app.use("/api/invoice",          requireAuth, apiLimiter, invoiceRouter);
app.use("/api/settings",         requireAuth, apiLimiter, settingsRouter);
app.use("/api/places",           requireAuth, apiLimiter, placesRouter);

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ── Global error handler — never leaks stack traces ───────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Log internally with full detail
  log("SERVER_ERROR", {
    ip:      req.ip,
    method:  req.method,
    path:    req.path,
    message: err.message,
    stack:   isProd ? undefined : err.stack
  });

  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request too large." });
  }

  // Generic response — never expose internals to the client
  res.status(err.status || 500).json({
    error: isProd ? "An error occurred. Please try again." : err.message
  });
});

// ── Start ──────────────────────────────────────────────────────────────────
async function start() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("Missing MONGODB_URI in environment");

  await mongoose.connect(mongoUri, {
    dbName:          process.env.MONGODB_DB_NAME || undefined,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
  });
  console.log("[INFO] Connected to MongoDB");

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`[INFO] Server running on http://localhost:${port} (${isProd ? "production" : "development"})`);
  });
}

start().catch((err) => {
  console.error("[FATAL]", err.message);
  process.exit(1);
});
