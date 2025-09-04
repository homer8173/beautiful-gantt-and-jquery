# beautiful-gantt-and-jquery
Display tasks in a beautiful gant

# first sample on codepen 
https://codepen.io/homer8173/pen/empNMNw

![Screenshot of a beautiful-gantt-and-jquery on codepen, BGJ](/first-sample.jpg)


# Realease with 3 zoom levels Week, Day, Hour 
https://codepen.io/homer8173/pen/RNWPBjj

![Screenshot of a beautiful-gantt-and-jquery on codepen, BGJ](/3zoom.jpg)


# Realease with task relations + milstones + no date mode
https://codepen.io/homer8173/pen/ogjMVbj

![Screenshot of a beautiful-gantt-and-jquery on codepen, BGJ](/final1.jpg)



# Task Data Model

Each Gantt row is defined by a `Task` object. All tasks are passed as an array to the plugin:

```js
const tasks = [ Task, Task, ... ];
```

## Task object

```ts
type Task = {
  id: number;                 // Unique identifier
  label: string;              // Display label
  start: string | Date;       // Start datetime (local)
  end: string | Date;         // End datetime (local)
  type?: string;              // Category (e.g. 'production', 'qa', 'shipping')
  durationMs?: number | null; // Optional, not used if start/end provided
  progress?: number;          // Progress ratio [0..1]
  dependsOn?: Dependency[];   // Incoming dependencies
  color?: string;             // Custom bar color (#RRGGBB or #RRGGBBAA)
};
```

### Dates
- Accepts `YYYY-MM-DD`, `YYYY-MM-DD HH:mm:ss`, or `YYYY-MM-DDTHH:mm:ss`.
- If `end` is given as `YYYY-MM-DD` (without time), the renderer automatically adds **+1 day** so the bar covers the full day.

### Progress
- Value in range `[0..1]`.
- Shown as a filled sub-bar.

### Color
- If omitted, a random pastel is generated.

---

## Dependencies (`dependsOn`)

Defines task links (arrows). Two notations are supported:

1. **Numeric**  
   Equivalent to a Finish-to-Start (FS) link without lag.  
   ```js
   dependsOn: [ 2 ]   // same as { task:2, type:'FS', lag:0 }
   ```

2. **Object**  
   Full control over link type, lag, and critical flag.  
   ```ts
   type Dependency = {
     task: number;                  // Source task id
     type?: 'FS'|'SS'|'FF'|'SF';    // Link type (default: 'FS')
     lag?: string | number;         // Lag:
                                    //   '+2d', '-3h', '+45m'
                                    //   or number of pixels
     critical?: boolean;            // If true: arrow is drawn in red
   };
   ```

---

## Link semantics

- **FS (Finish-to-Start)**: target starts after source finishes.  
  Anchors: source right → target left.
- **SS (Start-to-Start)**: target starts relative to source start.  
  Anchors: left → left.
- **FF (Finish-to-Finish)**: target finishes relative to source finish.  
  Anchors: right → right.
- **SF (Start-to-Finish)**: target finishes relative to source start.  
  Anchors: left → right.

---

## Lag

- Expressed in **time units**:  
  - `d` = days (24h)  
  - `h` = hours  
  - `m` = minutes  
  Example: `'+2d'`, `'-3h'`, `'+30m'`.
- Or as a **raw number** = pixel offset.

The renderer automatically converts time-based lag into pixels using the current zoom scale (measured from the header grid).

---

## Arrow colors & styles

- **Critical links** (`critical:true`) → solid red.
- Non-critical palette by type:
  - FS: dark gray, solid  
  - SS: blue, dashed  
  - FF: green, dotted  
  - SF: orange, dash-dot  

This mimics Microsoft Project conventions: critical path stands out, other link types are visually distinct.

---

## Examples

### Minimal (FS by default)
```js
const tasks = [
  { id:1, label:'A', start:'2025-07-07', end:'2025-07-08', progress:0.5 },
  { id:2, label:'B', start:'2025-07-09 09:00:00', end:'2025-07-12 18:00:00', dependsOn:[1] }
];
```

### All link types
```js
const tasks = [
  { id:1, label:'Spec',  start:'2025-07-07', end:'2025-07-08' },
  { id:2, label:'Dev',   start:'2025-07-08', end:'2025-07-18',
    dependsOn:[ { task:1, type:'FS' } ] },
  { id:3, label:'QA',    start:'2025-07-17', end:'2025-07-19',
    dependsOn:[ { task:2, type:'FF', lag:'+8h', critical:true } ] },
  { id:4, label:'Ship',  start:'2025-07-21', end:'2025-07-23',
    dependsOn:[ { task:3, type:'FS' } ] },
  { id:5, label:'Hotfix', start:'2025-07-24 09:00:00', end:'2025-07-24T12:15:00' },
  { id:6, label:'Rollout', start:'2025-07-25 14:00:00', end:'2025-07-25T14:18:00',
    dependsOn:[ { task:5, type:'SF', lag:'+1h' } ] }
];
```

### Mixed numeric + object
```js
dependsOn: [
  2,                               // FS without lag
  { task: 3, type: 'SS', lag: '-2h' },
  { task: 4, type: 'FF' }
]
```

---

## Best practices

- Use **FS** for most cases, reserve SS/FF/SF for special scheduling logic.  
- Mark only truly **critical** links with `critical:true` (red).  
- Prefer **time-based lag** (`+2d`, `-3h`) over raw pixels for zoom-safe behavior.  
- Avoid cycles (A depends on B and B depends on A). Cyclic dependencies are not supported.
