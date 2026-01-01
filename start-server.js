const http = require('http');
const fs = require('fs');
const path = require('path');

// Find an available port
function findAvailablePort(startPort = 3000) {
    return new Promise((resolve, reject) => {
        const server = http.createServer();
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on('error', () => {
            resolve(findAvailablePort(startPort + 1));
        });
    });
}

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.geojson': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

// Start server
(async () => {
    const port = await findAvailablePort(8000);

    const server = http.createServer((req, res) => {
        let filePath = '.' + (req.url === '/' ? '/index.html' : req.url);
        const extname = path.extname(filePath);
        const contentType = mimeTypes[extname] || 'application/octet-stream';

        fs.readFile(filePath, (error, content) => {
            if (error) {
                if (error.code === 'ENOENT') {
                    res.writeHead(404);
                    res.end('404 - File Not Found');
                } else {
                    res.writeHead(500);
                    res.end('500 - Server Error: ' + error.code);
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    });

    server.listen(port, () => {
        console.log(`\n✓ World Time Zone Map server running at:`);
        console.log(`  http://localhost:${port}\n`);
        console.log(`Press Ctrl+C to stop the server`);
    });
})();
