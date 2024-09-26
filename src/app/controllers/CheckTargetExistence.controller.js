const axios = require('axios');

class CheckTargetExistence {
    home (req, res) {
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
        Array.from(pathArr).forEach( async path => {
            const uri = target.trim() + path.trim();
            try {
                const response = await axios.get(uri, {headers});
                const data = response.data;
                const encoder = new TextEncoder(); 
                const byteArray = encoder.encode(data); 
                const byteLength = byteArray.length; 
                console.log(`Target=${target}${path}   status=${response.status}   Content-Length=${byteLength}`);
            } catch (error) {
                console.log('Error');
            }
        });
        res.send('oce');
    }
    async test (req, res) {
        const targets = ["http://hahah.hhaahh.com", "http://test.php.vulnweb.com", "https://ahanncn.com"];
        targets.forEach(async target => {
            try {
                const response = await axios.get(target, {
                    headers: {
                        'Host': 'testphp.vulnweb.com',
                        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.7,vi;q=0.3',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1'
                    }
                });
                const data = response.data;
                const encoder = new TextEncoder(); 
                const byteArray = encoder.encode(data); 
                const byteLength = byteArray.lzength; 
                console.log(`Target=${target}   status=${response.status}   Content-Length=${byteLength}`);
            } catch (error) {
                console.log('Error');
            }
        });
        res.send('oce');
    }
}

module.exports = new CheckTargetExistence();