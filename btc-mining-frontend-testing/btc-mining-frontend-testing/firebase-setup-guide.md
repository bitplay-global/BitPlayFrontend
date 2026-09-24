# Firebase Deployment Guide

## Option 1: Firebase Functions (Recommended)

### 1. Install Firebase CLI
```bash
npm install -g firebase-tools
```

### 2. Login to Firebase
```bash
firebase login
```

### 3. Initialize Firebase Project
```bash
firebase init functions
```

### 4. Modify backend for Firebase Functions

Create `functions/index.js`:
```javascript
const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection (use MongoDB Atlas)
const MONGODB_URI = functions.config().mongodb.uri || 'your-mongodb-atlas-uri';
mongoose.connect(MONGODB_URI);

// Import routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);
```

### 5. Set environment variables
```bash
firebase functions:config:set mongodb.uri="your-mongodb-atlas-uri"
firebase functions:config:set jwt.secret="your-jwt-secret"
```

### 6. Deploy
```bash
firebase deploy --only functions
```

### 7. Update React Native app URLs
Replace `http://192.168.1.12:5000` with:
`https://your-project-id.cloudfunctions.net/api`

## Option 2: Firebase Hosting + External Database

### Use MongoDB Atlas (Free tier available)
1. Create account at mongodb.com/atlas
2. Create cluster
3. Get connection string
4. Update your backend code

### Benefits of Firebase Functions:
- ✅ Serverless (no server management)
- ✅ Auto-scaling
- ✅ Free tier available
- ✅ HTTPS by default
- ✅ Global CDN

### Limitations:
- ❌ Cold starts (first request may be slow)
- ❌ 540 second timeout limit
- ❌ Limited to Node.js runtime

## Alternative: Vercel/Netlify
If you want simpler deployment, consider:
- Vercel (vercel.com)
- Netlify Functions
- Railway (railway.app)
