const axios = require('axios');
const fs = require('fs');

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

class CheckTargetExistence {
    async scan(target, pathFile, headerFile, concurrencyLimit, ms) {
        try {
            // Đọc đường dẫn từ file đã cung cấp
            const fileContent = fs.readFileSync(pathFile, 'utf8');
            const pathArr = fileContent.split(/\s+/);
            const headers = headerFile ? this.readHeaders(headerFile) : {};

            const result = [];
            const pathNumber = pathArr.length;
            const limit = parseInt(concurrencyLimit) || 10; // số lượng luồng mặc định là 10

            // Hàm để xử lý từng request
            const fetchUri = async (path) => {
                const uri = target.trim() + '/' + path.trim();
                try {
                    const response = await axios.get(uri, { headers });
                    const data = response.data;
                    const byteLength = Buffer.byteLength(data); // Sử dụng Buffer để tính độ dài
                    result.push({ uri, byteLength, status: response.status });
                } catch (error) {
                    const byteLength = error.response ? Buffer.byteLength(error.response.data) : 0;
                    const status = error.response ? error.response.status : 500;
                    result.push({ uri, byteLength, status });
                }
                await delay(ms);
            };

            // Điều khiển số lượng yêu cầu đồng thời
            const parallelRequests = async () => {
                const queue = [];
                for (let i = 0; i < pathNumber; i++) {
                    queue.push(fetchUri(pathArr[i]));
                    if (queue.length >= limit) {
                        await Promise.all(queue);
                        queue.length = 0;
                    }
                }
                if (queue.length > 0) {
                    await Promise.all(queue);
                }
            };

            await parallelRequests();

            console.log(result);
            return result; // có thể in hoặc lưu kết quả ở đây
        } catch (error) {
            console.error('Error during scanning:', error.message);
            process.exit(1); // Thoát với mã lỗi
        } finally {
            process.exit(0);
        }
    }

    readHeaders(headerFile) {
        if (!fs.existsSync(headerFile)) {
            console.error(`Header file ${headerFile} does not exist.`);
            process.exit(1);
        }
        const headerContent = fs.readFileSync(headerFile, 'utf8');
        const headers = {};
        const lines = headerContent.split('\n');
        for (const line of lines) {
            const [key, value] = line.split(':').map(item => item.trim());
            if (key && value) {
                headers[key] = value;
            }
        }
        return headers;
    }
}

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

    const target = targetArgIndex !== -1 ? args[targetArgIndex + 1] : null;
    const pathFile = pathArgIndex !== -1 ? args[pathArgIndex + 1] : null;
    const headerFile = headArgIndex !== -1 ? args[headArgIndex + 1] : null;
    const concurrencyLimit = concurrencyArgIndex !== -1 ? parseInt(args[concurrencyArgIndex + 1]) : 10;
    const ms = timeoutIndex !== -1 ? parseInt(args[timeoutIndex + 1]) : 500;

    const checker = new CheckTargetExistence();
    checker.scan(target, pathFile, headerFile, concurrencyLimit, ms);
}
