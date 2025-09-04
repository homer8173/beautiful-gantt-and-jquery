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

(function ($) {
  $.bgj = function (options) {
    const defaults = {
      target: "",
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
      milestones: [],
      // --- indexed mode (dates proches de 1970 = offsets) ---
      timeMode: "calendar", // 'calendar' | 'indexed'
      indexBase: "1970-01-01", // D1 = ce jour à 00:00 local
      indexLabelPrefix: "D",
      // -------------------------------------------------------
      startDate: "auto",
      endDate: "auto",
      dayWidth: 50
    };

    const settings = $.extend({}, defaults, options);
    let currentZoom = "day";
    const unitMs = { day: 86400000, week: 604800000, hour: 3600000 };
    const unitWidth = {
      day: settings.dayWidth,
      week: settings.dayWidth,
      hour: settings.dayWidth * 0.6
    };

    /* ---------------- Helpers ---------------- */
    function parseLocalDate(str) {
      if (str instanceof Date) return str;
      const clean = String(str).trim().replace(" ", "T");
      const [datePart, timePart] = clean.split("T");
      const [y, m, d] = datePart.split("-").map(Number);
      let hh = 0, mm = 0, ss = 0;
      if (timePart) {
        const t = timePart.split(":").map(Number);
        hh = t[0] || 0; mm = t[1] || 0; ss = t[2] || 0;
      }
      return new Date(y, m - 1, d, hh, mm, ss);
    }
    function toYMD(d) {
      return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0")
      ].join("-");
    }
    function msToDuration(ms) {
      let min = Math.floor(ms / 60000);
      let h = Math.floor(min / 60); min %= 60;
      let d = Math.floor(h / 24); h %= 24;
      return [d ? d + "j" : "", h ? h + "h" : "", min ? min + "m" : ""].filter(Boolean).join("");
    }

    // --- “indexed” = on garde tes start/end mais on calcule index/jour depuis indexBase
    const base = (() => {
      const b = parseLocalDate(settings.indexBase);
      b.setHours(0, 0, 0, 0);
      return b;
    })();
    const dayMs = 86400000;
    function dayIndexFromDate(dt) { // D1=1, D2=2...
      const d = new Date(dt.getTime());
      d.setHours(0, 0, 0, 0);
      return Math.floor((d - base) / dayMs) + 1;
    }
    function dateAtDayIndex(idx) {
      const d = new Date(base.getTime() + (idx - 1) * dayMs);
      d.setHours(0, 0, 0, 0);
      return d;
    }

    function taskStartDate(t) {
      return settings.timeMode === "indexed" ? parseLocalDate(t.start) : parseLocalDate(t.start);
    }
    function taskEndDate(t) {
      return settings.timeMode === "indexed" ? parseLocalDate(t.end) : parseLocalDate(t.end);
    }

    function getMinStartDate(tasks) {
      if (settings.timeMode === "indexed") {
        let minIdx = Infinity;
        for (const t of tasks) {
          const s = parseLocalDate(t.start);
          if (!isNaN(s)) minIdx = Math.min(minIdx, dayIndexFromDate(s));
        }
        const d = isFinite(minIdx) ? dateAtDayIndex(minIdx) : dateAtDayIndex(1);
        return toYMD(d);
      }
      let minStart = null;
      for (const t of tasks) {
        const s = parseLocalDate(t.start);
        if (!minStart || s < minStart) minStart = s;
      }
      return toYMD(minStart);
    }
    function getMaxEndDate(tasks) {
      if (settings.timeMode === "indexed") {
        let maxIdx = -Infinity;
        for (const t of tasks) {
          const e = parseLocalDate(t.end);
          if (!isNaN(e)) maxIdx = Math.max(maxIdx, dayIndexFromDate(e));
        }
        const d = isFinite(maxIdx) ? dateAtDayIndex(maxIdx) : dateAtDayIndex(1);
        return toYMD(d) + " 23:59:59";
      }
      let maxEnd = null;
      for (const t of tasks) {
        const e = parseLocalDate(t.end);
        if (!maxEnd || e > maxEnd) maxEnd = e;
      }
      return toYMD(maxEnd) + " 23:59:59";
    }

    if (settings.startDate === "auto") settings.startDate = getMinStartDate(settings.tasks);
    if (settings.endDate === "auto") settings.endDate = getMaxEndDate(settings.tasks);

    // Inject template
    $(settings.target).html(settings.template);

    /* ---------------- Header & labels ---------------- */
    function buildHeader() {
      const headers = [];
      const ms = unitMs[currentZoom];
      const width = unitWidth[currentZoom];
      const today = new Date();
      let dt = parseLocalDate(settings.startDate);
      let idx = dayIndexFromDate(dt);

      while (dt <= parseLocalDate(settings.endDate)) {
        let label = "";
        if (settings.timeMode === "indexed") {
          // toujours Dn, même en H/W
          label = `${settings.indexLabelPrefix}${idx}`;
        } else {
          if (currentZoom === "week") {
            const onejan = new Date(dt.getFullYear(), 0, 1);
            const week = Math.ceil(((dt - onejan) / 86400000 + onejan.getDay() + 1) / 7);
            label = "W" + week;
          } else if (currentZoom === "hour") {
            const day = dt.getDate();
            const month = (dt.getMonth() + 1).toString().padStart(2, "0");
            label = `<small>${day}/${month}</small> ` + dt.getHours().toString().padStart(2, "0") + "h";
          } else {
            const day = dt.getDate();
            const month = (dt.getMonth() + 1).toString().padStart(2, "0");
            label = `${day}/${month}`;
          }
        }

        const next = new Date(dt.getTime() + ms);
        const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
        const isToday = settings.timeMode === "calendar" && today >= dt && today < next;

        headers.push(
          `<th class="${(currentZoom !== "week" && isWeekend && settings.timeMode === "calendar") ? "weekend" : ""} ${isToday ? "today" : ""}" style="min-width:${width}px">${label}</th>`
        );
        dt = next;
        idx++;
      }

      $(`${settings.target} #gantt-inner-header-row`).html(headers.join(""));
    }

    function buildLabels() {
      const html = settings.tasks
        .map(t => `<div class="gant-title">${t.dependsOn && t.dependsOn.length ? "&nbsp;&nbsp;<big>&#8627;</big>&nbsp;" : ""}${t.label}</div>`)
        .join("");
      $(`${settings.target} #gantt-labels-col`).html(html);
    }

    function getRandomPastelHexColor(alpha = 1) {
      const r = Math.floor(127 + 64 + Math.random() * 64);
      const g = Math.floor(127 + 64 + Math.random() * 10);
      const b = Math.floor(127 + 64 + Math.random() * 64);
      const a = Math.round(alpha * 255);
      const hr = r.toString(16).padStart(2, "0");
      const hg = g.toString(16).padStart(2, "0");
      const hb = b.toString(16).padStart(2, "0");
      const ha = a.toString(16).padStart(2, "0");
      return `#${hr}${hg}${hb}${ha}`;
    }

    /* ---------------- Body (bars) ---------------- */
    function buildBody() {
      const ms = unitMs[currentZoom];
      const width = unitWidth[currentZoom];
      const units = [];
      let dt = parseLocalDate(settings.startDate);
      while (dt <= parseLocalDate(settings.endDate)) {
        units.push(new Date(dt));
        dt = new Date(dt.getTime() + ms);
      }

      let rows = "";
      settings.tasks.forEach((task, tIdx) => {
        let tColor = getRandomPastelHexColor(0.8);
        if (task.hasOwnProperty("color")) tColor = task.color;

        if (tIdx > 0 && !(task.dependsOn && task.dependsOn.length)) {
          rows += `<tr class="gantt-separator"><td colspan="${units.length}"></td></tr>`;
        }
        rows += "<tr>";

        for (let i = 0; i < units.length; i++) {
          const unitStart = units[i];
          const isWeekend = unitStart.getDay() === 0 || unitStart.getDay() === 6;
          const next = new Date(unitStart.getTime() + ms);
          const s = taskStartDate(task);
          const today = new Date();
          const isToday = settings.timeMode === "calendar" && (today >= unitStart && today < next);

          let cell = `<td class="${(currentZoom !== "week" && isWeekend && settings.timeMode === 'calendar') ? 'weekend' : ''} ${isToday ? 'today' : ''}" style="position:relative;width:${width}px;height:46px">`;

          if (s >= unitStart && s < next) {
            let e = taskEndDate(task);
            if (settings.timeMode === "calendar" && /^\d{4}-\d{2}-\d{2}$/.test(task.end)) e.setDate(e.getDate() + 1);

            // === BAR GEOMETRY: UNTOUCHED ===
            let barWidth = ((e - s) / ms) * width * 1.02 + 5;
            if (currentZoom == "week") barWidth = ((e - s) / ms) * width * 1.07 + 2;
            if (currentZoom == "hour") barWidth = ((e - s) / ms) * width * 1.0332 + 6;

            let offset = ((s - unitStart) / ms) * width;
            if (currentZoom == "hour") offset = ((s - unitStart + e.getTimezoneOffset() * 1000) / ms) * width + 1;
            if (currentZoom == "week") offset = ((s - unitStart - 24 * 3600000 + e.getTimezoneOffset() * 36000) / ms) * width - 1;

            const progressWidth = barWidth * (task.progress || 0);

            let title;
            if (settings.timeMode === "indexed") {
              const sIdx = dayIndexFromDate(s);
              const eIdx = dayIndexFromDate(e);
              title = `${task.label}\n${settings.indexLabelPrefix}${sIdx} -> ${settings.indexLabelPrefix}${eIdx}\n${msToDuration(e - s)}\n${(task.progress || 0) * 100}%`;
            } else {
              const fmt = new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
              title = `${task.label}\n${fmt.format(s)} -> ${fmt.format(e)}\n${msToDuration(e - s)}\n${(task.progress || 0) * 100}%`;
            }

            const style = `;background:${tColor};background: linear-gradient(180deg,${tColor} 10%, color-mix(in srgb,${tColor} 70%, black) 100%);border: 1px solid color-mix(in srgb, ${tColor} 80%, white)`;

            const barHtml =
              `<div id="task-${task.id}" class="gantt-bar" data-id="${task.id}" data-type="${task.type}" ` +
              `style="width:${Math.abs(barWidth - 8)}px;left:${offset}px;${style}" title="${title}">` +
              `<div class="gantt-bar-progress" data-type="${task.type}" style="width:${progressWidth}px;background-color:color-mix(in srgb,${tColor} 65%, black)"></div>` +
              `<span class="gantt-bar-duration">${msToDuration(e - s)}</span>` +
              `</div>`;

            cell += barHtml;
          }
          cell += "</td>";
          rows += cell;
        }
        rows += "</tr>";
      });

      $(`${settings.target} #gantt-inner-table-body`).html(rows);
    }

    /* ---------------- Connectors & Milestones ---------------- */
    function getPxPerMsFromDOM() {
      const $cells = $(`${settings.target} #gantt-inner-header-row > th`);
      if ($cells.length < 2) {
        const ms = unitMs[currentZoom];
        const px = unitWidth[currentZoom];
        return px / ms;
      }
      const a = $cells.get(0).getBoundingClientRect();
      const b = $cells.get(1).getBoundingClientRect();
      const dx = Math.abs(b.left - a.left);
      return dx / unitMs[currentZoom];
    }

    function colorForLink(type, critical) {
      if (critical) return "#d62728";
      switch (type) {
        case "FS": return "#444444";
        case "SS": return "#2b8cbe";
        case "FF": return "#31a354";
        case "SF": return "#e6550d";
        default: return "#777777";
      }
    }
    function dashForLink(type, critical) {
      if (critical) return "";
      if (type === "SS") return "6,4";
      if (type === "FF") return "2,3";
      if (type === "SF") return "8,3,2,3";
      return "";
    }

    function buildLinks(tasks, defaultType = "FF") {
      const links = [];
      const valid = new Set(["FS", "SS", "FF", "SF"]);
      for (const t of tasks) {
        const deps = Array.isArray(t.dependsOn) ? t.dependsOn : [];
        for (const d of deps) {
          if (typeof d === "number") {
            links.push({ from: d, to: t.id, type: defaultType, lag: 0, critical: false });
          } else if (d && typeof d === "object") {
            const from = Number(d.task ?? d.id);
            if (!Number.isFinite(from)) continue;
            const type = String(d.type || defaultType).toUpperCase();
            links.push({ from, to: t.id, type: valid.has(type) ? type : defaultType, lag: d.lag ?? 0, critical: !!d.critical });
          }
        }
      }
      return links;
    }

    // milestones (supporte aussi dates “indexed” autour de base)
    function drawMilestones($content, options) {
      const settings = $.extend(true, {
        milestones: [],
        startDate: null,
        pxPerHour: null,
        clusterPx: 20
      }, options || {});
      if (!(settings.startDate instanceof Date) || isNaN(settings.startDate)) return;
      if (typeof settings.pxPerHour !== 'number' || !isFinite(settings.pxPerHour)) return;

      const ns = 'http://www.w3.org/2000/svg';

      let $svg = $content.children('svg.bgj-marks');
      if ($svg.length === 0) {
        $svg = $(document.createElementNS(ns, 'svg'))
          .attr('class', 'bgj-marks')
          .css({ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 10 })
          .prependTo($content);
      }

      const scrollWidth = $content[0].scrollWidth;
      const scrollHeight = $content[0].scrollHeight;
      $svg.attr({ width: scrollWidth, height: scrollHeight, viewBox: `0 0 ${scrollWidth} ${scrollHeight}` });
      $svg.empty();

      function hoursBetween(a, b) { return (b - a) / 36e5; }

      let yMid = scrollHeight / 2;
      const tbody = $content.find('tbody')[0];
      if (tbody) {
        const cr = $content[0].getBoundingClientRect();
        const br = tbody.getBoundingClientRect();
        yMid = (br.top - cr.top) + $content[0].scrollTop + (br.height / 2);
      }

      const entries = settings.milestones.map(ms => {
        const date = parseLocalDate(ms.date);
        if (!(date instanceof Date) || isNaN(date)) return null;
        const x = Math.round(hoursBetween(settings.startDate, date) * settings.pxPerHour);
        return {
          x,
          label: ms.label || '',
          type: ms.type || '',
          color: ms.color || '#444',
          line: (ms.line || 'solid').toLowerCase(),
          size: Number.isFinite(ms.diamondSize) ? Number(ms.diamondSize) : 6
        };
      }).filter(Boolean).sort((a, b) => a.x - b.x);

      const clustered = [];
      let lastX = -Infinity;
      entries.forEach(item => {
        const tooClose = (item.x - lastX) < settings.clusterPx;
        clustered.push({ ...item, compact: tooClose });
        if (!tooClose) lastX = item.x;
      });

      const pad = 6;
      clustered.forEach(ms => {
        const g = document.createElementNS(ns, 'g');
        g.setAttribute('class', 'bgj-milestone');
        g.setAttribute('style', 'color:' + ms.color);
        if (ms.type) g.setAttribute('data-type', ms.type);
        if (ms.label) g.setAttribute('data-label', ms.label);

        if (!ms.compact) {
          const line = document.createElementNS(ns, 'line');
          line.setAttribute('class', 'bgj-ms-line');
          line.setAttribute('x1', ms.x); line.setAttribute('y1', 0);
          line.setAttribute('x2', ms.x); line.setAttribute('y2', scrollHeight);
          line.setAttribute('stroke', ms.color);
          line.setAttribute('stroke-width', '1.5');
          if (ms.line === 'dashed') line.setAttribute('stroke-dasharray', '6,4');
          g.appendChild(line);
        }

        const s = ms.size;
        const diamond = document.createElementNS(ns, 'path');
        diamond.setAttribute('class', 'bgj-ms-diamond');
        const d = `M ${ms.x} ${yMid - s} L ${ms.x + s} ${yMid} L ${ms.x} ${yMid + s} L ${ms.x - s} ${yMid} Z`;
        diamond.setAttribute('d', d);
        diamond.setAttribute('fill', ms.color);
        diamond.setAttribute('opacity', '0.95');
        diamond.setAttribute('vector-effect', 'non-scaling-stroke');
        g.appendChild(diamond);

        if (ms.label) {
          const text = document.createElementNS(ns, 'text');
          text.setAttribute('class', 'bgj-ms-label');
          text.setAttribute('x', ms.x - pad);
          text.setAttribute('y', 8);
          text.setAttribute('text-anchor', 'end');
          text.setAttribute('fill', ms.color);
          text.textContent = ms.label;
          g.appendChild(text);
        }

        $svg[0].appendChild(g);
      });
    }

    // --- Connecteurs (3 segments, 2 arrondis) ---
    function drawDependencies($content, options) {
      const cfg = $.extend(true, {
        links: [],
        pxPerMs: null,
        barSelector: ".gantt-bar",
        idPrefix: "task-",
        style: { strokeWidth: 1.75, hOut: 14, radius: 6, opacity: 0.95 }
      }, options || {});
      const ns = "http://www.w3.org/2000/svg";

      let $svg = $content.children("svg#gantt-arrows");
      if ($svg.length === 0) {
        $svg = $(document.createElementNS(ns, "svg"))
          .attr({ id: "gantt-arrows" })
          .css({ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 20 })
          .appendTo($content);
      }
      $svg.empty();

      const defs = document.createElementNS(ns, "defs");
      ["CRIT", "FS", "SS", "FF", "SF"].forEach(tp => {
        const color = tp === "CRIT" ? "#d62728" : colorForLink(tp, false);
        const mk = document.createElementNS(ns, "marker");
        mk.setAttribute("id", "arrowhead-" + tp);
        mk.setAttribute("markerUnits", "userSpaceOnUse");
        mk.setAttribute("markerWidth", "10");
        mk.setAttribute("markerHeight", "8");
        mk.setAttribute("refX", "9");
        mk.setAttribute("refY", "4");
        mk.setAttribute("orient", "auto");
        const tip = document.createElementNS(ns, "path");
        tip.setAttribute("d", "M0,0 L9,4 L0,8 z");
        tip.setAttribute("fill", color);
        mk.appendChild(tip);
        defs.appendChild(mk);
      });
      $svg[0].appendChild(defs);

      const w = $content[0].scrollWidth;
      const h = $content[0].scrollHeight;
      $svg.attr({ width: w, height: h, viewBox: `0 0 ${w} ${h}` });

      function boxViaOffsets(el, stop) {
        let x = 0, y = 0;
        for (let n = el; n && n !== stop; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
        return { x, y, w: el.offsetWidth, h: el.offsetHeight };
      }
      function anchorFromBar($bar, side) {
        const el = $bar[0];
        const parent = el.offsetParent || el.parentElement;
        const pb = boxViaOffsets(parent, $content[0]);
        const cs = getComputedStyle(el);
        const bl = parseFloat(cs.borderLeftWidth) || 0;
        const br = parseFloat(cs.borderRightWidth) || 0;
        const localStart = el.offsetLeft + bl;
        const localEnd = el.offsetLeft + el.offsetWidth - br;
        const x = Math.round(pb.x + (side === "L" ? localStart : localEnd));
        const y = Math.round(pb.y + el.offsetTop + el.offsetHeight / 2);
        return { x, y };
      }
      function lagToPixels(lag, pxPerMs) {
        if (lag == null) return 0;
        if (typeof lag === "number") return lag;
        const m = String(lag).trim().match(/^([+-]?\d+(?:\.\d+)?)([dhm])$/i);
        if (!m || pxPerMs == null) return 0;
        const val = parseFloat(m[1]), unit = m[2].toLowerCase();
        let ms = 0;
        if (unit === "d") ms = val * 24 * 3600000;
        else if (unit === "h") ms = val * 3600000;
        else if (unit === "m") ms = val * 60000;
        return ms * pxPerMs;
      }

      function smartSides(type) {
        switch ((type || 'FS').toUpperCase()) {
          case 'SS': return { from: 'L', to: 'L' };
          case 'FF': return { from: 'R', to: 'R' };
          case 'SF': return { from: 'L', to: 'R' };
          case 'FS':
          default: return { from: 'R', to: 'L' };
        }
      }

      function simpleOrthPath(sx, sy, ex, ey, sideFrom, sideTo, hOut, r = 6) {
        const signFrom = sideFrom === "R" ? +1 : -1;
        const p1x = sx + signFrom * hOut, p1y = sy;
        const p2x = p1x, p2y = ey;

        function roundCorner(ax, ay, bx, by, cx, cy, rad) {
          const v1x = ax - bx, v1y = ay - by, v2x = cx - bx, v2y = cy - by;
          const l1 = Math.hypot(v1x, v1y) || 1, l2 = Math.hypot(v2x, v2y) || 1;
          const inX = bx + (v1x / l1) * rad, inY = by + (v1y / l1) * rad;
          const outX = bx + (v2x / l2) * rad, outY = by + (v2y / l2) * rad;
          return { inX, inY, outX, outY, bx, by };
        }
        const c1 = roundCorner(sx, sy, p1x, p1y, p2x, p2y, r);
        const c2 = roundCorner(p1x, p1y, p2x, p2y, ex, ey, r);

        let d = `M ${sx} ${sy}`;
        d += ` L ${c1.inX} ${c1.inY} Q ${c1.bx} ${c1.by} ${c1.outX} ${c1.outY}`;
        d += ` L ${c2.inX} ${c2.inY} Q ${c2.bx} ${c2.by} ${c2.outX} ${c2.outY}`;
        d += ` L ${ex} ${ey}`;
        return d;
      }

      cfg.links.forEach(link => {
        const t = (link.type || "FS").toUpperCase();
        const critical = !!link.critical;

        const $from = $content.find("#" + cfg.idPrefix + link.from + cfg.barSelector);
        const $to = $content.find("#" + cfg.idPrefix + link.to + cfg.barSelector);
        if ($from.length === 0 || $to.length === 0) return;

        const { from: sideFrom, to: sideTo } = smartSides(t);
        const s = anchorFromBar($from, sideFrom);
        const e0 = anchorFromBar($to, sideTo);
        const e = { x: Math.round(e0.x + lagToPixels(link.lag, cfg.pxPerMs)), y: e0.y };

        const stroke = colorForLink(t, critical);
        const dash = dashForLink(t, critical);
        const markerId = critical ? "arrowhead-CRIT" : "arrowhead-" + t;

        const pathEl = document.createElementNS(ns, "path");
        pathEl.setAttribute("d", simpleOrthPath(s.x, s.y, e.x, e.y, sideFrom, sideTo, cfg.style.hOut, cfg.style.radius));
        pathEl.setAttribute("fill", "none");
        pathEl.setAttribute("stroke", stroke);
        pathEl.setAttribute("stroke-width", String(cfg.style.strokeWidth));
        pathEl.setAttribute("stroke-linecap", "butt");
        if (dash) pathEl.setAttribute("stroke-dasharray", dash);
        pathEl.setAttribute("opacity", String(cfg.style.opacity));
        pathEl.setAttribute("marker-end", "url(#" + markerId + ")");
        $svg[0].appendChild(pathEl);
      });
    }

    function renderArrows() {
      const $inner = $(`${settings.target} .gantt-inner-table`).css('position', 'relative');
      const pxPerMs = getPxPerMsFromDOM();
      const links = buildLinks(settings.tasks, 'FS');

      drawDependencies($inner, {
        links, pxPerMs,
        barSelector: '.gantt-bar',
        idPrefix: 'task-',
        style: { strokeWidth: 1.75, radius: 6, hOut: 14, opacity: 0.95 }
      });

      const startDateAsDate = parseLocalDate(settings.startDate);
      const pxPerHour = pxPerMs * 3600000;

      drawMilestones($inner, {
        milestones: settings.milestones || [],
        startDate: startDateAsDate,
        pxPerHour: pxPerHour,
        clusterPx: 24
      });
    }

    /* ---------------- Render pipeline ---------------- */
    function render() {
      buildHeader();
      buildLabels();
      buildBody();
      renderArrows();
    }
    function setZoom(z) {
      currentZoom = z;
      if (currentZoom === "week") unitWidth.week = settings.dayWidth;
      if (currentZoom === "day") unitWidth.day = settings.dayWidth;
      if (currentZoom === "hour") unitWidth.hour = settings.dayWidth * 0.6;
      render();
    }

    render();

    $(`${settings.target}`).on("click", ".zoom-buttons button", function () {
      $(`${settings.target} .zoom-buttons button`).removeClass("active");
      $(this).addClass("active");
      setZoom($(this).data("zoom"));
    });
    $(`${settings.target} .gantt-scroll-wrap`).on("scroll", function () {
      renderArrows();
    });

    return {
      update: (newTasks) => { settings.tasks = newTasks; render(); },
      setZoom
    };
  };

  $(document).on("click", ".gantt-bar", function () {
    const url = $(this).data("url");
    if (url && url !== "#") window.location.href = url;
  });
})($);
