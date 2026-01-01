// World Time Zone Map Application

class TimeZoneMap {
    constructor() {
        this.svg = d3.select('#world-map');
        this.width = 1200;
        this.height = 700; // Increased for label space
        this.mapCenterY = 350; // Center the map vertically
        this.pinnedTimezones = new Set();
        this.highlightedTz = null;

        this.projection = d3.geoNaturalEarth1()
            .scale(190)
            .translate([this.width / 2, this.mapCenterY]);

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
            .style('fill', d => {
                const color = d3.color(this.colorScale(d.offset));
                color.opacity = 0.3;
                return color;
            })
            .on('mouseover', (event, d) => this.handleTimezoneHover(d))
            .on('mouseout', () => this.handleTimezoneLeave())
            .on('click', (event, d) => this.handleTimezoneClick(d));
    }

    renderLabels() {
        const labelsGroup = this.svg.select('.labels-group');
        const margin = 10;
        const topLabelY = 50; // Top row position
        const bottomLabelY = this.height - 50; // Bottom row position

        // Calculate centroid and bounds for each timezone
        const tzWithGeometry = this.timezones.map(tz => {
            const bounds = d3.geoBounds({ type: 'Feature', geometry: tz.geometry });
            const centroid = d3.geoCentroid({ type: 'Feature', geometry: tz.geometry });
            const projected = this.projection(centroid);

            // Find northernmost and southernmost points
            const north = this.projection([centroid[0], bounds[1][1]]);
            const south = this.projection([centroid[0], bounds[0][1]]);

            return {
                ...tz,
                centroid: projected,
                north: north,
                south: south,
                bounds: bounds
            };
        });

        // Sort by longitude (x position) for left-to-right layout
        const sortedTz = [...tzWithGeometry].sort((a, b) => a.centroid[0] - b.centroid[0]);

        // Distribute labels: bottom row first, then top row, then corners
        const bottomRow = [];
        const topRow = [];
        const corners = [];

        const labelsPerRow = Math.ceil(sortedTz.length / 2);

        sortedTz.forEach((tz, i) => {
            if (i < labelsPerRow) {
                bottomRow.push(tz);
            } else if (i < labelsPerRow * 2) {
                topRow.push(tz);
            } else {
                corners.push(tz);
            }
        });

        // Render bottom row
        this.renderLabelRow(labelsGroup, bottomRow, bottomLabelY, 'bottom');

        // Render top row
        this.renderLabelRow(labelsGroup, topRow, topLabelY, 'top');

        // Render corner labels (if any overflow)
        corners.forEach((tz, i) => {
            const x = i % 2 === 0 ? margin + 50 : this.width - margin - 50;
            const y = i < 2 ? topLabelY : bottomLabelY;
            this.renderLabel(labelsGroup, tz, x, y, 'corner');
        });
    }

    renderLabelRow(container, timezones, y, position) {
        const spacing = this.width / (timezones.length + 1);

        timezones.forEach((tz, i) => {
            const x = (i + 1) * spacing;
            this.renderLabel(container, tz, x, y, position);
        });
    }

    renderLabel(container, tz, x, y, position) {
        const color = this.colorScale(tz.offset);

        // Create label group
        const labelGroup = container.append('g')
            .attr('class', 'timezone-label')
            .attr('data-offset', tz.offset)
            .on('mouseover', () => this.handleTimezoneHover(tz))
            .on('mouseout', () => this.handleTimezoneLeave())
            .on('click', () => this.handleTimezoneClick(tz));

        // Draw callout line to timezone
        const targetPoint = position === 'top' ? tz.north : tz.south;
        if (targetPoint && targetPoint[0] >= 0 && targetPoint[0] <= this.width) {
            labelGroup.append('line')
                .attr('class', 'callout-line')
                .attr('x1', x)
                .attr('y1', y)
                .attr('x2', targetPoint[0])
                .attr('y2', targetPoint[1])
                .attr('stroke', color)
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '2,2')
                .attr('opacity', 0.6);
        }

        // Background rectangle - narrower
        const bgWidth = 55;
        const bgHeight = 30;
        labelGroup.append('rect')
            .attr('x', x - bgWidth / 2)
            .attr('y', y - bgHeight / 2)
            .attr('width', bgWidth)
            .attr('height', bgHeight)
            .attr('fill', color)
            .attr('opacity', 0.9)
            .attr('rx', 4);

        // Abbreviated offset text (e.g., "+8" instead of "UTC+8")
        const abbreviatedOffset = tz.offsetString.replace('UTC', '');
        labelGroup.append('text')
            .attr('class', 'label-offset')
            .attr('x', x)
            .attr('y', y - 3)
            .attr('text-anchor', 'middle')
            .attr('fill', '#fff')
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .text(abbreviatedOffset);

        // Time text
        labelGroup.append('text')
            .attr('class', 'label-time')
            .attr('x', x)
            .attr('y', y + 8)
            .attr('text-anchor', 'middle')
            .attr('fill', '#fff')
            .attr('font-size', '10px')
            .attr('id', `time-label-${tz.offset.toString().replace('.', '_').replace('-', 'neg')}`)
            .text(this.getCurrentTime(tz.offset));
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

        // Highlight corresponding label
        const highlightedOffset = this.highlightedTz;
        this.svg.selectAll('.timezone-label')
            .classed('highlighted', function() {
                return parseFloat(this.dataset.offset) === highlightedOffset;
            });

        // Highlight corresponding panel
        d3.selectAll('.timezone-panel')
            .classed('highlighted', function() {
                return parseFloat(this.dataset.offset) === highlightedOffset;
            });
    }

    handleTimezoneClick(tz) {
        // Check if panel already exists (only check in timezone-panels container)
        const existingPanel = d3.select(`#timezone-panels .timezone-panel[data-offset="${tz.offset}"]`);
        if (!existingPanel.empty()) {
            // Panel exists, scroll to it and highlight briefly
            existingPanel.node().scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
