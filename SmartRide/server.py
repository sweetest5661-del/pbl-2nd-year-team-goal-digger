"""
SmartRide Backend Server
Matches main.cpp:
- smartride_data.txt (Riders sequential file)
- smartride_data.idx (Primary Index: ID -> byte offset)
Drivers, roads, and rides are managed in memory matching main.cpp.
"""

import http.server
import socketserver
import json
import os
import re
import heapq
import urllib.parse
from typing import Dict, Any, List, Optional

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_TXT = os.path.join(BASE_DIR, "smartride_data.txt")
INDEX_IDX = os.path.join(BASE_DIR, "smartride_data.idx")

# In-memory models matching main.cpp
drivers = [
    {"id": "D1", "name": "Rajesh Sharma", "phone": "9876543210", "vehicle": "UK-07-AB-1234 (Swift)", "available": 1},
    {"id": "D2", "name": "Sunil Verma", "phone": "9898989898", "vehicle": "UK-07-CD-5678 (Innova)", "available": 1},
    {"id": "D3", "name": "Vikram Rawat", "phone": "9812345678", "vehicle": "UK-07-EF-9012 (Aura)", "available": 1},
]

rides = [
    {
        "id": "T1", "rider_id": "R1", "partner_id": "-", "driver_id": "D1", "driver_name": "Rajesh Sharma",
        "pickup": "ISBT", "destination": "Clock Tower", "km": 4.0, "fare": 48.0, "shared": 0, "status": "Finished"
    }
]

roads = [
    {"from_loc": "ISBT", "to_loc": "Clock Tower", "km": 4.0},
    {"from_loc": "ISBT", "to_loc": "Rajpur Road", "km": 8.0},
    {"from_loc": "Clock Tower", "to_loc": "Rajpur Road", "km": 2.0},
    {"from_loc": "Clock Tower", "to_loc": "Railway Station", "km": 5.0},
    {"from_loc": "Rajpur Road", "to_loc": "Railway Station", "km": 3.0},
    {"from_loc": "Railway Station", "to_loc": "Airport", "km": 25.0},
    {"from_loc": "Rajpur Road", "to_loc": "Airport", "km": 30.0},
]

def init_files():
    """Ensures smartride_data.txt and smartride_data.idx exist with initial sample riders."""
    if not os.path.exists(DATA_TXT) or os.path.getsize(DATA_TXT) == 0:
        default_riders = [
            ("R1", "Sweetest Kaishkings", "9876543211", "ISBT", "Clock Tower", 1),
            ("R2", "Aarav Sharma", "9823456789", "Clock Tower", "Rajpur Road", 2),
            ("R3", "Priya Joshi", "9834567890", "Railway Station", "Airport", 1),
        ]
        save_all_riders(default_riders)

def parse_rider_line(line: str) -> Optional[Dict[str, Any]]:
    tokens = re.findall(r'"([^"]*)"|(\S+)', line.strip())
    extracted = [t[0] if t[0] != '' else t[1] for t in tokens]
    if len(extracted) >= 6:
        return {
            "id": extracted[0],
            "name": extracted[1],
            "phone": extracted[2],
            "pickup": extracted[3],
            "destination": extracted[4],
            "seats": int(extracted[5])
        }
    return None

def get_all_riders() -> List[Dict[str, Any]]:
    if not os.path.exists(DATA_TXT):
        return []
    riders = []
    with open(DATA_TXT, "r", encoding="utf-8") as f:
        for line in f:
            parsed = parse_rider_line(line)
            if parsed:
                riders.append(parsed)
    return riders

def save_all_riders(riders_list: List[Any]):
    items = []
    for r in riders_list:
        if isinstance(r, dict):
            items.append((r["id"], r["name"], r["phone"], r["pickup"], r["destination"], int(r["seats"])))
        else:
            items.append(r)

    keys = []
    with open(DATA_TXT, "w", encoding="utf-8") as f_data:
        for rid, name, phone, pickup, dest, seats in items:
            offset = f_data.tell()
            line = f'"{rid}" "{name}" "{phone}" "{pickup}" "{dest}" {seats}\n'
            f_data.write(line)
            keys.append((rid, offset))

    keys.sort(key=lambda x: x[0])
    with open(INDEX_IDX, "w", encoding="utf-8") as f_idx:
        for rid, offset in keys:
            f_idx.write(f'"{rid}" {offset}\n')

def add_rider(name: str, phone: str, pickup: str, dest: str, seats: int) -> str:
    riders = get_all_riders()
    max_num = 0
    for r in riders:
        if r["id"].startswith("R") and r["id"][1:].isdigit():
            max_num = max(max_num, int(r["id"][1:]))
    new_id = f"R{max_num + 1}"
    riders.append({"id": new_id, "name": name, "phone": phone, "pickup": pickup, "destination": dest, "seats": seats})
    save_all_riders(riders)
    return new_id

def delete_rider(rider_id: str) -> bool:
    riders = get_all_riders()
    init_len = len(riders)
    riders = [r for r in riders if r["id"] != rider_id]
    if len(riders) < init_len:
        save_all_riders(riders)
        return True
    return False

def binary_search_index(rider_id: str) -> Dict[str, Any]:
    if not os.path.exists(INDEX_IDX) or not os.path.exists(DATA_TXT):
        return {"found": False, "message": "Index file missing."}

    index_keys = []
    with open(INDEX_IDX, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 2:
                key = parts[0].strip('"')
                off = int(parts[1])
                index_keys.append((key, off))

    low, high = 0, len(index_keys) - 1
    found_offset = None
    steps = 0

    while low <= high:
        steps += 1
        mid = (low + high) // 2
        mid_key = index_keys[mid][0]
        if mid_key == rider_id:
            found_offset = index_keys[mid][1]
            break
        elif mid_key < rider_id:
            low = mid + 1
        else:
            high = mid - 1

    if found_offset is None:
        return {"found": False, "steps": steps, "message": f"Rider '{rider_id}' not found in index."}

    with open(DATA_TXT, "r", encoding="utf-8") as f:
        f.seek(found_offset)
        record_line = f.readline().strip()
        rider_record = parse_rider_line(record_line)

    return {"found": True, "rider": rider_record, "byte_offset": found_offset, "record_line": record_line, "steps": steps}

def linear_search_riders(query: str) -> Dict[str, Any]:
    riders = get_all_riders()
    q = query.lower()
    comparisons = 0
    found = None
    for r in riders:
        comparisons += 1
        if r["id"].lower() == q or q in r["name"].lower() or q in r["phone"]:
            found = r
            break
    return {"found": found is not None, "rider": found, "comparisons": comparisons, "total": len(riders)}

def get_graph() -> Dict[str, List[Dict[str, Any]]]:
    graph = {}
    for r in roads:
        u, v, km = r["from_loc"], r["to_loc"], r["km"]
        if u not in graph: graph[u] = []
        if v not in graph: graph[v] = []
        graph[u].append({"to": v, "km": km})
        graph[v].append({"to": u, "km": km})
    return graph

def dijkstra_path(start: str, end: str) -> Dict[str, Any]:
    graph = get_graph()
    if start not in graph or end not in graph:
        return {"distance": float("inf"), "path": []}

    distances = {node: float("inf") for node in graph}
    distances[start] = 0
    previous = {node: None for node in graph}
    pq = [(0.0, start)]
    visited = set()

    while pq:
        curr_dist, curr_node = heapq.heappop(pq)
        if curr_node in visited:
            continue
        visited.add(curr_node)
        if curr_node == end:
            break

        for neighbor in graph.get(curr_node, []):
            nxt = neighbor["to"]
            weight = neighbor["km"]
            if nxt in visited:
                continue
            new_dist = curr_dist + weight
            if new_dist < distances[nxt]:
                distances[nxt] = new_dist
                previous[nxt] = curr_node
                heapq.heappush(pq, (new_dist, nxt))

    if distances[end] == float("inf"):
        return {"distance": float("inf"), "path": []}

    path = []
    curr = end
    while curr is not None:
        path.append(curr)
        curr = previous[curr]
    path.reverse()
    return {"distance": distances[end], "path": path}

def book_ride(rider_id: str, shared: bool) -> Dict[str, Any]:
    riders = get_all_riders()
    rider = next((r for r in riders if r["id"] == rider_id), None)
    if not rider:
        return {"success": False, "error": f"Rider {rider_id} not found."}

    for r in rides:
        if r["status"] == "Active" and (r["rider_id"] == rider_id or r["partner_id"] == rider_id):
            return {"success": False, "error": "Rider already has an active ride."}

    partner_id = "-"
    if shared:
        matched = None
        for cand in riders:
            if cand["id"] != rider_id and cand["pickup"] == rider["pickup"] and cand["destination"] == rider["destination"]:
                if rider["seats"] + cand["seats"] <= 4:
                    if not any(r["status"] == "Active" and (r["rider_id"] == cand["id"] or r["partner_id"] == cand["id"]) for r in rides):
                        matched = cand
                        break
        if not matched:
            return {"success": False, "error": "No matching partner waiting with same route and total seats <= 4."}
        partner_id = matched["id"]

    avail_driver = next((d for d in drivers if d["available"] == 1), None)
    if not avail_driver:
        return {"success": False, "error": "No driver available."}

    route_info = dijkstra_path(rider["pickup"], rider["destination"])
    if not route_info["path"] or route_info["distance"] == float("inf"):
        return {"success": False, "error": f"No road connection between {rider['pickup']} and {rider['destination']}."}

    km = route_info["distance"]
    fare = km * 12.0

    max_num = 0
    for r in rides:
        if r["id"].startswith("T") and r["id"][1:].isdigit():
            max_num = max(max_num, int(r["id"][1:]))
    ride_id = f"T{max_num + 1}"

    avail_driver["available"] = 0

    new_ride = {
        "id": ride_id, "rider_id": rider_id, "partner_id": partner_id, "driver_id": avail_driver["id"],
        "driver_name": avail_driver["name"], "pickup": rider["pickup"], "destination": rider["destination"],
        "km": km, "fare": fare, "shared": 1 if shared else 0, "status": "Active"
    }
    rides.insert(0, new_ride)

    fare_each = fare / 2.0 if shared else fare
    return {
        "success": True, "ride_id": ride_id, "driver_id": avail_driver["id"], "driver_name": avail_driver["name"],
        "partner_id": partner_id, "km": km, "fare": fare_each, "route": route_info["path"],
        "message": f"Booked {ride_id} with driver {avail_driver['name']}."
    }

def update_ride_status(ride_id: str, new_status: str) -> bool:
    for r in rides:
        if r["id"] == ride_id and r["status"] == "Active":
            r["status"] = new_status
            driver_id = r["driver_id"]
            for d in drivers:
                if d["id"] == driver_id:
                    d["available"] = 1
                    break
            return True
    return False

# ================= HTTP SERVER =================
class SmartRideHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def send_json(self, data: Any, status: int = 200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, message: str, status: int = 400):
        self.send_json({"error": message, "success": False}, status=status)

    def parse_body(self) -> Dict[str, Any]:
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > 0:
                raw = self.rfile.read(length).decode("utf-8")
                return json.loads(raw)
        except Exception:
            pass
        return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path in ("", "/"):
            self.path = "/index.html"
            return super().do_GET()

        if path.startswith("/api/"):
            return self.handle_api_get(path, query)

        return super().do_GET()

    def handle_api_get(self, path: str, query: Dict[str, List[str]]):
        if path == "/api/riders":
            return self.send_json({"success": True, "riders": get_all_riders()})

        if path == "/api/drivers":
            return self.send_json({"success": True, "drivers": drivers})

        if path == "/api/roads":
            graph = get_graph()
            locations = sorted(list(graph.keys()))
            return self.send_json({"success": True, "roads": roads, "locations": locations})

        if path == "/api/rides":
            return self.send_json({"success": True, "rides": rides})

        if path == "/api/riders/search":
            q = query.get("q", [""])[0].strip()
            method = query.get("method", ["linear"])[0]
            if not q:
                return self.send_error_json("Search query required.")
            if method == "binary_index":
                res = binary_search_index(q)
                return self.send_json({"success": res["found"], **res, "method": "binary_index"})
            else:
                res = linear_search_riders(q)
                return self.send_json({"success": res["found"], **res, "method": "linear"})

        if path == "/api/files/raw":
            filename = query.get("name", ["smartride_data.txt"])[0]
            if filename not in ["smartride_data.txt", "smartride_data.idx"]:
                return self.send_error_json("Invalid file.")
            p = os.path.join(BASE_DIR, filename)
            content = open(p, "r", encoding="utf-8").read() if os.path.exists(p) else ""
            return self.send_json({"success": True, "filename": filename, "content": content})

        self.send_error_json("Endpoint not found", 404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.parse_body()

        if path == "/api/riders":
            name = body.get("name", "").strip()
            phone = body.get("phone", "").strip()
            pickup = body.get("pickup", "").strip()
            destination = body.get("destination", "").strip()
            seats = int(body.get("seats", 1))
            if not name or not phone or not pickup or not destination or pickup == destination:
                return self.send_error_json("Invalid rider details.")
            new_id = add_rider(name, phone, pickup, destination, seats)
            return self.send_json({"success": True, "id": new_id, "message": f"Rider {new_id} saved to smartride_data.txt."})

        if path == "/api/drivers":
            name = body.get("name", "").strip()
            phone = body.get("phone", "").strip()
            vehicle = body.get("vehicle", "").strip()
            if not name or not phone or not vehicle:
                return self.send_error_json("All driver fields required.")
            max_num = max([int(d["id"][1:]) for d in drivers if d["id"].startswith("D") and d["id"][1:].isdigit()] or [0])
            new_id = f"D{max_num + 1}"
            drivers.append({"id": new_id, "name": name, "phone": phone, "vehicle": vehicle, "available": 1})
            return self.send_json({"success": True, "id": new_id, "message": f"Driver {new_id} registered."})

        if path == "/api/roads":
            from_loc = body.get("from_loc", "").strip()
            to_loc = body.get("to_loc", "").strip()
            try:
                km = float(body.get("km", 0))
            except Exception:
                return self.send_error_json("Invalid distance.")
            if not from_loc or not to_loc or from_loc == to_loc or km <= 0:
                return self.send_error_json("Invalid road parameters.")
            roads.append({"from_loc": from_loc, "to_loc": to_loc, "km": km})
            return self.send_json({"success": True, "message": f"Road {from_loc} - {to_loc} added."})

        if path == "/api/dijkstra":
            from_loc = body.get("from_loc", "").strip()
            to_loc = body.get("to_loc", "").strip()
            if not from_loc or not to_loc:
                return self.send_error_json("Both locations required.")
            res = dijkstra_path(from_loc, to_loc)
            if not res["path"] or res["distance"] == float("inf"):
                return self.send_json({"success": False, "message": f"No road connection between {from_loc} and {to_loc}."})
            return self.send_json({"success": True, "result": res})

        if path == "/api/rides/book":
            rider_id = body.get("rider_id", "").strip()
            shared = bool(body.get("shared", False))
            res = book_ride(rider_id, shared)
            if not res["success"]:
                return self.send_error_json(res["error"])
            return self.send_json(res)

        if path.startswith("/api/rides/") and path.endswith("/finish"):
            ride_id = path.split("/")[3]
            if update_ride_status(ride_id, "Finished"):
                return self.send_json({"success": True, "message": f"Ride {ride_id} finished."})
            return self.send_error_json("Ride not found or closed.")

        if path.startswith("/api/rides/") and path.endswith("/cancel"):
            ride_id = path.split("/")[3]
            if update_ride_status(ride_id, "Cancelled"):
                return self.send_json({"success": True, "message": f"Ride {ride_id} cancelled."})
            return self.send_error_json("Ride not found or closed.")

        self.send_error_json("Endpoint not found", 404)

    def do_PATCH(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/drivers/") and path.endswith("/toggle"):
            driver_id = path.split("/")[3]
            for d in drivers:
                if d["id"] == driver_id:
                    d["available"] = 0 if d["available"] == 1 else 1
                    return self.send_json({"success": True, "available": d["available"], "message": f"Driver {driver_id} is {'Available' if d['available'] == 1 else 'Busy'}."})
            return self.send_error_json("Driver not found.")
        self.send_error_json("Endpoint not found", 404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/riders/"):
            rider_id = path.split("/")[3]
            if delete_rider(rider_id):
                return self.send_json({"success": True, "message": f"Rider {rider_id} deleted."})
            return self.send_error_json("Rider not found.")

        if path.startswith("/api/drivers/"):
            driver_id = path.split("/")[3]
            global drivers
            init_len = len(drivers)
            drivers = [d for d in drivers if d["id"] != driver_id]
            if len(drivers) < init_len:
                return self.send_json({"success": True, "message": f"Driver {driver_id} deleted."})
            return self.send_error_json("Driver not found.")

        self.send_error_json("Endpoint not found", 404)

def run():
    init_files()
    with socketserver.TCPServer(("", PORT), SmartRideHandler) as httpd:
        print(f"SmartRide Server running at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    run()
