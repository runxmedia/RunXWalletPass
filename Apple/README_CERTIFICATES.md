# Apple Wallet Certificate Setup Guide

To sign Apple Wallet passes, you need to obtain specific certificates from the Apple Developer Portal.

## Prerequisites
- Apple Developer Account ($99/year).
- Access to the [Apple Developer Portal](https://developer.apple.com/account/).

## Steps

### 1. Create a Pass Type ID
1. Log in to the Apple Developer Portal.
2. Go to **Certificates, Identifiers & Profiles** > **Identifiers**.
3. Click **+** to create a new identifier.
4. Select **Pass Type IDs** and click **Continue**.
5. Enter a **Description** (e.g., "RunX Wallet Pass") and an **Identifier** (e.g., `pass.com.runx.wallet`).
6. Click **Register**.

### 2. Create the Pass Signing Certificate
1. Select your newly created Pass Type ID from the list.
2. Click **Create Certificate**.
3. Follow the instructions to create a Certificate Signing Request (CSR) on your Mac (Keychain Access > Certificate Assistant > Request a Certificate from a Certificate Authority).
4. Upload the CSR file.
5. Download the generated `.cer` file (e.g., `pass.cer`).
6. Double-click `pass.cer` to install it into Keychain Access.

### 3. Export the Certificate and Key
1. Open **Keychain Access**.
2. Find the certificate you just installed (likely named "Pass Type ID: pass.com.runx.wallet").
3. Right-click the certificate and select **Export**.
4. Save it as `signerCert.p12`. You may set a password.
5. **Convert to PEM**:
   You will need to convert the p12 file to PEM format for the Node.js server to use it.
   ```bash
   openssl pkcs12 -in signerCert.p12 -clcerts -nokeys -out signerCert.pem
   openssl pkcs12 -in signerCert.p12 -nocerts -out signerKey.pem
   ```
   *Note: If you set a password, you'll need to provide it in the server configuration.*

### 4. Download the WWDR Certificate
1. Apple requires the "Apple Worldwide Developer Relations Certification Authority" certificate.
2. Download it from [Apple PKI](https://www.apple.com/certificateauthority/). Look for "Worldwide Developer Relations - G4" (or G1 if supporting very old devices, but G4/G6 is standard now).
3. Convert it to PEM if it's in .cer format:
   ```bash
   openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem
   ```

## Server Configuration
Place the files in the `certs/` directory of your project:
- `certs/signerCert.pem`
- `certs/signerKey.pem`
- `certs/wwdr.pem`

Ensure `server.js` is configured with the correct paths and key passphrase (if any).

```javascript
const certs = {
  wwdr: path.join(__dirname, 'certs', 'wwdr.pem'),
  signerCert: path.join(__dirname, 'certs', 'signerCert.pem'),
  signerKey: path.join(__dirname, 'certs', 'signerKey.pem'),
  signerKeyPassphrase: process.env.SIGNER_KEY_PASSPHRASE
};
```
