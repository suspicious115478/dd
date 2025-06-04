const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');

// Initialize Express app
const app = express();
app.use(bodyParser.json());

// --- Firebase Admin SDK Initialization ---
// IMPORTANT: Load Firebase service account from environment variable
// This variable (FIREBASE_SERVICE_ACCOUNT_JSON) will hold the entire JSON string
// of your Firebase service account key.
let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin SDK initialized successfully.');
} catch (error) {
    console.error('ERROR: Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON environment variable.');
    console.error('Please ensure it is set correctly and contains valid JSON.');
    console.error('Error details:', error.message);
    // Exit the process if Firebase initialization fails due to missing/invalid config
    process.exit(1);
}

// --- POST endpoint to send FCM notification ---
app.post('/sendRingingNotification', async (req, res) => {
    try {
        const { fcmToken, callerId, channel, token } = req.body; // Added channel and token

        // Validate required parameters
        if (!fcmToken || !callerId || !channel || !token) {
            return res.status(400).send('Missing fcmToken, callerId, channel, or token in request body.');
        }

        // Construct the FCM message payload
        // IMPORTANT: This is a DATA-ONLY message.
        // The 'notification' field is moved into 'data' to ensure onMessageReceived is always called.
        const message = {
            token: fcmToken,
            data: {
                type: "ring",
                callerId: callerId,
                channel: channel, // Pass channel to the Android app
                token: token,     // Pass token to the Android app
                // These fields are for displaying a custom notification on the Android side
                // You will use these in your MyFirebaseMessagingService to build a notification.
                title: 'Incoming Call',
                body: `Incoming call from ${callerId}` // Customize body if needed
            },
            android: {
                priority: "high" // Ensures prompt delivery for critical messages
            },
            apns: { // Optional: For iOS, if you also target iOS devices
                payload: {
                    aps: {
                        contentAvailable: true, // For background updates
                        alert: {
                            title: 'Incoming Call',
                            body: `Incoming call from ${callerId}`
                        },
                        sound: 'ringtone.caf' // Custom sound for iOS (must be bundled in app)
                    }
                },
                headers: {
                    'apns-priority': '10' // High priority for iOS
                }
            }
        };

        console.log('Attempting to send FCM message:', JSON.stringify(message, null, 2));

        // Send the message using Firebase Admin SDK
        const response = await admin.messaging().send(message);
        console.log('FCM Message sent successfully:', response);
        return res.status(200).send('Notification sent successfully.');

    } catch (error) {
        console.error('Error sending FCM notification:', error);
        // Provide more specific error messages for debugging
        if (error.code === 'messaging/invalid-argument') {
            return res.status(400).send(`FCM Error: Invalid argument - ${error.message}`);
        } else if (error.code === 'messaging/registration-token-not-registered') {
            return res.status(400).send(`FCM Error: FCM Token not registered - ${error.message}`);
        }
        return res.status(500).send('Internal Server Error while sending notification.');
    }
});

// --- Root GET route for health check ---
app.get('/', (req, res) => {
    res.send('FCM Notification Server is running!');
});

// --- Start server ---
const port = process.env.PORT || 3000; // Use environment variable PORT or default to 3000
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Access it at: http://localhost:${port}`);
});
