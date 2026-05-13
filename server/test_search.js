const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('https://query2.finance.yahoo.com/v1/finance/search?q=2330.TW&lang=zh-Hant&region=TW&quotesCount=1', { headers: { 'User-Agent': 'Mozilla/5.0' }});
    console.log(JSON.stringify(res.data.quotes[0], null, 2));
  } catch (err) {
    console.error(err.message);
  }
}
test();
