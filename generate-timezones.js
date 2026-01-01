// Generate simplified timezone GeoJSON data for world map visualization
// This creates timezone boundaries based on longitude with adjustments for major countries

function generateTimezones() {
    const timezones = [];

    // Define timezone configurations with their standard longitude ranges and major exceptions
    const tzConfig = [
        { offset: -12, name: 'UTC-12', cities: ['Baker Island'], range: [-180, -172.5] },
        { offset: -11, name: 'Pacific/Samoa', cities: ['Pago Pago'], range: [-172.5, -165] },
        { offset: -10, name: 'Pacific/Honolulu', cities: ['Honolulu'], range: [-165, -150] },
        { offset: -9, name: 'America/Anchorage', cities: ['Anchorage'], range: [-157.5, -142.5] },
        { offset: -8, name: 'America/Los_Angeles', cities: ['Los Angeles', 'San Francisco', 'Seattle', 'Vancouver'], range: [-142.5, -127.5] },
        { offset: -7, name: 'America/Denver', cities: ['Denver', 'Phoenix', 'Calgary'], range: [-127.5, -112.5] },
        { offset: -6, name: 'America/Chicago', cities: ['Chicago', 'Houston', 'Mexico City', 'Dallas'], range: [-112.5, -97.5] },
        { offset: -5, name: 'America/New_York', cities: ['New York', 'Toronto', 'Miami', 'Lima', 'Bogotá'], range: [-97.5, -82.5] },
        { offset: -4, name: 'America/Santiago', cities: ['Santiago', 'Caracas', 'La Paz', 'Halifax'], range: [-82.5, -60] },
        { offset: -3, name: 'America/Sao_Paulo', cities: ['São Paulo', 'Buenos Aires', 'Rio de Janeiro'], range: [-60, -45] },
        { offset: -2, name: 'Atlantic/South_Georgia', cities: ['South Georgia'], range: [-45, -30] },
        { offset: -1, name: 'Atlantic/Azores', cities: ['Azores', 'Cape Verde'], range: [-30, -15] },
        { offset: 0, name: 'Europe/London', cities: ['London', 'Dublin', 'Lisbon', 'Accra'], range: [-15, 7.5] },
        { offset: 1, name: 'Europe/Paris', cities: ['Paris', 'Berlin', 'Rome', 'Madrid', 'Lagos'], range: [7.5, 22.5] },
        { offset: 2, name: 'Europe/Athens', cities: ['Athens', 'Cairo', 'Johannesburg', 'Helsinki'], range: [22.5, 37.5] },
        { offset: 3, name: 'Europe/Moscow', cities: ['Moscow', 'Istanbul', 'Riyadh', 'Nairobi'], range: [37.5, 52.5] },
        { offset: 4, name: 'Asia/Dubai', cities: ['Dubai', 'Baku', 'Tbilisi'], range: [52.5, 63.75] },
        { offset: 5, name: 'Asia/Karachi', cities: ['Karachi', 'Tashkent'], range: [63.75, 71.25] },
        { offset: 5.5, name: 'Asia/Kolkata', cities: ['Mumbai', 'Delhi', 'Kolkata', 'Bangalore'], range: [71.25, 78.75] },
        { offset: 6, name: 'Asia/Dhaka', cities: ['Dhaka', 'Almaty'], range: [78.75, 97.5] },
        { offset: 7, name: 'Asia/Bangkok', cities: ['Bangkok', 'Jakarta', 'Ho Chi Minh'], range: [97.5, 112.5] },
        { offset: 8, name: 'Asia/Shanghai', cities: ['Beijing', 'Shanghai', 'Hong Kong', 'Singapore', 'Perth'], range: [112.5, 127.5] },
        { offset: 9, name: 'Asia/Tokyo', cities: ['Tokyo', 'Seoul', 'Osaka'], range: [127.5, 142.5] },
        { offset: 10, name: 'Australia/Sydney', cities: ['Sydney', 'Melbourne', 'Brisbane'], range: [142.5, 157.5] },
        { offset: 11, name: 'Pacific/Noumea', cities: ['Noumea', 'Solomon Islands'], range: [157.5, 172.5] },
        { offset: 12, name: 'Pacific/Auckland', cities: ['Auckland', 'Fiji'], range: [172.5, 180] },
    ];

    // Generate a feature for each timezone
    tzConfig.forEach(tz => {
        const [minLon, maxLon] = tz.range;

        // Create a simple polygon for this timezone
        const polygon = {
            type: 'Feature',
            properties: {
                offset: tz.offset,
                offsetString: formatOffset(tz.offset),
                name: tz.name,
                cities: tz.cities
            },
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [minLon, -90],
                    [maxLon, -90],
                    [maxLon, 90],
                    [minLon, 90],
                    [minLon, -90]
                ]]
            }
        };

        timezones.push(polygon);
    });

    return {
        type: 'FeatureCollection',
        features: timezones
    };
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

// Generate and output the GeoJSON
const tzData = generateTimezones();
console.log(JSON.stringify(tzData, null, 2));
