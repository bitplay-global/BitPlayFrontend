const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: true, // Allow all origins for Firebase Functions
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
});
app.use("/api/", limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// MongoDB Atlas connection
const MONGODB_URI = functions.config().mongodb?.uri || process.env.MONGODB_URI;
const JWT_SECRET = functions.config().jwt?.secret ||
  process.env.JWT_SECRET || "your-fallback-secret";

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).then(() => {
    console.log('MongoDB Connected to Atlas');
  }).catch(err => {
    console.error('MongoDB connection error:', err);
  });
} else {
  console.error('MongoDB URI not found in config');
}

// User model
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Generate unique referral code
const generateReferralCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please provide a name"],
    trim: true,
    maxlength: [50, "Name cannot be more than 50 characters"],
  },
  email: {
    type: String,
    required: [true, "Please provide an email"],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      "Please provide a valid email",
    ],
  },
  password: {
    type: String,
    required: [true, "Please provide a password"],
    minlength: [6, "Password must be at least 6 characters"],
    select: false,
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLogin: {
    type: Date,
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
  },
  referralUsed: {
    type: String,
    default: null,
    index: true,
  },
}, {
  timestamps: true,
});

// Encrypt password using bcrypt and generate referral code
userSchema.pre("save", async function(next) {
  // Hash password if modified
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  // Generate unique referral code for new users
  if (this.isNew && !this.referralCode) {
    let isUnique = false;
    let code;

    while (!isUnique) {
      code = generateReferralCode();
      const existingUser = await mongoose.model("User").findOne({ referralCode: code });
      if (!existingUser) {
        isUnique = true;
      }
    }

    this.referralCode = code;
  }

  next();
});

// Sign JWT and return
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id }, JWT_SECRET, {
    expiresIn: "7d",
  });
};

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash password token
userSchema.methods.getResetPasswordToken = function() {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString("hex");

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

  // Set expire
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

const User = mongoose.model("User", userSchema);

// Helper function to send token response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === "production") {
    options.secure = true;
  }

  res.status(statusCode)
      .cookie("token", token, options)
      .json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isActive: user.isActive,
          referralCode: user.referralCode,
          referralUsed: user.referralUsed,
          createdAt: user.createdAt,
        },
      });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, referral_code } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email and password",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Validate referral code if provided
    let referralUsed = null;
    if (referral_code && referral_code.trim()) {
      const referralCodeUpper = referral_code.trim().toUpperCase();
      const referrerUser = await User.findOne({ 
        referralCode: referralCodeUpper,
        isActive: true  // Only accept codes from active users
      });
      
      if (!referrerUser) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or inactive referral code'
        });
      }
      
      referralUsed = referralCodeUpper;
      console.log('Valid referral code found:', referralCodeUpper, 'Referrer:', referrerUser.email);
    }

    // Create user (password and referralCode will be handled by pre-save middleware)
    const user = await User.create({
      name,
      email,
      password,
      referralUsed,
    });

    console.log('New user registered:', user.email, 'with referral code:', referralUsed || 'none');

    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide an email and password",
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
app.get("/api/auth/me", async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }
});

// Health check route
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Firebase Functions API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Root route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Fake Mining App API - Firebase Functions",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
      me: "GET /api/auth/me",
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);
