const fs = require('fs')

const proj4 = require('proj4')


// read 0301Elveg2.0.SOSfrom current dir

const data = fs.readFileSync('0301Elveg2.0.SOS', 'utf8')

const lines = data.trim().split('\n')

// Initialize the list for coordinates
const curves = []

let currentCurve = null

// Set up the transformer from UTM 33N to WGS84
const euref89Utm33 = '+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs'
const wgs84 = proj4.WGS84

// Registrer projeksjonene
proj4.defs('EUREF89/UTM33N', euref89Utm33)
proj4.defs('WGS84', wgs84)

// Utfør transformasjonen

// Iterate through the lines and extract coordinates
for (const line of lines) {
    const trimmedLine = line.trim()
    if (trimmedLine.startsWith('.KURVE')) {
        if (currentCurve) {
            curves.push(currentCurve)
        }
        currentCurve = {
            typeveg: '',
            coordinates: [],
        }
        const parts = trimmedLine.split(' ')
        currentCurve.kurvenummer = parts[1]
    } else if (trimmedLine.startsWith('..OBJTYPE')) {
        const parts = trimmedLine.split(' ')
        currentCurve.objtype = parts[1]
    } else if (trimmedLine.startsWith('..TYPEVEG')) {
        const parts = trimmedLine.split(' ')
        parts.shift()
        currentCurve.typeveg = parts.join(' ')
    } else if (trimmedLine.startsWith('...SIDEVEG')) {
        const parts = trimmedLine.split(' ')
        parts.shift()
        currentCurve.sideveg = parts.join(' ') === "JA"
    } else if (trimmedLine.startsWith('...ADRESSENAVN')) {
        const parts = trimmedLine.split(' ')
        parts.shift()
        let adressenavn = parts.join(' ')
        // if starts and ends with ", remove them
        if (adressenavn.startsWith('"') && adressenavn.endsWith('"')) {
            adressenavn = adressenavn.substring(1, adressenavn.length - 1)
        }
        if (adressenavn) {
            currentCurve.adressenavn = adressenavn
        }
    } else if (trimmedLine.startsWith('..NØH')) {
        // Skip, next lines will contain coordinates
    } else if (currentCurve && trimmedLine.match(/^\d+ \d+ \d+$/)) {
        const parts = trimmedLine.split(/\s+/)
        let lat = parseFloat(parts[0])
        let lon = parseFloat(parts[1])

        currentCurve.coordinates.push({lat: lat, lon: lon})
    }
}

// Add the last curve
if (currentCurve) {
    curves.push(currentCurve)
}
console.log('mapper koordinater')
curves.map((curve) => {
    curve.coordinates = curve.coordinates
        .filter((coord) => coord.lat !== Infinity)
        .map((coord) => {
            const transformedCoordinates = proj4(euref89Utm33, wgs84, [coord.lon / 100, coord.lat / 100])
            return [transformedCoordinates[1], transformedCoordinates[0]]
        })
})

console.log('skriver til fil')
// write curves to file with timestamp
const date = new Date()
const timestamp = date.getTime()

const ut = curves
    .filter((c) => c.objtype === 'Veglenke')
    .filter((c) => c.sideveg === false)
    .filter((c) => c.typeveg !== 'rundkjøring')
    .filter((c) => c.typeveg !== 'gangfelt')
    .filter((c) => c.typeveg !== 'rampe')
    .filter((c) => c.typeveg !== 'trapp')
    .map((track) => {
        const {coordinates} = track
        const filteredCoordinates = coordinates.filter((_, i) => i % 2 === 0)

        // Sjekk om siste koordinat mangler og legg det til om nødvendig
        if (coordinates.length % 2 === 0) {
            filteredCoordinates.push(coordinates[coordinates.length - 1])
        }

        track.coordinates = filteredCoordinates
        delete track.objtype
        return track
    })

const json = JSON.stringify(ut, null, null)
// write file to output folder
fs.writeFileSync(`output/elveg-${timestamp}.json`, json)


console.log(`Wrote ${ut.length} veier to elveg-${timestamp}.json`)
