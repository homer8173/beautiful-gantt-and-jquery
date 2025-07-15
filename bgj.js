import $ from "https://esm.sh/jquery";

/**
 * jQuery BGJ Gantt Plugin
 * Initializes a Gantt chart within a specified target element using a provided template.
 *
 * Usage:
 * const bgj = $.bgj({
 *     target: '#target',
 *     template: `<table class="gantt-table-main">
 *                  <tr>
 *                    <td class="gantt-label-col">&nbsp;</td>
 *                    <td class="gantt-scroll-td" rowspan="2">
 *                      <div class="gantt-scroll-wrap">
 *                        <table class="gantt-inner-table" id="gantt-inner-table">
 *                          <thead><tr id="gantt-inner-header-row"></tr></thead>
 *                          <tbody id="gantt-inner-table-body"></tbody>
 *                        </table>
 *                      </div>
 *                    </td>
 *                  </tr>
 *                  <tr>
 *                    <td class="gantt-label-col" id="gantt-labels-col"></td>
 *                  </tr>
 *                </table>`,
 *     tasks: [...],
 *     startDate: new Date('2025-07-07'),
 *     endDate: new Date('2025-07-28'),
 *     dayWidth: 50
 * });
 */
(function($) {
    $.bgj = function(options) {
        const defaults = {
            target: '',
            template: `
<table class="gantt-table-main">
    <tr>
        <td class="gantt-label-col">&nbsp;</td>
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
            startDate: new Date(),
            endDate: new Date(),
            dayWidth: 50
        };

        const settings = $.extend({}, defaults, options);

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
            return new Date(str);
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
            const days = [];
            const nbdays = dateDiffDays(settings.startDate, settings.endDate) + 1;
            let dt = new Date(settings.startDate);

            for(let i = 0; i < nbdays; i++) {
                const day = dt.getDate();
                const month = (dt.getMonth()+1).toString().padStart(2, '0');
                const isWeekend = dt.getDay()===0 || dt.getDay()===6;
                days.push(`<th class="${isWeekend?'weekend':''}" style="min-width:${settings.dayWidth}px">${day}/${month}</th>`);
                dt = addDays(dt, 1);
            }

            $(`${settings.target} #gantt-inner-header-row`).html(days.join(''));
        }

        function buildLabels() {
            const html = settings.tasks.map(t => 
                `<div style="height:46px;line-height:46px;">${t.dependsOn.length ? '↳ ' : ''}${t.label}</div>`
            ).join('');

            $(`${settings.target} #gantt-labels-col`).html(html);
        }

        function buildBody() {
            const nbdays = dateDiffDays(settings.startDate, settings.endDate) + 1;
            let rows = '';

            settings.tasks.forEach((task, tIdx) => {
                if (tIdx > 0 && !task.dependsOn.length) {
                    rows += `<tr class="gantt-separator"><td colspan="${nbdays}"></td></tr>`;
                }
                rows += '<tr>';
                let dt = new Date(settings.startDate);

                for(let i = 0; i < nbdays; i++) {
                    const isWeekend = dt.getDay()===0 || dt.getDay()===6;
                    const sameDay = toYMD(dt) === toYMD(parseLocalDate(task.start));
                    let cell = `<td class="${isWeekend?'weekend':''}" style="position:relative;width:${settings.dayWidth}px;height:46px">`;

                    if(sameDay) {
                        const s = parseLocalDate(task.start);
                        let e = parseLocalDate(task.end);
                        if (/^\d{4}-\d{2}-\d{2}$/.test(task.end)) e.setDate(e.getDate() + 1);
                        const width = ((e - s) / 86400000 * settings.dayWidth) + 7;
                        const progressWidth = width * task.progress;

                        cell += `<div class="gantt-bar" data-id="${task.id}" data-type="${task.type}" style="width:${width-8}px;">
                            <div class="gantt-bar-progress" data-type="${task.type}" style="width:${progressWidth}px;"></div>
                            <span class="gantt-bar-duration">${durationBetween(task.start, task.end)}</span>
                        </div>`;
                    }
                    cell += '</td>';
                    rows += cell;
                    dt = addDays(dt,1);
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

        render();

        return {
            update: (newTasks) => { settings.tasks = newTasks; render(); }
        };
    };

    $(document).on('click', '.gantt-bar', function() {
        const url = $(this).data('url');
        if(url && url !== '#') window.location.href = url;
    });

})($);
