# Mobile App Setup

## Step 1 - Set your server IP
Open `src/services/api.js` and change:
  const API_BASE = 'http://192.168.1.100:5000/api';
to your computer's local IP address.

Find your IP:
- Windows: open Command Prompt, type: ipconfig
- Look for "IPv4 Address" e.g. 192.168.1.105

## Step 2 - Install packages
```
npm install
```

## Step 3 - Start Expo
```
npx expo start
```

## Step 4 - Run on phone
1. Install "Expo Go" from Play Store or App Store
2. Make sure your phone and computer are on the same WiFi
3. Scan the QR code shown in terminal with Expo Go

## Test Student Login
- Email: kwame@ug.edu.gh
- Password: Student@123
