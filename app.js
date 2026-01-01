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

        // Load timezone data from GeoJSON file
        const tzData = await d3.json('timezones.geojson');

        // Group timezones by UTC offset to reduce label clutter
        const grouped = new Map();

        tzData.features.forEach(feature => {
            const offset = feature.properties.offset;
            if (!grouped.has(offset)) {
                grouped.set(offset, {
                    offset: offset,
                    offsetString: feature.properties.offsetString || this.formatOffset(offset),
                    names: [],
                    cities: new Set(),
                    geometries: []
                });
            }

            const group = grouped.get(offset);
            group.geometries.push(feature.geometry);
            if (feature.properties.name) group.names.push(feature.properties.name);
            if (feature.properties.cities) {
                feature.properties.cities.forEach(city => group.cities.add(city));
            }
        });

        // Convert grouped data to timezone objects
        this.timezones = Array.from(grouped.values()).map(group => ({
            offset: group.offset,
            offsetString: group.offsetString,
            name: group.names[0] || `UTC${group.offset >= 0 ? '+' : ''}${group.offset}`,
            names: group.names,
            cities: Array.from(group.cities),
            geometry: {
                type: 'GeometryCollection',
                geometries: group.geometries
            }
        })).sort((a, b) => a.offset - b.offset);

        console.log(`Loaded ${this.timezones.length} timezone groups (from ${tzData.features.length} features)`);

        // Create color scale for timezones
        this.colorScale = d3.scaleSequential()
            .domain([d3.min(this.timezones, d => d.offset), d3.max(this.timezones, d => d.offset)])
            .interpolator(d3.interpolateRainbow);
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
            .attr('stroke', d => this.colorScale(d.offset))
            .on('mouseover', (event, d) => this.handleTimezoneHover(d))
            .on('mouseout', () => this.handleTimezoneLeave())
            .on('click', (event, d) => this.handleTimezoneClick(d));
    }

    renderLabels() {
        const labelsGroup = this.svg.select('.labels-group');
        const labelY = this.height - 30; // Position labels near bottom
        const labelSpacing = this.width / this.timezones.length;

        this.timezones.forEach((tz, i) => {
            // Space labels evenly across the bottom
            const labelX = (i + 0.5) * labelSpacing;

            const labelGroup = labelsGroup.append('g')
                .attr('class', 'timezone-label')
                .attr('data-offset', tz.offset)
                .attr('transform', `translate(${labelX}, ${labelY})`);

            // Color-coded background bar
            labelGroup.append('rect')
                .attr('x', -labelSpacing / 2 + 2)
                .attr('y', -20)
                .attr('width', labelSpacing - 4)
                .attr('height', 4)
                .attr('fill', this.colorScale(tz.offset))
                .attr('opacity', 0.8);

            // Offset text
            const offsetText = labelGroup.append('text')
                .attr('class', 'offset')
                .attr('dy', '-0.5em')
                .style('fill', this.colorScale(tz.offset))
                .text(tz.offsetString);

            // Time text
            const timeText = labelGroup.append('text')
                .attr('class', 'time')
                .attr('dy', '1em')
                .attr('id', `time-label-${tz.offset.toString().replace('.', '_').replace('-', 'neg')}`)
                .text(this.getCurrentTime(tz.offset));
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
            const labelId = `time-label-${tz.offset.toString().replace('.', '_').replace('-', 'neg')}`;
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
