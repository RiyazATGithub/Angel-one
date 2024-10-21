// const { SmartAPI } = require("smartapi-javascript");
// const axios = require("axios");
// const { authenticator } = require("otplib");
// const dotenv = require("dotenv").config();

// let instrumentUrl =
//   "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json";

// let smart_api = new SmartAPI({
//   api_key: process.env.API_KEY,
// });

// const totp = process.env.TOTP;
// const OTP = authenticator.generate(totp);
// console.log("TOTP", OTP);

// async function generateSession() {
//   try {
//     const otp = OTP;
//     const data = await smart_api.generateSession(
//       process.env.CLIENT_ID,
//       process.env.PASSWORD,
//       otp
//     );
//     return data;
//   } catch (err) {
//     console.error(err);
//   }
// }

// async function getValidToken() {
//   // Your logic to generate the session and retrieve the feed token
//   const sessionData = await generateSession();
//   //   const feedToken = await getFeedToken(sessionData);
// }

// async function fetchInstruments() {
//   try {
//     const response = await axios.get(instrumentUrl);
//     // console.log(response.data, "response.data");
//     return response.data; // Ensure this returns the correct format
//   } catch (err) {
//     console.error("Failed to fetch instruments:", err);
//     return null;
//   }
// }

// async function hist_data(ticker, interval, instrument_list, exchange = "NSE") {
//   try {
//     let symbolToken = tokenLookup(ticker, instrument_list);
//     if (!symbolToken) {
//       throw new Error("Symbol token not found for " + ticker);
//     }

//     let params = {
//       exchange: exchange,
//       symboltoken: symbolToken,
//       interval: interval,
//       fromdate: "2024-09-30 11:15",
//       todate: "2024-10-01 12:00",
//     };

//     let response = await smart_api.getCandleData(params);

//     if (!response || !response.success) {
//       if (response.errorCode === "AG8001") {
//         console.log("Invalid Token. Attempting to regenerate token...");
//         const newFeedToken = await getValidToken();

//         // Use the new token for retrying the request if needed
//         // You may need to modify your smart_api instance to use the new token
//         response = await smart_api.getCandleData(params);
//       }

//       console.error("Error fetching candle data:", response);
//       throw new Error(
//         "Error fetching candle data: " + (response.message || "Unknown error")
//       );
//     }

//     return response.data;
//   } catch (err) {
//     console.error("Error in fetching candle data:", err);
//     return null; // Handle as needed
//   }
// }

// function tokenLookup(ticker, instrument_list, exchange = "NSE") {
//   for (let instrument of instrument_list) {
//     if (instrument.name === ticker && instrument.exch_seg === exchange) {
//       return instrument.token;
//     }
//   }
//   return null;
// }

// function calculateEMA(data, span) {
//   const k = 2 / (span + 1);
//   const ema = [data[0]]; // Start with the first value

//   for (let i = 1; i < data.length; i++) {
//     const newEma = data[i] * k + ema[i - 1] * (1 - k);
//     ema.push(newEma);
//   }
//   return ema;
// }

// function MACD(dfDict, a = 12, b = 26, c = 9) {
//   for (const key in dfDict) {
//     const df = dfDict[key];
//     const closePrices = df.close;

//     // Calculate fast and slow EMAs
//     const maFast = calculateEMA(closePrices, a);
//     const maSlow = calculateEMA(closePrices, b);

//     // Calculate MACD
//     const macd = maFast.map((value, index) => value - maSlow[index]);

//     // Calculate Signal line
//     const signal = calculateEMA(macd, c);

//     // Adding results to the data frame
//     df.macd = macd;
//     df.signal = signal;

//     // Clean up by removing intermediate calculations if needed
//     delete df.ma_fast;
//     delete df.ma_slow;
//   }
// }

// // Example usage
// const candleData = {
//   symbol1: { close: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
//   symbol2: { close: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
// };

// MACD(candleData);
// console.log(candleData, "candleData");

// function EMA(ser, n = 9) {
//   if (!ser || !Array.isArray(ser) || ser.length === 0) {
//     throw new Error("Input series must be a non-empty array");
//   }

//   const multiplier = 2 / (n + 1);
//   const sma = [];
//   const ema = new Array(ser.length).fill(NaN);

//   // Calculate the Simple Moving Average (SMA) for the first `n` values
//   for (let i = 0; i < ser.length; i++) {
//     if (i < n - 1) {
//       sma.push(NaN);
//     } else {
//       const sum = ser.slice(i - (n - 1), i + 1).reduce((a, b) => a + b, 0);
//       sma.push(sum / n);
//     }
//   }

//   // Initialize the first EMA value
//   ema[n - 1] = sma[n - 1];

//   // Calculate the EMA for the rest of the values
//   for (let i = n; i < ser.length; i++) {
//     ema[i] = (ser[i] - ema[i - 1]) * multiplier + ema[i - 1];
//   }

//   return ema;
// }

// // Function to calculate MACD
// function MACDcal(dfDict, a = 12, b = 26, c = 9) {
//   for (const key in dfDict) {
//     const df = dfDict[key];
//     df.ma_fast = EMA(df.close, a);
//     df.ma_slow = EMA(df.close, b);
//     df.macd = df.ma_fast.map((val, index) =>
//       val !== undefined && df.ma_slow[index] !== undefined
//         ? val - df.ma_slow[index]
//         : NaN
//     );
//     df.signal = EMA(df.macd, c);

//     // Clean up by removing intermediate calculations
//     delete df.ma_fast;
//     delete df.ma_slow;
//   }
// }

// // Example usage
// async function MACDmain() {
//   try {
//     // Fetch the instrument list first
//     const instrumentList = await fetchInstruments();

//     if (!Array.isArray(instrumentList) || instrumentList.length === 0) {
//       throw new Error("Instrument list must be a non-empty array.");
//     }

//     const candleData = await hist_data(
//       "RILINFRA",
//       "FIVE_MINUTE",
//       instrumentList
//     );

//     if (!Array.isArray(candleData) || candleData.length === 0) {
//       throw new Error("Candle data must be a non-empty array.");
//     }

//     const macdValues = MACDcal(candleData); // Ensure MACD is called with valid data
//     console.log(macdValues, "macdValues");

//     // Further processing with macdValues...
//   } catch (err) {
//     console.error("Error in MACDmain execution:", err);
//   }
// }
// MACDmain();

async function socket() {
  try {
    const sessionData = await generateSession();
    const feedToken = await getFeedToken(sessionData);
    if (!feedToken) {
      console.error("Feed token is not valid:", feedToken);
      return; // Exit if token is not valid
    }

    // const encodedToken = encodeURIComponent(feedToken);
    // console.log("Encoded Token:", encodedToken); // Log the encoded token

    const instrumentList = await fetchInstruments();
    if (!instrumentList) {
      console.error("Failed to retrieve instrument list");
      return;
    }

    const token = "nse_cm|1594&nse_cm|1330";
    const task = "mw";
    // console.log("Generated Feed Token:", feedToken);

    const ws = new WebSocket(
      `wss://smartapisocket.angelone.in/smart-stream?clientCode=${process.env.CLIENT_ID}&token=${feedToken}&apiKey=${process.env.API_KEY}`
    );

    // console.log("websocketURL", ws);

    ws.on("open", () => {
      console.log("WebSocket connection opened");
      const subscribeMessage = JSON.stringify({
        action: "subscribe",
        tasks: [task],
        tokens: token.split("&"),
      });
      ws.send(subscribeMessage);
    });

    ws.on("message", (message) => {
      console.log("Message received:", message);
    });

    ws.on("error", (error) => {
      console.error("WebSocket Error:", error);
    });

    ws.on("close", () => {
      console.log("WebSocket connection closed");
    });
  } catch (err) {
    console.error("Error in main execution:", err);
  }
}

socket();
