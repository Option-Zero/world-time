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
            .scale(210)
            .translate([this.width / 2, this.mapCenterY]);

        this.path = d3.geoPath().projection(this.projection);

        this.init();
    }

    async init() {
        this.setupSVG();
        await this.loadData();
        this.render();
        this.startTimeClock();
        this.setupResizeHandler();
    }

    setupResizeHandler() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.renderPinnedCalloutLines();
            }, 100);
        });
    }

    setupSVG() {
        this.svg
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        // Add defs for patterns
        const defs = this.svg.append('defs');

        // Crosshatch pattern for quarter-hour offset timezones (:15, :45)
        const crosshatch = defs.append('pattern')
            .attr('id', 'crosshatch')
            .attr('patternUnits', 'userSpaceOnUse')
            .attr('width', 8)
            .attr('height', 8);

        // Diagonal lines going one way
        crosshatch.append('path')
            .attr('d', 'M0,0 l8,8 M-2,6 l4,4 M6,-2 l4,4')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 0.8)
            .attr('opacity', 0.25);

        // Diagonal lines going the other way
        crosshatch.append('path')
            .attr('d', 'M0,8 l8,-8 M-2,2 l4,-4 M6,10 l4,-4')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 0.8)
            .attr('opacity', 0.25);

        // Diagonal pattern for half-hour offset timezones (:30)
        const diagonal = defs.append('pattern')
            .attr('id', 'diagonal')
            .attr('patternUnits', 'userSpaceOnUse')
            .attr('width', 8)
            .attr('height', 8);

        diagonal.append('path')
            .attr('d', 'M0,0 l8,8 M-2,6 l4,4 M6,-2 l4,4')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 0.8)
            .attr('opacity', 0.25);

        // Add groups for layering (order matters - last is on top)
        this.svg.append('g').attr('class', 'timezones-group');
        this.svg.append('g').attr('class', 'countries-group');
        this.svg.append('g').attr('class', 'country-borders-group');
        this.svg.append('g').attr('class', 'pinned-callout-lines-group');
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
            if (feature.properties.name) {
                group.names.push(feature.properties.name);
            }
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

        // Create color scale for timezones - using 4-hour time blocks
        this.colorScale = ColorSchemes.timeBlocks4Hour.generator(this.timezones);
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
        this.renderTimezones();
        this.renderCountries();
        this.renderCountryBorders();
        this.renderDayNightLine();
        this.renderTimezoneCallouts();
        this.renderPinnedCallouts();
        this.renderTimezoneGrid();
    }

    renderCountries() {
        const countriesGroup = this.svg.select('.countries-group');

        countriesGroup.selectAll('path')
            .data(this.countries.features)
            .join('path')
            .attr('class', 'country')
            .attr('d', this.path)
            .style('fill', '#ffffff')
            .style('fill-opacity', 0.4)
            .style('stroke', 'none')
            .style('pointer-events', 'none');
    }

    renderCountryBorders() {
        const bordersGroup = this.svg.select('.country-borders-group');

        bordersGroup.selectAll('path')
            .data(this.countries.features)
            .join('path')
            .attr('class', 'country-border')
            .attr('d', this.path)
            .style('fill', 'none')
            .style('stroke', '#333')
            .style('stroke-width', 0.5)
            .style('stroke-opacity', 0.4)
            .style('pointer-events', 'none');
    }

    renderDayNightLine() {
        const now = new Date();

        // Calculate solar declination (simplified - varies with season)
        const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
        const solarDeclination = -23.44 * Math.cos((360 / 365) * (dayOfYear + 10) * Math.PI / 180);

        // Calculate hour angle (longitude where sun is overhead)
        const hours = now.getUTCHours() + now.getUTCMinutes() / 60;
        const solarLongitude = (hours - 12) * 15; // 15 degrees per hour

        // Generate terminator line points
        const terminatorPoints = [];
        for (let lat = -90; lat <= 90; lat += 1) {
            // Calculate longitude where it's sunrise/sunset at this latitude
            const cosHourAngle = -Math.tan(lat * Math.PI / 180) * Math.tan(solarDeclination * Math.PI / 180);

            if (Math.abs(cosHourAngle) <= 1) {
                const hourAngle = Math.acos(cosHourAngle) * 180 / Math.PI;
                const lon1 = solarLongitude + hourAngle;
                const lon2 = solarLongitude - hourAngle;

                terminatorPoints.push([lon1, lat]);
                terminatorPoints.push([lon2, lat]);
            }
        }

        // Sort points to create a continuous line
        terminatorPoints.sort((a, b) => a[1] - b[1]);

        // Create GeoJSON line
        const terminatorLine = {
            type: 'LineString',
            coordinates: terminatorPoints
        };

        // Draw the terminator line
        const labelsGroup = this.svg.select('.labels-group');
        labelsGroup.selectAll('.day-night-line').remove();

        labelsGroup.append('path')
            .datum(terminatorLine)
            .attr('class', 'day-night-line')
            .attr('d', this.path)
            .style('fill', 'none')
            .style('stroke', '#FFD700')
            .style('stroke-width', 3)
            .style('stroke-opacity', 0.8)
            .style('stroke-dasharray', '10,5')
            .style('pointer-events', 'none')
            .style('filter', 'drop-shadow(0 0 2px rgba(0,0,0,0.5))');
    }

    renderTimezones() {
        const timezonesGroup = this.svg.select('.timezones-group');

        // Render base timezone polygons
        timezonesGroup.selectAll('path.timezone')
            .data(this.timezones)
            .join('path')
            .attr('class', 'timezone')
            .attr('d', d => this.path({ type: 'Feature', geometry: d.geometry }))
            .attr('data-offset', d => d.offset)
            .style('fill', d => this.colorScale(d.offset))
            .on('mouseover', (event, d) => this.handleTimezoneHover(d))
            .on('mouseout', () => this.handleTimezoneLeave())
            .on('click', (event, d) => this.handleCardClick(d));

        // Add pattern overlay for fractional offset timezones
        const fractionalTzs = this.timezones.filter(tz => tz.offset % 1 !== 0);

        timezonesGroup.selectAll('path.timezone-pattern')
            .data(fractionalTzs)
            .join('path')
            .attr('class', 'timezone-pattern')
            .attr('d', d => this.path({ type: 'Feature', geometry: d.geometry }))
            .attr('data-offset', d => d.offset)
            .style('fill', d => {
                const fraction = Math.abs(d.offset % 1);
                // Half-hour offsets (:30) get diagonal, quarter-hour (:15, :45) get crosshatch
                if (Math.abs(fraction - 0.5) < 0.01) {
                    return 'url(#diagonal)';
                } else {
                    return 'url(#crosshatch)';
                }
            })
            .style('pointer-events', 'none'); // Don't interfere with base timezone events
    }

    renderTimezoneCallouts() {
        const labelsGroup = this.svg.select('.labels-group');
        labelsGroup.selectAll('*').remove(); // Clear existing callouts

        // Group timezones by their time block (same as color scheme)
        const blocks = {
            'midnight': [],
            'earlyMorning': [],
            'morning': [],
            'afternoon': [],
            'evening': [],
            'night': []
        };

        this.timezones.forEach(tz => {
            // Skip fractional offsets
            if (tz.offset % 1 !== 0) return;
            const hour = ColorUtils.getHourInTimezone(tz.offset);
            if (hour >= 0 && hour < 4) blocks.midnight.push(tz);
            else if (hour >= 4 && hour < 8) blocks.earlyMorning.push(tz);
            else if (hour >= 8 && hour < 12) blocks.morning.push(tz);
            else if (hour >= 12 && hour < 16) blocks.afternoon.push(tz);
            else if (hour >= 16 && hour < 20) blocks.evening.push(tz);
            else blocks.night.push(tz);
        });

        // For each block, draw a callout for the first timezone that starts the block
        Object.entries(blocks).forEach(([blockName, block]) => {
            if (block.length === 0) return;

            // Sort by offset
            block.sort((a, b) => a.offset - b.offset);

            // Find the first timezone that actually starts this block (hour is 0, 4, 8, 12, 16, or 20)
            const blockStartHours = {
                'midnight': 0,
                'earlyMorning': 4,
                'morning': 8,
                'afternoon': 12,
                'evening': 16,
                'night': 20
            };

            const startHour = blockStartHours[blockName];
            const tz = block.find(t => ColorUtils.getHourInTimezone(t.offset) === startHour);

            if (!tz) return; // No timezone starts exactly at this block boundary

            // Calculate bounds and get the top (northernmost) point
            const bounds = d3.geoBounds({ type: 'Feature', geometry: tz.geometry });
            const centroid = d3.geoCentroid({ type: 'Feature', geometry: tz.geometry });

            // Use the centroid longitude but the northernmost latitude
            const topPoint = [centroid[0], bounds[1][1]];
            const projected = this.projection(topPoint);

            if (!projected || projected[0] < 0 || projected[0] > this.width) return;

            const calloutY = 30; // Position above the map
            const color = this.colorScale(tz.offset);

            // Draw vertical line
            labelsGroup.append('line')
                .attr('class', 'callout-line')
                .attr('x1', projected[0])
                .attr('y1', projected[1])
                .attr('x2', projected[0])
                .attr('y2', calloutY)
                .attr('stroke', color)
                .attr('stroke-width', 1.5)
                .attr('opacity', 0.7);

            // Add time label
            labelsGroup.append('text')
                .attr('class', 'callout-time')
                .attr('x', projected[0])
                .attr('y', calloutY - 5)
                .attr('text-anchor', 'middle')
                .attr('font-size', '20px')
                .attr('fill', color)
                .attr('id', 'callout-time-' + tz.offset.toString().replace('.', '_').replace('-', 'neg'))
                .text(this.getCurrentTimeShort(tz.offset));
        });
    }

    renderPinnedCallouts() {
        const container = d3.select('#pinned-callouts');
        container.html('');

        if (this.pinnedTimezones.size === 0) {
            // Clear callout lines when no timezones are pinned
            this.renderPinnedCalloutLines();
            return;
        }

        // Get pinned timezones sorted by offset
        const pinnedTzs = Array.from(this.pinnedTimezones)
            .map(offset => this.timezones.find(tz => tz.offset === offset))
            .filter(tz => tz !== undefined)
            .sort((a, b) => a.offset - b.offset);

        pinnedTzs.forEach(tz => {
            const bgColor = this.colorScale(tz.offset);
            
            // Calculate perceived lightness to determine text color
            const color = d3.color(bgColor);
            const rgb = d3.rgb(color);
            const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
            const textColor = luminance > 0.7 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)';

            const callout = container.append('div')
                .attr('class', 'pinned-callout')
                .attr('data-offset', tz.offset)
                .style('background-color', bgColor)
                .style('color', textColor)
                .on('click', () => this.handleCardClick(tz))
                .on('mouseover', () => this.handleTimezoneHover(tz))
                .on('mouseout', () => this.handleTimezoneLeave());

            if (tz.offset % 1 !== 0) {
                const fraction = Math.abs(tz.offset % 1);
                if (Math.abs(fraction - 0.5) < 0.01) {
                    callout.style('background-image', 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px)');
                } else {
                    callout.style('background-image', 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px), repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px)');
                }
            }

            const header = callout.append('div').attr('class', 'pinned-callout-header');
            header.append('div').attr('class', 'pinned-offset').text(tz.offsetString);
            header.append('div')
                .attr('class', 'pinned-time')
                .attr('id', 'pinned-time-' + tz.offset.toString().replace('.', '_').replace('-', 'neg'))
                .text(this.getCurrentTimeFull(tz.offset));

            const names = tz.cities.slice(0, 3).concat(tz.names.filter(name => isNaN(parseFloat(name))).slice(0, 2));
            if (names.length > 0) {
                callout.append('div')
                    .attr('class', 'pinned-location')
                    .text(names.slice(0, 3).join(', '));
            }
        });

        // Draw lines from timezones to pinned callouts
        this.renderPinnedCalloutLines();
    }

    renderPinnedCalloutLines() {
        const linesGroup = this.svg.select('.pinned-callout-lines-group');
        linesGroup.selectAll('*').remove();

        if (this.pinnedTimezones.size === 0) {
            return;
        }

        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
            const svgElement = this.svg.node();
            if (!svgElement) return;

            const svgRect = svgElement.getBoundingClientRect();
            const svgViewBox = this.svg.attr('viewBox').split(' ').map(Number);
            const viewBoxWidth = svgViewBox[2];
            const viewBoxHeight = svgViewBox[3];

            // Get pinned timezones sorted by offset
            const pinnedTzs = Array.from(this.pinnedTimezones)
                .map(offset => this.timezones.find(tz => tz.offset === offset))
                .filter(tz => tz !== undefined)
                .sort((a, b) => a.offset - b.offset);

            pinnedTzs.forEach((tz) => {
                // Get the timezone bounds and find the bottom (southernmost) point
                const bounds = d3.geoBounds({ type: 'Feature', geometry: tz.geometry });
                const centroid = d3.geoCentroid({ type: 'Feature', geometry: tz.geometry });
                
                // Use the centroid longitude but the southernmost latitude (bottom of timezone)
                const bottomPoint = [centroid[0], bounds[0][1]];
                const projected = this.projection(bottomPoint);

                if (!projected || projected[0] < 0 || projected[0] > this.width) {
                    return;
                }

                // Find the corresponding callout element
                const calloutElement = document.querySelector(`.pinned-callout[data-offset="${tz.offset}"]`);
                if (!calloutElement) {
                    return;
                }

                const calloutRect = calloutElement.getBoundingClientRect();

                // Calculate the callout top center position relative to the SVG
                const calloutTopCenterX = calloutRect.left + calloutRect.width / 2 - svgRect.left;
                const calloutTopCenterY = calloutRect.top - svgRect.top;

                // Convert screen coordinates to SVG viewBox coordinates
                const scaleX = viewBoxWidth / svgRect.width;
                const scaleY = viewBoxHeight / svgRect.height;
                const endX = calloutTopCenterX * scaleX;
                const endY = calloutTopCenterY * scaleY;

                // Start point: timezone centroid on map (already in SVG coordinates)
                const startX = projected[0];
                const startY = projected[1];

                // Only draw if end point is below the map
                if (endY < this.height - 100) {
                    return; // Don't draw if callout is too high
                }

                const color = this.colorScale(tz.offset);

                // Draw line from timezone to callout
                linesGroup.append('line')
                    .attr('class', 'pinned-callout-line')
                    .attr('x1', startX)
                    .attr('y1', startY)
                    .attr('x2', endX)
                    .attr('y2', endY)
                    .attr('stroke', color)
                    .attr('stroke-width', 1.5)
                    .attr('opacity', 0.6)
                    .attr('stroke-dasharray', '4,2')
                    .style('pointer-events', 'none');
            });
        });
    }

    renderTimezoneGrid() {
        const container = d3.select('#timezone-grid');
        container.html('');

        const sorted = [...this.timezones].sort((a, b) => a.offset - b.offset);

        sorted.forEach(tz => {
            const bgColor = this.colorScale(tz.offset);

            // Calculate perceived lightness to determine text color
            const color = d3.color(bgColor);
            const rgb = d3.rgb(color);
            // Using relative luminance formula
            const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
            const textColor = luminance > 0.7 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)';

            const card = container.append('div')
                .attr('class', 'timezone-card')
                .attr('data-offset', tz.offset)
                .style('background-color', bgColor)
                .style('color', textColor)
                .on('click', () => this.handleCardClick(tz))
                .on('mouseover', () => this.handleTimezoneHover(tz))
                .on('mouseout', () => this.handleTimezoneLeave());

            if (tz.offset % 1 !== 0) {
                const fraction = Math.abs(tz.offset % 1);
                // Half-hour offsets (:30) get single diagonal, quarter-hour (:15, :45) get crosshatch
                if (Math.abs(fraction - 0.5) < 0.01) {
                    card.style('background-image', 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px)');
                } else {
                    card.style('background-image', 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px), repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px)');
                }
            }

            card.append('div').attr('class', 'pin-indicator').text('📌');

            const header = card.append('div').attr('class', 'card-header');
            const title = header.append('div').attr('class', 'offset').text(tz.offsetString);
            header.append('div')
                .attr('class', 'time-compact')
                .attr('id', 'time-compact-' + tz.offset.toString().replace('.', '_').replace('-', 'neg'))
                .text(this.getCurrentTimeShort(tz.offset));

            const expanded = card.append('div').attr('class', 'expanded-content');

            // Add location header at the top of expanded content
            const names = tz.cities.slice(0, 4).concat(tz.names.filter(name => isNaN(parseFloat(name))).slice(0, 4));
            if (names.length > 0) {
                expanded.append('div')
                .attr('class', 'location-header')
                .text(names.slice(0, 4).join(', '));
            }
            expanded.append('div')
                .attr('class', 'time-display')
                .attr('id', 'time-full-' + tz.offset.toString().replace('.', '_').replace('-', 'neg'))
                .text(this.getCurrentTimeFull(tz.offset));

            const browserOffset = -new Date().getTimezoneOffset() / 60;
            const relativeOffset = tz.offset - browserOffset;
            let relativeText = 'Your time zone';

            if (relativeOffset > 0) {
                const hours = Math.floor(Math.abs(relativeOffset));
                const minutes = Math.round((Math.abs(relativeOffset) % 1) * 60);
                relativeText = minutes > 0 ? hours + 'h ' + minutes + 'm ahead of your time zone' : hours + ' hours ahead of your time zone';
            } else if (relativeOffset < 0) {
                const hours = Math.floor(Math.abs(relativeOffset));
                const minutes = Math.round((Math.abs(relativeOffset) % 1) * 60);
                relativeText = minutes > 0 ? hours + 'h ' + minutes + 'm behind your time zone' : hours + ' hours behind your time zone';
            }

            expanded.append('div').attr('class', 'time-info').text(relativeText);

            // Add Wikipedia link
            const wikiUrl = this.getWikipediaUrl(tz.offset);
            expanded.append('a')
                .attr('class', 'wiki-link')
                .attr('href', wikiUrl)
                .attr('target', '_blank')
                .attr('rel', 'noopener noreferrer')
                .text('Wikipedia →');
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

    getCurrentTimeShort(offset) {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const tzTime = new Date(utc + (3600000 * offset));
        return tzTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    getCurrentTimeFull(offset) {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const tzTime = new Date(utc + (3600000 * offset));
        return tzTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
    }

    getWikipediaUrl(offset) {
        // Format offset for Wikipedia URL (e.g., UTC+05:30 or UTC−09:00)
        const absOffset = Math.abs(offset);
        const hours = Math.floor(absOffset);
        const minutes = Math.round((absOffset % 1) * 60);

        const sign = offset >= 0 ? '+' : '−'; // Note: using Unicode minus sign (U+2212)
        const hoursStr = hours.toString().padStart(2, '0');
        const minutesStr = minutes.toString().padStart(2, '0');

        const utcString = `UTC${sign}${hoursStr}:${minutesStr}`;
        return `https://en.wikipedia.org/wiki/${encodeURIComponent(utcString)}`;
    }

    startTimeClock() {
        // Update all times every second
        setInterval(() => {
            this.updateAllTimes();
        }, 1000);
    }

    updateAllTimes() {
        // Update compact times on cards
        this.timezones.forEach(tz => {
            const compactId = 'time-compact-' + tz.offset.toString().replace('.', '_').replace('-', 'neg');
            const compactEl = document.getElementById(compactId);
            if (compactEl) {
                compactEl.textContent = this.getCurrentTimeShort(tz.offset);
            }

            const fullId = 'time-full-' + tz.offset.toString().replace('.', '_').replace('-', 'neg');
            const fullEl = document.getElementById(fullId);
            if (fullEl) {
                fullEl.textContent = this.getCurrentTimeFull(tz.offset);
            }

            // Update callout times
            const calloutId = 'callout-time-' + tz.offset.toString().replace('.', '_').replace('-', 'neg');
            const calloutLabel = this.svg.select('#' + calloutId);
            if (!calloutLabel.empty()) {
                calloutLabel.text(this.getCurrentTimeShort(tz.offset));
            }

            // Update pinned callout times
            const pinnedTimeId = 'pinned-time-' + tz.offset.toString().replace('.', '_').replace('-', 'neg');
            const pinnedTimeEl = document.getElementById(pinnedTimeId);
            if (pinnedTimeEl) {
                pinnedTimeEl.textContent = this.getCurrentTimeFull(tz.offset);
            }
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

        // Highlight corresponding card
        const highlightedOffset = this.highlightedTz;
        d3.selectAll('.timezone-card')
            .classed('highlighted', function() {
                return parseFloat(this.dataset.offset) === highlightedOffset;
            });

        // Highlight corresponding pinned callout
        d3.selectAll('.pinned-callout')
            .classed('highlighted', function() {
                return parseFloat(this.dataset.offset) === highlightedOffset;
            });
    }

    handleCardClick(tz) {
        const card = d3.select('#timezone-grid .timezone-card[data-offset="' + tz.offset + '"]');
        const isExpanded = card.classed('expanded');
        const isPinned = card.classed('pinned');

        if (isExpanded) {
            card.classed('pinned', !isPinned);
            if (!isPinned) {
                this.pinnedTimezones.add(tz.offset);
            } else {
                this.pinnedTimezones.delete(tz.offset);
                card.classed('expanded', false);
            }
            this.renderPinnedCallouts();
        } else {
            d3.selectAll('#timezone-grid .timezone-card:not(.pinned)').classed('expanded', false);
            card.classed('expanded', true);
        }
    }

    setColorScheme(schemeFunction) {
        this.colorScale = schemeFunction;
        this.render();
    }
}

// OKLCH Color Utilities
const ColorUtils = {
    // Convert OKLCH to RGB using proper OKLab color space
    // L: 0-1 (lightness), C: 0-0.4 (chroma), H: 0-360 (hue)
    oklchToRgb(l, c, h) {
        // OKLCH to OKLab
        const hRad = (h * Math.PI) / 180;
        const a = c * Math.cos(hRad);
        const b = c * Math.sin(hRad);

        // OKLab to linear RGB using correct matrices
        // First: OKLab -> LMS (cone response)
        const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
        const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
        const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

        const l3 = l_ * l_ * l_;
        const m3 = m_ * m_ * m_;
        const s3 = s_ * s_ * s_;

        // LMS to linear RGB
        let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
        let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
        let bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

        // Linear RGB to sRGB (gamma correction)
        const toSRGB = (c) => {
            const abs = Math.abs(c);
            if (abs > 0.0031308) {
                return (Math.sign(c) || 1) * (1.055 * Math.pow(abs, 1 / 2.4) - 0.055);
            }
            return 12.92 * c;
        };

        r = toSRGB(r);
        g = toSRGB(g);
        bl = toSRGB(bl);

        // Convert to 0-255 and clamp
        r = Math.max(0, Math.min(255, Math.round(r * 255)));
        g = Math.max(0, Math.min(255, Math.round(g * 255)));
        bl = Math.max(0, Math.min(255, Math.round(bl * 255)));

        return `rgb(${r}, ${g}, ${bl})`;
    },

    // Get current hour in a timezone (0-23)
    getHourInTimezone(offset) {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const tzTime = new Date(utc + (offset * 3600000));
        return tzTime.getHours();
    },

    // Map hour to time of day category
    getTimeOfDay(hour) {
        if (hour >= 6 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 18) return 'afternoon';
        if (hour >= 18 && hour < 22) return 'evening';
        return 'night';
    }
};

// Color Scheme Definitions
const ColorSchemes = {
    rainbow: {
        name: 'Rainbow Gradient (Current)',
        description: 'Continuous rainbow spectrum from west to east. Beautiful but adjacent colors are similar.',
        generator: (timezones) => {
            const scale = d3.scaleSequential()
                .domain([d3.min(timezones, d => d.offset), d3.max(timezones, d => d.offset)])
                .interpolator(d3.interpolateRainbow);
            return (offset) => {
                const color = d3.color(scale(offset));
                color.opacity = 0.3;
                return color;
            };
        }
    },

    hueStepsLightnessWave: {
        name: 'Progressive Hue + Lightness Wave',
        description: 'Hue steps evenly through spectrum (~13° per zone), while lightness oscillates high/low. Adjacent zones differ in BOTH hue and lightness for maximum local contrast while maintaining global progression.',
        generator: (timezones) => {
            const sorted = [...timezones].sort((a, b) => a.offset - b.offset);
            const colorMap = new Map();

            sorted.forEach((tz, i) => {
                // Hue: step through full spectrum
                const hue = (i / sorted.length) * 360;

                // Lightness: oscillate between light and dark
                // Creates a wave pattern: light, dark, light, dark...
                const lightnessWave = Math.sin((i / sorted.length) * Math.PI * 6); // 6 full waves
                const lightness = 0.68 + lightnessWave * 0.15; // Range: 0.53 to 0.83

                // Moderate chroma for balanced saturation
                const chroma = 0.15;

                colorMap.set(tz.offset, ColorUtils.oklchToRgb(lightness, chroma, hue));
            });

            return (offset) => colorMap.get(offset);
        }
    },

    discreteHueFamilies: {
        name: 'Discrete Hue Families (Reference Style)',
        description: 'Groups zones into 7 color families (purple, pink, orange, yellow, green, teal, blue). Within each family, lightness varies from dark to light. Enables semantic descriptions like "the lightest yellow one".',
        generator: (timezones) => {
            const sorted = [...timezones].sort((a, b) => a.offset - b.offset);
            const colorMap = new Map();

            // Define 7 color families with base hue and chroma
            // Based on reference timezone map
            const families = [
                { name: 'purple', baseH: 280, baseC: 0.14, baseL: 0.58, count: 4 },  // Deep purple to lavender
                { name: 'pink',   baseH: 340, baseC: 0.15, baseL: 0.70, count: 4 },  // Hot pink to pale pink
                { name: 'orange', baseH: 30,  baseC: 0.16, baseL: 0.68, count: 4 },  // Dark orange to peach
                { name: 'yellow', baseH: 80,  baseC: 0.15, baseL: 0.80, count: 4 },  // Golden to pale yellow
                { name: 'green',  baseH: 130, baseC: 0.14, baseL: 0.72, count: 4 },  // Forest to lime
                { name: 'teal',   baseH: 180, baseC: 0.13, baseL: 0.68, count: 4 },  // Teal to cyan
                { name: 'blue',   baseH: 220, baseC: 0.13, baseL: 0.70, count: 3 }   // Deep blue to sky
            ];

            // Distribute timezones across families
            let tzIndex = 0;
            families.forEach(family => {
                const zonesInFamily = Math.min(family.count, sorted.length - tzIndex);

                for (let i = 0; i < zonesInFamily; i++) {
                    const tz = sorted[tzIndex];

                    // Vary lightness within family: darkest first, lightest last
                    const t = zonesInFamily > 1 ? i / (zonesInFamily - 1) : 0.5;
                    const lightness = family.baseL - 0.15 + (t * 0.30); // Range of 0.30 in lightness

                    // Slight hue variation within family for extra distinction
                    const hueOffset = (t - 0.5) * 15; // ±7.5 degrees
                    const hue = family.baseH + hueOffset;

                    colorMap.set(tz.offset, ColorUtils.oklchToRgb(lightness, family.baseC, hue));
                    tzIndex++;
                }
            });

            return (offset) => colorMap.get(offset);
        }
    },

    timeBlocks4Hour: {
        name: 'Time Blocks (4-Hour, High Saturation)',
        description: 'Groups by current time in 4-hour blocks: 0-3am=dark blue, 4-7am=brown, 8-11am=red/pink, 12-3pm=orange, 4-7pm=yellow, 8-11pm=green. High saturation for bold colors.',
        generator: (timezones) => {
            const colorMap = new Map();

            // Group timezones by their current 4-hour time block
            const blocks = {
                'midnight': [],    // 0-3
                'earlyMorning': [], // 4-7
                'morning': [],      // 8-11
                'afternoon': [],    // 12-15
                'evening': [],      // 16-19
                'night': []         // 20-23
            };

            timezones.forEach(tz => {
                const hour = ColorUtils.getHourInTimezone(tz.offset);
                if (hour >= 0 && hour < 4) blocks.midnight.push(tz);
                else if (hour >= 4 && hour < 8) blocks.earlyMorning.push(tz);
                else if (hour >= 8 && hour < 12) blocks.morning.push(tz);
                else if (hour >= 12 && hour < 16) blocks.afternoon.push(tz);
                else if (hour >= 16 && hour < 20) blocks.evening.push(tz);
                else blocks.night.push(tz);
            });

            // Sort within each block by offset
            Object.values(blocks).forEach(block => block.sort((a, b) => a.offset - b.offset));

            // Define color parameters for each time block - Natural Sky Progression v5 (lower saturation)
            const blockColors = {
                midnight:     { baseH: 240, baseC: 0.20, baseL: 0.30 },  // Deep navy blue (deep night - darkest)
                earlyMorning: { baseH: 330, baseC: 0.16, baseL: 0.60 },  // Magenta/pink (dawn sky) - reduced saturation
                morning:      { baseH: 210, baseC: 0.18, baseL: 0.72 },  // Sky blue (morning sky)
                afternoon:    { baseH: 90,  baseC: 0.20, baseL: 0.85 },  // Bright yellow (midday sun)
                evening:      { baseH: 25,  baseC: 0.16, baseL: 0.68 },  // Orange-red/coral (sunset) - reduced saturation
                night:        { baseH: 150, baseC: 0.20, baseL: 0.52 }   // Deep green (night/forest)
            };

            // Assign colors within each block
            Object.entries(blocks).forEach(([blockName, tzList]) => {
                const params = blockColors[blockName];
                tzList.forEach((tz, i) => {
                    const t = tzList.length > 1 ? i / (tzList.length - 1) : 0.5;

                    // Vary lightness within block
                    const lightness = params.baseL - 0.12 + (t * 0.24);

                    // Vary hue slightly for distinction
                    const hueOffset = (t - 0.5) * 25; // ±12.5 degrees
                    const hue = params.baseH + hueOffset;

                    colorMap.set(tz.offset, ColorUtils.oklchToRgb(lightness, params.baseC, hue));
                });
            });

            return (offset) => colorMap.get(offset);
        }
    },
};

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new TimeZoneMap();
});
