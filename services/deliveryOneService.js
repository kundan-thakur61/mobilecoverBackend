// services/deliveryOneService.js
const axios = require('axios');

let cachedToken = null;
let tokenExpiry = null;

/**
 * Authenticates with DeliveryOne and returns a valid Bearer token.
 * Caches the token to avoid hitting the login API on every request.
 */
const getDeliveryOneToken = async () => {
  // Return cached token if it's still valid (buffer of 5 minutes)
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedToken;
  }

  try {
    const response = await axios.post('https://api.deliveryone.com/v1/auth/login', {
      email: process.env.DELIVERYONE_EMAIL,
      password: process.env.DELIVERYONE_PASSWORD
    });

    cachedToken = response.data.token;
    
    // Set expiry to 9 days (DeliveryOne tokens usually last 10 days)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 9);
    tokenExpiry = expiryDate;

    return cachedToken;
  } catch (error) {
    console.error("DeliveryOne Auth Error:", error.response?.data || error.message);
    throw new Error("Failed to authenticate with DeliveryOne");
  }
};

module.exports = { getDeliveryOneToken };