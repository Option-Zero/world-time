// Download real timezone boundary data
// Using timezone-boundary-builder project data

const https = require('https');
const fs = require('fs');

console.log('Downloading real timezone boundary data...\n');
console.log('This will take a moment as the file is large (~23MB compressed)\n');

// Using the combined-with-oceans version which includes ocean territories
// This is a simplified version that's good for world-scale visualization
const url = 'https://github.com/evansiroky/timezone-boundary-builder/releases/download/2024b/timezones-with-oceans.geojson.zip';

// For now, let's use a CDN that hosts the uncompressed version
// This is the combined.json which has all timezones merged by offset
const jsonUrl = 'https://raw.githubusercontent.com/evansiroky/timezone-boundary-builder/master/dist/2024b/combined.json';

console.log('Fetching from:', jsonUrl);
console.log('');

https.get(jsonUrl, (response) => {
    if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        https.get(response.headers.location, processResponse);
    } else {
        processResponse(response);
    }
}).on('error', (err) => {
    console.error('Error downloading timezone data:', err.message);
    console.log('\nFalling back to manual download instructions:');
    console.log('1. Visit: https://github.com/evansiroky/timezone-boundary-builder/releases');
    console.log('2. Download the latest "timezones-with-oceans.geojson.zip"');
    console.log('3. Extract and rename to timezones-real.geojson');
    process.exit(1);
});

function processResponse(response) {
    if (response.statusCode !== 200) {
        console.error(`Failed to download: HTTP ${response.statusCode}`);
        return;
    }

    let data = '';
    let downloadedBytes = 0;

    response.on('data', (chunk) => {
        data += chunk;
        downloadedBytes += chunk.length;
        process.stdout.write(`\rDownloaded: ${(downloadedBytes / 1024 / 1024).toFixed(2)} MB`);
    });

    response.on('end', () => {
        console.log('\n\nProcessing timezone data...');

        try {
            const tzData = JSON.parse(data);
            console.log(`✓ Loaded ${tzData.features ? tzData.features.length : 'unknown'} timezone features`);

            // Group by UTC offset and add metadata
            const processed = processTimezoneData(tzData);

            fs.writeFileSync('timezones-real.geojson', JSON.stringify(processed, null, 2));
            console.log('✓ Saved to timezones-real.geojson');
            console.log(`\nTimezone data ready! File size: ${(fs.statSync('timezones-real.geojson').size / 1024 / 1024).toFixed(2)} MB`);

        } catch (err) {
            console.error('Error processing data:', err.message);
            // Save raw data anyway
            fs.writeFileSync('timezones-raw.json', data);
            console.log('Saved raw data to timezones-raw.json for manual inspection');
        }
    });
}

function processTimezoneData(geojson) {
    console.log('Processing and grouping timezones by UTC offset...');

    // City mappings for major timezones
    const cityMap = {
        'Etc/GMT+12': ['Baker Island'],
        'Pacific/Samoa': ['Pago Pago'],
        'Pacific/Honolulu': ['Honolulu'],
        'America/Anchorage': ['Anchorage'],
        'America/Los_Angeles': ['Los Angeles', 'San Francisco', 'Seattle'],
        'America/Denver': ['Denver', 'Phoenix'],
        'America/Chicago': ['Chicago', 'Houston', 'Mexico City'],
        'America/New_York': ['New York', 'Toronto', 'Miami'],
        'America/Santiago': ['Santiago'],
        'America/Sao_Paulo': ['São Paulo', 'Rio de Janeiro'],
        'Atlantic/South_Georgia': ['South Georgia'],
        'Atlantic/Azores': ['Azores'],
        'Europe/London': ['London', 'Dublin', 'Lisbon'],
        'Europe/Paris': ['Paris', 'Berlin', 'Rome', 'Madrid'],
        'Europe/Athens': ['Athens', 'Cairo', 'Johannesburg'],
        'Europe/Moscow': ['Moscow', 'Istanbul', 'Nairobi'],
        'Asia/Dubai': ['Dubai', 'Baku'],
        'Asia/Karachi': ['Karachi'],
        'Asia/Kolkata': ['Mumbai', 'Delhi', 'Kolkata'],
        'Asia/Dhaka': ['Dhaka'],
        'Asia/Bangkok': ['Bangkok', 'Jakarta'],
        'Asia/Shanghai': ['Beijing', 'Shanghai', 'Hong Kong', 'Singapore'],
        'Asia/Tokyo': ['Tokyo', 'Seoul'],
        'Australia/Sydney': ['Sydney', 'Melbourne'],
        'Pacific/Noumea': ['Noumea'],
        'Pacific/Auckland': ['Auckland']
    };

    // Calculate UTC offset from timezone name
    function getOffset(tzName) {
        try {
            const now = new Date();
            const tzDate = new Date(now.toLocaleString('en-US', { timeZone: tzName }));
            const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
            const offset = (tzDate - utcDate) / (1000 * 60 * 60);
            return Math.round(offset * 2) / 2; // Round to nearest 0.5
        } catch (e) {
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

    // Process features and add metadata
    const features = geojson.features.map(feature => {
        const tzName = feature.properties.tzid || feature.properties.tz_name1st || 'Unknown';
        const offset = getOffset(tzName);

        return {
            type: 'Feature',
            properties: {
                offset: offset,
                offsetString: formatOffset(offset),
                name: tzName,
                cities: cityMap[tzName] || []
            },
            geometry: feature.geometry
        };
    });

    console.log(`✓ Processed ${features.length} timezone features`);

    return {
        type: 'FeatureCollection',
        features: features
    };
}
