# Social Authentication Setup Guide

This guide will help you set up Google, Facebook, and LinkedIn authentication for your React Native app.

## 🔧 Prerequisites

The following packages are already installed:
- `@react-native-google-signin/google-signin`
- `react-native-fbsdk-next`
- `@react-native-async-storage/async-storage`

## 📱 Google Sign-In Setup

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API and Google Sign-In API

### 2. Configure OAuth 2.0
1. Go to **APIs & Services** → **Credentials**
2. Create **OAuth 2.0 Client IDs** for:
   - **Android**: Use your app's package name and SHA-1 certificate fingerprint
   - **Web**: For server-side verification

### 3. Get SHA-1 Fingerprint
```bash
# For debug keystore
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# For release keystore (when publishing)
keytool -list -v -keystore your-release-key.keystore -alias your-key-alias
```

### 4. Update Configuration
Replace in `src/services/socialAuth.ts`:
```typescript
webClientId: 'YOUR_GOOGLE_WEB_CLIENT_ID', // From Google Cloud Console
```

Replace in `android/app/src/main/res/values/strings.xml`:
```xml
<string name="google_web_client_id">YOUR_GOOGLE_WEB_CLIENT_ID</string>
```

## 📘 Facebook Sign-In Setup

### 1. Create Facebook App
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Add **Facebook Login** product

### 2. Configure Android Platform
1. In Facebook App Dashboard, go to **Settings** → **Basic**
2. Add **Android** platform
3. Enter your package name: `com.fakemining.app`
4. Enter your key hash:

```bash
# Generate key hash for debug
keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore | openssl sha1 -binary | openssl base64

# For release keystore
keytool -exportcert -alias your-key-alias -keystore your-release-key.keystore | openssl sha1 -binary | openssl base64
```

### 3. Update Configuration
Replace in `src/services/socialAuth.ts`:
```typescript
facebook: {
  appId: 'YOUR_FACEBOOK_APP_ID', // From Facebook App Dashboard
  permissions: ['public_profile', 'email'],
},
```

Replace in `android/app/src/main/res/values/strings.xml`:
```xml
<string name="facebook_app_id">YOUR_FACEBOOK_APP_ID</string>
<string name="fb_login_protocol_scheme">fbYOUR_FACEBOOK_APP_ID</string>
```

Add Facebook Client Token:
```xml
<string name="facebook_client_token">YOUR_FACEBOOK_CLIENT_TOKEN</string>
```

## 💼 LinkedIn Sign-In Setup

### 1. Create LinkedIn App
1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Create a new app
3. Add **Sign In with LinkedIn** product

### 2. Configure OAuth 2.0
1. In your LinkedIn app, go to **Auth** tab
2. Add redirect URLs:
   - `https://your-app.com/auth/linkedin/callback`
   - For development: `http://localhost:3000/auth/linkedin/callback`

### 3. Update Configuration
Replace in `src/services/socialAuth.ts`:
```typescript
linkedin: {
  clientId: 'YOUR_LINKEDIN_CLIENT_ID', // From LinkedIn App
  redirectUri: 'https://your-app.com/auth/linkedin/callback',
  scopes: ['r_liteprofile', 'r_emailaddress'],
},
```

**Note**: LinkedIn integration requires additional WebView implementation for OAuth flow.

## 🔧 Backend Configuration

The backend is already configured to handle social login at `/api/auth/social-login`.

### Environment Variables
Add to your backend `.env` file:
```env
# Google
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Facebook
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# LinkedIn
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
```

## 🚀 Testing

### 1. Build and Run
```bash
# Clean and rebuild
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

### 2. Test Social Login
1. Open the app
2. Go to login screen
3. Try Google, Facebook, and LinkedIn buttons
4. Check console logs for any errors

## 🔍 Troubleshooting

### Common Issues:

1. **Google Sign-In Error**: 
   - Check SHA-1 fingerprint is correct
   - Verify package name matches
   - Ensure Google+ API is enabled

2. **Facebook Login Error**:
   - Verify key hash is correct
   - Check package name in Facebook app settings
   - Ensure Facebook Login product is added

3. **Build Errors**:
   - Clean and rebuild: `cd android && ./gradlew clean`
   - Check all package names are consistent

### Debug Commands:
```bash
# Check package name
grep applicationId android/app/build.gradle

# Check SHA-1 fingerprint
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey

# View logs
npx react-native log-android
```

## 📝 Next Steps

1. Replace all placeholder IDs with actual values from your social platform apps
2. Test each social login method
3. Configure production keys for release builds
4. Implement proper error handling and user feedback
5. Add logout functionality for social providers

## 🔐 Security Notes

- Never commit actual API keys to version control
- Use environment variables for sensitive data
- Implement proper token validation on backend
- Use HTTPS for all production endpoints
- Regularly rotate API keys and secrets
