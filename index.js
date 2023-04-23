
const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const http = require('http').Server(app)

const fs = require('fs')
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const dayjs = require('dayjs')
const customParseFormat = require('dayjs/plugin/customParseFormat')
dayjs.extend(customParseFormat)

const port = process.env.PORT || 3000
const data_folder = 'data'

if(!fs.existsSync(data_folder)) {
    fs.mkdirSync(data_folder, { recursive: true })
}
const all_db = low(new FileSync(`data/all.json`))
all_db.defaults([])

app.set('view engine', 'html')
app.use(express.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static('public'))

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/page/index.html')
})

app.post('/api/music', (req, res) => {
    const { date, music_name, music_artist, youtube_id, sender_name, sender_message } = req.body

    if(!date || !music_name || !music_artist || !youtube_id) {
        return res.status(400).json({ error: 'Missing params.' })
    }

    if(!dayjs(date, 'YYYY-MM-DD', true).isValid()) {
        return res.status(400).json({ error: 'Invalid date.' })
    }

    const parsed_date = dayjs(date, 'YYYY-MM-DD')

    const year = parsed_date.format('YYYY')
    const month = parsed_date.format('MM')
    const day = parsed_date.format('DD')

    const filePath = `${data_folder}/${year}/${parseInt(month)}.json`
    if(!fs.existsSync(`${data_folder}/${year}`)) {
        fs.mkdirSync(`${data_folder}/${year}`, { recursive: true })
    }

    const month_db = low(new FileSync(filePath))
    month_db.defaults({})

    if(month_db.get(date).value()) {
        return res.status(400).json({ error: 'Music already added on this date.', needNewDate: true })
    }

    const music = {
        name: music_name,
        artist: music_artist,
        youtube_id: youtube_id,
        sender: {
            name: sender_name || null,
            message: sender_message || null
        }
    }

    month_db.set(date, music).write()

    all_db.push(music).write()

    return res.status(200).json({ message: 'Music added.', nextDate: parsed_date.add(1, 'days').format('YYYY-MM-DD') })
})

app.post('/api/find_available_date', (req, res) => {
    const years_raw = fs.readdirSync(data_folder)
    const years = years_raw.filter(folder => !isNaN(folder))
    const last_year = Math.max(...years)

    const months_raw = fs.readdirSync(`${data_folder}/${last_year}`)
    const parsed_months = months_raw.map(month => month.replace('.json', ''))
    const months = parsed_months.filter(folder => !isNaN(folder))
    const last_month = Math.max(...months)

    const last_month_db = low(new FileSync(`${data_folder}/${last_year}/${last_month}.json`))
    last_month_db.defaults({})
    const last_month_value = last_month_db.value()
    const last_date = Object.keys(last_month_value).sort().pop()

    return res.status(200).json({ nextAvailableDate: dayjs(last_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD') })
})

app.post('/api/find_music_name', (req, res) => {
    const { music_name } = req.body

    if(!music_name) {
        return res.status(400).json({ error: 'Missing params.' })
    }

    const music = all_db.find({ name: music_name }).value()

    if(!music) {
        return res.status(400).json({ error: 'Music not found.' })
    }

    return res.status(200).json({ music: music })
})

app.post('/api/find_music_id', (req, res) => {
    const { youtube_id } = req.body

    if(!youtube_id) {
        return res.status(400).json({ error: 'Missing params.' })
    }

    const music = all_db.find({ youtube_id: youtube_id }).value()

    if(!music) {
        return res.status(400).json({ error: 'Music not found.' })
    }

    return res.status(200).json({ music: music })
})

http.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`)
})
