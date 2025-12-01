'use strict';

const mongoose = require('mongoose');
const fetch = require('node-fetch'); // Alat buat ambil data harga saham
const crypto = require('crypto');    // Alat buat menyamarkan (hash) IP Address

module.exports = function (app) {

  // --- 1. MEMBUAT MODEL DATABASE ---
  // Kita butuh tempat untuk menyimpan nama saham dan siapa saja yang nge-like
  const stockSchema = new mongoose.Schema({
    symbol: { type: String, required: true },
    likes: { type: [String], default: [] } // Array berisi IP address yang sudah di-hash
  });
  
  const Stock = mongoose.model('Stock', stockSchema);

  // --- 2. FUNGSI BANTU: Ambil Harga Saham ---
  // Mengambil data real-time dari API Proxy freeCodeCamp
  async function getStockPrice(stockSymbol) {
    const url = `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stockSymbol}/quote`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      return data;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  // --- 3. FUNGSI BANTU: Simpan Like ke Database ---
  async function findUpdateStock(symbol, like, ip) {
    // Cari saham di database, kalau gak ada, buat baru (upsert)
    let stockDoc = await Stock.findOne({ symbol: symbol });
    
    if (!stockDoc) {
      stockDoc = new Stock({ symbol: symbol, likes: [] });
    }

    // Jika user menekan like (true) DAN IP-nya belum ada di database
    if (like && !stockDoc.likes.includes(ip)) {
      stockDoc.likes.push(ip); // Simpan IP
      await stockDoc.save();   // Update database
    } else if (!stockDoc._id) {
       // Jika saham baru dibuat tapi tidak di-like, tetap simpan biar tercatat
       await stockDoc.save();
    }
    
    return stockDoc;
  }

  // --- 4. ROUTE UTAMA (Logic Inti) ---
  app.route('/api/stock-prices')
    .get(async function (req, res) {
      const { stock, like } = req.query;
      
      // Ambil IP user lalu acak (hash) biar privasi terjaga
      // Kita pakai SHA256 biar aman
      const ip = crypto.createHash('sha256').update(req.ip).digest('hex'); 
      const isLike = like === 'true';

      // Input 'stock' bisa berupa 1 string ("GOOG") atau array ["GOOG", "MSFT"]
      // Kita jadikan array dulu biar cara memprosesnya sama
      const stockSymbols = Array.isArray(stock) ? stock : [stock];
      
      const stockData = [];

      // Proses setiap saham yang diminta (bisa 1 atau 2)
      for (let symbol of stockSymbols) {
        // Ambil data harga terbaru
        const priceData = await getStockPrice(symbol);
        // Ambil data likes dari database sendiri
        const dbData = await findUpdateStock(symbol, isLike, ip);
        
        // Gabungkan datanya
        if(priceData) {
            stockData.push({
            stock: priceData.symbol,
            price: priceData.latestPrice,
            likes: dbData.likes.length
            });
        } else {
            // Jaga-jaga kalau simbol saham ngawur/salah
            stockData.push({
                error: "Stock not found",
                likes: dbData.likes.length
            });
        }
      }

      // --- 5. FORMAT RESPONS KE PENGGUNA ---
      
      // KASUS A: Cuma minta 1 saham
      if (stockData.length === 1) {
        res.json({ stockData: stockData[0] });
      } 
      // KASUS B: Minta 2 saham (Bandingkan Likes)
      else if (stockData.length === 2) {
        // Hitung selisih like (rel_likes)
        const stock1 = stockData[0];
        const stock2 = stockData[1];

        stock1.rel_likes = stock1.likes - stock2.likes;
        stock2.rel_likes = stock2.likes - stock1.likes;

        // Hapus field 'likes' biasa karena diganti 'rel_likes' sesuai permintaan soal
        delete stock1.likes;
        delete stock2.likes;
        
        res.json({ stockData: stockData });
      } else {
        res.json({ error: "Invalid request" });
      }
    });
};