[out:json][timeout:90];
area["icao"="KSFO"]["aeroway"="aerodrome"]->.a;
(
  way["aeroway"~"^(runway|taxiway|apron|terminal|taxilane|holding_position|hangar)$"](area.a);
  way["building"="terminal"](area.a);
  node["aeroway"~"^(gate|parking_position|tower)$"](area.a);
  way["aeroway"="aerodrome"]["icao"="KSFO"];
  way["man_made"="tower"](area.a);
);
out body geom;
