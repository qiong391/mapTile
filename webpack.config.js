const path = require('path')
const webpack = require('webpack')
// import { fileURLToPath } from 'url'
// const __filenameNew = fileURLToPath(import.meta.url)
// const __dirnameNew = path.dirname(__filenameNew)

module.exports = {
    entry: './app.js',
    target:"node",
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
    },
};
