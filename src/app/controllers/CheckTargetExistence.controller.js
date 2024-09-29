const axios = require('axios');
const WebSocket = require('ws');
const fs = require('fs');
const { parse } = require('json2csv'); // Thư viện json2csv
const Excel = require('exceljs');
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

const saveResults = async (results, outputFile) => {
    try {
        const fileExtension = outputFile.split('.').pop().toLowerCase();

        if (fileExtension === 'csv') {
            const csv = parse(results); // Chuyển đổi sang CSV
            await fs.promises.writeFile(outputFile, csv);
            console.log(`Results saved to ${outputFile}`);
        } else if (fileExtension === 'xlsx') {
            const workbook = new Excel.Workbook();
            const worksheet = workbook.addWorksheet('Results');

            // Thêm các tiêu đề cột
            worksheet.columns = [
                { header: 'Status', key: 'status', width: 10 },
                { header: 'URI', key: 'uri', width: 100 },
                { header: 'Status code', key: 'statusCode', width: 20 },
                { header: 'Byte Length', key: 'byteLength', width: 15 }
            ];

            // Thêm dữ liệu và áp dụng màu cho từng hàng
            results.forEach((result) => {
                const row = worksheet.addRow(result);

                // Áp dụng màu dựa trên điều kiện (ví dụ: màu xanh cho status 200, màu đỏ cho status khác)
                if (result.status === 'Success') {
                    row.eachCell((cell) => {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFB6D7A8' } // Màu xanh nhạt
                        };
                    });
                } else {
                    row.eachCell((cell) => {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF4CCCC' } // Màu đỏ nhạt
                        };
                    });
                }
            });

            // Lưu workbook vào file
            await workbook.xlsx.writeFile(outputFile);
            console.log(`Results saved to ${outputFile}`);
        } else {
            console.error('Unsupported file format. Please use .csv or .xlsx');
        }
    } catch (error) {
        console.error(`Failed to save results to ${outputFile}:`, error.message);
    }
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
                    const statusCode = response.status;
                    result.push({
                        status: 'Success',
                        uri,
                        byteLength,
                        statusCode
                    });
                } catch (error) {
                    const byteLength = error.response ? new TextEncoder().encode(error.response.data).length : 0;
                    const statusCode = error.response ? error.response.status : 500;
                    result.push({
                        status: 'Failure',
                        uri,
                        byteLength,
                        statusCode
                    });
                }

                // Cập nhật tiến trình
                const progress = Math.round(((index + 1) / pathNumber) * 100);
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ progress , pathNumber}));
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

            // return res.render('index', {
            //     isResult: true,
            //     result
            // });
            return res.json(result);
        } catch (error) {
            console.log(error);
            res.send('Error');
        } finally {
            stop = false;
        }
    }

    stopScan(req, res, next) {
        stop = true; // Dừng quá trình scan
        res.json({status: 'Done'})
    }

    async saveFile(req, res, next) {
        const results = req.body; // Nhận dữ liệu từ client
        const outputFile = 'results.xlsx'; // Tên file xuất ra

        try {
            await saveResults(results, outputFile); // Gọi hàm lưu kết quả
            res.download(outputFile, (err) => {
                if (err) {
                    console.error('Error downloading file:', err);
                    res.status(500).send('Error downloading file');
                }
                // Sau khi tải xong, xóa tệp tin (nếu cần)
                fs.unlink(outputFile, (err) => {
                    if (err) console.error('Error deleting file:', err);
                });
            });
        } catch (error) {
            console.error('Failed to export results:', error);
            res.status(500).send('Failed to export results');
        }
    }
}

module.exports = new CheckTargetExistence();
