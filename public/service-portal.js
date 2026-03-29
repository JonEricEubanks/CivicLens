/**
 * CivicLens Connect - AI-Guided Resident Service Portal
 */
(function () {
  'use strict';

  const CATEGORIES = [
    {
      id: 'streets', label: 'Streets & Roads', color: '#ef4444',
      icon: () => CivicIcons.pothole('w-5 h-5'),
      types: [
        { id: 'pothole', label: 'Pothole Report', desc: 'Report a pothole on a public road or street.' },
        { id: 'road_damage', label: 'Road Surface Damage', desc: 'Cracking, buckling, or deteriorating road surfaces.' },
        { id: 'street_sweeping', label: 'Street Sweeping Request', desc: 'Request sweeping or debris removal from a public roadway.' },
      ]
    },
    {
      id: 'sidewalks', label: 'Sidewalks & Paths', color: '#f97316',
      icon: () => CivicIcons.sidewalk('w-5 h-5'),
      types: [
        { id: 'sidewalk', label: 'Sidewalk Crack / Heave', desc: 'Cracked, raised, or uneven sidewalk panels.' },
        { id: 'crosswalk', label: 'Crosswalk / Road Marking', desc: 'Faded or missing crosswalk lines and road markings.' },
        { id: 'ada_access', label: 'ADA Accessibility Concern', desc: 'Barrier to accessibility on walkways or curb ramps.' },
      ]
    },
    {
      id: 'trees', label: 'Trees & Forestry', color: '#22c55e',
      icon: () => CivicIcons.tree('w-5 h-5'),
      types: [
        { id: 'tree_damage', label: 'Fallen Branch / Tree', desc: 'Tree or branch fallen on public property or blocking road.' },
        { id: 'tree_trimming', label: 'Tree Trimming Request', desc: 'Village-owned tree encroaching on a roadway or sidewalk.' },
        { id: 'dead_tree', label: 'Dead / Diseased Tree', desc: 'Tree on public property that appears dead or at risk.' },
      ]
    },
    {
      id: 'streetlights', label: 'Streetlights & Signals', color: '#eab308',
      icon: () => CivicIcons.streetlight('w-5 h-5'),
      types: [
        { id: 'streetlight', label: 'Streetlight Out', desc: 'Not working, flickering, or stays on during day.' },
        { id: 'traffic_signal', label: 'Traffic Signal Issue', desc: 'Malfunctioning traffic light or timing problem.' },
        { id: 'ped_signal', label: 'Pedestrian Signal', desc: 'Broken or missing pedestrian crossing signal.' },
      ]
    },
    {
      id: 'drainage', label: 'Drainage & Flooding', color: '#06b6d4',
      icon: () => CivicIcons.drainage('w-5 h-5'),
      types: [
        { id: 'drainage', label: 'Storm Drain Blocked', desc: 'Clogged or blocked storm drain on a public street.' },
        { id: 'standing_water', label: 'Standing Water', desc: 'Standing water on roadway or sidewalk not draining.' },
        { id: 'flooding', label: 'Flooding Concern', desc: 'Flooding on public property or near residential areas.' },
      ]
    },
    {
      id: 'signs', label: 'Signs & Markings', color: '#8b5cf6',
      icon: () => CivicIcons.sign('w-5 h-5'),
      types: [
        { id: 'sign_damage', label: 'Damaged / Missing Sign', desc: 'Street sign damaged, leaning, knocked over, or missing.' },
        { id: 'sign_faded', label: 'Faded Sign', desc: 'Sign unreadable due to fading or sun damage.' },
        { id: 'new_sign', label: 'New Sign Request', desc: 'Request installation of a new traffic or street sign.' },
      ]
    },
    {
      id: 'property', label: 'Property Maintenance', color: '#d946ef',
      icon: () => CivicIcons.home('w-5 h-5'),
      types: [
        { id: 'overgrown', label: 'Overgrown Vegetation', desc: 'Overgrown weeds, grass, or bushes on a property.' },
        { id: 'abandoned', label: 'Abandoned Property', desc: 'Property that appears vacant or significantly unmaintained.' },
        { id: 'fence_damage', label: 'Fence / Structure Concern', desc: 'Damaged fence or structure affecting public safety.' },
      ]
    },
    {
      id: 'parks', label: 'Parks & Recreation', color: '#14b8a6',
      icon: () => CivicIcons.tree('w-5 h-5'),
      types: [
        { id: 'playground', label: 'Playground Equipment', desc: 'Broken or unsafe playground equipment in a public park.' },
        { id: 'trail_issue', label: 'Trail Maintenance', desc: 'Issues on public walking or biking trails.' },
        { id: 'park_facility', label: 'Park Facility Issue', desc: 'Issues with park restrooms, benches, or pavilions.' },
      ]
    },
    {
      id: 'sewer', label: 'Sewer & Water', color: '#0ea5e9',
      icon: () => CivicIcons.drainage('w-5 h-5'),
      types: [
        { id: 'sewer_backup', label: 'Sewer Backup', desc: 'Sewer backup or sewage overflow. For emergencies, call 911.' },
        { id: 'water_main', label: 'Water Main Issue', desc: 'Water main break, leak, or discolored water supply.' },
        { id: 'hydrant', label: 'Fire Hydrant', desc: 'Damaged, leaking, or obstructed fire hydrant.' },
      ]
    },
    {
      id: 'parking', label: 'Parking', color: '#64748b',
      icon: () => CivicIcons.sign('w-5 h-5'),
      types: [
        { id: 'illegal_parking', label: 'Illegal Parking', desc: 'Vehicle parked illegally on a public street.' },
        { id: 'meter_issue', label: 'Parking Meter Issue', desc: 'Broken or malfunctioning parking meter.' },
        { id: 'handicap_zone', label: 'Handicapped Zone Violation', desc: 'Unauthorized use of a handicapped parking space.' },
      ]
    },
    {
      id: 'safety', label: 'Public Safety', color: '#dc2626',
      icon: () => CivicIcons.shield('w-5 h-5'),
      types: [
        { id: 'abandoned_vehicle', label: 'Abandoned Vehicle', desc: 'Vehicle abandoned on a public street for 7+ days.' },
        { id: 'graffiti', label: 'Graffiti Removal', desc: 'Graffiti on public property, bridges, or visible location.' },
        { id: 'hazard', label: 'Hazardous Condition', desc: 'Public safety hazard. For emergencies, call 911.' },
      ]
    },
    {
      id: 'general', label: 'General', color: '#6366f1',
      icon: () => CivicIcons.clipboard('w-5 h-5'),
      types: [
        { id: 'other', label: 'Other Issue', desc: 'Any issue not covered by the categories above.' },
        { id: 'question', label: 'General Question', desc: 'General question or inquiry about village services.' },
        { id: 'compliment', label: 'Compliment / Feedback', desc: 'Positive feedback about village staff or services.' },
      ]
    },
  ];

  /* ── STATE ── */
  let overlay = null;
  let communityData = null;
  let mapMarkerData = null;
  let leafletMap = null;
  let markerLayer = null;
  let markerById = {};
  let pinMarker = null;
  let pinCoords = null;

  let mode = 'home';
  let rightView = 'map';

  let wizStep = 0;
  let wizText = '';
  let wizCategory = null;
  let wizAddress = '';
  let wizPhoto = null;
  let wizLat = null;
  let wizLng = null;
  let wizEmail = '';
  let wizNotify = false;
  let wizName = '';
  let wizAnonymous = false;

  let activeCat = null;
  let searchTerm = '';
  let activeIssue = null;
  let lastTracking = '';
  let liveEventSource = null;
  var spAllMarkerEntries = [];
  var spVisibleTypes = {};

  /* ── HELPERS ── */
  const esc = window.CivicUtils.escapeHtml;

  function timeAgo(d) {
    if (!d) return '';
    // Compare calendar dates in local timezone to avoid UTC midnight rounding errors
    const now = new Date();
    const then = new Date(d + 'T00:00:00'); // parse as local midnight, not UTC
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thenDay = new Date(then.getFullYear(), then.getMonth(), then.getDate());
    const days = Math.round((nowDay - thenDay) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return days + ' days ago';
    if (days < 30) return Math.floor(days / 7) + (Math.floor(days / 7) > 1 ? ' weeks' : ' week') + ' ago';
    if (days < 365) return Math.floor(days / 30) + (Math.floor(days / 30) > 1 ? ' months' : ' month') + ' ago';
    return '1+ year ago';
  }

  function effectiveStatus(issue) {
    if (issue.status === 'completed') return 'completed';
    if (issue.status === 'in_progress') return 'in_progress';
    if (issue.updates && issue.updates.length > 0) return 'received';
    return 'submitted';
  }

  function statusDots(status, sz) {
    const stages = [
      { key: 'submitted', c: '#ef4444', l: 'Submitted' },
      { key: 'received',  c: '#f59e0b', l: 'Received' },
      { key: 'in_progress', c: '#3b82f6', l: 'In Progress' },
      { key: 'completed', c: '#10b981', l: 'Completed' },
    ];
    const idx = { submitted: 0, received: 1, in_progress: 2, completed: 3 }[status] || 0;
    const d = sz === 'lg' ? 14 : 8;
    const g = sz === 'lg' ? 5 : 3;
    const x = sz === 'lg' ? 18 : 12;
    let h = '<div style="display:flex;align-items:center;gap:' + g + 'px">';
    for (let i = 0; i < stages.length; i++) {
      const active = i <= idx;
      const col = active ? stages[i].c : '#cbd5e1';
      if (i === stages.length - 1) {
        h += '<svg width="' + x + '" height="' + x + '" viewBox="0 0 24 24" fill="none" stroke="' + col + '" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
      } else {
        const glow = active && i === idx ? 'box-shadow:0 0 ' + d + 'px ' + col + '50;' : '';
        h += '<div style="width:' + d + 'px;height:' + d + 'px;border-radius:50%;background:' + col + ';' + glow + 'flex-shrink:0"></div>';
        h += '<div style="width:' + (g * 3) + 'px;height:2px;background:' + (i < idx ? stages[i + 1].c : '#e2e8f0') + ';flex-shrink:0"></div>';
      }
    }
    h += '</div>';
    const fs = sz === 'lg' ? 13 : 10;
    h += '<div style="font-size:' + fs + 'px;font-weight:600;color:' + stages[idx].c + ';margin-top:2px;white-space:nowrap">' + stages[idx].l + '</div>';
    return h;
  }

  /* ── AI CATEGORY DETECTION ── */
  function aiDetectCategory(text) {
    const t = text.toLowerCase();
    const rules = [
      [/pothole|pot\s*hole|road.*hole|bump.*road/i, 'streets', 'pothole'],
      [/crack.*road|road.*damage|road.*surface|buckling/i, 'streets', 'road_damage'],
      [/sweep|debris.*road|road.*debris/i, 'streets', 'street_sweeping'],
      [/sidewalk.*crack|sidewalk.*heave|uneven.*sidewalk|trip.*sidewalk/i, 'sidewalks', 'sidewalk'],
      [/crosswalk|road.*marking|faded.*line|painted.*line/i, 'sidewalks', 'crosswalk'],
      [/ada|wheelchair|accessib|curb.*ramp/i, 'sidewalks', 'ada_access'],
      [/fallen.*tree|tree.*fell|branch.*down|tree.*block/i, 'trees', 'tree_damage'],
      [/trim.*tree|tree.*trim|branch.*hang|overhang.*tree/i, 'trees', 'tree_trimming'],
      [/dead.*tree|diseased.*tree|dying.*tree/i, 'trees', 'dead_tree'],
      [/streetlight|street.*light|lamp.*post|light.*out|dark.*street/i, 'streetlights', 'streetlight'],
      [/traffic.*light|traffic.*signal|red.*light|signal.*broken/i, 'streetlights', 'traffic_signal'],
      [/pedestrian.*signal|walk.*signal|crossing.*button/i, 'streetlights', 'ped_signal'],
      [/drain.*block|storm.*drain|clog.*drain|catch.*basin/i, 'drainage', 'drainage'],
      [/standing.*water|puddle|water.*sit|water.*pool/i, 'drainage', 'standing_water'],
      [/flood|water.*everywhere|water.*rise/i, 'drainage', 'flooding'],
      [/sign.*damage|sign.*miss|sign.*down|sign.*lean|knocked.*sign/i, 'signs', 'sign_damage'],
      [/sign.*fad|sign.*read|sign.*peel/i, 'signs', 'sign_faded'],
      [/new.*sign|need.*sign|install.*sign/i, 'signs', 'new_sign'],
      [/overgrown|weeds|tall.*grass|untrim/i, 'property', 'overgrown'],
      [/abandon.*prop|vacant.*house|boarded/i, 'property', 'abandoned'],
      [/fence.*damage|fence.*broken|fence.*lean/i, 'property', 'fence_damage'],
      [/playground|swing|slide.*broken|monkey.*bar/i, 'parks', 'playground'],
      [/trail|path.*erosion|bike.*path/i, 'parks', 'trail_issue'],
      [/park.*restroom|park.*bench|pavilion|shelter/i, 'parks', 'park_facility'],
      [/sewer|sewage|backup.*pipe/i, 'sewer', 'sewer_backup'],
      [/water.*main|water.*break|water.*leak|discolor.*water/i, 'sewer', 'water_main'],
      [/hydrant|fire.*hydrant/i, 'sewer', 'hydrant'],
      [/illegal.*park|parked.*illegal|no.*park/i, 'parking', 'illegal_parking'],
      [/meter.*broken|parking.*meter/i, 'parking', 'meter_issue'],
      [/handicap.*park|disabled.*park/i, 'parking', 'handicap_zone'],
      [/abandon.*vehicle|abandon.*car|car.*sit/i, 'safety', 'abandoned_vehicle'],
      [/graffiti|vandal|spray.*paint/i, 'safety', 'graffiti'],
      [/hazard|danger|wire.*expos|chemical/i, 'safety', 'hazard'],
    ];
    for (const [re, catId, typeId] of rules) {
      if (re.test(t)) return { catId, typeId, confidence: 0.92 };
    }
    return { catId: 'general', typeId: 'other', confidence: 0.5 };
  }

  /* ── SVG ICONS ── */
  const I = {
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
    chevR: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>',
    chevL: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>',
    map: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg>',
    list: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    photo: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    users: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    comment: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    check: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>',
    close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>',
    ai: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a4 4 0 014 4v1a1 1 0 001 1h1a4 4 0 010 8h-1a1 1 0 00-1 1v1a4 4 0 01-8 0v-1a1 1 0 00-1-1H6a4 4 0 010-8h1a1 1 0 001-1V6a4 4 0 014-4z"/><circle cx="12" cy="12" r="3"/></svg>',
    wand: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M12.2 6.2l-1.4-1.4M17.8 6.2l1.4-1.4M12.2 11.8l-1.4 1.4"/><path d="M2 22l10-10"/><path d="M13 11l1 1"/></svg>',
    folder: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
    track: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    mapPin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    send: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    target: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  };

  /* ── CSS ── */
  function getCSS() {
    return `
    #civic-connect * { box-sizing:border-box; margin:0; padding:0; }
    #civic-connect { font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }
    @keyframes ccFadeIn { from{opacity:0;transform:scale(.98)} to{opacity:1;transform:scale(1)} }
    @keyframes ccSlide { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
    @keyframes ccSlideL { from{transform:translateX(-24px);opacity:0} to{transform:translateX(0);opacity:1} }
    @keyframes ccGrad { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
    @keyframes ccPulse { 0%,100%{opacity:1} 50%{opacity:.35} }
    @keyframes ccFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
    @keyframes ccDotBounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
    @keyframes ccShimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
    @keyframes ccCheckPop { 0%{transform:scale(0);opacity:0} 50%{transform:scale(1.2)} 100%{transform:scale(1);opacity:1} }
    @keyframes ccRipple { 0%{box-shadow:0 0 0 0 rgba(99,102,241,.4)} 100%{box-shadow:0 0 0 12px rgba(99,102,241,0)} }
    @keyframes ccConfetti { 0%{transform:translateY(0) rotate(0);opacity:1} 100%{transform:translateY(-30px) rotate(180deg);opacity:0} }
    #civic-connect { animation:ccFadeIn .35s cubic-bezier(.16,1,.3,1); }
    .cc-anim { animation:ccSlide .4s cubic-bezier(.16,1,.3,1) both; }
    .cc-anim-l { animation:ccSlideL .35s cubic-bezier(.16,1,.3,1) both; }
    .cc-header { background:linear-gradient(135deg,#0c1222 0%,#131c35 30%,#0e2a2e 60%,#0d1117 100%); background-size:300% 300%; animation:ccGrad 20s ease infinite; position:relative; overflow:hidden; }
    .cc-header::before { content:''; position:absolute; top:-50%; left:-50%; width:200%; height:200%; background:radial-gradient(circle at 30% 20%,rgba(99,102,241,.08) 0%,transparent 40%),radial-gradient(circle at 70% 80%,rgba(16,185,129,.06) 0%,transparent 40%); pointer-events:none; animation:ccGrad 15s ease infinite reverse; }
    .cc-header::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg,rgba(255,255,255,.02) 0%,transparent 100%); pointer-events:none; }
    .cc-glass { background:rgba(255,255,255,.06); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,.08); border-radius:18px; transition:all .25s cubic-bezier(.16,1,.3,1); position:relative; overflow:hidden; }
    .cc-glass::before { content:''; position:absolute; inset:0; border-radius:18px; background:linear-gradient(135deg,rgba(255,255,255,.08) 0%,transparent 50%); pointer-events:none; }
    .cc-glass:hover { background:rgba(255,255,255,.1); border-color:rgba(255,255,255,.18); transform:translateY(-3px); box-shadow:0 12px 40px rgba(0,0,0,.25),0 0 0 1px rgba(255,255,255,.05); }
    .cc-input { width:100%; padding:13px 16px; border:1.5px solid #e2e8f0; border-radius:14px; font-size:14px; outline:none; transition:all .25s cubic-bezier(.16,1,.3,1); font-family:inherit; background:#fafbff; color:#1e293b; }
    .cc-input:focus { border-color:#818cf8; box-shadow:0 0 0 4px rgba(129,140,248,.1),0 2px 8px rgba(99,102,241,.08); background:#fff; }
    .cc-input::placeholder { color:#a0aec0; }
    .cc-btn { display:inline-flex;align-items:center;justify-content:center;gap:8px; padding:13px 28px;border-radius:14px;border:none;font-size:14px; font-weight:600;cursor:pointer;transition:all .25s cubic-bezier(.16,1,.3,1);font-family:inherit;position:relative;overflow:hidden; }
    .cc-btn::after { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,.15) 0%,transparent 50%); pointer-events:none; }
    .cc-btn-primary { background:linear-gradient(135deg,#6366f1 0%,#4f46e5 50%,#4338ca 100%); color:#fff; box-shadow:0 4px 16px rgba(99,102,241,.35),0 1px 3px rgba(0,0,0,.1); }
    .cc-btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(99,102,241,.4),0 2px 6px rgba(0,0,0,.1); }
    .cc-btn-primary:active { transform:translateY(0); box-shadow:0 2px 8px rgba(99,102,241,.3); }
    .cc-btn-primary:disabled { opacity:.45; cursor:not-allowed; transform:none; box-shadow:none; }
    .cc-btn-ghost { background:#fff;color:#475569;border:1.5px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,.04); }
    .cc-btn-ghost:hover { background:#f8fafc;border-color:#cbd5e1;color:#1e293b;transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.06); }
    .cc-cat-row { transition:all .2s cubic-bezier(.16,1,.3,1); cursor:pointer; border-bottom:1px solid #f1f5f9; position:relative; }
    .cc-cat-row::after { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:transparent; transition:all .2s; border-radius:0 3px 3px 0; }
    .cc-cat-row:hover { background:linear-gradient(90deg,#f0f4ff,#fafaff,#fff); }
    .cc-cat-row:hover::after { background:linear-gradient(180deg,#6366f1,#818cf8); }
    .cc-sub-row { transition:all .2s cubic-bezier(.16,1,.3,1); cursor:pointer; border-bottom:1px solid #f1f5f9; position:relative; }
    .cc-sub-row::after { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:transparent; transition:all .2s; border-radius:0 3px 3px 0; }
    .cc-sub-row:hover { background:linear-gradient(90deg,#faf5ff,#fff); }
    .cc-sub-row:hover::after { background:linear-gradient(180deg,#8b5cf6,#a78bfa); }
    .cc-issue-card { transition:all .2s cubic-bezier(.16,1,.3,1); cursor:pointer; border-bottom:1px solid #f1f5f9; }
    .cc-issue-card:hover { background:linear-gradient(90deg,#fffbeb,#fefefe,#fff); }
    .cc-scroll::-webkit-scrollbar { width:5px; }
    .cc-scroll::-webkit-scrollbar-track { background:transparent; }
    .cc-scroll::-webkit-scrollbar-thumb { background:linear-gradient(180deg,#cbd5e1,#94a3b8); border-radius:3px; }
    .cc-scroll::-webkit-scrollbar-thumb:hover { background:#94a3b8; }
    .cc-popup-card .leaflet-popup-content-wrapper { padding:0;margin:0;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.15),0 0 0 1px rgba(0,0,0,.04);overflow:hidden; }
    .cc-popup-card .leaflet-popup-content { margin:0 !important;width:auto !important; }
    .cc-popup-card .leaflet-popup-tip-container { display:none; }
    .cc-toggle { display:flex;gap:2px;background:#f1f5f9;border-radius:12px;padding:3px; }
    .cc-toggle button { padding:9px 20px;font-size:13px;font-weight:600;border:none;cursor:pointer; border-radius:10px;display:flex;align-items:center;gap:6px;transition:all .2s cubic-bezier(.16,1,.3,1);font-family:inherit; }
    .cc-toggle .active { background:#fff;color:#1e293b;box-shadow:0 2px 8px rgba(0,0,0,.08),0 0 0 1px rgba(0,0,0,.03); }
    .cc-toggle .inactive { background:transparent;color:#94a3b8; }
    .cc-toggle .inactive:hover { background:rgba(0,0,0,.04);color:#64748b; }
    .cc-badge-official { display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:6px; font-size:10px;font-weight:700;letter-spacing:.5px; background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff; }
    .cc-wizard-progress { display:flex;align-items:center;gap:0;padding:0 16px;justify-content:center; }
    .cc-wiz-step { display:flex;align-items:center;gap:0; }
    .cc-wiz-dot { width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center; font-size:13px;font-weight:700;transition:all .35s cubic-bezier(.16,1,.3,1);flex-shrink:0; }
    .cc-wiz-dot.active { background:linear-gradient(135deg,#818cf8,#6366f1);color:#fff;box-shadow:0 0 0 4px rgba(99,102,241,.15),0 4px 16px rgba(99,102,241,.3);animation:ccRipple 2s infinite; }
    .cc-wiz-dot.done { background:linear-gradient(135deg,#34d399,#10b981);color:#fff;box-shadow:0 2px 8px rgba(16,185,129,.25); }
    .cc-wiz-dot.done svg { animation:ccCheckPop .4s cubic-bezier(.16,1,.3,1); }
    .cc-wiz-dot.pending { background:#f1f5f9;color:#94a3b8;border:2px solid #e2e8f0; }
    .cc-wiz-line { height:2.5px;width:48px;flex-shrink:0;border-radius:2px;transition:all .4s cubic-bezier(.16,1,.3,1); }
    .cc-wiz-line.done { background:linear-gradient(90deg,#10b981,#34d399); }
    .cc-wiz-line.pending { background:#e2e8f0; }
    .cc-ai-dots span { display:inline-block;width:7px;height:7px;border-radius:50%;background:linear-gradient(135deg,#a5b4fc,#818cf8);margin:0 3px; }
    .cc-ai-dots span:nth-child(1) { animation:ccDotBounce 1.4s infinite .0s; }
    .cc-ai-dots span:nth-child(2) { animation:ccDotBounce 1.4s infinite .2s; }
    .cc-ai-dots span:nth-child(3) { animation:ccDotBounce 1.4s infinite .4s; }
    .cc-section-title { font-size:19px;font-weight:800;color:#0f172a;letter-spacing:-.4px;line-height:1.25; }
    .cc-section-subtitle { font-size:13px;color:#64748b;line-height:1.6;margin-top:6px; }
    .cc-match-card { background:linear-gradient(135deg,#ecfdf5 0%,#d1fae5 50%,#f0fdf4 100%);border:1.5px solid #86efac;border-radius:18px;padding:22px;position:relative;overflow:hidden; }
    .cc-match-card::before { content:'';position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:rgba(16,185,129,.1);pointer-events:none; }
    .cc-review-card { background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-radius:16px;padding:16px 18px;border:1px solid #e2e8f0;position:relative; }
    .cc-review-card::before { content:'';position:absolute;left:0;top:12px;bottom:12px;width:3px;background:linear-gradient(180deg,#6366f1,#8b5cf6);border-radius:3px; }
    .cc-photo-zone { border:2px dashed #d1d5db;border-radius:18px;padding:28px;text-align:center;cursor:pointer;transition:all .25s cubic-bezier(.16,1,.3,1);background:linear-gradient(135deg,#fafbff,#f5f7ff); }
    .cc-photo-zone:hover { border-color:#818cf8;background:linear-gradient(135deg,#eef2ff,#f5f3ff);transform:translateY(-1px);box-shadow:0 4px 16px rgba(99,102,241,.08); }
    .cc-quick-tag { padding:7px 16px;border-radius:24px;border:1.5px solid #e2e8f0;background:#fff;font-size:12px;color:#475569;cursor:pointer;font-family:inherit;transition:all .2s cubic-bezier(.16,1,.3,1);font-weight:500; }
    .cc-quick-tag:hover { border-color:#818cf8;color:#4f46e5;background:linear-gradient(135deg,#eef2ff,#f5f3ff);transform:translateY(-1px);box-shadow:0 4px 12px rgba(99,102,241,.1); }
    .cc-stat-card { flex:1;min-width:100px;padding:16px;border-radius:16px;text-align:center;position:relative;overflow:hidden; }
    .cc-stat-card::before { content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.5) 0%,transparent 100%);pointer-events:none; }
    .cc-back-btn { background:none;border:none;cursor:pointer;color:#64748b;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;font-family:inherit;padding:6px 10px;border-radius:10px;transition:all .2s; }
    .cc-back-btn:hover { background:#f1f5f9;color:#334155; }
    .cc-pin-status { display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:12px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1px solid #bbf7d0; }
    #civic-connect .cc-bottom-bar { display:none; }
    @media(max-width:768px) {
      .cc-split { flex-direction:column-reverse!important; }
      .cc-left,.cc-right { width:100%!important; min-width:0!important; }
      .cc-left { height:55%!important; flex:1; overflow-y:auto; }
      .cc-right { height:45%!important; flex-shrink:0; }
      .cc-home-cards { grid-template-columns:1fr!important; }
      .cc-header { padding:8px 14px!important; }
      .cc-header .cc-logo-wrap { width:34px!important; height:34px!important; border-radius:10px!important; }
      .cc-header .cc-title { font-size:13px!important; }
      .cc-header .cc-subtitle { display:none; }
      .cc-header .cc-stats-badge { display:none; }
      .cc-header #cc-close { display:none!important; }
      .cc-glass { padding:16px!important; }
      .cc-glass .cc-card-icon { width:38px!important; height:38px!important; border-radius:12px!important; }
      .cc-glass .cc-card-title { font-size:13px!important; }
      .cc-glass .cc-card-desc { font-size:11px!important; -webkit-line-clamp:2; display:-webkit-box; -webkit-box-orient:vertical; overflow:hidden; }
      .cc-glass .cc-card-label { font-size:9px!important; }
      .cc-live-stats { gap:8px!important; }
      .cc-live-stats > div { padding:12px!important; }
      .cc-live-stats > div > div:first-child { font-size:18px!important; }
      .cc-wizard-progress { padding:0 8px!important; }
      .cc-wiz-dot { width:28px!important; height:28px!important; font-size:11px!important; }
      .cc-wiz-line { width:28px!important; }
      #cc-back-btn { min-width:44px; min-height:44px; }
      #cc-cat-grid { grid-template-columns:1fr!important; }
      .cc-track-item { padding:12px 14px!important; }
      .cc-split:not(.cc-show-map) .cc-right { display:none!important; }
      .cc-split:not(.cc-show-map) .cc-left { height:100%!important; }
      #civic-connect .cc-bottom-bar { display:flex;position:fixed;bottom:0;left:0;right:0;z-index:10000;background:rgba(255,255,255,0.97);border-top:1px solid #e5e7eb;padding:10px 16px;align-items:center;justify-content:space-between;gap:12px;backdrop-filter:blur(12px);box-shadow:0 -2px 16px rgba(0,0,0,0.08); }
      #civic-connect .cc-bottom-bar button { display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 20px;border-radius:12px;border:1.5px solid #e2e8f0;background:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;min-height:44px;transition:all .2s;color:#374151;box-shadow:0 1px 3px rgba(0,0,0,0.06); }
      #civic-connect .cc-bottom-bar .cc-bb-primary { background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;box-shadow:0 4px 12px rgba(99,102,241,.3);flex:1;max-width:200px; }
      .cc-split { padding-bottom:64px!important; }
    }
    `;
  }

  /* ═══════════════════════════════════════════════════════════════
   *  MAIN RENDER
   * ═══════════════════════════════════════════════════════════════ */

  function render() {
    if (overlay) overlay.remove();
    mode = 'home'; rightView = 'map'; wizStep = 0; wizText = '';
    wizCategory = null; wizAddress = ''; wizPhoto = null; wizName = ''; wizAnonymous = false;
    wizLat = null; wizLng = null;
    activeCat = null; searchTerm = ''; activeIssue = null;
    pinMarker = null; pinCoords = null;

    if (window._srPrefill) {
      const pf = window._srPrefill;
      window._srPrefill = null;
      if (pf.category) {
        wizText = pf.description || '';
        wizAddress = pf.address || '';
        wizCategory = aiDetectCategory(pf.category);
        mode = 'wizard'; wizStep = 2;
      }
    }

    overlay = document.createElement('div');
    overlay.id = 'civic-connect';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;background:#f8fafc;';

    const stats = communityData?.stats || {};

    overlay.innerHTML =
      '<style>' + getCSS() + '</style>'
      + '<header class="cc-header" style="padding:14px 22px;display:flex;align-items:center;gap:16px;color:#fff;flex-shrink:0;z-index:10;position:relative">'
      +   '<div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0;position:relative;z-index:1">'
      +     '<div class="cc-logo-wrap" id="cc-logo" style="width:40px;height:40px;border-radius:13px;background:rgba(255,255,255,.06);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;transition:all .25s">'
      +       '<span style="font-weight:800;font-size:13px;background:linear-gradient(135deg,#a5b4fc,#34d399);-webkit-background-clip:text;-webkit-text-fill-color:transparent">CL</span>'
      +     '</div>'
      +     '<div style="min-width:0">'
      +       '<div class="cc-title" style="font-weight:700;font-size:15px;letter-spacing:-.3px">CivicLens Connect</div>'
      +       '<div class="cc-subtitle" style="font-size:10px;opacity:.4;margin-top:2px;letter-spacing:.3px">AI-Powered Civic Services</div>'
      +     '</div>'
      +   '</div>'
      +   '<div style="display:flex;align-items:center;gap:10px;flex-shrink:0;position:relative;z-index:1">'
      +     (stats.total_requests ? '<div class="cc-stats-badge" style="display:flex;align-items:center;gap:7px;padding:6px 14px;border-radius:10px;background:rgba(255,255,255,.06);font-size:11px;border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(8px)"><div style="width:6px;height:6px;border-radius:50%;background:#34d399;box-shadow:0 0 8px #34d399;animation:ccPulse 2s infinite"></div><span style="font-weight:500">' + stats.total_requests + ' active issues</span></div>' : '')
      +     '<button id="cc-close" style="display:flex;align-items:center;justify-content:center;gap:5px;padding:7px 14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:12px;color:rgba(255,255,255,.8);font-size:13px;font-weight:600;cursor:pointer;line-height:1;transition:all .2s cubic-bezier(.16,1,.3,1);font-family:inherit;min-width:44px;min-height:44px;backdrop-filter:blur(8px)" title="Close">' + I.close + ' <span style="font-size:12px" class="cc-close-label">Close</span></button>'
      +   '</div>'
      + '</header>'
      + '<div class="cc-split cc-show-map" style="display:flex;flex:1;overflow:hidden">'
      +   '<div class="cc-left cc-scroll" id="cc-left" style="width:42%;min-width:320px;flex-shrink:0;overflow-y:auto;background:#fff"></div>'
      +   '<div class="cc-right" id="cc-right" style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:#f1f5f9"></div>'
      + '</div>'
      + '<div class="cc-bottom-bar" id="cc-bottom-bar">'
      +   '<button class="cc-bb-close" id="cc-bb-close" title="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg> Close</button>'
      +   '<button class="cc-bb-home" id="cc-bb-home" title="Home"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg> Home</button>'
      + '</div>';

    document.body.appendChild(overlay);
    overlay.querySelector('#cc-close').onclick = closePortal;
    overlay.querySelector('#cc-close').onmouseenter = function(){ this.style.background='rgba(255,255,255,.2)'; };
    overlay.querySelector('#cc-close').onmouseleave = function(){ this.style.background='rgba(255,255,255,.1)'; };
    overlay.querySelector('#cc-bb-close').onclick = closePortal;
    overlay.querySelector('#cc-bb-home').onclick = function() { mode = 'home'; updateLeft(); };
    overlay.querySelector('#cc-logo').onclick = function() { mode = 'home'; updateLeft(); };
    updateLeft();
    updateRight();
  }

  function closePortal() {
    if (!overlay) return;
    if (liveEventSource) { liveEventSource.close(); liveEventSource = null; }
    overlay.style.opacity = '0'; overlay.style.transition = 'opacity .2s';
    setTimeout(function() {
      if (leafletMap) { leafletMap.remove(); leafletMap = null; markerLayer = null; markerById = {}; }
      if (overlay) { overlay.remove(); overlay = null; }
    }, 200);
    // Reset bottom nav back to Home
    if (window.resetNavToHome) window.resetNavToHome();
  }

  /* ── Zoom map to a specific request's location ── */
  var pendingZoom = null;
  var pendingPopupId = null;
  function zoomToRequest(issue) {
    if (!issue) return;
    var lat = issue.location ? issue.location.lat : null;
    var lng = issue.location ? issue.location.lng : null;
    if (!lat || !lng) return;
    var id = issue.id || null;
    if (leafletMap) {
      leafletMap.flyTo([lat, lng], 17, { duration: 0.8 });
      if (id && markerById[id]) {
        setTimeout(function() { markerById[id].openPopup(); }, 850);
      }
      pendingZoom = null;
      pendingPopupId = null;
    } else {
      pendingZoom = [lat, lng];
      pendingPopupId = id;
    }
  }

  /* ── LEFT PANEL ROUTER ── */
  function updateLeft() {
    const el = overlay ? overlay.querySelector('#cc-left') : null;
    if (!el) return;
    switch (mode) {
      case 'home': showHome(el); break;
      case 'wizard': showWizard(el); break;
      case 'browse': showBrowse(el); break;
      case 'track': showTrack(el); break;
      case 'detail': showDetail(el); break;
      case 'success': showSuccess(el); break;
    }
    // On mobile: show map only on Location step (wizStep 2) during wizard, or on non-wizard modes
    var split = overlay ? overlay.querySelector('.cc-split') : null;
    if (split) {
      var showMap = (mode !== 'wizard') || (mode === 'wizard' && wizStep === 2);
      split.classList.toggle('cc-show-map', showMap);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
   *  HOME - 3 entry point cards
   * ═══════════════════════════════════════════════════════════════ */

  function showHome(el) {
    const stats = communityData?.stats || {};
    const openCount = stats.open || 0;
    const avgDays = stats.avg_resolution_days || '—';

    el.innerHTML =
      '<div class="cc-anim" style="padding:32px 26px">'
      + '<div style="margin-bottom:32px">'
      +   '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><div style="width:6px;height:6px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6)"></div><span style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:.8px">CivicLens Connect</span></div>'
      +   '<h2 style="font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-.6px;line-height:1.15">What can we help<br/>you with?</h2>'
      +   '<p style="font-size:14px;color:#64748b;margin-top:10px;line-height:1.6">Report an issue, track a request, or browse what\u2019s happening in your neighborhood.</p>'
      + '</div>'
      + '<div class="cc-home-cards" style="display:grid;grid-template-columns:1fr;gap:14px">'
      // AI Wizard Card
      +   '<div id="cc-go-wizard" class="cc-glass" style="padding:22px;cursor:pointer;background:linear-gradient(135deg,rgba(99,102,241,.1),rgba(99,102,241,.03));border-color:rgba(99,102,241,.18);animation:ccSlide .4s cubic-bezier(.16,1,.3,1) .1s both">'
      +     '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">'
      +       '<div class="cc-card-icon" style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 6px 20px rgba(99,102,241,.35),0 0 0 1px rgba(99,102,241,.1)">' + I.wand + '</div>'
      +       '<div><div class="cc-card-title" style="font-size:16px;font-weight:700;color:#0f172a;letter-spacing:-.2px">AI-Guided Report</div><div class="cc-card-label" style="font-size:10px;font-weight:700;color:#6366f1;letter-spacing:.6px;margin-top:2px;display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:linear-gradient(135deg,#eef2ff,#e0e7ff);border-radius:6px">\u2728 RECOMMENDED</div></div>'
      +     '</div>'
      +     '<p class="cc-card-desc" style="font-size:13px;color:#64748b;line-height:1.6">Describe what you see \u2014 our AI figures out the category and guides you step by step.</p>'
      +   '</div>'
      // Browse Categories Card
      +   '<div id="cc-go-browse" class="cc-glass" style="padding:22px;cursor:pointer;background:rgba(255,255,255,.06);animation:ccSlide .4s cubic-bezier(.16,1,.3,1) .18s both">'
      +     '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">'
      +       '<div class="cc-card-icon" style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 6px 20px rgba(16,185,129,.3)">' + I.folder + '</div>'
      +       '<div><div class="cc-card-title" style="font-size:16px;font-weight:700;color:#0f172a;letter-spacing:-.2px">Browse Categories</div><div class="cc-card-label" style="font-size:11px;color:#64748b;margin-top:1px">12 categories, 36 issue types</div></div>'
      +     '</div>'
      +     '<p class="cc-card-desc" style="font-size:13px;color:#64748b;line-height:1.6">Know what to report? Browse our full catalog and select the right type.</p>'
      +   '</div>'
      // Track Request Card
      +   '<div id="cc-go-track" class="cc-glass" style="padding:22px;cursor:pointer;background:rgba(255,255,255,.06);animation:ccSlide .4s cubic-bezier(.16,1,.3,1) .26s both">'
      +     '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">'
      +       '<div class="cc-card-icon" style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 6px 20px rgba(245,158,11,.3)">' + I.track + '</div>'
      +       '<div><div class="cc-card-title" style="font-size:16px;font-weight:700;color:#0f172a;letter-spacing:-.2px">Track a Request</div><div class="cc-card-label" style="font-size:11px;color:#64748b;margin-top:1px">Check status & updates</div></div>'
      +     '</div>'
      +     '<p class="cc-card-desc" style="font-size:13px;color:#64748b;line-height:1.6">Enter your tracking number for real-time status and crew assignments.</p>'
      +   '</div>'
      + '</div>'
      // Live stats
      + (stats.total_requests ? '<div class="cc-live-stats cc-anim" style="margin-top:28px;display:flex;gap:12px;flex-wrap:wrap">'
        + '<div class="cc-stat-card" style="background:linear-gradient(135deg,#fef3c7,#fde68a)"><div style="font-size:24px;font-weight:800;color:#92400e;letter-spacing:-.5px">' + openCount + '</div><div style="font-size:11px;color:#a16207;font-weight:600;margin-top:2px">Open</div></div>'
        + '<div class="cc-stat-card" style="background:linear-gradient(135deg,#dbeafe,#bfdbfe)"><div style="font-size:24px;font-weight:800;color:#1e40af;letter-spacing:-.5px">' + (stats.in_progress || 0) + '</div><div style="font-size:11px;color:#1d4ed8;font-weight:600;margin-top:2px">In Progress</div></div>'
        + '<div class="cc-stat-card" style="background:linear-gradient(135deg,#dcfce7,#bbf7d0)"><div style="font-size:24px;font-weight:800;color:#166534;letter-spacing:-.5px">' + avgDays + '</div><div style="font-size:11px;color:#15803d;font-weight:600;margin-top:2px">Avg. Days to Fix</div></div>'
      + '</div>' : '')
      + '</div>';

    el.querySelector('#cc-go-wizard').onclick = function() { mode = 'wizard'; wizStep = 0; updateLeft(); };
    el.querySelector('#cc-go-browse').onclick = function() { mode = 'browse'; activeCat = null; updateLeft(); };
    el.querySelector('#cc-go-track').onclick = function() { mode = 'track'; updateLeft(); };
  }

  /* ═══════════════════════════════════════════════════════════════
   *  WIZARD - 4-step AI-guided flow
   * ═══════════════════════════════════════════════════════════════ */

  function wizardProgressBar() {
    const steps = ['Describe', 'Category', 'Location', 'Review', 'Submit'];
    const stepIcons = [
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>',
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    ];
    let html = '<div class="cc-wizard-progress" style="margin-bottom:28px">';
    for (let i = 0; i < steps.length; i++) {
      const state = i < wizStep ? 'done' : i === wizStep ? 'active' : 'pending';
      const dotContent = state === 'done' ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>' : stepIcons[i];
      html += '<div class="cc-wiz-step"><div class="cc-wiz-dot ' + state + '">' + dotContent + '</div>';
      if (i < steps.length - 1) html += '<div class="cc-wiz-line ' + (i < wizStep ? 'done' : 'pending') + '"></div>';
      html += '</div>';
    }
    html += '</div>';
    html += '<div style="display:flex;justify-content:space-between;padding:0 10px;margin-bottom:24px;margin-top:-18px">';
    for (let i = 0; i < steps.length; i++) {
      const isActive = i === wizStep;
      const isDone = i < wizStep;
      html += '<span style="font-size:11px;font-weight:' + (isActive ? '700' : '500') + ';color:' + (isActive ? '#4f46e5' : isDone ? '#10b981' : '#94a3b8') + ';width:60px;text-align:center;transition:all .3s">' + steps[i] + '</span>';
    }
    html += '</div>';
    return html;
  }

  function showWizard(el) {
    let body = '';
    switch (wizStep) {
      case 0: body = wizStep0(); break;
      case 1: body = wizStep1(); break;
      case 2: body = wizStep2(); break;
      case 3: body = wizStep3(); break;
      case 4: body = wizStep4(); break;
    }

    el.innerHTML =
      '<div class="cc-anim-l">'
      + '<div style="padding:12px 18px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #f1f5f9;background:linear-gradient(180deg,#fafbff,#fff)">'
      +   '<button id="cc-wiz-back" class="cc-back-btn">' + I.chevL + ' Back</button>'
      + '</div>'
      + '<div style="padding:28px 26px 28px">'
      +   wizardProgressBar() + body
      + '</div>'
      + '</div>';

    el.querySelector('#cc-wiz-back').onclick = function() {
      if (wizStep > 0) { wizStep--; updateLeft(); }
      else { mode = 'home'; updateLeft(); }
    };
    wireWizStep(el);
  }

  function wizStep0() {
    const quickTags = ['Pothole', 'Streetlight out', 'Fallen tree branch', 'Sidewalk crack', 'Flooding', 'Graffiti'];
    let quickHtml = '';
    for (let i = 0; i < quickTags.length; i++) {
      quickHtml += '<button class="cc-quick cc-quick-tag" style="animation:ccSlide .3s cubic-bezier(.16,1,.3,1) ' + (i * 0.05) + 's both">' + quickTags[i] + '</button>';
    }

    const rewriteStyles = [
      { id: 'concise', label: 'More Concise', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="17" y1="6" x2="3" y2="6"/><line x1="17" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>' },
      { id: 'descriptive', label: 'More Descriptive', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>' },
      { id: 'formal', label: 'More Formal', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>' },
      { id: 'urgent', label: 'More Urgent', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' },
      { id: 'friendly', label: 'More Friendly', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>' },
    ];
    let rewriteHtml = '';
    for (let i = 0; i < rewriteStyles.length; i++) {
      var s = rewriteStyles[i];
      rewriteHtml += '<button class="cc-rewrite-btn" data-style="' + s.id + '" style="display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border:1.5px solid #e2e8f0;border-radius:20px;background:#fff;color:#64748b;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap">' + s.icon + ' ' + s.label + '</button>';
    }

    return '<div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><div style="width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#eef2ff,#e0e7ff);display:flex;align-items:center;justify-content:center;color:#6366f1">' + I.ai + '</div><h3 class="cc-section-title">Describe what you see</h3></div>'
      + '<p class="cc-section-subtitle" style="margin-bottom:20px">Tell us in your own words. Our AI will analyze your description and automatically identify the right category.</p>'
      + '<div style="position:relative"><textarea id="cc-wiz-text" class="cc-input" rows="5" maxlength="500" style="resize:none;font-size:15px;line-height:1.7;padding:16px 18px" placeholder="Example: Large pothole on Woodland Road near the school \u2014 getting worse after rain, cars swerving to avoid it.">' + esc(wizText) + '</textarea></div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><div style="display:flex;align-items:center;gap:4px;font-size:11px;color:#a0aec0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Min 5 characters</div><span style="font-size:11px;font-variant-numeric:tabular-nums"><span id="cc-wiz-count" style="color:' + (wizText.length > 450 ? '#ef4444' : wizText.length > 350 ? '#f59e0b' : '#a0aec0') + '">' + wizText.length + '</span><span style="color:#a0aec0">/500</span></span></div>'
      + '<div id="cc-rewrite-bar" style="margin-top:14px;display:none"><div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">' + I.ai + ' AI Rewrite</div><div style="display:flex;flex-wrap:wrap;gap:6px">' + rewriteHtml + '</div><div id="cc-rewrite-status" style="display:none;margin-top:8px;font-size:12px;color:#6366f1;display:flex;align-items:center;gap:6px"></div></div>'
      + '<button id="cc-wiz-analyze" class="cc-btn cc-btn-primary" style="width:100%;margin-top:18px;padding:14px 28px;font-size:15px"' + (wizText.length < 5 ? ' disabled' : '') + '>' + I.send + ' Analyze with AI</button>'
      + '<div style="margin-top:24px"><div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px">Common reports</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px">' + quickHtml + '</div></div>'
      + '</div>';
  }

  function wizStep1() {
    if (!wizCategory) wizCategory = aiDetectCategory(wizText);
    const cat = CATEGORIES.find(function(c) { return c.id === wizCategory.catId; });
    const type = cat ? cat.types.find(function(t) { return t.id === wizCategory.typeId; }) : null;
    const conf = Math.round((wizCategory.confidence || 0.5) * 100);

    return '<div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><div style="width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#ecfdf5,#d1fae5);display:flex;align-items:center;justify-content:center;color:#10b981"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg></div><h3 class="cc-section-title">We identified the issue</h3></div>'
      + '<p class="cc-section-subtitle" style="margin-bottom:20px">Based on your description, here\u2019s what we detected:</p>'
      + '<div class="cc-match-card" style="margin-bottom:18px">'
      +   '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">'
      +     '<div style="width:48px;height:48px;border-radius:14px;background:' + (cat ? cat.color : '#6366f1') + '18;display:flex;align-items:center;justify-content:center;color:' + (cat ? cat.color : '#6366f1') + ';box-shadow:0 4px 12px ' + (cat ? cat.color : '#6366f1') + '15">' + (cat ? cat.icon() : '') + '</div>'
      +     '<div style="flex:1"><div style="font-size:16px;font-weight:700;color:#0f172a;letter-spacing:-.3px">' + (type ? type.label : 'General Issue') + '</div><div style="font-size:12px;color:#64748b;margin-top:2px">' + (cat ? cat.label : 'General') + '</div></div>'
      +   '</div>'
      +   '<div style="display:flex;align-items:center;gap:10px"><div style="flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,.6);overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.06)"><div style="height:100%;width:' + conf + '%;border-radius:4px;background:linear-gradient(90deg,#10b981,#34d399);transition:width .8s cubic-bezier(.16,1,.3,1)"></div></div><span style="font-size:13px;font-weight:700;color:#059669;min-width:70px;text-align:right">' + conf + '% match</span></div>'
      + '</div>'
      + '<div class="cc-review-card" style="margin-bottom:22px"><div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;padding-left:6px">YOUR DESCRIPTION</div><p style="font-size:13px;color:#475569;line-height:1.6;margin:0;padding-left:6px">' + esc(wizText) + '</p></div>'
      + '<button id="cc-wiz-confirm" class="cc-btn cc-btn-primary" style="width:100%;margin-bottom:10px;padding:14px 28px;font-size:15px">Yes, this is correct \u2014 Continue</button>'
      + '<button id="cc-wiz-change" class="cc-btn cc-btn-ghost" style="width:100%;padding:13px 28px">Not quite \u2014 Let me choose manually</button>'
      + '</div>';
  }

  function wizStep2() {
    return '<div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><div style="width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center;color:#f59e0b">' + I.mapPin + '</div><h3 class="cc-section-title">Where is it?</h3></div>'
      + '<p class="cc-section-subtitle" style="margin-bottom:20px">Type the address or click on the map to drop a pin at the exact location.</p>'
      + '<div style="margin-bottom:16px;position:relative"><input type="text" id="cc-wiz-addr" class="cc-input" maxlength="200" value="' + esc(wizAddress) + '" placeholder="e.g. 245 E Woodland Rd" autocomplete="off" style="font-size:15px;padding:14px 16px" />'
      + '<div id="cc-geo-suggestions" style="display:none;position:absolute;left:0;right:0;top:100%;z-index:1000;background:#fff;border:1.5px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;box-shadow:0 8px 24px rgba(0,0,0,.1);max-height:220px;overflow-y:auto"></div></div>'
      + '<div id="cc-pin-status" class="cc-pin-status" style="display:' + (pinCoords ? 'flex' : 'none') + ';margin-bottom:16px">'
      +   '<div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#34d399,#10b981);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg></div>'
      +   '<span style="font-size:13px;color:#15803d;font-weight:600">Pin placed on map</span>'
      +   '<button id="cc-clear-pin" style="margin-left:auto;font-size:12px;color:#ef4444;background:none;border:none;cursor:pointer;font-weight:500;padding:4px 8px;border-radius:6px;transition:all .15s">Clear</button>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px;padding:12px 14px;border-radius:12px;background:linear-gradient(135deg,#f8fafc,#f1f5f9);margin-bottom:22px">'
      +   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
      +   '<span style="font-size:12px;color:#64748b;line-height:1.4">You can click on the map to place a pin. Drag the pin to adjust.</span>'
      + '</div>'
      + '<button id="cc-wiz-next2" class="cc-btn cc-btn-primary" style="width:100%;padding:14px 28px;font-size:15px">Continue to final step</button>'
      + '</div>';
  }

  function wizStep3() {
    return '<div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><div style="width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#f3e8ff,#e9d5ff);display:flex;align-items:center;justify-content:center;color:#8b5cf6">' + I.photo + '</div><h3 class="cc-section-title">Add Details</h3></div>'
      + '<p class="cc-section-subtitle" style="margin-bottom:20px">Add a photo (optional) and let us know if you\u2019d like email updates on your request.</p>'
      + '<div id="cc-photo-zone" class="cc-photo-zone" style="margin-bottom:20px;position:relative">'
      +   '<input type="file" id="cc-photo-file" accept="image/*" style="display:none" />'
      +   (wizPhoto
          ? '<img id="cc-photo-preview" src="' + wizPhoto + '" style="max-height:140px;margin:0 auto;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.1);display:block" />'
            + '<div id="cc-photo-label" style="font-size:12px;color:#10b981;font-weight:600;margin-top:8px">✓ Photo attached — click to change</div>'
            + '<button id="cc-photo-remove" type="button" style="position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.55);border:none;color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;transition:background .2s" onmouseenter="this.style.background=\'rgba(239,68,68,.9)\'" onmouseleave="this.style.background=\'rgba(0,0,0,.55)\'">×</button>'
          : '<div style="color:#94a3b8;margin-bottom:6px">' + I.photo + '</div>'
            + '<div id="cc-photo-label" style="font-size:13px;color:#64748b;font-weight:500">Click or drag to add a photo</div>'
            + '<div style="font-size:11px;color:#a0aec0;margin-top:4px">Helps crews find the issue faster</div>'
            + '<img id="cc-photo-preview" style="display:none;max-height:140px;margin:14px auto 0;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.1)" />'
      )
      + '</div>'
      // ── Your Name / Anonymous toggle ──
      + '<div style="margin-bottom:22px;padding:20px;border-radius:16px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #bbf7d0">'
      +   '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">'
      +     '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0">' + I.users + '</div>'
      +     '<div><div style="font-size:14px;font-weight:700;color:#14532d;letter-spacing:-.2px">Who\'s reporting?</div><div style="font-size:12px;color:#16a34a;margin-top:2px">Add your name or stay anonymous</div></div>'
      +   '</div>'
      +   '<label id="cc-anon-toggle" style="display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:14px;padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.7);border:1px solid #e2e8f0;transition:all .2s">'
      +     '<div id="cc-anon-switch" style="width:44px;height:24px;border-radius:12px;background:' + (wizAnonymous ? '#10b981' : '#cbd5e1') + ';position:relative;transition:background .25s;flex-shrink:0"><div style="width:20px;height:20px;border-radius:50%;background:#fff;position:absolute;top:2px;' + (wizAnonymous ? 'left:22px' : 'left:2px') + ';transition:left .25s;box-shadow:0 1px 3px rgba(0,0,0,.15)"></div></div>'
      +     '<span style="font-size:13px;font-weight:600;color:#334155">Submit anonymously</span>'
      +   '</label>'
      +   '<div id="cc-name-field" style="display:' + (wizAnonymous ? 'none' : 'block') + '">'
      +     '<input type="text" id="cc-wiz-name" class="cc-input" maxlength="100" value="' + esc(wizName) + '" placeholder="Your name (optional)" style="font-size:14px;padding:12px 14px;background:#fff;border-color:#bbf7d0" />'
      +     '<div style="display:flex;align-items:center;gap:6px;margin-top:8px;padding:0 4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg><span style="font-size:11px;color:#64748b">Displayed on your request. Leave blank to remain unnamed.</span></div>'
      +   '</div>'
      + '</div>'
      // ── Email notification opt-in ──
      + '<div style="margin-bottom:22px;padding:20px;border-radius:16px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1.5px solid #bfdbfe">'
      +   '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">'
      +     '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#3b82f6,#2563eb);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div>'
      +     '<div><div style="font-size:14px;font-weight:700;color:#1e3a5f;letter-spacing:-.2px">Want email updates?</div><div style="font-size:12px;color:#3b82f6;margin-top:2px">Get notified as your request progresses</div></div>'
      +   '</div>'
      +   '<label id="cc-notify-toggle" style="display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:14px;padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.7);border:1px solid #e2e8f0;transition:all .2s">'
      +     '<div id="cc-notify-switch" style="width:44px;height:24px;border-radius:12px;background:' + (wizNotify ? '#3b82f6' : '#cbd5e1') + ';position:relative;transition:background .25s;flex-shrink:0"><div style="width:20px;height:20px;border-radius:50%;background:#fff;position:absolute;top:2px;' + (wizNotify ? 'left:22px' : 'left:2px') + ';transition:left .25s;box-shadow:0 1px 3px rgba(0,0,0,.15)"></div></div>'
      +     '<span style="font-size:13px;font-weight:600;color:#334155">Yes, email me status updates</span>'
      +   '</label>'
      +   '<div id="cc-email-field" style="display:' + (wizNotify ? 'block' : 'none') + '">'
      +     '<input type="email" id="cc-wiz-email" class="cc-input" maxlength="254" value="' + esc(wizEmail) + '" placeholder="your@email.com" style="font-size:14px;padding:12px 14px;background:#fff;border-color:#bfdbfe" />'
      +     '<div style="display:flex;align-items:center;gap:6px;margin-top:8px;padding:0 4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg><span style="font-size:11px;color:#64748b">Your email is only used for request updates. Never shared.</span></div>'
      +   '</div>'
      + '</div>'
      + '<button id="cc-wiz-next3" class="cc-btn cc-btn-primary" style="width:100%;padding:14px 28px;font-size:15px">Review &amp; Submit</button>'
      + '</div>';
  }

  function wizStep4() {
    const cat = CATEGORIES.find(function(c) { return c.id === (wizCategory ? wizCategory.catId : ''); });
    const type = cat ? cat.types.find(function(t) { return t.id === wizCategory.typeId; }) : null;

    return '<div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><div style="width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#ecfdf5,#d1fae5);display:flex;align-items:center;justify-content:center;color:#10b981"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg></div><h3 class="cc-section-title">Review &amp; Submit</h3></div>'
      + '<p class="cc-section-subtitle" style="margin-bottom:20px">Everything look good? Hit submit and we\u2019ll get right on it.</p>'
      + '<div class="cc-review-card" style="margin-bottom:22px">'
      +   '<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px;padding-left:6px">Review Your Report</div>'
      +   '<div style="display:grid;grid-template-columns:auto 1fr;gap:10px 16px;font-size:13px;padding-left:6px">'
      +     '<span style="color:#94a3b8;font-weight:500;font-size:12px">Type</span><span style="color:#0f172a;font-weight:700">' + (type ? type.label : 'General') + '</span>'
      +     '<span style="color:#94a3b8;font-weight:500;font-size:12px">Location</span><span style="color:#0f172a;font-weight:700">' + (esc(wizAddress) || 'Map pin placed') + '</span>'
      +     '<span style="color:#94a3b8;font-weight:500;font-size:12px">Description</span><span style="color:#475569;line-height:1.5">' + esc(wizText).substring(0, 120) + (wizText.length > 120 ? '...' : '') + '</span>'
      +     (wizPhoto ? '<span style="color:#94a3b8;font-weight:500;font-size:12px">Photo</span><span style="display:flex;align-items:center;gap:8px"><img src="' + wizPhoto + '" style="width:48px;height:48px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0" /><span style="color:#10b981;font-weight:600">\u2713 Attached</span></span>' : '')
      +     (wizAnonymous ? '<span style="color:#94a3b8;font-weight:500;font-size:12px">Submitted&nbsp;by</span><span style="color:#10b981;font-weight:600">Anonymous</span>' : wizName.trim() ? '<span style="color:#94a3b8;font-weight:500;font-size:12px">Submitted&nbsp;by</span><span style="color:#0f172a;font-weight:700">' + esc(wizName.trim()) + '</span>' : '')
      +     (wizNotify && wizEmail ? '<span style="color:#94a3b8;font-weight:500;font-size:12px">Notifications</span><span style="color:#3b82f6;font-weight:600">\u2709 ' + esc(wizEmail) + '</span>' : '')
      +   '</div>'
      + '</div>'
      + '<button id="cc-wiz-submit" class="cc-btn cc-btn-primary" style="width:100%;padding:15px 28px;font-size:15px;letter-spacing:-.2px">' + I.send + ' Submit Report</button>'
      + '</div>';
  }

  function wireWizStep(el) {
    // Step 0
    const textarea = el.querySelector('#cc-wiz-text');
    const analyzeBtn = el.querySelector('#cc-wiz-analyze');
    const rewriteBar = el.querySelector('#cc-rewrite-bar');
    if (textarea && analyzeBtn) {
      // Show/hide rewrite bar based on text length
      function updateRewriteBar() {
        if (rewriteBar) rewriteBar.style.display = wizText.length >= 5 ? 'block' : 'none';
      }
      updateRewriteBar();
      textarea.oninput = function() {
        wizText = textarea.value;
        var countEl = el.querySelector('#cc-wiz-count');
        countEl.textContent = wizText.length;
        countEl.style.color = wizText.length > 450 ? '#ef4444' : wizText.length > 350 ? '#f59e0b' : '#a0aec0';
        analyzeBtn.disabled = wizText.length < 5;
        updateRewriteBar();
      };
      analyzeBtn.onclick = function() {
        if (wizText.length < 5) return;
        analyzeBtn.innerHTML = '<span class="cc-ai-dots"><span></span><span></span><span></span></span> Analyzing...';
        analyzeBtn.disabled = true;
        setTimeout(function() {
          wizCategory = aiDetectCategory(wizText);
          wizStep = 1;
          updateLeft();
        }, 900);
      };
      // Wire rewrite buttons
      var rewriteBtns = el.querySelectorAll('.cc-rewrite-btn');
      for (var ri = 0; ri < rewriteBtns.length; ri++) {
        rewriteBtns[ri].onclick = (function(btn) {
          return async function() {
            if (wizText.length < 5) return;
            var style = btn.getAttribute('data-style');
            // Disable all rewrite buttons during request
            var allBtns = el.querySelectorAll('.cc-rewrite-btn');
            for (var b = 0; b < allBtns.length; b++) { allBtns[b].disabled = true; allBtns[b].style.opacity = '0.5'; }
            btn.style.opacity = '1';
            btn.style.borderColor = '#6366f1';
            btn.style.color = '#6366f1';
            var origLabel = btn.innerHTML;
            btn.innerHTML = '<span class="cc-ai-dots"><span></span><span></span><span></span></span> Rewriting...';
            try {
              var resp = await fetch('/api/rewrite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: wizText, style: style }),
              });
              var data = await resp.json();
              if (data.rewritten) {
                wizText = data.rewritten;
                textarea.value = wizText;
                var cEl = el.querySelector('#cc-wiz-count');
                cEl.textContent = wizText.length;
                cEl.style.color = wizText.length > 450 ? '#ef4444' : wizText.length > 350 ? '#f59e0b' : '#a0aec0';
                analyzeBtn.disabled = wizText.length < 5;
                // Quick flash effect on textarea
                textarea.style.background = '#eef2ff';
                setTimeout(function() { textarea.style.background = ''; }, 600);
              } else if (data.error) {
                alert(data.error);
              }
            } catch (err) {
              alert('Could not rewrite — please try again.');
            }
            // Re-enable all buttons
            for (var b = 0; b < allBtns.length; b++) { allBtns[b].disabled = false; allBtns[b].style.opacity = '1'; allBtns[b].style.borderColor = '#e2e8f0'; allBtns[b].style.color = '#64748b'; }
            btn.innerHTML = origLabel;
          };
        })(rewriteBtns[ri]);
        // Hover effects
        rewriteBtns[ri].onmouseenter = function() { this.style.borderColor = '#6366f1'; this.style.color = '#6366f1'; this.style.background = '#f5f3ff'; };
        rewriteBtns[ri].onmouseleave = function() { if (!this.disabled) { this.style.borderColor = '#e2e8f0'; this.style.color = '#64748b'; this.style.background = '#fff'; } };
      }
      var quicks = el.querySelectorAll('.cc-quick');
      for (var qi = 0; qi < quicks.length; qi++) {
        quicks[qi].onclick = (function(btn) {
          return function() {
            wizText = btn.textContent;
            textarea.value = wizText;
            el.querySelector('#cc-wiz-count').textContent = wizText.length;
            analyzeBtn.disabled = false;
            updateRewriteBar();
          };
        })(quicks[qi]);
      }
    }

    // Step 1
    var confirmBtn = el.querySelector('#cc-wiz-confirm');
    var changeBtn = el.querySelector('#cc-wiz-change');
    if (confirmBtn) {
      confirmBtn.onclick = function() {
        wizStep = 2; updateLeft();
        if (rightView !== 'map') { rightView = 'map'; updateRight(); }
        setTimeout(function() { enablePinMode(); }, 300);
      };
    }
    if (changeBtn) {
      changeBtn.onclick = function() { mode = 'browse'; activeCat = null; updateLeft(); };
    }

    // Step 2
    var addrInput = el.querySelector('#cc-wiz-addr');
    var next2Btn = el.querySelector('#cc-wiz-next2');
    var clearPinBtn = el.querySelector('#cc-clear-pin');
    if (addrInput) {
      addrInput.oninput = function() {
        wizAddress = addrInput.value;
        clearTimeout(_geoTimer);
        var q = addrInput.value.trim();
        if (q.length < 3) { showGeoSuggestions([]); return; }
        _geoTimer = setTimeout(function() {
          geocodeAddress(q, showGeoSuggestions);
        }, 350);
      };
      // Close suggestions on blur (with slight delay so click can register)
      addrInput.onblur = function() {
        setTimeout(function() {
          var box = overlay ? overlay.querySelector('#cc-geo-suggestions') : null;
          if (box) { box.style.display = 'none'; box.innerHTML = ''; }
        }, 200);
      };
    }
    if (next2Btn) {
      next2Btn.onclick = function() {
        wizAddress = addrInput ? addrInput.value.trim() : '';
        if (!wizAddress && !pinCoords) { alert('Please enter an address or place a pin on the map.'); return; }
        wizLat = pinCoords ? pinCoords.lat : null;
        wizLng = pinCoords ? pinCoords.lng : null;
        disablePinMode();
        wizStep = 3; updateLeft();
      };
    }
    if (clearPinBtn) {
      clearPinBtn.onclick = function() {
        disablePinMode();
        var ps = el.querySelector('#cc-pin-status');
        if (ps) ps.style.display = 'none';
      };
    }

    // Step 3 - photo + email notification opt-in
    var photoZone = el.querySelector('#cc-photo-zone');
    var photoFile = el.querySelector('#cc-photo-file');
    var photoPreview = el.querySelector('#cc-photo-preview');
    if (photoZone && photoFile) {
      photoZone.onclick = function(e) {
        if (e.target.id === 'cc-photo-remove' || e.target.closest('#cc-photo-remove')) return;
        photoFile.click();
      };
      photoZone.ondragover = function(e) { e.preventDefault(); photoZone.style.borderColor = '#818cf8'; photoZone.style.background = '#eef2ff'; };
      photoZone.ondragleave = function() { photoZone.style.borderColor = '#d1d5db'; photoZone.style.background = '#fafbfc'; };
      photoZone.ondrop = function(e) {
        e.preventDefault(); photoZone.style.borderColor = '#d1d5db'; photoZone.style.background = '#fafbfc';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) handlePhoto(e.dataTransfer.files[0]);
      };
      photoFile.onchange = function() { if (photoFile.files && photoFile.files[0]) handlePhoto(photoFile.files[0]); };

      // X button to remove photo
      var removeBtn = el.querySelector('#cc-photo-remove');
      if (removeBtn) {
        removeBtn.onclick = function(e) {
          e.stopPropagation();
          wizPhoto = null;
          wizStep = 3; updateLeft();
        };
      }

      function handlePhoto(file) {
        if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
          el.querySelector('#cc-photo-label').textContent = 'Please use an image under 5 MB'; return;
        }
        var reader = new FileReader();
        reader.onload = function() {
          wizPhoto = reader.result;
          // Re-render step 3 to show the new photo with remove button
          wizStep = 3; updateLeft();
        };
        reader.readAsDataURL(file);
      }
    }

    // Name / Anonymous toggle
    var anonToggle = el.querySelector('#cc-anon-toggle');
    var nameField = el.querySelector('#cc-name-field');
    var nameInput = el.querySelector('#cc-wiz-name');
    if (anonToggle) {
      anonToggle.onclick = function() {
        wizAnonymous = !wizAnonymous;
        var sw = el.querySelector('#cc-anon-switch');
        if (sw) {
          sw.style.background = wizAnonymous ? '#10b981' : '#cbd5e1';
          sw.firstChild.style.left = wizAnonymous ? '22px' : '2px';
        }
        if (nameField) nameField.style.display = wizAnonymous ? 'none' : 'block';
        if (!wizAnonymous && nameInput) nameInput.focus();
      };
    }
    if (nameInput) {
      nameInput.oninput = function() { wizName = nameInput.value; };
    }

    // Email notification toggle
    var notifyToggle = el.querySelector('#cc-notify-toggle');
    var emailField = el.querySelector('#cc-email-field');
    var emailInput = el.querySelector('#cc-wiz-email');
    if (notifyToggle) {
      notifyToggle.onclick = function() {
        wizNotify = !wizNotify;
        var sw = el.querySelector('#cc-notify-switch');
        if (sw) {
          sw.style.background = wizNotify ? '#3b82f6' : '#cbd5e1';
          sw.firstChild.style.left = wizNotify ? '22px' : '2px';
        }
        if (emailField) emailField.style.display = wizNotify ? 'block' : 'none';
        if (wizNotify && emailInput) emailInput.focus();
      };
    }
    if (emailInput) {
      emailInput.oninput = function() { wizEmail = emailInput.value; };
    }

    // Step 3 → Step 4
    var next3Btn = el.querySelector('#cc-wiz-next3');
    if (next3Btn) {
      next3Btn.onclick = function() {
        if (wizNotify && wizEmail) {
          var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailPattern.test(wizEmail.trim())) {
            alert('Please enter a valid email address, or turn off email updates.');
            return;
          }
        }
        if (wizNotify && !wizEmail.trim()) {
          alert('Please enter your email address, or turn off email updates.');
          return;
        }
        wizStep = 4; updateLeft();
      };
    }

    // Step 4 - submit
    var submitBtn = el.querySelector('#cc-wiz-submit');
    if (submitBtn) {
      submitBtn.onclick = async function() {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="cc-ai-dots"><span></span><span></span><span></span></span> Submitting...';
        try {
          var body = {
            category: wizCategory ? wizCategory.typeId : 'other',
            description: wizText || 'Issue reported via AI wizard',
            address: wizAddress || (wizLat ? (wizLat + ', ' + wizLng) : (pinCoords ? (pinCoords.lat + ', ' + pinCoords.lng) : '')),
            lat: wizLat || (pinCoords ? pinCoords.lat : undefined),
            lng: wizLng || (pinCoords ? pinCoords.lng : undefined),
            photo: wizPhoto || undefined,
            name: wizAnonymous ? 'Anonymous' : (wizName.trim() || undefined),
            contact_email: (wizNotify && wizEmail.trim()) ? wizEmail.trim() : undefined,
            notify_by_email: wizNotify && !!wizEmail.trim(),
          };
          var res = await fetch('/api/service-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          var result = await res.json();
          if (result.tracking_number) {
            lastTracking = result.tracking_number;
            mode = 'success';
            disablePinMode();
            updateLeft();
            await loadData();
            updateRight();
          } else {
            throw new Error(result.error || 'Submission failed');
          }
        } catch (e) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = I.send + ' Submit Report';
          alert('Error: ' + e.message);
        }
      };
    }
  }

  /* ═══════════════════════════════════════════════════════════════
   *  BROWSE CATEGORIES
   * ═══════════════════════════════════════════════════════════════ */

  function showBrowse(el) {
    if (activeCat) return showSubTypes(el);

    var q = searchTerm.toLowerCase();
    var filtered = q
      ? CATEGORIES.filter(function(c) { return c.label.toLowerCase().includes(q) || c.types.some(function(t) { return t.label.toLowerCase().includes(q); }); })
      : CATEGORIES;

    var requests = (communityData && communityData.service_requests) ? communityData.service_requests : [];
    var countMap = {};
    for (var ri = 0; ri < requests.length; ri++) {
      var r = requests[ri];
      var cat = CATEGORIES.find(function(c) { return c.types.some(function(t) { return t.id === r.category; }); });
      if (cat) countMap[cat.id] = (countMap[cat.id] || 0) + 1;
    }

    var cardsHtml = '';
    for (var ci = 0; ci < filtered.length; ci++) {
      var c = filtered[ci];
      var cnt = countMap[c.id] || 0;
      cardsHtml += '<div class="cc-cat-card" data-cat="' + c.id + '" style="padding:18px;border-radius:16px;cursor:pointer;background:linear-gradient(135deg,' + c.color + '08,' + c.color + '03);border:1.5px solid ' + c.color + '18;transition:all .25s cubic-bezier(.16,1,.3,1);position:relative;overflow:hidden;animation:ccSlide .35s cubic-bezier(.16,1,.3,1) ' + (ci * 0.04) + 's both">'
        + '<div style="position:absolute;top:-12px;right:-12px;width:56px;height:56px;border-radius:50%;background:' + c.color + '08;pointer-events:none"></div>'
        + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">'
        +   '<div style="width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,' + c.color + ',' + c.color + 'cc);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 14px ' + c.color + '30;flex-shrink:0">' + c.icon() + '</div>'
        +   '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;color:#0f172a;letter-spacing:-.2px">' + c.label + '</div>'
        +   '<div style="font-size:11px;color:#94a3b8;margin-top:2px">' + c.types.length + ' issue type' + (c.types.length !== 1 ? 's' : '') + '</div></div>'
        +   (cnt > 0 ? '<div style="display:flex;flex-direction:column;align-items:center;padding:6px 10px;border-radius:10px;background:' + c.color + '10"><div style="font-size:16px;font-weight:800;color:' + c.color + ';line-height:1">' + cnt + '</div><div style="font-size:9px;font-weight:600;color:' + c.color + ';opacity:.7;margin-top:1px">open</div></div>' : '')
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
        + c.types.slice(0, 3).map(function(t) { return '<span style="font-size:10px;color:#64748b;padding:3px 8px;background:#f8fafc;border-radius:6px;border:1px solid #f1f5f9;white-space:nowrap">' + t.label + '</span>'; }).join('')
        + (c.types.length > 3 ? '<span style="font-size:10px;color:#94a3b8;font-weight:600">+' + (c.types.length - 3) + '</span>' : '')
        + '</div>'
        + '</div>';
    }
    if (filtered.length === 0) cardsHtml = '<div style="padding:48px 20px;text-align:center;color:#94a3b8;font-size:14px">No matching categories.</div>';

    el.innerHTML =
      '<div class="cc-anim-l">'
      + '<div style="padding:12px 18px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #f1f5f9;background:linear-gradient(180deg,#fafbff,#fff)"><button id="cc-browse-back" class="cc-back-btn">' + I.chevL + ' Home</button><div style="flex:1"></div><span style="font-size:11px;color:#94a3b8;font-weight:600">' + filtered.length + ' categories</span></div>'
      + '<div style="padding:14px 18px 8px;position:relative">'
      +   '<div style="position:absolute;left:30px;top:26px;transform:translateY(-50%);color:#94a3b8;pointer-events:none;display:flex">' + I.search + '</div>'
      +   '<input type="text" class="cc-input" id="cc-browse-search" value="' + esc(searchTerm) + '" placeholder="Search categories..." style="padding-left:40px" />'
      + '</div>'
      + '<div style="padding:8px 16px 20px;display:grid;grid-template-columns:repeat(2,1fr);gap:10px" id="cc-cat-grid">' + cardsHtml + '</div>'
      + '</div>';

    el.querySelector('#cc-browse-back').onclick = function() { mode = 'home'; searchTerm = ''; updateLeft(); };
    var searchInput = el.querySelector('#cc-browse-search');
    searchInput.oninput = function() {
      searchTerm = searchInput.value;
      showBrowse(el);
      var inp = el.querySelector('#cc-browse-search');
      if (inp) { inp.focus(); inp.selectionStart = inp.selectionEnd = searchTerm.length; }
    };
    var catCards = el.querySelectorAll('.cc-cat-card');
    for (var cri = 0; cri < catCards.length; cri++) {
      catCards[cri].onmouseenter = function() { this.style.transform = 'translateY(-2px)'; this.style.boxShadow = '0 8px 24px rgba(0,0,0,.08)'; };
      catCards[cri].onmouseleave = function() { this.style.transform = ''; this.style.boxShadow = ''; };
      catCards[cri].onclick = (function(card) {
        return function() {
          activeCat = CATEGORIES.find(function(c) { return c.id === card.dataset.cat; });
          showBrowse(el);
        };
      })(catCards[cri]);
    }
  }

  function showSubTypes(el) {
    if (!activeCat) return showBrowse(el);
    var typesHtml = '';
    for (var ti = 0; ti < activeCat.types.length; ti++) {
      var t = activeCat.types[ti];
      typesHtml += '<div class="cc-sub-card" data-type="' + t.id + '" style="padding:18px 20px;border-radius:14px;border:1.5px solid #f1f5f9;background:linear-gradient(135deg,#fafbff,#fff);cursor:pointer;transition:all .25s cubic-bezier(.16,1,.3,1);position:relative;overflow:hidden;animation:ccSlide .35s cubic-bezier(.16,1,.3,1) ' + (ti * 0.06) + 's both">'
        + '<div style="position:absolute;top:-8px;right:-8px;width:40px;height:40px;border-radius:50%;background:' + activeCat.color + '06;pointer-events:none"></div>'
        + '<div style="display:flex;align-items:center;gap:12px">'
        +   '<div style="width:36px;height:36px;border-radius:10px;background:' + activeCat.color + '12;display:flex;align-items:center;justify-content:center;color:' + activeCat.color + ';flex-shrink:0">' + activeCat.icon() + '</div>'
        +   '<div style="flex:1;min-width:0"><div style="font-size:14px;color:#1e293b;font-weight:700;letter-spacing:-.1px;margin-bottom:3px">' + t.label + '</div>'
        +   '<div style="font-size:12px;color:#64748b;line-height:1.5">' + t.desc + '</div></div>'
        +   '<div style="color:#94a3b8;flex-shrink:0">' + I.chevR + '</div>'
        + '</div>'
        + '</div>';
    }

    el.innerHTML =
      '<div class="cc-anim-l">'
      + '<div id="cc-sub-back" style="padding:18px 20px;background:linear-gradient(135deg,' + activeCat.color + '10,' + activeCat.color + '04);display:flex;align-items:center;gap:14px;cursor:pointer;border-bottom:1px solid #f1f5f9;transition:background .2s">'
      +   '<div style="color:' + activeCat.color + '">' + I.chevL + '</div>'
      +   '<div style="width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,' + activeCat.color + ',' + activeCat.color + 'cc);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 12px ' + activeCat.color + '25">' + activeCat.icon() + '</div>'
      +   '<div><span style="font-weight:800;font-size:16px;color:#0f172a;letter-spacing:-.3px;display:block">' + activeCat.label + '</span><span style="font-size:11px;color:#64748b">' + activeCat.types.length + ' issue type' + (activeCat.types.length !== 1 ? 's' : '') + '</span></div>'
      + '</div>'
      + '<div style="padding:14px 16px;display:flex;flex-direction:column;gap:10px">' + typesHtml + '</div>'
      + '</div>';

    el.querySelector('#cc-sub-back').onclick = function() { activeCat = null; showBrowse(el); };
    var subCards = el.querySelectorAll('.cc-sub-card');
    for (var sri = 0; sri < subCards.length; sri++) {
      subCards[sri].onmouseenter = function() { this.style.transform = 'translateY(-2px)'; this.style.boxShadow = '0 6px 20px rgba(0,0,0,.07)'; this.style.borderColor = '#e2e8f0'; };
      subCards[sri].onmouseleave = function() { this.style.transform = ''; this.style.boxShadow = ''; this.style.borderColor = '#f1f5f9'; };
      subCards[sri].onclick = (function(card) {
        return function() {
          var type = activeCat.types.find(function(t) { return t.id === card.dataset.type; });
          if (!type) return;
          wizCategory = { catId: activeCat.id, typeId: type.id, confidence: 1 };
          wizText = wizText || type.label;
          mode = 'wizard';
          wizStep = 2;
          updateLeft();
          if (rightView !== 'map') { rightView = 'map'; updateRight(); }
          setTimeout(function() { enablePinMode(); }, 300);
        };
      })(subCards[sri]);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
   *  TRACK REQUEST
   * ═══════════════════════════════════════════════════════════════ */

  function showTrack(el) {
    var requests = (communityData && communityData.service_requests) ? communityData.service_requests : [];
    var sorted = requests.slice().sort(function(a, b) { return new Date(b.submitted_date) - new Date(a.submitted_date); });

    var listHtml = '';
    if (sorted.length > 0) {
      listHtml = '<div style="padding-top:8px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><div style="font-size:12px;font-weight:700;color:#0f172a;letter-spacing:-.1px">Recent Requests</div><span style="font-size:11px;color:#94a3b8;font-weight:600;padding:3px 10px;background:#f8fafc;border-radius:8px;border:1px solid #f1f5f9">' + sorted.length + ' total</span></div>';
      for (var li = 0; li < sorted.length; li++) {
        var r = sorted[li];
        var ti = null, ci2 = null;
        for (var cc = 0; cc < CATEGORIES.length; cc++) {
          for (var tt = 0; tt < CATEGORIES[cc].types.length; tt++) {
            if (CATEGORIES[cc].types[tt].id === r.category) { ti = CATEGORIES[cc].types[tt]; ci2 = CATEGORIES[cc]; break; }
          }
          if (ti) break;
        }
        var es = effectiveStatus(r);
        var statusColor = es === 'resolved' ? '#22c55e' : es === 'in_progress' ? '#3b82f6' : '#f59e0b';
        var statusLabel = es === 'resolved' ? 'Resolved' : es === 'in_progress' ? 'In Progress' : 'Open';
        listHtml += '<div class="cc-track-item" data-id="' + r.id + '" style="padding:14px 16px;display:flex;align-items:center;gap:14px;border-radius:14px;cursor:pointer;transition:all .25s cubic-bezier(.16,1,.3,1);margin-bottom:6px;border:1.5px solid #f1f5f9;background:linear-gradient(135deg,#fafbff,#fff);position:relative;overflow:hidden">'
          + '<div style="width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,' + (ci2 ? ci2.color : '#6366f1') + '15,' + (ci2 ? ci2.color : '#6366f1') + '08);display:flex;align-items:center;justify-content:center;color:' + (ci2 ? ci2.color : '#6366f1') + ';flex-shrink:0">' + (ci2 ? ci2.icon() : '') + '</div>'
          + '<div style="flex:1;min-width:0">'
          + '<div style="font-size:13px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.1px">' + esc(ti ? ti.label : r.category) + '</div>'
          + '<div style="display:flex;align-items:center;gap:6px;margin-top:3px"><span style="font-size:10px;color:#94a3b8;font-family:\'Courier New\',monospace;padding:1px 6px;background:#f8fafc;border-radius:4px;border:1px solid #f1f5f9">' + esc(r.id) + '</span><span style="font-size:10px;color:#94a3b8">' + timeAgo(r.submitted_date) + '</span></div>'
          + '</div>'
          + '<div style="flex-shrink:0;display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:8px;background:' + statusColor + '10"><div style="width:6px;height:6px;border-radius:50%;background:' + statusColor + '"></div><span style="font-size:10px;font-weight:700;color:' + statusColor + ';letter-spacing:.3px">' + statusLabel + '</span></div>'
          + '</div>';
      }
      listHtml += '</div>';
    } else {
      listHtml = '<div style="text-align:center;padding:32px 16px;color:#94a3b8;font-size:13px;border-radius:14px;background:#f8fafc;border:1.5px dashed #e2e8f0;margin-top:14px">No requests yet. Create one to get started!</div>';
    }

    el.innerHTML =
      '<div class="cc-anim-l">'
      + '<div style="padding:12px 18px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #f1f5f9;background:linear-gradient(180deg,#fafbff,#fff)"><button id="cc-track-back" class="cc-back-btn">' + I.chevL + ' Home</button></div>'
      + '<div style="padding:24px 22px">'
      +   '<div style="display:flex;align-items:center;gap:14px;margin-bottom:6px"><div style="width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 6px 20px rgba(245,158,11,.3)">' + I.track + '</div><div><h3 style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-.4px;margin:0">Track Your Request</h3><p style="font-size:12px;color:#64748b;margin:3px 0 0;line-height:1.5">Look up by tracking number or browse below</p></div></div>'
      +   '<div style="margin-top:20px;padding:18px;border-radius:16px;background:linear-gradient(135deg,#fef9ee,#fffbf0);border:1.5px solid #fde68a">'
      +     '<div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px">Look Up Request</div>'
      +     '<div style="display:flex;gap:10px"><input id="cc-track-input" type="text" maxlength="20" class="cc-input" style="font-family:\'Courier New\',monospace;font-size:16px;letter-spacing:1.5px;flex:1;border-color:#fde68a" placeholder="SR-2026-001" /><button id="cc-track-btn" class="cc-btn cc-btn-primary" style="padding:12px 22px;font-size:14px">' + I.search + '</button></div>'
      +   '</div>'
      +   '<div id="cc-track-result" style="margin-top:16px"></div>'
      +   '<div style="margin-top:20px">' + listHtml + '</div>'
      + '</div>'
      + '</div>';

    el.querySelector('#cc-track-back').onclick = function() { mode = 'home'; updateLeft(); };
    el.querySelector('#cc-track-btn').onclick = async function() {
      var num = el.querySelector('#cc-track-input').value.trim().toUpperCase();
      if (!num) return;
      var resultDiv = el.querySelector('#cc-track-result');
      resultDiv.innerHTML = '<div style="text-align:center;padding:24px"><span class="cc-ai-dots"><span></span><span></span><span></span></span></div>';
      try {
        var res = await fetch('/api/service-request/' + encodeURIComponent(num));
        var data = await res.json();
        if (!data.found) {
          resultDiv.innerHTML = '<div class="cc-anim" style="text-align:center;padding:32px 16px;background:#fef2f2;border-radius:16px;border:1px solid #fecaca"><div style="font-size:15px;font-weight:700;color:#991b1b;margin-bottom:4px">Not Found</div><p style="font-size:13px;color:#b91c1c">No request found for <strong style="font-family:monospace">' + esc(num) + '</strong>. Check the number and try again.</p></div>';
          return;
        }
        activeIssue = data.request;
        mode = 'detail';
        updateLeft();
      } catch (e) {
        resultDiv.innerHTML = '<div style="color:#dc2626;font-size:13px;padding:16px;background:#fef2f2;border-radius:12px">Error: ' + esc(e.message) + '</div>';
      }
    };
    el.querySelector('#cc-track-input').onkeydown = function(e) {
      if (e.key === 'Enter') el.querySelector('#cc-track-btn').click();
    };
    // Click handlers for request list items
    var trackItems = el.querySelectorAll('.cc-track-item');
    for (var tii = 0; tii < trackItems.length; tii++) {
      trackItems[tii].onmouseenter = function() { this.style.background = '#f8fafc'; };
      trackItems[tii].onmouseleave = function() { this.style.background = ''; };
      trackItems[tii].onclick = (function(item) {
        return function() {
          var issue = requests.find(function(r) { return r.id === item.dataset.id; });
          if (issue) {
            activeIssue = issue;
            zoomToRequest(issue);
            mode = 'detail';
            updateLeft();
          }
        };
      })(trackItems[tii]);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
   *  ISSUE DETAIL
   * ═══════════════════════════════════════════════════════════════ */

  function showDetail(el) {
    if (!activeIssue) { mode = 'home'; return updateLeft(); }
    var issue = activeIssue;
    zoomToRequest(issue);
    var typeInfo = null;
    var catInfo = null;
    for (var ci2 = 0; ci2 < CATEGORIES.length; ci2++) {
      for (var ti2 = 0; ti2 < CATEGORIES[ci2].types.length; ti2++) {
        if (CATEGORIES[ci2].types[ti2].id === issue.category) {
          typeInfo = CATEGORIES[ci2].types[ti2];
          catInfo = CATEGORIES[ci2];
          break;
        }
      }
      if (typeInfo) break;
    }
    var eStatus = effectiveStatus(issue);
    var updates = issue.updates || [];

    var commentsHtml = '';
    for (var ui = 0; ui < updates.length; ui++) {
      var u = updates[ui];
      var isOff = (u.by || '').includes('@') || (u.by || '').toLowerCase().includes('dept') || (u.by || '').toLowerCase().includes('crew') || (u.by || '').toLowerCase().includes('system');
      commentsHtml += '<div style="padding:14px 0;border-top:1px solid #f1f5f9">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">'
        + '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:13px;font-weight:700;color:#0f172a">' + esc(u.by) + '</span>' + (isOff ? '<span class="cc-badge-official">Verified Official</span>' : '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.5px;background:#dbeafe;color:#1e40af">Resident</span>') + '</div>'
        + '<span style="font-size:11px;color:#94a3b8">' + timeAgo(u.date) + '</span></div>'
        + '<p style="font-size:13px;color:#475569;line-height:1.55;margin:0">' + esc(u.note) + '</p></div>';
    }
    if (updates.length === 0) commentsHtml = '<div style="text-align:center;color:#94a3b8;font-size:13px;padding:24px 0">No comments yet.</div>';

    el.innerHTML =
      '<div class="cc-anim-l">'
      + '<div style="padding:12px 18px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #f1f5f9;background:linear-gradient(180deg,#fafbff,#fff)">'
      +   '<button id="cc-detail-back" class="cc-back-btn">' + I.chevL + ' Back</button>'
      +   '<div style="flex:1"></div>'
      +   '<button id="cc-detail-new" class="cc-btn" style="padding:7px 16px;font-size:12px;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;border-radius:10px;font-weight:700;box-shadow:0 4px 12px rgba(239,68,68,.25);border:none">Report New Issue</button>'
      +   '<div id="cc-live-badge" style="display:none;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;background:linear-gradient(135deg,#dcfce7,#bbf7d0);margin-left:6px;border:1px solid rgba(34,197,94,.15)"><div id="cc-live-dot" style="width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e"></div><span style="font-size:10px;font-weight:700;color:#16a34a;letter-spacing:.5px">LIVE</span></div>'
      + '</div>'
      + '<div style="padding:24px 22px 18px">'
      +   '<div style="display:flex;align-items:flex-start;gap:16px">'
      +     '<div style="width:48px;height:48px;border-radius:14px;background:' + (catInfo ? catInfo.color : '#6366f1') + '12;display:flex;align-items:center;justify-content:center;color:' + (catInfo ? catInfo.color : '#6366f1') + ';flex-shrink:0;box-shadow:0 4px 12px ' + (catInfo ? catInfo.color : '#6366f1') + '20">' + (catInfo ? catInfo.icon() : '') + '</div>'
      +     '<div style="flex:1;min-width:0">'
      +       '<h2 style="font-size:18px;font-weight:800;color:#0f172a;margin:0;letter-spacing:-.3px">' + (typeInfo ? typeInfo.label : (catInfo ? catInfo.label : issue.category)) + '</h2>'
      +       '<div style="font-size:12px;color:#64748b;margin-top:5px;line-height:1.5">' + esc(issue.location ? issue.location.address || '' : '') + '</div>'
      +       '<div style="font-size:11px;color:#94a3b8;margin-top:3px">' + (issue.reporter ? esc(issue.reporter) + ' &middot; ' : '') + timeAgo(issue.submitted_date) + '</div>'
      +     '</div>'
      +     '<div style="text-align:right;flex-shrink:0"><div style="font-size:11px;color:#94a3b8;font-family:Courier New,monospace;margin-bottom:8px;padding:3px 8px;background:#f8fafc;border-radius:6px;border:1px solid #f1f5f9">#' + (issue.id || '').replace('SR-', '') + '</div>' + statusDots(eStatus, 'lg') + '</div>'
      +   '</div>'
      +   '<div style="display:flex;align-items:center;gap:16px;margin-top:16px;font-size:12px;color:#64748b;padding:10px 14px;background:#f8fafc;border-radius:10px;border:1px solid #f1f5f9"><span style="display:flex;align-items:center;gap:5px">0 ' + I.users + ' Follow</span><span style="display:flex;align-items:center;gap:5px">' + updates.length + ' ' + I.comment + ' Comment' + (updates.length !== 1 ? 's' : '') + '</span></div>'
      + '</div>'
      + (issue.photo ? '<div style="background:#0f172a;position:relative"><img src="' + issue.photo + '" alt="Issue photo" style="width:100%;max-height:260px;object-fit:cover;display:block" /><div style="display:flex"><div style="flex:1;padding:10px;background:#1e293b;color:#fff;font-size:12px;font-weight:600;text-align:center">' + I.photo + ' 1 Attachment</div><div style="flex:1;padding:10px;color:#94a3b8;font-size:12px;font-weight:600;text-align:center;cursor:pointer">' + I.map + ' Map</div></div></div>' : '')
      + '<div style="padding:18px 20px;border-top:1px solid #e2e8f0">'
      +   '<h3 style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.7px;margin-bottom:8px">Details</h3>'
      +   '<div style="width:100%;height:1px;background:#e2e8f0;margin-bottom:12px"></div>'
      +   '<div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:4px">Description</div>'
      +   '<p style="font-size:13px;color:#475569;line-height:1.65;margin:0">' + esc(issue.description) + '</p>'
      + '</div>'
      + '<div style="padding:18px 20px;border-top:1px solid #e2e8f0">'
      +   '<h3 style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.7px;margin-bottom:14px">' + updates.length + ' Comment' + (updates.length !== 1 ? 's' : '') + '</h3>'
      +   '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><input id="cc-comment-name" type="text" class="cc-input" placeholder="Your name (optional)" style="font-size:12px;flex:1;max-width:200px" maxlength="60" /><label style="display:flex;align-items:center;gap:5px;font-size:12px;color:#64748b;cursor:pointer;white-space:nowrap;user-select:none"><input id="cc-comment-anon" type="checkbox" style="accent-color:#6366f1;width:15px;height:15px;cursor:pointer" /> Anonymous</label></div>'
      +   '<div style="display:flex;gap:8px;margin-bottom:16px"><input id="cc-comment-input" type="text" class="cc-input" placeholder="Add a comment..." style="font-size:13px;flex:1" maxlength="1000" /><button id="cc-comment-send" class="cc-btn cc-btn-primary" style="padding:8px 16px;font-size:12px;flex-shrink:0">' + I.send + ' Send</button></div>'
      +   '<div id="cc-comments-list">' + commentsHtml + '</div>'
      + '</div>'
      + '</div>';

    el.querySelector('#cc-detail-back').onclick = function() { if (liveEventSource) { liveEventSource.close(); liveEventSource = null; } activeIssue = null; mode = 'track'; if (leafletMap && markerLayer) { leafletMap.closePopup(); var b = []; markerLayer.eachLayer(function(l) { if (l.getLatLng) b.push(l.getLatLng()); }); if (b.length) leafletMap.flyToBounds(b, { padding: [40, 40], maxZoom: 14, duration: 0.6 }); } updateLeft(); };
    el.querySelector('#cc-detail-new').onclick = function() { if (liveEventSource) { liveEventSource.close(); liveEventSource = null; } activeIssue = null; mode = 'wizard'; wizStep = 0; wizText = ''; wizCategory = null; updateLeft(); };

    // ── Comment submission ──
    var commentInput = el.querySelector('#cc-comment-input');
    var commentSend = el.querySelector('#cc-comment-send');
    var commentName = el.querySelector('#cc-comment-name');
    var commentAnon = el.querySelector('#cc-comment-anon');
    commentAnon.onchange = function() { commentName.disabled = commentAnon.checked; if (commentAnon.checked) commentName.value = ''; };
    async function submitComment() {
      var text = commentInput.value.trim();
      if (!text) return;
      var author = commentAnon.checked ? 'Anonymous' : (commentName.value.trim() || issue.resident_name || 'Resident');
      commentSend.disabled = true;
      commentSend.textContent = 'Sending...';
      try {
        var resp = await fetch('/api/service-request/' + encodeURIComponent(issue.id) + '/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment: text, author: author })
        });
        var data = await resp.json();
        if (data.success) {
          issue.updates = issue.updates || [];
          issue.updates.push(data.update);
          commentInput.value = '';
          // Re-render comment list + count
          var listEl = el.querySelector('#cc-comments-list');
          if (listEl) {
            var html = '';
            for (var ci = 0; ci < issue.updates.length; ci++) {
              var cu = issue.updates[ci];
              var isOfficial = (cu.by || '').includes('@') || (cu.by || '').toLowerCase().includes('dept') || (cu.by || '').toLowerCase().includes('crew') || (cu.by || '').toLowerCase().includes('system');
              html += '<div style="padding:14px 0;border-top:1px solid #f1f5f9">'
                + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">'
                + '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:13px;font-weight:700;color:#0f172a">' + esc(cu.by) + '</span>' + (isOfficial ? '<span class="cc-badge-official">Verified Official</span>' : '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.5px;background:#dbeafe;color:#1e40af">Resident</span>') + '</div>'
                + '<span style="font-size:11px;color:#94a3b8">' + timeAgo(cu.date) + '</span></div>'
                + '<p style="font-size:13px;color:#475569;line-height:1.55;margin:0">' + esc(cu.note) + '</p></div>';
            }
            listEl.innerHTML = html;
          }
        }
      } catch(e) { /* ignore */ }
      commentSend.disabled = false;
      commentSend.innerHTML = I.send + ' Send';
    }
    commentSend.onclick = submitComment;
    commentInput.onkeydown = function(e) { if (e.key === 'Enter') submitComment(); };

    // ── SSE Live Notifications ──
    if (liveEventSource) { liveEventSource.close(); liveEventSource = null; }
    if (issue.id) {
      try {
        liveEventSource = new EventSource('/api/notifications/subscribe/' + encodeURIComponent(issue.id));
        liveEventSource.addEventListener('update', function(ev) {
          try {
            var update = JSON.parse(ev.data);
            // Add the update to issue and re-render comment list
            if (update.note || update.status) {
              var newUpdate = { date: update.timestamp ? update.timestamp.split('T')[0] : new Date().toISOString().split('T')[0], note: update.note || ('Status changed to ' + update.status), by: update.by || 'System' };
              issue.updates = issue.updates || [];
              issue.updates.push(newUpdate);
              var listEl = el.querySelector('#cc-comments-list');
              if (listEl) {
                var isOff2 = (newUpdate.by || '').includes('@') || (newUpdate.by || '').toLowerCase().includes('dept') || (newUpdate.by || '').toLowerCase().includes('crew') || (newUpdate.by || '').toLowerCase().includes('system');
                listEl.insertAdjacentHTML('beforeend',
                  '<div class="cc-anim" style="padding:14px 0;border-top:1px solid #f1f5f9">'
                  + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">'
                  + '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:13px;font-weight:700;color:#0f172a">' + esc(newUpdate.by) + '</span>' + (isOff2 ? '<span class="cc-badge-official">Verified Official</span>' : '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.5px;background:#dbeafe;color:#1e40af">Resident</span>') + '</div>'
                  + '<span style="font-size:11px;color:#94a3b8">just now</span></div>'
                  + '<p style="font-size:13px;color:#475569;line-height:1.55;margin:0">' + esc(newUpdate.note) + '</p></div>'
                );
              }
              // Flash the live indicator
              var liveDot = el.querySelector('#cc-live-dot');
              if (liveDot) { liveDot.style.animation = 'none'; liveDot.offsetHeight; liveDot.style.animation = 'ccPulse 1.5s ease-in-out 3'; }
            }
          } catch(e2) { /* ignore malformed */ }
        });
        liveEventSource.addEventListener('connected', function() {
          var badge = el.querySelector('#cc-live-badge');
          if (badge) badge.style.display = 'flex';
        });
        liveEventSource.onerror = function() {
          var badge = el.querySelector('#cc-live-badge');
          if (badge) badge.style.display = 'none';
        };
      } catch(e3) { /* SSE not supported or error */ }
    }
  }

  /* ═══════════════════════════════════════════════════════════════
   *  SUCCESS
   * ═══════════════════════════════════════════════════════════════ */

  function showSuccess(el) {
    var emailNote = wizNotify && wizEmail
      ? '<div style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:12px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #bfdbfe;margin-bottom:20px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><span style="font-size:13px;color:#1e40af;font-weight:600">Confirmation sent to ' + esc(wizEmail) + '</span></div>'
      : '';

    el.innerHTML =
      '<div class="cc-anim" style="padding:52px 28px;text-align:center">'
      + '<div style="position:relative;margin:0 auto 28px;width:88px;height:88px">'
      +   '<div style="width:88px;height:88px;border-radius:50%;background:linear-gradient(135deg,#dcfce7,#bbf7d0);display:flex;align-items:center;justify-content:center;box-shadow:0 0 50px rgba(16,185,129,.25),0 8px 24px rgba(16,185,129,.15);animation:ccCheckPop .6s cubic-bezier(.16,1,.3,1) both">' + I.check + '</div>'
      +   '<div style="position:absolute;inset:-8px;border-radius:50%;border:2px solid rgba(16,185,129,.15);animation:ccPulse 2s ease-in-out infinite"></div>'
      + '</div>'
      + '<h2 style="font-size:26px;font-weight:800;color:#0f172a;margin-bottom:6px;letter-spacing:-.5px">Report Submitted!</h2>'
      + '<p style="font-size:14px;color:#64748b;margin-bottom:18px">Your tracking number:</p>'
      + '<div style="display:inline-block;font-family:Courier New,monospace;font-size:30px;font-weight:800;color:#10b981;margin-bottom:10px;letter-spacing:3px;padding:8px 24px;background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:14px;border:1px solid rgba(16,185,129,.15)">' + lastTracking + '</div>'
      + '<p style="font-size:13px;color:#94a3b8;margin-bottom:20px;max-width:320px;margin-left:auto;margin-right:auto;line-height:1.65">Save this number. You can track status updates, crew assignments, and official comments anytime.</p>'
      + emailNote
      + '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">'
      +   '<button id="cc-suc-track" class="cc-btn cc-btn-primary" style="padding:14px 28px;font-size:15px">Track This Request</button>'
      +   '<button id="cc-suc-new" class="cc-btn cc-btn-ghost" style="padding:14px 28px;font-size:15px">Report Another</button>'
      + '</div>'
      + '</div>';

    el.querySelector('#cc-suc-track').onclick = async function() {
      try {
        var res = await fetch('/api/service-request/' + encodeURIComponent(lastTracking));
        var data = await res.json();
        if (data.found) { activeIssue = data.request; mode = 'detail'; updateLeft(); }
      } catch (e) { /* ignore */ }
    };
    el.querySelector('#cc-suc-new').onclick = function() {
      mode = 'wizard'; wizStep = 0; wizText = ''; wizCategory = null; wizAddress = ''; wizPhoto = null; wizEmail = ''; wizNotify = false; wizName = ''; wizAnonymous = false;
      updateLeft();
    };
  }

  /* ═══════════════════════════════════════════════════════════════
   *  RIGHT PANEL
   * ═══════════════════════════════════════════════════════════════ */

  function updateRight() {
    var el = overlay ? overlay.querySelector('#cc-right') : null;
    if (!el) return;
    if (leafletMap) { leafletMap.remove(); leafletMap = null; markerLayer = null; markerById = {}; }

    var listSearch = rightView === 'list' ?
      '<div style="flex:1"></div><div style="position:relative"><div style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#94a3b8;display:flex;pointer-events:none">' + I.search + '</div><input type="text" id="cc-keyword" class="cc-input" placeholder="Keyword" style="padding:7px 12px 7px 32px;width:160px;font-size:12px" /></div>'
      : '';

    var isStaffLegend = !!(window.staffAuthToken);
    var layerChips = isStaffLegend ? [
      { type:'service_request', label:'Service Requests', color:'#10b981', icon:'\uD83D\uDCCB' },
      { type:'pothole', label:'Potholes', color:'#ef4444', icon:'\u26A0\uFE0F' },
      { type:'sidewalk', label:'Sidewalks', color:'#f97316', icon:'\uD83D\uDEB6' },
      { type:'work_order', label:'Work Orders', color:'#6366f1', icon:'\uD83D\uDD27' },
      { type:'school', label:'Schools', color:'#8b5cf6', icon:'\uD83C\uDFEB' },
    ] : [];
    var chipHtml = '';
    for (var lci = 0; lci < layerChips.length; lci++) {
      var lc = layerChips[lci];
      chipHtml += '<button class="cc-layer-chip" data-layer="' + lc.type + '" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:99px;font-size:11px;font-weight:600;cursor:pointer;border:1.5px solid ' + lc.color + ';background:' + lc.color + '18;color:' + lc.color + ';transition:all .2s;white-space:nowrap">' + lc.icon + ' ' + lc.label + '</button>';
    }
    var legendBar = rightView === 'map' ?
      (chipHtml ? '<div style="padding:6px 12px;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;gap:8px;flex-shrink:0;background:#fff;flex-wrap:wrap">' + chipHtml + '</div>' : '')
      + '<div style="padding:6px 16px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:center;gap:16px;flex-shrink:0;background:#fff;flex-wrap:wrap">'
      + '<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b"><div style="width:10px;height:10px;border-radius:50%;background:#ef4444"></div> Submitted</span>'
      + '<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b"><div style="width:10px;height:10px;border-radius:50%;background:#f59e0b"></div> Received</span>'
      + '<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b"><div style="width:10px;height:10px;border-radius:50%;background:#3b82f6"></div> In Progress</span>'
      + '<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b"><div style="width:10px;height:10px;border-radius:50%;background:#10b981"></div> Completed</span>'
      + '</div>'
      : '';

    el.innerHTML =
      '<div style="padding:8px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e2e8f0;flex-shrink:0;background:#fff">'
      +   '<div class="cc-toggle">'
      +     '<button id="cc-t-map" class="' + (rightView === 'map' ? 'active' : 'inactive') + '">' + I.map + ' Map</button>'
      +     '<button id="cc-t-list" class="' + (rightView === 'list' ? 'active' : 'inactive') + '">' + I.list + ' List</button>'
      +   '</div>'
      +   listSearch
      + '</div>'
      + '<div id="cc-right-body" style="flex:1;overflow:hidden;position:relative"></div>'
      + legendBar;

    el.querySelector('#cc-t-map').onclick = function() { rightView = 'map'; updateRight(); };
    el.querySelector('#cc-t-list').onclick = function() { rightView = 'list'; updateRight(); };

    // Wire layer filter chips (staff mode)
    var layerChipBtns = el.querySelectorAll('.cc-layer-chip');
    for (var lbi = 0; lbi < layerChipBtns.length; lbi++) {
      layerChipBtns[lbi].onclick = (function(btn) {
        return function() {
          var layerType = btn.dataset.layer;
          if (spVisibleTypes[layerType]) {
            delete spVisibleTypes[layerType];
            btn.style.opacity = '0.3';
            btn.style.background = '#f1f5f9';
            btn.style.color = '#94a3b8';
            btn.style.borderColor = '#cbd5e1';
          } else {
            spVisibleTypes[layerType] = true;
            var chipColors = { service_request:'#10b981', pothole:'#ef4444', sidewalk:'#f97316', work_order:'#6366f1', school:'#8b5cf6' };
            var cc = chipColors[layerType] || '#6366f1';
            btn.style.opacity = '1';
            btn.style.background = cc + '18';
            btn.style.color = cc;
            btn.style.borderColor = cc;
          }
          // Re-filter markers on the map
          if (markerLayer) {
            markerLayer.clearLayers();
            for (var ei = 0; ei < spAllMarkerEntries.length; ei++) {
              var entry = spAllMarkerEntries[ei];
              if (spVisibleTypes[entry.data.type]) {
                entry.marker.addTo(markerLayer);
              }
            }
          }
        };
      })(layerChipBtns[lbi]);
    }

    if (rightView === 'map') initMap();
    else renderList();
  }

  // ── Lake Forest map settings (shared with civic-map.js) ──
  var SP_MAP_CENTER = [42.2586, -87.8407];
  var SP_MAP_ZOOM = 13;
  // Real Lake Forest, IL city boundary (OpenStreetMap relation 122071, simplified)
  var SP_MAP_BOUNDARY = [
    [42.258782,-87.902012],[42.254845,-87.90103],[42.253493,-87.899769],[42.250064,-87.901492],
    [42.244495,-87.901518],[42.240107,-87.899468],[42.237969,-87.900912],[42.23666,-87.900687],
    [42.236685,-87.901553],[42.228522,-87.901358],[42.203447,-87.890053],[42.203589,-87.846963],
    [42.210838,-87.847006],[42.210814,-87.844735],[42.212394,-87.842161],[42.218023,-87.842147],
    [42.218454,-87.816239],[42.219276,-87.815168],[42.220264,-87.815182],[42.221526,-87.809925],
    [42.223328,-87.807632],[42.226781,-87.810773],[42.239076,-87.814556],[42.241053,-87.815872],
    [42.248669,-87.817666],[42.251422,-87.819517],[42.255039,-87.820564],[42.260596,-87.82448],
    [42.268859,-87.828084],[42.268873,-87.872234],[42.279731,-87.878551],[42.279821,-87.885532],
    [42.261679,-87.885971],[42.261558,-87.889095],[42.258126,-87.885976],[42.250906,-87.885903],
    [42.250966,-87.887666],[42.256391,-87.890173],[42.255847,-87.893692],[42.257924,-87.892479],
    [42.259069,-87.894254],[42.258782,-87.902012],
  ];

  // ─── Tabbed popup helpers for service portal map ──────────────
  var spIcons = {
    alert: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    user: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    wrench: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>',
    dollar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
    school: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    sparkle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>',
    access: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="4" r="2"/><path d="M12 6v6M7 18l5-6 5 6"/></svg>',
  };
  var spPriorityLabels = { critical:'\u{1F534} Critical', high:'\u{1F7E0} High', medium:'\u{1F7E1} Medium', low:'\u{1F7E2} Low' };
  var spStatusColors = { open:'#ef4444', in_progress:'#3b82f6', completed:'#10b981', reported:'#f59e0b', active:'#22c55e' };

  function spGetTabsForType(type) {
    switch (type) {
      case 'pothole':         return ['overview','details','location'];
      case 'sidewalk':        return ['overview','details','location'];
      case 'work_order':      return ['overview','details','cost'];
      case 'service_request': return ['overview','history','location'];
      case 'school':          return ['overview','details'];
      default:                return ['overview'];
    }
  }

  function spSeverityBar(value, max) {
    max = max || 10;
    var pct = Math.round((value / max) * 100);
    var color = value >= 8 ? '#ef4444' : value >= 5 ? '#f59e0b' : '#22c55e';
    return '<div style="display:flex;align-items:center;gap:8px;width:100%">'
      + '<div style="flex:1;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">'
      + '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:3px"></div></div>'
      + '<span style="font-size:11px;font-weight:700;color:' + color + '">' + value + '/' + max + '</span></div>';
  }

  function spStatCell(label, value, icon) {
    return '<div style="padding:10px;background:#fff;display:flex;flex-direction:column;align-items:center;gap:2px">'
      + (icon ? '<span style="color:#64748b">' + icon + '</span>' : '')
      + '<span style="font-size:13px;font-weight:700;color:#1e293b">' + value + '</span>'
      + '<span style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">' + label + '</span></div>';
  }

  function spTimelineRow(title, date, desc, color, isLast) {
    return '<div style="display:flex;gap:10px;min-height:48px">'
      + '<div style="display:flex;flex-direction:column;align-items:center;width:16px">'
      + '<div style="width:10px;height:10px;border-radius:50%;background:' + color + ';border:2px solid white;box-shadow:0 0 0 2px ' + color + '40;flex-shrink:0;margin-top:3px"></div>'
      + (isLast ? '' : '<div style="flex:1;width:1px;background:#e2e8f0;margin:2px 0"></div>')
      + '</div><div style="flex:1;padding-bottom:' + (isLast ? '0' : '10px') + '">'
      + '<div style="font-size:12px;font-weight:600;color:#1e293b">' + title + '</div>'
      + (date ? '<div style="font-size:10px;color:#94a3b8">' + date + '</div>' : '')
      + '<div style="font-size:11px;color:#64748b;margin-top:1px">' + desc + '</div>'
      + '</div></div>';
  }

  function spBuildTabContent(m, tab, typeColor) {
    var statusColor = spStatusColors[m.status] || typeColor;
    var html = '';

    if (tab === 'overview') {
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:10px">';
      if (m.severity != null) {
        var sL = m.severity >= 8 ? 'Critical' : m.severity >= 5 ? 'Moderate' : 'Low';
        html += spStatCell('Severity', sL, spIcons.alert);
      }
      if (m.status) html += spStatCell('Status', '<span style="color:' + statusColor + '">' + (m.status || '').replace(/_/g,' ') + '</span>', spIcons.clock);
      if (m.priority) html += spStatCell('Priority', m.priority, I.target);
      if (m.zone) html += spStatCell('Zone', m.zone, I.mapPin);
      if (m.enrollment) html += spStatCell('Students', (m.enrollment || 0).toLocaleString(), spIcons.user);
      if (m.school_type) html += spStatCell('Type', m.school_type, spIcons.school);
      if (m.category) html += spStatCell('Category', (m.category || '').replace(/_/g,' '), '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>');
      if (m.work_type) html += spStatCell('Work Type', (m.work_type || '').replace(/_/g,' '), spIcons.wrench);
      if (m.estimated_cost) html += spStatCell('Est. Cost', '$' + m.estimated_cost.toLocaleString(), spIcons.dollar);
      html += '</div>';
      if ((m.type === 'pothole' || m.type === 'sidewalk') && m.severity != null) {
        html += '<div style="margin-bottom:8px"><div style="font-size:10px;color:#94a3b8;margin-bottom:3px">SEVERITY LEVEL</div>' + spSeverityBar(m.severity) + '</div>';
      }
      if (m.description) {
        html += '<div style="background:#f8fafc;border-radius:8px;padding:8px 10px;font-size:12px;color:#475569;line-height:1.5;border-left:3px solid ' + typeColor + '">"' + esc(m.description.length > 140 ? m.description.slice(0,140) + '\u2026' : m.description) + '"</div>';
      }
      if (m.type === 'service_request') {
        html += '<div style="display:flex;gap:8px;margin-top:8px">';
        if (m.resident_name) html += '<div style="flex:1;display:flex;align-items:center;gap:6px;padding:8px;background:#f0fdf4;border-radius:8px"><span style="color:#10b981">' + spIcons.user + '</span><div><div style="font-size:10px;color:#94a3b8">Submitted by</div><div style="font-size:12px;font-weight:600;color:#1e293b">' + esc(m.resident_name) + '</div></div></div>';
        if (m.submitted_date) html += '<div style="flex:1;display:flex;align-items:center;gap:6px;padding:8px;background:#eff6ff;border-radius:8px"><span style="color:#3b82f6">' + spIcons.clock + '</span><div><div style="font-size:10px;color:#94a3b8">Filed on</div><div style="font-size:12px;font-weight:600;color:#1e293b">' + m.submitted_date + '</div></div></div>';
        html += '</div>';
      }
      if (m.type === 'school' && m.name) {
        html += '<div style="font-size:13px;color:#1e293b;font-weight:600;margin-bottom:4px">' + esc(m.name) + '</div>';
      }
    }

    else if (tab === 'details') {
      html += '<div style="display:flex;flex-direction:column;gap:8px">';
      if (m.type === 'pothole' || m.type === 'sidewalk') {
        if (m.severity != null) html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:12px;color:#64748b">Severity Score</span><span style="font-size:12px;font-weight:600;color:#1e293b">' + m.severity + '/10</span></div>';
        if (m.near_school) html += '<div style="display:flex;align-items:center;gap:6px;padding:8px;background:#fef3c7;border-radius:8px"><span style="color:#d97706">' + spIcons.alert + '</span><div><div style="font-size:11px;font-weight:600;color:#92400e">Near School Zone</div><div style="font-size:10px;color:#a16207">' + (m.school_name || 'Nearby school') + '</div></div></div>';
        if (m.ada_compliant === false) html += '<div style="display:flex;align-items:center;gap:6px;padding:8px;background:#fee2e2;border-radius:8px"><span style="color:#dc2626">' + spIcons.access + '</span><div><div style="font-size:11px;font-weight:600;color:#991b1b">ADA Non-Compliant</div><div style="font-size:10px;color:#b91c1c">Requires accessibility remediation</div></div></div>';
      }
      if (m.type === 'work_order') {
        if (m.work_type) html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:12px;color:#64748b">Work Type</span><span style="font-size:12px;font-weight:600;color:#1e293b">' + (m.work_type || '').replace(/_/g,' ') + '</span></div>';
        if (m.priority) html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:12px;color:#64748b">Priority</span><span style="font-size:12px">' + (spPriorityLabels[m.priority] || m.priority) + '</span></div>';
      }
      if (m.type === 'school') {
        if (m.name) html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:12px;color:#64748b">School Name</span><span style="font-size:12px;font-weight:600;color:#1e293b">' + esc(m.name) + '</span></div>';
        if (m.school_type) html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:12px;color:#64748b">School Type</span><span style="font-size:12px;font-weight:600;color:#1e293b">' + m.school_type + '</span></div>';
        if (m.enrollment) html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:12px;color:#64748b">Enrollment</span><span style="font-size:12px;font-weight:600;color:#1e293b">' + m.enrollment.toLocaleString() + ' students</span></div>';
      }
      if (m.type === 'service_request') {
        if (m.category) html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:12px;color:#64748b">Category</span><span style="font-size:12px;font-weight:600;color:#1e293b">' + (m.category || '').replace(/_/g,' ') + '</span></div>';
        if (m.submitted_date) html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:12px;color:#64748b">Submitted</span><span style="font-size:12px;font-weight:600;color:#1e293b">' + m.submitted_date + '</span></div>';
        if (m.description) html += '<div style="margin-top:4px;padding:8px;background:#f8fafc;border-radius:8px;font-size:12px;color:#475569;line-height:1.5">"' + esc(m.description) + '"</div>';
      }
      if (m.id) html += '<div style="display:flex;justify-content:space-between;padding:6px 0"><span style="font-size:12px;color:#64748b">Reference ID</span><span style="font-size:11px;font-family:monospace;color:#6366f1;background:#eef2ff;padding:2px 6px;border-radius:4px">' + m.id + '</span></div>';
      html += '</div>';
    }

    else if (tab === 'location') {
      html += '<div style="display:flex;flex-direction:column;gap:8px">';
      if (m.address) html += '<div style="display:flex;align-items:flex-start;gap:8px;padding:10px;background:#f0fdf4;border-radius:8px"><span style="color:#16a34a;margin-top:1px">' + I.mapPin + '</span><div><div style="font-size:12px;font-weight:600;color:#1e293b">' + esc(m.address) + '</div><div style="font-size:10px;color:#64748b;margin-top:2px">Lake Forest, IL</div></div></div>';
      if (m.zone) html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:12px;color:#64748b">Zone</span><span style="font-size:12px;font-weight:600;color:#1e293b">' + m.zone + '</span></div>';
      html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:12px;color:#64748b">Coordinates</span><span style="font-size:11px;font-family:monospace;color:#64748b">' + m.lat.toFixed(4) + ', ' + m.lng.toFixed(4) + '</span></div>';
      html += '</div>';
    }

    else if (tab === 'cost') {
      html += '<div style="display:flex;flex-direction:column;gap:8px">';
      if (m.estimated_cost) {
        html += '<div style="text-align:center;padding:16px 0"><div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Estimated Cost</div><div style="font-size:28px;font-weight:800;color:#1e293b">$' + m.estimated_cost.toLocaleString() + '</div></div>';
        var costPct = Math.min(100, Math.round((m.estimated_cost / 10000) * 100));
        var costColor = m.estimated_cost > 5000 ? '#ef4444' : m.estimated_cost > 2000 ? '#f59e0b' : '#22c55e';
        html += '<div><div style="font-size:10px;color:#94a3b8;margin-bottom:3px">BUDGET IMPACT</div><div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden"><div style="width:' + costPct + '%;height:100%;background:' + costColor + ';border-radius:3px"></div></div><div style="display:flex;justify-content:space-between;margin-top:3px"><span style="font-size:9px;color:#94a3b8">$0</span><span style="font-size:9px;color:#94a3b8">$10,000</span></div></div>';
      } else {
        html += '<div style="text-align:center;padding:20px 0;color:#94a3b8;font-size:12px">No cost estimate available</div>';
      }
      if (m.priority) html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #f1f5f9;margin-top:4px"><span style="font-size:12px;color:#64748b">Priority</span><span style="font-size:12px">' + (spPriorityLabels[m.priority] || m.priority) + '</span></div>';
      html += '</div>';
    }

    else if (tab === 'history') {
      html += '<div style="display:flex;flex-direction:column;gap:0">';
      if (m.submitted_date) html += spTimelineRow('Submitted', m.submitted_date, m.resident_name ? 'Request from ' + esc(m.resident_name) : 'Request created', '#3b82f6', false);
      if (m.status === 'open') {
        html += spTimelineRow('Open', '', 'Awaiting assignment', '#94a3b8', true);
      } else if (m.status === 'in_progress') {
        html += spTimelineRow('In Progress', m.updated_date || '', m.assigned_crew ? 'Assigned to ' + esc(m.assigned_crew) : 'Work is underway', '#f59e0b', !m.resolution_eta);
        if (m.resolution_eta) html += spTimelineRow('ETA', m.resolution_eta, 'Estimated resolution', '#8b5cf6', true);
      } else if (m.status === 'completed') {
        html += spTimelineRow('In Progress', '', 'Work completed', '#f59e0b', false);
        html += spTimelineRow('Completed', m.updated_date || '', 'Issue resolved', '#22c55e', true);
      }
      html += '</div>';
    }

    return html;
  }

  function spBuildPopup(m, typeColor, statusColor, label) {
    var tabs = spGetTabsForType(m.type);
    var displayName = m.type === 'school' && m.name ? esc(m.name)
      : m.type === 'service_request' && m.category ? esc(m.category.replace(/_/g,' ')).replace(/^\w/, function(c) { return c.toUpperCase(); }) + ' Request'
      : label;
    var html = '<div class="sp-card-popup" style="font-family:system-ui,-apple-system,sans-serif;min-width:280px;max-width:340px">';
    html += '<div style="height:4px;background:linear-gradient(90deg,' + typeColor + ',' + typeColor + '80);border-radius:10px 10px 0 0"></div>';
    html += '<div style="padding:12px 14px 8px;display:flex;align-items:center;gap:8px">';
    html += '<div style="width:32px;height:32px;border-radius:8px;background:' + typeColor + '15;display:flex;align-items:center;justify-content:center;color:' + typeColor + ';flex-shrink:0;font-size:14px;font-weight:700">' + label.charAt(0) + '</div>';
    html += '<div style="flex:1;min-width:0">';
    html += '<div style="font-size:14px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + displayName + '</div>';
    html += '<div style="display:flex;align-items:center;gap:6px;margin-top:2px">';
    if (m.status) html += '<span style="font-size:9px;padding:2px 7px;border-radius:99px;background:' + statusColor + '18;color:' + statusColor + ';font-weight:600;text-transform:uppercase;letter-spacing:.3px">' + (m.status || '').replace(/_/g,' ') + '</span>';
    if (m.priority) html += '<span style="font-size:9px">' + (spPriorityLabels[m.priority] || m.priority) + '</span>';
    html += '</div></div>';
    if (m.id) html += '<span style="font-size:9px;color:#94a3b8;font-family:monospace;background:#f1f5f9;padding:2px 5px;border-radius:4px;flex-shrink:0">' + m.id + '</span>';
    html += '</div>';
    html += '<div style="display:flex;gap:0;padding:0 14px;border-bottom:1px solid #e2e8f0">';
    for (var ti = 0; ti < tabs.length; ti++) {
      var t = tabs[ti], isA = t === 'overview';
      html += '<button class="sp-tab-btn' + (isA ? ' active' : '') + '" data-tab="' + t + '" onclick="event.stopPropagation();window.__spSwitchTab&&window.__spSwitchTab(this)" style="padding:8px 12px;font-size:11px;font-weight:' + (isA ? '600' : '500') + ';color:' + (isA ? typeColor : '#64748b') + ';background:none;border:none;cursor:pointer;border-bottom:2px solid ' + (isA ? typeColor : 'transparent') + ';transition:all .15s;white-space:nowrap">' + t.charAt(0).toUpperCase() + t.slice(1) + '</button>';
    }
    html += '</div>';
    for (var pi = 0; pi < tabs.length; pi++) {
      var pt = tabs[pi], pA = pt === 'overview';
      html += '<div class="sp-tab-panel" data-panel="' + pt + '" data-type-color="' + typeColor + '" style="padding:12px 14px;max-height:200px;overflow-y:auto;display:' + (pA ? 'block' : 'none') + '">' + spBuildTabContent(m, pt, typeColor) + '</div>';
    }
    html += '</div>';
    return html;
  }

  if (!window.__spSwitchTab) {
    window.__spSwitchTab = function(btn) {
      var popup = btn.closest('.sp-card-popup');
      if (!popup) return;
      var tab = btn.getAttribute('data-tab');
      var fp = popup.querySelector('.sp-tab-panel');
      var color = fp ? fp.getAttribute('data-type-color') || '#6366f1' : '#6366f1';
      var btns = popup.querySelectorAll('.sp-tab-btn');
      for (var i = 0; i < btns.length; i++) {
        var isT = btns[i].getAttribute('data-tab') === tab;
        btns[i].className = 'sp-tab-btn' + (isT ? ' active' : '');
        btns[i].style.fontWeight = isT ? '600' : '500';
        btns[i].style.color = isT ? color : '#64748b';
        btns[i].style.borderBottom = '2px solid ' + (isT ? color : 'transparent');
      }
      var panels = popup.querySelectorAll('.sp-tab-panel');
      for (var j = 0; j < panels.length; j++) {
        panels[j].style.display = panels[j].getAttribute('data-panel') === tab ? 'block' : 'none';
      }
    };
  }

  function initMap() {
    var c = overlay ? overlay.querySelector('#cc-right-body') : null;
    if (!c || typeof L === 'undefined') return;
    leafletMap = L.map(c, { center: SP_MAP_CENTER, zoom: SP_MAP_ZOOM, zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(leafletMap);
    markerLayer = L.layerGroup().addTo(leafletMap);
    markerById = {};

    // Draw city boundary
    if (SP_MAP_BOUNDARY.length > 2) {
      L.polygon(SP_MAP_BOUNDARY, {
        color: '#0d9488', weight: 2, opacity: 0.6,
        fillColor: '#0d9488', fillOpacity: 0.04,
        dashArray: '6, 4', interactive: false,
      }).addTo(leafletMap);
    }

    var sCol = { open: '#ef4444', in_progress: '#3b82f6', completed: '#10b981', reported: '#f59e0b', active: '#22c55e' };
    var tCol = { pothole:'#ef4444', sidewalk:'#f97316', work_order:'#6366f1', service_request:'#10b981', school:'#8b5cf6' };
    var tLabel = { pothole:'Pothole', sidewalk:'Sidewalk Issue', work_order:'Work Order', service_request:'Service Request', school:'School' };
    var bounds = [];
    var isStaff = !!(window.staffAuthToken);
    // Residents see only service requests + schools; staff sees all
    var visibleTypes = isStaff
      ? { pothole:true, sidewalk:true, work_order:true, service_request:true, school:true }
      : { service_request:true, school:true };
    spAllMarkerEntries = [];
    spVisibleTypes = visibleTypes;

    if (mapMarkerData && mapMarkerData.markers) {
      for (var mi = 0; mi < mapMarkerData.markers.length; mi++) {
        var m = mapMarkerData.markers[mi];
        var typeColor = tCol[m.type] || '#94a3b8';
        var statusColor = sCol[m.status] || typeColor;
        var label = tLabel[m.type] || (m.type || '').replace(/_/g, ' ');
        if (m.type === 'service_request' && m.category) {
          label = esc(m.category.replace(/_/g,' ')).replace(/^\w/, function(c) { return c.toUpperCase(); }) + ' Request';
        }
        var displayName = m.type === 'school' && m.name ? esc(m.name) : label;

        var popHtml = spBuildPopup(m, typeColor, statusColor, label);

        var marker;
        if (m.type === 'school') {
          marker = L.marker([m.lat, m.lng], {
            icon: L.divIcon({
              className: '',
              html: '<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:#8b5cf6;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);color:#fff;font-size:15px" title="' + esc(m.name || 'School') + '">\uD83C\uDFEB</div>',
              iconSize: [28, 28],
              iconAnchor: [14, 14],
              popupAnchor: [0, -14],
            })
          }).bindPopup(popHtml, { maxWidth: 340, minWidth: 280, className: 'cc-popup-card', closeButton: false });
        } else {
          marker = L.circleMarker([m.lat, m.lng], {
            radius: m.severity ? Math.max(5, Math.min(12, m.severity * 1.2)) : 7,
            fillColor: typeColor + 'cc', color: statusColor, weight: 2, opacity: 1, fillOpacity: .75,
          }).bindPopup(popHtml, { maxWidth: 340, minWidth: 280, className: 'cc-popup-card', closeButton: false });
        }
        // Only add to map if type is visible
        if (visibleTypes[m.type]) marker.addTo(markerLayer);
        // When a marker is clicked while detail pane is open, switch to that issue
        (function(markerId) {
          marker.on('click', function() {
            if (mode === 'detail' && markerId) {
              var requests = (communityData && communityData.service_requests) ? communityData.service_requests : [];
              var issue = requests.find(function(r) { return r.id === markerId; });
              if (issue && (!activeIssue || activeIssue.id !== markerId)) {
                if (liveEventSource) { liveEventSource.close(); liveEventSource = null; }
                activeIssue = issue;
                updateLeft();
              }
            }
          });
        })(m.id);
        spAllMarkerEntries.push({ marker: marker, data: m });
        if (m.id) markerById[m.id] = marker;
        bounds.push([m.lat, m.lng]);
      }
    }
    if (pendingZoom) {
      leafletMap.setView(pendingZoom, 17);
      if (pendingPopupId && markerById[pendingPopupId]) {
        setTimeout(function() { markerById[pendingPopupId].openPopup(); pendingPopupId = null; }, 300);
      }
      pendingZoom = null;
    } else if (bounds.length) {
      leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
    setTimeout(function() { if (leafletMap) leafletMap.invalidateSize(); }, 250);
  }

  function renderList() {
    var c = overlay ? overlay.querySelector('#cc-right-body') : null;
    if (!c) return;
    var requests = (communityData && communityData.service_requests) ? communityData.service_requests : [];
    var kwEl = overlay ? overlay.querySelector('#cc-keyword') : null;
    var kw = kwEl ? kwEl.value.toLowerCase() : '';
    var list = requests;
    if (kw) list = list.filter(function(r) { return (r.description || '').toLowerCase().includes(kw) || (r.location ? r.location.address || '' : '').toLowerCase().includes(kw) || (r.category || '').toLowerCase().includes(kw); });
    list.sort(function(a, b) { return new Date(b.submitted_date) - new Date(a.submitted_date); });

    c.style.overflowY = 'auto'; c.classList.add('cc-scroll');
    if (!list.length) {
      c.innerHTML = '<div style="text-align:center;padding:64px 24px;color:#94a3b8;font-size:14px">No issues found.</div>';
      return;
    }

    var html = '';
    for (var li = 0; li < list.length; li++) {
      var r = list[li];
      var ti = null, ci2 = null;
      for (var cc = 0; cc < CATEGORIES.length; cc++) {
        for (var tt = 0; tt < CATEGORIES[cc].types.length; tt++) {
          if (CATEGORIES[cc].types[tt].id === r.category) { ti = CATEGORIES[cc].types[tt]; ci2 = CATEGORIES[cc]; break; }
        }
        if (ti) break;
      }
      var es = effectiveStatus(r);
      var ups = r.updates || [];
      html += '<div class="cc-issue-card" data-id="' + r.id + '" style="padding:14px 16px;display:flex;align-items:flex-start;gap:10px;animation:ccSlide .3s ease-out ' + (li * 0.03) + 's both">'
        + '<div style="width:36px;height:36px;border-radius:10px;background:' + (ci2 ? ci2.color : '#6366f1') + '15;display:flex;align-items:center;justify-content:center;color:' + (ci2 ? ci2.color : '#6366f1') + ';flex-shrink:0;margin-top:2px">' + (ci2 ? ci2.icon() : '') + '</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:14px;font-weight:600;color:#2563eb;margin-bottom:2px">' + esc(ti ? ti.label : (ci2 ? ci2.label : r.category)) + '</div>'
        + '<div style="font-size:12px;color:#374151;margin-bottom:1px">' + esc(r.location ? r.location.address || '' : '') + '</div>'
        + '<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">' + (r.reporter ? esc(r.reporter) + ' &middot; ' : '') + timeAgo(r.submitted_date) + '</div>'
        + '<div style="font-size:12px;color:#475569;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + esc(r.description) + '</div>'
        + '<div style="display:flex;align-items:center;gap:12px;margin-top:6px;font-size:11px;color:#94a3b8"><span style="display:flex;align-items:center;gap:3px">0 ' + I.users + '</span><span style="display:flex;align-items:center;gap:3px">' + ups.length + ' ' + I.comment + '</span></div>'
        + '</div>'
        + '<div style="flex-shrink:0;text-align:right;padding-top:2px">' + statusDots(es) + '</div>'
        + (r.photo ? '<img src="' + r.photo + '" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:10px;flex-shrink:0" />' : '')
        + '</div>';
    }
    c.innerHTML = html;

    var cards = c.querySelectorAll('.cc-issue-card');
    for (var cci = 0; cci < cards.length; cci++) {
      cards[cci].onclick = (function(card) {
        return function() {
          var issue = requests.find(function(r) { return r.id === card.dataset.id; });
          if (issue) { activeIssue = issue; zoomToRequest(issue); mode = 'detail'; updateLeft(); }
        };
      })(cards[cci]);
    }
    if (kwEl) kwEl.oninput = function() { renderList(); };
  }

  /* ── PIN PLACEMENT ── */
  function enablePinMode() {
    if (!leafletMap) return;
    leafletMap.getContainer().style.cursor = 'crosshair';
    leafletMap.on('click', onPinClick);
  }

  function disablePinMode() {
    if (!leafletMap) return;
    leafletMap.getContainer().style.cursor = '';
    leafletMap.off('click', onPinClick);
    if (pinMarker) { leafletMap.removeLayer(pinMarker); pinMarker = null; }
    pinCoords = null;
  }

  function onPinClick(e) {
    var lat = e.latlng.lat;
    var lng = e.latlng.lng;
    pinCoords = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
    if (pinMarker) pinMarker.setLatLng(e.latlng);
    else {
      pinMarker = L.marker(e.latlng, { draggable: true }).addTo(leafletMap);
      pinMarker.on('dragend', function() {
        var pos = pinMarker.getLatLng();
        pinCoords = { lat: +pos.lat.toFixed(6), lng: +pos.lng.toFixed(6) };
      });
    }
    leafletMap.setView(e.latlng, Math.max(leafletMap.getZoom(), 15));
    var addrInput = overlay ? overlay.querySelector('#cc-wiz-addr') : null;
    if (addrInput && !addrInput.value.trim()) {
      wizAddress = pinCoords.lat + ', ' + pinCoords.lng;
      addrInput.value = wizAddress;
    }
    var ps = overlay ? overlay.querySelector('#cc-pin-status') : null;
    if (ps) ps.style.display = 'flex';
  }

  /* ── ADDRESS AUTOCOMPLETE (Nominatim geocoding) ── */
  var _geoTimer = null;
  var _geoAbort = null;

  function geocodeAddress(query, callback) {
    if (_geoAbort) { _geoAbort.abort(); _geoAbort = null; }
    if (!query || query.length < 3) { callback([]); return; }
    _geoAbort = new AbortController();
    var url = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5'
      + '&countrycodes=us&viewbox=-87.92,42.28,-87.82,42.20&bounded=0'
      + '&q=' + encodeURIComponent(query);
    fetch(url, { signal: _geoAbort.signal, headers: { 'Accept': 'application/json' } })
      .then(function(r) { return r.json(); })
      .then(function(results) { callback(results || []); })
      .catch(function() { callback([]); });
  }

  function showGeoSuggestions(results) {
    var box = overlay ? overlay.querySelector('#cc-geo-suggestions') : null;
    if (!box) return;
    if (!results.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'block';
    box.innerHTML = results.map(function(r, i) {
      var name = r.display_name || '';
      if (name.length > 80) name = name.substring(0, 80) + '\u2026';
      return '<div class="cc-geo-item" data-idx="' + i + '" style="padding:10px 14px;cursor:pointer;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;transition:background .15s;display:flex;align-items:center;gap:8px">'
        + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="flex-shrink:0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'
        + '<span>' + esc(name) + '</span></div>';
    }).join('');
    var items = box.querySelectorAll('.cc-geo-item');
    for (var gi = 0; gi < items.length; gi++) {
      items[gi].onmouseenter = function() { this.style.background = '#f0f9ff'; };
      items[gi].onmouseleave = function() { this.style.background = ''; };
      items[gi].onclick = (function(r) {
        return function() { selectGeoResult(r); };
      })(results[gi]);
    }
  }

  function selectGeoResult(r) {
    var lat = parseFloat(r.lat);
    var lng = parseFloat(r.lon);
    if (isNaN(lat) || isNaN(lng)) return;

    // Build a short readable address from address parts
    var addr = r.display_name || '';
    var parts = r.address || {};
    if (parts.house_number && parts.road) {
      addr = parts.house_number + ' ' + parts.road;
      if (parts.city || parts.town || parts.village) addr += ', ' + (parts.city || parts.town || parts.village);
    } else if (parts.road) {
      addr = parts.road;
      if (parts.city || parts.town || parts.village) addr += ', ' + (parts.city || parts.town || parts.village);
    }

    // Update address input
    var addrInput = overlay ? overlay.querySelector('#cc-wiz-addr') : null;
    if (addrInput) addrInput.value = addr;
    wizAddress = addr;

    // Place / move pin marker
    var latlng = L.latLng(lat, lng);
    pinCoords = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
    if (leafletMap) {
      if (pinMarker) pinMarker.setLatLng(latlng);
      else {
        pinMarker = L.marker(latlng, { draggable: true }).addTo(leafletMap);
        pinMarker.on('dragend', function() {
          var pos = pinMarker.getLatLng();
          pinCoords = { lat: +pos.lat.toFixed(6), lng: +pos.lng.toFixed(6) };
        });
      }
      leafletMap.setView(latlng, Math.max(leafletMap.getZoom(), 16));
    }

    // Show pin status
    var ps = overlay ? overlay.querySelector('#cc-pin-status') : null;
    if (ps) ps.style.display = 'flex';

    // Hide suggestions
    var box = overlay ? overlay.querySelector('#cc-geo-suggestions') : null;
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }
  }

  /* ── DATA ── */
  async function loadData() {
    try {
      var results = await Promise.all([
        fetch('/api/community').then(function(r) { return r.json(); }),
        fetch('/api/map-data').then(function(r) { return r.json(); }),
      ]);
      communityData = results[0];
      mapMarkerData = results[1];
    } catch (e) {
      communityData = { service_requests: [], stats: {}, neighborhood_scores: {}, schools: [] };
      mapMarkerData = { markers: [] };
    }
  }

  /* ── PUBLIC API ── */
  window.openServicePortal = async function () {
    await loadData();
    render();
  };
})();
