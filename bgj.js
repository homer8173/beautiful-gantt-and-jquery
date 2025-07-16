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

        const settings = $.extend({}, defaults, options);
        let currentZoom = 'day';
        const unitMs = { day: 86400000, week: 604800000, hour: 3600000 };
        const unitWidth = { day: settings.dayWidth, week: settings.dayWidth , hour: settings.dayWidth * .6 };

        if( settings.startDate=='auto'){
           settings.startDate= getMinStartDate(settings.tasks);
        }
        if( settings.endDate=='auto'){
           settings.endDate= getMaxEndDate(settings.tasks);
        } 
        // Inject template into target container
        $(settings.target).html(settings.template);

        function toYMD(d) {
            return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        }

        function msToDuration(ms) {
            let min = Math.floor(ms/60000);
            let h = Math.floor(min/60); min %= 60;
            let d = Math.floor(h/24); h %= 24;
            return [d ? d+'j' : '', h ? h+'h' : '', min ? min+'m' : ''].filter(Boolean).join('');
        }

        function parseLocalDate(str) { 
            // Replace space with T to unify formats like '2025-07-28 00:00'
            let clean = str.trim().replace(' ', 'T');

            // Split date and time parts
            const [datePart, timePart] = clean.split('T');

            // Extract Y, M, D
            const [y, m, d] = datePart.split('-').map(Number);

            let hours = 0, minutes = 0, seconds = 0;

            if (timePart) {
                const timeParts = timePart.split(':').map(Number);
                hours = timeParts[0] || 0;
                minutes = timeParts[1] || 0;
                seconds = timeParts[2] || 0;
            }

            // Construct the date in local time
            return new Date(y, m - 1, d, hours, minutes, seconds);
        }

        function durationBetween(start, end) {
            const s = parseLocalDate(start);
            let e = parseLocalDate(end);
            if (/^\d{4}-\d{2}-\d{2}$/.test(end)) e.setDate(e.getDate() + 1);
            return msToDuration(e - s);
        }

        function addDays(date, days) {
            const d = new Date(date);
            d.setDate(d.getDate() + days);
            return d;
        }

        function dateDiffDays(d1, d2) {
            return Math.round((d2-d1)/86400000);
        }

        function buildHeader() {
            const headers = [];
            const ms = unitMs[currentZoom];
            const width = unitWidth[currentZoom];
            const today = new Date();
            let dt = parseLocalDate(settings.startDate);

            while(dt <= parseLocalDate(settings.endDate)) {
                let label = '';
                if(currentZoom === 'week') {
                    const onejan = new Date(dt.getFullYear(),0,1);
                    const week = Math.ceil((((dt - onejan) / 86400000) + onejan.getDay()+1)/7);
                    label = 'W'+week;
                } else if(currentZoom === 'hour') {
                    const day = dt.getDate();
                    const month = (dt.getMonth()+1).toString().padStart(2,'0');
                    label = `<small>${day}/${month}</small>\n`+dt.getHours().toString().padStart(2,'0')+'h';
                } else {
                    const day = dt.getDate();
                    const month = (dt.getMonth()+1).toString().padStart(2,'0');
                    label = `${day}/${month}`;
                }
                const next = new Date(dt.getTime() + ms);
                const isWeekend = dt.getDay()===0 || dt.getDay()===6;
                const isToday = today >= dt && today < next;
                headers.push(`<th class="${isWeekend?'weekend':''} ${isToday?'today':''}" style="min-width:${width}px">${label}</th>`);
                dt = next;
            }

            $(`${settings.target} #gantt-inner-header-row`).html(headers.join(''));
        }

        function buildLabels() {
            const html = settings.tasks.map(t => 
                `<div class="gant-title">${t.dependsOn.length ? '&nbsp;&nbsp;<big>&#8627;</big>&nbsp;' : ''}${t.label}</div>`
            ).join('');

            $(`${settings.target} #gantt-labels-col`).html(html);
        }
        /**
         * Find the minimum start date from an array of tasks.
         * @param {Array} tasks - Array of task objects with start and end.
         * @returns {Date} The earliest start date in local time.
         */
        function getMinStartDate(tasks) {
            let minStart = null;
            for (const task of tasks) {
                const startDate = parseLocalDate(task.start);
                if (!minStart || startDate < minStart) minStart = startDate;
            }
            return minStart.toISOString().slice(0,10);
        }

        /**
         * Find the maximum end date from an array of tasks.
         * @param {Array} tasks - Array of task objects with start and end.
         * @returns {Date} The latest end date in local time.
         */
        function getMaxEndDate(tasks) {
            let maxEnd = null;
            for (const task of tasks) {
                const endDate = parseLocalDate(task.end);
                if (!maxEnd || endDate > maxEnd) maxEnd = endDate;
            }
            return maxEnd.toISOString().slice(0,10)+" 23:59:59";
        }
        function buildBody() {
            const ms = unitMs[currentZoom];
            const width = unitWidth[currentZoom];
            const units = [];
            let dt =parseLocalDate(settings.startDate);
            while(dt <= parseLocalDate(settings.endDate)) {
                units.push(new Date(dt));
                dt = new Date(dt.getTime() + ms);
            }

            let rows = '';

            settings.tasks.forEach((task, tIdx) => {
                let tColor = getRandomPastelHexColor(.80);
                if(task.hasOwnProperty("color"))
                  tColor = task.color
                if (tIdx > 0 && !task.dependsOn.length) {
                    rows += `<tr class="gantt-separator"><td colspan="${units.length}"></td></tr>`;
                }
                rows += '<tr>';
                dt = parseLocalDate(settings.startDate);

                for(let i = 0; i < units.length; i++) {
                    const unitStart = units[i];
                    const isWeekend = unitStart.getDay()===0 || unitStart.getDay()===6;
                    const next = new Date(unitStart.getTime() + ms);
                    const s = parseLocalDate(task.start);
                    const today = new Date();
                    const isToday = today >= unitStart && today < next;
                    let cell = `<td class="${currentZoom!=='week' && isWeekend?'weekend':''} ${isToday?'today':''}" style="position:relative;width:${width}px;height:46px">`;

                    if(s >= unitStart && s < next) {
                        let e = parseLocalDate(task.end);
                        if (/^\d{4}-\d{2}-\d{2}$/.test(task.end)) e.setDate(e.getDate() + 1);
                        // barwidth
                        let barWidth = ((e - s) / ms * width*1.02)+3 ;
                        if (currentZoom == 'week') 
                          barWidth = ((e - s) / ms * width*1.07) ;
                        if (currentZoom == 'hour') 
                          barWidth = ((e - s) / ms * width*1.0332)+4;
                        // offset
                        let offset = ((s - unitStart ) / ms * width);
                        if (currentZoom == 'hour')
                          offset = ((s - unitStart + e.getTimezoneOffset()*1000) / ms * width)+1;
                        if (currentZoom == 'week')
                          offset = ((s - unitStart - 24 * 3600000 + e.getTimezoneOffset()*36000) / ms * width)-1; 
                        const progressWidth = barWidth * task.progress;
                        const formatter = new Intl.DateTimeFormat(undefined, {    day: '2-digit',  month: '2-digit',  year: 'numeric',  hour: '2-digit',  minute: '2-digit',});
                        let time1 = formatter.format(s);
                        let time2 = formatter.format(e);
                        let title =task.label + "\n" + durationBetween(task.start, task.end) + ` ${time1} => ${time2}\n` + (task.progress * 100) + "%";
                        let style = `;background:${tColor};background: linear-gradient(180deg,${tColor} 10%, color-mix(in srgb,${tColor} 70%, black) 100%);border: 1px solid color-mix(in srgb, ${tColor} 80%, white)`;
                        cell += `<div class="gantt-bar" data-id="${task.id}" data-type="${task.type}" style="width:${Math.abs(barWidth-8)}px;left:${offset}px;${style}" title="${title}">
                            <div class="gantt-bar-progress" data-type="${task.type}" style="width:${progressWidth}px;background-color:color-mix(in srgb,${tColor} 65%, black)"></div>
                            <span class="gantt-bar-duration">${durationBetween(task.start, task.end)}</span>
                        </div>`;
                    }
                    cell += '</td>';
                    rows += cell;
                }
                rows += '</tr>';
            });

            $(`${settings.target} #gantt-inner-table-body`).html(rows);
        }

        function render() {
            buildHeader();
            buildLabels();
            buildBody();
        }
        /**
         * Generate a random pastel color with alpha
         * @param {number} alpha - Transparence entre 0 et 1
         * @returns {string} Couleur pastel au format #RRGGBBAA
         */
        function getRandomPastelHexColor(alpha = 1) {
            // valeurs entre 127 et 255 pour des tons clairs
            const r = Math.floor(127+64  + Math.random() * 64);
            const g = Math.floor(127+64  + Math.random() * 10);
            const b = Math.floor(127+64 + Math.random() * 64);
            const a = Math.round(alpha * 255);

            // Conversion en hex à 2 chiffres
            const hr = r.toString(16).padStart(2, '0');
            const hg = g.toString(16).padStart(2, '0');
            const hb = b.toString(16).padStart(2, '0');
            const ha = a.toString(16).padStart(2, '0');

            return `#${hr}${hg}${hb}${ha}`;
        }
        function setZoom(z) {
            currentZoom = z;
            render();
        }

        render();

        $(`${settings.target}`).on('click', '.zoom-buttons button', function() {
            $(`${settings.target} .zoom-buttons button`).removeClass('active');
            $(this).addClass('active');
            setZoom($(this).data('zoom'));
        });

        return {
            update: (newTasks) => { settings.tasks = newTasks; render(); },
            setZoom
        };
    };

    $(document).on('click', '.gantt-bar', function() {
        const url = $(this).data('url');
        if(url && url !== '#') window.location.href = url;
    });

})($);
