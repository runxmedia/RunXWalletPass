const RENDER_URL = 'https://runxwalletpass.onrender.com';
const TOTAL_SECONDS = 60;
let secondsRemaining = TOTAL_SECONDS;
let requestSuccess = false;

// Check for debug flag in URL (e.g., ?debug=true)
const urlParams = new URLSearchParams(window.location.search);
const isDebug = urlParams.has('debug');

const timerEl = document.getElementById('timer');
const progressFill = document.getElementById('progress-fill');
const statusText = document.getElementById('status-text');

if (isDebug) {
    console.log("Debug mode enabled: Automatic redirects disabled.");
}

// Updates the UI countdown
function updateTimer() {
    if (requestSuccess) return; // Stop updating if we are done

    // Calculate percentage (0 to 100)
    const elapsed = TOTAL_SECONDS - secondsRemaining;
    const percentage = Math.floor((elapsed / TOTAL_SECONDS) * 100);

    timerEl.textContent = `${percentage}%`;
    progressFill.style.width = `${percentage}%`;

    // Messages based on time
    if (secondsRemaining === 50) statusText.textContent = "Waking up the hamsters...";
    if (secondsRemaining === 30) statusText.textContent = "Almost there, thanks for your patience...";
    if (secondsRemaining === 10) statusText.textContent = "Final checks...";

    if (secondsRemaining === 0) {
        statusText.textContent = "Redirecting now...";
        progressFill.style.width = '100%';
        timerEl.textContent = '100%';

        if (!isDebug) {
            window.location.href = RENDER_URL;
        } else {
            statusText.textContent = "Debug Mode: Redirect prevented.";
        }
    }

    if (secondsRemaining > 0) {
        secondsRemaining--;
        setTimeout(updateTimer, 1000);
    }
}

// Pings the server
async function pingServer() {
    try {
        console.log("Pinging server...");
        // mode: 'no-cors' is crucial here because the Render app might not return CORS headers 
        // for this unexpected origin yet, but we just want to trigger the wake-up.
        await fetch(RENDER_URL, { mode: 'no-cors' });

        console.log("Server responded! Redirecting...");
        requestSuccess = true;
        statusText.textContent = "Server Ready! Redirecting...";
        progressFill.style.width = '100%';
        timerEl.textContent = '100%';

        // Slight delay to let user see "Server Ready"
        setTimeout(() => {
            if (!isDebug) {
                window.location.href = RENDER_URL;
            } else {
                statusText.textContent = "Debug Mode: Redirect prevented. Server is ready.";
            }
        }, 800);

    } catch (error) {
        console.error("Ping failed (still sleeping?)", error);

        // Simple retry logic: if we have time left, try again in 5 seconds
        if (secondsRemaining > 5) {
            setTimeout(pingServer, 5000);
        }
    }
}

// Start everything
updateTimer();
pingServer();
