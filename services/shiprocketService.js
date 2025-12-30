// services/shiprocketService.js
const axios = require('axios');

let cachedToken = null;
let tokenExpiry = null;

/**
 * Authenticates with Shiprocket and returns a valid Bearer token.
 * Caches the token to avoid hitting the login API on every request.
 */
const getShiprocketToken = async () => {
  // Return cached token if it's still valid (buffer of 5 minutes)
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedToken;
  }

  try {
    const response = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD
    });

    cachedToken = response.data.token;
    
    // Set expiry to 9 days (Shiprocket tokens usually last 10 days)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 9);
    tokenExpiry = expiryDate;

    return cachedToken;
  } catch (error) {
    console.error("Shiprocket Auth Error:", error.response?.data || error.message);
    throw new Error("Failed to authenticate with Shiprocket");
  }
};

module.exports = { getShiprocketToken };
