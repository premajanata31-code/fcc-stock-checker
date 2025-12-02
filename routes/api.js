'use strict';

const mongoose = require('mongoose');
const fetch = require('node-fetch');
const crypto = require('crypto');

module.exports = function (app) {
  // Model
  const stockSchema = new mongoose.Schema({
    symbol: { type: String, required: true, unique: true },
    likes: { type: [String], default: [] }
  });

  const Stock = mongoose.model('Stock', stockSchema);

  // Ambil harga saham dari proxy freeCodeCamp
  async function getStockPrice(stockSymbol) {
    const url = `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stockSymbol}/quote`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error fetching stock price:', err);
      return null;
    }
  }

  // Update stock atau buat baru
  async function findUpdateStock(symbol, like, ipHash) {
    try {
      let stockDoc = await Stock.findOne({ symbol });
      if (!stockDoc) {
        stockDoc = new Stock({ symbol, likes: [] });
      }

      if (like && !stockDoc.likes.includes(ipHash)) {
        stockDoc.likes.push(ipHash);
      }

      await stockDoc.save();
      return stockDoc;
    } catch (err) {
      console.error('Error updating stock:', err);
      return null;
    }
  }

  app
    .route('/api/stock-prices')
    .get(async function (req, res) {
      try {
        const { stock, like } = req.query;

        if (!stock) {
          return res.json({ error: 'stock required' });
        }

        const isLike = like === 'true';

        // Hash IP
        const ipHash = crypto
          .createHash('sha256')
          .update(req.ip || 'unknown')
          .digest('hex');

        // Convert ke array dan uppercase
        let stocks = Array.isArray(stock) ? stock : [stock];
        stocks = stocks.map((s) => String(s).toUpperCase().trim());

        if (stocks.length > 2) {
          return res.json({ error: 'maximum 2 stocks' });
        }

        const stockDataArray = [];

        // Ambil data setiap stock
        for (let symbol of stocks) {
          const priceData = await getStockPrice(symbol);
          const dbData = await findUpdateStock(symbol, isLike, ipHash);

          let obj = {
            stock: symbol
          };

          if (priceData && priceData.latestPrice) {
            obj.price = Number(priceData.latestPrice);
          } else {
            obj.price = null;
          }

          if (dbData) {
            obj.likes = dbData.likes.length;
          } else {
            obj.likes = 0;
          }

          stockDataArray.push(obj);
        }

        // Single stock
        if (stocks.length === 1) {
          return res.json({ stockData: stockDataArray[0] });
        }

        // Dual stocks - tambah rel_likes
        if (stocks.length === 2) {
          const stock1 = stockDataArray[0];
          const stock2 = stockDataArray[1];

          stock1.rel_likes = stock1.likes - stock2.likes;
          stock2.rel_likes = stock2.likes - stock1.likes;

          // Hapus likes, ganti dengan rel_likes
          delete stock1.likes;
          delete stock2.likes;

          return res.json({ stockData: stockDataArray });
        }
      } catch (err) {
        console.error('API Error:', err);
        return res.json({ error: 'Internal server error' });
      }
    });
};
