const axios = require('axios');
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3333 });
let stop = false;

// Hàm delay để làm chậm lại các luồng (giúp kiểm soát tốc độ)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Hàm để xử lý từng request
const fetchUri = async (path, result) => {
    const uri = target.trim() + '/' + path.trim();
    try {
        const response = await axios.get(uri, { headers });
        const data = response.data;
        const byteLength = Buffer.byteLength(data); // Sử dụng Buffer để tính độ dài
        result.push({ uri, status: response.status ,byteLength});
    } catch (error) {
        const byteLength = error.response ? Buffer.byteLength(error.response.data) : 0;
        const status = error.response ? error.response.status : 500;
        result.push({ uri, status ,byteLength});
    }
    await delay(ms);
};

class CheckTargetExistence {
    async scan(req, res) {
        try {
            
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

            const result = [];
            const pathNumber = pathArr.length;
            const concurrencyLimit = parseInt(req.body.threads) || 10; // số lượng luồng mặc định là 10
            let index = 0;

            // Hàm để xử lý từng request
            const fetchUri = async (path) => {
                if (stop) return;
                const uri = target.trim() + '/' + path.trim();
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

                // Cập nhật tiến trình
                const progress = Math.round(((index + 1) / pathNumber) * 100);
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ progress }));
                    }
                });
                index++;
                await delay(500);
            };

            // Điều khiển số lượng yêu cầu đồng thời
            const parallelRequests = async () => {
                const queue = [];
                for (let i = 0; i < pathNumber; i++) {
                    if (stop) break;

                    queue.push(fetchUri(pathArr[i]));
                    
                    if (queue.length >= concurrencyLimit) {
                        await Promise.all(queue); // đợi cho tất cả các luồng trong batch hoàn thành
                        queue.length = 0; // xóa hàng đợi sau khi batch hoàn thành
                    }
                }
                if (queue.length > 0) {
                    await Promise.all(queue); // xử lý các phần còn lại
                }
            };

            await parallelRequests();

            return res.render('index', {
                isResult: true,
                result
            });
        } catch (error) {
            console.log(error);
            res.send('Error');
        } finally {
            stop = false;
        }
    }

    stopScan(req, res, next) {
        stop = true; // Dừng quá trình scan
        res.send('Scanning stopped');
    }
}

module.exports = new CheckTargetExistence();
