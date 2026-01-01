// World Time Zone Map Application

class TimeZoneMap {
    constructor() {
        this.svg = d3.select('#world-map');
        this.width = 1200;
        this.height = 600;
        this.pinnedTimezones = new Set();
        this.highlightedTz = null;

        this.projection = d3.geoNaturalEarth1()
            .scale(190)
            .translate([this.width / 2, this.height / 2]);

        this.path = d3.geoPath().projection(this.projection);

        this.init();
    }

    async init() {
        this.setupSVG();
        await this.loadData();
        this.render();
        this.startTimeClock();
    }

    setupSVG() {
        this.svg
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        // Add groups for layering
        this.svg.append('g').attr('class', 'countries-group');
        this.svg.append('g').attr('class', 'timezones-group');
        this.svg.append('g').attr('class', 'labels-group');
    }

    async loadData() {
        // Load world map data from Natural Earth
        const worldData = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        this.countries = topojson.feature(worldData, worldData.objects.countries);

        // Create simplified timezone data
        this.timezones = this.createTimezoneData();
    }

    createTimezoneData() {
        // Create timezone definitions with metadata
        const timezones = [
            { offset: -12, cities: ['Baker Island'], names: ['UTC-12'] },
            { offset: -11, cities: ['Pago Pago'], names: ['Pacific/Samoa'] },
            { offset: -10, cities: ['Honolulu'], names: ['Pacific/Honolulu'] },
            { offset: -9, cities: ['Anchorage'], names: ['America/Anchorage'] },
            { offset: -8, cities: ['Los Angeles', 'San Francisco', 'Seattle', 'Vancouver'], names: ['America/Los_Angeles'] },
            { offset: -7, cities: ['Denver', 'Phoenix', 'Calgary'], names: ['America/Denver'] },
            { offset: -6, cities: ['Chicago', 'Houston', 'Mexico City', 'Dallas'], names: ['America/Chicago'] },
            { offset: -5, cities: ['New York', 'Toronto', 'Miami', 'Lima', 'Bogotá'], names: ['America/New_York'] },
            { offset: -4, cities: ['Santiago', 'Caracas', 'La Paz', 'Halifax'], names: ['America/Santiago'] },
            { offset: -3, cities: ['São Paulo', 'Buenos Aires', 'Rio de Janeiro'], names: ['America/Sao_Paulo'] },
            { offset: -2, cities: ['South Georgia'], names: ['Atlantic/South_Georgia'] },
            { offset: -1, cities: ['Azores', 'Cape Verde'], names: ['Atlantic/Azores'] },
            { offset: 0, cities: ['London', 'Dublin', 'Lisbon', 'Accra'], names: ['Europe/London', 'UTC'] },
            { offset: 1, cities: ['Paris', 'Berlin', 'Rome', 'Madrid', 'Lagos'], names: ['Europe/Paris'] },
            { offset: 2, cities: ['Athens', 'Cairo', 'Johannesburg', 'Helsinki'], names: ['Europe/Athens'] },
            { offset: 3, cities: ['Moscow', 'Istanbul', 'Riyadh', 'Nairobi'], names: ['Europe/Moscow'] },
            { offset: 4, cities: ['Dubai', 'Baku', 'Tbilisi'], names: ['Asia/Dubai'] },
            { offset: 5, cities: ['Karachi', 'Tashkent'], names: ['Asia/Karachi'] },
            { offset: 5.5, cities: ['Mumbai', 'Delhi', 'Kolkata', 'Bangalore'], names: ['Asia/Kolkata'] },
            { offset: 6, cities: ['Dhaka', 'Almaty'], names: ['Asia/Dhaka'] },
            { offset: 7, cities: ['Bangkok', 'Jakarta', 'Ho Chi Minh'], names: ['Asia/Bangkok'] },
            { offset: 8, cities: ['Beijing', 'Shanghai', 'Hong Kong', 'Singapore', 'Perth'], names: ['Asia/Shanghai'] },
            { offset: 9, cities: ['Tokyo', 'Seoul', 'Osaka'], names: ['Asia/Tokyo'] },
            { offset: 10, cities: ['Sydney', 'Melbourne', 'Brisbane'], names: ['Australia/Sydney'] },
            { offset: 11, cities: ['Noumea', 'Solomon Islands'], names: ['Pacific/Noumea'] },
            { offset: 12, cities: ['Auckland', 'Fiji'], names: ['Pacific/Auckland'] },
            { offset: 13, cities: ['Nuku\'alofa'], names: ['Pacific/Tongatapu'] }
        ];

        // Generate polygon geometries for each timezone
        return timezones.map(tz => {
            const geometry = this.createTimezonePolygon(tz.offset);
            return {
                ...tz,
                offsetString: this.formatOffset(tz.offset),
                geometry: geometry
            };
        });
    }

    createTimezonePolygon(offset) {
        // Create a simplified polygon for this timezone based on longitude
        // Each timezone is roughly 15 degrees wide (360° / 24 hours)

        const centerLon = offset * 15;
        const halfWidth = 7.5;

        // Create a polygon that covers the timezone band
        const coordinates = [[
            [centerLon - halfWidth, -90],
            [centerLon + halfWidth, -90],
            [centerLon + halfWidth, 90],
            [centerLon - halfWidth, 90],
            [centerLon - halfWidth, -90]
        ]];

        return {
            type: 'Polygon',
            coordinates: coordinates
        };
    }

    formatOffset(offset) {
        if (offset === 0) return 'UTC+0';

        // Handle fractional offsets (like India's +5:30)
        if (offset % 1 !== 0) {
            const hours = Math.floor(offset);
            const minutes = Math.abs((offset % 1) * 60);
            const sign = offset > 0 ? '+' : '';
            return `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
        }

        const sign = offset > 0 ? '+' : '';
        return `UTC${sign}${offset}`;
    }

    render() {
        this.renderCountries();
        this.renderTimezones();
        this.renderLabels();
    }

    renderCountries() {
        const countriesGroup = this.svg.select('.countries-group');

        countriesGroup.selectAll('path')
            .data(this.countries.features)
            .join('path')
            .attr('class', 'country')
            .attr('d', this.path);
    }

    renderTimezones() {
        const timezonesGroup = this.svg.select('.timezones-group');

        timezonesGroup.selectAll('path')
            .data(this.timezones)
            .join('path')
            .attr('class', 'timezone')
            .attr('d', d => this.path({ type: 'Feature', geometry: d.geometry }))
            .attr('data-offset', d => d.offset)
            .on('mouseover', (event, d) => this.handleTimezoneHover(d))
            .on('mouseout', () => this.handleTimezoneLeave())
            .on('click', (event, d) => this.handleTimezoneClick(d));
    }

    renderLabels() {
        const labelsGroup = this.svg.select('.labels-group');
        const labelY = this.height - 40; // Position labels near bottom

        this.timezones.forEach(tz => {
            // Calculate label position at bottom of each timezone
            const centerLon = tz.offset * 15;
            const labelPos = this.projection([centerLon, -60]); // Position in southern latitudes

            if (labelPos && labelPos[0] >= 0 && labelPos[0] <= this.width) {
                const labelGroup = labelsGroup.append('g')
                    .attr('class', 'timezone-label')
                    .attr('data-offset', tz.offset)
                    .attr('transform', `translate(${labelPos[0]}, ${labelY})`);

                // Add background rectangle for better readability
                const offsetText = labelGroup.append('text')
                    .attr('class', 'offset')
                    .attr('dy', '-0.5em')
                    .text(tz.offsetString);

                const timeText = labelGroup.append('text')
                    .attr('class', 'time')
                    .attr('dy', '1em')
                    .attr('id', `time-label-${tz.offset.toString().replace('.', '_')}`)
                    .text(this.getCurrentTime(tz.offset));
            }
        });
    }

    getCurrentTime(offset) {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const tzTime = new Date(utc + (3600000 * offset));

        return tzTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    startTimeClock() {
        // Update all times every second
        setInterval(() => {
            this.updateAllTimes();
        }, 1000);
    }

    updateAllTimes() {
        // Update labels on map
        this.timezones.forEach(tz => {
            const labelId = `time-label-${tz.offset.toString().replace('.', '_')}`;
            const label = this.svg.select(`#${labelId}`);
            if (!label.empty()) {
                label.text(this.getCurrentTime(tz.offset));
            }
        });

        // Update panel times
        d3.selectAll('.time-display').each(function() {
            const offset = parseFloat(this.dataset.offset);
            const time = new Date();
            const utc = time.getTime() + (time.getTimezoneOffset() * 60000);
            const tzTime = new Date(utc + (3600000 * offset));

            this.textContent = tzTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
        });

        // Update relative time info in panels
        d3.selectAll('.time-info').each(function() {
            const offset = parseFloat(this.dataset.offset);
            const browserOffset = -new Date().getTimezoneOffset() / 60;
            const relativeOffset = offset - browserOffset;

            let relativeText;
            if (Math.abs(relativeOffset) < 0.1) {
                relativeText = 'Same as your timezone';
            } else if (relativeOffset > 0) {
                const hours = Math.floor(relativeOffset);
                const minutes = Math.round((relativeOffset % 1) * 60);
                relativeText = minutes > 0
                    ? `${hours}h ${minutes}m ahead of your timezone`
                    : `${hours} hours ahead of your timezone`;
            } else {
                const hours = Math.floor(Math.abs(relativeOffset));
                const minutes = Math.round((Math.abs(relativeOffset) % 1) * 60);
                relativeText = minutes > 0
                    ? `${hours}h ${minutes}m behind your timezone`
                    : `${hours} hours behind your timezone`;
            }

            this.textContent = relativeText;
        });
    }

    handleTimezoneHover(tz) {
        this.highlightedTz = tz.offset;
        this.updateHighlights();
    }

    handleTimezoneLeave() {
        this.highlightedTz = null;
        this.updateHighlights();
    }

    updateHighlights() {
        // Highlight timezone on map
        this.svg.selectAll('.timezone')
            .classed('highlighted', d => d.offset === this.highlightedTz);

        // Highlight corresponding panel
        const highlightedOffset = this.highlightedTz;
        d3.selectAll('.timezone-panel')
            .classed('highlighted', function() {
                return parseFloat(this.dataset.offset) === highlightedOffset;
            });
    }

    handleTimezoneClick(tz) {
        // Check if panel already exists
        const existingPanel = d3.select(`[data-offset="${tz.offset}"]`);
        if (!existingPanel.empty()) {
            // Panel exists, just highlight it briefly
            return;
        }

        this.createTimezonePanel(tz);
    }

    createTimezonePanel(tz) {
        const container = d3.select('#timezone-panels');
        const browserOffset = -new Date().getTimezoneOffset() / 60;
        const relativeOffset = tz.offset - browserOffset;

        let relativeText;
        if (Math.abs(relativeOffset) < 0.1) {
            relativeText = 'Same as your timezone';
        } else if (relativeOffset > 0) {
            const hours = Math.floor(relativeOffset);
            const minutes = Math.round((relativeOffset % 1) * 60);
            relativeText = minutes > 0
                ? `${hours}h ${minutes}m ahead of your timezone`
                : `${hours} hours ahead of your timezone`;
        } else {
            const hours = Math.floor(Math.abs(relativeOffset));
            const minutes = Math.round((Math.abs(relativeOffset) % 1) * 60);
            relativeText = minutes > 0
                ? `${hours}h ${minutes}m behind your timezone`
                : `${hours} hours behind your timezone`;
        }

        const panel = container.append('div')
            .attr('class', 'timezone-panel')
            .attr('data-offset', tz.offset)
            .on('mouseover', () => {
                this.highlightedTz = tz.offset;
                this.updateHighlights();
            })
            .on('mouseout', () => {
                this.highlightedTz = null;
                this.updateHighlights();
            });

        const header = panel.append('div')
            .attr('class', 'panel-header');

        header.append('div')
            .attr('class', 'panel-title')
            .text(tz.offsetString);

        const controls = header.append('div')
            .attr('class', 'panel-controls');

        const pinBtn = controls.append('button')
            .attr('class', 'pin-btn')
            .text('📌 Pin')
            .on('click', (event) => {
                event.stopPropagation();
                this.togglePin(tz.offset, pinBtn, panel);
            });

        controls.append('button')
            .attr('class', 'close-btn')
            .text('✕')
            .on('click', (event) => {
                event.stopPropagation();
                this.closePanel(tz.offset, panel);
            });

        const content = panel.append('div')
            .attr('class', 'panel-content');

        content.append('div')
            .attr('class', 'time-display')
            .attr('data-offset', tz.offset)
            .text(this.getCurrentTime(tz.offset));

        content.append('div')
            .attr('class', 'time-info')
            .attr('data-offset', tz.offset)
            .text(relativeText);

        if (tz.names && tz.names.length > 0) {
            content.append('div')
                .style('margin-top', '0.5rem')
                .style('font-size', '0.9rem')
                .style('color', '#666')
                .html(`<strong>Timezone:</strong> ${tz.names.join(', ')}`);
        }

        if (tz.cities && tz.cities.length > 0) {
            const citiesList = content.append('div')
                .attr('class', 'cities-list');

            citiesList.append('h3').text('Major Cities');

            const citiesContainer = citiesList.append('div')
                .attr('class', 'cities');

            tz.cities.forEach(city => {
                citiesContainer.append('span')
                    .attr('class', 'city-tag')
                    .text(city);
            });
        }
    }

    togglePin(offset, button, panel) {
        if (this.pinnedTimezones.has(offset)) {
            this.pinnedTimezones.delete(offset);
            button.classed('pinned', false);
            button.text('📌 Pin');
        } else {
            this.pinnedTimezones.add(offset);
            button.classed('pinned', true);
            button.text('📌 Pinned');
        }
    }

    closePanel(offset, panel) {
        this.pinnedTimezones.delete(offset);
        panel.remove();
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new TimeZoneMap();
});
