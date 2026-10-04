const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' }

function createServer() {
    return http.createServer((request, response) => {
        let pathname
        try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname) }
        catch { response.writeHead(400).end(); return }
        if (pathname.includes('\0')) { response.writeHead(400).end(); return }
        if (pathname === '/') pathname = '/index.html'
        const file = path.resolve(root, '.' + pathname)
        const relative = path.relative(root, file).replaceAll('\\', '/')
        const allowed = relative === 'index.html' || /^(src|assets)\//.test(relative)
        if (!allowed || path.isAbsolute(relative) || relative.split('/').some(part => part.startsWith('.'))) {
            response.writeHead(404).end()
            return
        }
        fs.readFile(file, (error, content) => {
            if (error) { response.writeHead(404).end(); return }
            response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
            response.end(content)
        })
    })
}

if (require.main === module) {
    const port = Number(process.env.PORT || 8767)
    const server = createServer()
    server.on('error', error => {
        console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Close the other preview server or set PORT.` : error.message)
        process.exitCode = 1
    })
    server.listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}/`))
}

module.exports = { createServer }
