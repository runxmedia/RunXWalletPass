const express = require('express');
require('dotenv').config();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Configuration
// In a real app, these should be environment variables
const SERVICE_ACCOUNT_FILE = 'sr-league-pass-d54be493ad9c.json';
const ISSUER_ID = '3388000000022198249'; // Replace with your Issuer ID if different
const CLASS_ID = `${ISSUER_ID}.RunX_Pass_v2`; // Replace with your Class ID

// Encryption Configuration
// NOTE: In production, store this securely!
// Use environment variable or fallback for dev (DO NOT use this fallback in prod)
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'ik*&O4hks3O*DB&K#8jn3#!Jo8';
const ENCRYPTION_KEY = crypto.scryptSync(ENCRYPTION_SECRET, 'salt', 32);
const IV_LENGTH = 16;

function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Load Service Account Credentials
let serviceAccount;
try {
    // 1. Check if the content is directly in an ENV var (common in some platforms)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    }
    // 2. Check standard Google Cloud env var
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Should be a path
        serviceAccount = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
    }
    // 3. Fallback to local file
    else {
        const serviceAccountPath = path.join(__dirname, SERVICE_ACCOUNT_FILE);
        serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    }
} catch (error) {
    console.error('Error loading service account:', error);
    // process.exit(1); // Don't crash immediately, maybe just log? 
    // Actually, we need it for signing, so crashing or handling gracefully in the route is better.
    console.error('Service account credentials are required for signing passes.');
}

// Load Google Wallet Class Definition
let classDefinition;
try {
    const classPath = path.join(__dirname, 'Google', 'Class.json');
    classDefinition = JSON.parse(fs.readFileSync(classPath, 'utf8'));
} catch (error) {
    console.error('Error loading Google Class file:', error);
    // Fallback or exit? For now, we'll log it.
}

if (classDefinition) {
    console.log('Loaded Class ID:', classDefinition.id);
}

// Google Sign-In Verification
const client = new OAuth2Client();

app.post('/api/login', async (req, res) => {
    const { credential, clientId } = req.body;

    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: clientId,
        });
        const payload = ticket.getPayload();
        const userid = payload['sub'];
        const email = payload['email'];
        const name = payload['name'];
        const picture = payload['picture'];

        if (!email.endsWith('@sunrun.com')) {
            return res.status(403).json({ success: false, error: 'Only @sunrun.com accounts are allowed.' });
        }

        res.json({ success: true, user: { name, email, picture } });
    } catch (error) {
        console.error('Error verifying Google token:', error);
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
});

// Generate Google Wallet Pass JWT
app.post('/api/create-pass', async (req, res) => {
    const { user } = req.body;

    if (!user) {
        return res.status(400).json({ success: false, error: 'User data required' });
    }

    if (!classDefinition) {
        return res.status(500).json({ success: false, error: 'Server configuration error: Class definition missing' });
    }

    const objectId = `${ISSUER_ID}.${user.email.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;

    const qrData = JSON.stringify({
        name: user.name,
        email: user.email
    });

    const encryptedQrData = '{SECURE}' + encrypt(qrData);

    const newObject = {
        "id": objectId,
        "classId": classDefinition.id,
        "state": "ACTIVE",
        "accountId": user.email,
        "accountName": user.name,
        "barcode": {
            "type": "QR_CODE",
            "value": encryptedQrData,
            "alternateText": user.name
        }
    };

    const claims = {
        iss: serviceAccount.client_email,
        aud: 'google',
        origins: ['www.example.com'], // In production, restrict this
        typ: 'savetowallet',
        payload: {
            loyaltyClasses: [classDefinition],
            loyaltyObjects: [newObject]
        }
    };

    try {
        const token = jwt.sign(claims, serviceAccount.private_key, { algorithm: 'RS256' });
        const saveUrl = `https://pay.google.com/gp/v/save/${token}`;
        const accountChooserUrl = `https://accounts.google.com/AccountChooser?continue=${encodeURIComponent(saveUrl)}&hd=gmail.com`;
        res.json({ success: true, saveUrl: accountChooserUrl });
    } catch (error) {
        console.error('Error signing JWT:', error);
        res.status(500).json({ success: false, error: 'Failed to generate pass' });
    }
});


// Apple Wallet Configuration
const { PKPass } = require('passkit-generator');

// ... (Existing Google Wallet code) ...

// Generate Apple Wallet Pass
app.post('/api/create-apple-pass', async (req, res) => {
    const { user } = req.body;

    if (!user) {
        return res.status(400).json({ success: false, error: 'User data required' });
    }

    try {
        // Helper to resolve cert paths
        function resolveCertPath(filename) {
            const secretPath = path.join('/etc/secrets', filename);
            if (fs.existsSync(secretPath)) {
                return secretPath;
            }
            // Fallback to local certs directory
            return path.join(__dirname, 'certs', filename);
        }

        const applePassDir = path.join(__dirname, 'Apple.pass');
        const passJsonPath = path.join(applePassDir, 'pass.json');

        console.log('Checking Apple Pass model at:', applePassDir);

        if (!fs.existsSync(applePassDir)) {
            console.error('CRITICAL: Apple.pass directory not found at', applePassDir);
            // List contents of current directory to see what's there
            console.error('Current directory contents:', fs.readdirSync(__dirname));
        } else if (!fs.existsSync(passJsonPath)) {
            console.error('CRITICAL: pass.json not found at', passJsonPath);
            console.error('Apple.pass directory contents:', fs.readdirSync(applePassDir));
        } else {
            console.log('pass.json found.');
        }

        // Paths to keys and certs - THESE MUST BE PROVIDED BY THE USER
        const wwdrPath = resolveCertPath('wwdr.pem');
        const signerCertPath = resolveCertPath('signerCert.pem');
        const signerKeyPath = resolveCertPath('signerKey.pem');

        console.log('Cert paths resolved:', {
            wwdr: wwdrPath,
            signerCert: signerCertPath,
            signerKey: signerKeyPath
        });

        const certs = {
            wwdr: fs.readFileSync(wwdrPath),
            signerCert: fs.readFileSync(signerCertPath),
            signerKey: fs.readFileSync(signerKeyPath),
            signerKeyPassphrase: process.env.SIGNER_KEY_PASSPHRASE // Required if key is encrypted
        };

        // Check if certs exist (mock check for now, or just proceed and let it fail if missing)
        // For this implementation, we will try to generate. If certs are missing, we might catch the error.

        const pass = await PKPass.from({
            model: applePassDir,
            certificates: certs
        });

        pass.primaryFields.forEach(f => {
            if (f.key === 'name') f.value = user.name;
        });
        pass.secondaryFields.forEach(f => {
            if (f.key === 'email') f.value = user.email;
        });

        const qrData = JSON.stringify({
            name: user.name,
            email: user.email
        });
        const encryptedQrData = '{SECURE}' + encrypt(qrData);

        pass.setBarcodes({
            format: 'PKBarcodeFormatQR',
            message: encryptedQrData,
            messageEncoding: 'iso-8859-1',
            altText: user.name
        });

        // Add images
        pass.addBuffer('icon.png', fs.readFileSync(path.join(__dirname, 'Apple.pass', 'icon.png')));
        pass.addBuffer('icon@2x.png', fs.readFileSync(path.join(__dirname, 'Apple.pass', 'icon.png'))); // Reusing for now
        pass.addBuffer('logo.png', fs.readFileSync(path.join(__dirname, 'Apple.pass', 'logo.png')));
        pass.addBuffer('logo@2x.png', fs.readFileSync(path.join(__dirname, 'Apple.pass', 'logo.png')));
        pass.addBuffer('strip.png', fs.readFileSync(path.join(__dirname, 'Apple.pass', 'strip.png')));
        pass.addBuffer('strip@2x.png', fs.readFileSync(path.join(__dirname, 'Apple.pass', 'strip.png')));

        const buffer = pass.getAsBuffer();

        res.set('Content-Type', 'application/vnd.apple.pkpass');
        res.set('Content-Disposition', 'attachment; filename=pass.pkpass');
        res.send(buffer);

    } catch (error) {
        console.error('Error generating Apple Pass:', error);
        // More detailed error logging
        if (error.message) console.error('Error Message:', error.message);
        if (error.stack) console.error('Error Stack:', error.stack);

        res.status(500).json({ success: false, error: 'Failed to generate Apple Pass. ensure certificates are configured.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

