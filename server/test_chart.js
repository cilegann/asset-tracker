const axios = require('axios');
axios.get('https://query1.finance.yahoo.com/v8/finance/chart/2330.TW?interval=1d&range=1d&lang=zh-Hant&region=TW')
.then(res => console.log(JSON.stringify(res.data.chart.result[0].meta, null, 2)))
.catch(console.error);
