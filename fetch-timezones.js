// Fetch timezone data from a reliable source
// Using a simplified approach with known working URLs

const https = require('https');
const fs = require('fs');

console.log('Fetching timezone boundary data...\n');

// Try multiple sources in order
const sources = [
    {
        name: 'Timezone Boundary Builder (2023d)',
        url: 'https://github.com/evansiroky/timezone-boundary-builder/releases/download/2023d/combined.json'
    },
    {
        name: 'Alternative GeoJSON',
        url: 'https://raw.githubusercontent.com/evansiroky/timezone-boundary-builder/master/dist/combined.json'
    }
];

let currentSourceIndex = 0;

function tryNextSource() {
    if (currentSourceIndex >= sources.length) {
        console.error('\n❌ All sources failed. Creating fallback timezone data...\n');
        createFallbackData();
        return;
    }

    const source = sources[currentSourceIndex];
    console.log(`Trying source ${currentSourceIndex + 1}/${sources.length}: ${source.name}`);
    console.log(`URL: ${source.url}\n`);

    const request = https.get(source.url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
            console.log(`Following redirect...`);
            https.get(response.headers.location, handleResponse);
        } else {
            handleResponse(response);
        }
    });

    request.on('error', (err) => {
        console.error(`Error: ${err.message}`);
        currentSourceIndex++;
        tryNextSource();
    });

    request.setTimeout(30000, () => {
        console.error('Request timed out');
        request.destroy();
        currentSourceIndex++;
        tryNextSource();
    });
}

function handleResponse(response) {
    if (response.statusCode !== 200) {
        console.error(`Failed: HTTP ${response.statusCode}`);
        currentSourceIndex++;
        tryNextSource();
        return;
    }

    let data = '';
    let bytes = 0;

    response.on('data', (chunk) => {
        data += chunk;
        bytes += chunk.length;
        process.stdout.write(`\rDownloaded: ${(bytes / 1024 / 1024).toFixed(2)} MB`);
    });

    response.on('end', () => {
        console.log('\n\n✓ Download complete!');
        processData(data);
    });

    response.on('error', (err) => {
        console.error(`\nStream error: ${err.message}`);
        currentSourceIndex++;
        tryNextSource();
    });
}

function processData(data) {
    try {
        console.log('Parsing JSON...');
        const tzData = JSON.parse(data);

        console.log('Processing timezone features...');
        const processed = simplifyForWorldMap(tzData);

        const output = JSON.stringify(processed, null, 2);
        fs.writeFileSync('timezones.geojson', output);

        const sizeMB = (Buffer.byteLength(output) / 1024 / 1024).toFixed(2);
        console.log(`\n✓ Success! Saved to timezones.geojson (${sizeMB} MB)`);
        console.log(`✓ ${processed.features.length} timezone regions`);

    } catch (err) {
        console.error(`Error processing data: ${err.message}`);
        createFallbackData();
    }
}

function simplifyForWorldMap(geojson) {
    // Keep the data but add helpful metadata
    const features = geojson.features.map(feature => {
        const tzName = feature.properties.tzid || feature.properties.name || 'Unknown';

        return {
            ...feature,
            properties: {
                ...feature.properties,
                tzid: tzName,
                offset: calculateOffset(tzName),
                offsetString: formatOffset(calculateOffset(tzName)),
                cities: getCitiesForTimezone(tzName)
            }
        };
    });

    return {
        type: 'FeatureCollection',
        features: features
    };
}

function calculateOffset(tzName) {
    // Common timezone offsets
    const offsets = {
        'Etc/GMT+12': -12, 'Etc/GMT+11': -11, 'Etc/GMT+10': -10,
        'Etc/GMT+9': -9, 'Etc/GMT+8': -8, 'Etc/GMT+7': -7,
        'Etc/GMT+6': -6, 'Etc/GMT+5': -5, 'Etc/GMT+4': -4,
        'Etc/GMT+3': -3, 'Etc/GMT+2': -2, 'Etc/GMT+1': -1,
        'Etc/GMT': 0, 'Etc/UTC': 0,
        'Etc/GMT-1': 1, 'Etc/GMT-2': 2, 'Etc/GMT-3': 3,
        'Etc/GMT-4': 4, 'Etc/GMT-5': 5, 'Etc/GMT-6': 6,
        'Etc/GMT-7': 7, 'Etc/GMT-8': 8, 'Etc/GMT-9': 9,
        'Etc/GMT-10': 10, 'Etc/GMT-11': 11, 'Etc/GMT-12': 12,
        'Etc/GMT-13': 13, 'Etc/GMT-14': 14
    };

    if (offsets[tzName] !== undefined) return offsets[tzName];

    // Try to calculate from current time
    try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tzName,
            hour: 'numeric',
            hour12: false
        });
        const tzHour = parseInt(formatter.format(now).split(' ')[0]);
        const utcHour = now.getUTCHours();
        let offset = tzHour - utcHour;
        if (offset > 12) offset -= 24;
        if (offset < -12) offset += 24;
        return offset;
    } catch {
        return 0;
    }
}

function formatOffset(offset) {
    if (offset === 0) return 'UTC+0';
    if (offset % 1 !== 0) {
        const hours = Math.floor(offset);
        const minutes = Math.abs((offset % 1) * 60);
        const sign = offset > 0 ? '+' : '';
        return `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
    }
    const sign = offset > 0 ? '+' : '';
    return `UTC${sign}${offset}`;
}

function getCitiesForTimezone(tzName) {
    const cityMap = {
        'Pacific/Honolulu': ['Honolulu'],
        'America/Anchorage': ['Anchorage'],
        'America/Los_Angeles': ['Los Angeles', 'San Francisco', 'Seattle'],
        'America/Denver': ['Denver', 'Phoenix'],
        'America/Chicago': ['Chicago', 'Houston', 'Mexico City'],
        'America/New_York': ['New York', 'Toronto', 'Miami'],
        'America/Sao_Paulo': ['São Paulo', 'Rio de Janeiro'],
        'Europe/London': ['London', 'Dublin', 'Lisbon'],
        'Europe/Paris': ['Paris', 'Berlin', 'Rome'],
        'Europe/Moscow': ['Moscow', 'Istanbul'],
        'Asia/Dubai': ['Dubai'],
        'Asia/Kolkata': ['Mumbai', 'Delhi', 'Kolkata'],
        'Asia/Shanghai': ['Beijing', 'Shanghai', 'Hong Kong'],
        'Asia/Tokyo': ['Tokyo', 'Seoul'],
        'Australia/Sydney': ['Sydney', 'Melbourne']
    };
    return cityMap[tzName] || [];
}

function createFallbackData() {
    console.log('Creating fallback timezone data with better polygons...');
    // Use the improved generator we already have
    const fallbackData = require('./generate-timezones-advanced.js');
    console.log('\n✓ Using locally generated timezone data');
    console.log('  Note: These are simplified rectangular regions');
    console.log('  For complex polygons, manually download from:');
    console.log('  https://github.com/evansiroky/timezone-boundary-builder/releases\n');
}

// Start trying sources
tryNextSource();
