'use strict';
const fetch = require('node-fetch');
const mongoose = require('mongoose');

// Definisi Schema & Model langsung di sini
const StockSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  likes: { type: [String], default: [] } // Array IP address
});
const Stock = mongoose.model('Stock', StockSchema);

// Fungsi hash sederhana untuk anonimkan IP
const crypto = require('crypto');
function anonymize(ip) {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

module.exports = function (app) {

  // Fungsi helper untuk mengambil harga
  async function getStockPrice(stock) {
    const response = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stock}/quote`);
    const data = await response.json();
    return { stock: data.symbol, price: data.latestPrice };
  }

  // Fungsi helper untuk load/save like
  async function loadStockData(stock, like, ip) {
    const symbol = stock.toUpperCase();
    let stockData = await Stock.findOne({ symbol });
    
    if (!stockData) {
      stockData = new Stock({ symbol, likes: [] });
    }

    if (like === 'true') {
      const hashedIp = anonymize(ip);
      if (!stockData.likes.includes(hashedIp)) {
        stockData.likes.push(hashedIp);
        await stockData.save();
      }
    } else {
      // Pastikan disave kalau baru dibuat meskipun tidak di-like
      if (stockData.isNew) await stockData.save();
    }
    
    return stockData.likes.length;
  }

  app.route('/api/stock-prices')
    .get(async function (req, res) {
      const { stock, like } = req.query;
      const ip = req.ip;

      // Kasus 1: Array (Dua Saham)
      if (Array.isArray(stock)) {
        const stock1Symbol = stock[0];
        const stock2Symbol = stock[1];

        const price1 = await getStockPrice(stock1Symbol);
        const likes1 = await loadStockData(stock1Symbol, like, ip);

        const price2 = await getStockPrice(stock2Symbol);
        const likes2 = await loadStockData(stock2Symbol, like, ip);

        res.json({
          stockData: [
            { stock: price1.stock, price: price1.price, rel_likes: likes1 - likes2 },
            { stock: price2.stock, price: price2.price, rel_likes: likes2 - likes1 }
          ]
        });

      // Kasus 2: Single String (Satu Saham)
      } else {
        const price = await getStockPrice(stock);
        const likes = await loadStockData(stock, like, ip);
        
        res.json({
          stockData: {
            stock: price.stock,
            price: price.price,
            likes: likes
          }
        });
      }
    });
};
