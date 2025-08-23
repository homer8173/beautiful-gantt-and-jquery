/**
 * jQuery BGJ beautiful Gantt Plugin
 * Initializes a Gantt chart within a specified target element using a provided template.
 *
 * Usage:

const startDate = '2025-07-07';
const endDate   = '2025-07-28';
const tasks = [
  {id:1, label:'Material preparation',    start:'2025-07-07',                 end:'2025-07-08',                      type:'production', durationMs:null, progress:0.7, dependsOn:[], color:"#66bc8aff"},
  {id:2, label:'Assembly',               start:'2025-07-07 00:00:00',         end:'2025-07-21 00:00:00',             type:'production', durationMs:null, progress:0.6, dependsOn:[1]},
  {id:3, label:'Quality Controle ',      start:'2025-07-17 00:00:00',         end:'2025-07-19 00:00:00',             type:'qa',         durationMs:null, progress:0.3, dependsOn:[2], color:"#ff9494"},
  {id:4, label:'Shipment',            start:'2025-07-21 00:00:00',             end:'2025-07-23 00:00:00',             type:'shipping',   durationMs:null, progress:0.1, dependsOn:[3], color:"#ffe080"},
  {id:5, label:'Short Test',            start:'2025-07-24 09:00:00',       end:'2025-07-24T12:15:00',                   type:'qa',         durationMs:null, progress:0.5, dependsOn:[]},
  {id:6, label:'Very fast',          start:'2025-07-25 14:00:00',       end:'2025-07-25T14:18:00',                   type:'shipping',   durationMs:null, progress:0.9, dependsOn:[]}
]; 

  const bgj = $.bgj({
    target:   '#target',
    tasks:    tasks,
    startDate : '2025-07-07',
    endDate : '2025-07-28',
    dayWidth: 50
  }); 
 */

(function($) {
    $.bgj = function(options) {
        const defaults = {
            target: '',
            template: `
<table class="gantt-table-main">
    <tr>
        <td class="gantt-label-col">
            <div class="zoom-buttons">
                <button data-zoom="week">W</button>
                <button data-zoom="day" class="active">D</button>
                <button data-zoom="hour">H</button>
            </div>
        </td>
        <td class="gantt-scroll-td" rowspan="2">
            <div class="gantt-scroll-wrap">
                <table class="gantt-inner-table" id="gantt-inner-table">
                    <thead><tr id="gantt-inner-header-row"></tr></thead>
                    <tbody id="gantt-inner-table-body"></tbody>
                </table>
            </div>
        </td>
    </tr>
    <tr>
        <td class="gantt-label-col" id="gantt-labels-col"></td>
    </tr>
</table>`,
            tasks: [],
            startDate: 'auto',
            endDate: 'auto',
            dayWidth: 50
        };

        const settings   = $.extend({}, defaults, options);
        let currentZoom  = 'day';
        const unitMs     = { day: 86400000, week: 604800000, hour: 3600000 };
        const unitWidth  = { day: settings.dayWidth, week: settings.dayWidth, hour: settings.dayWidth * 0.6 };

        if (settings.startDate === 'auto') settings.startDate = getMinStartDate(settings.tasks);
        if (settings.endDate   === 'auto') settings.endDate   = getMaxEndDate(settings.tasks);

        // Inject template
        $(settings.target).html(settings.template);

        /* ----------------------------- Helpers (keep your rendering) ----------------------------- */

        function msToDuration(ms) {
            let min = Math.floor(ms / 60000);
            let h   = Math.floor(min / 60); min %= 60;
            let d   = Math.floor(h / 24);   h   %= 24;
            return [d ? d + 'j' : '', h ? h + 'h' : '', min ? min + 'm' : ''].filter(Boolean).join('');
        }

        function parseLocalDate(str) {
            if (str instanceof Date) return str;
            const clean = String(str).trim().replace(' ', 'T');
            const [datePart, timePart] = clean.split('T');
            const [y, m, d] = datePart.split('-').map(Number);
            let hours = 0, minutes = 0, seconds = 0;
            if (timePart) {
                const t = timePart.split(':').map(Number);
                hours = t[0] || 0; minutes = t[1] || 0; seconds = t[2] || 0;
            }
            return new Date(y, m - 1, d, hours, minutes, seconds);
        }

        function durationBetween(start, end) {
            const s = parseLocalDate(start);
            let e   = parseLocalDate(end);
            if (/^\d{4}-\d{2}-\d{2}$/.test(end)) e.setDate(e.getDate() + 1);
            return msToDuration(e - s);
        }

        function getMinStartDate(tasks) {
            let minStart = null;
            for (const task of tasks) {
                const startDate = parseLocalDate(task.start);
                if (!minStart || startDate < minStart) minStart = startDate;
            }
            return minStart.toISOString().slice(0, 10);
        }

        function getMaxEndDate(tasks) {
            let maxEnd = null;
            for (const task of tasks) {
                const endDate = parseLocalDate(task.end);
                if (!maxEnd || endDate > maxEnd) maxEnd = endDate;
            }
            return maxEnd.toISOString().slice(0, 10) + " 23:59:59";
        }

        function buildHeader() {
            const headers = [];
            const ms = unitMs[currentZoom];
            const width = unitWidth[currentZoom];
            const today = new Date();
            let dt = parseLocalDate(settings.startDate);

            while (dt <= parseLocalDate(settings.endDate)) {
                let label = '';
                if (currentZoom === 'week') {
                    const onejan = new Date(dt.getFullYear(), 0, 1);
                    const week = Math.ceil((((dt - onejan) / 86400000) + onejan.getDay() + 1) / 7);
                    label = 'W' + week;
                } else if (currentZoom === 'hour') {
                    const day = dt.getDate();
                    const month = (dt.getMonth() + 1).toString().padStart(2, '0');
                    label = `<small>${day}/${month}</small>\n` + dt.getHours().toString().padStart(2, '0') + 'h';
                } else {
                    const day = dt.getDate();
                    const month = (dt.getMonth() + 1).toString().padStart(2, '0');
                    label = `${day}/${month}`;
                }
                const next = new Date(dt.getTime() + ms);
                const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                const isToday   = today >= dt && today < next;
                headers.push(`<th class="${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}" style="min-width:${width}px">${label}</th>`);
                dt = next;
            }

            $(`${settings.target} #gantt-inner-header-row`).html(headers.join(''));
        }

        function buildLabels() {
            const html = settings.tasks.map(t =>
                `<div class="gant-title">${t.dependsOn && t.dependsOn.length ? '&nbsp;&nbsp;<big>&#8627;</big>&nbsp;' : ''}${t.label}</div>`
            ).join('');
            $(`${settings.target} #gantt-labels-col`).html(html);
        }

        function getRandomPastelHexColor(alpha = 1) {
            const r = Math.floor(127 + 64 + Math.random() * 64);
            const g = Math.floor(127 + 64 + Math.random() * 10);
            const b = Math.floor(127 + 64 + Math.random() * 64);
            const a = Math.round(alpha * 255);
            const hr = r.toString(16).padStart(2, '0');
            const hg = g.toString(16).padStart(2, '0');
            const hb = b.toString(16).padStart(2, '0');
            const ha = a.toString(16).padStart(2, '0');
            return `#${hr}${hg}${hb}${ha}`;
        }

        function buildBody() {
            const ms = unitMs[currentZoom];
            const width = unitWidth[currentZoom];
            const units = [];
            let dt = parseLocalDate(settings.startDate);
            while (dt <= parseLocalDate(settings.endDate)) {
                units.push(new Date(dt));
                dt = new Date(dt.getTime() + ms);
            }

            let rows = '';

            settings.tasks.forEach((task, tIdx) => {
                let tColor = getRandomPastelHexColor(0.80);
                if (task.hasOwnProperty("color")) tColor = task.color;

                if (tIdx > 0 && !(task.dependsOn && task.dependsOn.length)) {
                    rows += `<tr class="gantt-separator"><td colspan="${units.length}"></td></tr>`;
                }
                rows += '<tr>';

                for (let i = 0; i < units.length; i++) {
                    const unitStart = units[i];
                    const isWeekend = unitStart.getDay()===0 || unitStart.getDay()===6;
                    const next = new Date(unitStart.getTime() + ms);
                    const s = parseLocalDate(task.start);
                    const today = new Date();
                    const isToday = today >= unitStart && today < next;
                    let cell = `<td class="${currentZoom!=='week' && isWeekend?'weekend':''} ${isToday?'today':''}" style="position:relative;width:${width}px;height:46px">`;

                    if (s >= unitStart && s < next) {
                        let e = parseLocalDate(task.end);
                        if (/^\d{4}-\d{2}-\d{2}$/.test(task.end)) e.setDate(e.getDate() + 1);

                        // keep your exact math
                        let barWidth = ((e - s) / ms * width * 1.02) + 5;
                        if (currentZoom == 'week') barWidth = ((e - s) / ms * width * 1.07) + 2;
                        if (currentZoom == 'hour') barWidth = ((e - s) / ms * width * 1.0332) + 6;

                        let offset = ((s - unitStart ) / ms * width);
                        if (currentZoom == 'hour') offset = ((s - unitStart + e.getTimezoneOffset()*1000) / ms * width) + 1;
                        if (currentZoom == 'week') offset = ((s - unitStart - 24 * 3600000 + e.getTimezoneOffset()*36000) / ms * width) - 1;

                        const progressWidth = barWidth * (task.progress || 0);
                        const formatter = new Intl.DateTimeFormat(undefined, { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
                        const time1 = formatter.format(s);
                        const time2 = formatter.format(e);
                        const title = task.label + `\n${time1} -> ${time2}\n` + durationBetween(task.start, task.end) + `\n` + ((task.progress || 0) * 100) + "%";
                        const style = `;background:${tColor};background: linear-gradient(180deg,${tColor} 10%, color-mix(in srgb,${tColor} 70%, black) 100%);border: 1px solid color-mix(in srgb, ${tColor} 80%, white)`;

                        // IMPORTANT id for arrows
                        const barHtml =
                            `<div id="task-${task.id}" class="gantt-bar" data-id="${task.id}" data-type="${task.type}" ` +
                            `style="width:${Math.abs(barWidth-8)}px;left:${offset}px;${style}" title="${title}">` +
                                `<div class="gantt-bar-progress" data-type="${task.type}" style="width:${progressWidth}px;background-color:color-mix(in srgb,${tColor} 65%, black)"></div>` +
                                `<span class="gantt-bar-duration">${durationBetween(task.start, task.end)}</span>` +
                            `</div>`;

                        cell += barHtml;
                    }
                    cell += '</td>';
                    rows += cell;
                }
                rows += '</tr>';
            });

            $(`${settings.target} #gantt-inner-table-body`).html(rows);
        }

        /* ----------------------------- Colored dependency arrows ----------------------------- */

        /*
         * getPxPerMsFromDOM()
         * Measure px-per-ms from the real header cells (keeps perfect sync with your grid).
         */
        function getPxPerMsFromDOM() {
            const $cells = $(`${settings.target} #gantt-inner-header-row > th`);
            if ($cells.length < 2) {
                const ms = unitMs[currentZoom];
                const px = unitWidth[currentZoom];
                return px / ms; // px per ms (fallback)
            }
            const a = $cells.get(0).getBoundingClientRect();
            const b = $cells.get(1).getBoundingClientRect();
            const dx = Math.abs(b.left - a.left);
            return dx / unitMs[currentZoom];
        }

        /*
         * color/style palette like MS Project:
         * - Critical: vivid red
         * - FS default: dark gray solid
         * - SS: blue dashed
         * - FF: green dotted
         * - SF: orange dash-dot
         */
        function colorForLink(type, critical) {
            if (critical) return '#d62728'; // red
            switch (type) {
                case 'FS': return '#444444';   // dark gray
                case 'SS': return '#2b8cbe';   // blue
                case 'FF': return '#31a354';   // green
                case 'SF': return '#e6550d';   // orange
                default:   return '#777777';
            }
        }
        function dashForLink(type, critical) {
            if (critical) return ''; // solid for critical
            if (type === 'SS') return '6,4';
            if (type === 'FF') return '2,3';
            if (type === 'SF') return '8,3,2,3'; // dash-dot
            return ''; // FS solid
        }

        /*
         * buildLinks(tasks, defaultType = 'FS')
         * Normalize task.dependsOn into [{from,to,type,lag,critical}]
         */
        function buildLinks(tasks, defaultType = 'FS') {
            const links = [];
            const valid = new Set(['FS', 'SS', 'FF', 'SF']);
            for (const t of tasks) {
                const deps = Array.isArray(t.dependsOn) ? t.dependsOn : [];
                for (const d of deps) {
                    if (typeof d === 'number') {
                        links.push({ from: d, to: t.id, type: defaultType, lag: 0, critical: false });
                    } else if (d && typeof d === 'object') {
                        const from = Number(d.task ?? d.id);
                        if (!Number.isFinite(from)) continue;
                        const type = String(d.type || defaultType).toUpperCase();
                        links.push({
                            from,
                            to: t.id,
                            type: valid.has(type) ? type : defaultType,
                            lag: d.lag ?? 0,
                            critical: !!d.critical
                        });
                    }
                }
            }
            return links;
        }

        /*
         * drawDependencies($content, options)
         * Render orthogonal rounded connectors with colored markers per type.
         */
        function drawDependencies($content, options) {
            const cfg = $.extend(true, {
                links: [],
                pxPerMs: null,
                barSelector: '.gantt-bar',
                idPrefix: 'task-',
                style: { strokeWidth: 1.75, radius: 6, hOut: 14, opacity: 0.95 }
            }, options || {});

            const ns = 'http://www.w3.org/2000/svg';

            // Ensure SVG overlay exists
            let $svg = $content.children('svg#gantt-arrows');
            if ($svg.length === 0) {
                $svg = $(document.createElementNS(ns, 'svg'))
                    .attr({ id: 'gantt-arrows' })
                    .css({ position: 'absolute', inset: 0, pointerEvents: 'none' })
                    .appendTo($content);
            }

            // Reset everything except we will rebuild <defs> (color markers)
            $svg.empty();

            // Build colorized markers
            const defs = document.createElementNS(ns, 'defs');
            const markerTypes = ['CRIT','FS','SS','FF','SF'];
            markerTypes.forEach(tp => {
                const color = (tp === 'CRIT') ? '#d62728' : colorForLink(tp, false);
                const marker = document.createElementNS(ns, 'marker');
                marker.setAttribute('id', 'arrowhead-' + tp);
                marker.setAttribute('markerWidth','10');
                marker.setAttribute('markerHeight','7');
                marker.setAttribute('refX','10');
                marker.setAttribute('refY','3.5');
                marker.setAttribute('orient','auto');
                const tip = document.createElementNS(ns, 'path');
                tip.setAttribute('d','M0,0 L10,3.5 L0,7 z');
                tip.setAttribute('fill', color);
                marker.appendChild(tip);
                defs.appendChild(marker);
            });
            $svg[0].appendChild(defs);

            // Size SVG to content scroll size
            const scrollWidth  = $content[0].scrollWidth;
            const scrollHeight = $content[0].scrollHeight;
            $svg.attr({ width: scrollWidth, height: scrollHeight, viewBox: `0 0 ${scrollWidth} ${scrollHeight}` });

            // Helpers
            function boxRelative($el) {
                const cr = $content[0].getBoundingClientRect();
                const er = $el[0].getBoundingClientRect();
                const x = er.left - cr.left + $content[0].scrollLeft;
                const y = er.top  - cr.top  + $content[0].scrollTop;
                return { x, y, w: $el.outerWidth(), h: $el.outerHeight() };
            }
            function lagToPixels(lag, pxPerMs) {
                if (lag == null) return 0;
                if (typeof lag === 'number') return lag; // already pixels
                const m = String(lag).trim().match(/^([+-]?\d+(?:\.\d+)?)([dhm])$/i);
                if (!m || pxPerMs == null) return 0;
                const val = parseFloat(m[1]);
                const unit = m[2].toLowerCase();
                let ms = 0;
                if (unit === 'd') ms = val * 24 * 3600000;
                else if (unit === 'h') ms = val * 3600000;
                else if (unit === 'm') ms = val * 60000;
                return ms * pxPerMs;
            }
            function anchorFor(box, side) {
                return (side === 'L')
                    ? { x: Math.round(box.x),         y: Math.round(box.y + box.h / 2) }
                    : { x: Math.round(box.x + box.w), y: Math.round(box.y + box.h / 2) };
            }
            function orthPathSides(sx, sy, ex, ey, sideFrom, sideTo, r, hOut) {
                const signFrom = (sideFrom === 'R') ? +1 : -1;
                const signTo   = (sideTo   === 'R') ? -1 : +1;
                const p1x = sx + signFrom * hOut, p1y = sy;
                const p2x = ex + signTo   * hOut, p2y = ey;
                const midX = Math.round((p1x + p2x) / 2);
                const pts = [[sx,sy],[p1x,p1y],[midX,sy],[midX,ey],[p2x,p2y],[ex,ey]];
                function cut(a,b,c,rad){
                    const [ax,ay]=a,[bx,by]=b,[cx,cy]=c;
                    const v1x=bx-ax,v1y=by-ay,v2x=cx-bx,v2y=cy-by;
                    const len1=Math.max(1,Math.hypot(v1x,v1y)),len2=Math.max(1,Math.hypot(v2x,v2y));
                    const r1x=(v1x/len1)*rad,r1y=(v1y/len1)*rad,r2x=(v2x/len2)*rad,r2y=(v2y/len2)*rad;
                    const pIn=[bx-r1x,by-r1y], pOut=[bx+r2x,by+r2y];
                    return { pIn, pOut, corner:b };
                }
                let d=`M ${pts[0][0]} ${pts[0][1]}`;
                for (let i=1;i<pts.length-1;i++){
                    const {pIn,pOut,corner}=cut(pts[i-1],pts[i],pts[i+1],r);
                    d += ` L ${pIn[0]} ${pIn[1]} Q ${corner[0]} ${corner[1]} ${pOut[0]} ${pOut[1]}`;
                }
                const last=pts[pts.length-1];
                d += ` L ${last[0]} ${last[1]}`;
                return d;
            }

            // Draw each colored link
            cfg.links.forEach(link => {
                const t = (link.type || 'FS').toUpperCase();
                const critical = !!link.critical;

                const $from = $('#'+cfg.idPrefix + link.from + cfg.barSelector);
                const $to   = $('#'+cfg.idPrefix + link.to   + cfg.barSelector);
                if ($from.length === 0 || $to.length === 0) return;

                const fb = boxRelative($from);
                const tb = boxRelative($to);

                const sideFrom = (t==='SS'||t==='SF') ? 'L' : 'R';
                const sideTo   = (t==='FF'||t==='SF') ? 'R' : 'L';

                let s = anchorFor(fb, sideFrom);
                let e = anchorFor(tb, sideTo);

                e.x = Math.round(e.x + lagToPixels(link.lag, cfg.pxPerMs));

                const stroke = colorForLink(t, critical);
                const dash   = dashForLink(t, critical);
                const markerId = critical ? 'arrowhead-CRIT' : ('arrowhead-' + t);

                const pathEl = document.createElementNS(ns, 'path');
                pathEl.setAttribute('d', orthPathSides(s.x, s.y, e.x, e.y, sideFrom, sideTo, cfg.style.radius, cfg.style.hOut));
                pathEl.setAttribute('fill', 'none');
                pathEl.setAttribute('stroke', stroke);
                pathEl.setAttribute('stroke-width', String(cfg.style.strokeWidth));
                pathEl.setAttribute('stroke-linecap', 'round');
                if (dash) pathEl.setAttribute('stroke-dasharray', dash);
                pathEl.setAttribute('opacity', String(cfg.style.opacity));
                pathEl.setAttribute('marker-end', 'url(#'+markerId+')');
                $svg[0].appendChild(pathEl);
            });
        }

        /*
         * renderArrows()
         * Measure DOM scale and draw arrows (re-call on scroll/zoom/resize).
         */
        function renderArrows() {
            const $inner  = $(`${settings.target} .gantt-inner-table`).css('position','relative');
            const pxPerMs = getPxPerMsFromDOM();
            const links   = buildLinks(settings.tasks, 'FS');
            drawDependencies($inner, {
                links,
                pxPerMs,
                barSelector: '.gantt-bar',
                idPrefix: 'task-',
                style: { strokeWidth: 1.75, radius: 6, hOut: 14, opacity: 0.95 }
            });
        }

        /* -------------------------------- Render pipeline -------------------------------- */

        function render() {
            buildHeader();
            buildLabels();
            buildBody();
            renderArrows();
        }

        function setZoom(z) {
            currentZoom = z;
            // Keep your grid logic; no change to your math
            if (currentZoom === 'week') unitWidth.week = settings.dayWidth;
            if (currentZoom === 'day')  unitWidth.day  = settings.dayWidth;
            if (currentZoom === 'hour') unitWidth.hour = settings.dayWidth * 0.6;
            render();
        }

        render();

        // Zoom buttons
        $(`${settings.target}`).on('click', '.zoom-buttons button', function() {
            $(`${settings.target} .zoom-buttons button`).removeClass('active');
            $(this).addClass('active');
            setZoom($(this).data('zoom'));
        });

        // Keep arrows aligned while scrolling
        $(`${settings.target} .gantt-scroll-wrap`).on('scroll', function() {
            renderArrows();
        });

        // Optional API
        return {
            update: (newTasks) => { settings.tasks = newTasks; render(); },
            setZoom
        };
    };

    // Optional bar click-through
    $(document).on('click', '.gantt-bar', function() {
        const url = $(this).data('url');
        if (url && url !== '#') window.location.href = url;
    });

})($);
