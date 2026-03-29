/**
 * Shared data layer for CivicLens — used by both the main server and the MCP server.
 * Eliminates duplication of tool definitions, data loading, and persistence logic.
 */

import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { calculatePriorityScore, forecastDeterioration, costOfInaction } from '../scoring/weibull.js';
import { initCosmos, seedContainer, upsertRecord, writeAuditEntry, isCosmosConnected, getCosmosStatus } from './cosmos-layer.js';

export { calculatePriorityScore, forecastDeterioration, costOfInaction };

/**
 * Create a data layer instance with paths bound to the caller's context.
 * @param {{ dataDir: string, publicDir: string }} config
 */
export function createDataLayer({ dataDir, publicDir }) {
  const AUDIT_LOG_PATH = join(dataDir, 'audit-log.jsonl');

  let workOrders, potholes, sidewalkIssues, schools, serviceRequests;

  // ─── Audit Logging (Responsible AI) ─────────────────────────────
  async function auditLog(action, params, result) {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      params,
      success: result.success ?? true,
      message: result.message || null,
    };
    try { await appendFile(AUDIT_LOG_PATH, JSON.stringify(entry) + '\n'); } catch { /* non-blocking */ }
    writeAuditEntry(entry); // non-blocking Cosmos sync
  }

  // ─── Data Loading & Persistence ─────────────────────────────────
  async function loadJSON(filename) {
    const raw = await readFile(join(dataDir, filename), 'utf-8');
    return JSON.parse(raw);
  }

  async function persistWorkOrders() {
    await writeFile(join(dataDir, 'work-orders.json'), JSON.stringify(workOrders, null, 2));
  }

  async function persistServiceRequests() {
    await writeFile(join(dataDir, 'service-requests.json'), JSON.stringify(serviceRequests, null, 2));
  }

  async function initData() {
    workOrders      = await loadJSON('work-orders.json');
    potholes        = await loadJSON('potholes.json');
    sidewalkIssues  = await loadJSON('sidewalk-issues.json');
    schools         = await loadJSON('schools.json');
    serviceRequests = await loadJSON('service-requests.json');

    // Optional Cosmos DB sync — seeds containers from JSON on first connect
    const cosmosOk = await initCosmos();
    if (cosmosOk) {
      await Promise.all([
        seedContainer('workOrders', workOrders),
        seedContainer('potholes', potholes),
        seedContainer('sidewalkIssues', sidewalkIssues),
        seedContainer('schools', schools),
        seedContainer('serviceRequests', serviceRequests),
      ]);
    }
  }

  function getData() {
    return { workOrders, potholes, sidewalkIssues, schools, serviceRequests };
  }

  // ─── Tool Registry (15 MCP tools) ──────────────────────────────
  const TOOLS = {
    get_work_orders: {
      description: 'Retrieve work orders, optionally filtered by id, status, type, zone, or priority.',
      inputSchema: { type: 'object', properties: {
        id:       { type: 'string', description: 'Specific work order ID, e.g. WO-2024-003' },
        status:   { type: 'string', enum: ['open', 'in_progress', 'completed'] },
        type:     { type: 'string', enum: ['pothole_repair', 'sidewalk_replacement', 'concrete_repair'] },
        zone:     { type: 'string', enum: ['NW-3', 'NE-1', 'SE-2', 'SW-1'] },
        priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
      }},
      handler(params) {
        let r = [...workOrders];
        if (params.id)       r = r.filter(w => w.id === params.id);
        if (params.status)   r = r.filter(w => w.status === params.status);
        if (params.type)     r = r.filter(w => w.type === params.type);
        if (params.zone)     r = r.filter(w => w.location.zone === params.zone);
        if (params.priority) r = r.filter(w => w.priority === params.priority);
        return r;
      },
    },

    get_potholes: {
      description: 'Retrieve pothole reports, optionally filtered by zone, severity threshold, or school proximity.',
      inputSchema: { type: 'object', properties: {
        zone:             { type: 'string', enum: ['NW-3', 'NE-1', 'SE-2', 'SW-1'] },
        min_severity:     { type: 'number', minimum: 1, maximum: 10 },
        near_school_only: { type: 'boolean' },
      }},
      handler(params) {
        let r = [...potholes];
        if (params.zone)             r = r.filter(p => p.location.zone === params.zone);
        if (params.min_severity)     r = r.filter(p => p.severity >= params.min_severity);
        if (params.near_school_only) r = r.filter(p => p.near_school);
        return r;
      },
    },

    get_sidewalk_issues: {
      description: 'Retrieve sidewalk issues, optionally filtered by zone, severity, or ADA compliance status.',
      inputSchema: { type: 'object', properties: {
        zone:              { type: 'string', enum: ['NW-3', 'NE-1', 'SE-2', 'SW-1'] },
        min_severity:      { type: 'number', minimum: 1, maximum: 10 },
        ada_non_compliant: { type: 'boolean' },
      }},
      handler(params) {
        let r = [...sidewalkIssues];
        if (params.zone)              r = r.filter(s => s.location.zone === params.zone);
        if (params.min_severity)      r = r.filter(s => s.severity >= params.min_severity);
        if (params.ada_non_compliant) r = r.filter(s => !s.ada_compliant);
        return r;
      },
    },

    get_schools: {
      description: 'Retrieve schools data with enrollment, location, and walk zone info.',
      inputSchema: { type: 'object', properties: {
        type: { type: 'string', enum: ['elementary', 'middle', 'high'] },
        zone: { type: 'string', enum: ['NW-3', 'NE-1', 'SE-2', 'SW-1'] },
      }},
      handler(params) {
        let r = [...schools];
        if (params.type) r = r.filter(s => s.type === params.type);
        if (params.zone) r = r.filter(s => s.location.zone === params.zone);
        return r;
      },
    },

    calculate_priority_score: {
      description: 'Calculate Weibull decay priority score for an infrastructure issue. Returns score (0-400), breakdown, and risk level.',
      inputSchema: { type: 'object', properties: {
        severity:           { type: 'number', minimum: 1, maximum: 10 },
        type:               { type: 'string', enum: ['pothole', 'sidewalk', 'concrete'] },
        reported_date:      { type: 'string', description: 'ISO date string' },
        school_distance_ft: { type: 'number' },
        near_school:        { type: 'boolean' },
        traffic_volume:     { type: 'string', enum: ['high', 'medium', 'low'] },
      }, required: ['severity', 'type', 'reported_date'] },
      handler(params) { return calculatePriorityScore(params); },
    },

    dispatch_crew: {
      description: 'Dispatch a maintenance crew to a work order. Assigns a crew and updates the work order status to in_progress.',
      inputSchema: { type: 'object', properties: {
        work_order_id:  { type: 'string', description: 'The work order ID to dispatch to' },
        crew_id:        { type: 'string', description: 'Crew identifier (e.g., Crew-A, Crew-B, Crew-C)' },
        scheduled_date: { type: 'string', description: 'ISO date for scheduled work' },
      }, required: ['work_order_id', 'crew_id'] },
      handler(params) {
        const wo = workOrders.find(w => w.id === params.work_order_id);
        if (!wo) return { success: false, error: `Work order ${params.work_order_id} not found` };
        if (wo.status === 'completed') return { success: false, error: `Work order ${wo.id} is already completed` };
        wo.status = 'in_progress';
        wo.crew_assigned = params.crew_id;
        wo.scheduled_date = params.scheduled_date || new Date().toISOString().split('T')[0];
        persistWorkOrders().catch(() => {});
        upsertRecord('workOrders', wo);
        auditLog('dispatch_crew', params, { success: true, message: `Crew ${params.crew_id} dispatched to ${wo.location.address}` });
        return { success: true, message: `Crew ${params.crew_id} dispatched to ${wo.location.address}`, work_order: wo, requires_confirmation: true };
      },
    },

    update_work_order_status: {
      description: 'Update the status of a work order (e.g., mark as completed).',
      inputSchema: { type: 'object', properties: {
        work_order_id: { type: 'string' },
        status:        { type: 'string', enum: ['open', 'in_progress', 'completed'] },
        notes:         { type: 'string', description: 'Additional notes about the status change' },
      }, required: ['work_order_id', 'status'] },
      handler(params) {
        const wo = workOrders.find(w => w.id === params.work_order_id);
        if (!wo) return { success: false, error: `Work order ${params.work_order_id} not found` };
        const prev = wo.status;
        wo.status = params.status;
        if (params.notes) wo.notes = (wo.notes || '') + ' | ' + params.notes;
        if (params.status === 'completed') wo.completed_date = new Date().toISOString().split('T')[0];
        persistWorkOrders().catch(() => {});
        upsertRecord('workOrders', wo);
        auditLog('update_work_order_status', params, { success: true, message: `Status changed from ${prev} to ${params.status}` });
        return { success: true, message: `Work order ${wo.id} status: ${prev} → ${params.status}`, work_order: wo };
      },
    },

    get_service_requests: {
      description: 'Retrieve resident service requests, optionally filtered by status, zone, category, or tracking number.',
      inputSchema: { type: 'object', properties: {
        status:          { type: 'string', enum: ['open', 'in_progress', 'completed'] },
        zone:            { type: 'string', enum: ['NW-3', 'NE-1', 'SE-2', 'SW-1'] },
        category:        { type: 'string', enum: ['pothole', 'sidewalk', 'streetlight', 'drainage', 'tree_damage', 'sign_damage', 'crosswalk', 'other'] },
        tracking_number: { type: 'string', description: 'Lookup by SR tracking number (e.g. SR-2026-001)' },
      }},
      handler(params) {
        let r = [...serviceRequests];
        if (params.tracking_number) return r.filter(s => s.id === params.tracking_number);
        if (params.status)   r = r.filter(s => s.status === params.status);
        if (params.zone)     r = r.filter(s => s.location.zone === params.zone);
        if (params.category) r = r.filter(s => s.category === params.category);
        return r;
      },
    },

    submit_service_request: {
      description: 'Submit a new resident service request. Returns a tracking number.',
      inputSchema: { type: 'object', properties: {
        resident_name:  { type: 'string' },
        contact_phone:  { type: 'string' },
        contact_email:  { type: 'string', description: 'Email for status notifications (optional)' },
        notify_by_email: { type: 'boolean', description: 'Whether to send email updates' },
        category:       { type: 'string', enum: ['pothole', 'sidewalk', 'streetlight', 'drainage', 'tree_damage', 'sign_damage', 'crosswalk', 'other'] },
        description:    { type: 'string' },
        address:        { type: 'string' },
        zone:           { type: 'string', enum: ['NW-3', 'NE-1', 'SE-2', 'SW-1'] },
        photo:          { type: 'string', description: 'Base64 data URI of a photo (optional)' },
        lat:            { type: 'number' },
        lng:            { type: 'number' },
      }, required: ['category', 'description', 'address'] },
      async handler(params) {
        const id = `SR-2026-${String(serviceRequests.length + 1).padStart(3, '0')}`;

        let photoUrl = null;
        if (params.photo && typeof params.photo === 'string' && params.photo.startsWith('data:image/')) {
          try {
            const match = params.photo.match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i);
            if (match) {
              const ext = match[1].replace('jpeg', 'jpg');
              const photoName = `${id.replace(/\s+/g, '_')}_${randomUUID().slice(0, 8)}.${ext}`;
              const uploadsDir = join(publicDir, 'uploads');
              await mkdir(uploadsDir, { recursive: true });
              await writeFile(join(uploadsDir, photoName), Buffer.from(match[2], 'base64'));
              photoUrl = `/uploads/${photoName}`;
            }
          } catch { /* photo save failed — continue without it */ }
        }

        const sr = {
          id,
          resident_name: params.resident_name || 'Anonymous',
          contact_phone: params.contact_phone || null,
          contact_email: params.contact_email || null,
          notify_by_email: !!params.notify_by_email,
          category: params.category,
          description: params.description,
          location: {
            address: params.address,
            zone: params.zone || 'NE-1',
            lat: params.lat || (42.2586 + (Math.random() - 0.5) * 0.02),
            lng: params.lng || (-87.8407 + (Math.random() - 0.5) * 0.02),
          },
          photo: photoUrl,
          status: 'open',
          priority: 'medium',
          submitted_date: new Date().toISOString().split('T')[0],
          updated_date: new Date().toISOString().split('T')[0],
          resolution_eta: null,
          assigned_crew: null,
          updates: [{ date: new Date().toISOString().split('T')[0], note: 'Request received and logged.', by: 'system' }],
        };
        serviceRequests.push(sr);
        persistServiceRequests().catch(() => {});
        upsertRecord('serviceRequests', sr);
        auditLog('submit_service_request', { id, category: params.category, address: params.address }, { success: true });
        return { success: true, tracking_number: id, message: `Your request has been submitted! Track it with number ${id}.`, request: sr, requires_confirmation: true };
      },
    },

    get_request_status: {
      description: 'Get detailed status and update history for a service request by tracking number.',
      inputSchema: { type: 'object', properties: {
        tracking_number: { type: 'string', description: 'e.g. SR-2026-001' },
      }, required: ['tracking_number'] },
      handler(params) {
        const sr = serviceRequests.find(s => s.id === params.tracking_number);
        if (!sr) return { found: false, message: `No request found with tracking number ${params.tracking_number}` };
        // Strip sensitive contact info from public response
        const { contact_email, notify_by_email, ...publicRequest } = sr;
        return { found: true, request: publicRequest };
      },
    },

    schedule_inspection: {
      description: 'Schedule an inspection for an infrastructure issue. Creates a new work order for the inspection.',
      inputSchema: { type: 'object', properties: {
        issue_type:     { type: 'string', enum: ['pothole', 'sidewalk', 'concrete'] },
        location:       { type: 'string', description: 'Address for inspection' },
        zone:           { type: 'string', enum: ['NW-3', 'NE-1', 'SE-2', 'SW-1'] },
        scheduled_date: { type: 'string', description: 'ISO date for inspection' },
        reason:         { type: 'string', description: 'Why the inspection is needed' },
      }, required: ['issue_type', 'location', 'zone'] },
      handler(params) {
        const typeMap = { pothole: 'pothole_repair', sidewalk: 'sidewalk_replacement', concrete: 'concrete_repair' };
        const newWO = {
          id: `WO-INS-${randomUUID().slice(0, 8)}`,
          type: typeMap[params.issue_type] || params.issue_type,
          status: 'open',
          priority: 'medium',
          description: `Inspection: ${params.reason || 'Scheduled inspection'}`,
          location: { address: params.location, lat: null, lng: null, zone: params.zone },
          reported_date: new Date().toISOString().split('T')[0],
          scheduled_date: params.scheduled_date || null,
          completed_date: null,
          estimated_cost: null,
          crew_assigned: null,
          notes: `Auto-generated inspection work order. Reason: ${params.reason || 'standard inspection'}`,
        };
        workOrders.push(newWO);
        persistWorkOrders().catch(() => {});
        upsertRecord('workOrders', newWO);
        auditLog('schedule_inspection', params, { success: true, message: `Inspection scheduled at ${params.location}` });
        return { success: true, message: `Inspection scheduled at ${params.location}`, work_order: newWO, requires_confirmation: true };
      },
    },

    forecast_deterioration: {
      description: 'Predict future infrastructure deterioration using Weibull survival analysis. Returns severity forecasts at 30/90/180 days.',
      inputSchema: { type: 'object', properties: {
        issue_type:       { type: 'string', enum: ['pothole', 'sidewalk', 'concrete'] },
        current_severity: { type: 'number', minimum: 1, maximum: 10 },
        reported_date:    { type: 'string' },
        traffic_volume:   { type: 'string', enum: ['high', 'medium', 'low'] },
      }, required: ['issue_type', 'current_severity', 'reported_date'] },
      handler(params) { return forecastDeterioration(params); },
    },

    cost_of_inaction: {
      description: 'Calculate the financial and liability cost of leaving an infrastructure issue unrepaired.',
      inputSchema: { type: 'object', properties: {
        issue_type:       { type: 'string', enum: ['pothole', 'sidewalk', 'concrete'] },
        current_severity: { type: 'number' },
        reported_date:    { type: 'string' },
        near_school:      { type: 'boolean' },
        traffic_volume:   { type: 'string', enum: ['high', 'medium', 'low'] },
      }, required: ['issue_type', 'current_severity'] },
      handler(params) { return costOfInaction(params); },
    },

    whatif_budget: {
      description: 'Model the impact of budget changes on infrastructure outcomes. Answers "What if we cut budget by X%?"',
      inputSchema: { type: 'object', properties: {
        budget_change_percent: { type: 'number', description: 'Positive = increase, negative = cut. Range: -100 to 100.' },
        zone: { type: 'string', enum: ['NW-3', 'NE-1', 'SE-2', 'SW-1'] },
      }, required: ['budget_change_percent'] },
      handler(params) {
        const pct = Math.max(-100, Math.min(100, params.budget_change_percent));
        const zone = params.zone;

        let wo = [...workOrders];
        let ph = [...potholes];
        let sw = [...sidewalkIssues];
        if (zone) {
          wo = wo.filter(w => w.location?.zone === zone);
          ph = ph.filter(p => p.location?.zone === zone);
          sw = sw.filter(s => s.location?.zone === zone);
        }

        const openWO = wo.filter(w => w.status !== 'completed');
        const totalBudget = wo.reduce((s, w) => s + (w.estimated_cost || 0), 0);
        const adjustedBudget = Math.round(totalBudget * (1 + pct / 100));

        const scored = openWO.map(w => {
          const score = calculatePriorityScore({
            severity: 5, type: w.type?.replace('_repair', '').replace('_replacement', '') || 'pothole',
            reported_date: w.reported_date, school_distance_ft: 1000, near_school: false, traffic_volume: 'medium',
          });
          return { ...w, priority_score: score.score };
        }).sort((a, b) => b.priority_score - a.priority_score);

        let spent = 0;
        let addressable = 0;
        const deferred = [];
        for (const w of scored) {
          if (spent + (w.estimated_cost || 0) <= adjustedBudget) {
            spent += (w.estimated_cost || 0);
            addressable++;
          } else {
            deferred.push({ id: w.id, type: w.type, priority_score: w.priority_score, cost: w.estimated_cost });
          }
        }

        const criticalDeferred = deferred.filter(d => d.priority_score >= 150).length;
        const highDeferred = deferred.filter(d => d.priority_score >= 100 && d.priority_score < 150).length;

        return {
          budget_change: `${pct >= 0 ? '+' : ''}${pct}%`,
          zone: zone || 'all',
          original_budget: totalBudget,
          adjusted_budget: adjustedBudget,
          open_issues: openWO.length,
          addressable_issues: addressable,
          deferred_issues: deferred.length,
          deferred_critical: criticalDeferred,
          deferred_high: highDeferred,
          risk_increase: criticalDeferred > 0 ? 'SEVERE — critical issues will be unaddressed' :
            highDeferred > 0 ? 'ELEVATED — high-priority issues delayed' : 'MANAGEABLE',
          deferred_details: deferred.slice(0, 5),
          liability_exposure_increase: Math.round(deferred.reduce((s, d) => s + (d.cost || 500) * 0.3, 0)),
        };
      },
    },

    get_chicago_311_benchmarks: {
      description: 'Get Chicago 311 open data benchmarks for cross-city comparison. Shows how Lake Forest compares to a major city on resolution times and volume.',
      inputSchema: { type: 'object', properties: {
        type_filter: { type: 'string', description: 'Filter by request type (e.g. "pothole", "sidewalk")' },
      }},
      handler(params) {
        const chicago = JSON.parse(readFileSync(join(dataDir, 'chicago-311.json'), 'utf-8'));
        let records = chicago.records;
        if (params?.type_filter) {
          const f = params.type_filter.toLowerCase();
          records = records.filter(r => r.sr_type.toLowerCase().includes(f));
        }
        const completed = records.filter(r => r.status === 'completed');
        const avgDays = completed.length > 0 ? +(completed.reduce((s, r) => s + (r.resolution_days || 0), 0) / completed.length).toFixed(1) : null;
        return {
          source: 'Chicago 311 Open Data Portal (data.cityofchicago.org)',
          total_sample_records: records.length,
          completed: completed.length,
          open: records.filter(r => r.status === 'open').length,
          avg_resolution_days: avgDays,
          completion_rate: records.length > 0 ? +(completed.length / records.length).toFixed(2) : 0,
          records: records.slice(0, 5),
          comparison_note: 'Use alongside Lake Forest data to benchmark municipal performance',
        };
      },
    },

    get_data_provenance: {
      description: 'Get data provenance metadata documenting real-world sources, calibration methods, and validation benchmarks for each CivicLens dataset.',
      inputSchema: { type: 'object', properties: {
        dataset: { type: 'string', description: 'Optional: specific dataset name (e.g. "potholes.json"). Omit for all datasets.' },
      }},
      handler(params) {
        const provenance = JSON.parse(readFileSync(join(dataDir, 'data-provenance.json'), 'utf-8'));
        if (params?.dataset) {
          const key = params.dataset.endsWith('.json') ? params.dataset : `${params.dataset}.json`;
          const entry = provenance.datasets[key];
          if (!entry) return { error: `Unknown dataset: ${params.dataset}`, available: Object.keys(provenance.datasets) };
          return { dataset: key, ...entry, methodology: provenance.methodology };
        }
        return provenance;
      },
    },
  };

  async function callToolDirect(name, args = {}) {
    if (!TOOLS[name]) throw new Error(`Unknown tool: ${name}`);
    return TOOLS[name].handler(args);
  }

  return {
    auditLog,
    initData,
    getData,
    TOOLS,
    callToolDirect,
    persistWorkOrders,
    persistServiceRequests,
    AUDIT_LOG_PATH,
    getCosmosStatus,
  };
}
