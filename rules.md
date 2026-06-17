House Layout Rules — Indian Residential Ground Floor
These are hard rules. The AI must validate every generated layout against all of them before returning output. If any rule is violated, the layout must be corrected, not just noted.

Section 1 — Entry & Main Door

Main entrance must always be on the road-facing side of the plot. If road side is not specified, default entrance to the longer front edge.
Main door must open inward into the house, never directly into a bedroom or kitchen — it must open into a living room, hall, or foyer.
There must be at least 2-3 ft of clear space (foyer/buffer) between the main door and any bedroom door.
Main entrance should not be in a corner of the plot — it must be placed roughly in the center third of the road-facing wall.
If Vastu is enabled: main entrance preferred on North, East, or North-East wall. If the road side conflicts with this, road side takes priority, and the conflict must be mentioned in the explanation.


Section 2 — Every Room Must Have a Door

Every single room — bedroom, kitchen, bathroom, pooja room, storeroom, parking — must have at least one door drawn in the layout.
No room is allowed to be a sealed rectangle with no door gap.
Bathroom/toilet doors must never open directly into a kitchen or dining area — they must open into a bedroom, corridor, or a private hall.
Bathroom doors should ideally not be visible from the main entrance/living room. If the plot is too small to avoid this, place the door on a side wall of the bathroom facing away from the main living area.
Bedroom doors should open inward into the bedroom, not swing into a corridor in a way that blocks passage.
Kitchen door must not be the first thing visible from the main entrance.


Section 3 — Room Adjacency Rules

Kitchen and dining must be adjacent (sharing a wall or directly connected). They can be a single combined open space or two connected rooms.
Living room must be directly accessible from the main entrance without passing through any other room.
No bedroom should be accessible only by passing through another bedroom.
Master bedroom should be the most private room — not adjacent to the main entrance, not directly visible from the living room entrance.
Bathroom/toilet must be adjacent to (or inside) at least one bedroom. A standalone bathroom that is not accessible from any bedroom without crossing a public space is not allowed.
Kitchen must have direct or very close access to the service/back area of the plot if there is a rear or side open space — avoid placing kitchen deep inside with no ventilation or back access.
If parking is included, it must be directly accessible from the road-facing side — no parking space that requires walking through a room or corridor to reach.


Section 4 — Light & Ventilation (Basic Rules)

Every bedroom must have at least one external wall (touching the plot boundary or an open courtyard). No bedroom can be completely surrounded by other rooms with no window wall.
Kitchen must have at least one external wall for ventilation — kitchen completely enclosed by other rooms on all sides is not allowed.
Bathroom can be internal (no external wall) only if the plot is under 600 sqft and there is genuinely no other option. In all other cases, give bathrooms at least one external wall or an internal shaft/vent wall.
Living room must have at least one wall with windows facing outside (road-facing or side open).


Section 5 — Staircase Rules (Even for Ground Floor Planning)

Staircase must be placed against a wall — never floating in the center of a room or plot.
Staircase must be directly accessible from the living room or a common corridor — no staircase that can only be reached through a bedroom or kitchen.
Staircase should not be placed directly opposite the main entrance door (Vastu and general planning — it creates a bad visual axis and unsafe rush).
Staircase landing space at ground level must be at least 3.5 ft wide for comfortable turning.
Preferred placement: South or West side of the plot. Avoid North-East (Vastu) and avoid the exact center of the house (structural and circulation reasons).


Section 6 — Parking Rules

If parking is included, it must sit entirely within the plot boundary — no part of the parking area can extend beyond the plot edge.
Parking must front the road-facing side — the car must be able to enter from the road directly.
Parking area must be a minimum of 10 ft wide and 18 ft deep for a single car (Indian standard).
If parking + garden both are requested and the frontage is less than 25 ft, place parking on one side of the front and garden/green strip on the other side — do not overlap them.
Parking should not be placed such that a car would block the main entrance door when parked.


Section 7 — Kitchen Placement Rules

Kitchen must never be placed in the North-East corner (Vastu, regardless of whether Vastu is enabled — this is widely expected).
Kitchen must not face the main entrance — a person entering the house should not be looking directly into the kitchen.
If Vastu is enabled: kitchen preferred in South-East. If South-East is not available due to plot shape, South or West is acceptable. North-East is never acceptable.
Kitchen should be near a rear or side door/access if plot permits — so groceries and waste can be handled without going through the living room.


Section 8 — Bathroom/Toilet Placement Rules

Bathroom must never be placed in the North-East corner of the plot or the house (both Vastu and common Indian planning convention).
Bathroom/toilet must not share a wall with the pooja room. If they are the only rooms left to place and no other option exists, place a corridor or storage wall between them.
No bathroom door should directly face a bedroom door across a corridor (preferred — if unavoidable on small plots, mention it in the explanation).
On small plots (under 800 sqft), a single common bathroom accessible from a corridor is acceptable. On larger plots, at least one attached bathroom inside the master bedroom is expected.


Section 9 — Pooja Room Rules (If Vastu Enabled or Room Requested)

Pooja room must be in the North-East corner of the house.
Pooja room must not share a wall with a bathroom or toilet — at minimum, a corridor or another room must separate them.
Pooja room door should open facing East or North.
Pooja room should be accessible from the living room or a corridor — not hidden behind a bedroom.


Section 10 — Proportionality & Space Rules

No single room (other than a combined living/dining) should occupy more than 35% of the total usable area.
No room should be dimensioned with a length-to-width ratio worse than 3:1 (e.g., a room 18 ft long and only 5 ft wide is not acceptable — that's a corridor, not a room).
Minimum room dimensions that must be respected regardless of plot size:

Bedroom: minimum 9 ft x 10 ft
Master bedroom: minimum 11 ft x 12 ft
Kitchen: minimum 7 ft x 9 ft
Bathroom: minimum 4 ft x 6 ft
Living room: minimum 10 ft x 12 ft
Staircase: minimum 3.5 ft x 8 ft


If a plot is too small to fit all requested rooms above minimum size, the AI must reduce room count (remove the least essential room first — storeroom, extra bathroom, pooja room in that order) and explain what was removed and why.


Section 11 — Corridor & Circulation Rules

If the total plot area is above 900 sqft, there must be at least one corridor or internal passage connecting the bedrooms to the living area — bedrooms should not open directly into the living room without any separation.
Corridor minimum width: 3.5 ft. A corridor narrower than this is not a corridor, it is a gap — do not label it or rely on it for circulation.
On plots under 900 sqft, direct room-to-room access without a formal corridor is acceptable, but the adjacency rules in Section 3 still apply.


How the AI Should Use These Rules

After generating the layout JSON, run through every rule in every section above.
For each rule violated, adjust the layout to fix it — reposition the offending room, resize it, or move the door.
If a rule cannot be satisfied due to the plot being genuinely too small, note it clearly in the explanation field — do not silently violate it.
Rules are listed in priority order within each section. If two rules conflict on a very small plot, the rule listed first takes priority.
The final layout returned must pass all rules it is physically possible to satisfy given the plot dimensions