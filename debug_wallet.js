const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_FILE = 'sr-league-pass-d54be493ad9c.json';
const ISSUER_ID = '3388000000022198249';

async function debugWallet() {
    try {
        // 1. Auth
        console.log('Authenticating...');
        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(__dirname, SERVICE_ACCOUNT_FILE),
            scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
        });
        const client = await auth.getClient();
        console.log('Authenticated.');

        // 2. Load Class
        console.log('Loading Class Definition...');
        const classPath = path.join(__dirname, 'Google', 'Class.json');
        const classDefinition = JSON.parse(fs.readFileSync(classPath, 'utf8'));
        console.log(`Class ID: ${classDefinition.id}`);

        // 3. Insert/Update Class
        console.log('Attempting to insert Class...');
        const walletobjects = google.walletobjects({ version: 'v1', auth: client });

        try {
            await walletobjects.loyaltyclass.insert({
                requestBody: classDefinition,
            });
            console.log('✅ Class inserted successfully.');
        } catch (err) {
            if (err.code === 409) {
                console.log('⚠️ Class already exists. Attempting update...');
                try {
                    await walletobjects.loyaltyclass.update({
                        resourceId: classDefinition.id,
                        requestBody: classDefinition,
                    });
                    console.log('✅ Class updated successfully.');
                } catch (updateErr) {
                    console.error('❌ Failed to update Class:', JSON.stringify(updateErr.response?.data || updateErr.message, null, 2));
                    return; // Stop if class is broken
                }
            } else {
                console.error('❌ Failed to insert Class:', JSON.stringify(err.response?.data || err.message, null, 2));
                return; // Stop if class is broken
            }
        }

        // 4. Create Object
        console.log('Attempting to insert Object...');
        const objectId = `${ISSUER_ID}.debug_test_${Date.now()}`;
        const newObject = {
            "id": objectId,
            "classId": classDefinition.id,
            "state": "ACTIVE",
            "accountId": "debug@example.com",
            "accountName": "Debug User",
            "barcode": {
                "type": "QR_CODE",
                "value": objectId
            }
        };

        try {
            await walletobjects.loyaltyobject.insert({
                requestBody: newObject,
            });
            console.log('✅ Object inserted successfully.');
            console.log(`Object ID: ${objectId}`);
        } catch (err) {
            console.error('❌ Failed to insert Object:', JSON.stringify(err.response?.data || err.message, null, 2));
        }

    } catch (error) {
        console.error('🔥 Fatal Error:', error);
    }
}

debugWallet();
