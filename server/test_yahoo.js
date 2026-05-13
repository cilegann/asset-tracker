const axios = require('axios');

async function test() {
  try {
    const resChart = await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/2330.TW?interval=1d&range=1d&lang=zh-Hant&region=TW', { headers: { 'User-Agent': 'Mozilla/5.0' }});
    console.log("Chart API Name:", resChart.data.chart.result[0].meta.shortName, resChart.data.chart.result[0].meta.longName);

    const resQuote = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote?symbols=2330.TW&lang=zh-Hant&region=TW', { headers: { 'User-Agent': 'Mozilla/5.0' }});
    console.log("Quote API Name:", resQuote.data.quoteResponse.result[0].shortName, resQuote.data.quoteResponse.result[0].longName);
  } catch (err) {
    console.error(err.message);
  }
}
test();
