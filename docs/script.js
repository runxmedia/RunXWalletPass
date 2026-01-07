const RENDER_URL = 'https://runxwalletpass.onrender.com';
const TOTAL_SECONDS = 60;
let secondsRemaining = TOTAL_SECONDS;
let requestSuccess = false;

const timerEl = document.getElementById('timer');
const progressFill = document.getElementById('progress-fill');
const statusText = document.getElementById('status-text');

// Updates the UI countdown
function updateTimer() {
    if (requestSuccess) return; // Stop updating if we are done

    timerEl.textContent = secondsRemaining;

    // Update progress bar width
    const percentage = (secondsRemaining / TOTAL_SECONDS) * 100;
    progressFill.style.width = `${percentage}%`;

    // Messages based on time
    if (secondsRemaining === 50) statusText.textContent = "Still trying to wake it up...";
    if (secondsRemaining === 30) statusText.textContent = "Almost there, thanks for your patience...";
    if (secondsRemaining === 10) statusText.textContent = "Final checks...";
    if (secondsRemaining === 0) {
        statusText.textContent = "Redirecting now...";
        window.location.href = RENDER_URL;
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
        // A 'opaque' response is good enough to know it's alive (or at least reachable).
        await fetch(RENDER_URL, { mode: 'no-cors' });

        console.log("Server responded! Redirecting...");
        requestSuccess = true;
        statusText.textContent = "Server Ready! Redirecting...";
        progressFill.style.width = '0%'; // Visual quirk: maybe 0 or 100? Let's leave it.

        // Slight delay to let user see "Server Ready"
        setTimeout(() => {
            window.location.href = RENDER_URL;
        }, 800);

    } catch (error) {
        console.error("Ping failed (still sleeping?)", error);
        // If it fails immediately (network error), we just let the timer loop continue.
        // We could try again in a few seconds if we wanted to be aggressive.

        // Simple retry logic: if we have time left, try again in 5 seconds
        if (secondsRemaining > 5) {
            setTimeout(pingServer, 5000);
        }
    }
}

// Start everything
updateTimer();
pingServer();
