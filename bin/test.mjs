import { createCanvas, loadImage } from 'canvas'
import express from 'express'
// const { createCanvas, loadImage } = require('canvas')
// const { express } = require('express')
console.time('app')

const app = express()
// const port = 3000
// 自定义跨域中间件
const allowCors = function (req, res, next) {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
};
app.use(allowCors);// 使用跨域中间件

app.use(express.static('public'))
class TileUtil {
  constructor() {
    this.TILE_ORIGIN = 20037508.34 // 切片原点
    this.TILE_SIZE = 256; // 切片大小
    this.canvas = createCanvas(this.TILE_SIZE, this.TILE_SIZE)
    this.ctx = this.canvas.getContext('2d')
  }

  // 根据缩放级别计算分辨率
  getResolution(z) {
    return (this.TILE_ORIGIN * 2) / (Math.pow(2, z) * this.TILE_SIZE)
  }

  // 根据瓦片坐标获取切片经纬度坐标
  getTileExtent(z, x, y) {
    const res = this.getResolution(z)
    const minX = x * this.TILE_SIZE * res - this.TILE_ORIGIN
    const maxX = (x + 1) * this.TILE_SIZE * res - this.TILE_ORIGIN
    const minY = this.TILE_ORIGIN - (y + 1) * this.TILE_SIZE * res
    const maxY = this.TILE_ORIGIN - y * this.TILE_SIZE * res
    return [minX, minY, maxX, maxY]
  }

  // 将地理坐标转换为屏幕坐标
  toScreen(x, y) {
    const res16 = this.getResolution(16)
    return [
      (x + this.TILE_ORIGIN) / res16,
      (this.TILE_ORIGIN - y) / res16
    ]
  }

  // 获取切片图片，如果z大于16，则取16级的切片进行切割；否则直接返回
  getTileData(z, x, y) {
    return new Promise(resolve => {
      let url = '', extent = [], xy16 = []
      if(z > 16 ) {
        extent = this.getTileExtent(z, x, y)
        const [minX, minY, maxX, maxY] = extent
        // 获取16级对应的索引
        xy16 = this.getTileIndexByCoords((minX + maxX) / 2, (minY + maxY) / 2)
        const [x16, y16] = xy16
        // url = `https://webrd01.is.autonavi.com/appmaptile?style=8&lang=zh_cn&size=1&scale=1&x=${x16}&y=${y16}&z=16`
        url = `https://wprd01.is.autonavi.com/appmaptile?x=${x16}&y=${y16}&z=16&lang=zh_cn&size=1&scl=2&style=6`
      } else {
        // url = `https://webrd01.is.autonavi.com/appmaptile?style=8&lang=zh_cn&size=1&scale=1&x=${x}&y=${y}&z=${z}`
        url = `https://wprd01.is.autonavi.com/appmaptile?x=${x}&y=${y}&z=${z}&lang=zh_cn&size=1&scl=2&style=6`
      }
      loadImage(url).then(image => {
        this.ctx.clearRect(0, 0, this.TILE_SIZE, this.TILE_SIZE)
        if(z > 16) {
          // 当前等级切片的范围
          const [minX, minY, maxX, maxY] = extent
          const [x16, y16] = xy16
          // 对应16级切片的范围
          const [minX16, minY16, maxX16, maxY16] = this.getTileExtent(16, x16, y16)
          const [scrx16, scry16] = this.toScreen(minX16, maxY16)
          const [scrxmin, scrymin] = this.toScreen(minX, maxY)
          const [scrxmax, scrymax] = this.toScreen(maxX, minY)
          const scrx = Math.round(scrxmin - scrx16),
            scry = Math.round(scrymin - scry16)
          const width = Math.round(scrxmax - scrx16 - scrx),
            height = Math.round(scrymax - scry16 - scry)
          this.ctx.drawImage(image, scrx, scry, width, height, 0, 0, this.TILE_SIZE, this.TILE_SIZE)
        } else {
          this.ctx.drawImage(image, 0, 0, this.TILE_SIZE, this.TILE_SIZE)
        }
        resolve(this.canvas.toBuffer('image/png'))
      })
    })
  }

  // 根据坐标获取切片索引
  getTileIndexByCoords(x, y) {
    const res16 = this.getResolution(16) * this.TILE_SIZE
    return [
      Math.floor((x + this.TILE_ORIGIN) / res16),
      Math.floor((this.TILE_ORIGIN - y) / res16)
    ]
  }
}

const util = new TileUtil()

app.get('/tile/:z/:x/:y', (req, res) => {
  const { z, x, y } = req.params
  util.getTileData(Number(z), Number(x), Number(y)).then(data => {
    // console.log(data)
    res.setHeader('Expires', new Date(Date.now() + 30 * 1000).toUTCString())
    res.writeHead(200, {
      "Content-Type": "image/png",
    });
    res.end(data);
  })
})

app.get('/tile-bbox/:z/:x/:y', (req, res) => {
  const { z, x, y } = req.params
  const TILE_SIZE = 256;
  const canvas = createCanvas(TILE_SIZE, TILE_SIZE)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f00'
  ctx.strokeStyle = '#f00'
  ctx.lineWidth = 2
  ctx.textAlign = "center";
  ctx.textBaseline = "middle"
  ctx.font = "bold 16px 微软雅黑";
  ctx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE)
  ctx.fillText(`${z}-${x}-${y}`, TILE_SIZE / 2, TILE_SIZE / 2)
  res.setHeader('Expires', new Date(Date.now() + 30 * 1000).toUTCString())
  res.writeHead(200, {
    "Content-Type": "image/png",
  });
  res.end(canvas.toBuffer('image/png'));
})
app.get('/', (req, res) => {
  res.send('这是地图切片服务器！')
})

app.listen(3000, () => {
  console.timeEnd('app')
  console.log('express server running at http://127.0.0.1:3000')
})
