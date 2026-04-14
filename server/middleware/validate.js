/**
 * Input validation helpers using express-validator.
 *
 * Each export is an array: [...rules, handleValidationErrors]
 * so it can be spread directly into a route definition.
 *
 * Example:
 *   router.post("/", ...validate.createTrip, async (req, res) => { ... });
 */

const { body, param, query, validationResult } = require("express-validator");

// ── Validation error handler ───────────────────────────────────────────────
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: "Validation failed",
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
}

// ── Sanitise string helper ─────────────────────────────────────────────────
// Trims and strips HTML tags from a string field
function sanitiseStr(field) {
  return body(field)
    .optional()
    .trim()
    .escape();
}

// ── Auth ───────────────────────────────────────────────────────────────────
const signupRules = [
  body("name")
    .trim().notEmpty().withMessage("Name is required")
    .isLength({ max: 100 }).withMessage("Name too long")
    .escape(),

  body("email")
    .trim().notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email address")
    .normalizeEmail(),

  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password must contain an uppercase letter")
    .matches(/[a-z]/).withMessage("Password must contain a lowercase letter")
    .matches(/[0-9]/).withMessage("Password must contain a number")
    .matches(/[^A-Za-z0-9]/).withMessage("Password must contain a special character"),

  handleValidationErrors
];

const loginRules = [
  body("email")
    .trim().notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email address")
    .normalizeEmail(),

  body("password")
    .notEmpty().withMessage("Password is required"),

  handleValidationErrors
];

// ── Trips ──────────────────────────────────────────────────────────────────
const createTripRules = [
  body("date")
    .notEmpty().withMessage("Date is required")
    .isISO8601().withMessage("Date must be a valid ISO date"),

  body("origin")
    .trim().notEmpty().withMessage("Origin is required")
    .isLength({ max: 100 }).withMessage("Origin too long")
    .escape(),

  body("destination")
    .trim().notEmpty().withMessage("Destination is required")
    .isLength({ max: 100 }).withMessage("Destination too long")
    .escape(),

  body("variant")
    .optional()
    .trim()
    .isIn(["", "Morning", "Afternoon", "Evening"]).withMessage("Invalid variant")
    .escape(),

  body("totalAmount")
    .notEmpty().withMessage("Total amount is required")
    .isFloat({ min: 0, max: 99999 }).withMessage("Amount must be between 0 and 99,999"),

  body("paymentMethod")
    .notEmpty().withMessage("Payment method is required")
    .isIn(["direct", "partner"]).withMessage("paymentMethod must be direct or partner"),

  body("numberOfPeople")
    .optional()
    .isInt({ min: 1, max: 500 }).withMessage("Number of people must be between 1 and 500"),

  body("parkingCharges")
    .optional()
    .isFloat({ min: 0, max: 9999 }).withMessage("Parking charges out of range"),

  body("otherExpenses")
    .optional()
    .isFloat({ min: 0, max: 9999 }).withMessage("Other expenses out of range"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Notes too long")
    .escape(),

  handleValidationErrors
];

// ── Payments ───────────────────────────────────────────────────────────────
const createPaymentRules = [
  body("payerName")
    .trim().notEmpty().withMessage("Payer name is required")
    .isLength({ max: 100 }).withMessage("Payer name too long")
    .escape(),

  body("amount")
    .notEmpty().withMessage("Amount is required")
    .isFloat({ min: 0.01, max: 99999 }).withMessage("Amount must be between 0.01 and 99,999"),

  body("date")
    .notEmpty().withMessage("Date is required")
    .isISO8601().withMessage("Date must be a valid ISO date"),

  body("method")
    .notEmpty().withMessage("Payment method is required")
    .isIn(["Bank Transfer", "Cash", "Revolut"]).withMessage("Invalid payment method"),

  body("linkedType")
    .notEmpty().withMessage("Linked type is required")
    .isIn(["direct", "partner", "business", "individual"]).withMessage("Invalid linked type"),

  body("paidByName")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Paid by name too long")
    .escape(),

  handleValidationErrors
];

// ── Individual clients ─────────────────────────────────────────────────────
const createClientRules = [
  body("name")
    .trim().notEmpty().withMessage("Name is required")
    .isLength({ max: 100 }).withMessage("Name too long")
    .escape(),

  body("whatsappNumber")
    .optional()
    .trim()
    .matches(/^[0-9+\s\-()]{0,20}$/).withMessage("Invalid WhatsApp number")
    .escape(),

  body("postcode")
    .optional()
    .trim()
    .isLength({ max: 10 }).withMessage("Postcode too long")
    .escape(),

  body("clientType")
    .optional()
    .isIn(["direct", "partner"]).withMessage("clientType must be direct or partner"),

  body("organisation")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Organisation name too long")
    .escape(),

  body("carehomeLocation")
    .optional()
    .isIn(["Oxford", "Coventry", "Stratford", ""]).withMessage("Invalid carehome location"),

  handleValidationErrors
];

// ── Business clients ───────────────────────────────────────────────────────
const createBusinessClientRules = [
  body("name")
    .trim().notEmpty().withMessage("Name is required")
    .isLength({ max: 100 }).withMessage("Name too long")
    .escape(),

  body("runningBalance")
    .optional()
    .isFloat({ min: -999999, max: 999999 }).withMessage("Balance out of range"),

  handleValidationErrors
];

// ── Places ─────────────────────────────────────────────────────────────────
const createPlaceRules = [
  body("name")
    .trim().notEmpty().withMessage("Place name is required")
    .isLength({ max: 100 }).withMessage("Place name too long")
    .matches(/^[a-zA-Z0-9\s'\-,.]+$/).withMessage("Place name contains invalid characters")
    .escape(),

  handleValidationErrors
];

// ── Settings ───────────────────────────────────────────────────────────────
const updateSettingsRules = [
  body("businessName").optional().trim().isLength({ max: 150 }).escape(),
  body("businessAddress").optional().trim().isLength({ max: 500 }).escape(),
  body("bankName").optional().trim().isLength({ max: 100 }).escape(),
  body("accountNumber").optional().trim()
    .matches(/^[0-9\-\s]{0,20}$/).withMessage("Invalid account number").escape(),
  body("sortCode").optional().trim()
    .matches(/^[0-9\-\s]{0,10}$/).withMessage("Invalid sort code").escape(),
  body("whatsappBusinessNumber").optional().trim()
    .matches(/^[0-9+\s\-()]{0,20}$/).withMessage("Invalid WhatsApp number").escape(),

  handleValidationErrors
];

// ── MongoID param guard ────────────────────────────────────────────────────
const mongoIdParam = (paramName = "id") => [
  param(paramName)
    .isMongoId().withMessage("Invalid ID format"),
  handleValidationErrors
];

// ── Invoice ────────────────────────────────────────────────────────────────
const invoiceDataRules = [
  body("individualClientId")
    .notEmpty().withMessage("individualClientId is required")
    .isMongoId().withMessage("Invalid client ID"),

  body("from")
    .notEmpty().withMessage("from date is required")
    .isISO8601().withMessage("from must be a valid date"),

  body("to")
    .notEmpty().withMessage("to date is required")
    .isISO8601().withMessage("to must be a valid date"),

  body("previousBalance")
    .optional()
    .isFloat({ min: -999999, max: 999999 }).withMessage("Previous balance out of range"),

  handleValidationErrors
];

module.exports = {
  signupRules,
  loginRules,
  createTripRules,
  createPaymentRules,
  createClientRules,
  createBusinessClientRules,
  createPlaceRules,
  updateSettingsRules,
  mongoIdParam,
  invoiceDataRules
};
