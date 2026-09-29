import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const port = Number(process.argv[3] ?? 3000);
const contentTypes = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.map', 'application/json; charset=utf-8'],
    ['.svg', 'image/svg+xml'],
    ['.ttf', 'font/ttf'],
    ['.woff', 'font/woff'],
    ['.woff2', 'font/woff2']
]);

createServer(async (request, response) => {
    try {
        const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
        if (url.pathname === '/') {
            response.writeHead(302, { Location: '/app/' });
            response.end();
            return;
        }

        const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        let filePath = path.resolve(root, relativePath);
        if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
            response.writeHead(403);
            response.end('Forbidden');
            return;
        }

        const fileStat = await stat(filePath);
        if (fileStat.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }

        const body = await readFile(filePath);
        response.writeHead(200, {
            'Content-Type': contentTypes.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        response.end(body);
    } catch {
        response.writeHead(404);
        response.end('Not found');
    }
}).listen(port, 'localhost', () => {
    console.log(`Client HTTP server listening at http://localhost:${port}/app/`);
});
