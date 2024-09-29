const axios = require('axios');
const fs = require('fs');
const { parse } = require('json2csv'); // Thư viện json2csv
const Excel = require('exceljs');

// Hàm delay để làm chậm lại các luồng (giúp kiểm soát tốc độ)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Hàm để hiển thị hướng dẫn sử dụng
const showHelp = () => {
    console.log(`
Usage: npm run cmd-tool -- --target <target> --path <pathFile>

Options:
--target <target>           The target URL to scan.
--path <pathFile>        The file containing the paths to check, one per line.
--head [headerFile]      (Optional) The file containing custom headers to include in requests.
--concurrency [concurrencyLimit] (Optional) The number of concurrent requests to send (default is 10).
--timeout [ms] (Optional) Time delay requests to send (default is 500).

Examples:
npm run cmd-tool -- --target http://example.com --path paths.txt
npm run cmd-tool -- --target http://example.com --path paths.txt --head head.txt --concurrency 10 --timeout 500
`);
    process.exit(0); // Kết thúc chương trình
};

// Đọc headers file 
const readHeaders = async (headerFile) => {
    try {
        // Kiểm tra nếu file không tồn tại
        const exists = await fs.promises.access(headerFile).then(() => true).catch(() => false);
        
        if (!exists) {
            console.error(`Header file ${headerFile} does not exist.`);
            process.exit(1);
        }

        // Đọc nội dung file
        const headerContent = await fs.promises.readFile(headerFile, 'utf8');
        const headers = {};
        const lines = headerContent.split('\n');

        // Xử lý từng dòng header
        for (const line of lines) {
            const [key, value] = line.split(':').map(item => item.trim());
            if (key && value) {
                headers[key] = value;
            }
        }
        
        return headers;
    } catch (error) {
        console.error(`Failed to read header file ${headerFile}:`, error.message);
        process.exit(1); // Thoát với mã lỗi
    }
};

// Hàm để xử lý từng request
const fetchUri = async (target, path, headers, ms, result) => {
    const uri = target.trim() + '/' + path.trim();
    try {
        const response = await axios.get(uri, { headers });
        const data = response.data;
        const byteLength = Buffer.byteLength(data); // Sử dụng Buffer để tính độ dài
        const statusCode = response.status;
        console.log({ status: 'Success', uri, statusCode ,byteLength});
        result.push({ status: 'Success', uri, statusCode ,byteLength});
    } catch (error) {
        const byteLength = error.response ? Buffer.byteLength(error.response.data) : 0;
        const statusCode = error.response ? error.response.status : 500;
        console.log({ status: 'Failure', uri, statusCode ,byteLength});
        result.push({ status: 'Failure', uri, statusCode ,byteLength});
    }
    await delay(ms);
};

// Điều khiển số lượng yêu cầu đồng thời
const parallelRequests = async (target, pathArr, headers, ms, limit, result) => {
    const queue = [];
    for (let i = 0; i < pathArr.length; i++) {
        queue.push(fetchUri(target, pathArr[i], headers, ms, result));
        if (queue.length >= limit) {
            await Promise.all(queue);
            queue.length = 0;
        }
    }
    if (queue.length > 0) {
        await Promise.all(queue);
    }
};

// Xuất kết quả vào file
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
    async scan(target, pathFile, headerFile, concurrencyLimit, ms, outputFile) {
        try {
            // Đọc đường dẫn từ file đã cung cấp
            const fileContent = fs.readFileSync(pathFile, 'utf8');
            const pathArr = fileContent.split(/\s+/);
            const headers = headerFile ? await readHeaders(headerFile) : {};

            const result = [];
            const limit = parseInt(concurrencyLimit) || 10; // số lượng luồng mặc định là 10

            await parallelRequests(target, pathArr, headers, ms, limit, result);

            if (outputFile) {
                await saveResults(result, outputFile);
            }
        } catch (error) {
            console.error('Error during scanning:', error.message);
            process.exit(1); // Thoát với mã lỗi
        } finally {
            process.exit(0);
        }
    }
}

async function main () {
    // Kiểm tra tham số đầu vào
    const args = process.argv.slice(2);
    if (args.includes('--help')) {
        showHelp();
    } else if (args.length < 2) {
        console.log('Error: Insufficient arguments. Use --help for usage information.');
        process.exit(0);
    } else {
        const targetArgIndex = args.indexOf('--target');
        const pathArgIndex = args.indexOf('--path');
        const headArgIndex = args.indexOf('--head');
        const concurrencyArgIndex = args.indexOf('--concurrency');
        const timeoutIndex = args.indexOf('--timeout');
        const outputArgIndex = args.indexOf('--output');

        const target = targetArgIndex !== -1 ? args[targetArgIndex + 1] : null;
        const pathFile = pathArgIndex !== -1 ? args[pathArgIndex + 1] : null;
        const headerFile = headArgIndex !== -1 ? args[headArgIndex + 1] : null;
        const concurrencyLimit = concurrencyArgIndex !== -1 ? parseInt(args[concurrencyArgIndex + 1]) : 10;
        const ms = timeoutIndex !== -1 ? parseInt(args[timeoutIndex + 1]) : 500;
        const outputFile = outputArgIndex !== -1 ? args[outputArgIndex + 1] : null;

        const checker = new CheckTargetExistence();
        await checker.scan(target, pathFile, headerFile, concurrencyLimit, ms, outputFile);
    }
}

main();