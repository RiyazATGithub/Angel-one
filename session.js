const { SmartAPI } = require("smartapi-javascript");
const { authenticator } = require("otplib");
const axios = require("axios");
const dotenv = require("dotenv").config();

const totp = process.env.TOTP;
const OTP = authenticator.generate(totp);
console.log("TOTP", OTP);

let smart_api = new SmartAPI({
  api_key: process.env.API_KEY,
});

async function generateSession() {
  try {
    const otp = OTP;
    const data = await smart_api.generateSession(
      process.env.CLIENT_ID,
      process.env.PASSWORD,
      otp
    );
    console.log(data, "generated data");
    return data;
  } catch (err) {
    console.error(err);
  }
}
