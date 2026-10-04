const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const { createServer } = require('../../scripts/serve.cjs')

test('preview server serves moved assets and keeps private repository files out of HTTP', async () => {
    const server = createServer()
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
        const request = path => new Promise((resolve, reject) => {
            http.get({ hostname: '127.0.0.1', port: server.address().port, path }, response => {
                let body = ''
                response.on('data', chunk => { body += chunk })
                response.on('end', () => resolve({ code: response.statusCode, type: response.headers['content-type'], body }))
            }).on('error', reject)
        })
        const index = await request('/')
        assert.equal(index.code, 200)
        assert.match(index.body, /src\/app.js/)
        const paths = [...index.body.matchAll(/(?:src|href)="((?:src|assets)\/[^" ]+)"/g)].map(match => '/' + match[1])
        const assets = await Promise.all(paths.map(request))
        assert.ok(paths.length > 10)
        assert.ok(assets.every(response => response.code === 200))
        assert.equal((await request('/assets/css/app.css')).type, 'text/css')
        for (const path of ['/.git/config', '/.dev_docs/START_HERE.md', '/src/..%5c..%5c.git%5cconfig', '/tests/unit/server.test.cjs']) {
            assert.equal((await request(path)).code, 404, path)
        }
        assert.equal((await request('/%not-an-escape')).code, 400)
        assert.equal((await request('/src/%00')).code, 400)
        assert.equal((await request('/assets/%00.css')).code, 400)
        assert.equal((await request('/')).code, 200)
    } finally { await new Promise(resolve => server.close(resolve)) }
})
