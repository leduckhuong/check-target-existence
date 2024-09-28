const axios = require('axios');
const http = require('http');
const https = require('https');
const ws = require('ws');
const wss = new ws.Server({ port: 8888 });  // WebSocket server chạy trên port 8080

const keepAliveAgentHttp = new http.Agent({ keepAlive: true });
const keepAliveAgentHttps = new https.Agent({ keepAlive: true });

wss.on('connection', (ws) => {
    console.log('Client connected');

    // Xử lý khi client ngắt kết nối
    ws.on('close', () => {
        console.log('Client disconnected');
    });

    // Xử lý khi nhận tin nhắn từ client
    ws.on('message', (message) => {
        console.log('Received message:', message);
    });
});

class CheckTargetExistence {
    async home(req, res) {
        const target = req.body.target;
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }
        const fileContent = req.file.buffer.toString('utf8');
        const pathArr = fileContent.split(/\s+/);
        const head = req.body.head;
        const heads = head.split('\n');
        const headers = {};
        for (let i = 0; i < heads.length; i++) {
            const item = heads[i].split(':');
            for (let j = 0; j < item.length; j++) {
                item[j] = item[j].trim();
            }
            headers[item[0]] = item[1];
        }
        headers['httpAgent'] = keepAliveAgentHttp;
        headers['httpAgents'] = keepAliveAgentHttps;
        const result = [];
        const pathNumber = pathArr.length;
        for (let i = 0; i < pathNumber; i++) {
            const uri = target.trim() + '/' + pathArr[i].trim();
            try {
                const response = await axios.get(uri, { headers });
                const data = response.data;
                const encoder = new TextEncoder();
                const byteArray = encoder.encode(data);
                const byteLength = byteArray.length;
                result.push({
                    uri,
                    byteLength,
                    status: response.status
                });
            } catch (error) {
                const byteLength = error.response ? new TextEncoder().encode(error.response.data).length : 0;
                const status = error.response ? error.response.status : 500;

                result.push({
                    uri,
                    byteLength,
                    status
                });
            }
            const progress = Math.round(((i + 1) / pathNumber) * 100);
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ progress, pathNumber }));
                }
            });
        }
        return res.render('index', {
            isResult: true,
            result
        });
    }
}

module.exports = new CheckTargetExistence();
