const { SmartAPI } = require("smartapi-javascript");
const { authenticator } = require("otplib");
const axios = require("axios");
const dotenv = require("dotenv").config();
const WebSocketV2 = require("ws");

const totp = process.env.TOTP;
const OTP = authenticator.generate(totp);
console.log("TOTP", OTP);
let instrumentUrl =
  "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json";

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
    console.log(data, "session data");
    return data;
  } catch (err) {
    console.error(err);
  }
}

async function getFeedToken(sessionData) {
  if (!sessionData || !sessionData.data || !sessionData.data.jwtToken) {
    throw new Error("Invalid session data or access token");
  }
  return sessionData.data.feedToken;
}

async function fetchInstruments() {
  try {
    const response = await axios.get(instrumentUrl);
    // console.log(response.data, "response.data");
    return response.data; // Ensure this returns the correct format
  } catch (err) {
    console.error("Failed to fetch instruments:", err);
    return null;
  }
}

async function hist_data(ticker, interval, instrument_list, exchange = "NSE") {
  try {
    // console.log("Instrument list:", instrument_list); // Debugging line
    let symbolToken = tokenLookup(ticker, instrument_list);
    if (!symbolToken) {
      throw new Error("Symbol token not found for " + ticker);
    }
    let params = {
      exchange: exchange,
      symboltoken: symbolToken,
      interval: interval,
      fromdate: "2024-09-30 11:15",
      todate: "2024-10-01 12:00",
    };
    const response = await smart_api.getCandleData(params);

    if (!response) {
      throw new Error("Error fetching candle data");
    }

    console.error("retrieved candle data:", response);

    return response.data; // Ensure this matches the structure of your expected data
  } catch (err) {
    console.error("Error in fetching candle data:", err);
    return null; // Return null or handle as needed
  }
}

// hist_data();

function tokenLookup(ticker, instrumentList, exchange = "NSE") {
  console.log(`Looking up token for ticker: ${ticker}`); // Debugging line
  for (const instrument of instrumentList) {
    // console.log(`Checking instrument: ${instrument.name}, exchange: ${instrument.exch_seg}`); // Debugging line
    if (
      instrument.name === ticker &&
      instrument.exch_seg === exchange &&
      instrument.symbol.split("-").pop() === "EQ"
    ) {
      return instrument.token;
    }
  }
  console.warn(`Token not found for ${ticker}`); // Debugging line
  return null;
}

// Function to create a stream list
function streamList(stockList, instrumentList, exchange = "nse_cm") {
  return stockList
    .map((ticker) => `${exchange}|${tokenLookup(ticker, instrumentList)}`)
    .join("&");
}

// Main function to initialize WebSocket
async function init() {
  try {
    const sessionData = await generateSession();
    const feedToken = sessionData.data.feedToken;

    // Adjust this according to your session data structure
    const instrumentList = await fetchInstruments();
    // const token = streamList(["INFY", "HDFC"], instrumentList);
    const task = "dp";
    const ws = new WebSocketV2(
      `wss://smartapisocket.angelone.in/smart-stream?token=Bearer ${feedToken}`
    );
    ws.on("open", () => {
      console.log("WebSocket connection opened");
      const subscribeMessage = JSON.stringify({
        action: "subscribe",
        tasks: [task],
        // tokens: token.split("&"),
      });
      ws.send(subscribeMessage);
    });

    ws.on("message", (message) => {
      console.log("Ticks:", message);
    });

    ws.on("error", (error) => {
      console.error("WebSocket Error:", error);
    });

    ws.on("close", () => {
      console.log("WebSocket connection closed");
    });
  } catch (error) {
    console.error("Error in initialization:", error);
  }
}

init();

function calculateEMA(data, span) {
  const k = 2 / (span + 1);
  const ema = [data[0]]; // Start with the first value

  for (let i = 1; i < data.length; i++) {
    const newEma = data[i] * k + ema[i - 1] * (1 - k);
    ema.push(newEma);
  }
  return ema;
}

function MACD(dfDict, a = 12, b = 26, c = 9) {
  for (const key in dfDict) {
    const df = dfDict[key];
    const closePrices = df.close;

    // Calculate fast and slow EMAs
    const maFast = calculateEMA(closePrices, a);
    const maSlow = calculateEMA(closePrices, b);

    // Calculate MACD
    const macd = maFast.map((value, index) => value - maSlow[index]);

    // Calculate Signal line
    const signal = calculateEMA(macd, c);

    // Adding results to the data frame
    df.macd = macd;
    df.signal = signal;

    // Clean up by removing intermediate calculations if needed
    delete df.ma_fast;
    delete df.ma_slow;
  }
}

// Example usage
const candleData = {
  symbol1: { close: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  symbol2: { close: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
};

MACD(candleData);
console.log(candleData, "candleData");

function EMA(ser, n = 9) {
  if (!ser || !Array.isArray(ser) || ser.length === 0) {
    throw new Error("Input series must be a non-empty array");
  }

  const multiplier = 2 / (n + 1);
  const sma = [];
  const ema = new Array(ser.length).fill(NaN);

  // Calculate the Simple Moving Average (SMA) for the first `n` values
  for (let i = 0; i < ser.length; i++) {
    if (i < n - 1) {
      sma.push(NaN);
    } else {
      const sum = ser.slice(i - (n - 1), i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / n);
    }
  }

  // Initialize the first EMA value
  ema[n - 1] = sma[n - 1];

  // Calculate the EMA for the rest of the values
  for (let i = n; i < ser.length; i++) {
    ema[i] = (ser[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }

  return ema;
}

// Function to calculate MACD
function MACDcal(dfDict, a = 12, b = 26, c = 9) {
  for (const key in dfDict) {
    const df = dfDict[key];
    df.ma_fast = EMA(df.close, a);
    df.ma_slow = EMA(df.close, b);
    df.macd = df.ma_fast.map((val, index) =>
      val !== undefined && df.ma_slow[index] !== undefined
        ? val - df.ma_slow[index]
        : NaN
    );
    df.signal = EMA(df.macd, c);

    // Clean up by removing intermediate calculations
    delete df.ma_fast;
    delete df.ma_slow;
  }
}

// Example usage
// async function MACDmain() {
//   try {
//     // Fetch the instrument list first
//     const instrumentList = await fetchInstruments();

//     if (!Array.isArray(instrumentList) || instrumentList.length === 0) {
//       throw new Error("Instrument list must be a non-empty array.");
//     }

//     // const candleData = await hist_data(
//     //   "RILINFRA",
//     //   "FIVE_MINUTE",
//     //   instrumentList
//     // );

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

function bollBand(dataDict, n = 20) {
  for (const key in dataDict) {
    const data = dataDict[key];
    const closePrices = data.map((row) => row.close);

    const MB = closePrices.map((_, index) => {
      if (index < n - 1) return null; // Not enough data for moving average
      const slice = closePrices.slice(index - n + 1, index + 1);
      return slice.reduce((sum, value) => sum + value, 0) / n;
    });

    const UB = MB.map((mb, index) => {
      if (mb === null) return null;
      const slice = closePrices.slice(index - n + 1, index + 1);
      const mean = mb;
      const stdDev = Math.sqrt(
        slice.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / n
      );
      return mb + 2 * stdDev;
    });

    const LB = MB.map((mb, index) => {
      if (mb === null) return null;
      const slice = closePrices.slice(index - n + 1, index + 1);
      const mean = mb;
      const stdDev = Math.sqrt(
        slice.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / n
      );
      return mb - 2 * stdDev;
    });

    const BB_Width = UB.map((ub, index) => {
      if (ub === null || LB[index] === null) return null;
      return ub - LB[index];
    });

    // Add results back to the data
    data.forEach((row, index) => {
      row.MB = MB[index];
      row.UB = UB[index];
      row.LB = LB[index];
      row.BB_Width = BB_Width[index];
    });
  }

  return dataDict; // Return the updated data structure
}

// Example usage
const candle_data = {
  symbol1: [
    { close: 10 },
    { close: 11 },
    { close: 12 },
    { close: 13 },
    { close: 14 },
    { close: 15 },
    { close: 16 },
    { close: 17 },
    { close: 18 },
  ],
  symbol2: [
    { close: 20 },
    { close: 21 },
    { close: 19 },
    { close: 18 },
    { close: 22 },
    { close: 23 },
  ],
};

const updatedCandleData = bollBand(candle_data);
console.log(updatedCandleData, "bollband");

async function placeLimitOrder(
  instrumentList,
  ticker,
  buySell,
  price,
  quantity,
  exchange = "NSE"
) {
  const symbolToken = tokenLookup(ticker, instrumentList);
  if (!symbolToken) throw new Error(`Token not found for ${ticker}`);

  const params = {
    variety: "NORMAL",
    tradingsymbol: `${ticker}-EQ`,
    symboltoken: symbolToken,
    transactiontype: buySell,
    exchange: exchange,
    ordertype: "LIMIT",
    producttype: "INTRADAY",
    duration: "DAY",
    price: price,
    quantity: quantity,
  };

  const response = await smart_api.placeOrder(params);
  // console.log("API Response:", response); // Log the response from the API
  return response;
}

// async function cancelOrder(orderId) {
//   try {
//     console.log("Cancelling Order ID:", orderId);
//     const params = {
//       orderId: orderId, // Ensure this matches the expected parameter
//     };
//     const response = await smart_api.cancelOrder(params); // Ensure this matches your API method
//     return response;
//   } catch (error) {
//     console.error("Error cancelling order:", error);
//     throw error; // Re-throw the error to handle it in the calling function
//   }
// }

// modify order
async function modifyLimitOrder(
  instrumentList,
  ticker,
  orderId,
  price,
  quantity
) {
  const token = tokenLookup(ticker, instrumentList);
  const params = {
    variety: "NORMAL",
    orderid: orderId,
    ordertype: "LIMIT",
    producttype: "INTRADAY",
    duration: "DAY",
    price: price,
    quantity: quantity,
    tradingsymbol: `${ticker}-EQ`,
    symboltoken: token,
    exchange: "NSE",
  };
  const response = await smart_api.modifyOrder(params);
  return response;
}
async function getOpenOrders() {
  const response = await smart_api.getOrderBook();
  const openOrders = response.data.filter(
    (order) => order.orderstatus === "open"
  );
  return openOrders;
}

async function placeSLLimitOrder(
  instrumentList,
  ticker,
  buySell,
  price,
  quantity,
  exchange = "NSE"
) {
  const params = {
    variety: "STOPLOSS",
    tradingsymbol: `${ticker}-EQ`,
    symboltoken: tokenLookup(ticker, instrumentList),
    transactiontype: buySell,
    exchange: exchange,
    ordertype: "STOPLOSS_LIMIT",
    producttype: "INTRADAY",
    duration: "DAY",
    price: price + 0.05,
    triggerprice: price,
    quantity: quantity,
  };
  const response = await smart_api.placeOrder(params);
  return response;
}

async function placeSLMarketOrder(
  instrumentList,
  ticker,
  buySell,
  price,
  quantity,
  sl = 0,
  sqof = 0,
  exchange = "NSE"
) {
  const params = {
    variety: "STOPLOSS",
    tradingsymbol: `${ticker}-EQ`,
    symboltoken: tokenLookup(ticker, instrumentList),
    transactiontype: buySell,
    exchange: exchange,
    ordertype: "STOPLOSS_MARKET",
    producttype: "INTRADAY",
    duration: "DAY",
    triggerprice: price,
    price: price,
    quantity: quantity,
  };
  const response = await smart_api.placeOrder(params);
  return response;
}

// async function getLtp(instrumentList, ticker, exchange = "NSE") {
//   const symbolToken = tokenLookup(ticker, instrumentList, exchange);
//   const tradingSymbol = `${ticker}-EQ`;

//   const response = await smart_api.ltpData(
//     exchange,
//     tradingSymbol,
//     symbolToken
//   );
//   return response.data.ltp;
// }

//  place robo order

// async function placeRoboOrder(
//   instrumentList,
//   ticker,
//   buySell,
//   price,
//   quantity,
//   exchange = "NSE"
// ) {
//   const ltp = await getLtp(instrumentList, ticker, exchange);

//   const params = {
//     variety: "ROBO",
//     tradingsymbol: `${ticker}-EQ`,
//     symboltoken: await tokenLookup(ticker, instrumentList),
//     transactiontype: buySell,
//     exchange: exchange,
//     ordertype: "LIMIT",
//     producttype: "BO",
//     duration: "DAY",
//     price: price,
//     stoploss: Math.round(ltp * 0.1 * 10) / 10, // Rounding to one decimal place
//     squareoff: Math.round(ltp * 0.2 * 10) / 10, // Rounding to one decimal place
//     quantity: quantity,
//   };

//   const response = await smart_api.placeOrder(params);
//   return response;
// }

// Place GTT order
// async function placeGttOrder(
//   instrumentList,
//   ticker,
//   buySell,
//   price,
//   quantity,
//   exchange = "NSE"
// ) {
//   const params = {
//     tradingsymbol: `${ticker}-EQ`,
//     symboltoken: tokenLookup(ticker, instrumentList, exchange),
//     transactiontype: buySell,
//     exchange: exchange,
//     producttype: "DELIVERY", // only DELIVERY and MARGIN acceptable
//     price: price + 1,
//     triggerprice: price,
//     qty: quantity,
//     timeperiod: "20", // number of days to expiry, max value 365
//   };
//   const response = await axios.post(
//     "https://api.angelone.in/v1/orders/gtt",
//     params
//   ); // Replace with actual API URL
//   return response.data;
// }

// (async () => {
//   try {
//     const sessionData = await generateSession();
//     const instrumentList = await fetchInstruments();
//     // console.log(instrumentList, "instrumentList");
//     // const orderResponse = await placeLimitOrder(
//     //   instrumentList,
//     //   "HCLTECH",
//     //   "SELL",
//     //   1250,
//     //   1
//     // );

//     // console.log("Order Response:", orderResponse);
//     // const modifyResponse = await modifyLimitOrder(
//     //   instrumentList,
//     //   "HCLTECH",
//     //   "BUY",
//     //   800,
//     //   2
//     // );

//     // console.log("Modify Response:", modifyResponse);
//     // const orderId = orderResponse.data.uniqueorderid;
//     // console.log(orderId, "orderId");

//     // Make sure to get the correct order ID
//     // await new Promise((resolve) => setTimeout(resolve, 2000));
//     // const cancelResponse = await cancelOrder(orderId);
//     // console.log("Cancel Response:", cancelResponse);

//     // const openOrders = await getOpenOrders(); // Await here to get the resolved value

//     // const orderIdForHCLTECH = openOrders.find(
//     //   (order) => order.tradingsymbol === "HCLTECH-EQ"
//     // )?.orderid;

//     // if (orderIdForHCLTECH) {
//     //   console.log("Order ID for HCLTECH:", orderIdForHCLTECH);
//     // } else {
//     //   console.log("No open order found for HCLTECH.");
//     // }

//     const slLimitResponse = await placeSLLimitOrder(
//       instrumentList,
//       "HCLTECH",
//       "BUY",
//       980,
//       1
//     );
//     console.log("Stop Loss Limit Order Response:", slLimitResponse);

//     // const ltp = await getLtp(instrumentList, "HCLTECH");
//     // const orderResponse = await placeRoboOrder(
//     //   instrumentList,
//     //   "HCLTECH",
//     //   "BUY",
//     //   ltp - 10,
//     //   1
//     // );
//     // console.log("Order Response:", orderResponse);

//     // const slMarketResponse = await placeSLMarketOrder(
//     //   instrumentList,
//     //   "HCLTECH",
//     //   "BUY",
//     //   980,
//     //   1
//     // );
//     // console.log("Stop Loss Market Order Response:", slMarketResponse);

//     // const gttResponse = await placeGttOrder(
//     //   instrumentList,
//     //   "HCLTECH",
//     //   "BUY",
//     //   500,
//     //   10
//     // );
//     // console.log("GTT Order Response:", gttResponse);
//   } catch (error) {
//     console.error("Error:", error);
//   }
// })();
