// Global function to handle Google Sign-In callback
async function handleCredentialResponse(response) {
    console.log("Encoded JWT ID token: " + response.credential);

    // Show loading state
    const container = document.getElementById('container');
    const loader = document.getElementById('loader');
    const googleBtn = document.querySelector('.google-btn-wrapper');

    if (googleBtn) googleBtn.style.display = 'none';
    loader.style.display = 'block';

    try {
        // Send token to backend for verification
        // Note: We need the Client ID here as well, usually passed from config
        // For now, we'll extract it or assume the backend knows it, 
        // but the backend endpoint expects it in the body.
        // Let's grab it from the DOM element
        const clientId = document.getElementById('g_id_onload').getAttribute('data-client_id');

        const verifyRes = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                credential: response.credential,
                clientId: clientId
            })
        });

        const verifyData = await verifyRes.json();

        if (verifyData.success) {
            showUserProfile(verifyData.user);
            generatePass(verifyData.user);
        } else {
            console.error('Login failed:', verifyData.error);
            alert('Login failed. Please try again.');
            loader.style.display = 'none';
            if (googleBtn) googleBtn.style.display = 'flex';
        }

    } catch (error) {
        console.error('Error during login:', error);
        alert('An error occurred. Please check the console.');
        loader.style.display = 'none';
        if (googleBtn) googleBtn.style.display = 'flex';
    }
}

function showUserProfile(user) {
    const profileDiv = document.getElementById('user-profile');
    const userImg = document.getElementById('user-img');
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');

    // Update Profile Section
    userImg.src = user.picture;
    userName.textContent = user.name;
    userEmail.textContent = user.email;

    profileDiv.style.display = 'flex';
    document.getElementById('loader').style.display = 'none';

    // Hide the title and subtitle to clean up the UI
    document.querySelector('h1').style.display = 'none';
    document.querySelector('.subtitle').style.display = 'none';
}

async function generatePass(user) {
    const loader = document.getElementById('loader');
    loader.style.display = 'block';

    try {
        const res = await fetch('/api/create-pass', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user })
        });

        const data = await res.json();

        if (data.success) {
            renderWalletButton(data.saveUrl, user);
        } else {
            console.error('Failed to generate pass:', data.error);
            alert('Failed to generate pass.');
        }

    } catch (error) {
        console.error('Error generating pass:', error);
    } finally {
        loader.style.display = 'none';
    }
}

function renderWalletButton(saveUrl, user) {
    const walletContainer = document.getElementById('wallet-container');
    const googleBtnContainer = document.getElementById('add-to-google-wallet-button');
    const appleBtnWrapper = document.getElementById('add-to-apple-wallet-button');
    const walletUserName = document.getElementById('wallet-user-name');

    // Update Welcome Name
    if (walletUserName) walletUserName.textContent = user.name;

    // --- Google Wallet ---
    const link = document.createElement('a');
    link.href = saveUrl;
    link.target = '_blank';
    link.id = 'add-to-wallet';
    link.style.display = 'block';

    const img = document.createElement('img');
    img.src = '/add-to-wallet-svg/svg/enUS_add_to_google_wallet_add-wallet-badge.svg';
    img.alt = 'Add to Google Wallet';
    link.appendChild(img);

    const instruction = document.createElement('span');
    instruction.className = 'warning-text';
    instruction.innerHTML = '⚠️ Please select your <strong>Personal Google Account</strong> (@gmail.com)';

    googleBtnContainer.innerHTML = '';
    googleBtnContainer.appendChild(link);
    googleBtnContainer.appendChild(instruction);

    // --- Apple Wallet ---
    // Attach click handler to the existing button wrapper
    appleBtnWrapper.onclick = async () => {
        try {
            // Show a mini loading state or feedback
            const originalOpacity = appleBtnWrapper.style.opacity;
            appleBtnWrapper.style.opacity = '0.5';

            const response = await fetch('/api/create-apple-pass', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user })
            });

            appleBtnWrapper.style.opacity = originalOpacity || '1';

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'pass.pkpass';
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else {
                const err = await response.json();
                console.error('Server error:', err);
                alert('Apple Pass Generation Failed. \n\nReason: ' + (err.error || 'Server error'));
            }
        } catch (e) {
            console.error(e);
            alert('Network error contacting server.');
            appleBtnWrapper.style.opacity = '1';
        }
    };

    // Reveal the container
    walletContainer.classList.remove('hidden');
}
