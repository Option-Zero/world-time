// Convert Natural Earth shapefile to GeoJSON
const shapefile = require('shapefile');
const fs = require('fs');

console.log('Converting shapefile to GeoJSON...\n');

shapefile.read('ne_timezones/ne_10m_time_zones.shp', 'ne_timezones/ne_10m_time_zones.dbf')
    .then(geojson => {
        console.log(`✓ Read ${geojson.features.length} timezone features`);

        // Add metadata to each feature
        const processed = {
            type: 'FeatureCollection',
            features: geojson.features.map(feature => {
                const props = feature.properties;

                // Extract timezone info from properties
                const zoneName = props.time_zone || props.tz_name1st || props.name || 'Unknown';
                const offset = parseFloat(props.zone) || 0;

                return {
                    type: 'Feature',
                    properties: {
                        offset: offset,
                        offsetString: formatOffset(offset),
                        name: zoneName,
                        cities: getCitiesForOffset(offset),
                        ...props // Keep original properties
                    },
                    geometry: feature.geometry
                };
            })
        };

        // Save to file
        const output = JSON.stringify(processed, null, 2);
        fs.writeFileSync('timezones.geojson', output);

        const sizeMB = (Buffer.byteLength(output) / 1024 / 1024).toFixed(2);
        console.log(`✓ Saved to timezones.geojson (${sizeMB} MB)`);
        console.log(`✓ ${processed.features.length} timezone polygons ready!\n`);
        console.log('These are complex polygons that follow country boundaries.');
        console.log('Restart the server to see the improved timezone visualization.\n');
    })
    .catch(error => {
        console.error('Error converting shapefile:', error.message);
        console.log('\nTroubleshooting:');
        console.log('- Make sure ne_timezones/ directory exists');
        console.log('- Check that .shp and .dbf files are present');
        console.log('- Try running ./get-natural-earth-timezones.sh first\n');
    });

function formatOffset(offset) {
    if (offset === 0) return 'UTC+0';

    // Handle fractional offsets
    if (offset % 1 !== 0) {
        const hours = Math.floor(offset);
        const minutes = Math.abs((offset % 1) * 60);
        const sign = offset > 0 ? '+' : '';
        return `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
    }

    const sign = offset > 0 ? '+' : '';
    return `UTC${sign}${offset}`;
}

function getCitiesForOffset(offset) {
    const cityMap = {
        '-12': ['Baker Island'],
        '-11': ['Pago Pago'],
        '-10': ['Honolulu'],
        '-9': ['Anchorage'],
        '-8': ['Los Angeles', 'San Francisco', 'Seattle'],
        '-7': ['Denver', 'Phoenix'],
        '-6': ['Chicago', 'Houston', 'Mexico City'],
        '-5': ['New York', 'Toronto', 'Miami', 'Lima'],
        '-4': ['Santiago', 'Halifax'],
        '-3': ['São Paulo', 'Buenos Aires', 'Rio de Janeiro'],
        '-2': ['South Georgia'],
        '-1': ['Azores', 'Cape Verde'],
        '0': ['London', 'Dublin', 'Lisbon', 'Accra'],
        '1': ['Paris', 'Berlin', 'Rome', 'Madrid'],
        '2': ['Athens', 'Cairo', 'Johannesburg'],
        '3': ['Moscow', 'Istanbul', 'Riyadh', 'Nairobi'],
        '4': ['Dubai', 'Baku'],
        '5': ['Karachi', 'Tashkent'],
        '5.5': ['Mumbai', 'Delhi', 'Kolkata', 'Bangalore'],
        '6': ['Dhaka', 'Almaty'],
        '7': ['Bangkok', 'Jakarta'],
        '8': ['Beijing', 'Shanghai', 'Hong Kong', 'Singapore'],
        '9': ['Tokyo', 'Seoul'],
        '10': ['Sydney', 'Melbourne', 'Brisbane'],
        '11': ['Noumea'],
        '12': ['Auckland', 'Fiji'],
        '13': ['Nuku\'alofa']
    };

    return cityMap[offset.toString()] || [];
}
