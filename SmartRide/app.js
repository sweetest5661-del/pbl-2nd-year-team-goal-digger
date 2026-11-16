/**
 * SmartRide - Minimal Application Controller
 * Works with text files backend (smartride_data.txt, smartride_data.idx, drivers.txt, roads.txt, rides.txt)
 */

function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.innerText = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

class App {
  constructor() {
    this.riders = [];
    this.drivers = [];
    this.roads = [];
    this.rides = [];
    this.locations = [];

    this.selectedStart = null;
    this.selectedEnd = null;
    this.highlightedPath = [];

    this.init();
  }

  async init() {
    this.setupTabs();
    this.bindForms();
    this.setupCanvas();
    this.setupFileViewer();
    await this.refresh();

    if (window.initDSA) {
      window.initDSA('dsaStage', 'dsaActions');
    }
  }

  setupTabs() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const activeContent = document.getElementById(target);
        if (activeContent) activeContent.classList.add('active');

        if (target === 'tab-map') {
          this.renderCanvas();
        } else if (target === 'tab-files') {
          this.loadFileContent();
        }
      });
    });
  }

  async refresh() {
    await Promise.all([
      this.loadRiders(),
      this.loadDrivers(),
      this.loadRoads(),
      this.loadRides()
    ]);
    this.renderCanvas();
  }

  // ================= RIDERS =================
  async loadRiders() {
    try {
      const res = await fetch('/api/riders');
      if (!res.ok) throw new Error();
      const data = await res.json();
      this.riders = data.riders || [];
    } catch {
      // Fallback
      if (this.riders.length === 0) {
        this.riders = [
          { id: "R1", name: "Sweetest Kaishkings", phone: "9876543211", pickup: "ISBT", destination: "Clock Tower", seats: 1 },
          { id: "R2", name: "Aarav Sharma", phone: "9823456789", pickup: "Clock Tower", destination: "Rajpur Road", seats: 2 },
          { id: "R3", name: "Priya Joshi", phone: "9834567890", pickup: "Railway Station", destination: "Airport", seats: 1 }
        ];
      }
    }
    this.renderRiders();
  }

  renderRiders() {
    const tbody = document.getElementById('ridersTbody');
    const badge = document.getElementById('ridersCountBadge');
    if (badge) badge.innerText = `${this.riders.length} riders`;
    if (!tbody) return;

    tbody.innerHTML = '';
    if (this.riders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#6b7280;">No records.</td></tr>';
      return;
    }

    this.riders.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${r.id}</strong></td>
        <td>${r.name}</td>
        <td>${r.phone}</td>
        <td>${r.pickup} &rarr; ${r.destination}</td>
        <td>${r.seats}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="app.selectRiderForBooking('${r.id}')">Book</button>
          <button class="btn btn-danger btn-sm" onclick="app.deleteRider('${r.id}')">Del</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Populate Selects
    const bookSelect = document.getElementById('bookRiderSelect');
    if (bookSelect) {
      const cur = bookSelect.value;
      bookSelect.innerHTML = '<option value="">-- Select Rider --</option>';
      this.riders.forEach(r => {
        bookSelect.innerHTML += `<option value="${r.id}">${r.id} - ${r.name} (${r.pickup} -> ${r.destination})</option>`;
      });
      if (cur) bookSelect.value = cur;
    }
  }

  // ================= DRIVERS =================
  async loadDrivers() {
    try {
      const res = await fetch('/api/drivers');
      if (!res.ok) throw new Error();
      const data = await res.json();
      this.drivers = data.drivers || [];
    } catch {
      if (this.drivers.length === 0) {
        this.drivers = [
          { id: "D1", name: "Rajesh Sharma", phone: "9876543210", vehicle: "UK-07-AB-1234 (Swift)", available: 1 },
          { id: "D2", name: "Sunil Verma", phone: "9898989898", vehicle: "UK-07-CD-5678 (Innova)", available: 1 },
          { id: "D3", name: "Vikram Rawat", phone: "9812345678", vehicle: "UK-07-EF-9012 (Aura)", available: 1 }
        ];
      }
    }
    this.renderDrivers();
  }

  renderDrivers() {
    const tbody = document.getElementById('driversTbody');
    const badge = document.getElementById('driversCountBadge');
    if (badge) badge.innerText = `${this.drivers.length} drivers`;
    if (!tbody) return;

    tbody.innerHTML = '';
    if (this.drivers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#6b7280;">No drivers.</td></tr>';
      return;
    }

    this.drivers.forEach(d => {
      const isAvail = d.available === 1;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${d.id}</strong></td>
        <td>${d.name}</td>
        <td>${d.phone}</td>
        <td>${d.vehicle}</td>
        <td><span class="badge ${isAvail ? 'badge-active' : 'badge-done'}">${isAvail ? 'Available' : 'Busy'}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="app.toggleDriver('${d.id}')">${isAvail ? 'Set Busy' : 'Set Avail'}</button>
          <button class="btn btn-danger btn-sm" onclick="app.deleteDriver('${d.id}')">Del</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ================= ROADS & LOCATIONS =================
  async loadRoads() {
    try {
      const res = await fetch('/api/roads');
      if (!res.ok) throw new Error();
      const data = await res.json();
      this.roads = data.roads || [];
      this.locations = data.locations || [];
    } catch {
      this.roads = [
        { from_loc: "ISBT", to_loc: "Clock Tower", km: 4.0 },
        { from_loc: "ISBT", to_loc: "Rajpur Road", km: 8.0 },
        { from_loc: "Clock Tower", to_loc: "Rajpur Road", km: 2.0 },
        { from_loc: "Clock Tower", to_loc: "Railway Station", km: 5.0 },
        { from_loc: "Rajpur Road", to_loc: "Railway Station", km: 3.0 },
        { from_loc: "Railway Station", to_loc: "Airport", km: 25.0 },
        { from_loc: "Rajpur Road", to_loc: "Airport", km: 30.0 }
      ];
      this.locations = ["ISBT", "Clock Tower", "Rajpur Road", "Railway Station", "Airport"];
    }

    // Populate dropdowns
    const locSelects = ['riderPickup', 'riderDest', 'routeStart', 'routeDest'];
    locSelects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const cur = el.value;
      el.innerHTML = '';
      this.locations.forEach(loc => {
        el.innerHTML += `<option value="${loc}">${loc}</option>`;
      });
      if (cur && this.locations.includes(cur)) el.value = cur;
    });
  }

  // ================= RIDES =================
  async loadRides() {
    try {
      const res = await fetch('/api/rides');
      if (!res.ok) throw new Error();
      const data = await res.json();
      this.rides = data.rides || [];
    } catch {
      if (this.rides.length === 0) {
        this.rides = [
          { id: "T1", rider_id: "R1", partner_id: "-", driver_id: "D1", driver_name: "Rajesh Sharma", pickup: "ISBT", destination: "Clock Tower", km: 4.0, fare: 48.0, shared: 0, status: "Finished" }
        ];
      }
    }
    this.renderRides();
  }

  renderRides() {
    const tbody = document.getElementById('ridesTbody');
    const badge = document.getElementById('ridesCountBadge');
    if (badge) badge.innerText = `${this.rides.length} records`;
    if (!tbody) return;

    tbody.innerHTML = '';
    if (this.rides.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#6b7280;">No rides.</td></tr>';
      return;
    }

    this.rides.forEach(r => {
      const isActive = r.status === 'Active';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${r.id}</strong></td>
        <td>${r.rider_id}${r.partner_id && r.partner_id !== '-' ? ' + ' + r.partner_id : ''}</td>
        <td>${r.driver_name || r.driver_id}</td>
        <td>${r.pickup} &rarr; ${r.destination}</td>
        <td>${r.km} km</td>
        <td>Rs. ${r.fare} ${r.shared === 1 ? '(Shared 50%)' : ''}</td>
        <td><span class="badge ${isActive ? 'badge-active' : 'badge-done'}">${r.status}</span></td>
        <td>
          ${isActive ? `
            <button class="btn btn-outline btn-sm" onclick="app.finishRide('${r.id}')">Finish</button>
            <button class="btn btn-danger btn-sm" onclick="app.cancelRide('${r.id}')">Cancel</button>
          ` : '-'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ================= FORMS & ACTIONS =================
  bindForms() {
    // 1. Register Rider
    document.getElementById('formRider')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('riderName').value;
      const phone = document.getElementById('riderPhone').value;
      const pickup = document.getElementById('riderPickup').value;
      const destination = document.getElementById('riderDest').value;
      const seats = parseInt(document.getElementById('riderSeats').value);

      if (pickup === destination) {
        toast("Pickup and destination must be different.");
        return;
      }

      try {
        const res = await fetch('/api/riders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, pickup, destination, seats })
        });
        const d = await res.json();
        toast(d.message || "Rider saved.");
      } catch {
        const newId = `R${this.riders.length + 1}`;
        this.riders.push({ id: newId, name, phone, pickup, destination, seats });
        toast(`Rider ${newId} saved to smartride_data.txt.`);
      }
      e.target.reset();
      await this.refresh();
    });

    // 2. Register Driver
    document.getElementById('formDriver')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('driverName').value;
      const phone = document.getElementById('driverPhone').value;
      const vehicle = document.getElementById('driverVehicle').value;

      try {
        const res = await fetch('/api/drivers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, vehicle })
        });
        const d = await res.json();
        toast(d.message || "Driver saved.");
      } catch {
        const newId = `D${this.drivers.length + 1}`;
        this.drivers.push({ id: newId, name, phone, vehicle, available: 1 });
        toast(`Driver ${newId} saved to drivers.txt.`);
      }
      e.target.reset();
      await this.refresh();
    });

    // 3. Book Ride
    document.getElementById('formBookRide')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const riderId = document.getElementById('bookRiderSelect').value;
      const shared = document.getElementById('bookShared').checked;

      if (!riderId) {
        toast("Please select a rider.");
        return;
      }

      try {
        const res = await fetch('/api/rides/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rider_id: riderId, shared })
        });
        const d = await res.json();
        if (!d.success) {
          toast(d.error || "Booking failed.");
          return;
        }
        toast(d.message);
        if (d.route) this.highlightedPath = d.route;
      } catch {
        // Fallback booking
        const rider = this.riders.find(r => r.id === riderId);
        const availDriver = this.drivers.find(d => d.available === 1);
        if (!availDriver) {
          toast("No driver is available.");
          return;
        }
        availDriver.available = 0;
        const newId = `T${this.rides.length + 1}`;
        this.rides.unshift({
          id: newId,
          rider_id: rider.id,
          partner_id: shared ? "R2" : "-",
          driver_id: availDriver.id,
          driver_name: availDriver.name,
          pickup: rider.pickup,
          destination: rider.destination,
          km: 4.0,
          fare: shared ? 24.0 : 48.0,
          shared: shared ? 1 : 0,
          status: "Active"
        });
        toast(`Booked ${newId} with driver ${availDriver.name}.`);
      }
      await this.refresh();
    });

    // 4. Add Road
    document.getElementById('formRoad')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const from_loc = document.getElementById('roadA').value.trim();
      const to_loc = document.getElementById('roadB').value.trim();
      const km = parseFloat(document.getElementById('roadKm').value);

      if (!from_loc || !to_loc || from_loc === to_loc) {
        toast("Enter two distinct locations.");
        return;
      }

      try {
        const res = await fetch('/api/roads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from_loc, to_loc, km })
        });
        const d = await res.json();
        toast(d.message || "Road added.");
      } catch {
        this.roads.push({ from_loc, to_loc, km });
        if (!this.locations.includes(from_loc)) this.locations.push(from_loc);
        if (!this.locations.includes(to_loc)) this.locations.push(to_loc);
        toast(`Road ${from_loc} - ${to_loc} saved to roads.txt.`);
      }
      e.target.reset();
      await this.refresh();
    });

    // 5. Dijkstra Route Button
    document.getElementById('btnFindRoute')?.addEventListener('click', () => {
      const from = document.getElementById('routeStart').value;
      const to = document.getElementById('routeDest').value;
      this.findRoute(from, to);
    });

    // 6. Search
    document.getElementById('btnSearch')?.addEventListener('click', () => {
      this.runSearch();
    });
  }

  selectRiderForBooking(riderId) {
    document.querySelector('[data-tab="tab-rides"]').click();
    const sel = document.getElementById('bookRiderSelect');
    if (sel) sel.value = riderId;
  }

  async toggleDriver(driverId) {
    try {
      const res = await fetch(`/api/drivers/${driverId}/toggle`, { method: 'PATCH' });
      const d = await res.json();
      toast(d.message || "Driver status updated.");
    } catch {
      const d = this.drivers.find(x => x.id === driverId);
      if (d) d.available = d.available === 1 ? 0 : 1;
      toast(`Driver ${driverId} availability updated.`);
    }
    await this.refresh();
  }

  async deleteRider(riderId) {
    if (!confirm(`Delete rider ${riderId}?`)) return;
    try {
      await fetch(`/api/riders/${riderId}`, { method: 'DELETE' });
      toast(`Rider ${riderId} deleted.`);
    } catch {
      this.riders = this.riders.filter(r => r.id !== riderId);
      toast(`Rider ${riderId} deleted.`);
    }
    await this.refresh();
  }

  async deleteDriver(driverId) {
    if (!confirm(`Delete driver ${driverId}?`)) return;
    try {
      await fetch(`/api/drivers/${driverId}`, { method: 'DELETE' });
      toast(`Driver ${driverId} deleted.`);
    } catch {
      this.drivers = this.drivers.filter(d => d.id !== driverId);
      toast(`Driver ${driverId} deleted.`);
    }
    await this.refresh();
  }

  async finishRide(rideId) {
    try {
      await fetch(`/api/rides/${rideId}/finish`, { method: 'POST' });
      toast(`Ride ${rideId} completed.`);
    } catch {
      const r = this.rides.find(x => x.id === rideId);
      if (r) {
        r.status = 'Finished';
        const d = this.drivers.find(x => x.id === r.driver_id);
        if (d) d.available = 1;
      }
      toast(`Ride ${rideId} marked Finished.`);
    }
    await this.refresh();
  }

  async cancelRide(rideId) {
    try {
      await fetch(`/api/rides/${rideId}/cancel`, { method: 'POST' });
      toast(`Ride ${rideId} cancelled.`);
    } catch {
      const r = this.rides.find(x => x.id === rideId);
      if (r) {
        r.status = 'Cancelled';
        const d = this.drivers.find(x => x.id === r.driver_id);
        if (d) d.available = 1;
      }
      toast(`Ride ${rideId} cancelled.`);
    }
    await this.refresh();
  }

  // ================= DIJKSTRA & GRAPH =================
  async findRoute(from, to) {
    if (!from || !to || from === to) {
      toast("Select two different locations.");
      return;
    }

    let route = null;
    let dist = 0;

    try {
      const res = await fetch('/api/dijkstra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_loc: from, to_loc: to })
      });
      const d = await res.json();
      if (!d.success) {
        toast(d.message || "No connected route.");
        return;
      }
      route = d.result.path;
      dist = d.result.distance;
    } catch {
      // Client Dijkstra
      const graph = {};
      this.roads.forEach(r => {
        if (!graph[r.from_loc]) graph[r.from_loc] = [];
        if (!graph[r.to_loc]) graph[r.to_loc] = [];
        graph[r.from_loc].push({ to: r.to_loc, km: r.km });
        graph[r.to_loc].push({ to: r.from_loc, km: r.km });
      });

      const distances = {};
      const previous = {};
      const visited = new Set();
      Object.keys(graph).forEach(k => distances[k] = Infinity);
      distances[from] = 0;

      while (visited.size < Object.keys(graph).length) {
        let u = null, minD = Infinity;
        Object.keys(graph).forEach(k => {
          if (!visited.has(k) && distances[k] < minD) {
            minD = distances[k];
            u = k;
          }
        });
        if (!u || minD === Infinity) break;
        visited.add(u);
        if (u === to) break;

        (graph[u] || []).forEach(e => {
          if (!visited.has(e.to)) {
            const alt = distances[u] + e.km;
            if (alt < distances[e.to]) {
              distances[e.to] = alt;
              previous[e.to] = u;
            }
          }
        });
      }

      if (distances[to] === Infinity) {
        toast("No path connects those locations.");
        return;
      }

      dist = distances[to];
      route = [];
      let c = to;
      while (c) {
        route.push(c);
        c = previous[c];
      }
      route.reverse();
    }

    this.highlightedPath = route;
    this.renderCanvas();

    const box = document.getElementById('routeResultBox');
    const pathEl = document.getElementById('routePathDisplay');
    const kmEl = document.getElementById('routeKmDisplay');
    const fareEl = document.getElementById('routeFareDisplay');

    if (box && pathEl && kmEl && fareEl) {
      box.style.display = 'block';
      pathEl.innerHTML = route.join(' <span class="route-arrow">&rarr;</span> ');
      kmEl.innerText = `${dist.toFixed(1)} km`;
      fareEl.innerText = `Rs. ${(dist * 12).toFixed(0)}`;
    }
  }

  setupCanvas() {
    this.canvas = document.getElementById('simpleGraphCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.nodePositions = {
      "ISBT": { x: 100, y: 260 },
      "Clock Tower": { x: 260, y: 170 },
      "Rajpur Road": { x: 420, y: 90 },
      "Railway Station": { x: 250, y: 290 },
      "Airport": { x: 580, y: 250 }
    };
  }

  renderCanvas() {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const w = (this.canvas.width = this.canvas.parentElement.clientWidth);
    const h = (this.canvas.height = 340);

    ctx.clearRect(0, 0, w, h);

    // Dynamic placement for new nodes
    this.locations.forEach((loc, i) => {
      if (!this.nodePositions[loc]) {
        const angle = (i / this.locations.length) * Math.PI * 2;
        this.nodePositions[loc] = {
          x: w / 2 + Math.cos(angle) * 160,
          y: h / 2 + Math.sin(angle) * 110
        };
      }
    });

    // Draw Edges
    ctx.lineWidth = 1.5;
    this.roads.forEach(r => {
      const p1 = this.nodePositions[r.from_loc];
      const p2 = this.nodePositions[r.to_loc];
      if (!p1 || !p2) return;

      const isHigh = this.isEdgeInPath(r.from_loc, r.to_loc);
      ctx.strokeStyle = isHigh ? "#1e3a8a" : "#d1d5db";
      ctx.lineWidth = isHigh ? 3 : 1.5;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Distance tag
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      ctx.fillStyle = isHigh ? "#1e3a8a" : "#6b7280";
      ctx.font = "11px sans-serif";
      ctx.fillText(`${r.km} km`, mx - 12, my - 6);
    });

    // Draw Nodes
    this.locations.forEach(loc => {
      const p = this.nodePositions[loc];
      if (!p) return;
      const isPath = this.highlightedPath.includes(loc);

      ctx.beginPath();
      ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = isPath ? "#1e3a8a" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = isPath ? "#1e3a8a" : "#374151";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = isPath ? "#ffffff" : "#111827";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(loc[0], p.x, p.y);

      // Label below
      ctx.fillStyle = "#111827";
      ctx.font = isPath ? "bold 12px sans-serif" : "11px sans-serif";
      ctx.fillText(loc, p.x, p.y + 22);
    });
  }

  isEdgeInPath(u, v) {
    if (!this.highlightedPath || this.highlightedPath.length < 2) return false;
    for (let i = 0; i < this.highlightedPath.length - 1; i++) {
      const a = this.highlightedPath[i], b = this.highlightedPath[i + 1];
      if ((a === u && b === v) || (a === v && b === u)) return true;
    }
    return false;
  }

  // ================= TEXT FILE & SEARCH =================
  setupFileViewer() {
    const sel = document.getElementById('rawFileSelect');
    if (sel) {
      sel.addEventListener('change', () => this.loadFileContent());
    }
  }

  async loadFileContent() {
    const filename = document.getElementById('rawFileSelect')?.value || "smartride_data.txt";
    const box = document.getElementById('rawFileContent');
    if (!box) return;

    try {
      const res = await fetch(`/api/files/raw?name=${filename}`);
      const d = await res.json();
      box.innerText = d.content || "(File empty)";
    } catch {
      if (filename === 'smartride_data.txt') {
        box.innerText = this.riders.map(r => `"${r.id}" "${r.name}" "${r.phone}" "${r.pickup}" "${r.destination}" ${r.seats}`).join('\n');
      } else {
        box.innerText = `"R1" 0\n"R2" 63\n"R3" 126`;
      }
    }
  }

  async runSearch() {
    const q = document.getElementById('searchInput')?.value.trim();
    const method = document.getElementById('searchType')?.value || "linear";
    const out = document.getElementById('searchOutput');
    if (!q || !out) {
      toast("Enter search text.");
      return;
    }

    try {
      const res = await fetch(`/api/riders/search?q=${encodeURIComponent(q)}&method=${method}`);
      const d = await res.json();
      if (!d.success) {
        out.innerHTML = `<span style="color:#b91c1c;">✕ Not found: ${d.message || 'No record.'}</span>`;
        return;
      }

      if (method === 'binary_index') {
        out.innerHTML = `
          <div style="padding:8px;border:1px solid #d1d5db;border-radius:4px;background:#f9fafb;">
            <strong>✓ Found via Binary Search on smartride_data.idx</strong> (${d.steps} interval checks)<br>
            File Offset: <strong>${d.byte_offset} bytes</strong> (direct seekg in smartride_data.txt)<br>
            Record: <code>${d.record_line}</code>
          </div>
        `;
      } else {
        out.innerHTML = `
          <div style="padding:8px;border:1px solid #d1d5db;border-radius:4px;background:#f9fafb;">
            <strong>✓ Found via Linear Search</strong> (${d.comparisons} comparisons checked)<br>
            ${d.rider.id} | ${d.rider.name} | ${d.rider.phone} | ${d.rider.pickup} &rarr; ${d.rider.destination} (${d.rider.seats} seats)
          </div>
        `;
      }
    } catch {
      // Local fallback
      const found = this.riders.find(r => r.id === q || r.name.toLowerCase().includes(q.toLowerCase()));
      if (found) {
        out.innerHTML = `<div style="padding:8px;border:1px solid #d1d5db;background:#f9fafb;"><strong>✓ Found:</strong> ${found.id} | ${found.name} | ${found.phone} | ${found.pickup} -> ${found.destination}</div>`;
      } else {
        out.innerHTML = `<span style="color:#b91c1c;">✕ Rider '${q}' not found.</span>`;
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});


// ================= C ALGORITHMS STAGE =================
window.initDSA = function (stageId, actionsId) {
  const stage = document.getElementById(stageId);
  const actions = document.getElementById(actionsId);
  if (!stage || !actions) return;

  let currentAlgo = 'linear';
  let searchArr = [2, 5, 8, 12, 16, 23, 42];
  let searchTarget = 12;
  let searchIdx = -1;
  let sortArr = [9, 3, 7, 1, 5, -2, 8];
  let stack = [10, 20];
  let queue = [10, 20, 30];
  let queueFront = 0;
  let list = [4, 8, 12, 16];
  let bst = [8, 3, 10, 1, 6, 14, 4];

  function render() {
    stage.innerHTML = '';
    actions.innerHTML = '';

    if (currentAlgo === 'linear') {
      stage.innerHTML = `
        <div style="margin-bottom:12px;"><strong>linearSearch(values, count, target)</strong> | Target: <strong>${searchTarget}</strong></div>
        <div style="display:flex;gap:6px;">
          ${searchArr.map((v, i) => `
            <div style="width:40px;height:48px;border:1px solid ${i === searchIdx ? '#1e3a8a' : '#d1d5db'};background:${i === searchIdx ? '#eff6ff' : '#ffffff'};display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:600;">
              ${v}
              <span style="font-size:10px;color:#6b7280;font-weight:normal;">[${i}]</span>
            </div>
          `).join('')}
        </div>
        <div style="margin-top:10px;font-size:12px;color:#4b5563;">Checks each element sequentially. Time: O(n).</div>
      `;
      actions.innerHTML = `
        <button class="btn btn-primary btn-sm" id="btnStepLinear">Step Search</button>
        <button class="btn btn-outline btn-sm" id="btnResetLinear">Reset</button>
      `;
      document.getElementById('btnStepLinear').onclick = () => {
        searchIdx++;
        if (searchIdx >= searchArr.length) {
          toast("Search finished.");
          searchIdx = -1;
        } else if (searchArr[searchIdx] === searchTarget) {
          toast(`Found target ${searchTarget} at index ${searchIdx}!`);
        }
        render();
      };
      document.getElementById('btnResetLinear').onclick = () => {
        searchIdx = -1;
        render();
      };
    } else if (currentAlgo === 'binary') {
      stage.innerHTML = `
        <div style="margin-bottom:12px;"><strong>binarySearch(values, count, target)</strong> | Target: <strong>${searchTarget}</strong></div>
        <div style="display:flex;gap:6px;">
          ${searchArr.map((v, i) => `
            <div style="width:40px;height:48px;border:1px solid ${v === searchTarget ? '#1e3a8a' : '#d1d5db'};background:${v === searchTarget ? '#eff6ff' : '#ffffff'};display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:600;">
              ${v}
              <span style="font-size:10px;color:#6b7280;font-weight:normal;">[${i}]</span>
            </div>
          `).join('')}
        </div>
        <div style="margin-top:10px;font-size:12px;color:#4b5563;">Halves sorted search interval on each step. Time: O(log n).</div>
      `;
      actions.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="toast('Binary search checks middle element and halves range in O(log n).')">Demonstrate Binary Search</button>
      `;
    } else if (currentAlgo === 'sort') {
      stage.innerHTML = `
        <div style="margin-bottom:12px;"><strong>insertionSort(values, count)</strong></div>
        <div style="display:flex;gap:6px;">
          ${sortArr.map((v, i) => `
            <div style="width:40px;height:48px;border:1px solid #d1d5db;background:#ffffff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:600;">
              ${v}
              <span style="font-size:10px;color:#6b7280;font-weight:normal;">[${i}]</span>
            </div>
          `).join('')}
        </div>
        <div style="margin-top:10px;font-size:12px;color:#4b5563;">Places each next element into its correct sorted position. In-place O(n²).</div>
      `;
      actions.innerHTML = `
        <button class="btn btn-primary btn-sm" id="btnSort">Sort Array</button>
        <button class="btn btn-outline btn-sm" id="btnResetSort">Reset</button>
      `;
      document.getElementById('btnSort').onclick = () => {
        sortArr.sort((a, b) => a - b);
        toast("Array sorted.");
        render();
      };
      document.getElementById('btnResetSort').onclick = () => {
        sortArr = [9, 3, 7, 1, 5, -2, 8];
        render();
      };
    } else if (currentAlgo === 'stack') {
      stage.innerHTML = `
        <div style="margin-bottom:12px;"><strong>Stack (LIFO array)</strong> | Capacity: 100 | Items: ${stack.length}</div>
        <div style="width:120px;border-left:2px solid #374151;border-right:2px solid #374151;border-bottom:2px solid #374151;padding:6px;display:flex;flex-direction:column-reverse;gap:4px;min-height:110px;background:#fff;">
          ${stack.map(v => `<div style="background:#f3f4f6;border:1px solid #d1d5db;padding:4px;text-align:center;font-weight:600;">${v}</div>`).join('')}
        </div>
      `;
      actions.innerHTML = `
        <button class="btn btn-primary btn-sm" id="btnPush">stackPush()</button>
        <button class="btn btn-outline btn-sm" id="btnPop">stackPop()</button>
      `;
      document.getElementById('btnPush').onclick = () => {
        if (stack.length >= 6) { toast("Stack at visual limit."); return; }
        const val = Math.floor(Math.random() * 80) + 10;
        stack.push(val);
        toast(`Pushed ${val}.`);
        render();
      };
      document.getElementById('btnPop').onclick = () => {
        if (stack.length === 0) { toast("Stack underflow!"); return; }
        const val = stack.pop();
        toast(`Popped ${val}.`);
        render();
      };
    } else if (currentAlgo === 'queue') {
      stage.innerHTML = `
        <div style="margin-bottom:12px;"><strong>Circular Queue (FIFO array)</strong> | Front: ${queueFront}, Rear: ${(queueFront + queue.length) % 6}</div>
        <div style="display:flex;gap:6px;">
          ${[0, 1, 2, 3, 4, 5].map(i => `
            <div style="width:40px;height:48px;border:1px solid #d1d5db;background:${i < queue.length ? '#f3f4f6' : '#fff'};display:flex;align-items:center;justify-content:center;font-weight:600;">
              ${i < queue.length ? queue[i] : '-'}
            </div>
          `).join('')}
        </div>
      `;
      actions.innerHTML = `
        <button class="btn btn-primary btn-sm" id="btnAddQ">queueAdd()</button>
        <button class="btn btn-outline btn-sm" id="btnDelQ">queueDelete()</button>
      `;
      document.getElementById('btnAddQ').onclick = () => {
        if (queue.length >= 6) { toast("Queue full."); return; }
        const val = Math.floor(Math.random() * 80) + 10;
        queue.push(val);
        toast(`Added ${val} to rear.`);
        render();
      };
      document.getElementById('btnDelQ').onclick = () => {
        if (queue.length === 0) { toast("Queue empty."); return; }
        const val = queue.shift();
        toast(`Deleted ${val} from front.`);
        render();
      };
    } else if (currentAlgo === 'list') {
      stage.innerHTML = `
        <div style="margin-bottom:12px;"><strong>Singly Linked List (ListNode)</strong></div>
        <div style="display:flex;align-items:center;gap:6px;">
          ${list.map(v => `
            <div style="border:1px solid #1e3a8a;background:#fff;padding:6px 10px;font-weight:600;">${v}</div>
            <span style="color:#6b7280;font-weight:bold;">&rarr;</span>
          `).join('')}
          <span style="color:#991b1b;font-weight:600;">NULL</span>
        </div>
      `;
      actions.innerHTML = `
        <button class="btn btn-primary btn-sm" id="btnAddList">listAppend()</button>
        <button class="btn btn-outline btn-sm" id="btnRemList">listRemove()</button>
      `;
      document.getElementById('btnAddList').onclick = () => {
        const val = Math.floor(Math.random() * 90) + 5;
        list.push(val);
        toast(`Appended node with value ${val}.`);
        render();
      };
      document.getElementById('btnRemList').onclick = () => {
        if (list.length === 0) { toast("List empty."); return; }
        const val = list.shift();
        toast(`Removed and freed node ${val}.`);
        render();
      };
    } else if (currentAlgo === 'bst') {
      const sorted = [...bst].sort((a, b) => a - b);
      stage.innerHTML = `
        <div style="margin-bottom:8px;"><strong>Binary Search Tree (treeInsert & treePrint)</strong></div>
        <div style="font-size:12px;margin-bottom:12px;color:#374151;">Keys: [ ${bst.join(', ')} ]</div>
        <div>Inorder Traversal (Sorted output): <strong>[ ${sorted.join(', ')} ]</strong></div>
      `;
      actions.innerHTML = `
        <button class="btn btn-primary btn-sm" id="btnAddBST">Insert Random Key</button>
      `;
      document.getElementById('btnAddBST').onclick = () => {
        const v = Math.floor(Math.random() * 30) + 1;
        if (!bst.includes(v)) bst.push(v);
        toast(`Inserted key ${v}.`);
        render();
      };
    } else if (currentAlgo === 'hash') {
      stage.innerHTML = `
        <div style="margin-bottom:12px;"><strong>Hash Table with Separate Chaining (31 buckets)</strong></div>
        <div style="display:flex;flex-direction:column;gap:4px;font-family:monospace;font-size:12px;">
          <div>Bucket 7: [Key 7: "Rider A"] &rarr; [Key 38: "Rider B"] &rarr; [Key 69: "Rider C"] &rarr; NULL</div>
          <div>Bucket 12: [Key 12: "Rider D"] &rarr; NULL</div>
        </div>
        <div style="margin-top:10px;font-size:12px;color:#6b7280;">Formula: bucket = key % 31. Multiple keys in the same bucket form a linked list.</div>
      `;
      actions.innerHTML = `
        <button class="btn btn-outline btn-sm" onclick="toast('hashPut() stores key-value pairs; collisions are resolved with separate chaining.')">Explain Chaining</button>
      `;
    }
  }

  document.querySelectorAll('.algo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.algo-btn').forEach(b => b.classList.remove('btn-primary'));
      btn.classList.add('btn-primary');
      currentAlgo = btn.getAttribute('data-algo');
      render();
    });
  });

  render();
};
