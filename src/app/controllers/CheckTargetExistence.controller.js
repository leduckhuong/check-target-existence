const axios = require('axios');

class CheckTargetExistence {
    async home (req, res) {
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
            for ( let j = 0; j < item.length; j++) {
                item[j] = item[j].trim();
            }
            headers[item[0]] = item[1];
        }
        const result = [];
        for (const path of pathArr) {
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
        }
        return res.render('index', {
            isResult: true,
            result
        })
    }
}

module.exports = new CheckTargetExistence();